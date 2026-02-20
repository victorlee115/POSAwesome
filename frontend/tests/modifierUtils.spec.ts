import { describe, expect, it } from "vitest";

import {
	buildDefaultSelections,
	buildDrinkCode,
	buildModifierSignature,
	buildModifierSummary,
	normalizeModifierSelections,
} from "../src/posapp/utils/modifierUtils";

describe("modifierUtils", () => {
	it("normalizes mixed selection payloads", () => {
		const payload = {
			selections: {
				Size: [{ value: "Large" }],
				Milk: "Oat",
				Toppings: [{ label: "Boba" }, "Cream Top"],
			},
		};

		const normalized = normalizeModifierSelections(payload);
		expect(normalized).toEqual({
			Size: ["Large"],
			Milk: ["Oat"],
			Toppings: ["Boba", "Cream Top"],
		});
	});

	it("builds defaults from profile groups when defaults are not provided", () => {
		const defaults = buildDefaultSelections({
			groups: [
				{
					name: "Size",
					options: [
						{ label: "Small", value: "Small" },
						{ label: "Large", value: "Large", is_default: true },
					],
				},
			],
		});

		expect(defaults).toEqual({
			Size: ["Large"],
		});
	});

	it("builds stable signatures for selection maps", () => {
		const signatureA = buildModifierSignature({
			Milk: ["Oat"],
			Size: ["Large"],
		});
		const signatureB = buildModifierSignature({
			Size: ["Large"],
			Milk: ["Oat"],
		});

		expect(signatureA).toBe(signatureB);
	});

	it("computes summary, delta, and option codes", () => {
		const profile = {
			groups: [
				{
					name: "Size",
					options: [
						{ value: "Large", label: "Large", price_delta: 1.5, code: "L" },
					],
				},
				{
					name: "Milk",
					options: [
						{ value: "Oat", label: "Oat Milk", price_delta: 0.5, code: "OAT" },
					],
				},
			],
		};

		const summary = buildModifierSummary(profile, {
			Size: ["Large"],
			Milk: ["Oat"],
		});

		expect(summary.summary).toBe("Large / Oat Milk");
		expect(summary.delta).toBe(2);
		expect(summary.optionCodes).toEqual(["L", "OAT"]);
	});

	it("builds compact drink code with prefix and option codes", () => {
		const code = buildDrinkCode("MATCHA-LATTE", "MTC", ["L", "OAT"]);
		expect(code).toContain("MTC");
		expect(code).toContain("MATCHA-LAT");
		expect(code).toContain("OAT");
	});
});
