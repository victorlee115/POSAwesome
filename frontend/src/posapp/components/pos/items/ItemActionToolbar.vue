<template>
	<div v-if="!tabletCompact" class="item-action-toolbar-shell">
		<div class="toolbar-row toolbar-row-fields">
			<v-select
				class="toolbar-field items-group-field"
				:items="itemsGroup"
				:label="frappe._('Items Group')"
				density="compact"
				variant="solo"
				hide-details
				:model-value="modelValue"
				@update:model-value="$emit('update:modelValue', $event)"
			></v-select>
			<v-text-field
				v-if="posProfile.posa_enable_price_list_dropdown !== false"
				class="toolbar-field price-list-field"
				density="compact"
				variant="solo"
				color="primary"
				:label="frappe._('Price List')"
				hide-details
				:model-value="activePriceList"
				readonly
			></v-text-field>
		</div>
		<div class="toolbar-row toolbar-row-actions">
			<div class="view-toggle-btn" role="group" :aria-label="__('Item View')">
				<v-btn
					:class="['view-toggle-option', { 'view-toggle-option--active': itemsView === 'list' }]"
					variant="flat"
					@click="$emit('update:itemsView', 'list')"
				>
					{{ __("List") }}
				</v-btn>
				<v-btn
					:class="['view-toggle-option', { 'view-toggle-option--active': itemsView === 'card' }]"
					variant="flat"
					@click="$emit('update:itemsView', 'card')"
				>
					{{ __("Card") }}
				</v-btn>
			</div>
			<v-btn
				variant="flat"
				prepend-icon="mdi-brightness-percent"
				@click="$emit('open-offers')"
				class="action-btn-consistent toolbar-chip-btn toolbar-chip-btn--offers"
			>
				{{ offersCount }} {{ __("Offers") }}
			</v-btn>
			<v-btn
				variant="flat"
				prepend-icon="mdi-ticket-percent-outline"
				@click="$emit('open-coupons')"
				:class="[
					'action-btn-consistent',
					'toolbar-chip-btn',
					'toolbar-chip-btn--coupons',
					{ 'toolbar-chip-btn--full': !prepEnabled },
				]"
			>
				{{ couponsCount }} {{ __("Coupons") }}
			</v-btn>
			<v-btn
				v-if="prepEnabled"
				variant="flat"
				prepend-icon="mdi-coffee-outline"
				@click="$emit('open-prep')"
				class="action-btn-consistent toolbar-chip-btn toolbar-chip-btn--prep"
			>
				{{ __("Prep Queue") }}
			</v-btn>
		</div>
	</div>
</template>

<script setup>
const __ = window.__;
const frappe = window.frappe;

defineProps({
	modelValue: { type: String, default: "ALL" }, // item_group
	itemsGroup: { type: Array, default: () => [] },
	itemsView: { type: String, default: "card" },
	posProfile: { type: Object, required: true },
	activePriceList: { type: String, default: "" },
	offersCount: { type: Number, default: 0 },
	couponsCount: { type: Number, default: 0 },
	prepEnabled: { type: Boolean, default: false },
	tabletCompact: { type: Boolean, default: false },
});

defineEmits(["update:modelValue", "update:itemsView", "open-offers", "open-coupons", "open-prep"]);
</script>

<style scoped>
.item-action-toolbar-shell {
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	gap: 8px;
}

.toolbar-row {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
	min-width: 0;
}

.toolbar-row-fields {
	grid-template-columns: repeat(2, minmax(0, 1fr));
}

.toolbar-row-actions {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(146px, 1fr));
	gap: 8px;
}

.toolbar-field {
	width: 100%;
}

.view-toggle-btn {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0;
	min-width: 0;
	max-width: 100%;
	background: #ffffff;
	border: 1px solid #d7e2ee;
	border-radius: 999px;
	overflow: hidden;
}

.view-toggle-option {
	min-width: 74px;
	min-height: 44px;
	border-radius: 0 !important;
	text-transform: none;
	font-weight: 700;
	letter-spacing: 0.01em;
}

.view-toggle-option :deep(.v-btn__content) {
	white-space: nowrap;
	overflow: visible;
	text-overflow: clip;
}

.view-toggle-option:first-child {
	border-top-left-radius: 999px !important;
	border-bottom-left-radius: 999px !important;
}

.view-toggle-option:last-child {
	border-top-right-radius: 999px !important;
	border-bottom-right-radius: 999px !important;
}

.view-toggle-option.view-toggle-option--active {
	background: #dbe7ff !important;
	color: #1d4ed8 !important;
}

.toolbar-row-actions .action-btn-consistent {
	width: 100%;
	min-width: 0;
}

.toolbar-row-actions .action-btn-consistent :deep(.v-btn__content) {
	white-space: nowrap;
	overflow: visible;
}

.toolbar-chip-btn--full,
.toolbar-chip-btn--prep {
	grid-column: 1 / -1;
}

@media (max-width: 1240px) {
	.toolbar-row-actions {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

@media (max-width: 960px) {
	.toolbar-row-fields {
		grid-template-columns: 1fr;
	}

	.toolbar-row-actions {
		grid-template-columns: 1fr;
	}

	.toolbar-chip-btn--full,
	.toolbar-chip-btn--prep {
		grid-column: auto;
	}
}
</style>
