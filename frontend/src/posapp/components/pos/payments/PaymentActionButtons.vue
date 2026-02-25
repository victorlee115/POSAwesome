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
					@click="$emit('submit')"
					:loading="loading"
					:disabled="loading || validatePayment || !isValid"
					:class="{ 'submit-highlight': highlightSubmit }"
				>
					{{ resolvedPrimaryLabel }}
				</v-btn>
			</v-col>
			<v-col cols="12" class="mt-2">
				<v-btn
					block
					size="large"
					data-test="charge-print-btn"
					class="payment-submit-btn payment-submit-btn--secondary"
					@click="$emit('submit-and-print')"
					:loading="loading"
					:disabled="loading || validatePayment || !isValid"
				>
					{{ resolvedSecondaryLabel }}
				</v-btn>
			</v-col>
			<v-col cols="12" class="mt-2">
				<v-btn
					block
					size="large"
					data-test="cancel-payment-btn"
					class="payment-submit-btn payment-submit-btn--tertiary"
					@click="$emit('cancel')"
				>
					{{ __("Cancel Payment") }}
				</v-btn>
			</v-col>
		</v-row>
	</div>
</template>

<script setup>
import { computed, ref } from "vue";

const props = defineProps({
	loading: Boolean,
	validatePayment: Boolean,
	highlightSubmit: Boolean,
	isValid: {
		type: Boolean,
		default: true,
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

defineEmits(["submit", "submit-and-print", "cancel"]);

const primaryButton = ref(null);

const resolvedPrimaryLabel = computed(() => props.primaryLabel || __("Submit"));
const resolvedSecondaryLabel = computed(() => props.secondaryLabel || __("Submit & Print"));

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

.payment-submit-btn--secondary {
	background: #ffffff !important;
	border: 1px solid #c2d4e8 !important;
	color: #1a3353 !important;
}

.payment-submit-btn--tertiary {
	background: #fff3f3 !important;
	border: 1px solid #f0c8c8 !important;
	color: #c13737 !important;
}

.submit-highlight {
	box-shadow: 0 0 0 4px rgba(28, 122, 193, 0.24) !important;
	transition: box-shadow 0.25s ease;
}
</style>
