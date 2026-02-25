import { describe, expect, it } from "vitest";

import {
	getCardColumns,
	getCardGap,
	getCardPadding,
} from "../src/posapp/utils/itemSelectorLayout";

describe("itemSelectorLayout tablet density", () => {
	it("renders denser card columns on tablet widths", () => {
		expect(getCardColumns(500)).toBe(2);
		expect(getCardColumns(580)).toBe(3);
		expect(getCardColumns(760)).toBe(3);
		expect(getCardColumns(1040)).toBe(4);
	});

	it("keeps compact spacing for narrow panes", () => {
		expect(getCardGap(540)).toBe(8);
		expect(getCardPadding(540)).toBe(8);
		expect(getCardGap(900)).toBe(10);
		expect(getCardPadding(900)).toBe(10);
	});
});
