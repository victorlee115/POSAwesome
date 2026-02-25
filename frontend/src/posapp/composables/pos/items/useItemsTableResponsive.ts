import { ref, computed, onMounted, onBeforeUnmount, type Ref } from "vue";
import * as _ from "lodash";

export interface TableHeader {
	title: string;
	key: string;
	required?: boolean;
	sortable?: boolean;
	align?: "start" | "center" | "end";
	width?: string | number;
	minWidth?: string | number;
	[key: string]: any;
}

const COLUMN_WIDTH_CONFIG: Record<
	string,
	{ min: number; max: number; ratio: number; minVisibleWidth: number }
> = {
	item_name: { min: 170, max: 340, ratio: 0.34, minVisibleWidth: 0 },
	qty: { min: 114, max: 154, ratio: 0.17, minVisibleWidth: 0 },
	amount: { min: 98, max: 132, ratio: 0.14, minVisibleWidth: 0 },
	rate: { min: 92, max: 124, ratio: 0.13, minVisibleWidth: 540 },
	actions: { min: 68, max: 86, ratio: 0.08, minVisibleWidth: 760 },
	uom: { min: 84, max: 106, ratio: 0.1, minVisibleWidth: 860 },
	price_list_rate: { min: 100, max: 130, ratio: 0.12, minVisibleWidth: 980 },
	discount_value: { min: 96, max: 116, ratio: 0.1, minVisibleWidth: 1080 },
	discount_amount: { min: 98, max: 126, ratio: 0.11, minVisibleWidth: 1160 },
	posa_is_offer: { min: 78, max: 96, ratio: 0.09, minVisibleWidth: 1240 },
};

const ALWAYS_VISIBLE_COLUMNS = new Set(["item_name", "qty", "amount"]);

export const shouldShowColumnForWidth = (header: TableHeader, width: number) => {
	if (ALWAYS_VISIBLE_COLUMNS.has(header.key)) {
		return true;
	}

	const config = COLUMN_WIDTH_CONFIG[header.key];
	if (config) {
		return width >= config.minVisibleWidth;
	}

	// Keep unknown required columns visible; hide optional unknown columns on narrow layouts.
	if (header.required) {
		return true;
	}
	return width >= 980;
};

export function useItemsTableResponsive(
	containerRef: Ref<HTMLElement | null>,
	headers: Ref<TableHeader[]>,
) {
	const containerWidth = ref(0);
	const containerHeight = ref(0);
	const breakpoint = ref("xl");
	let resizeObserver: ResizeObserver | null = null;

	const updateBreakpoint = (width: number) => {
		if (width < 500) return "xs";
		if (width < 700) return "sm";
		if (width < 900) return "md";
		if (width < 1200) return "lg";
		return "xl";
	};

	const calculateColumnWidth = (header: TableHeader, width: number) => {
		const config = COLUMN_WIDTH_CONFIG[header.key] || {
			min: 80,
			max: 150,
			ratio: 0.1,
			minVisibleWidth: 0,
		};
		const calculatedWidth = width * config.ratio;
		return Math.max(config.min, Math.min(config.max, calculatedWidth));
	};

	const calculateMinColumnWidth = (header: TableHeader) => {
		return COLUMN_WIDTH_CONFIG[header.key]?.min || 80;
	};

	const responsiveHeaders = computed(() => {
		const width = containerWidth.value;
		if (!headers.value || headers.value.length === 0) return [];

		return headers.value
			.filter((header) => shouldShowColumnForWidth(header, width))
			.map((header) => ({
				...header,
				width: calculateColumnWidth(header, width),
				minWidth: calculateMinColumnWidth(header),
			}));
	});

	const isColumnVisible = (key: string) => {
		return responsiveHeaders.value.some((h) => h.key === key);
	};

	const containerStyles = computed(() => ({
		height: "100%",
		maxHeight: "100%",
		minHeight: "0",
		"--container-width": containerWidth.value + "px",
		"--container-height": containerHeight.value + "px",
	}));

	const containerClasses = computed(() => ({
		[`breakpoint-${breakpoint.value}`]: true,
		"compact-view": containerWidth.value < 600,
		"medium-view":
			containerWidth.value >= 600 && containerWidth.value < 900,
		"large-view": containerWidth.value >= 900,
	}));

	const tableClasses = computed(() => ({
		[`container-${breakpoint.value}`]: true,
		"responsive-table": true,
	}));

	const expandedContentClasses = computed(() => ({
		[`expanded-${breakpoint.value}`]: true,
		"compact-expanded": containerWidth.value < 600,
	}));

	const tableDensity = computed(() => {
		if (containerWidth.value < 620) return "compact";
		if (containerWidth.value < 980) return "default";
		return "comfortable";
	});

	const setupResizeObserver = () => {
		if (typeof ResizeObserver !== "undefined" && containerRef.value) {
			const debouncedResizeHandler = _.debounce(
				(entries: ResizeObserverEntry[]) => {
					for (let entry of entries) {
						const { width, height } = entry.contentRect;
						if (
							containerWidth.value !== width ||
							containerHeight.value !== height
						) {
							containerWidth.value = width;
							containerHeight.value = height;
							breakpoint.value = updateBreakpoint(width);
						}
					}
				},
				100,
			);

			resizeObserver = new ResizeObserver(debouncedResizeHandler);
			resizeObserver.observe(containerRef.value);
			// Initial call
			const rect = containerRef.value.getBoundingClientRect();
			containerWidth.value = rect.width;
			containerHeight.value = rect.height;
			breakpoint.value = updateBreakpoint(rect.width);
		}
	};

	onMounted(() => {
		setupResizeObserver();
	});

	onBeforeUnmount(() => {
		if (resizeObserver) {
			resizeObserver.disconnect();
		}
	});

	return {
		containerWidth,
		containerHeight,
		breakpoint,
		responsiveHeaders,
		isColumnVisible,
		containerStyles,
		containerClasses,
		tableClasses,
		expandedContentClasses,
		tableDensity,
	};
}
