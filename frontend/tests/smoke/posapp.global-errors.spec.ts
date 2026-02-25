import { expect, test, type Page } from "@playwright/test";

const POS_PATH = process.env.POSA_SMOKE_PATH || "/app/posapp";

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

function isBenignErrorMessage(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes("remove_last_divider") ||
		normalized.includes("failed to load resource") ||
		(normalized.includes("offsetwidth") &&
			normalized.includes("shortcut.js"))
	);
}

async function loginIfCredentialsProvided(page: Page) {
	const credentials = getSmokeCredentials();
	if (!credentials) {
		return;
	}

	// Prefer API login for cross-version stability of login forms/selectors.
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

	const userInput = page.locator(
		'input[name="login_email"], input#login_email, input[name="usr"]',
	);
	const passInput = page.locator(
		'input[name="login_password"], input#login_password, input[name="pwd"]',
	);
	const loginButton = page.locator(
		'button:has-text("Login"), button:has-text("Log In")',
	);

	if ((await userInput.count()) === 0 || (await passInput.count()) === 0) {
		return;
	}

	await userInput.first().fill(credentials.username);
	await passInput.first().fill(credentials.password);
	await loginButton.first().click();
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

test("POS app smoke route has no uncaught global errors", async ({ page }) => {
	const capturedErrors: string[] = [];

	// In local dev smoke runs, web and socketio often run on separate ports.
	// Enabling dev_server makes Frappe realtime client honor boot.socketio_port.
	await page.addInitScript(() => {
		(window as any).dev_server = true;
	});

	page.on("pageerror", (error) => {
		const message = String(error?.message || error);
		if (!isBenignErrorMessage(message)) {
			capturedErrors.push(`pageerror: ${message}`);
		}
	});

	page.on("console", (msg) => {
		if (msg.type() !== "error") {
			return;
		}
		const text = msg.text();
		if (!isBenignErrorMessage(text)) {
			capturedErrors.push(`console.error: ${text}`);
		}
	});

	await openPosRouteWithAuth(page);

	await expect(page).toHaveURL(
		new RegExp("/(app/(posapp|point-of-sale)|desk/(posapp|point-of-sale))"),
	);
	await expect(page.locator(".main-section").first()).toBeVisible();

	await page.waitForTimeout(5000);
	expect(capturedErrors, capturedErrors.join("\n")).toHaveLength(0);
});
