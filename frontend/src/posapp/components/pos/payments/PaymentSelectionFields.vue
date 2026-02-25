<template>
	<div class="payment-selection-grid">
		<v-select
			density="compact"
			clearable
			variant="solo"
			color="primary"
			:label="$frappe._('Sales Person')"
			:model-value="salesPerson"
			:items="salesPersons"
			item-title="title"
			item-value="value"
			class="sleek-field pos-themed-input"
			:no-data-text="$__('Sales Person not found')"
			hide-details
			:disabled="readonly"
			@update:model-value="$emit('update:sales-person', $event)"
		></v-select>
		<v-select
			density="compact"
			clearable
			variant="solo"
			color="primary"
			:label="$frappe._('Print Format')"
			:model-value="printFormat"
			:items="printFormats"
			class="sleek-field pos-themed-input"
			:no-data-text="$__('No Print Formats Found')"
			hide-details
			@update:model-value="$emit('update:print-format', $event)"
		></v-select>
	</div>
</template>

<script setup>
import { inject } from "vue";

defineProps({
	salesPersons: {
		type: Array,
		default: () => [],
	},
	salesPerson: {
		type: String,
		default: "",
	},
	readonly: {
		type: Boolean,
		default: false,
	},
	printFormats: {
		type: Array,
		default: () => [],
	},
	printFormat: {
		type: String,
		default: "",
	},
});

defineEmits(["update:sales-person", "update:print-format"]);

const $frappe = inject("frappe", window.frappe);
const $__ = inject("__", window.__);
</script>

<style scoped>
.payment-selection-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

.pos-themed-input :deep(.v-field__input) {
	font-weight: 600;
}

@media (max-width: 900px) {
	.payment-selection-grid {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
