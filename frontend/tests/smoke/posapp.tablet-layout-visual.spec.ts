import { expect, test, type Page } from "@playwright/test";

const POS_PATH = process.env.POSA_SMOKE_PATH || "/app/posapp";
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
			// Ignore localStorage failures.
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

test.describe("POS tablet visual safeguards", () => {
	test.use({ viewport: { width: 1280, height: 800 } });

	test("card prices and view toggle labels stay readable", async ({ page }) => {
		await setTabletCardModeDefaults(page);
		await openPosRouteWithAuth(page);
		await ensureMatchaSeedData(page);
		await ensureOpeningDialogNotBlocking(page);
		await ensureCardView(page);

		const cardGrid = page.locator(".items-card-grid").first();
		await expect(cardGrid).toBeVisible();

		const visibleCards = cardGrid.locator(".card-item-card:visible");
		const visibleCount = await visibleCards.count();
		expect(visibleCount).toBeGreaterThan(0);
		const fullyVisibleIndices = await cardGrid.evaluate(() => {
			const grid = document.querySelector(".items-card-grid");
			if (!grid) {
				return [];
			}
			const gridRect = grid.getBoundingClientRect();
			const cards = Array.from(grid.querySelectorAll(".card-item-card")) as HTMLElement[];
			return cards
				.map((card, index) => {
					const rect = card.getBoundingClientRect();
					const fullyVisible =
						rect.top >= gridRect.top &&
						rect.bottom <= gridRect.bottom &&
						rect.left >= gridRect.left &&
						rect.right <= gridRect.right;
					return fullyVisible ? index : -1;
				})
				.filter((index) => index >= 0);
		});
		expect(fullyVisibleIndices.length).toBeGreaterThan(0);

			const indicesToCheck = fullyVisibleIndices;
			for (const idx of indicesToCheck) {
				const card = cardGrid.locator(".card-item-card").nth(idx);
				await expect(card.locator(".primary-price").first()).toBeVisible();

				const hasVisiblePrice = await card.evaluate((el) => {
					const price = el.querySelector(".primary-price") as HTMLElement | null;
					if (!price) {
						return false;
					}
					const cardRect = el.getBoundingClientRect();
					const priceRect = price.getBoundingClientRect();
					const hasText = (price.textContent || "").trim().length > 0;
					return hasText && priceRect.bottom <= cardRect.bottom + 0.5 && priceRect.height >= 10;
				});
				expect(hasVisiblePrice, `Price area clipped on fully visible card index ${idx}`).toBeTruthy();
			}

		const toggleLabels = (
			await page
				.locator(".item-action-toolbar .view-toggle-btn .v-btn .v-btn__content")
				.allTextContents()
		)
			.map((text) => text.trim().toLowerCase())
			.filter(Boolean);
		expect(toggleLabels).toContain("list");
		expect(toggleLabels).toContain("card");

		const clippedToolbarLabels = await page.evaluate(() => {
			const nodes = Array.from(
				document.querySelectorAll(".item-action-toolbar .v-btn .v-btn__content"),
			) as HTMLElement[];
			return nodes
				.filter((node) => {
					if (!node.offsetParent) {
						return false;
					}
					return node.scrollWidth > node.clientWidth + 1;
				})
				.map((node) => node.textContent?.trim() || "");
		});
		expect(clippedToolbarLabels).toEqual([]);
	});

	test("tablet layout has no horizontal overflow in key containers", async ({ page }) => {
		await setTabletCardModeDefaults(page);
		await openPosRouteWithAuth(page);
		await ensureMatchaSeedData(page);
		await ensureOpeningDialogNotBlocking(page);
		await ensureCardView(page);

		const overflowOffenders = await page.evaluate(() => {
			const selectors = [
				"html",
				"body",
				".square-pos-shell",
				".square-pos-columns",
				".items-selector-shell",
				".items-grid-area",
				".items-card-grid",
				".items-selector-toolbar-dock",
				".item-action-toolbar",
				".invoice-shell",
			];
			const offenders: Array<{ selector: string; scrollWidth: number; clientWidth: number }> = [];
			for (const selector of selectors) {
				let element: HTMLElement | null;
				if (selector === "html") {
					element = document.documentElement;
				} else if (selector === "body") {
					element = document.body;
				} else {
					element = document.querySelector(selector);
				}
				if (!element) {
					continue;
				}
				const overflowX = getComputedStyle(element).overflowX;
				const allowsHorizontalScroll = overflowX !== "hidden" && overflowX !== "clip";
				if (allowsHorizontalScroll && element.scrollWidth > element.clientWidth + 2) {
					offenders.push({
						selector,
						scrollWidth: element.scrollWidth,
						clientWidth: element.clientWidth,
					});
				}
			}
			return offenders;
		});
		expect(overflowOffenders).toEqual([]);

		const paneBounds = await page.evaluate(() => {
			const viewportHeight = window.innerHeight;
			const paneSelectors = [
				{ name: "catalog", selector: ".items-selector-shell" },
				{ name: "invoice", selector: ".invoice-shell" },
			];

			return paneSelectors
				.map(({ name, selector }) => {
					const el = document.querySelector(selector) as HTMLElement | null;
					if (!el) {
						return null;
					}
					const rect = el.getBoundingClientRect();
					return {
						name,
						top: rect.top,
						bottom: rect.bottom,
						height: rect.height,
						viewportHeight,
					};
				})
				.filter(Boolean);
		});

		expect(paneBounds.length).toBeGreaterThanOrEqual(2);
		for (const pane of paneBounds) {
			expect(pane.bottom, `${pane.name} pane overflows viewport bottom`).toBeLessThanOrEqual(
				pane.viewportHeight + 2,
			);
			expect(pane.height, `${pane.name} pane collapsed unexpectedly`).toBeGreaterThanOrEqual(
				pane.viewportHeight * 0.78,
			);
		}
	});
});
