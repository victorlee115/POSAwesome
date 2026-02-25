import { describe, expect, it } from "vitest";

import {
	buildDefaultSelections,
	buildDrinkCode,
	buildModifierSignature,
	buildModifierSummary,
	normalizeModifierSelections,
	pruneModifierSelections,
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
					required: true,
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

	it("does not auto-default optional groups", () => {
		const defaults = buildDefaultSelections({
			groups: [
				{
					name: "Add Ons",
					required: false,
					options: [{ label: "Boba", value: "Boba" }],
				},
			],
		});

		expect(defaults).toEqual({});
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

	it("prunes dependency-mismatched selections", () => {
		const profile = {
			groups: [
				{
					name: "Temperature",
					options: [
						{ value: "Iced", label: "Iced" },
						{ value: "Hot", label: "Hot" },
					],
				},
				{
					name: "Ice Level",
					options: [
						{
							value: "Regular Ice",
							label: "Regular Ice",
							parent_option_group: "Temperature",
							parent_option_value: "Iced",
						},
					],
				},
			],
		};

		const pruned = pruneModifierSelections(profile, {
			Temperature: ["Hot"],
			"Ice Level": ["Regular Ice"],
		});

		expect(pruned).toEqual({
			Temperature: ["Hot"],
		});
	});

	it("builds summary without hidden dependent options", () => {
		const profile = {
			groups: [
				{
					name: "Temperature",
					options: [
						{ value: "Iced", label: "Iced", code: "IC" },
						{ value: "Hot", label: "Hot", code: "HT" },
					],
				},
				{
					name: "Ice Level",
					options: [
						{
							value: "Regular Ice",
							label: "Regular Ice",
							price_delta: 0.3,
							code: "I2",
							parent_option_group: "Temperature",
							parent_option_value: "Iced",
						},
					],
				},
			],
		};

		const summary = buildModifierSummary(profile, {
			Temperature: ["Hot"],
			"Ice Level": ["Regular Ice"],
		});

		expect(summary.summary).toBe("Hot");
		expect(summary.delta).toBe(0);
		expect(summary.optionCodes).toEqual(["HT"]);
	});
});
