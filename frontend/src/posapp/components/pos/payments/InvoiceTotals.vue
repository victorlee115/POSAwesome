<template>
	<div v-if="invoice_doc" class="invoice-totals-grid">
		<div v-for="entry in totalEntries" :key="entry.key" class="invoice-total-item">
			<span class="invoice-total-label">{{ entry.label }}</span>
			<span class="invoice-total-value">{{ currencyPrefix }} {{ entry.value }}</span>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	invoice_doc: Object,
	displayCurrency: String,
	diff_payment: Number,
	diff_label: String,
	currencySymbol: Function,
	formatCurrency: Function,
});

const currencyPrefix = computed(() => props.currencySymbol?.(props.invoice_doc?.currency) || "");

const totalEntries = computed(() => {
	if (!props.invoice_doc) {
		return [];
	}

	const entries = [
		{
			key: "total",
			label: frappe._("Total Amount"),
			value: props.formatCurrency?.(props.invoice_doc.total, props.displayCurrency),
		},
		{
			key: "tax",
			label: frappe._("Tax and Charges"),
			value: props.formatCurrency?.(props.invoice_doc.total_taxes_and_charges, props.displayCurrency),
		},
		{
			key: "discount",
			label: frappe._("Discount Amount"),
			value: props.formatCurrency?.(props.invoice_doc.discount_amount, props.displayCurrency),
		},
		{
			key: "grand",
			label: frappe._("Grand Total"),
			value: props.formatCurrency?.(props.invoice_doc.grand_total, props.displayCurrency),
		},
	];

	if (props.invoice_doc.rounded_total) {
		entries.push({
			key: "rounded",
			label: frappe._("Rounded Total"),
			value: props.formatCurrency?.(props.invoice_doc.rounded_total, props.displayCurrency),
		});
	}

	return entries;
});

const frappe = window.frappe;
</script>

<style scoped>
.invoice-totals-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

.invoice-total-item {
	display: grid;
	gap: 4px;
	padding: 10px 12px;
	border-radius: 12px;
	border: 1px solid #d2dfed;
	background: #f8fbff;
}

.invoice-total-label {
	font-size: 0.8rem;
	font-weight: 700;
	color: #5e738a;
}

.invoice-total-value {
	font-size: 1.05rem;
	font-weight: 800;
	color: #16314e;
}

@media (max-width: 920px) {
	.invoice-totals-grid {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
