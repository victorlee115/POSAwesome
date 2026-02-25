<template>
	<v-row dense class="invoice-actions-grid">
		<template v-if="!tabletCompact">
			<v-col cols="6">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-content-save"
					@click="$emit('save-and-clear')"
					class="summary-btn summary-btn-neutral"
					:loading="saveLoading"
				>
					{{ __("Save & Clear") }}
				</v-btn>
			</v-col>
			<v-col cols="6">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-file-document"
					@click="$emit('load-drafts')"
					class="summary-btn summary-btn-neutral"
					:loading="loadDraftsLoading"
				>
					{{ __("Load Drafts") }}
				</v-btn>
			</v-col>
			<v-col cols="6" v-if="pos_profile.custom_allow_select_sales_order == 1">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-book-search"
					@click="$emit('select-order')"
					class="summary-btn summary-btn-neutral"
					:loading="selectOrderLoading"
				>
					{{ __("Select S.O") }}
				</v-btn>
			</v-col>
			<v-col cols="6">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-close-circle"
					@click="$emit('cancel-sale')"
					class="summary-btn summary-btn-danger"
					:loading="cancelLoading"
				>
					{{ __("Cancel Sale") }}
				</v-btn>
			</v-col>
			<v-col cols="6" v-if="pos_profile.posa_allow_return == 1">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-backup-restore"
					@click="$emit('open-returns')"
					class="summary-btn summary-btn-neutral"
					:loading="returnsLoading"
				>
					{{ __("Sales Return") }}
				</v-btn>
			</v-col>
			<v-col cols="6" v-if="pos_profile.posa_allow_print_draft_invoices">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-printer"
					@click="$emit('print-draft')"
					class="summary-btn summary-btn-neutral"
					:loading="printLoading"
				>
					{{ __("Print Draft") }}
				</v-btn>
			</v-col>
			<v-col cols="6">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-tag"
					@click="$emit('apply-offers')"
					class="summary-btn summary-btn-accent"
					:loading="applyOffersLoading"
				>
					{{ __("Apply Offers") }}
				</v-btn>
			</v-col>
			<v-col cols="6" v-if="showCustomerDisplayButton">
				<v-btn
					block
					variant="flat"
					prepend-icon="mdi-monitor"
					@click="$emit('open-customer-display')"
					class="summary-btn summary-btn-neutral"
					:loading="customerDisplayLoading"
				>
					{{ __("Customer Screen") }}
				</v-btn>
			</v-col>
		</template>
		<v-col cols="12">
			<v-btn
				block
				variant="flat"
				size="large"
				prepend-icon="mdi-credit-card"
				@click="$emit('show-payment')"
				class="summary-btn pay-btn"
				:loading="paymentLoading"
			>
				{{ __("PAY") }}
			</v-btn>
		</v-col>
	</v-row>
</template>

<script setup>
import { computed } from "vue";
import { parseBooleanSetting } from "../../../utils/stock";

const props = defineProps({
	pos_profile: {
		type: Object,
		required: true,
		default: () => ({}),
	},
	tabletCompact: {
		type: Boolean,
		default: false,
	},
	saveLoading: Boolean,
	loadDraftsLoading: Boolean,
	selectOrderLoading: Boolean,
	cancelLoading: Boolean,
	returnsLoading: Boolean,
	printLoading: Boolean,
	applyOffersLoading: Boolean,
	paymentLoading: Boolean,
	customerDisplayLoading: Boolean,
});

defineEmits([
	"save-and-clear",
	"load-drafts",
	"select-order",
	"cancel-sale",
	"open-returns",
	"print-draft",
	"apply-offers",
	"show-payment",
	"open-customer-display",
]);

const __ = window.__;
const frappe = window.frappe;
const showCustomerDisplayButton = computed(() =>
	parseBooleanSetting(props.pos_profile?.posa_enable_customer_display),
);
</script>

<style scoped>
.invoice-actions-grid {
	row-gap: 8px;
}
</style>
