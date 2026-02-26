import { ref, computed, onMounted, onUnmounted, nextTick } from "vue";
import _ from "lodash";
import {
	getCardColumns,
	getCardGap,
	getCardPadding,
} from "../../../utils/itemSelectorLayout.js";

type SelectorLayoutOptions = {
	resizeDebounce?: number;
	loadVisibleItems?: () => void;
	getDisplayedItemsCount?: () => number;
	/** Pass responsive.deviceProfile (ComputedRef) to enable tablet-aware compact card height */
	deviceProfile?: { value: string };
};

/**
 * Manages the layout metrics and resize behavior for the ItemsSelector component.
 * Handles calculation of grid columns, card dimensions, and overflow detection.
 */
export function useItemSelectorLayout(options: SelectorLayoutOptions = {}) {
	const {
		resizeDebounce = 100,
		loadVisibleItems, // Method to load more items on scroll (pagination)
		getDisplayedItemsCount,
		deviceProfile,
	} = options;

	// State
	const windowWidth = ref(window.innerWidth);
	const windowHeight = ref(window.innerHeight);
	const containerWidth = ref(0);
	const isOverflowing = ref(false);
	const itemsContainerRef = ref<any>(null);
	const scrollThrottle = ref<number | null>(null);
	let resizeObserver: ResizeObserver | null = null;

	// Computed Metrics
	const effectiveWidth = computed(() =>
		Math.max(0, containerWidth.value || Math.floor(windowWidth.value * 0.6)),
	);
	const displayedItemsCount = computed(() => {
		if (typeof getDisplayedItemsCount !== "function") {
			return 0;
		}
		const count = Number(getDisplayedItemsCount());
		return Number.isFinite(count) ? Math.max(0, count) : 0;
	});
	const useSmallMenuGrid = computed(
		() => displayedItemsCount.value > 0 && displayedItemsCount.value <= 12,
	);
	const cardColumns = computed(() => {
		const baseColumns = getCardColumns(effectiveWidth.value);
		if (useSmallMenuGrid.value && effectiveWidth.value >= 470) {
			return Math.max(3, baseColumns);
		}
		return baseColumns;
	});
	const cardGap = computed(() => getCardGap(effectiveWidth.value));
	const cardPadding = computed(() => getCardPadding(effectiveWidth.value));
	const isShortViewport = computed(() => windowHeight.value <= 860);
	const compactRowHeights = {
		narrow: 216,
		regular: 224,
		wide: 232,
	};

	const cardRowHeight = computed(() => {
		if (useSmallMenuGrid.value) {
			// tablet_landscape_compact (Tab A11 kiosk) or short viewport: compact text-only cards
			const isTabletCompact =
				deviceProfile?.value === "tablet_landscape_compact" ||
				windowHeight.value <= 760;
			if (isTabletCompact) {
				return 100;
			}
			if (effectiveWidth.value <= 560) {
				return compactRowHeights.narrow;
			}
			if (effectiveWidth.value <= 820) {
				return compactRowHeights.regular;
			}
			return compactRowHeights.wide;
		}

		let baseHeight = 184;
		if (effectiveWidth.value <= 420) {
			baseHeight = 160;
		} else if (effectiveWidth.value <= 620) {
			baseHeight = 166;
		} else if (effectiveWidth.value <= 980) {
			baseHeight = 172;
		}

		if (isShortViewport.value) {
			baseHeight -= 12;
		}

		if (windowHeight.value <= 780) {
			baseHeight -= 6;
		}

		return Math.max(140, baseHeight);
	});

	const cardSlotHeight = computed(() => cardRowHeight.value + cardGap.value);
	const cardSlotWidth = computed(() => cardColumnWidth.value + cardGap.value);

	const cardContainerWidth = computed(() => {
		if (containerWidth.value > 0) {
			return containerWidth.value;
		}
		return Math.floor(windowWidth.value * 0.55);
	});

	const cardColumnWidth = computed(() => {
		const columns = Math.max(1, cardColumns.value);
		// Note: We might need a more robust way to get container width if it's dynamic
		// Ideally pass a ref to the container element
		const containerWidth = cardContainerWidth.value || 0;
		if (!containerWidth) {
			return 240; // Safe default
		}

		const gapTotal = cardGap.value * (columns - 1);
		const paddingTotal = cardPadding.value * 2;
		const available = Math.max(0, containerWidth - gapTotal - paddingTotal);
		const width = Math.floor(available / columns);
		return Math.max(136, width);
	});

	// Actions
	const updateWindowWidth = () => {
		windowWidth.value = window.innerWidth;
		windowHeight.value = window.innerHeight;
	};

	const getItemsContainerElement = (): HTMLElement | null => {
		if (!itemsContainerRef.value) return null;
		// Handle both Vue component ref and raw element
		return (itemsContainerRef.value.$el ||
			itemsContainerRef.value) as HTMLElement | null;
	};

	const measureContainerWidth = () => {
		const el = getItemsContainerElement();
		if (!el) {
			containerWidth.value = 0;
			return;
		}
		const widths = [
			el.clientWidth || 0,
			(el.parentElement as HTMLElement | null)?.clientWidth || 0,
			(el.closest(".items-grid-area") as HTMLElement | null)?.clientWidth || 0,
		].filter((value) => value > 0);
		containerWidth.value = widths.length ? Math.min(...widths) : 0;
	};

	const scheduleCardMetricsUpdate = _.debounce(() => {
		updateWindowWidth();
		measureContainerWidth();
		checkItemContainerOverflow();
	}, resizeDebounce);

	const checkItemContainerOverflow = () => {
		const el = getItemsContainerElement();
		if (!el) {
			isOverflowing.value = false;
			return;
		}
		// Never force max-height in JS; it causes pane height drift on tablets.
		// Rely on CSS grid/flex contracts and only detect overflow status.
		isOverflowing.value = el.scrollHeight > el.clientHeight + 1;
	};

	const onListScroll = (event: Event) => {
		if (scrollThrottle.value) return;

		scrollThrottle.value = requestAnimationFrame(() => {
			try {
				const el = event.target as HTMLElement | null;
				if (!el) return;
				if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
					// Trigger pagination via callback
					if (typeof loadVisibleItems === "function") {
						// We need access to currentPage logic, but usually loadVisibleItems handles the "next/more" logic
						loadVisibleItems();
					}
				}
			} catch (error: unknown) {
				console.error("Error in list scroll handler:", error);
			} finally {
				scrollThrottle.value = null;
			}
		});
	};

	// Lifecycle
	onMounted(() => {
		window.addEventListener("resize", scheduleCardMetricsUpdate);
		nextTick(() => {
			measureContainerWidth();
			updateWindowWidth();
			checkItemContainerOverflow();
			const el = getItemsContainerElement();
			if (el && typeof ResizeObserver !== "undefined") {
				resizeObserver = new ResizeObserver(() => {
					measureContainerWidth();
					checkItemContainerOverflow();
				});
				resizeObserver.observe(el);
			}
		});
	});

	onUnmounted(() => {
		window.removeEventListener("resize", scheduleCardMetricsUpdate);
		if (resizeObserver) {
			resizeObserver.disconnect();
			resizeObserver = null;
		}
		if (scrollThrottle.value) {
			cancelAnimationFrame(scrollThrottle.value);
		}
		scheduleCardMetricsUpdate.cancel();
	});

	return {
		// Refs
		windowWidth,
		isOverflowing,
		itemsContainerRef, // Bind this to the container in template

		// Computed
		useSmallMenuGrid,
		cardColumns,
		cardGap,
		cardPadding,
		cardRowHeight,
		cardSlotHeight,
		cardSlotWidth,
		cardColumnWidth,

		// Methods
		checkItemContainerOverflow,
		scheduleCardMetricsUpdate,
		onListScroll,
	};
}
