import { describe, expect, it } from "vitest";

import {
	detectDeviceProfile,
	getPaymentLayoutMode,
} from "../src/posapp/composables/core/useResponsive";

describe("useResponsive payment layout mode", () => {
	it("detects compact tablet landscape profile", () => {
		expect(detectDeviceProfile(1280, 800)).toBe("tablet_landscape_compact");
		expect(getPaymentLayoutMode("tablet_landscape_compact")).toBe(
			"tablet_quickpay",
		);
	});

	it("uses desktop full pay mode on larger desktop screens", () => {
		expect(detectDeviceProfile(1680, 1050)).toBe("desktop");
		expect(getPaymentLayoutMode("desktop")).toBe("desktop_fullpay");
	});

	it("uses quick pay mode for mobile screens", () => {
		expect(detectDeviceProfile(800, 1280)).toBe("mobile");
		expect(getPaymentLayoutMode("mobile")).toBe("tablet_quickpay");
	});
});
