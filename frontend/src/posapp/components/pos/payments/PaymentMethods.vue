<template>
	<div v-if="payments && payments.length" class="payment-methods-stack">
		<section
			v-for="payment in payments"
			:key="payment.name"
			class="payment-method-card"
			:class="paymentStateClass(payment)"
		>
			<template v-if="!isMpesaC2bPayment(payment)">
				<div class="payment-method-card__top">
					<div class="payment-method-field-wrap">
						<v-text-field
							density="compact"
							variant="solo"
							color="primary"
							:label="frappe._(payment.mode_of_payment)"
							class="sleek-field pos-themed-input payment-method-field"
							hide-details
							:model-value="formatCurrency(payment.amount)"
							@change="$emit('update-amount', payment, $event)"
							:rules="[isNumber]"
							:prefix="currencySymbol(currency)"
							@focus="handleInputFocus(payment)"
							:readonly="isReturn"
						></v-text-field>
					</div>
					<div class="payment-method-card__actions">
						<v-btn
							class="payment-method-btn payment-method-btn--primary"
							size="large"
							@click="handleFullAmount(payment)"
						>
							{{ frappe._("Pay Full") }}
						</v-btn>
						<v-btn
							class="payment-method-btn payment-method-btn--secondary"
							size="large"
							@click="handleRemainingAmount(payment)"
						>
							{{ frappe._("Remaining") }}
						</v-btn>
					</div>
				</div>

				<div
					v-if="
						payment.default === 1 &&
						isCashLikePayment(payment) &&
						getVisibleDenominations(payment).length
					"
					class="payment-method-denominations"
				>
					<v-btn
						v-for="d in getVisibleDenominations(payment)"
						:key="d"
						size="small"
						class="payment-denomination-btn"
						@click="handleDenomination(payment, d)"
					>
						{{ formatCurrency(d) }}
					</v-btn>
				</div>

				<div
					v-if="payment.type === 'Phone' && payment.amount > 0 && requestPaymentField"
					class="payment-method-card__request"
				>
					<v-btn
						class="payment-method-btn payment-method-btn--request"
						size="large"
						:disabled="payment.amount === 0"
						@click="$emit('request-payment', payment)"
					>
						{{ __("Request Payment") }}
					</v-btn>
				</div>
			</template>

			<template v-else>
				<div class="payment-method-card__mpesa">
					<v-btn
						class="payment-method-btn payment-method-btn--request"
						size="large"
						@click="$emit('mpesa-dialog', payment)"
					>
						{{ __("Get Payments") }} {{ payment.mode_of_payment }}
					</v-btn>
				</div>
			</template>
		</section>
	</div>
</template>

<script setup>
defineProps({
	payments: Array,
	currency: String,
	isReturn: Boolean,
	requestPaymentField: Boolean,
	currencySymbol: Function,
	formatCurrency: Function,
	isNumber: Function,
	getVisibleDenominations: Function,
	isCashLikePayment: Function,
	isMpesaC2bPayment: Function,
});

const emit = defineEmits([
	"update-amount",
	"set-full-amount",
	"set-denomination",
	"mpesa-dialog",
	"request-payment",
	"set-rest-amount",
	"focus-invalid-payment",
	"quick-fill-method",
]);

const paymentStateClass = (payment) => {
	const amount = parseFloat(String(payment?.amount ?? 0).replace(/,/g, "")) || 0;
	if (amount > 0) {
		return "payment-method-card--active";
	}
	return "payment-method-card--idle";
};

const handleInputFocus = (payment) => {
	emit("set-rest-amount", payment);
	emit("focus-invalid-payment", payment);
};

const handleFullAmount = (payment) => {
	emit("quick-fill-method", { payment, mode: "full" });
	emit("set-full-amount", payment);
};

const handleRemainingAmount = (payment) => {
	emit("quick-fill-method", { payment, mode: "remaining" });
	emit("set-rest-amount", payment);
};

const handleDenomination = (payment, amount) => {
	emit("quick-fill-method", { payment, mode: "denomination", amount });
	emit("set-denomination", payment, amount);
};

const frappe = window.frappe;
const __ = window.__;
</script>

<style scoped>
.payment-methods-stack {
	display: grid;
	gap: 12px;
}

.payment-method-card {
	display: grid;
	gap: 8px;
	padding: 12px;
	border-radius: 14px;
	border: 1px solid #d2dfed;
	background: #ffffff;
}

.payment-method-card--active {
	border-color: #86b2df;
	background: #f3f8ff;
}

.payment-method-card__top {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 8px;
	align-items: center;
}

.payment-method-field-wrap {
	min-width: 0;
}

.payment-method-card__actions {
	display: flex;
	gap: 8px;
	flex-wrap: wrap;
	justify-content: flex-end;
}

.payment-method-btn {
	min-height: 48px !important;
	padding-inline: 14px !important;
	border-radius: 12px !important;
	font-weight: 700 !important;
	text-transform: none !important;
	letter-spacing: 0.01em;
}

.payment-method-btn--primary {
	background: #0ea5c6 !important;
	color: #ffffff !important;
}

.payment-method-btn--secondary {
	background: #ecf3fd !important;
	border: 1px solid #c9d9ec !important;
	color: #1a3857 !important;
}

.payment-method-btn--request {
	background: #0f8a56 !important;
	color: #ffffff !important;
}

.payment-method-denominations {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.payment-denomination-btn {
	min-height: 52px !important;
	min-width: 72px !important;
	border-radius: 10px !important;
	padding-inline: 10px !important;
	background: #e8f8ff !important;
	color: #066b94 !important;
	border: 1px solid #b9dff1 !important;
	font-weight: 700 !important;
	font-size: 1rem !important;
	text-transform: none !important;
}

.payment-method-card__request,
.payment-method-card__mpesa {
	display: flex;
}

.payment-method-card__request .v-btn,
.payment-method-card__mpesa .v-btn {
	width: 100%;
}

@media (max-width: 1100px) {
	.payment-method-card__top {
		grid-template-columns: minmax(0, 1fr);
	}

	.payment-method-card__actions {
		justify-content: stretch;
	}

	.payment-method-card__actions .v-btn {
		flex: 1 1 calc(50% - 4px);
	}
}
</style>
