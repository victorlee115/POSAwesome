<template>
	<div
		:class="[
			'card-item-card',
			{ 'item-highlighted': isItemHighlighted, 'item-unavailable': isUnavailable },
		]"
		@click="onClick"
		:draggable="!isUnavailable"
		@dragstart="onDragStart"
		@dragend="onDragEnd"
		:title="unavailableReason || ''"
	>
		<div v-if="item.image" class="card-item-image-container">
			<v-img
				:src="item.image"
				class="card-item-image"
				aspect-ratio="1"
				:alt="item.item_name"
			>
				<template #placeholder>
					<div class="image-placeholder">
						<v-icon size="40" color="grey-lighten-2"> mdi-image </v-icon>
					</div>
				</template>
			</v-img>
			<v-chip
				v-if="isUnavailable"
				size="x-small"
				color="error"
				variant="flat"
				class="unavailable-chip"
			>
				{{ __("Unavailable now") }}
			</v-chip>
		</div>
		<div class="card-item-content">
			<div class="card-item-main">
				<div class="card-item-header">
					<h4 class="card-item-name">{{ item.item_name }}</h4>
					<span class="card-item-code">{{ item.item_code }}</span>
				</div>
				<div v-if="isUnavailable && unavailableReason" class="card-item-unavailable-reason">
					{{ unavailableReason }}
				</div>
			</div>
			<div class="card-item-details">
					<div class="card-item-price">
						<div class="primary-price">
							<span class="currency-symbol">
								{{ currencySymbol(primaryCurrency) }}
							</span>
							<span class="price-amount">
								{{ primaryPriceDisplay }}
							</span>
						</div>
						<div v-if="showSecondaryPrice" class="secondary-price">
							<span class="currency-symbol">
								{{ currencySymbol(secondaryCurrency) }}
							</span>
							<span class="price-amount">
								{{ secondaryPriceDisplay }}
							</span>
						</div>
					<div v-if="lastInvoiceRate" class="last-rate-chip">
						<v-icon size="14" class="mr-1" color="secondary">mdi-history</v-icon>
						<span class="last-rate-label">{{ __("Last") }}:</span>
						<span class="last-rate-value">
							{{ currencySymbol(lastInvoiceRate.currency || posProfile.currency) }}
							{{
								formatCurrency(
									lastInvoiceRate.rate,
									lastInvoiceRate.currency || posProfile.currency,
									primaryPrecision,
								)
							}}
							<span v-if="lastInvoiceRate.uom" class="last-rate-uom">
								/{{ lastInvoiceRate.uom }}
							</span>
						</span>
					</div>
				</div>
				<div class="card-item-stock">
					<v-icon size="small" class="stock-icon"> mdi-package-variant </v-icon>
					<span
						class="stock-amount"
						:class="{
							'negative-number': isNegative(item.actual_qty),
						}"
					>
						{{ formattedActualQty }}
					</span>
					<span class="stock-uom">{{ item.stock_uom || "" }}</span>
				</div>
			</div>
		</div>
	</div>
</template>

<script setup>
import { computed } from "vue";
import placeholderImage from "../placeholder-image.png";
const __ = window.__ || ((text) => text);

const props = defineProps({
	item: { type: Object, required: true },
	posProfile: { type: Object, required: true },
	context: { type: String, default: "pos" },
	selectedCurrency: { type: String, default: "" },
	hideQtyDecimals: { type: Boolean, default: false },
	lastInvoiceRate: { type: Object, default: null },
	isItemHighlighted: { type: Boolean, default: false },
	currencySymbol: { type: Function, required: true },
	formatCurrency: { type: Function, required: true },
	formatNumber: { type: Function, required: true },
	ratePrecision: { type: Function, required: true },
	isNegative: { type: Function, default: (val) => val < 0 },
});

const emit = defineEmits(["click", "dragstart", "dragend"]);
const isUnavailable = computed(() => !!props.item?.posa_unavailable);
const unavailableReason = computed(() =>
	String(props.item?.posa_unavailable_reason || "").trim(),
);

const primaryCurrency = computed(() => {
	if (props.context === "purchase") return props.posProfile.currency;
	return (
		props.item.original_currency ||
		props.item.currency ||
		props.item.price_list_currency ||
		props.posProfile.currency
	);
});

const primaryRate = computed(() => {
	if (props.context === "purchase") {
		return props.item.rate || props.item.standard_rate || 0;
	}
	return props.item.original_rate ?? props.item.rate ?? 0;
});

const primaryPrecision = computed(() => {
	return Math.max(props.ratePrecision(primaryRate.value), 2);
});

const secondaryCurrency = computed(() => props.selectedCurrency);

const formatPriceOrZero = (value, _currency, precision) => {
	// formatCurrency(value, precision) — currency arg is not used by the formatter
	const formatted = props.formatCurrency(value, precision);
	const normalized = String(formatted ?? "").trim();
	return normalized.length ? normalized : props.formatCurrency(0, precision);
};

const primaryPriceDisplay = computed(() =>
	formatPriceOrZero(primaryRate.value, primaryCurrency.value, Math.max(primaryPrecision.value, 2)),
);

const showSecondaryPrice = computed(() => {
	return (
		props.context !== "purchase" &&
		props.posProfile.posa_allow_multi_currency &&
		Boolean(props.selectedCurrency) &&
		props.selectedCurrency !== primaryCurrency.value
	);
});

const secondaryPriceDisplay = computed(() =>
	formatPriceOrZero(props.item.rate ?? 0, secondaryCurrency.value, Math.max(primaryPrecision.value, 2)),
);

const formattedActualQty = computed(() => {
	const numericQty = Number(props.item.actual_qty ?? 0);
	if (!Number.isFinite(numericQty)) {
		return 0;
	}
	if (props.hideQtyDecimals) {
		return props.formatNumber(Math.round(numericQty), 0);
	}
	return props.formatNumber(numericQty, 4);
});

const onClick = (event) => {
	emit("click", event, props.item);
};

const onDragStart = (event) => {
	if (isUnavailable.value) {
		event.preventDefault();
		return;
	}
	emit("dragstart", event, props.item);
};

const onDragEnd = (event) => {
	emit("dragend", event);
};
</script>

<style scoped>
.card-item-card {
	background: var(--pos-white, #ffffff);
	border-radius: 16px;
	border: 1px solid #dbe4ef;
	overflow: hidden;
	transition:
		transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
		box-shadow 0.2s ease,
		border-color 0.2s ease;
	cursor: pointer;
	display: flex;
	flex-direction: column;
	height: 100%;
	width: 100%;
	box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
	will-change: transform;
	backface-visibility: hidden;
	transform: translate3d(0, 0, 0);
	position: relative;
}

.card-item-card:hover {
	transform: translate3d(0, -2px, 0);
	box-shadow: 0 14px 28px rgba(15, 23, 42, 0.12);
	border-color: #b6cae9;
}

.card-item-card.item-highlighted {
	border-color: #0b63d1;
	box-shadow:
		0 0 0 3px rgba(11, 99, 209, 0.22),
		0 12px 24px rgba(11, 99, 209, 0.22);
	transform: translate3d(0, -2px, 0);
	background: #f8fbff;
}

.card-item-card.item-unavailable {
	opacity: 0.58;
	filter: grayscale(0.1);
	cursor: not-allowed;
}

.card-item-card.item-unavailable:hover {
	transform: none;
	box-shadow: 0 8px 22px rgba(15, 23, 42, 0.08);
	border-color: #dbe4ef;
}

.card-item-image-container {
	position: relative;
	height: 96px;
	flex-shrink: 0;
	overflow: hidden;
	background: linear-gradient(180deg, #f8fbff 0%, #eef3fa 100%);
}

.unavailable-chip {
	position: absolute;
	top: 10px;
	left: 10px;
	z-index: 2;
	font-weight: 700;
	letter-spacing: 0.01em;
}

.card-item-image {
	width: 100%;
	height: 100%;
	object-fit: cover;
	background-color: #f6f8fb;
}

.image-placeholder {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 100%;
	height: 100%;
	background-color: #eef3fa;
}

.card-item-content {
	padding: 8px 8px 10px;
	display: grid;
	grid-template-rows: minmax(0, 1fr) auto;
	row-gap: 4px;
	flex: 1 1 auto;
	min-height: 0;
}

.card-item-main {
	min-height: 0;
	overflow: hidden;
	display: flex;
	flex-direction: column;
	justify-content: flex-start;
}

.card-item-header {
	margin-bottom: 2px;
}

.card-item-name {
	font-size: 0.88rem;
	font-weight: 700;
	margin: 0;
	line-height: 1.18;
	color: #0f172a;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
}

.card-item-code {
	font-size: 0.73rem;
	font-weight: 600;
	color: #6b7d97;
	display: block;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.card-item-unavailable-reason {
	font-size: 0.75rem;
	color: #c24141;
	margin-bottom: 0;
	line-height: 1.2;
	overflow: hidden;
	display: -webkit-box;
	-webkit-line-clamp: 2;
	line-clamp: 2;
	-webkit-box-orient: vertical;
}

.card-item-details {
	display: flex;
	justify-content: space-between;
	align-items: flex-end;
	gap: 4px;
	min-height: 30px;
	margin-top: auto;
}

.card-item-price {
	display: flex;
	flex-direction: column;
	gap: 2px;
	min-height: 28px;
	justify-content: flex-end;
	flex-shrink: 0;
}

.primary-price {
	font-size: 0.96rem;
	font-weight: 800;
	color: #0b63d1;
	line-height: 1;
	font-variant-numeric: tabular-nums;
	white-space: nowrap;
	display: inline-flex;
	align-items: baseline;
	gap: 2px;
}

.secondary-price {
	font-size: 0.79rem;
	color: #6b7d97;
	font-variant-numeric: tabular-nums;
}

.last-rate-chip {
	margin-top: 3px;
	font-size: 0.72rem;
	color: #516579;
	background: #f3f7fd;
	padding: 3px 7px;
	border-radius: 999px;
	display: inline-flex;
	align-items: center;
	width: fit-content;
	border: 1px solid #d8e5f7;
	max-width: 100%;
}

.v-theme--dark .last-rate-chip {
	color: #d6e3f5;
}

.last-rate-value {
	margin-left: 4px;
	font-weight: 600;
}

.card-item-stock {
	font-size: 0.72rem;
	color: #64748b;
	display: flex;
	flex-direction: row;
	align-items: center;
	gap: 4px;
	padding: 4px 7px;
	border-radius: 999px;
	background: #f7f9fc;
	border: 1px solid #e2e8f0;
	max-width: fit-content;
	margin-left: auto;
}

.stock-amount {
	font-weight: 700;
	color: #334155;
}

.stock-amount.negative-number {
	color: #c24141;
}

.stock-uom {
	font-size: 0.69rem;
	text-transform: uppercase;
	letter-spacing: 0.04em;
}

@media (max-width: 768px) {
	.card-item-image-container {
		height: 92px;
	}

	.card-item-content {
		padding: 8px 8px 7px;
	}

	.card-item-name {
		font-size: 0.84rem;
	}

	.card-item-code {
		font-size: 0.68rem;
	}
}
</style>
