import { expect, test, type Locator, type Page, type Request } from "@playwright/test";

const POS_PATH = process.env.POSA_SMOKE_PATH || "/app/posapp";
const TARGET_ITEM_NAME = process.env.POSA_SMOKE_ITEM_NAME || "Matcha Latte";
const TARGET_ITEM_SEARCH = process.env.POSA_SMOKE_ITEM_SEARCH || "MTC-MATCHA-LATTE";
const TARGET_POS_PROFILE = process.env.POSA_SMOKE_POS_PROFILE || "Matcha Tablet POS";

function getSmokeCredentials() {
	const username =
		process.env.POSA_SMOKE_USER || process.env.FRAPPE_ADMIN_USER || "Administrator";
	const password =
		process.env.POSA_SMOKE_PASSWORD || process.env.FRAPPE_ADMIN_PASSWORD || "admin";
	if (!username || !password) {
		return null;
	}
	return { username, password };
}

async function loginIfCredentialsProvided(page: Page) {
	const credentials = getSmokeCredentials();
	if (!credentials) {
		return;
	}

	await page.request.post("/api/method/login", {
		form: {
			usr: credentials.username,
			pwd: credentials.password,
		},
	});
}

async function loginViaFormIfNeeded(page: Page) {
	const credentials = getSmokeCredentials();
	if (!credentials) {
		return;
	}

	await page.goto("/login", { waitUntil: "networkidle" });
	await page
		.locator('input[name="login_email"], input#login_email, input[name="usr"]')
		.first()
		.fill(credentials.username);
	await page
		.locator('input[name="login_password"], input#login_password, input[name="pwd"]')
		.first()
		.fill(credentials.password);
	await page
		.locator('button:has-text("Login"), button:has-text("Log In")')
		.first()
		.click();
	await page.waitForLoadState("networkidle");
}

async function openPosRouteWithAuth(page: Page) {
	await loginIfCredentialsProvided(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });

	if (page.url().includes("/login")) {
		await loginViaFormIfNeeded(page);
		await page.goto(POS_PATH, { waitUntil: "networkidle" });
	}

	if (page.url().includes("/login")) {
		const credentials = getSmokeCredentials();
		throw new Error(
			`Smoke login failed for POS route ${POS_PATH}. Check credentials and site auth state. User: ${credentials?.username || "unset"}`,
		);
	}
}

async function ensureMatchaSeedData(page: Page) {
	await page.request.post(
		"/api/method/posawesome.posawesome.api.matcha_setup.setup_matcha_takeaway_menu",
		{
			form: { pos_profile: TARGET_POS_PROFILE },
		},
	);
}

async function setTabletCardModeDefaults(page: Page) {
	await page.addInitScript(() => {
		(window as any).dev_server = true;
		try {
			localStorage.setItem("posa_items_view", "card");
			localStorage.setItem("posa_items_view_manual", "1");
		} catch (_error) {
			// Ignore local storage errors in hardened browser contexts.
		}
	});
}

async function ensureOpeningDialogNotBlocking(page: Page) {
	const openingTitle = page.getByText("Create POS Opening Shift");
	if (!(await openingTitle.isVisible().catch(() => false))) {
		return;
	}

	const submitBtn = page.getByRole("button", { name: /^Submit$/i });
	if (await submitBtn.isVisible().catch(() => false)) {
		if (await submitBtn.isEnabled().catch(() => false)) {
			await submitBtn.click();
		}
	}

	if (await openingTitle.isVisible().catch(() => false)) {
		const dismissButton = page
			.locator(
				'.modal.show .btn-modal-close, .modal.show button:has-text("Close"), .modal.show button:has-text("Cancel")',
			)
			.first();
		if (await dismissButton.isVisible().catch(() => false)) {
			await dismissButton.click();
		}
	}

	await expect(
		openingTitle,
		"Opening shift dialog is blocking POS. Ensure an open shift exists for the smoke user.",
	).toBeHidden({ timeout: 20000 });
}

async function dismissBlockingModal(page: Page) {
	const modal = page.locator(".modal.show").first();
	if (!(await modal.isVisible().catch(() => false))) {
		return;
	}

	const closeButton = modal
		.locator(
			'button[aria-label="Close"], .btn-modal-close, button:has-text("Close"), button:has-text("Cancel")',
		)
		.first();
	if (await closeButton.isVisible().catch(() => false)) {
		await closeButton.click({ force: true });
	} else {
		await page.keyboard.press("Escape").catch(() => undefined);
	}
	await page.waitForTimeout(250);
}

async function ensureCardView(page: Page) {
	await dismissBlockingModal(page);
	const cardButton = page.getByRole("button", { name: /^Card$/i }).first();
	if (await cardButton.isVisible().catch(() => false)) {
		await cardButton.click();
	}
}

async function getPrimaryPaymentSubmitButton(page: Page): Promise<Locator> {
	const dataTestButton = page.locator("[data-test='charge-btn']").first();
	if ((await dataTestButton.count()) > 0) {
		return dataTestButton;
	}

	return page
		.getByRole("button", {
			name: /^(Submit|Charge(?!\s*&).*)$/i,
		})
		.first();
}

async function getSecondaryPaymentPrintButton(page: Page): Promise<Locator> {
	const dataTestButton = page.locator("[data-test='charge-print-btn']").first();
	if ((await dataTestButton.count()) > 0) {
		return dataTestButton;
	}

	return page
		.getByRole("button", {
			name: /^(Submit & Print|Charge & Print)$/i,
		})
		.first();
}

async function ensurePaymentCoverage(page: Page) {
	const payFullButton = page
		.locator(".payment-method-card .payment-method-btn--primary")
		.filter({ hasText: /Pay Full/i })
		.first();
	if (await payFullButton.isVisible().catch(() => false)) {
		await payFullButton.click();
		return;
	}

	const remainingButton = page
		.locator(".payment-method-card .payment-method-btn--secondary")
		.filter({ hasText: /Remaining/i })
		.first();
	if (await remainingButton.isVisible().catch(() => false)) {
		await remainingButton.click();
	}
}

async function ensureCupLabelName(page: Page, fallback = "CUP-01") {
	const cupLabelInput = page.getByLabel(/Cup Label Name/i).first();
	if (!(await cupLabelInput.isVisible().catch(() => false))) {
		return;
	}
	const existingValue = (await cupLabelInput.inputValue().catch(() => "")).trim();
	if (existingValue.length > 0) {
		return;
	}
	await cupLabelInput.fill(fallback);
}

async function clickModifierChip(
	modifierDialog: Locator,
	labelPattern: RegExp,
	options?: { scrollToBottomFirst?: boolean },
) {
	if (options?.scrollToBottomFirst) {
		const content = modifierDialog.locator(".modifier-dialog-content");
		if (await content.isVisible().catch(() => false)) {
			await content.evaluate((el) => {
				el.scrollTop = el.scrollHeight;
			});
		}
	}

	const chip = modifierDialog.locator(".v-chip").filter({ hasText: labelPattern }).first();
	await expect(chip).toBeVisible({ timeout: 15000 });
	await chip.click();
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

function parseCurrencyNumber(rawValue: unknown): number | null {
	const normalized = String(rawValue ?? "").replace(/[^0-9.-]/g, "");
	const parsed = parseFloat(normalized);
	return Number.isFinite(parsed) ? parsed : null;
}

async function readInputOrSummaryValue(
	page: Page,
	options: { inputLabels?: RegExp[]; summaryLabel?: RegExp },
): Promise<number | null> {
	const labelCandidates = options.inputLabels || [];
	for (const labelPattern of labelCandidates) {
		const field = page.getByLabel(labelPattern).first();
		if (!(await field.isVisible().catch(() => false))) {
			continue;
		}
		const rawValue = await field.inputValue().catch(() => "");
		const parsed = parseCurrencyNumber(rawValue);
		if (parsed !== null) {
			return parsed;
		}
	}

	if (options.summaryLabel) {
		const summaryTile = page
			.locator(".payment-summary-tile")
			.filter({
				has: page
					.locator(".payment-summary-label")
					.filter({ hasText: options.summaryLabel }),
			})
			.first();
		if (await summaryTile.isVisible().catch(() => false)) {
			const rawValue = await summaryTile
				.locator(".payment-summary-value")
				.first()
				.textContent()
				.catch(() => "");
			const parsed = parseCurrencyNumber(rawValue);
			if (parsed !== null) {
				return parsed;
			}
		}
	}

	return null;
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

function findItemInInvoice(invoice: any, itemCode: string) {
	const items = Array.isArray(invoice?.items) ? invoice.items : [];
	return items.find((item: any) => item?.item_code === itemCode);
}

function parseModifierSelections(rawModifiers: unknown): Record<string, string[]> {
	const parsed = parseJsonArg(rawModifiers);
	const source =
		parsed && typeof parsed === "object" && parsed.selections && typeof parsed.selections === "object"
			? parsed.selections
			: parsed && typeof parsed === "object"
				? parsed
				: {};
	const normalized: Record<string, string[]> = {};
	Object.entries(source).forEach(([groupName, value]) => {
		const list = Array.isArray(value) ? value : value != null ? [value] : [];
		const cleaned = list.map((entry) => String(entry || "").trim()).filter(Boolean);
		if (cleaned.length) {
			normalized[groupName] = cleaned;
		}
	});
	return normalized;
}

const cartLineSelector = ".posa-cart-line-card, tr.posa-cart-item-row";

async function addItemBySearchWithDefaults(page: Page, itemCode: string, itemLabel: string) {
	await ensureCardView(page);

	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible();
	await itemSearchInput.fill(itemCode);
	await page.waitForTimeout(350);

	const itemCard = page
		.locator(".card-item-card")
		.filter({ hasText: itemLabel })
		.first();
	await expect(itemCard).toBeVisible({ timeout: 30000 });
	await itemCard.click();

	const modifierDialog = page.locator(".modifier-dialog-card");
	if (await modifierDialog.isVisible().catch(() => false)) {
		const useDefaultsButton = modifierDialog.getByRole("button", { name: /Use Defaults/i }).first();
		if (await useDefaultsButton.isVisible().catch(() => false)) {
			await useDefaultsButton.click();
		}
		await modifierDialog.getByRole("button", { name: /^Apply$/i }).click();
		await expect(modifierDialog).toBeHidden({ timeout: 10000 });
	}
}

async function addYuzuMatchaTonicWithDefaults(page: Page) {
	await setTabletCardModeDefaults(page);
	await openPosRouteWithAuth(page);
	await ensureMatchaSeedData(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await ensureOpeningDialogNotBlocking(page);
	await addItemBySearchWithDefaults(page, "MTC-YUZU-MATCHA-TONIC", "Yuzu Matcha Tonic");
}

test("POS E2E: add Matcha Latte with modifiers and verify cart state", async ({ page }) => {
	await setTabletCardModeDefaults(page);
	await openPosRouteWithAuth(page);
	await ensureMatchaSeedData(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await expect(page).toHaveURL(
		new RegExp("/(app/(posapp|point-of-sale)|desk/(posapp|point-of-sale))"),
	);
	await expect(page.locator(".main-section").first()).toBeVisible();

	await ensureOpeningDialogNotBlocking(page);
	await ensureCardView(page);

	const reloadItemsButton = page.getByRole("button", { name: /Reload Items/i }).first();
	if (await reloadItemsButton.isVisible().catch(() => false)) {
		await reloadItemsButton.click();
	}

	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible();
	await itemSearchInput.fill(TARGET_ITEM_SEARCH);
	await page.waitForTimeout(350);

	const itemCard = page
		.locator(".card-item-card")
		.filter({ hasText: TARGET_ITEM_NAME })
		.first();
	await expect(itemCard).toBeVisible({ timeout: 30000 });
	await itemCard.click();

	const modifierDialog = page.locator(".modifier-dialog-card");
	await expect(modifierDialog).toBeVisible({ timeout: 20000 });

	await clickModifierChip(modifierDialog, /\bHot\b/i);
	await clickModifierChip(modifierDialog, /\bOat Milk\b/i);
	const modifierContent = modifierDialog.locator(".modifier-dialog-content");
	if (await modifierContent.isVisible().catch(() => false)) {
		await modifierContent.evaluate((el) => {
			el.scrollTop = el.scrollHeight;
		});
	}
	await expect(
		modifierDialog.locator(".v-chip").filter({ hasText: /\bBoba\b/i }).first(),
	).toBeVisible({ timeout: 10000 });

	await expect(
		modifierDialog
			.locator(".v-chip")
			.filter({ hasText: /^(No Ice|Light Ice|Regular Ice|Extra Ice)$/ }),
	).toHaveCount(0);

	await modifierDialog.getByRole("button", { name: /^Apply$/i }).click();
	await expect(modifierDialog).toBeHidden({ timeout: 10000 });

	await expect(page.locator(".posa-cart-empty-title")).toHaveCount(0);

	const cartRow = page
		.locator(cartLineSelector)
		.filter({ hasText: TARGET_ITEM_NAME })
		.first();
	await expect(cartRow).toBeVisible({ timeout: 20000 });
	await expect(cartRow).toContainText("Hot");
	await expect(cartRow).toContainText("Oat Milk");

	const totalQtyInput = page.getByLabel(/Total Qty/i).first();
	await expect(totalQtyInput).not.toHaveValue(/^(0|0\.0+)?$/);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();
	await expect(page.locator("body")).not.toContainText(/Missing required modifier group/i);
});

test("POS E2E: Yuzu Matcha Tonic sends required modifier groups through pay+submit", async ({
	page,
}) => {
	await setTabletCardModeDefaults(page);
	await openPosRouteWithAuth(page);
	await ensureMatchaSeedData(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await expect(page).toHaveURL(
		new RegExp("/(app/(posapp|point-of-sale)|desk/(posapp|point-of-sale))"),
	);
	await expect(page.locator(".main-section").first()).toBeVisible();

	await ensureOpeningDialogNotBlocking(page);
	await ensureCardView(page);

	const reloadItemsButton = page.getByRole("button", { name: /Reload Items/i }).first();
	if (await reloadItemsButton.isVisible().catch(() => false)) {
		await reloadItemsButton.click();
	}

	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible();
	await itemSearchInput.fill("MTC-YUZU-MATCHA-TONIC");
	await page.waitForTimeout(350);

	const itemCard = page
		.locator(".card-item-card")
		.filter({ hasText: "Yuzu Matcha Tonic" })
		.first();
	await expect(itemCard).toBeVisible({ timeout: 30000 });
	await itemCard.click();

	const modifierDialog = page.locator(".modifier-dialog-card");
	await expect(modifierDialog).toBeVisible({ timeout: 20000 });

	const useDefaultsButton = modifierDialog.getByRole("button", { name: /Use Defaults/i }).first();
	await expect(useDefaultsButton).toBeVisible({ timeout: 15000 });
	await useDefaultsButton.click();

	await modifierDialog.getByRole("button", { name: /^Apply$/i }).click();
	await expect(modifierDialog).toBeHidden({ timeout: 10000 });

	const yuzuCartRow = page
		.locator(cartLineSelector)
		.filter({ hasText: "Yuzu Matcha Tonic" })
		.first();
	await expect(yuzuCartRow).toBeVisible({ timeout: 20000 });

	const updateRequestPromise = page.waitForRequest(
		(request) =>
			request.method() === "POST" &&
			request.url().includes("/api/method/posawesome.posawesome.api.invoices.update_invoice"),
	);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	const updateRequest = await updateRequestPromise;
	const updateInvoicePayload = getRequestInvoicePayload(updateRequest);
	const updatedYuzuItem = findItemInInvoice(updateInvoicePayload, "MTC-YUZU-MATCHA-TONIC");
	expect(updatedYuzuItem).toBeTruthy();

	const updateSelections = parseModifierSelections(updatedYuzuItem?.posa_modifiers_json);
	expect(updateSelections["Size"]?.length).toBeGreaterThan(0);
	expect(updateSelections["Sugar Level"]?.length).toBeGreaterThan(0);
	expect(updateSelections["Ice Level"]?.length).toBeGreaterThan(0);

	const paymentSubmitButton = await getPrimaryPaymentSubmitButton(page);
	await ensurePaymentCoverage(page);
	await ensureCupLabelName(page, "YUZU-RUSH-1");
	await expect(paymentSubmitButton).toBeVisible({ timeout: 15000 });
	await expect(paymentSubmitButton).toBeEnabled();

	const submitRequestPromise = page.waitForRequest(
		(request) =>
			request.method() === "POST" &&
			request.url().includes("/api/method/posawesome.posawesome.api.invoices.submit_invoice"),
	);

	await paymentSubmitButton.click();

	const submitRequest = await submitRequestPromise;
	const submitInvoicePayload = getRequestInvoicePayload(submitRequest);
	const submittedYuzuItem = findItemInInvoice(submitInvoicePayload, "MTC-YUZU-MATCHA-TONIC");
	expect(submittedYuzuItem).toBeTruthy();

	const submitSelections = parseModifierSelections(submittedYuzuItem?.posa_modifiers_json);
	expect(submitSelections["Size"]?.length).toBeGreaterThan(0);
	expect(submitSelections["Sugar Level"]?.length).toBeGreaterThan(0);
	expect(submitSelections["Ice Level"]?.length).toBeGreaterThan(0);

	await expect(page.locator("body")).not.toContainText(/Missing required modifier group/i);
});

test("POS E2E: canceling Yuzu modifier dialog does not add item", async ({ page }) => {
	await setTabletCardModeDefaults(page);
	await openPosRouteWithAuth(page);
	await ensureMatchaSeedData(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await ensureOpeningDialogNotBlocking(page);
	await ensureCardView(page);

	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible();
	await itemSearchInput.fill("MTC-YUZU-MATCHA-TONIC");
	await page.waitForTimeout(350);

	const itemCard = page
		.locator(".card-item-card")
		.filter({ hasText: "Yuzu Matcha Tonic" })
		.first();
	await expect(itemCard).toBeVisible({ timeout: 30000 });
	await itemCard.click();

	const modifierDialog = page.locator(".modifier-dialog-card");
	await expect(modifierDialog).toBeVisible({ timeout: 20000 });
	await modifierDialog.getByRole("button", { name: /^Cancel$/i }).click();
	await expect(modifierDialog).toBeHidden({ timeout: 10000 });

	await expect(
		page.locator(cartLineSelector).filter({ hasText: "Yuzu Matcha Tonic" }),
	).toHaveCount(0);
	await expect(page.locator(".posa-cart-empty-title")).toContainText(/Cart is empty/i);
});

test("POS E2E: Yuzu manual required modifiers persist through pay+submit", async ({ page }) => {
	await setTabletCardModeDefaults(page);
	await openPosRouteWithAuth(page);
	await ensureMatchaSeedData(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await ensureOpeningDialogNotBlocking(page);
	await ensureCardView(page);

	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible();
	await itemSearchInput.fill("MTC-YUZU-MATCHA-TONIC");
	await page.waitForTimeout(350);

	const itemCard = page
		.locator(".card-item-card")
		.filter({ hasText: "Yuzu Matcha Tonic" })
		.first();
	await expect(itemCard).toBeVisible({ timeout: 30000 });
	await itemCard.click();

	const modifierDialog = page.locator(".modifier-dialog-card");
	await expect(modifierDialog).toBeVisible({ timeout: 20000 });

	await clickModifierChip(modifierDialog, /\bSmall\b/i);
	await clickModifierChip(modifierDialog, /25%/i);
	await clickModifierChip(modifierDialog, /\bExtra Ice\b/i);
	await clickModifierChip(modifierDialog, /\bExtra Matcha Shot\b/i, {
		scrollToBottomFirst: true,
	});

	await modifierDialog.getByRole("button", { name: /^Apply$/i }).click();
	await expect(modifierDialog).toBeHidden({ timeout: 10000 });

	const updateRequestPromise = page.waitForRequest(
		(request) =>
			request.method() === "POST" &&
			request.url().includes("/api/method/posawesome.posawesome.api.invoices.update_invoice"),
	);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	const updateRequest = await updateRequestPromise;
	const updateInvoicePayload = getRequestInvoicePayload(updateRequest);
	const updatedYuzuItem = findItemInInvoice(updateInvoicePayload, "MTC-YUZU-MATCHA-TONIC");
	expect(updatedYuzuItem).toBeTruthy();

	const updateSelections = parseModifierSelections(updatedYuzuItem?.posa_modifiers_json);
	expect(updateSelections["Size"]).toContain("Small");
	expect(updateSelections["Sugar Level"]).toContain("25%");
	expect(updateSelections["Ice Level"]).toContain("Extra Ice");

	const paymentSubmitButton = await getPrimaryPaymentSubmitButton(page);
	await ensurePaymentCoverage(page);
	await ensureCupLabelName(page, "YUZU-RUSH-2");
	await expect(paymentSubmitButton).toBeVisible({ timeout: 15000 });
	await expect(paymentSubmitButton).toBeEnabled();

	const submitRequestPromise = page.waitForRequest(
		(request) =>
			request.method() === "POST" &&
			request.url().includes("/api/method/posawesome.posawesome.api.invoices.submit_invoice"),
	);
	await paymentSubmitButton.click();

	const submitRequest = await submitRequestPromise;
	const submitInvoicePayload = getRequestInvoicePayload(submitRequest);
	const submittedYuzuItem = findItemInInvoice(submitInvoicePayload, "MTC-YUZU-MATCHA-TONIC");
	expect(submittedYuzuItem).toBeTruthy();

	const submitSelections = parseModifierSelections(submittedYuzuItem?.posa_modifiers_json);
	expect(submitSelections["Size"]).toContain("Small");
	expect(submitSelections["Sugar Level"]).toContain("25%");
	expect(submitSelections["Ice Level"]).toContain("Extra Ice");

	await expect(page.locator("body")).not.toContainText(/Missing required modifier group/i);
});

test("POS E2E: landscape tablet layout keeps panes readable", async ({ page }) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await setTabletCardModeDefaults(page);
	await openPosRouteWithAuth(page);
	await ensureMatchaSeedData(page);
	await page.goto(POS_PATH, { waitUntil: "networkidle" });
	await ensureOpeningDialogNotBlocking(page);
	await ensureCardView(page);

	const reloadItemsButton = page.getByRole("button", { name: /Reload Items/i }).first();
	if (await reloadItemsButton.isVisible().catch(() => false)) {
		await reloadItemsButton.click();
	}

	const itemSearchInput = page.locator(".items-selector-card input[type='text']").first();
	await expect(itemSearchInput).toBeVisible();
	await itemSearchInput.fill("");
	await page.waitForTimeout(500);

	const firstCard = page.locator(".card-item-card").first();
	await expect(firstCard).toBeVisible({ timeout: 30000 });

	const layoutMetrics = await page.evaluate(() => {
		const rectFor = (selector: string) => {
			const element = document.querySelector(selector) as HTMLElement | null;
			if (!element) {
				return null;
			}
			const rect = element.getBoundingClientRect();
			return {
				x: rect.x,
				y: rect.y,
				width: rect.width,
				height: rect.height,
				right: rect.right,
				bottom: rect.bottom,
			};
		};

		const visibleCards = Array.from(document.querySelectorAll(".card-item-card"))
			.map((el) => el.getBoundingClientRect())
			.filter(
				(rect) =>
					rect.width > 120 &&
					rect.height > 120 &&
					rect.bottom > 0 &&
					rect.top < window.innerHeight,
			);

		const minTop = visibleCards.length ? Math.min(...visibleCards.map((rect) => rect.top)) : 0;
		const firstRowCount = visibleCards.filter((rect) => Math.abs(rect.top - minTop) < 12).length;

		return {
			leftRect: rectFor(".square-pane-left .items-selector-card"),
			rightRect: rectFor(".square-pane-cart .invoice-card"),
			visibleCardCount: visibleCards.length,
			firstRowCount,
			viewportHeight: window.innerHeight,
			viewportWidth: window.innerWidth,
			rootScrollWidth: document.documentElement.scrollWidth,
		};
	});

	expect(layoutMetrics.leftRect).not.toBeNull();
	expect(layoutMetrics.rightRect).not.toBeNull();
	if (!layoutMetrics.leftRect || !layoutMetrics.rightRect) {
		return;
	}

	expect(layoutMetrics.leftRect.width).toBeGreaterThan(360);
	expect(layoutMetrics.rightRect.width).toBeGreaterThan(360);
	expect(layoutMetrics.rightRect.width).toBeGreaterThan(layoutMetrics.leftRect.width * 0.95);
	expect(layoutMetrics.leftRect.right).toBeLessThanOrEqual(layoutMetrics.rightRect.x + 2);
	expect(layoutMetrics.visibleCardCount).toBeGreaterThanOrEqual(5);
	expect(layoutMetrics.firstRowCount).toBeGreaterThanOrEqual(3);
	expect(layoutMetrics.rootScrollWidth).toBeLessThanOrEqual(layoutMetrics.viewportWidth + 2);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeVisible();
	const payBounds = await payButton.boundingBox();
	expect(payBounds).not.toBeNull();
	if (payBounds) {
		expect(payBounds.y + payBounds.height).toBeLessThanOrEqual(
			layoutMetrics.viewportHeight,
		);
	}
});

test("POS E2E: quick-pay supports split tender entry on tablet payment screen", async ({
	page,
}) => {
	await addYuzuMatchaTonicWithDefaults(page);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	const cashInput = page.getByLabel(/^Cash$/i).first();
	const creditInput = page.getByLabel(/Credit Card/i).first();

	await expect(cashInput).toBeVisible({ timeout: 15000 });
	await expect(creditInput).toBeVisible({ timeout: 15000 });

	const initialTotalDue =
		(await readInputOrSummaryValue(page, {
			inputLabels: [/Grand Total/i, /Total Amount/i],
			summaryLabel: /Amount Due/i,
		})) || 0;

	await cashInput.click({ clickCount: 3 });
	await cashInput.fill("5");
	await cashInput.blur();

	const creditCardRow = page
		.locator(".payment-method-card")
		.filter({ hasText: /Credit Card/i })
		.first();

	const remainingButtonInCredit = creditCardRow
		.getByRole("button", { name: /Remaining/i })
		.first();
	if (await remainingButtonInCredit.isVisible().catch(() => false)) {
		await remainingButtonInCredit.click();
	} else {
		const creditAmount = initialTotalDue > 5 ? initialTotalDue - 5 : 1;
		await creditInput.click({ clickCount: 3 });
		await creditInput.fill(String(creditAmount.toFixed(2)));
		await creditInput.blur();
	}

	const paymentSubmitButton = await getPrimaryPaymentSubmitButton(page);
	await expect(paymentSubmitButton).toBeEnabled();

	const paidValue = await readInputOrSummaryValue(page, {
		inputLabels: [/Paid Amount/i, /^Paid$/i],
		summaryLabel: /^Paid$/i,
	});
	const amountDueValue = await readInputOrSummaryValue(page, {
		inputLabels: [/Amount Due/i, /To Be Paid/i, /Outstanding Amount/i],
		summaryLabel: /Amount Due/i,
	});

	if (paidValue !== null && initialTotalDue > 0) {
		expect(Math.abs(paidValue - initialTotalDue)).toBeLessThanOrEqual(0.05);
	}
	if (amountDueValue !== null && initialTotalDue > 0) {
		expect(Math.abs(amountDueValue)).toBeLessThanOrEqual(0.05);
	}
});

test("POS E2E: quick-pay amount rebalances when cart lines change after opening payment", async ({
	page,
}) => {
	await addYuzuMatchaTonicWithDefaults(page);
	await addItemBySearchWithDefaults(page, "MTC-MATCHA-LATTE", "Matcha Latte");

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	await ensurePaymentCoverage(page);

	let initialPaid = 0;
	await expect
		.poll(async () => {
			initialPaid =
				(await readInputOrSummaryValue(page, {
					inputLabels: [/Paid Amount/i, /^Paid$/i],
					summaryLabel: /^Paid$/i,
				})) || 0;
			return initialPaid;
		})
		.toBeGreaterThan(0);

	const removeButton = page
		.locator(".square-pane-cart")
		.getByRole("button", { name: /^Remove$/i })
		.first();
	await expect(removeButton).toBeVisible({ timeout: 15000 });
	await removeButton.click();

	await expect
		.poll(async () => {
			return (
				(await readInputOrSummaryValue(page, {
					inputLabels: [/Paid Amount/i, /^Paid$/i],
					summaryLabel: /^Paid$/i,
				})) || 0
			);
		})
		.toBeLessThan(initialPaid - 0.05);

	await expect
		.poll(async () => {
			return Math.abs(
				(await readInputOrSummaryValue(page, {
					inputLabels: [/Amount Due/i, /To Be Paid/i, /Outstanding Amount/i],
					summaryLabel: /Amount Due/i,
				})) || 0,
			);
		})
		.toBeLessThanOrEqual(0.05);
});

test("POS E2E: removing the last cart line during payment blocks charge safely", async ({
	page,
}) => {
	await addYuzuMatchaTonicWithDefaults(page);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	await ensurePaymentCoverage(page);

	const chargeButton = await getPrimaryPaymentSubmitButton(page);
	await expect(chargeButton).toBeVisible({ timeout: 15000 });
	await expect(chargeButton).toBeEnabled();

	const removeButton = page
		.locator(".square-pane-cart")
		.getByRole("button", { name: /^Remove$/i })
		.first();
	await expect(removeButton).toBeVisible({ timeout: 15000 });
	await removeButton.click();

	await expect(page.locator(".posa-cart-empty-title")).toContainText(/Cart is empty/i);
	await expect
		.poll(async () => {
			return Math.abs(
				(await readInputOrSummaryValue(page, {
					inputLabels: [/Paid Amount/i, /^Paid$/i],
					summaryLabel: /^Paid$/i,
				})) || 0,
			);
		})
		.toBeLessThanOrEqual(0.05);

	const chargeStillVisible = await chargeButton.isVisible().catch(() => false);
	if (chargeStillVisible) {
		await expect(chargeButton).toBeDisabled();
		await expect(page.locator(".payment-inline-error")).toContainText(/Cart is empty/i);
	} else {
		await expect(page.locator(".items-selector-card")).toBeVisible();
	}
});

test("POS E2E: payment screen has no horizontal overflow and shows CTA hierarchy", async ({
	page,
}) => {
	await page.setViewportSize({ width: 1280, height: 800 });
	await addYuzuMatchaTonicWithDefaults(page);

	const payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	const chargeButton = await getPrimaryPaymentSubmitButton(page);
	const chargePrintButton = await getSecondaryPaymentPrintButton(page);
	const cancelPaymentButton =
		(await page.locator("[data-test='cancel-payment-btn']").count()) > 0
			? page.locator("[data-test='cancel-payment-btn']").first()
			: page.getByRole("button", { name: /Cancel Payment/i }).first();

	await expect(chargeButton).toBeVisible({ timeout: 15000 });
	await expect(chargePrintButton).toBeVisible();
	await expect(cancelPaymentButton).toBeVisible();
	await expect(chargeButton).toContainText(/Charge|Submit/i);
	await expect(chargePrintButton).toContainText(/Charge & Print|Submit & Print/i);
	await expect(cancelPaymentButton).toContainText(/Cancel Payment/i);

	const metrics = await page.evaluate(() => {
		const docEl = document.documentElement;
		const paymentBody = document.querySelector(".payments-body-scroll") as HTMLElement | null;
		return {
			viewportWidth: window.innerWidth,
			rootScrollWidth: docEl.scrollWidth,
			paymentBodyClientWidth: paymentBody?.clientWidth || 0,
			paymentBodyScrollWidth: paymentBody?.scrollWidth || 0,
		};
	});

	expect(metrics.rootScrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 2);
	expect(metrics.paymentBodyScrollWidth).toBeLessThanOrEqual(metrics.paymentBodyClientWidth + 2);
});

test("POS E2E: quick-pay amount re-syncs when returning to cart and modifying items", async ({
	page,
}) => {
	await addYuzuMatchaTonicWithDefaults(page);

	// 1. Go to payment screen
	let payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	await ensurePaymentCoverage(page);

	// 2. Modify payment amount explicitly
	const cashInput = page.getByLabel(/^Cash$/i).first();
	await expect(cashInput).toBeVisible({ timeout: 15000 });
	await cashInput.click({ clickCount: 3 });
	await cashInput.fill("10");
	await cashInput.blur();

	const initialPaid =
		(await readInputOrSummaryValue(page, {
			inputLabels: [/Paid Amount/i, /^Paid$/i],
			summaryLabel: /^Paid$/i,
		})) || 0;
	expect(initialPaid).toBe(10);

	// 3. Return to cart via Cancel Payment
	const cancelPaymentButton =
		(await page.locator("[data-test='cancel-payment-btn']").count()) > 0
			? page.locator("[data-test='cancel-payment-btn']").first()
			: page.getByRole("button", { name: /Cancel Payment/i }).first();
	await cancelPaymentButton.click();

	// Wait for cart view
	await expect(page.locator(".items-selector-card")).toBeVisible({ timeout: 10000 });

	// 4. Add another item to the cart
	await addItemBySearchWithDefaults(page, "MTC-MATCHA-LATTE", "Matcha Latte");

	// wait for totals
	await page.waitForTimeout(1000);

	// 5. Open payment screen again
	payButton = page.getByRole("button", { name: /^PAY$/i }).first();
	await expect(payButton).toBeEnabled();
	await payButton.click();

	await ensurePaymentCoverage(page);

	// 6. Verify payment amount matches the new total, and isn't the stale explicit value (10)
	const newTotalDue =
		(await readInputOrSummaryValue(page, {
			inputLabels: [/Grand Total/i, /Total Amount/i],
			summaryLabel: /Amount Due/i,
		})) || 0;

	const newPaid =
		(await readInputOrSummaryValue(page, {
			inputLabels: [/Paid Amount/i, /^Paid$/i],
			summaryLabel: /^Paid$/i,
		})) || 0;

	expect(newPaid).toBeGreaterThan(0);
	expect(newPaid).not.toBe(10);
	// We expect the new auto-synced amount to exactly match the total due
	expect(Math.abs(newPaid - newTotalDue)).toBeLessThanOrEqual(0.05);

	// Remaining due should be zero if it perfectly synced
	const amountDueValue = await readInputOrSummaryValue(page, {
		inputLabels: [/Amount Due/i, /To Be Paid/i, /Outstanding Amount/i],
		summaryLabel: /Amount Due/i,
	});
	if (amountDueValue !== null) {
		expect(Math.abs(amountDueValue)).toBeLessThanOrEqual(0.05);
	}
});
