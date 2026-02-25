import { ref, computed, onMounted, onBeforeUnmount } from "vue";

export type PosDeviceProfile =
	| "tablet_landscape_compact"
	| "desktop"
	| "mobile";

export type CatalogRenderMode = "small-menu-grid" | "card-grid" | "table";
export type CartRenderMode = "tablet-line-list" | "desktop-table";
export type PaymentLayoutMode = "tablet_quickpay" | "desktop_fullpay";

const SPACING_SCALE = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
};

export const detectDeviceProfile = (width: number, height: number): PosDeviceProfile => {
	if (width < 960) {
		return "mobile";
	}

	const landscape = width >= height;
	// Tablet landscape: covers common Android tablet viewports in landscape including
	// Samsung Galaxy Tab A11 (Fully Kiosk typically reports 1280–1600 px wide at ~800–1024 px tall).
	// Upper bounds are generous to handle higher-DPI devices that report larger CSS viewports.
	if (landscape && width <= 1600 && height <= 1024) {
		return "tablet_landscape_compact";
	}

	return "desktop";
};

export const getPaymentLayoutMode = (
	profile: PosDeviceProfile,
): PaymentLayoutMode => {
	return profile === "desktop" ? "desktop_fullpay" : "tablet_quickpay";
};

export function useResponsive() {
	const windowWidth = ref(window.innerWidth);
	const windowHeight = ref(window.innerHeight);
	const baseWidth = ref(window.innerWidth);
	const baseHeight = ref(window.innerHeight);

	const widthScale = computed(() => windowWidth.value / baseWidth.value);
	const heightScale = computed(() => windowHeight.value / baseHeight.value);
	const averageScale = computed(
		() => (widthScale.value + heightScale.value) / 2,
	);

	const isLandscape = computed(() => windowWidth.value >= windowHeight.value);
	const deviceProfile = computed<PosDeviceProfile>(() =>
		detectDeviceProfile(windowWidth.value, windowHeight.value),
	);

	const catalogRenderMode = computed<CatalogRenderMode>(() => {
		if (deviceProfile.value === "tablet_landscape_compact") {
			return "small-menu-grid";
		}
		if (deviceProfile.value === "mobile") {
			return "card-grid";
		}
		return "card-grid";
	});

	const cartRenderMode = computed<CartRenderMode>(() => {
		return deviceProfile.value === "tablet_landscape_compact"
			? "tablet-line-list"
			: "desktop-table";
	});

	const paymentLayoutMode = computed<PaymentLayoutMode>(() => {
		return getPaymentLayoutMode(deviceProfile.value);
	});

	const dynamicSpacing = computed(() => {
		return {
			xs: SPACING_SCALE.xs,
			sm: SPACING_SCALE.sm,
			md: SPACING_SCALE.md,
			lg: SPACING_SCALE.lg,
			xl: SPACING_SCALE.xl,
			xxl: SPACING_SCALE.xxl,
		};
	});

	const responsiveStyles = computed(() => {
		const compactTablet = deviceProfile.value === "tablet_landscape_compact";
		const paneGap = compactTablet ? 8 : 12;
		const cardHeightVh =
			windowWidth.value <= 768
				? 52
				: compactTablet
					? 58
					: 62;

		return {
			"--dynamic-xs": `${dynamicSpacing.value.xs}px`,
			"--dynamic-sm": `${dynamicSpacing.value.sm}px`,
			"--dynamic-md": `${dynamicSpacing.value.md}px`,
			"--dynamic-lg": `${dynamicSpacing.value.lg}px`,
			"--dynamic-xl": `${dynamicSpacing.value.xl}px`,
			"--dynamic-xxl": `${dynamicSpacing.value.xxl}px`,
			"--container-height": "100%",
			"--card-height": `${cardHeightVh}vh`,
			"--font-scale": averageScale.value.toFixed(2),
			"--pos-pane-gap": `${paneGap}px`,
			"--pos-grid-left": compactTablet ? "42%" : "58%",
			"--pos-grid-right": compactTablet ? "58%" : "42%",
			"--pos-tap-target-min": "48px",
		};
	});

	let resizeRafId: number | null = null;

	const handleResize = () => {
		// Debounce with requestAnimationFrame for better performance
		if (resizeRafId) {
			cancelAnimationFrame(resizeRafId);
		}

		resizeRafId = requestAnimationFrame(() => {
			windowWidth.value = window.innerWidth;
			windowHeight.value = window.innerHeight;
			resizeRafId = null;
		});
	};

	onMounted(() => {
		handleResize();
		window.addEventListener("resize", handleResize);
	});

	onBeforeUnmount(() => {
		window.removeEventListener("resize", handleResize);
		if (resizeRafId) {
			cancelAnimationFrame(resizeRafId);
			resizeRafId = null;
		}
	});

	return {
		windowWidth,
		windowHeight,
		baseWidth,
		baseHeight,
		widthScale,
		heightScale,
		averageScale,
		isLandscape,
		deviceProfile,
		catalogRenderMode,
		cartRenderMode,
		paymentLayoutMode,
		dynamicSpacing,
		responsiveStyles,
	};
}
