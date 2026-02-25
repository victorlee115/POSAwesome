/**
 * paymentSyncOnCartMutation.spec.ts
 *
 * Comprehensive unit tests for the "stale payment amount after cart mutation"
 * feature. Covers the full sync chain:
 *
 *   Cart add/remove  →  changeVersion bump  →  syncPaymentDocumentTotalsFromCart
 *                     →  autoSyncQuickPay reset  →  syncQuickPayAmountsToInvoiceTotal
 *                     →  diff_payment / total_payments recomputed
 *
 * Tests are pure logic (no Vue component mounting) so they run fast and
 * deterministically.  They replicate the exact algorithms used in
 * Payments.vue and usePaymentCalculations.ts.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { ref, computed } from "vue";
import { usePaymentCalculations } from "../src/posapp/composables/pos/payments/usePaymentCalculations";

// ---------------------------------------------------------------------------
// Helpers — mirror the Payments.vue flt / epsilon helpers
// ---------------------------------------------------------------------------

const PRECISION = 2;

function flt(val: any, prec: number = PRECISION): number {
	const n = parseFloat(String(val).replace(/,/g, "")) || 0;
	return parseFloat(n.toFixed(prec));
}

const EPSILON = 1 / Math.pow(10, PRECISION + 1);

function makePayment(overrides: Partial<{
	mode_of_payment: string;
	amount: number;
	base_amount: number;
	default: number;
	name: string;
}> = {}) {
	return {
		mode_of_payment: "Cash",
		amount: 0,
		base_amount: 0,
		default: 0,
		name: "",
		...overrides,
	};
}

function makeCartItem(overrides: Partial<{
	item_code: string;
	qty: number;
	rate: number;
	posa_is_replace: boolean;
}> = {}) {
	return {
		item_code: "ITEM-001",
		qty: 1,
		rate: 10,
		posa_is_replace: false,
		...overrides,
	};
}

/**
 * Pure replication of syncPaymentDocumentTotalsFromCart from Payments.vue.
 * Mutates `doc` in place and returns the updated doc.
 */
function syncPaymentDocumentTotalsFromCart(
	doc: any,
	cartItems: any[],
	opts: {
		additionalDiscount?: number;
		deliveryCharges?: number;
		precision?: number;
	} = {},
): any {
	const precision = opts.precision ?? PRECISION;
	const epsilon = 1 / Math.pow(10, precision + 1);

	const payableItems = cartItems.filter(
		(item) =>
			!item?.posa_is_replace &&
			Math.abs(flt(item?.qty || 0, precision)) > 0,
	);

	let liveNetTotal = flt(
		payableItems.reduce((sum, item) => {
			return sum + flt(item?.qty || 0, precision) * flt(item?.rate || 0, precision);
		}, 0),
		precision,
	);

	const additionalDiscount = Math.abs(flt(opts.additionalDiscount ?? 0, precision));
	const deliveryCharges = flt(opts.deliveryCharges ?? 0, precision);
	liveNetTotal = flt(liveNetTotal - additionalDiscount + deliveryCharges, precision);

	const previousNetTotal = flt(doc.total ?? doc.net_total ?? 0, precision);
	const previousTaxTotal = flt(doc.total_taxes_and_charges || 0, precision);
	let liveTaxTotal = previousTaxTotal;

	if (Math.abs(liveNetTotal) <= epsilon) {
		liveTaxTotal = 0;
	} else if (Math.abs(previousTaxTotal) > epsilon) {
		liveTaxTotal =
			Math.abs(previousNetTotal) > epsilon
				? flt((previousTaxTotal / previousNetTotal) * liveNetTotal, precision)
				: 0;
	}

	let liveGrandTotal = flt(liveNetTotal + liveTaxTotal, precision);

	const previousGrandTotal = flt(
		doc.grand_total ?? previousNetTotal + previousTaxTotal,
		precision,
	);
	const previousRoundedTotal = flt(doc.rounded_total ?? previousGrandTotal, precision);
	let roundingDelta = flt(previousRoundedTotal - previousGrandTotal, precision);
	if (Math.abs(roundingDelta) <= epsilon) roundingDelta = 0;

	let liveRoundedTotal = flt(liveGrandTotal + roundingDelta, precision);

	if (Math.abs(liveGrandTotal) <= epsilon) {
		liveNetTotal = 0;
		liveTaxTotal = 0;
		liveGrandTotal = 0;
		liveRoundedTotal = 0;
	}

	if (!doc.is_return) {
		liveNetTotal = Math.max(liveNetTotal, 0);
		liveTaxTotal = Math.max(liveTaxTotal, 0);
		liveGrandTotal = Math.max(liveGrandTotal, 0);
		liveRoundedTotal = Math.max(liveRoundedTotal, 0);
	}

	doc.total = liveNetTotal;
	doc.net_total = liveNetTotal;
	doc.grand_total = liveGrandTotal;
	doc.rounded_total = liveRoundedTotal;
	doc.total_taxes_and_charges = liveTaxTotal;

	return doc;
}

/**
 * Pure replication of syncQuickPayAmountsToInvoiceTotal from Payments.vue.
 * Returns the mutated payments array for assertion.
 */
function syncQuickPayAmountsToInvoiceTotal(
	doc: any,
	autoSyncQuickPay: boolean,
	autoSyncPaymentKey: string,
	loyaltySettled: number = 0,
	creditSettled: number = 0,
	precision: number = PRECISION,
): { payments: any[]; targetKey: string } {
	if (!autoSyncQuickPay) {
		return { payments: doc.payments || [], targetKey: autoSyncPaymentKey };
	}

	const payments: any[] = Array.isArray(doc?.payments) ? doc.payments : [];
	if (!doc || !payments.length || doc.is_return) {
		return { payments, targetKey: autoSyncPaymentKey };
	}

	const epsilon = 1 / Math.pow(10, precision + 1);
	const invoiceTotal = Math.max(
		flt(doc.rounded_total || doc.grand_total || 0, precision),
		0,
	);

	// Zero-total case: clear all payments
	if (invoiceTotal <= epsilon) {
		const hasPositive = payments.some(
			(p) => Math.abs(flt(p?.amount || 0, precision)) > epsilon,
		);
		if (hasPositive) {
			payments.forEach((p) => {
				p.amount = 0;
				if (p.base_amount !== undefined) p.base_amount = 0;
			});
		}
		return { payments, targetKey: "" };
	}

	// Resolve target payment
	let targetPayment: any = null;
	if (autoSyncPaymentKey) {
		targetPayment = payments.find((p) => {
			const key = String(p?.name || p?.mode_of_payment || p?.account || "");
			return key === autoSyncPaymentKey;
		});
	}
	if (!targetPayment) {
		targetPayment = payments.find((p) => p?.default === 1) || payments[0];
	}
	if (!targetPayment) {
		return { payments, targetKey: autoSyncPaymentKey };
	}

	const newKey = String(
		targetPayment?.name || targetPayment?.mode_of_payment || targetPayment?.account || "",
	);

	const otherPaymentsTotal = payments.reduce((sum, p) => {
		if (p === targetPayment) return sum;
		return sum + Math.max(flt(p?.amount || 0, precision), 0);
	}, 0);

	const needsOtherReset = payments.some(
		(p) => p !== targetPayment && Math.abs(flt(p?.amount || 0, precision)) > epsilon,
	);

	// When other payments will be zeroed, don't subtract their stale amounts from target
	const effectiveOtherTotal = needsOtherReset ? 0 : otherPaymentsTotal;

	let targetAmount = flt(
		invoiceTotal - loyaltySettled - creditSettled - effectiveOtherTotal,
		precision,
	);
	if (targetAmount < 0) targetAmount = 0;

	const currentAmount = flt(targetPayment.amount || 0, precision);
	const needsUpdate = Math.abs(currentAmount - targetAmount) > epsilon;

	if (!needsUpdate && !needsOtherReset) {
		return { payments, targetKey: newKey };
	}

	payments.forEach((p) => {
		if (p !== targetPayment) {
			p.amount = 0;
			if (p.base_amount !== undefined) p.base_amount = 0;
		}
	});
	targetPayment.amount = targetAmount;
	if (targetPayment.base_amount !== undefined) {
		targetPayment.base_amount = flt(targetAmount * (doc.conversion_rate || 1), precision);
	}

	return { payments, targetKey: newKey };
}

// ---------------------------------------------------------------------------
// Helper: simulate "Pay button pressed then cart mutated"
// ---------------------------------------------------------------------------

function makeInvoiceDoc(overrides: Partial<{
	grand_total: number;
	rounded_total: number;
	total: number;
	net_total: number;
	total_taxes_and_charges: number;
	conversion_rate: number;
	is_return: number;
	payments: any[];
}> = {}) {
	const baseTotal = overrides.grand_total ?? 50;
	return {
		grand_total: baseTotal,
		rounded_total: baseTotal,
		total: baseTotal,
		net_total: baseTotal,
		total_taxes_and_charges: 0,
		conversion_rate: 1,
		is_return: 0,
		payments: [makePayment({ default: 1, mode_of_payment: "Cash", amount: baseTotal })],
		...overrides,
	};
}

// ===========================================================================
// SUITE 1: syncPaymentDocumentTotalsFromCart
// ===========================================================================

describe("syncPaymentDocumentTotalsFromCart", () => {
	describe("TC-01: Adding an item increases totals", () => {
		it("grand_total increases when a new item is added", () => {
			const doc = makeInvoiceDoc({ grand_total: 50, rounded_total: 50, total: 50, net_total: 50 });
			const cartItems = [
				makeCartItem({ rate: 50, qty: 1 }),
				makeCartItem({ item_code: "ITEM-002", rate: 30, qty: 1 }),
			];

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			expect(doc.grand_total).toBeCloseTo(80, 2);
			expect(doc.rounded_total).toBeCloseTo(80, 2);
		});
	});

	describe("TC-02: Reducing item quantity decreases totals", () => {
		it("grand_total decreases when qty is reduced from 2 to 1", () => {
			const doc = makeInvoiceDoc({ grand_total: 100, rounded_total: 100, total: 100, net_total: 100 });
			const cartItems = [makeCartItem({ rate: 50, qty: 1 })]; // was qty:2

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			expect(doc.grand_total).toBeCloseTo(50, 2);
		});
	});

	describe("TC-03: Removing all items zeros out totals", () => {
		it("grand_total and rounded_total become 0 when cart is emptied", () => {
			const doc = makeInvoiceDoc({ grand_total: 50, rounded_total: 50, total: 50, net_total: 50 });

			syncPaymentDocumentTotalsFromCart(doc, []);

			expect(doc.grand_total).toBe(0);
			expect(doc.rounded_total).toBe(0);
			expect(doc.total).toBe(0);
		});
	});

	describe("TC-04: Taxes scale proportionally with net total", () => {
		it("tax is recalculated proportionally when item qty changes", () => {
			// Net = 100, tax = 10 (10%)
			const doc = makeInvoiceDoc({
				grand_total: 110,
				rounded_total: 110,
				total: 100,
				net_total: 100,
				total_taxes_and_charges: 10,
			});
			// Reduce to half: net should be 50, tax should be 5
			const cartItems = [makeCartItem({ rate: 50, qty: 1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			expect(doc.total).toBeCloseTo(50, 2);
			expect(doc.total_taxes_and_charges).toBeCloseTo(5, 2);
			expect(doc.grand_total).toBeCloseTo(55, 2);
		});

		it("taxes zero out when all items removed", () => {
			const doc = makeInvoiceDoc({
				grand_total: 110,
				rounded_total: 110,
				total: 100,
				net_total: 100,
				total_taxes_and_charges: 10,
			});

			syncPaymentDocumentTotalsFromCart(doc, []);

			expect(doc.total_taxes_and_charges).toBe(0);
			expect(doc.grand_total).toBe(0);
		});
	});

	describe("TC-05: Rounding delta is preserved", () => {
		it("rounded_total preserves the original rounding delta after qty change", () => {
			// Original: net=99.99, grand=99.99, rounded=100.00 → delta=0.01
			const doc = {
				grand_total: 99.99,
				rounded_total: 100,
				total: 99.99,
				net_total: 99.99,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [],
			};
			// Double quantity: net should be 199.98, rounded delta preserved
			const cartItems = [makeCartItem({ rate: 99.99, qty: 2 })];

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			// Grand = 199.98, delta = 0.01 → rounded = 199.99
			expect(doc.grand_total).toBeCloseTo(199.98, 2);
			expect(doc.rounded_total).toBeCloseTo(199.99, 2);
		});
	});

	describe("TC-06: posa_is_replace items are excluded from payable total", () => {
		it("replace items do not count toward payable total", () => {
			const doc = makeInvoiceDoc({ grand_total: 50, rounded_total: 50, total: 50, net_total: 50 });
			const cartItems = [
				makeCartItem({ rate: 50, qty: 1 }),
				makeCartItem({ item_code: "ITEM-REPLACE", rate: 50, qty: 1, posa_is_replace: true }),
			];

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			// Only the non-replace item counts
			expect(doc.grand_total).toBeCloseTo(50, 2);
		});
	});

	describe("TC-07: Additional discount is subtracted from net total", () => {
		it("discount reduces net total and cascades to grand total", () => {
			const doc = makeInvoiceDoc({ grand_total: 100, rounded_total: 100, total: 100, net_total: 100 });
			const cartItems = [makeCartItem({ rate: 100, qty: 1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartItems, { additionalDiscount: 10 });

			expect(doc.total).toBeCloseTo(90, 2);
			expect(doc.grand_total).toBeCloseTo(90, 2);
		});
	});

	describe("TC-08: Delivery charges are added to net total", () => {
		it("delivery charges increase net total and grand total", () => {
			const doc = makeInvoiceDoc({ grand_total: 100, rounded_total: 100, total: 100, net_total: 100 });
			const cartItems = [makeCartItem({ rate: 100, qty: 1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartItems, { deliveryCharges: 5 });

			expect(doc.total).toBeCloseTo(105, 2);
			expect(doc.grand_total).toBeCloseTo(105, 2);
		});
	});

	describe("TC-09: Negative qty items (returns) behave correctly", () => {
		it("return item with negative qty results in zero payable (floor clamped)", () => {
			// Non-return doc, so floor at 0
			const doc = makeInvoiceDoc({ grand_total: 50, rounded_total: 50, total: 50, net_total: 50 });
			const cartItems = [makeCartItem({ rate: 50, qty: -1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			// -50 net, but clamped to 0 because doc.is_return is 0
			expect(doc.grand_total).toBe(0);
		});

		it("return doc allows negative totals", () => {
			const doc = {
				grand_total: -50,
				rounded_total: -50,
				total: -50,
				net_total: -50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 1,
				payments: [],
			};
			const cartItems = [makeCartItem({ rate: 50, qty: -1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartItems);

			expect(doc.grand_total).toBeCloseTo(-50, 2);
		});
	});
});

// ===========================================================================
// SUITE 2: syncQuickPayAmountsToInvoiceTotal
// ===========================================================================

describe("syncQuickPayAmountsToInvoiceTotal", () => {
	describe("TC-10: Normal add — payment amount updates to new higher total", () => {
		it("default payment amount increases when item is added", () => {
			// Initial state: 1 item at $50, payment = $50
			const doc = makeInvoiceDoc({ grand_total: 50, rounded_total: 50 });

			// Cart mutates: now $80
			doc.grand_total = 80;
			doc.rounded_total = 80;

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(payments[0].amount).toBeCloseTo(80, 2);
		});
	});

	describe("TC-11: Normal remove — payment amount decreases when item is removed", () => {
		it("default payment amount decreases when item qty reduced", () => {
			const doc = makeInvoiceDoc({ grand_total: 80, rounded_total: 80 });
			doc.payments[0].amount = 80; // stale pre-mutation amount

			// Cart mutates: now $50
			doc.grand_total = 50;
			doc.rounded_total = 50;

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(payments[0].amount).toBeCloseTo(50, 2);
		});
	});

	describe("TC-12: autoSyncQuickPay=false — payment amount NOT updated (manual override)", () => {
		it("when user manually entered amount, cart change must NOT overwrite it", () => {
			const doc = makeInvoiceDoc({ grand_total: 80, rounded_total: 80 });
			doc.payments[0].amount = 60; // user manually entered $60

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, false /* manual override */, "Cash");

			// Amount should remain at the user-entered value
			expect(payments[0].amount).toBe(60);
		});
	});

	describe("TC-13: autoSyncQuickPay reset to true after cart change — stale override discarded", () => {
		it("after cart change resets flag, the payment amount reflects new total", () => {
			const doc = makeInvoiceDoc({ grand_total: 60, rounded_total: 60 });
			doc.payments[0].amount = 60; // manual entry

			// Simulate: cart changes, flag is reset to true
			doc.grand_total = 80;
			doc.rounded_total = 80;

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true /* flag reset */, "Cash");

			expect(payments[0].amount).toBeCloseTo(80, 2);
		});
	});

	describe("TC-14: Cart fully emptied — all payment amounts zeroed", () => {
		it("all payment amounts become 0 when total drops to 0", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 50 });
			const cardPayment = makePayment({ mode_of_payment: "Card", amount: 20 });
			const doc = {
				grand_total: 0,
				rounded_total: 0,
				total: 0,
				net_total: 0,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment, cardPayment],
			};

			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBe(0);
			expect(cardPayment.amount).toBe(0);
		});
	});

	describe("TC-15: Split tender — autoSync disabled, amounts preserved", () => {
		it("when card has partial amount and autoSync=false, no sync occurs", () => {
			// Split tender: user manually set card=$20 → autoSyncQuickPay set to false
			// Sync should be a no-op; existing amounts are preserved as-is
			const cardPayment = makePayment({ mode_of_payment: "Card", amount: 20, default: 0 });
			const cashPayment = makePayment({ mode_of_payment: "Cash", amount: 30, default: 1 });
			const doc = {
				grand_total: 80,
				rounded_total: 80,
				total: 80,
				net_total: 80,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment, cardPayment],
			};

			// autoSyncQuickPay=false because user manually set card amount
			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, false /* manual override */, "Cash");

			// No sync happens — amounts remain unchanged
			const cash = payments.find((p) => p.mode_of_payment === "Cash");
			const card = payments.find((p) => p.mode_of_payment === "Card");
			expect(cash?.amount).toBeCloseTo(30, 2); // unchanged
			expect(card?.amount).toBeCloseTo(20, 2); // unchanged
		});

		it("when autoSync=true and both target and other have amounts, target gets full total (others zeroed)", () => {
			// autoSyncQuickPay=true means we're in full-amount sync mode.
			// With the fix: needsOtherReset=true → effectiveOtherTotal=0 → target gets full total.
			// This is the correct behavior for cart-change reset: stale other amounts are discarded.
			const cardPayment = makePayment({ mode_of_payment: "Card", amount: 20, default: 0 });
			const cashPayment = makePayment({ mode_of_payment: "Cash", amount: 30, default: 1 });
			const doc = {
				grand_total: 80,
				rounded_total: 80,
				total: 80,
				net_total: 80,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment, cardPayment],
			};

			// autoSyncQuickPay reset to true by cart change — stale card amount is discarded
			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			const cash = payments.find((p) => p.mode_of_payment === "Cash");
			const card = payments.find((p) => p.mode_of_payment === "Card");
			expect(cash?.amount).toBeCloseTo(80, 2); // target gets full total
			expect(card?.amount).toBe(0);             // other is zeroed
		});
	});

	describe("TC-16: Loyalty points applied — reduces cash payment by loyalty amount", () => {
		it("loyalty settled amount is subtracted from target payment", () => {
			const doc = makeInvoiceDoc({ grand_total: 100, rounded_total: 100 });
			doc.payments[0].amount = 100;
			const loyaltySettled = 20;

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash", loyaltySettled);

			expect(payments[0].amount).toBeCloseTo(80, 2);
		});
	});

	describe("TC-17: Customer credit applied — reduces cash payment by credit amount", () => {
		it("customer credit settled amount is subtracted from target payment", () => {
			const doc = makeInvoiceDoc({ grand_total: 100, rounded_total: 100 });
			doc.payments[0].amount = 100;
			const creditSettled = 30;

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash", 0, creditSettled);

			expect(payments[0].amount).toBeCloseTo(70, 2);
		});
	});

	describe("TC-18: Return invoice — sync skipped", () => {
		it("does not update payment amounts on return invoices", () => {
			const doc = {
				grand_total: -50,
				rounded_total: -50,
				total: -50,
				net_total: -50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 1,
				payments: [makePayment({ amount: -50, default: 1 })],
			};

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			// Return invoice: sync is skipped, amount unchanged
			expect(payments[0].amount).toBe(-50);
		});
	});

	describe("TC-19: No payments array — does not crash", () => {
		it("handles missing payments gracefully", () => {
			const doc = { grand_total: 50, rounded_total: 50, is_return: 0, payments: undefined };

			expect(() => syncQuickPayAmountsToInvoiceTotal(doc as any, true, "Cash")).not.toThrow();
		});
	});

	describe("TC-20: Target amount clamped to zero — no negative payment", () => {
		it("payment amount does not go negative when credit+loyalty exceed invoice total", () => {
			const doc = makeInvoiceDoc({ grand_total: 50, rounded_total: 50 });
			doc.payments[0].amount = 50;

			// Loyalty=40 + credit=30 = 70 > 50 total
			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash", 40, 30);

			expect(payments[0].amount).toBe(0);
		});
	});

	describe("TC-21: Multiple non-default payments reset, only target gets amount", () => {
		it("when all payments start at zero, auto-sync sets target to full invoice total", () => {
			const cashPayment = makePayment({ mode_of_payment: "Cash", amount: 0, default: 1 });
			const card1 = makePayment({ mode_of_payment: "Card", amount: 0, default: 0 });
			const card2 = makePayment({ mode_of_payment: "Cheque", amount: 0, default: 0 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment, card1, card2],
			};

			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			// Cash (default target) gets the full amount; others stay at zero
			expect(cashPayment.amount).toBeCloseTo(50, 2);
			expect(card1.amount).toBe(0);
			expect(card2.amount).toBe(0);
		});

		it("when stale other-payment amounts exist, auto-sync zeros them and sets target to full total", () => {
			// FIXED: When autoSyncQuickPay=true and needsOtherReset is true, we no longer
			// subtract stale other-payment amounts from targetAmount.
			// total=50, card(stale)=20 → cash = 50 (correct), card = 0
			const cashPayment = makePayment({ mode_of_payment: "Cash", amount: 80, default: 1 });
			const card1 = makePayment({ mode_of_payment: "Card", amount: 20, default: 0 });
			const doc = {
				grand_total: 50, // total dropped from 100 to 50 (item removed)
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment, card1],
			};

			// autoSync reset to true by cart change watcher
			// needsOtherReset=true (card has stale amount), so effectiveOtherTotal=0
			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			// After fix: cash gets full 50, card is zeroed
			expect(cashPayment.amount).toBeCloseTo(50, 2);
			expect(card1.amount).toBe(0);
		});
	});

	describe("TC-22: autoSyncPaymentKey prefers named payment over default flag", () => {
		it("uses named key to find target even when another payment has default=1", () => {
			const cash = makePayment({ name: "PAY-001", mode_of_payment: "Cash", amount: 0, default: 1 });
			const card = makePayment({ name: "PAY-002", mode_of_payment: "Card", amount: 0, default: 0 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cash, card],
			};

			// Set autoSyncPaymentKey to the card's name
			const { payments } = syncQuickPayAmountsToInvoiceTotal(doc, true, "PAY-002");

			const cardResult = payments.find((p) => p.name === "PAY-002");
			expect(cardResult?.amount).toBeCloseTo(50, 2);
			// Cash (default=1) should be zeroed
			const cashResult = payments.find((p) => p.name === "PAY-001");
			expect(cashResult?.amount).toBe(0);
		});
	});
});

// ===========================================================================
// SUITE 3: Full chain — cart mutation → totals sync → payment sync
// ===========================================================================

describe("Full chain: cart mutation → totals sync → payment amounts sync", () => {
	describe("TC-23: Add item while payment screen open", () => {
		it("payment amount updates to new total after adding item", () => {
			// Setup: user hits Pay with 1 item at $50, payment = $50
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 50 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Cart mutation: add second item at $30
			const cartAfterAdd = [
				makeCartItem({ rate: 50, qty: 1 }),
				makeCartItem({ item_code: "ITEM-NEW", rate: 30, qty: 1 }),
			];

			// Step 1: sync totals from cart
			syncPaymentDocumentTotalsFromCart(doc, cartAfterAdd);

			// Step 2: sync payment amounts (autoSync reset to true by watcher)
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBeCloseTo(80, 2);
			expect(cashPayment.amount).toBeCloseTo(80, 2);
		});
	});

	describe("TC-24: Remove item while payment screen open", () => {
		it("payment amount decreases after removing an item", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 80 });
			const doc = {
				grand_total: 80,
				rounded_total: 80,
				total: 80,
				net_total: 80,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Cart mutation: removed second item
			const cartAfterRemove = [makeCartItem({ rate: 50, qty: 1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartAfterRemove);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBeCloseTo(50, 2);
			expect(cashPayment.amount).toBeCloseTo(50, 2);
		});
	});

	describe("TC-25: Quantity increase on existing item", () => {
		it("payment amount scales up proportionally", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 50 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Qty changed from 1 to 3
			const cartAfterIncrease = [makeCartItem({ rate: 50, qty: 3 })];

			syncPaymentDocumentTotalsFromCart(doc, cartAfterIncrease);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBeCloseTo(150, 2);
			expect(cashPayment.amount).toBeCloseTo(150, 2);
		});
	});

	describe("TC-26: Quantity decrease on existing item", () => {
		it("payment amount scales down proportionally", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 150 });
			const doc = {
				grand_total: 150,
				rounded_total: 150,
				total: 150,
				net_total: 150,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Qty changed from 3 to 1
			const cartAfterDecrease = [makeCartItem({ rate: 50, qty: 1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartAfterDecrease);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBeCloseTo(50, 2);
			expect(cashPayment.amount).toBeCloseTo(50, 2);
		});
	});

	describe("TC-27: Manual amount entry then cart change — stale manual entry corrected", () => {
		it("when cart changes, auto-sync flag reset overrides prior manual amount", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 60 });
			const doc = {
				grand_total: 80,
				rounded_total: 80,
				total: 80,
				net_total: 80,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// User manually typed $60 → autoSync was disabled
			// Then user adds item → watcher resets autoSync to true
			// Simulate watcher behavior: autoSyncQuickPay reset to true on cart change

			const cartAfterAdd = [
				makeCartItem({ rate: 80, qty: 1 }),
				makeCartItem({ item_code: "ITEM-002", rate: 20, qty: 1 }),
			];

			// Cart change: flag reset to true, totals synced
			syncPaymentDocumentTotalsFromCart(doc, cartAfterAdd);
			// autoSyncQuickPay reset to true by watcher
			syncQuickPayAmountsToInvoiceTotal(doc, true /* reset */, "Cash");

			expect(doc.grand_total).toBeCloseTo(100, 2);
			expect(cashPayment.amount).toBeCloseTo(100, 2);
		});
	});

	describe("TC-28: Cart emptied while payment screen open", () => {
		it("payment amounts zeroed and stays zero after cart cleared", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 100 });
			const doc = {
				grand_total: 100,
				rounded_total: 100,
				total: 100,
				net_total: 100,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			syncPaymentDocumentTotalsFromCart(doc, []);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBe(0);
			expect(cashPayment.amount).toBe(0);
		});
	});

	describe("TC-29: Item price change (modifier delta) updates payment amount", () => {
		it("payment amount reflects new price after modifier adds delta", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 50 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Modifier added $5 to rate: 50 → 55
			const cartWithModifier = [makeCartItem({ rate: 55, qty: 1 })];

			syncPaymentDocumentTotalsFromCart(doc, cartWithModifier);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBeCloseTo(55, 2);
			expect(cashPayment.amount).toBeCloseTo(55, 2);
		});
	});

	describe("TC-30: Rapid add then remove (net neutral) results in original amount", () => {
		it("add item then remove same item leaves payment at original total", () => {
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 50 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Add then remove second item (net neutral)
			const cartFinal = [makeCartItem({ rate: 50, qty: 1 })]; // back to original

			syncPaymentDocumentTotalsFromCart(doc, cartFinal);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBeCloseTo(50, 2);
			expect(cashPayment.amount).toBeCloseTo(50, 2);
		});
	});
});

// ===========================================================================
// SUITE 4: usePaymentCalculations — diff_payment and total_payments
// ===========================================================================

describe("usePaymentCalculations: diff_payment after cart mutation", () => {
	function makeCalcOptions(docOverrides: any = {}, loyaltyAmount = 0, creditAmount = 0) {
		const invoiceDoc = ref({
			grand_total: 50,
			rounded_total: 50,
			currency: "USD",
			is_return: 0,
			conversion_rate: 1,
			payments: [makePayment({ default: 1, mode_of_payment: "Cash", amount: 50 })],
			...docOverrides,
		});
		const posProfile = ref({ currency: "USD", posa_allow_multi_currency: false });
		const currencyPrecision = ref(2);
		const loyaltyAmountRef = ref(loyaltyAmount);
		const redeemedCustomerCredit = ref(creditAmount);
		const customerCreditDict = ref([]);
		const customerInfo = ref({});

		return usePaymentCalculations({
			invoiceDoc,
			posProfile,
			currencyPrecision,
			loyaltyAmount: loyaltyAmountRef,
			redeemedCustomerCredit,
			customerCreditDict,
			customerInfo,
			formatCurrency: (v) => String(v),
		});
	}

	describe("TC-31: diff_payment is 0 when payment matches total", () => {
		it("no remaining balance when payment equals invoice total", () => {
			const { diff_payment } = makeCalcOptions({ grand_total: 50, rounded_total: 50 });
			expect(diff_payment.value).toBeCloseTo(0, 2);
		});
	});

	describe("TC-32: diff_payment is positive when underpaid", () => {
		it("returns remaining balance when payment is less than invoice total", () => {
			const invoiceDoc = ref({
				grand_total: 80,
				rounded_total: 80,
				currency: "USD",
				is_return: 0,
				conversion_rate: 1,
				payments: [makePayment({ amount: 50 })], // stale $50 when total went to $80
			});
			const { diff_payment } = usePaymentCalculations({
				invoiceDoc,
				posProfile: ref({ currency: "USD", posa_allow_multi_currency: false }),
				currencyPrecision: ref(2),
				loyaltyAmount: ref(0),
				redeemedCustomerCredit: ref(0),
				customerCreditDict: ref([]),
				customerInfo: ref({}),
				formatCurrency: (v) => String(v),
			});

			expect(diff_payment.value).toBeCloseTo(30, 2); // 80 - 50 = 30 still owed
		});
	});

	describe("TC-33: diff_payment is negative (change due) when overpaid", () => {
		it("returns negative value representing change due", () => {
			const invoiceDoc = ref({
				grand_total: 50,
				rounded_total: 50,
				currency: "USD",
				is_return: 0,
				conversion_rate: 1,
				payments: [makePayment({ amount: 60 })], // overpaid
			});
			const { diff_payment, change_due } = usePaymentCalculations({
				invoiceDoc,
				posProfile: ref({ currency: "USD", posa_allow_multi_currency: false }),
				currencyPrecision: ref(2),
				loyaltyAmount: ref(0),
				redeemedCustomerCredit: ref(0),
				customerCreditDict: ref([]),
				customerInfo: ref({}),
				formatCurrency: (v) => String(v),
			});

			expect(diff_payment.value).toBeCloseTo(-10, 2); // overpaid by $10
			expect(change_due.value).toBeCloseTo(10, 2);
		});
	});

	describe("TC-34: total_payments includes loyalty and customer credit", () => {
		it("loyalty and credit are included in total_payments calculation", () => {
			const invoiceDoc = ref({
				grand_total: 100,
				rounded_total: 100,
				currency: "USD",
				is_return: 0,
				conversion_rate: 1,
				payments: [makePayment({ amount: 50 })],
			});
			const { total_payments, diff_payment } = usePaymentCalculations({
				invoiceDoc,
				posProfile: ref({ currency: "USD", posa_allow_multi_currency: false }),
				currencyPrecision: ref(2),
				loyaltyAmount: ref(20),      // $20 loyalty
				redeemedCustomerCredit: ref(30), // $30 credit
				customerCreditDict: ref([]),
				customerInfo: ref({}),
				formatCurrency: (v) => String(v),
			});

			// Total = 50 (cash) + 20 (loyalty) + 30 (credit) = 100
			expect(total_payments.value).toBeCloseTo(100, 2);
			expect(diff_payment.value).toBeCloseTo(0, 2);
		});
	});

	describe("TC-35: Reactive update — diff_payment reacts to payment amount change", () => {
		it("diff_payment updates reactively when payment amount is mutated", async () => {
			const invoiceDoc = ref({
				grand_total: 80,
				rounded_total: 80,
				currency: "USD",
				is_return: 0,
				conversion_rate: 1,
				payments: [makePayment({ amount: 50 })],
			});
			const { diff_payment } = usePaymentCalculations({
				invoiceDoc,
				posProfile: ref({ currency: "USD", posa_allow_multi_currency: false }),
				currencyPrecision: ref(2),
				loyaltyAmount: ref(0),
				redeemedCustomerCredit: ref(0),
				customerCreditDict: ref([]),
				customerInfo: ref({}),
				formatCurrency: (v) => String(v),
			});

			expect(diff_payment.value).toBeCloseTo(30, 2); // 80 - 50 = 30 owed

			// Simulate sync updating payment to $80
			invoiceDoc.value.payments[0].amount = 80;

			// Vue computed re-evaluates synchronously in tests
			expect(diff_payment.value).toBeCloseTo(0, 2);
		});
	});
});

// ===========================================================================
// SUITE 5: Edge cases / boundary conditions
// ===========================================================================

describe("Edge cases and boundary conditions", () => {
	describe("TC-36: Very small amounts — epsilon precision", () => {
		it("amounts equal to epsilon are not treated as positive settlement, no-op sync", () => {
			// epsilon at precision=2 is 0.001; amounts <= epsilon are considered "already zero"
			// so they don't trigger the zero-clear path (no positive settlement detected)
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 0.001 });
			const doc = {
				grand_total: 0.001,
				rounded_total: 0.001,
				total: 0.001,
				net_total: 0.001,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// After clearing cart, doc.grand_total → 0
			syncPaymentDocumentTotalsFromCart(doc, []);
			// invoiceTotal = 0, cashPayment.amount = 0.001 which is NOT > epsilon (strictly)
			// so hasPositiveSettlement = false → no-op return; amount stays unchanged
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBe(0);
			// Amount 0.001 is within epsilon tolerance — treated as effectively zero, no explicit clear
			expect(cashPayment.amount).toBeCloseTo(0.001, 3);
		});

		it("amounts larger than epsilon with zero total are cleared", () => {
			// If payment amount is clearly positive (> epsilon), it should be cleared when total = 0
			const cashPayment = makePayment({ default: 1, mode_of_payment: "Cash", amount: 0.01 });
			const doc = {
				grand_total: 0,
				rounded_total: 0,
				total: 0,
				net_total: 0,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBe(0);
		});
	});

	describe("TC-37: Integer amounts — no floating point drift", () => {
		it("integer payment amounts maintain precision without drift", () => {
			const cashPayment = makePayment({ default: 1, amount: 0 });
			const doc = {
				grand_total: 100,
				rounded_total: 100,
				total: 100,
				net_total: 100,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 100, qty: 1 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBe(100);
		});
	});

	describe("TC-38: Large amounts — no overflow or precision loss", () => {
		it("large invoice totals sync correctly", () => {
			const cashPayment = makePayment({ default: 1, amount: 0 });
			const doc = {
				grand_total: 999999.99,
				rounded_total: 999999.99,
				total: 999999.99,
				net_total: 999999.99,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 999999.99, qty: 1 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBeCloseTo(999999.99, 2);
		});
	});

	describe("TC-39: Foreign currency — conversion_rate applied to base_amount", () => {
		it("base_amount is set correctly with conversion_rate", () => {
			const cashPayment = makePayment({ default: 1, amount: 0, base_amount: 0 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1.5,
				is_return: 0,
				payments: [cashPayment],
			};

			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBeCloseTo(50, 2);
			expect(cashPayment.base_amount).toBeCloseTo(75, 2); // 50 * 1.5
		});
	});

	describe("TC-40: Multiple sequential cart mutations", () => {
		it("payment amount stays consistent through multiple add/remove cycles", () => {
			const cashPayment = makePayment({ default: 1, amount: 50 });
			const doc = {
				grand_total: 50,
				rounded_total: 50,
				total: 50,
				net_total: 50,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// Mutation 1: add item → $80
			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 50 }), makeCartItem({ item_code: "B", rate: 30 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");
			expect(cashPayment.amount).toBeCloseTo(80, 2);

			// Mutation 2: add another → $120
			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 50 }), makeCartItem({ item_code: "B", rate: 30 }), makeCartItem({ item_code: "C", rate: 40 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");
			expect(cashPayment.amount).toBeCloseTo(120, 2);

			// Mutation 3: remove first item → $70
			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ item_code: "B", rate: 30 }), makeCartItem({ item_code: "C", rate: 40 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");
			expect(cashPayment.amount).toBeCloseTo(70, 2);

			// Mutation 4: remove all → $0
			syncPaymentDocumentTotalsFromCart(doc, []);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");
			expect(cashPayment.amount).toBe(0);
		});
	});

	describe("TC-41: Zero-amount payment with autoSync true — no-op when already zero", () => {
		it("sync does not mutate payments already at correct value", () => {
			const cashPayment = makePayment({ default: 1, amount: 100 });
			const doc = {
				grand_total: 100,
				rounded_total: 100,
				total: 100,
				net_total: 100,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			const originalAmount = cashPayment.amount;
			// Total hasn't changed: sync should be a no-op
			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 100, qty: 1 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBe(originalAmount);
		});
	});

	describe("TC-42: changeVersion watcher behavior — payment NOT synced when screen is not open", () => {
		it("sync on cart change does not break amounts before payment screen opens", () => {
			// Simulate cart-only mutations before Pay is clicked
			const doc = {
				grand_total: 0,
				rounded_total: 0,
				total: 0,
				net_total: 0,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [],
			};

			// No payments yet, no crash
			expect(() => {
				syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 50 })]);
				syncQuickPayAmountsToInvoiceTotal(doc, true, "");
			}).not.toThrow();
		});
	});

	describe("TC-43: Single item at exactly zero rate", () => {
		it("zero-rate item does not produce non-zero payment", () => {
			const cashPayment = makePayment({ default: 1, amount: 0 });
			const doc = {
				grand_total: 0,
				rounded_total: 0,
				total: 0,
				net_total: 0,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			syncPaymentDocumentTotalsFromCart(doc, [makeCartItem({ rate: 0, qty: 1 })]);
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(doc.grand_total).toBe(0);
			expect(cashPayment.amount).toBe(0);
		});
	});

	describe("TC-44: Partial amount entered then item removed — no overpayment risk", () => {
		it("when total drops below manually entered amount, sync zeros if flag is reset", () => {
			// User manually entered $80 for an $80 invoice
			// Then removed items → total now $30
			// Cart change resets autoSync → payment should be clamped to $30
			const cashPayment = makePayment({ default: 1, amount: 80 });
			const doc = {
				grand_total: 30,
				rounded_total: 30,
				total: 30,
				net_total: 30,
				total_taxes_and_charges: 0,
				conversion_rate: 1,
				is_return: 0,
				payments: [cashPayment],
			};

			// autoSync was reset to true by watcher on cart change
			syncQuickPayAmountsToInvoiceTotal(doc, true, "Cash");

			expect(cashPayment.amount).toBeCloseTo(30, 2);
		});
	});
});
