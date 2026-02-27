<template>
	<div
		class="items-selector-shell"
		:class="`catalog-render-${catalogRenderMode}`"
		:style="responsiveStyles"
	>
		<ScanErrorDialog
			v-model="scanErrorDialog"
			:message="scanErrorMessage"
			:code="scanErrorCode"
			:details="scanErrorDetails"
			@acknowledge="acknowledgeScanError"
		/>
			<v-card
				:class="[
				'selection my-0 py-0 pos-card dynamic-card pos-themed-card items-selector-card',
				rtlClasses,
			]"
				style="position: relative"
			>
			<v-progress-linear
				:active="isLoadingOrSyncing"
				:indeterminate="isLoadingOrSyncing"
				absolute
				location="top"
				color="info"
			></v-progress-linear>

			<!-- Add dynamic-padding wrapper like Invoice component -->
			<div class="dynamic-padding items-selector-body">
					<ItemHeader
					:tablet-compact="tabletCompact"
					v-model:search-input="search_input"
					v-model:qty-input="debounce_qty"
					v-model:new-line="new_line"
					:pos-profile="pos_profile"
					:scanner-locked="scannerLocked"
					:enable-background-sync="enable_background_sync"
					:last-sync-time="lastSyncTimeLabel"
					:sync-status="syncStatus"
					:context="context"
					@esc="esc_event"
					@enter="onEnter"
					@search-keydown="handleSearchKeydown"
					@clear-search="clearSearch"
					@clear-search-and-qty="clearSearchAndQty"
					@search-input="handleSearchInput"
					@search-paste="handleSearchPaste"
					@focus="handleItemSearchFocus"
					@clear-qty="clearQty"
					@blur-qty="onQtyBlur"
					@start-camera="startCameraScanning"
					@open-new-item="openNewItemDialog"
					@toggle-settings="toggleItemSettings"
					@reload-items="forceReloadItems"
					ref="itemHeader"
				/>

					<ItemSettingsDialog
						v-model="show_item_settings"
					:initial-settings="{
						hide_qty_decimals,
						hide_zero_rate_items,
						show_last_invoice_rate,
						enable_background_sync,
						background_sync_interval,
						enable_custom_items_per_page,
						items_per_page,
						force_server_items: temp_force_server_items,
					}"
						@save="applyItemSettings"
					/>

				<section class="items-catalog-zone">
					<QuickOrderBar
						v-if="tabletCompact && items_view === 'card'"
						:items="quickOrderItems"
						:pos-profile-name="pos_profile?.name || ''"
						@select-item="select_item"
						@quick-preset-order="({ item, preset }) => add_item(item, { presetSelection: preset })"
					/>
					<div class="items-grid-area">
						<ItemsSelectorCards
							v-if="items_view === 'card'"
							ref="itemsContainer"
							:displayed-items="displayedItems"
							:is-loading="isLoadingOrSyncing"
							:search-input="search_input"
							:item-group="item_group"
							:is-overflowing="isOverflowing"
							:card-slot-height="cardSlotHeight"
							:card-columns="cardColumns"
							:card-slot-width="cardSlotWidth"
							:card-column-width="cardColumnWidth"
							:card-row-height="cardRowHeight"
							:virtual-scroll-buffer="virtualScrollBuffer"
							:render-mode="effectiveCatalogRenderMode"
							:pos-profile="pos_profile"
							:context="context"
							:selected-currency="selected_currency"
							:hide-qty-decimals="hide_qty_decimals"
							:get-last-invoice-rate="getLastInvoiceRate"
							:is-item-highlighted="isItemHighlighted"
							:currency-symbol="currencySymbol"
							:format-currency="memoizedFormatCurrency"
							:format-number="memoizedFormatNumber"
							:rate-precision="ratePrecision"
							:is-negative="isNegative"
							:no-items-title="__('No items found')"
							:no-items-subtitle="__('Try adjusting your search or filters')"
							:clear-search-label="__('Clear Search')"
							@select-item="select_item"
							@dragstart="onDragStart"
							@dragend="onDragEnd"
							@virtual-range-update="onVirtualRangeUpdate"
							@clear-search="clearSearch"
						/>
						<ItemsSelectorTable
							v-else
							ref="itemsTable"
							:headers="headers"
							:displayed-items="displayedItems"
							:header-props="headerProps"
							:context="context"
							:pos-profile="pos_profile"
							:selected-currency="selected_currency"
							:hide-qty-decimals="hide_qty_decimals"
							:currency-symbol="currencySymbol"
							:format-currency="memoizedFormatCurrency"
							:format-number="memoizedFormatNumber"
							:rate-precision="ratePrecision"
							:get-last-invoice-rate="getLastInvoiceRate"
							:is-negative="isNegative"
							:item-class="getItemRowClass"
							:row-props="getItemRowProps"
							:no-data-text="__('No items found')"
							@row-click="click_item_row"
							@list-scroll="onListScroll"
						/>
					</div>
				</section>
				<div class="items-selector-toolbar-dock">
					<ItemActionToolbar
						class="item-action-toolbar"
						:tablet-compact="tabletCompact"
						v-model="item_group"
						:items-group="items_group"
						:items-view="items_view"
						:pos-profile="pos_profile"
						:active-price-list="active_price_list"
						:offers-count="offersCount"
						:coupons-count="couponsCount"
						:prep-enabled="prepQueueEnabled"
						@update:items-view="setItemsView"
						@open-offers="uiStore.setActiveView('offers')"
						@open-coupons="uiStore.setActiveView('coupons')"
						@open-prep="uiStore.setActiveView('prep')"
					/>
				</div>
			</div>
		</v-card>

			<ModifierProfileDialog
				v-model="modifierDialogVisible"
				:item="modifierDialogItem"
				:profile="modifierDialogProfile"
				:initial-selections="modifierDialogInitialSelections"
				:loading="modifierDialogLoading"
				:format-currency="modifierDialogFormatCurrency"
				@confirm="onModifierDialogConfirm"
				@cancel="onModifierDialogCancel"
			/>

		<!-- New Item Dialog -->
		<NewItemDialog v-model="newItemDialog" :items-group="items_group" @item-created="handleItemCreated" />

		<!-- Camera Scanner Component -->
		<CameraScanner
			v-if="pos_profile.posa_enable_camera_scanning"
			ref="cameraScanner"
			:scan-type="pos_profile.posa_camera_scan_type || 'Both'"
			@barcode-scanned="onBarcodeScanned"
			@scanner-opened="onScannerOpened"
			@scanner-closed="onScannerClosed"
		/>
	</div>
</template>

<script setup lang="ts">
import {
	getCurrentInstance,
	onMounted,
	onBeforeUnmount,
	ref,
	computed,
	watch,
	nextTick,
	reactive,
	inject,
	type Ref,
} from "vue";
import { storeToRefs } from "pinia";
import * as _ from "lodash";
import { memoryInitPromise } from "../../../../offline/index";

import CameraScanner from "./CameraScanner.vue";
import ItemActionToolbar from "./ItemActionToolbar.vue";
import ItemSettingsDialog from "./ItemSettingsDialog.vue";
import ItemHeader from "./ItemHeader.vue";
import ItemsSelectorCards from "./ItemsSelectorCards.vue";
import ItemsSelectorTable from "./ItemsSelectorTable.vue";
import NewItemDialog from "./NewItemDialog.vue";
import ModifierProfileDialog from "./ModifierProfileDialog.vue";
import ScanErrorDialog from "./ScanErrorDialog.vue";
import QuickOrderBar from "./QuickOrderBar.vue";

import { useResponsive } from "../../../composables/core/useResponsive";
import { useRtl } from "../../../composables/core/useRtl";
import { useFlyAnimation } from "../../../composables/core/useFlyAnimation";
import { useCartValidation } from "../../../composables/pos/items/useCartValidation";
import { useItemsIntegration } from "../../../composables/pos/items/useItemsIntegration";
import { useItemSearch } from "../../../composables/pos/items/useItemSearch";
import { useScannerInput } from "../../../composables/pos/items/useScannerInput";
import { useItemAvailability } from "../../../composables/pos/items/useItemAvailability";
import { useItemDetailFetcher } from "../../../composables/pos/items/useItemDetailFetcher";
import { useItemAddition } from "../../../composables/pos/items/useItemAddition";
import { useItemSelection } from "../../../composables/pos/items/useItemSelection";
import { useItemSelectorLayout } from "../../../composables/pos/items/useItemSelectorLayout";
import { useLastInvoiceRate } from "../../../composables/pos/items/useLastInvoiceRate";
import { useItemSync } from "../../../composables/pos/items/useItemSync";
import { useItemStorageSafety } from "../../../composables/pos/items/useItemStorageSafety";
import { useItemsSelectorSearch } from "../../../composables/pos/items/useItemsSelectorSearch";
import { useItemsSelectorSettings } from "../../../composables/pos/items/useItemsSelectorSettings";
import { useItemsSelectorFocus } from "../../../composables/pos/items/useItemsSelectorFocus";
import { useItemDisplay } from "../../../composables/pos/items/useItemDisplay";
import { useItemsLoader } from "../../../composables/pos/items/useItemsLoader";
import { useBarcodeIndexing } from "../../../composables/pos/items/useBarcodeIndexing";
import { useScanProcessor } from "../../../composables/pos/items/useScanProcessor";
import { useItemCurrency } from "../../../composables/pos/items/useItemCurrency";

import { useCustomersStore } from "../../../stores/customersStore";
import { useToastStore } from "../../../stores/toastStore";
import { useUIStore } from "../../../stores/uiStore";
import { useInvoiceStore } from "../../../stores/invoiceStore";

import { parseBooleanSetting } from "../../../utils/stock";
import matchaService from "../../../services/matchaService";
import {
	buildDrinkCode,
	buildModifierSignature,
	buildModifierSummary,
	normalizeModifierSelections,
	type ModifierProfilePayload,
} from "../../../utils/modifierUtils";

const props = defineProps({
	context: {
		type: String,
		default: "pos",
	},
	showOnlyBarcodeItems: {
		type: Boolean,
		default: false,
	},
});

const emit = defineEmits(["add-item"]);

// 1. Initialize Stores and Core Composables
const vmInstance = getCurrentInstance();
const customersStore = useCustomersStore();
const toastStore = useToastStore();
const uiStore = useUIStore();
const invoiceStore = useInvoiceStore();
const { selectedCustomer } = storeToRefs(customersStore);
const { posProfile: uiPosProfile } = storeToRefs(uiStore);

const __ = (window as any).__;
const NO_MODIFIER_PROFILE = "__NO_MODIFIER_PROFILE__";

const eventBus = inject("eventBus") as any;
const selected_currency = ref("");
const selected_exchange_rate = ref(1);
const selected_conversion_rate = ref(1);
const isInitialized = ref(false);
const initTimeout = ref(null);
const initError = ref(null);

const responsive = useResponsive();
const rtl = useRtl();
const { fly } = useFlyAnimation();
const cartValidation = useCartValidation();

const itemsIntegration = useItemsIntegration({
	enableDebounce: false,
	debounceDelay: 300,
});

const { showOnlyBarcodeItems: showOnlyBarcodeItemsRef, filterAndPaginate } = useItemSearch();

const scannerInput = useScannerInput();
const itemAvailability = useItemAvailability();
const itemDetailFetcher = useItemDetailFetcher();
const itemSelection = useItemSelection();
const itemSync = useItemSync();
const itemDisplay = useItemDisplay();
const itemsLoader = useItemsLoader();
const itemCurrencyUtils = useItemCurrency();
const { startItemWorker, itemWorker } = useItemStorageSafety();
const {
	ensureBarcodeIndex,
	resetBarcodeIndex,
	indexItem,
	replaceBarcodeIndex,
	lookupItemByBarcode,
	searchItemsByCode: searchItemsByCodeFn,
} = useBarcodeIndexing();

// 2. Local State & Settings
const newItemDialog = ref(false);
const qty = ref(1);
const search_input = ref("");
const first_search = ref("");
const itemsViewStorageKey = "posa_items_view";
const itemsViewManualKey = "posa_items_view_manual";
const readSavedItemsView = () => {
	try {
		const saved = localStorage.getItem(itemsViewStorageKey);
		const isManualSelection = localStorage.getItem(itemsViewManualKey) === "1";
		if (saved === "list" || saved === "card") {
			if (!isManualSelection && window.innerWidth <= 1200) {
				return "card";
			}
			return saved;
		}
	} catch (_error) {
		// Ignore localStorage access errors and fallback to defaults.
	}
	return window.innerWidth <= 900 ? "list" : "card";
};
const items_view = ref(readSavedItemsView());
const itemsPerPage = ref(50);
const clearingSearch = ref(false);
const isDragging = ref(false);
const new_line = ref(false);
const item_group = ref("");
const current_invoice_type = ref("Invoice");
const virtualScrollBuffer = ref(200);
const localStorageAvailable = ref(true);

const modifierDialogVisible = ref(false);
const modifierDialogItem = ref<any>(null);
const modifierDialogProfile = ref<ModifierProfilePayload | null>(null);
const modifierDialogInitialSelections = ref<Record<string, string[]> | null>(null);
const modifierDialogLoading = ref(false);
let modifierDialogResolver: null | ((value: any) => void) = null;

// Settings Refs
const hide_qty_decimals = ref(false);
const hide_zero_rate_items = ref(false);
const show_last_invoice_rate = ref(true);
const enable_background_sync = ref(true);
const background_sync_interval = ref(30);
const enable_custom_items_per_page = ref(false);
const items_per_page = ref(50);

// Temporary Settings Refs (for dialog)
const show_item_settings = ref(false);
const temp_hide_qty_decimals = ref(false);
const temp_hide_zero_rate_items = ref(false);
const temp_enable_custom_items_per_page = ref(false);
const temp_items_per_page = ref(50);
const temp_force_server_items = ref(false);
const temp_show_last_invoice_rate = ref(true);
const temp_enable_background_sync = ref(true);
const temp_background_sync_interval = ref(30);

const flyConfig = reactive({ speed: 0.6, easing: "ease-in-out" });
const headerProps = reactive({
	"sort-icon": "mdi-arrow-up",
	class: "pos-table-header",
});

// 3. Computed Properties
const pos_profile = computed(() => (itemsIntegration.posProfile.value || {}) as any);
const { stockSettings: stock_settings_ref } = storeToRefs(uiStore);
const stock_settings = computed(() => stock_settings_ref.value || {});
const items_group = computed(() => itemsIntegration.items_group.value || []);
const offersCount = computed(() => uiStore.offersCount || 0);
const couponsCount = computed(() => uiStore.couponsCount || 0);
const prepQueueEnabled = computed(() =>
	parseBooleanSetting(pos_profile.value?.posa_enable_prep_queue),
);
// selected_currency is now a local ref synced via eventBus
const active_price_list = computed(
	() => itemsIntegration.active_price_list.value || pos_profile.value?.selling_price_list,
);

const isReturnInvoice = computed(() => {
	return !!invoiceStore.invoiceDoc?.is_return;
});

const blockSaleBeyondAvailableQty = computed(() => {
	if (["Order", "Quotation"].includes(current_invoice_type.value)) {
		return false;
	}
	return parseBooleanSetting(
		pos_profile.value?.posa_block_sale_beyond_available_qty,
	);
});

const deferStockValidationToPayment = computed(() =>
	["Order", "Quotation"].includes(current_invoice_type.value),
);

const { items, filteredItems, customer_price_list, loading, isBackgroundLoading } = itemsIntegration;

const displayedItems = computed(() => {
	const baseItems = Array.isArray(filteredItems.value) ? filteredItems.value : [];
	const rawTerm = first_search.value;
	const term = (typeof rawTerm === "string" ? rawTerm : "").trim().toLowerCase();
	return filterAndPaginate(baseItems, {
		searchTerm: term,
		hideZeroRate: hide_zero_rate_items.value,
		hideVariants: pos_profile.value?.posa_hide_variants_items,
		onlyBarcode: showOnlyBarcodeItemsRef.value,
		limit: enable_custom_items_per_page.value ? items_per_page.value : itemsPerPage.value,
	});
});

watch(
	() => props.showOnlyBarcodeItems,
	(value) => {
		showOnlyBarcodeItemsRef.value = !!value;
	},
	{ immediate: true },
);

watch(
	items_view,
	(value) => {
		if (value !== "list" && value !== "card") {
			return;
		}
		try {
			localStorage.setItem(itemsViewStorageKey, value);
		} catch (_error) {
			// Ignore localStorage access errors.
		}
	},
	{ immediate: true },
);

const debounce_qty = computed({
	get() {
		if (qty.value === null) return "";
		return hide_qty_decimals.value ? Math.round(qty.value) : qty.value;
	},
	set(value) {
		let parsed: number | null = parseFloat(String(value).replace(/,/g, ""));
		if (isNaN(parsed)) parsed = null;
		if (hide_qty_decimals.value && parsed != null) parsed = Math.round(parsed);
		qty.value = parsed as any;
	},
});

const isLoadingOrSyncing = computed(() => {
	if (loading.value) return true;
	if (isBackgroundLoading.value && items.value.length === 0) return true;
	return false;
});

const syncStatus = computed(() => {
	if (loading.value) return __("Loading items...");
	if (isBackgroundLoading.value) return __("Syncing offline catalog...");
	return "";
});

const lastSyncTimeLabel = computed(() => {
	const lastSync = itemSync.last_background_sync_time?.value;
	if (!lastSync) return __("Never");
	const parsed = new Date(lastSync);
	return Number.isNaN(parsed.getTime()) ? __("Never") : parsed.toLocaleTimeString();
});

const setItemsView = (value: "list" | "card") => {
	if (value !== "list" && value !== "card") {
		return;
	}
	items_view.value = value;
	try {
		localStorage.setItem(itemsViewManualKey, "1");
	} catch (_error) {
		// Ignore localStorage access errors.
	}
};

// 4. Initialization logic for Composables needing Context

// Settings context object for useItemsSelectorSettings
const settingsContext = reactive({
	hide_qty_decimals,
	hide_zero_rate_items,
	show_last_invoice_rate,
	enable_background_sync,
	background_sync_interval,
	enable_custom_items_per_page,
	items_per_page,
	temp_hide_qty_decimals,
	temp_hide_zero_rate_items,
	temp_enable_custom_items_per_page,
	temp_items_per_page,
	temp_force_server_items,
	temp_show_last_invoice_rate,
	temp_enable_background_sync,
	temp_background_sync_interval,
	show_item_settings,
	localStorageAvailable,
	pos_profile,
	itemsPerPage,
	clearLastInvoiceRateCache: () => clearLastInvoiceRateCache(),
	scheduleLastInvoiceRateRefresh: () => scheduleLastInvoiceRateRefresh(),
	itemSync,
});

const itemsSelectorSearch = useItemsSelectorSearch({
	getVM: () => vmInstance?.proxy,
	scannerInput,
	itemSelection,
});
const itemsSelectorSettings = useItemsSelectorSettings({ getVM: () => settingsContext, itemSync });
const itemsSelectorFocus = useItemsSelectorFocus({
	getVM: () => vmInstance?.proxy,
	scannerInput,
	itemSelection,
});

const { getLastInvoiceRate, scheduleLastInvoiceRateRefresh, clearLastInvoiceRateCache } = useLastInvoiceRate({
	pos_profile: () => pos_profile.value,
	customer: () => selectedCustomer.value,
	displayedItems: () => displayedItems.value,
	show_last_invoice_rate: () => show_last_invoice_rate.value,
	autoRefresh: true,
});

const {
	isOverflowing,
	useSmallMenuGrid,
	cardColumns,
	cardRowHeight,
	cardSlotHeight,
	cardSlotWidth,
	cardColumnWidth,
	checkItemContainerOverflow,
	scheduleCardMetricsUpdate,
	onListScroll: handleListScroll,
} = useItemSelectorLayout({
	resizeDebounce: 100,
	loadVisibleItems: () => itemsLoader.loadVisibleItems(),
	getDisplayedItemsCount: () => displayedItems.value.length,
	deviceProfile: responsive.deviceProfile,
});

const fetchModifierProfile = async (itemCode: string): Promise<ModifierProfilePayload | null> => {
	if (!itemCode || !pos_profile.value?.name) {
		return null;
	}
	try {
		modifierDialogLoading.value = true;
		const payload = await matchaService.getModifierProfile(itemCode, pos_profile.value.name);
		return payload as ModifierProfilePayload;
	} catch (error) {
		console.error("Failed to load modifier profile", error);
		return null;
	} finally {
		modifierDialogLoading.value = false;
	}
};

const openModifierDialog = (
	item: any,
	profile: ModifierProfilePayload,
	initialSelections: Record<string, string[]> | null = null,
) => {
	modifierDialogItem.value = item;
	modifierDialogProfile.value = profile;
	modifierDialogInitialSelections.value = initialSelections;
	modifierDialogVisible.value = true;

	return new Promise((resolve) => {
		modifierDialogResolver = resolve;
	});
};

const resolveModifierSelection = async (
	item: any,
	options: {
		forceModifierDialog?: boolean;
		initialSelections?: Record<string, string[]>;
		presetSelection?: any;
	} = {},
) => {
	// If a full preset selection is provided, skip dialog entirely
	if (options.presetSelection && !options.forceModifierDialog) {
		return options.presetSelection;
	}

	const profile = await fetchModifierProfile(item.item_code);
	if (!profile || !Array.isArray(profile.groups) || profile.groups.length === 0) {
		return NO_MODIFIER_PROFILE;
	}

	const dialogSelection = await openModifierDialog(
		item,
		profile,
		options.initialSelections || null,
	);
	return dialogSelection;
};

const applyModifierSelectionToItem = (item: any, selection: any) => {
	if (!selection) {
		return;
	}

	const previousDelta = Number(item.posa_modifiers_delta || 0);
	const currentRate = Number(item.rate ?? item.price_list_rate ?? 0);
	const currentPriceListRate = Number(item.price_list_rate ?? currentRate);
	const normalizedSelections = normalizeModifierSelections(selection.selections || {});
	const delta = Number(selection.delta_total || 0);
	const signature = selection.signature || buildModifierSignature(normalizedSelections);

	item.posa_modifiers_json =
		selection.modifiers_json ||
		JSON.stringify({
			selections: normalizedSelections,
			summary: selection.summary || "",
		});
	item.posa_modifier_summary = selection.summary || "";
	item.posa_modifiers_delta = delta;
	item.posa_modifier_signature = signature;
	item.posa_drink_code = selection.drink_code || buildDrinkCode(item.item_code, "", []);
	item.posa_prep_status = selection.prep_status || "Paid";
	item.posa_is_prep_item = 1;

	const baseRate = Number.isFinite(Number(item.posa_base_rate))
		? Number(item.posa_base_rate)
		: currentRate - previousDelta;
	const basePriceListRate = Number.isFinite(Number(item.posa_base_price_list_rate))
		? Number(item.posa_base_price_list_rate)
		: currentPriceListRate - previousDelta;

	item.posa_base_rate = baseRate;
	item.posa_base_price_list_rate = basePriceListRate;
	// Also set the ERPNext base fields so getNewItem() in useItemCreation does not
	// fall back to item.rate (which already includes the delta) when constructing
	// the new cart line. Without this, _resolveBaseRate() returns (baseRate+delta)
	// and _applyPricingToLine() adds the delta a second time → double-apply.
	item.base_price_list_rate = basePriceListRate;
	item.base_rate = baseRate;
	item.rate = baseRate + delta;
	item.price_list_rate = basePriceListRate + delta;
};

const onModifierDialogConfirm = (selection: any) => {
	// Auto-save as QuickOrderBar preset for future bypass
	if (selection && modifierDialogItem.value?.item_code && pos_profile.value?.name) {
		const key = `posa_preset_${pos_profile.value.name}_${modifierDialogItem.value.item_code}`;
		localStorage.setItem(key, JSON.stringify(selection));
		// Notify QuickOrderBar in the same tab (storage event only fires in other tabs)
		window.dispatchEvent(new CustomEvent("posa-preset-saved", { detail: { key } }));
	}
	if (modifierDialogResolver) {
		modifierDialogResolver(selection);
	}
	modifierDialogResolver = null;
	modifierDialogInitialSelections.value = null;
	modifierDialogVisible.value = false;
};

const onModifierDialogCancel = () => {
	if (modifierDialogResolver) {
		modifierDialogResolver(null);
	}
	modifierDialogResolver = null;
	modifierDialogInitialSelections.value = null;
	modifierDialogVisible.value = false;
};

const readExistingModifierSelections = (item: any): Record<string, string[]> => {
	const rawValue = item?.posa_modifiers_json;
	if (!rawValue) {
		return {};
	}

	try {
		const parsed = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;
		if (!parsed || typeof parsed !== "object") {
			return {};
		}
		return normalizeModifierSelections((parsed as any).selections || parsed);
	} catch (_error) {
		return {};
	}
};

const handleEditLineModifiers = async (payload: any) => {
	const line = payload?.item;
	if (!line?.item_code) {
		return;
	}

	const selection = await resolveModifierSelection(line, {
		forceModifierDialog: true,
		initialSelections: readExistingModifierSelections(line),
	});
	if (!selection || selection === NO_MODIFIER_PROFILE) {
		return;
	}

	applyModifierSelectionToItem(line, selection);
	if (eventBus && typeof eventBus.emit === "function") {
		eventBus.emit("apply_pricing_rules");
	}
};

// 5. Core Methods
const add_item = async (item, optionsOrQty: any = {}) => {
		if (props.context === "pos") {
			let options: any = typeof optionsOrQty === "object" ? optionsOrQty : { qty: optionsOrQty };
		let requestedQty = options.qty !== undefined ? options.qty : qty.value || 0;
		requestedQty =
			requestedQty === "" || requestedQty == null ? 1 : Math.abs(parseFloat(requestedQty) || 1);

			item = { ...item };
			item.posa_is_prep_item = Number(item.posa_is_prep_item || 0) || 0;
		if (item.posa_unavailable) {
			toastStore.show({
				title: __("Item unavailable"),
				detail: item.posa_unavailable_reason || __("This item is currently unavailable."),
				color: "warning",
			});
			return;
		}
		if (item.has_variants) {
			await useItemAddition().handleVariantItem(item, {
				pos_profile: pos_profile.value,
				itemDetailFetcher,
				add_item,
				items: items.value,
				invoiceStore,
				toastStore,
				uiStore,
				customer: selectedCustomer.value,
				active_price_list: itemsIntegration.active_price_list.value,
				customer_price_list: customer_price_list.value,
			});
			return;
		}

		const context = {
			pos_profile: pos_profile.value,
			stock_settings: stock_settings.value,
			customer: selectedCustomer.value,
			selected_currency: selected_currency.value,
			exchange_rate: selected_exchange_rate.value,
			conversion_rate: selected_conversion_rate.value,
			price_list_currency: item.original_currency || item.currency || pos_profile.value?.currency,
			itemCurrencyUtils,
			invoiceStore,
			itemDetailFetcher,
			items: invoiceStore.items,
			isReturnInvoice: isReturnInvoice.value,
			...options,
		};

			const isValid = await cartValidation.validateCartItem(
				item,
			requestedQty,
			pos_profile.value,
			stock_settings.value,
			null,
			blockSaleBeyondAvailableQty.value,
			!options.suppressNegativeWarning,
			true,
			isReturnInvoice.value,
			deferStockValidationToPayment.value,
			);

			if (isValid) {
				const selection = await resolveModifierSelection(item, {
					forceModifierDialog: !!options.forceModifierDialog,
					presetSelection: options.presetSelection,
				});
				if (selection === null) {
					// Dialog cancelled by cashier; avoid adding an unconfigured line.
					return;
				}
				if (
					Array.isArray((selection as any)?.errors) &&
					(selection as any).errors.length
				) {
					const firstError = (selection as any).errors[0];
					toastStore.show({
						title: __("Modifier validation failed"),
						detail: firstError?.message || __("Please review modifier choices."),
						color: "error",
					});
					return;
				}
					if (selection !== NO_MODIFIER_PROFILE) {
						applyModifierSelectionToItem(item, selection);
					} else {
						item.posa_is_prep_item = 0;
					}

				await useItemAddition().prepareItemForCart(item, requestedQty, context);
				await useItemAddition().addItem(item, context);
				if (eventBus && typeof eventBus.emit === "function") {
				eventBus.emit("apply_pricing_rules");
			}
			qty.value = 1;
		}
	} else {
		emit("add-item", item);
	}
};

const scanProcessor = useScanProcessor({
	items,
	pos_profile,
	isReturnInvoice,
	active_price_list,
	customer_price_list,
	itemDetailFetcher,
	itemAddition: { addItem: add_item },
	barcodeIndex: {
		lookupItemByBarcode,
		searchItemsByCode: searchItemsByCodeFn,
		ensureBarcodeIndex,
		replaceBarcodeIndex,
		indexItem,
		resetBarcodeIndex,
	},
	scannerInput,
	searchCache: ref(new Map()) as Ref<Map<any, any>>,
	eventBus,
	format_number: itemDisplay.format_number,
	float_precision: computed(() => pos_profile.value?.float_precision || 2),
	hide_qty_decimals: computed(() => !!hide_qty_decimals.value),
	blockSaleBeyondAvailableQty,
	deferStockValidationToPayment,
	currency_precision: computed(() => pos_profile.value?.currency_precision || 2),
	exchange_rate: computed(() => selected_exchange_rate.value),
	selected_currency,
	conversion_rate: selected_conversion_rate,
	format_currency: itemDisplay.format_currency,
	ratePrecision: itemDisplay.ratePrecision,
	customer: selectedCustomer,
	onItemAdded: () => {
		clearSearch();
		itemsSelectorFocus.focusItemSearch();
	},
	onItemNotFound: (code) => {
		search_input.value = code;
		first_search.value = code;
	},
	stock_settings,
	search_from_scanner_ref: scannerInput.searchFromScanner,
});

// 6. Template Helpers
const clearSearch = () => {
	clearingSearch.value = true;
	search_input.value = "";
	first_search.value = "";
	clearingSearch.value = false;
};

const clearSearchAndQty = () => {
	clearSearch();
	clearQty();
};

const onDragStart = (event, item) => {
	if (item?.posa_unavailable) {
		event.preventDefault();
		return;
	}
	isDragging.value = true;
	event.dataTransfer.setData("application/json", JSON.stringify({ type: "item-from-selector", item }));
	event.dataTransfer.effectAllowed = "copy";
	uiStore.setDraggedItem(item);
};

const onDragEnd = () => {
	isDragging.value = false;
	uiStore.setDraggedItem(null);
};

const resolveIncomingPriceList = (incomingPriceList: unknown) => {
	const normalized = typeof incomingPriceList === "string" ? incomingPriceList.trim() : "";
	if (normalized) {
		return normalized;
	}
	return pos_profile.value?.selling_price_list || "";
};

const syncSelectorPriceList = async (incomingPriceList: unknown) => {
	const nextPriceList = resolveIncomingPriceList(incomingPriceList);
	if (!nextPriceList) {
		return;
	}

	if (itemsIntegration.active_price_list.value !== nextPriceList) {
		await itemsIntegration.updatePriceList(nextPriceList);
	}

	await itemsIntegration.get_items(true);
	itemDetailFetcher.update_cur_items_details();
};

const toggleItemSettings = () => {
	temp_hide_qty_decimals.value = hide_qty_decimals.value;
	temp_hide_zero_rate_items.value = hide_zero_rate_items.value;
	temp_enable_custom_items_per_page.value = enable_custom_items_per_page.value;
	temp_items_per_page.value = items_per_page.value;
	temp_force_server_items.value = !!(pos_profile.value && pos_profile.value.posa_force_server_items);
	temp_show_last_invoice_rate.value = show_last_invoice_rate.value;
	temp_enable_background_sync.value = enable_background_sync.value;
	temp_background_sync_interval.value = background_sync_interval.value;
	show_item_settings.value = true;
};

const applyItemSettings = (settings) => {
	itemsSelectorSettings.applyItemSettings(settings);
};

// 7. Lifecycle Hooks
const openNewItemDialog = () => {
	newItemDialog.value = true;
};

onMounted(async () => {
	itemAvailability.registerCallbacks({
		getItems: () => items.value,
		getDisplayedItems: () => displayedItems.value,
		getFilteredItems: () => filteredItems.value,
		updateItemsDetails: (its, opts) => itemDetailFetcher.update_items_details(its, opts),
	});

	itemDisplay.registerContext({
		get context() {
			return props.context;
		},
		get pos_profile() {
			return pos_profile.value;
		},
		get float_precision() {
			return pos_profile.value?.float_precision || 2;
		},
		get currency_precision() {
			return pos_profile.value?.currency_precision || 2;
		},
		get exchange_rate() {
			return selected_exchange_rate.value;
		},
	});

	itemsLoader.registerContext({
		get eventBus() {
			return eventBus;
		},
		get itemsStore() {
			return itemsIntegration.itemsStore;
		},
		get itemDetailFetcher() {
			return itemDetailFetcher;
		},
		get displayedItems() {
			return displayedItems.value;
		},
		get cardColumns() {
			return cardColumns.value;
		},
		get loading() {
			return loading.value;
		},
	});

	itemSelection.registerContext({
		addItem: add_item,
		clearSearch: () => clearSearch(),
		focusItemSearch: () => itemsSelectorFocus.focusItemSearch(),
		fly,
		get flyConfig() {
			return flyConfig;
		},
		get displayedItems() {
			return displayedItems.value;
		},
	});

	itemSync.registerContext({
		get pos_profile() {
			return pos_profile.value;
		},
		get enable_background_sync() {
			return enable_background_sync.value;
		},
		get background_sync_interval() {
			return background_sync_interval.value;
		},
		refreshModifiedItems: () => itemsIntegration.refreshModifiedItems(),
		backgroundSyncItems: (args) => itemsIntegration.backgroundSyncItems(args),
		get_items: (force) => itemsIntegration.get_items(force),
		itemDetailFetcher,
	});

	if (scannerInput.setScanHandler) {
		scannerInput.setScanHandler(scanProcessor.processScannedItem);
	}

	if (eventBus) {
		eventBus.on("update_currency", (data) => {
			if (typeof data === "string" && data) {
				selected_currency.value = data;
				return;
			}
			if (data && data.currency) {
				selected_currency.value = data.currency;
				if (data.exchange_rate) {
					selected_exchange_rate.value = Number(data.exchange_rate) || 1;
				}
				if (data.conversion_rate) {
					selected_conversion_rate.value = Number(data.conversion_rate) || 1;
				}
			}
		});
		eventBus.on("update_customer_price_list", (priceList) => {
			syncSelectorPriceList(priceList);
		});
		eventBus.on("update_invoice_type", handleInvoiceTypeUpdate);
		eventBus.on("edit-line-modifiers", handleEditLineModifiers);
		eventBus.on("reload_items", () => forceReloadItems());
	}

	// Watch UI Profile for initialization (Source of Truth)
	watch(
		uiPosProfile,
		async (newProfile) => {
			if (newProfile && newProfile.name && !isInitialized.value) {
				// Safety timeout to prevent infinite loading if memoryInit or store init hangs
				if (initTimeout.value) clearTimeout(initTimeout.value);
				// @ts-ignore
				initTimeout.value = setTimeout(() => {
					if (!isInitialized.value) {
						console.warn(
							"ItemsSelector: Initialization taking too long, forcing isInitialized to true.",
						);
						isInitialized.value = true;
					}
				}, 10000);

				try {
					await memoryInitPromise;

					// Set local currency ref
					selected_currency.value = newProfile.currency || "";
					selected_exchange_rate.value = 1;
					selected_conversion_rate.value = 1;

					await itemsIntegration.initializeStore(
						newProfile as any,
						selectedCustomer.value as any,
						customer_price_list.value as any,
					);

					isInitialized.value = true;
					startItemWorker();
					itemDetailFetcher.update_cur_items_details();
					itemSync.startBackgroundSyncScheduler();
					itemsSelectorSettings.loadItemSettings();
				} catch (err: any) {
					console.error("ItemsSelector: Initialization failed", err);
					initError.value = err.message || err;
					// Unblock UI even on error
					isInitialized.value = true;
				} finally {
					if (initTimeout.value) {
						clearTimeout(initTimeout.value);
						initTimeout.value = null;
					}
				}
			}
		},
		{ immediate: true },
	);

	window.addEventListener("resize", checkItemContainerOverflow);
	nextTick(() => {
		checkItemContainerOverflow();
		scheduleCardMetricsUpdate();
	});
});

onBeforeUnmount(() => {
	if (initTimeout.value) clearTimeout(initTimeout.value);
	itemSync.stopBackgroundSyncScheduler();
	if (modifierDialogResolver) {
		modifierDialogResolver(null);
		modifierDialogResolver = null;
	}
	// @ts-ignore
	if (itemWorker.value) itemWorker.value.terminate();
	if (eventBus) {
		eventBus.off("update_currency");
		eventBus.off("update_customer_price_list");
		eventBus.off("update_invoice_type", handleInvoiceTypeUpdate);
		eventBus.off("edit-line-modifiers", handleEditLineModifiers);
	}
	window.removeEventListener("resize", checkItemContainerOverflow);
});

// 8. Watchers
watch(search_input, (val) => {
	first_search.value = val;
	itemSelection.clearHighlightedItem();
});

watch(selectedCustomer, () => {
	itemsIntegration.customer.value = selectedCustomer.value || null;
	clearLastInvoiceRateCache();
	scheduleLastInvoiceRateRefresh();
});

watch(displayedItems, () => {
	nextTick(() => {
		checkItemContainerOverflow();
		scheduleCardMetricsUpdate();
	});
	scheduleLastInvoiceRateRefresh();
	itemSelection.syncHighlightedItem();
});

// 9. Template Bindings & Direct Exports
const ratePrecision = itemDisplay.ratePrecision;
const format_currency = itemDisplay.format_currency;
const format_number = itemDisplay.format_number;
const currencySymbol = itemDisplay.currencySymbol;
const headers = computed(() => itemDisplay.headers.value);
const memoizedFormatCurrency = computed(() => itemDisplay.memoizedFormatCurrency.value);
const memoizedFormatNumber = computed(() => itemDisplay.memoizedFormatNumber.value);
const modifierDialogFormatCurrency = (value: number) => {
	const formatter = memoizedFormatCurrency.value as any;
	if (typeof formatter === "function") {
		const result = formatter(
			value,
			selected_currency.value || pos_profile.value?.currency,
			ratePrecision(value),
		);
		return String(result ?? value ?? 0);
	}
	return String(value ?? 0);
};
const effectiveCatalogRenderMode = computed(() => {
	if (catalogRenderMode.value !== "small-menu-grid") {
		return "card-grid";
	}
	return useSmallMenuGrid.value ? "small-menu-grid" : "card-grid";
});

const isItemHighlighted = (index) => itemSelection.highlightedIndex.value === index;
const isNegative = (val) => val < 0;

const {
	scannerLocked,
	scanErrorDialog,
	scanErrorMessage,
	scanErrorCode,
	scanErrorDetails,
	acknowledgeScanError,
	onBarcodeScanned: onBarcodeScannedFromScannerInput,
} = scannerInput;
const { responsiveStyles, catalogRenderMode, deviceProfile } = responsive;
const tabletCompact = computed(() => deviceProfile.value === "tablet_landscape_compact");
// QuickOrderBar: first 12 items when no search is active (tablet compact + card view only)
const quickOrderItems = computed(() => {
	if (!tabletCompact.value || items_view.value !== "card" || search_input.value) return [];
	return displayedItems.value.slice(0, 12);
});
const { rtlClasses } = rtl;

// Proxy functions for template
const esc_event = () => clearSearch();
const onEnter = (e) => itemsSelectorSearch.onEnter(e);
const handleSearchKeydown = (e) => itemsSelectorFocus.handleSearchKeydown(e);
const handleSearchInput = (val) => {
	search_input.value = val;
};
const handleSearchPaste = (e) => itemsSelectorFocus.handleSearchPaste(e);
const handleItemSearchFocus = () => {
	clearSearch();
	itemsSelectorFocus.focusItemSearch();
};
const clearQty = () => {
	qty.value = null as any;
};
const onQtyBlur = () => {
	if (!qty.value || qty.value <= 0) {
		qty.value = 1;
	}
};
const startCameraScanning = () => {
	scannerInput.cameraScannerActive.value = true;
};
const forceReloadItems = () => itemsIntegration.get_items(true);
const cancelItemDetailsRequest = () => itemDetailFetcher.cancelItemDetailsRequest();

const onBarcodeScanned = async (code: string) => {
	// This function body was empty in the instruction, keeping it empty or adding a placeholder
	// The original onBarcodeScanned from scannerInput is now aliased as onBarcodeScannedFromScannerInput
	// If the intent was to override it, the body should be provided.
	// For now, calling the original one if it exists.
	if (onBarcodeScannedFromScannerInput) {
		onBarcodeScannedFromScannerInput(code);
	}
};

const select_item = (e, item) => itemSelection.handleItemSelection(e, item);
const click_item_row = (e, data) => itemSelection.handleRowClick(e, data);
const onVirtualRangeUpdate = (s, e, vs, ve) => itemsLoader.onVirtualRangeUpdate(s, e, vs, ve);
const onListScroll = (e) => handleListScroll(e);
const onScannerOpened = () => {
	scannerInput.cameraScannerActive.value = true;
};
const onScannerClosed = () => {
	scannerInput.cameraScannerActive.value = false;
};

const handleInvoiceTypeUpdate = (type: unknown) => {
	const normalized = typeof type === "string" ? type : "";
	current_invoice_type.value = normalized || "Invoice";
};

const resolveTableItem = (item: any) => item?.raw || item?.item || item;

const getItemRowClass = (item: any) => {
	const resolved = resolveTableItem(item);
	const highlightedIndex = displayedItems.value.indexOf(resolved);
	return {
		"pos-item-row": true,
		highlighted: isItemHighlighted(highlightedIndex),
		"item-row-unavailable": !!resolved?.posa_unavailable,
	};
};

const getItemRowProps = (item: any) => {
	const resolved = resolveTableItem(item);
	return {
		"data-item-code": resolved?.item_code,
		draggable: !resolved?.posa_unavailable,
		class: resolved?.posa_unavailable ? "item-row-unavailable" : "",
	};
};

const handleItemCreated = (_item) => {
	newItemDialog.value = false;
	itemsIntegration.get_items(true);
};

defineExpose({
	search_input,
	debounce_qty,
	qty,
	items_view,
	pos_profile,
	isLoadingOrSyncing,
	displayedItems,
	headers,
	active_price_list,
	memoizedFormatCurrency,
	memoizedFormatNumber,
	ratePrecision,
	format_currency,
	format_number,
	currencySymbol,
	openNewItemDialog: () => {
		newItemDialog.value = true;
	},
	clearSearch,
	onDragStart,
	onDragEnd,
	select_item,
	click_item_row,
	onVirtualRangeUpdate,
	onListScroll,
	responsiveStyles,
	catalogRenderMode,
	rtlClasses,
	scanErrorDialog,
	scanErrorMessage,
	scanErrorCode,
	scanErrorDetails,
	acknowledgeScanError,
	lastSyncTimeLabel,
	esc_event,
	onEnter,
	handleSearchKeydown,
	handleSearchInput,
	handleSearchPaste,
	handleItemSearchFocus,
	clearQty,
	startCameraScanning,
	toggleItemSettings,
	forceReloadItems,
	cancelItemDetailsRequest,
	applyItemSettings,
	show_item_settings,
	items_group,
	item_group,
	offersCount,
	couponsCount,
	virtualScrollBuffer,
	selected_currency,
	getLastInvoiceRate,
	isItemHighlighted,
	isNegative,
	headerProps,
	getItemRowClass,
	getItemRowProps,
	handleItemCreated,
	onBarcodeScanned,
	onScannerOpened,
	onScannerClosed,
	new_line,
	clearSearchAndQty,
	onQtyBlur,
	hide_qty_decimals,
	hide_zero_rate_items,
	show_last_invoice_rate,
	enable_background_sync,
	background_sync_interval,
	enable_custom_items_per_page,
	items_per_page,
	scannerLocked,
	temp_hide_qty_decimals,
	temp_hide_zero_rate_items,
	temp_enable_custom_items_per_page,
	temp_items_per_page,
	temp_force_server_items,
	temp_show_last_invoice_rate,
	temp_enable_background_sync,
	temp_background_sync_interval,
	localStorageAvailable,
	clearLastInvoiceRateCache,
	scheduleLastInvoiceRateRefresh,
	itemSync,
});
</script>

<style scoped>
.items-selector-shell {
	height: 100%;
	min-height: 0;
	display: flex;
	flex-direction: column;
}

.items-selector-card {
	flex: 1 1 auto;
	display: flex;
	flex-direction: column;
	min-height: 0;
	height: 100%;
}

/* "dynamic-card" no longer composes from pos-card; the pos-card class is added directly in the template */
.dynamic-padding {
	/* Equal spacing on all sides for consistent alignment */
	padding: var(--dynamic-sm);
	flex: 1 1 auto;
	min-height: 0;
}

.items-selector-body > * {
	min-width: 0;
}

.dynamic-scroll {
	transition: max-height 0.2s cubic-bezier(0.4, 0, 0.2, 1);
	padding-bottom: var(--dynamic-sm);
	contain: layout style;
}

.item-fly-placeholder {
	background-color: rgba(var(--v-theme-on-surface), 0.2);
}

:deep(.text-success) {
	color: rgb(var(--v-theme-success)) !important;
}

:deep(.text-primary),
:deep(.text-success),
:deep(.golden--text) {
	font-family:
		"SF Pro Display", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans Arabic", "Tahoma",
		sans-serif;
	font-variant-numeric: lining-nums tabular-nums;
	font-feature-settings:
		"tnum" 1,
		"lnum" 1,
		"kern" 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	letter-spacing: 0.02em;
}

:deep(.negative-number) {
	color: rgb(var(--v-theme-error)) !important;
	font-weight: 600;
	font-family:
		"SF Pro Display", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans Arabic", "Tahoma",
		sans-serif;
	font-variant-numeric: lining-nums tabular-nums;
	font-feature-settings:
		"tnum" 1,
		"lnum" 1,
		"kern" 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

:deep(.item-row-unavailable td) {
	opacity: 0.65;
}

/* Enhanced input fields for Arabic number support */
.v-text-field :deep(input),
.v-select :deep(input),
.v-autocomplete :deep(input) {
	/* Enhanced Arabic number font stack for input fields */
	font-family:
		"SF Pro Display", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "Noto Sans Arabic", "Tahoma",
		sans-serif;
	font-variant-numeric: lining-nums tabular-nums;
	font-feature-settings:
		"tnum" 1,
		"lnum" 1,
		"kern" 1;
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
	letter-spacing: 0.01em;
}

/* Dark theme row styling */
.truncate {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.selection {
	background-color: var(--pos-card-bg) !important;
}

.items-catalog-zone {
	min-height: 0;
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	grid-template-rows: minmax(0, 1fr);
	gap: 0;
	width: 100%;
	max-width: 100%;
	min-width: 0;
}

.items-grid-area {
	min-height: 0;
	height: 100%;
	margin: 0;
	width: 100%;
	max-width: 100%;
	overflow: hidden;
	display: flex;
	flex-direction: column;
}

.items-grid-area > * {
	flex: 1 1 auto;
	min-height: 0;
	min-width: 0;
}

.items-selector-toolbar-dock {
	flex-shrink: 0;
}

.item-selection-option {
	border: 1px solid rgba(var(--v-theme-on-surface), 0.12);
	transition:
		border-color 0.2s ease,
		background-color 0.2s ease;
}

.item-selection-option:hover {
	background-color: rgba(var(--v-theme-primary), 0.06);
	border-color: rgba(var(--v-theme-primary), 0.4);
}

.item-selection-image {
	width: 50px;
	height: 50px;
	object-fit: cover;
	margin-right: 15px;
	background-color: rgb(var(--v-theme-surface-variant));
}

/* Responsive breakpoints */
@media (max-width: 1200px) {
	.items-card-grid {
		grid-template-columns: repeat(2, 1fr);
		gap: 12px;
		padding: 12px;
	}
}

@media (max-width: 768px) {
	.dynamic-padding {
		/* Reduce spacing uniformly on smaller screens */
		padding: var(--dynamic-xs);
	}

	.items-card-grid {
		grid-template-columns: 1fr;
		gap: 10px;
		padding: 10px;
	}
}

@media (max-width: 480px) {
	.dynamic-padding {
		padding: var(--dynamic-xs);
	}
}

/* ===============================================================
   PERFORMANCE OPTIMIZATIONS FOR THEME SWITCHING
   =============================================================== */

/* Reduce paint and layout operations during theme transitions */
* {
	/* Optimize font rendering to reduce repaints */
	-webkit-font-smoothing: antialiased;
	-moz-osx-font-smoothing: grayscale;
}

/* Enable hardware acceleration for better performance */
.items-card-grid {
	/* Force hardware acceleration */
	transform: translate3d(0, 0, 0);
	-webkit-transform: translate3d(0, 0, 0);
	/* Improve compositing performance */
	backface-visibility: hidden;
	-webkit-backface-visibility: hidden;
}

/* Optimize scrolling performance */
.items-card-grid,
.item-container {
	/* Improve scroll performance */
	overscroll-behavior: contain;
	scroll-behavior: smooth;
	/* Enable scroll anchoring */
	overflow-anchor: auto;
}

/* Disable animations on reduced motion preference */
@media (prefers-reduced-motion: reduce) {
	.items-card-grid {
		transition: none !important;
		animation: none !important;
		transform: none !important;
	}
}
</style>
