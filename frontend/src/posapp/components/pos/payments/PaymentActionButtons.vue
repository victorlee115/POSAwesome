<template>
	<div class="payment-action-dock">
		<v-row align="start" no-gutters class="payment-action-grid">
			<v-col cols="12">
				<v-btn
					ref="primaryButton"
					block
					size="large"
					data-test="charge-btn"
					class="payment-submit-btn payment-submit-btn--primary"
					@click="$emit(alwaysPrint ? 'submit-and-print' : 'submit')"
					:loading="loading"
					:disabled="loading || validatePayment || !isValid"
					:class="{ 'submit-highlight': highlightSubmit }"
				>
					{{ resolvedChargeLabel }}
				</v-btn>
			</v-col>
			<v-col cols="12" class="mt-3 text-center">
				<button
					type="button"
					data-test="cancel-payment-btn"
					class="cancel-link"
					@click="confirmCancelVisible = true"
				>
					{{ __("Cancel Payment") }}
				</button>
			</v-col>
		</v-row>

		<v-dialog v-model="confirmCancelVisible" max-width="340" persistent>
			<v-card rounded="xl">
				<v-card-title class="pt-5 px-5 text-h6">{{ __("Cancel Payment?") }}</v-card-title>
				<v-card-text class="px-5 pb-2 text-medium-emphasis">
					{{ __("Payment will not be submitted. Return to cart?") }}
				</v-card-text>
				<v-card-actions class="px-5 pb-5" style="gap:8px">
					<v-btn variant="tonal" color="default" @click="confirmCancelVisible = false" block>
						{{ __("Keep Paying") }}
					</v-btn>
					<v-btn variant="flat" color="error" @click="doCancel" block data-test="confirm-cancel-payment-btn">
						{{ __("Yes, Cancel") }}
					</v-btn>
				</v-card-actions>
			</v-card>
		</v-dialog>
	</div>
</template>

<script setup>
import { computed, ref } from "vue";

const confirmCancelVisible = ref(false);

function doCancel() {
	confirmCancelVisible.value = false;
	emit("cancel");
}

const props = defineProps({
	loading: Boolean,
	validatePayment: Boolean,
	highlightSubmit: Boolean,
	isValid: {
		type: Boolean,
		default: true,
	},
	alwaysPrint: {
		type: Boolean,
		default: false,
	},
	primaryLabel: {
		type: String,
		default: "",
	},
	secondaryLabel: {
		type: String,
		default: "",
	},
});

const emit = defineEmits(["submit", "submit-and-print", "cancel"]);

const primaryButton = ref(null);

const resolvedChargeLabel = computed(() => {
	if (props.alwaysPrint) {
		return props.secondaryLabel || __("Charge & Print");
	}
	return props.primaryLabel || __("Charge");
});

const focusPrimaryButton = () => {
	if (!primaryButton.value) {
		return;
	}
	const btnEl = primaryButton.value.$el || primaryButton.value;
	if (btnEl && typeof btnEl.focus === "function") {
		btnEl.focus();
	}
};

defineExpose({
	focusPrimaryButton,
});

const __ = window.__;
</script>

<style scoped>
.payment-action-dock {
	padding-top: 4px;
}

.payment-action-grid {
	row-gap: 0;
}

.payment-submit-btn {
	min-height: 54px !important;
	border-radius: 14px !important;
	text-transform: none !important;
	font-weight: 800 !important;
	font-size: 1rem !important;
	letter-spacing: 0.01em !important;
}

.payment-submit-btn--primary {
	background: linear-gradient(135deg, #17995c, #12864f) !important;
	color: #ffffff !important;
	box-shadow: 0 8px 18px rgba(23, 153, 92, 0.28) !important;
}

.submit-highlight {
	box-shadow: 0 0 0 4px rgba(28, 122, 193, 0.24) !important;
	transition: box-shadow 0.25s ease;
}

.cancel-link {
	background: none;
	border: none;
	padding: 6px 12px;
	cursor: pointer;
	color: #c13737;
	font-size: 0.9rem;
	font-weight: 600;
	text-decoration: underline;
	text-underline-offset: 2px;
}

.cancel-link:hover {
	color: #a02e2e;
}
</style>
