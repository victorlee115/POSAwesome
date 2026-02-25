import { describe, expect, it } from "vitest";

import {
	shouldShowColumnForWidth,
	type TableHeader,
} from "../src/posapp/composables/pos/items/useItemsTableResponsive";

const header = (key: string, required = false): TableHeader => ({
	key,
	title: key,
	required,
});

describe("useItemsTableResponsive column visibility", () => {
	it("keeps core columns visible at very narrow widths", () => {
		expect(shouldShowColumnForWidth(header("item_name"), 420)).toBe(true);
		expect(shouldShowColumnForWidth(header("qty"), 420)).toBe(true);
		expect(shouldShowColumnForWidth(header("amount"), 420)).toBe(true);
	});

	it("hides low-priority cart columns on tablet-width constrained panes", () => {
		expect(shouldShowColumnForWidth(header("rate"), 520)).toBe(false);
		expect(shouldShowColumnForWidth(header("actions"), 640)).toBe(false);
		expect(shouldShowColumnForWidth(header("actions"), 820)).toBe(true);
		expect(shouldShowColumnForWidth(header("uom"), 820)).toBe(false);
		expect(shouldShowColumnForWidth(header("uom"), 900)).toBe(true);
	});

	it("keeps unknown required columns visible but hides unknown optional columns", () => {
		expect(shouldShowColumnForWidth(header("custom_required", true), 480)).toBe(
			true,
		);
		expect(shouldShowColumnForWidth(header("custom_optional", false), 480)).toBe(
			false,
		);
	});
});
