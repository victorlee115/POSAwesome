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

	it("detects Samsung Galaxy Tab A11 in Fully Kiosk as tablet_landscape_compact", () => {
		// Tab A11 (2000×1200 physical) — Fully Kiosk at DPR ~1.5 reports ~1333×800
		expect(detectDeviceProfile(1333, 800)).toBe("tablet_landscape_compact");
		// At DPR ~1.25 some devices report up to 1600×960
		expect(detectDeviceProfile(1600, 960)).toBe("tablet_landscape_compact");
		// Exactly at the upper boundary
		expect(detectDeviceProfile(1600, 1024)).toBe("tablet_landscape_compact");
	});

	it("uses desktop full pay mode on larger desktop screens", () => {
		// 1680×1050 is clearly a desktop monitor (width > 1600)
		expect(detectDeviceProfile(1680, 1050)).toBe("desktop");
		expect(getPaymentLayoutMode("desktop")).toBe("desktop_fullpay");
	});

	it("uses quick pay mode for mobile screens", () => {
		expect(detectDeviceProfile(800, 1280)).toBe("mobile");
		expect(getPaymentLayoutMode("mobile")).toBe("tablet_quickpay");
	});
});
