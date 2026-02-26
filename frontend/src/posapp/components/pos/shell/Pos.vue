<template>
	<div
		class="pos-main-container dynamic-container square-pos-shell"
		:class="rtlClasses"
		:data-device-profile="deviceProfile"
		:data-catalog-render-mode="catalogRenderMode"
		:data-cart-render-mode="cartRenderMode"
		:data-payment-layout-mode="paymentLayoutMode"
		:style="[responsiveStyles, rtlStyles]"
	>
		<Drafts></Drafts>
		<SalesOrders></SalesOrders>
		<Returns></Returns>
		<NewAddress></NewAddress>
		<MpesaPayments></MpesaPayments>
		<Variants></Variants>
		<OpeningDialog
			v-if="dialog"
			:dialog="dialog"
			@close="closeOpeningDialog"
			@register="handleRegisterPosData"
		></OpeningDialog>
		<div
			v-show="!dialog"
			class="dynamic-main-row square-pos-columns"
			:class="[
				`device-${deviceProfile}`,
				`catalog-mode-${catalogRenderMode}`,
				`cart-mode-${cartRenderMode}`,
				`payment-layout-${paymentLayoutMode}`,
			]"
		>
			<section v-show="activeView === 'items'" class="pos dynamic-col square-pane square-pane-left">
				<ItemsSelector context="pos" />
			</section>
			<section v-show="activeView === 'offers'" class="pos dynamic-col square-pane square-pane-left">
				<PosOffers></PosOffers>
			</section>
			<section v-show="activeView === 'coupons'" class="pos dynamic-col square-pane square-pane-left">
				<PosCoupons></PosCoupons>
			</section>
			<section v-show="activeView === 'payment'" class="pos dynamic-col square-pane square-pane-left">
				<Payments></Payments>
			</section>
			<section v-show="activeView === 'prep'" class="pos dynamic-col square-pane square-pane-left">
				<PrepQueue :pos-profile="posProfile" @back="uiStore.setActiveView('items')" />
			</section>

			<section class="pos dynamic-col square-pane square-pane-cart">
				<Invoice></Invoice>
			</section>
		</div>

	<!-- Kiosk strip — tablet compact mode only -->
	<div v-if="tabletCompact" class="kiosk-strip">
		<span class="kiosk-strip-label">{{ posProfile ? posProfile.name : '' }}</span>
		<span
			class="kiosk-online-dot"
			:class="isOnline ? 'kiosk-online-dot--online' : 'kiosk-online-dot--offline'"
			:title="isOnline ? 'Online' : 'Offline'"
		></span>
		<v-btn icon variant="text" size="small" class="kiosk-gear-btn"
			@click="kioskSheetOpen = true">
			<v-icon size="20">mdi-cog-outline</v-icon>
		</v-btn>
	</div>

	<v-bottom-sheet v-model="kioskSheetOpen" max-height="50vh">
		<v-card class="kiosk-sheet-card">
			<v-list density="compact" nav>
				<v-list-item prepend-icon="mdi-cart-off"
					:title="__('New Order')"
					subtitle="Clear cart and start fresh"
					@click="eventBus && eventBus.emit('clear_invoice'); kioskSheetOpen = false" />
				<v-divider class="my-1" />
				<v-list-item prepend-icon="mdi-image-refresh-outline"
					:title="__('Reload Items')"
					subtitle="Re-fetch menu &amp; images from server"
					@click="eventBus && eventBus.emit('reload_items'); kioskSheetOpen = false" />
				<v-list-item prepend-icon="mdi-content-save-move-outline"
					:title="__('Close Shift')"
					@click="get_closing_data(); kioskSheetOpen = false" />
				<v-list-item prepend-icon="mdi-sync"
					:title="__('Sync Offline Invoices')"
					@click="eventBus && eventBus.emit('sync_invoices'); kioskSheetOpen = false" />
				<v-list-item prepend-icon="mdi-refresh"
					:title="__('Reload Page')"
					@click="windowReload" />
			</v-list>
		</v-card>
	</v-bottom-sheet>
	</div>
</template>

<script>
import ItemsSelector from "../items/ItemsSelector.vue";
import Invoice from "../Invoice.vue";
import OpeningDialog from "../shift/OpeningDialog.vue";
import Payments from "../Payments.vue";
import PrepQueue from "../PrepQueue.vue";
import PosOffers from "../offers/PosOffers.vue";
import PosCoupons from "../offers/PosCoupons.vue";
import Drafts from "../flows/Drafts.vue";
import SalesOrders from "../flows/SalesOrders.vue";
import NewAddress from "../customer/NewAddress.vue";
import Variants from "../items/Variants.vue";
import Returns from "../flows/Returns.vue";
import MpesaPayments from "../payments/Mpesa-Payments.vue";
import { inject, ref, onMounted, onBeforeUnmount } from "vue";
import { usePosShift } from "../../../composables/pos/shared/usePosShift";
import { useOffers } from "../../../composables/pos/shared/useOffers";
// Import the cache cleanup function
import { clearExpiredCustomerBalances } from "../../../../offline/index";
import { useResponsive } from "../../../composables/core/useResponsive";
import { useRtl } from "../../../composables/core/useRtl";
import { useCustomersStore } from "../../../stores/customersStore.js";
import { useUIStore } from "../../../stores/uiStore.js";
import { useInvoiceStore } from "../../../stores/invoiceStore.js";
import { useItemsStore } from "../../../stores/itemsStore.js";
import { storeToRefs } from "pinia";
import { useCustomerDisplayPublisher } from "../../../composables/pos/shared/useCustomerDisplayPublisher";
import { useOnlineStatus } from "../../../composables/core/useOnlineStatus";

export default {
	setup() {
		const eventBus = inject("eventBus");
		const dialog = ref(false);
		const responsive = useResponsive();
		const { isOnline } = useOnlineStatus();
		const rtl = useRtl();
		const shift = usePosShift(() => {
			dialog.value = true;
		});
		const offers = useOffers();
		const uiStore = useUIStore();
		const invoiceStore = useInvoiceStore();
		const itemsStore = useItemsStore();
		const { activeView, posProfile } = storeToRefs(uiStore);

		useCustomerDisplayPublisher({
			posProfile,
			eventBus,
		});

		onMounted(() => {
			if (eventBus) {
				eventBus.on("submit_closing_pos", (data) => {
					shift.submit_closing_pos(data);
				});
			}
		});

		onBeforeUnmount(() => {
			if (eventBus) {
				eventBus.off("submit_closing_pos");
			}
		});

		return {
			...responsive,
			...rtl,
			...shift,
			...offers,
			uiStore,
			invoiceStore,
			itemsStore,
			activeView,
			posProfile,
			eventBus,
			dialog,
			isOnline,
		};
	},
	data: function () {
		return {
			// dialog moved to setup ref
			itemsLoaded: false,
			customersLoaded: false,
			kioskSheetOpen: false,
		};
	},

	computed: {
		tabletCompact() {
			return this.deviceProfile === "tablet_landscape_compact";
		},
	},

	components: {
		ItemsSelector,
		Invoice,
		OpeningDialog,
		Payments,
		PrepQueue,
		Drafts,

		Returns,
		PosOffers,
		PosCoupons,
		NewAddress,
		Variants,
		MpesaPayments,
		SalesOrders,
	},

	methods: {
		create_opening_voucher() {
			this.dialog = true;
		},
		windowReload() {
			window.location.reload();
		},
		get_pos_setting() {
			frappe.db.get_doc("POS Settings", undefined).then((_doc) => {
				// Update store directly instead of emitting event
				// If Payments.vue or others need this, they should watch uiStore.posSettings
				// For now, we assume uiStore.setStockSettings or similar is sufficient,
				// or we add a new generic settings store.
				// However, the original code used eventBus.emit("set_pos_settings", doc);
				// We'll attach it to uiStore if a suitable method exists, or just log for now as
				// clean separation implies components fetch what they need or use a centralized config store.
				// Assuming uiStore handles global config:
				// this.uiStore.setPosSettings(doc); // We might need to implement this if it doesn't exist
			});
		},
		checkLoadingComplete() {
			if (this.itemsLoaded && this.customersLoaded) {
				// Loading complete logic
			}
		},
		// handleAddItem removed as ItemsSelector handles pos addition internally
		handleRegisterPosData(data) {
			this.pos_profile = data.pos_profile;
			this.get_offers(this.pos_profile.name, this.pos_profile);
			this.pos_opening_shift = data.pos_opening_shift;

			// Update Store
			this.uiStore.setRegisterData(data);
		},
		closeOpeningDialog() {
			this.dialog = false;
		},
	},

	mounted: function () {
		this.$nextTick(function () {
			this.check_opening_entry();
			this.get_pos_setting();

			// Watch store for updates
			this.$watch(
				() => this.uiStore.posProfile,
				async (newProfile) => {
					if (newProfile && newProfile.name) {
						this.pos_profile = newProfile;
						this.get_offers(newProfile.name, newProfile);

						// Initialize Customers Store
						const customersStore = useCustomersStore();
						customersStore.setPosProfile(newProfile);
						await customersStore.get_customer_names();
					}
				},
				{ deep: true, immediate: true },
			);

			// Items loading state check
			const { itemsLoaded } = storeToRefs(this.itemsStore);
			this.$watch(
				() => itemsLoaded.value,
				(val) => {
					if (val) {
						this.itemsLoaded = true;
						this.checkLoadingComplete();
					}
				},
				{ immediate: true },
			);
		});
	},
	// In the created() or mounted() lifecycle hook
	created() {
		// Clean up expired customer balance cache on POS load
		clearExpiredCustomerBalances();
		const customersStore = useCustomersStore();
		const { customersLoaded } = storeToRefs(customersStore);
		this.$watch(
			() => customersLoaded.value,
			(value) => {
				if (value) {
					this.customersLoaded = true;
					this.checkLoadingComplete();
				}
			},
			{ immediate: true },
		);
	},
};
</script>

<style scoped>
.dynamic-container {
	height: 100%;
	min-height: 0;
}

.dynamic-main-row {
	height: 100%;
	min-height: 0;
}

.dynamic-col {
	padding: 0;
	margin-top: 0;
	min-height: 0;
}

.kiosk-strip {
	position: fixed;
	bottom: 0;
	left: 0;
	right: 0;
	height: 32px;
	background: rgba(20, 30, 50, 0.85);
	display: flex;
	align-items: center;
	justify-content: flex-end;
	padding: 0 8px;
	z-index: 9999;
	gap: 8px;
}

.kiosk-strip-label {
	color: rgba(255, 255, 255, 0.55);
	font-size: 0.7rem;
	flex: 1;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.kiosk-online-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	flex-shrink: 0;
}

.kiosk-online-dot--online {
	background: #22c074;
	box-shadow: 0 0 0 2px rgba(34, 192, 116, 0.3);
}

.kiosk-online-dot--offline {
	background: #e85555;
	box-shadow: 0 0 0 2px rgba(232, 85, 85, 0.3);
}

.kiosk-gear-btn {
	color: rgba(255, 255, 255, 0.8) !important;
}

.kiosk-sheet-card {
	border-radius: 16px 16px 0 0 !important;
}
</style>
