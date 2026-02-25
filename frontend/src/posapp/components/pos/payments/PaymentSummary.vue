<template>
	<div v-if="invoice_doc" class="payment-summary-strip">
		<div class="payment-summary-grid">
			<button
				type="button"
				class="payment-summary-tile"
				@click="$emit('show-diff-payment')"
			>
				<span class="payment-summary-label">{{ amountDueDisplay === zeroDisplay ? frappe._("Total") : frappe._("Amount Due") }}</span>
				<span class="payment-summary-value">{{ currencyPrefix }} {{ amountDueDisplay }}</span>
			</button>

			<button
				type="button"
				class="payment-summary-tile"
				@click="$emit('show-paid-amount')"
			>
				<span class="payment-summary-label">{{ frappe._("Paid") }}</span>
				<span class="payment-summary-value">{{ currencyPrefix }} {{ total_payments_display }}</span>
			</button>

			<button
				type="button"
				class="payment-summary-tile"
				:class="{ 'payment-summary-tile--positive': change_due > 0 }"
				@click="$emit('show-paid-change')"
			>
				<span class="payment-summary-label">{{ frappe._("Change") }}</span>
				<span class="payment-summary-value">{{ currencyPrefix }} {{ changeDisplay }}</span>
			</button>
		</div>

		<div
			v-if="invoice_doc && change_due > 0 && !invoice_doc.is_return"
			class="payment-summary-change-grid"
		>
			<v-text-field
				variant="solo"
				color="primary"
				:label="frappe._('Cash Change')"
				class="sleek-field pos-themed-input"
				:model-value="formatCurrency(paid_change)"
				:prefix="currencyPrefix"
				density="compact"
				hide-details
				readonly
				type="text"
				@click="$emit('show-paid-change')"
			></v-text-field>
			<v-text-field
				variant="solo"
				color="primary"
				:label="frappe._('Credit Change')"
				class="sleek-field pos-themed-input"
				:model-value="formatCurrency(Math.abs(credit_change))"
				:prefix="currencyPrefix"
				density="compact"
				hide-details
				type="text"
				@change="$emit('update-credit-change', $event)"
			></v-text-field>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
	invoice_doc: Object,
	total_payments_display: String,
	diff_payment_display: String,
	diff_label: String,
	change_due: Number,
	paid_change: Number,
	credit_change: Number,
	paid_change_rules: Array,
	currencySymbol: Function,
	formatCurrency: Function,
});

defineEmits(["show-paid-amount", "show-diff-payment", "show-paid-change", "update-credit-change"]);

const currencyPrefix = computed(() => props.currencySymbol?.(props.invoice_doc?.currency) || "");

const isDueLabel = computed(() => {
	const text = (props.diff_label || "").toLowerCase();
	return text.includes("to be paid") || text.includes("due");
});

const zeroDisplay = computed(() => props.formatCurrency?.(0) || "0.00");

const amountDueDisplay = computed(() => {
	if (isDueLabel.value) {
		return props.diff_payment_display || zeroDisplay.value;
	}
	return zeroDisplay.value;
});

const changeDisplay = computed(() => {
	if ((props.change_due || 0) > 0) {
		return props.formatCurrency?.(props.change_due) || props.diff_payment_display || zeroDisplay.value;
	}
	if (!isDueLabel.value) {
		return props.diff_payment_display || zeroDisplay.value;
	}
	return zeroDisplay.value;
});

const frappe = window.frappe;
</script>

<style scoped>
.payment-summary-strip {
	display: grid;
	gap: 12px;
}

.payment-summary-grid {
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px;
}

.payment-summary-tile {
	display: grid;
	gap: 4px;
	padding: 10px 12px;
	min-height: 64px;
	border-radius: 12px;
	border: 1px solid #bfd0e3;
	background: #f6f9fd;
	text-align: left;
	color: #172f49;
	cursor: pointer;
}

.payment-summary-tile:hover,
.payment-summary-tile:focus-visible {
	border-color: #8fb2da;
	background: #eef4fc;
	outline: none;
}

.payment-summary-tile--positive {
	border-color: #95d1ad;
	background: #edf9f1;
}

.payment-summary-label {
	font-size: 0.78rem;
	font-weight: 700;
	color: #5a6f86;
}

.payment-summary-value {
	font-size: clamp(0.92rem, 2.2vw, 1.28rem);
	line-height: 1.25;
	font-weight: 800;
	color: #112742;
	word-break: break-all;
	overflow-wrap: anywhere;
}

.payment-summary-change-grid {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 8px;
}

@media (max-width: 600px) {
	.payment-summary-grid,
	.payment-summary-change-grid {
		grid-template-columns: minmax(0, 1fr);
	}
}
</style>
