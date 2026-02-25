import { expect, test, type Page, type Request } from "@playwright/test";

const POS_PATH = process.env.POSA_SMOKE_PATH || "/app/posapp";
const TARGET_POS_PROFILE = process.env.POSA_SMOKE_POS_PROFILE || "Matcha Tablet POS";

function getSmokeCredentials() {
	const username = process.env.POSA_SMOKE_USER || process.env.FRAPPE_ADMIN_USER || "Administrator";
	const password = process.env.POSA_SMOKE_PASSWORD || process.env.FRAPPE_ADMIN_PASSWORD || "admin";
	return { username, password };
}

async function loginIfNeeded(page: Page) {
	const credentials = getSmokeCredentials();
	await page.request.post("/api/method/login", {
		form: {
			usr: credentials.username,
			pwd: credentials.password,
		},
	});
}

async function openPos(page: Page) {
	await loginIfNeeded(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
}

async function seedMatchaMenu(page: Page) {
	await page.request.post("/api/method/posawesome.posawesome.api.matcha_setup.setup_matcha_takeaway_menu", {
		form: { pos_profile: TARGET_POS_PROFILE },
	});
}

async function ensureOpeningDialogNotBlocking(page: Page) {
	const openingTitle = page.getByText("Create POS Opening Shift");
	if (!(await openingTitle.isVisible().catch(() => false))) {
		return;
	}

	const submitBtn = page.getByRole("button", { name: /^Submit$/i }).first();
	if (await submitBtn.isVisible().catch(() => false)) {
		if (await submitBtn.isEnabled().catch(() => false)) {
			await submitBtn.click();
		}
	}

	await expect(
		openingTitle,
		"Opening shift dialog is blocking POS. Ensure an open shift exists for the smoke user.",
	).toBeHidden({ timeout: 20000 });
}

async function addPrepDrink(page: Page) {
	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible({ timeout: 30000 });
	await itemSearchInput.fill("MTC-YUZU-MATCHA-TONIC");
	await page.waitForTimeout(400);

	const itemCard = page
		.locator(".card-item-card")
		.filter({ hasText: "Yuzu Matcha Tonic" })
		.first();
	await expect(itemCard).toBeVisible({ timeout: 30000 });
	await itemCard.click();

	const modifierDialog = page.locator(".modifier-dialog-card");
	await expect(modifierDialog).toBeVisible({ timeout: 20000 });

	const useDefaults = modifierDialog.getByRole("button", { name: /Use Defaults/i }).first();
	if (await useDefaults.isVisible().catch(() => false)) {
		await useDefaults.click();
	}

	await modifierDialog.getByRole("button", { name: /^Apply$/i }).click();
	await expect(modifierDialog).toBeHidden({ timeout: 10000 });
}

function parseRequestBody(request: Request): Record<string, any> {
	const payload = request.postData() || "";
	if (!payload) {
		return {};
	}

	try {
		const parsed = JSON.parse(payload);
		if (parsed && typeof parsed === "object") {
			return parsed;
		}
	} catch (_error) {
		// Continue with form parsing.
	}

	const params = new URLSearchParams(payload);
	const parsedForm: Record<string, any> = {};
	for (const [key, value] of params.entries()) {
		parsedForm[key] = value;
	}
	return parsedForm;
}

function parseJsonArg(rawValue: unknown): any {
	if (typeof rawValue !== "string" || !rawValue.trim()) {
		return rawValue ?? null;
	}
	try {
		return JSON.parse(rawValue);
	} catch (_error) {
		return rawValue;
	}
}

function getRequestInvoicePayload(request: Request): any {
	const body = parseRequestBody(request);
	const args = parseJsonArg(body.args) || {};
	const invoiceCandidate =
		args.invoice !== undefined
			? args.invoice
			: args.data !== undefined
				? args.data
				: body.invoice !== undefined
					? body.invoice
					: body.data;
	return parseJsonArg(invoiceCandidate) || {};
}

test("POS E2E: cup label name is enforced for prep items and submit proceeds after entry", async ({
	page,
}) => {
	await openPos(page);
	await seedMatchaMenu(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await ensureOpeningDialogNotBlocking(page);
	await addPrepDrink(page);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeVisible({ timeout: 20000 });
	await payButton.click();

	const additionalPanel = page
		.locator(".v-expansion-panel-title")
		.filter({ hasText: "Additional Invoice Details" })
		.first();
	if (await additionalPanel.isVisible().catch(() => false)) {
		await additionalPanel.click();
	}

	const cupInput = page.getByLabel(/Cup Label Name/i).first();
	await expect(cupInput).toBeVisible({ timeout: 10000 });
	await expect(cupInput).toHaveValue("");
	await cupInput.fill("");

	const submitRequests: Request[] = [];
	page.on("request", (request) => {
		if (
			request.method() === "POST" &&
			request.url().includes("/api/method/posawesome.posawesome.api.invoices.submit_invoice")
		) {
			submitRequests.push(request);
		}
	});

	const dataTestButton = page.locator("[data-test='charge-btn']").first();
	const submitButton =
		(await dataTestButton.count()) > 0
			? dataTestButton
			: page
					.getByRole("button", {
						name: /^(Submit|Charge(?!\s*&).*)$/i,
					})
					.first();

	await expect(submitButton).toBeVisible({ timeout: 10000 });
	await submitButton.click();
	await page.waitForTimeout(1200);

	await expect(
		page.getByText(/Cup Label Name is required for prep items/i).first(),
	).toBeVisible({ timeout: 5000 });
	expect(submitRequests.length).toBe(0);

	await cupInput.fill("MATCHA CUP");
	await submitButton.click();

	await expect.poll(() => submitRequests.length, { timeout: 15000 }).toBeGreaterThan(0);

	const latestRequest = submitRequests[submitRequests.length - 1];
	expect(latestRequest).toBeTruthy();
	if (latestRequest) {
		const invoicePayload = getRequestInvoicePayload(latestRequest);
		expect(String(invoicePayload?.posa_cup_customer_name || "").trim()).toBe("MATCHA CUP");
	}
});
