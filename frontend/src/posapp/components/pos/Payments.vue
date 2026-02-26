<!-- eslint-disable vue/multi-word-component-names -->
<template>
	<div class="pa-0 payments-screen">
		<v-card class="selection mx-auto pa-2 my-0 mt-3 pos-themed-card payments-shell">
			<v-progress-linear
				:active="loading"
				:indeterminate="loading"
				absolute
				location="top"
				color="info"
			></v-progress-linear>
			<div class="payments-layout">
				<div class="payments-header-sticky">
					<PaymentSummary
						:invoice_doc="invoice_doc"
						:total_payments_display="total_payments_display"
						:diff_payment_display="diff_payment_display"
						:diff_label="diff_label"
						:change_due="change_due"
						:paid_change="paid_change"
						:credit_change="credit_change"
						:paid_change_rules="paid_change_rules"
						:currencySymbol="currencySymbol"
						:formatCurrency="formatCurrency"
						@show-paid-amount="showPaidAmount"
						@show-diff-payment="showDiffPayment"
						@show-paid-change="showPaidChange"
						@update-credit-change="handleCreditChangeUpdate"
					/>
				</div>

				<div ref="paymentContainer" class="payments-body-scroll">
					<v-alert
						v-if="paymentInlineError"
						type="error"
						variant="tonal"
						density="comfortable"
						class="mb-2 payment-inline-error"
						icon="mdi-alert-circle-outline"
					>
						{{ paymentInlineError }}
					</v-alert>

					<section v-if="showCupNameInput" class="cup-name-prompt-zone">
						<div class="payments-section-heading">{{ __("Cup Label") }}</div>
						<v-text-field
							v-model="cup_label_customer_name"
							:label="__('Cup Label Name')"
							:counter="24"
							variant="outlined"
							density="comfortable"
							hide-details="auto"
							data-test="cup-label-name"
							:inputProps="{ style: 'font-size: 16px' }"
						/>
					</section>

					<section class="payments-quick-pay-zone">
						<div class="payments-section-heading">{{ __("Tender Methods") }}</div>
						<PaymentMethods
							v-if="is_cashback && invoice_doc"
							:payments="invoice_doc.payments"
							:currency="invoice_doc.currency"
							:isReturn="invoice_doc.is_return"
							:requestPaymentField="request_payment_field"
							:currencySymbol="currencySymbol"
							:formatCurrency="formatCurrency"
							:isNumber="isNumber"
							:getVisibleDenominations="getVisibleDenominations"
							:isCashLikePayment="isCashLikePayment"
							:isMpesaC2bPayment="is_mpesa_c2b_payment"
							@update-amount="handlePaymentAmountChange"
							@set-full-amount="handleSetFullAmount"
							@set-denomination="setPaymentToDenomination"
							@mpesa-dialog="mpesa_c2b_dialog"
							@request-payment="request_payment"
							@set-rest-amount="handleSetRestAmount"
							@focus-invalid-payment="clearPaymentInlineError"
							@quick-fill-method="handleQuickFillMethod"
						/>
					</section>

					<v-expansion-panels
						v-model="advancedPanels"
						multiple
						variant="accordion"
						class="payments-advanced-panels mt-3"
					>
						<v-expansion-panel :value="ADVANCED_PANEL.REDEMPTION">
							<v-expansion-panel-title>
								{{ __("Loyalty & Customer Credit") }}
							</v-expansion-panel-title>
							<v-expansion-panel-text class="payment-redemption-panel">
								<PaymentRedemption
									:invoice-doc="invoice_doc"
									:customer-info="customer_info"
									:pos-profile="pos_profile"
									:available-points-amount="available_points_amount"
									:loyalty-amount="loyalty_amount"
									:available-customer-credit="available_customer_credit"
									:redeem-customer-credit="redeem_customer_credit"
									:redeemed-customer-credit="redeemed_customer_credit"
									:format-currency="formatCurrency"
									:format-float="formatFloat"
									:currency-symbol="currencySymbol"
									@set-formatted-currency="
										(data) => setFormatedCurrency(null, data.field, null, false, data.value)
									"
								/>
								<PaymentCustomerCreditDetails
									:invoice-doc="invoice_doc"
									:available-customer-credit="available_customer_credit"
									:redeem-customer-credit="redeem_customer_credit"
									:customer-credit-dict="customer_credit_dict"
									:credit-source-label="creditSourceLabel"
									:format-currency="formatCurrency"
									:currency-symbol="currencySymbol"
									@set-formatted-currency="
										(data) => setFormatedCurrency(data.target, data.field, null, false, data.value)
									"
								/>
							</v-expansion-panel-text>
						</v-expansion-panel>

						<v-expansion-panel :value="ADVANCED_PANEL.TOTALS">
							<v-expansion-panel-title>
								{{ __("Invoice Totals Details") }}
							</v-expansion-panel-title>
							<v-expansion-panel-text>
								<InvoiceTotals
									:invoice_doc="invoice_doc"
									:displayCurrency="displayCurrency"
									:diff_payment="diff_payment"
									:diff_label="diff_label"
									:currencySymbol="currencySymbol"
									:formatCurrency="formatCurrency"
								/>
							</v-expansion-panel-text>
						</v-expansion-panel>

						<v-expansion-panel :value="ADVANCED_PANEL.OPTIONS">
							<v-expansion-panel-title>
								{{ __("Credit and Settlement Options") }}
							</v-expansion-panel-title>
							<v-expansion-panel-text class="payment-options-panel">
								<PaymentOptions
									:invoice-doc="invoice_doc"
									:pos-profile="pos_profile"
									:diff-payment="diff_payment"
									:credit-change="credit_change"
									:is-write-off-change="is_write_off_change"
									:is-credit-sale="is_credit_sale"
									:is-cashback="is_cashback"
									:is-credit-return="is_credit_return"
									:new-credit-due-date="new_credit_due_date"
									:credit-due-days="credit_due_days"
									:credit-due-presets="credit_due_presets"
									:redeem-customer-credit="redeem_customer_credit"
									@update:is-write-off-change="is_write_off_change = $event"
									@update:is-credit-sale="is_credit_sale = $event"
									@update:is-cashback="is_cashback = $event"
									@update:is-credit-return="is_credit_return = $event"
									@update:new-credit-due-date="
										(val) => {
											new_credit_due_date = val;
											update_credit_due_date();
										}
									"
									@update:credit-due-days="credit_due_days = $event"
									@apply-due-preset="applyDuePreset"
									@update:redeem-customer-credit="redeem_customer_credit = $event"
									@get-available-credit="get_available_credit"
								/>
							</v-expansion-panel-text>
						</v-expansion-panel>

						<v-expansion-panel :value="ADVANCED_PANEL.ADDITIONAL">
							<v-expansion-panel-title>
								{{ __("Additional Invoice Details") }}
							</v-expansion-panel-title>
							<v-expansion-panel-text class="payment-additional-panel">
									<PaymentAdditionalInfo
									:invoice-doc="invoice_doc"
									:pos-profile="pos_profile"
									:invoice-type="invoiceType"
									:return-validity-enabled="returnValidityEnabled"
									:return-validity-min-date="returnValidityMinDate"
									:addresses="addresses"
									:new-delivery-date="new_delivery_date"
									:return-valid-upto-date="return_valid_upto_date"
									:address-filter="addressFilter"
									@update:new-delivery-date="
										(val) => {
											new_delivery_date = val;
											update_delivery_date();
										}
									"
									@update:return-valid-upto-date="
										(val) => {
											return_valid_upto_date = val;
											updateReturnValidUpto();
										}
									"
									@new-address="new_address"
									/>
									<PaymentPurchaseOrder
										:invoice-doc="invoice_doc"
									:pos-profile="pos_profile"
									:new-po-date="new_po_date"
									@update:new-po-date="
										(val) => {
											new_po_date = val;
											update_po_date();
										}
									"
								/>
							</v-expansion-panel-text>
						</v-expansion-panel>

						<v-expansion-panel :value="ADVANCED_PANEL.PRINT">
							<v-expansion-panel-title>
								{{ __("Print and Sales Assignment") }}
							</v-expansion-panel-title>
							<v-expansion-panel-text>
								<PaymentSelectionFields
									:sales-persons="sales_persons"
									:sales-person="sales_person"
									:readonly="readonly"
									:print-formats="print_formats"
									:print-format="print_format"
									@update:sales-person="sales_person = $event"
									@update:print-format="print_format = $event"
								/>
							</v-expansion-panel-text>
						</v-expansion-panel>
					</v-expansion-panels>
				</div>

				<div class="payments-footer-dock">
					<PaymentActionButtons
						ref="submitButton"
						:loading="loading"
						:validatePayment="validatePayment"
						:is-valid="paymentFormValid"
						:highlightSubmit="highlightSubmit"
						:primary-label="primarySubmitLabel"
						:secondary-label="secondarySubmitLabel"
						:always-print="!!(pos_profile?.posa_always_print_receipt)"
						@submit="submit"
						@submit-and-print="submit(undefined, false, true)"
						@cancel="back_to_invoice"
					/>
				</div>
			</div>
		</v-card>
		<!-- Dialogs Section (Custom Days, Phone Payment) -->
		<PaymentDialogs
			:custom-days-dialog="custom_days_dialog"
			:custom-days-value="custom_days_value"
			:phone-dialog="phone_dialog"
			:invoice-doc="invoice_doc"
			@update:custom-days-dialog="custom_days_dialog = $event"
			@update:custom-days-value="custom_days_value = $event"
			@apply-custom-days="applyCustomDays"
			@update:phone-dialog="phone_dialog = $event"
			@request-payment="request_payment"
		/>
	</div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, getCurrentInstance, nextTick } from "vue";
import { storeToRefs } from "pinia";

// Stores
import { useInvoiceStore } from "../../stores/invoiceStore.js";
import { useCustomersStore } from "../../stores/customersStore.js";
import { useUIStore } from "../../stores/uiStore.js";
import { useToastStore } from "../../stores/toastStore.js";
import { useSyncStore } from "../../stores/syncStore.ts";

// Composables
import { usePaymentCalculations } from "../../composables/pos/payments/usePaymentCalculations";
import { usePaymentSubmission } from "../../composables/pos/payments/usePaymentSubmission";
import { useRedemptionLogic } from "../../composables/pos/payments/useRedemptionLogic";
import { usePaymentPrinting } from "../../composables/pos/payments/usePaymentPrinting";
import { usePaymentMethods } from "../../composables/pos/payments/usePaymentMethods";
import { useInvoiceDetails } from "../../composables/pos/invoice/useInvoiceDetails";
import { useResponsive } from "../../composables/core/useResponsive";
import { useFormat } from "../../format";
import { isOffline } from "../../../offline/index";
import { buildCupLabelJobs, getCupPrinterConfig, printCupJobs } from "../../services/cupLabelService";

// Components
import PaymentSummary from "./payments/PaymentSummary.vue";
import InvoiceTotals from "./payments/InvoiceTotals.vue";
import PaymentActionButtons from "./payments/PaymentActionButtons.vue";
import PaymentMethods from "./payments/PaymentMethods.vue";
import PaymentRedemption from "./payments/PaymentRedemption.vue";
import PaymentAdditionalInfo from "./payments/PaymentAdditionalInfo.vue";
import PaymentPurchaseOrder from "./payments/PaymentPurchaseOrder.vue";
import PaymentCustomerCreditDetails from "./payments/PaymentCustomerCreditDetails.vue";
import PaymentOptions from "./payments/PaymentOptions.vue";
import PaymentSelectionFields from "./payments/PaymentSelectionFields.vue";
import PaymentDialogs from "./payments/PaymentDialogs.vue";

const { proxy } = getCurrentInstance();
const eventBus = proxy.eventBus;
const __ = window.__;

const invoiceStore = useInvoiceStore();
const customersStore = useCustomersStore();
const uiStore = useUIStore();
const toastStore = useToastStore();
const syncStore = useSyncStore();
const { paymentLayoutMode } = useResponsive();

// Destructure format utilities
const {
	currency_precision,
	formatCurrency,
	formatFloat,
	currencySymbol,
	isNumber,
	flt,
	setFormatedCurrency,
} = useFormat();

const { selectedCustomer, customerInfo } = storeToRefs(customersStore);
const { activeView } = storeToRefs(uiStore);

// State
const is_return = ref(false);
const is_credit_sale = ref(false);
const is_write_off_change = ref(false);
const redeem_customer_credit = ref(false);
const pos_profile = ref("");
const stock_settings = ref("");
const pos_settings = ref({});
const invoiceType = ref("Invoice");
const is_cashback = ref(true);
const paid_change = ref(0);
const credit_change = ref(0);
const loading = ref(false);
const show_change_dialog = ref(false);
const sales_person = ref("");
const is_credit_return = ref(false);
const customer_info = ref("");
const print_format = ref("");
const print_formats = ref([]);
const paid_change_rules = ref([]);
const is_user_editing_paid_change = ref(false);
const highlightSubmit = ref(false);
const last_payment_change_was_cash = ref(null);
const backgroundStatusCheck = ref(null);
const paymentVisible = ref(false);
const paymentContainer = ref(null);
const submitButton = ref(null);
const _shortcutHandlers = ref({});
const readonly = ref(false); // Add missing readonly ref
const paymentInlineError = ref("");
const advancedPanels = ref([]);
const cup_label_customer_name = ref("");
const autoSyncQuickPay = ref(true);
const autoSyncPaymentKey = ref("");
const isAutoSyncingQuickPay = ref(false);

const CUP_NAME_MAX = 24;

const ADVANCED_PANEL = Object.freeze({
	REDEMPTION: 0,
	TOTALS: 1,
	OPTIONS: 2,
	ADDITIONAL: 3,
	PRINT: 4,
});

// Computed Properties
const invoice_doc = computed({
	get: () => invoiceStore.invoiceDoc || {},
	set: (value) => invoiceStore.setInvoiceDoc(value),
});

const displayCurrency = computed(() => (invoice_doc.value ? invoice_doc.value.currency : ""));

const validatePayment = computed(() => {
	const profile = pos_profile.value;
	if (!profile || !profile.posa_allow_sales_order) {
		return false;
	}
	if (invoiceType.value !== "Order") {
		return false;
	}
	const doc = invoice_doc.value;
	return !doc || !doc.posa_delivery_date;
});

const normalizeBoolean = (value) => {
	if (value === true || value === 1 || value === "1") return true;
	if (typeof value === "string") {
		const normalized = value.trim().toLowerCase();
		return normalized === "true" || normalized === "yes" || normalized === "on";
	}
	return false;
};

const normalizeBooleanWithDefault = (value, defaultValue = false) => {
	if (value === undefined || value === null || value === "") {
		return defaultValue;
	}
	return normalizeBoolean(value);
};

const sanitizeCupName = (value) =>
	String(value || "")
		.replace(/[^\x20-\x7E]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, CUP_NAME_MAX);

const normalizeCustomerValue = (value) => String(value || "").trim().toLowerCase();

const isWalkInToken = (value) =>
	/\b(walk[\s-]?in|cash|guest)\b/.test(normalizeCustomerValue(value));

const isPrepItem = (item) => {
	if (!item) return false;
	if (normalizeBoolean(item.posa_is_prep_item)) return true;
	const prepStatus = String(item.posa_prep_status || "").trim().toLowerCase();
	if (["paid", "in prep", "ready", "collected"].includes(prepStatus)) return true;
	return Boolean(
		item.posa_drink_code ||
			item.posa_modifiers_json ||
			item.posa_modifier_summary ||
			item.posa_modifier_signature ||
			Number(item.posa_modifiers_delta || 0),
	);
};

const resolveLiveCartItems = () => {
	const cartItems = Array.isArray(invoiceStore.items) ? invoiceStore.items : [];
	return cartItems.filter((item) => Boolean(item));
};

const hasCartItems = computed(() =>
	resolveLiveCartItems().some(
		(item) =>
			!item?.posa_is_replace &&
			Math.abs(flt(item?.qty || 0, currency_precision.value)) > 0,
	),
);

const resolveCurrentItems = () => {
	return resolveLiveCartItems();
};

const resolvePayableItems = () => {
	return resolveLiveCartItems().filter(
		(item) =>
			!item?.posa_is_replace &&
			Math.abs(flt(item?.qty || 0, currency_precision.value)) > 0,
	);
};

const syncPaymentDocumentTotalsFromCart = () => {
	const doc = invoice_doc.value;
	if (!doc) {
		return;
	}

	const precision = Math.max(currency_precision.value, 2);
	const epsilon = 1 / Math.pow(10, precision + 1);
	const liveCartItems = resolveCurrentItems();
	const payableItems = resolvePayableItems();
	const conversionRate = flt(doc.conversion_rate || 1, currency_precision.value) || 1;

	let liveNetTotal = flt(
		payableItems.reduce((sum, item) => {
			return (
				sum +
				flt(item?.qty || 0, currency_precision.value) * flt(item?.rate || 0, currency_precision.value)
			);
		}, 0),
		currency_precision.value,
	);

	const additionalDiscount = Math.abs(
		flt(
			invoiceStore.additionalDiscount ??
				doc.additional_discount_amount ??
				doc.discount_amount ??
				0,
			currency_precision.value,
		),
	);
	const deliveryCharges = flt(
		invoiceStore.deliveryChargesRate ?? doc.posa_delivery_charges_rate ?? 0,
		currency_precision.value,
	);
	liveNetTotal = flt(liveNetTotal - additionalDiscount + deliveryCharges, currency_precision.value);

	const previousNetTotal = flt(doc.total ?? doc.net_total ?? 0, currency_precision.value);
	const previousTaxTotal = flt(doc.total_taxes_and_charges || 0, currency_precision.value);
	let liveTaxTotal = previousTaxTotal;
	if (Math.abs(liveNetTotal) <= epsilon) {
		liveTaxTotal = 0;
	} else if (Math.abs(previousTaxTotal) > epsilon) {
		liveTaxTotal =
			Math.abs(previousNetTotal) > epsilon
				? flt((previousTaxTotal / previousNetTotal) * liveNetTotal, currency_precision.value)
				: 0;
	}

	let liveGrandTotal = flt(liveNetTotal + liveTaxTotal, currency_precision.value);
	const previousGrandTotal = flt(
		doc.grand_total ?? previousNetTotal + previousTaxTotal,
		currency_precision.value,
	);
	const previousRoundedTotal = flt(doc.rounded_total ?? previousGrandTotal, currency_precision.value);
	let roundingDelta = flt(previousRoundedTotal - previousGrandTotal, currency_precision.value);
	if (Math.abs(roundingDelta) <= epsilon) {
		roundingDelta = 0;
	}
	let liveRoundedTotal = flt(liveGrandTotal + roundingDelta, currency_precision.value);

	if (Math.abs(liveGrandTotal) <= epsilon) {
		liveNetTotal = 0;
		liveTaxTotal = 0;
		liveGrandTotal = 0;
		liveRoundedTotal = 0;
	}

	if (!doc.is_return && !is_credit_return.value) {
		liveNetTotal = Math.max(liveNetTotal, 0);
		liveTaxTotal = Math.max(liveTaxTotal, 0);
		liveGrandTotal = Math.max(liveGrandTotal, 0);
		liveRoundedTotal = Math.max(liveRoundedTotal, 0);
	}

	doc.items = liveCartItems.map((item) => ({ ...item }));
	doc.total = liveNetTotal;
	doc.net_total = liveNetTotal;
	doc.grand_total = liveGrandTotal;
	doc.rounded_total = liveRoundedTotal;
	doc.total_taxes_and_charges = liveTaxTotal;
	doc.base_total = flt(liveNetTotal * conversionRate, currency_precision.value);
	doc.base_net_total = flt(liveNetTotal * conversionRate, currency_precision.value);
	doc.base_grand_total = flt(liveGrandTotal * conversionRate, currency_precision.value);
	doc.base_rounded_total = flt(liveRoundedTotal * conversionRate, currency_precision.value);

	if (Array.isArray(doc.taxes)) {
		if (Math.abs(liveTaxTotal) <= epsilon) {
			doc.taxes = doc.taxes.map((tax) => ({
				...tax,
				tax_amount: 0,
				base_tax_amount: 0,
			}));
		} else if (Math.abs(previousTaxTotal) > epsilon) {
			const taxRatio = flt(liveTaxTotal / previousTaxTotal, currency_precision.value);
			doc.taxes = doc.taxes.map((tax) => {
				const sourceTax = flt(tax?.tax_amount || 0, currency_precision.value);
				const scaledTax = flt(sourceTax * taxRatio, currency_precision.value);
				return {
					...tax,
					tax_amount: scaledTax,
					base_tax_amount: flt(scaledTax * conversionRate, currency_precision.value),
				};
			});
		}
	}
};

const hasPrepItems = computed(() => {
	return resolveCurrentItems().some((item) => isPrepItem(item));
});

const cupLabelsEnabled = computed(() =>
	normalizeBooleanWithDefault(pos_profile.value?.posa_enable_cup_labels, true),
);

const isWalkInOrder = computed(() => {
	const invoiceCustomer = normalizeCustomerValue(
		invoice_doc.value?.customer || customer_info.value?.customer,
	);
	const invoiceCustomerName = normalizeCustomerValue(
		invoice_doc.value?.customer_name || customer_info.value?.customer_name,
	);
	const selectedCustomerName = normalizeCustomerValue(selectedCustomer.value);
	const profileWalkInCustomer = normalizeCustomerValue(pos_profile.value?.customer);

	if (
		profileWalkInCustomer &&
		(invoiceCustomer === profileWalkInCustomer ||
			selectedCustomerName === profileWalkInCustomer)
	) {
		return true;
	}

	if (
		isWalkInToken(invoiceCustomer) ||
		isWalkInToken(invoiceCustomerName) ||
		isWalkInToken(selectedCustomerName)
	) {
		return true;
	}

	// If no explicit customer is attached, treat it as walk-in mode.
	return !invoiceCustomer && !selectedCustomerName;
});

const shouldPromptCupName = computed(
	() => cupLabelsEnabled.value && hasPrepItems.value && isWalkInOrder.value,
);

const cupNameRequired = computed(
	() =>
		shouldPromptCupName.value &&
		normalizeBooleanWithDefault(pos_profile.value?.posa_require_cup_customer_name, true),
);

const showCupNameInput = computed(() => shouldPromptCupName.value);

const hasAnySettlement = computed(() => {
	const doc = invoice_doc.value;
	if (!doc) {
		return false;
	}

	if (doc.is_return || is_credit_sale.value) {
		return true;
	}

	const invoiceTotal = flt(doc.rounded_total || doc.grand_total || 0, currency_precision.value);
	if (invoiceTotal <= 0) {
		return true;
	}

	const hasPaymentAmount = Array.isArray(doc.payments)
		? doc.payments.some((payment) => Math.abs(flt(payment?.amount || 0, currency_precision.value)) > 0)
		: false;
	const hasRedemptionAmount =
		Math.abs(flt(loyalty_amount.value || 0, currency_precision.value)) > 0 ||
		Math.abs(flt(redeemed_customer_credit.value || 0, currency_precision.value)) > 0;

	return hasPaymentAmount || hasRedemptionAmount;
});

const paymentFormValid = computed(() => {
	return hasCartItems.value && !validatePayment.value && hasAnySettlement.value;
});

const primarySubmitLabel = computed(() => {
	if (paymentLayoutMode.value === "desktop_fullpay") {
		return __("Submit");
	}

	const dueAmount = Math.max(flt(diff_payment.value || 0, currency_precision.value), 0);
	if (dueAmount > 0) {
		return __("Charge {0}", [formatCurrency(dueAmount)]);
	}
	return __("Charge");
});

const secondarySubmitLabel = computed(() => {
	return paymentLayoutMode.value === "desktop_fullpay" ? __("Submit & Print") : __("Charge & Print");
});

const request_payment_field = computed(() => {
	return (
		pos_settings.value?.invoice_fields?.some(
			(el) => el.fieldtype === "Button" && el.fieldname === "request_for_payment",
		) || false
	);
});

const returnValidityEnabled = computed(() => {
	return Boolean(
		pos_profile.value?.posa_enable_return_validity || pos_settings.value?.posa_enable_return_validity,
	);
});

const returnValidityMinDate = computed(() => {
	const postingDate = invoice_doc.value?.posting_date || frappe.datetime?.nowdate?.();
	if (!postingDate) {
		return new Date();
	}
	const parsed = new Date(postingDate);
	if (Number.isNaN(parsed.getTime())) {
		return new Date();
	}
	return parsed;
});

// Logic Composables
const {
	loyalty_amount,
	redeemed_customer_credit,
	customer_credit_dict,
	available_customer_credit,
	available_points_amount,
	get_available_credit,
} = useRedemptionLogic({
	invoiceDoc: computed(() => invoiceStore.invoiceDoc),
	posProfile: pos_profile,
	currencyPrecision: currency_precision,
	formatFloat: (val, prec) => flt(val, prec),
	stores: { toastStore },
	onClearAmounts: () => {},
});

const { loadPrintPage, printOfflineInvoice } = usePaymentPrinting({
	invoiceDoc: computed(() => invoiceStore.invoiceDoc),
	posProfile: pos_profile,
	invoiceType: invoiceType,
	printFormat: print_format,
});

const paymentCalculations = usePaymentCalculations({
	invoiceDoc: computed(() => invoiceStore.invoiceDoc),
	posProfile: pos_profile,
	currencyPrecision: currency_precision,
	loyaltyAmount: loyalty_amount,
	redeemedCustomerCredit: redeemed_customer_credit,
	customerCreditDict: customer_credit_dict,
	customerInfo: customer_info,
	formatCurrency: (val, _curr) => formatCurrency(val, currency_precision.value),
});

const { diff_payment, total_payments, total_payments_display, diff_payment_display, diff_label, change_due } =
	paymentCalculations;

const {
	phone_dialog,
	get_mpesa_modes,
	is_mpesa_c2b_payment,
	mpesa_c2b_dialog,
	set_mpesa_payment,
	set_full_amount,
	set_rest_amount,
	request_payment,
	autoBalancePayments,
	getVisibleDenominations,
	isCashLikePayment,
} = usePaymentMethods({
	invoiceDoc: computed(() => invoiceStore.invoiceDoc),
	posProfile: pos_profile,
	diffPayment: diff_payment,
	formatFloat: (val) => flt(val, currency_precision.value),
	stores: {
		toastStore,
		uiStore,
	},
	eventBus: eventBus,
	onSubmit: (_args, submitPrint) => {
		submit(null, false, !!submitPrint);
	},
	setRedeemCustomerCredit: (val) => {
		redeem_customer_credit.value = val;
	},
	customerCreditDict: customer_credit_dict,
	redeemedCustomerCredit: redeemed_customer_credit,
	isCashback: is_cashback,
	getTotalChange: () => Math.max(-diff_payment.value, 0),
	getPaidChange: () => paid_change.value,
	getCreditChange: () => credit_change.value,
	onBackToInvoice: () => eventBus.emit("change_active_view", "Invoice"),
});

const {
	addresses,
	sales_persons,
	new_delivery_date,
	new_po_date,
	new_credit_due_date,
	credit_due_days,
	credit_due_presets,
	custom_days_dialog,
	custom_days_value,
	return_valid_upto_date,
	get_addresses,
	new_address,
	addressFilter,
	normalizeAddress,
	get_sales_person_names,
	update_delivery_date,
	update_po_date,
	update_credit_due_date,
	applyDuePreset,
	applyCustomDays,
	initializeReturnValidity,
	updateReturnValidUpto,
	formatDateDisplay,
} = useInvoiceDetails({
	invoiceDoc: computed(() => invoiceStore.invoiceDoc),
	posProfile: pos_profile,
	invoiceType: invoiceType,
	posSettings: pos_settings,
	stores: {
		toastStore,
		invoiceStore,
	},
	eventBus: eventBus,
});

const { ensureReturnPaymentsAreNegative, validateSubmission, submitInvoice } = usePaymentSubmission({
	invoiceDoc: computed(() => invoiceStore.invoiceDoc),
	posProfile: pos_profile,
	stockSettings: stock_settings,
	invoiceType: invoiceType,
	is_write_off_change: is_write_off_change,
	isCashback: is_cashback,
	paidChange: paid_change,
	creditChange: credit_change,
	redeemedCustomerCredit: redeemed_customer_credit,
	customerCreditDict: customer_credit_dict,
	diff_payment: diff_payment,
	is_credit_sale: is_credit_sale,
	loyaltyAmount: loyalty_amount,
	formatFloat: (val, prec) => flt(val, prec),
	stores: {
		toastStore,
		syncStore,
		customersStore,
		uiStore,
		invoiceStore,
	},
	currencyPrecision: currency_precision,
});

// Methods

const get_print_formats = () => {
	frappe.call({
		method: "posawesome.posawesome.api.print_formats.get_print_formats",
		args: { doctype: "Sales Invoice" },
		callback: (r) => {
			const formats = r.message || [];
			print_formats.value = formats.map((pf) => (typeof pf === "object" && pf.name ? pf.name : pf));
		},
	});
};

const set_print_format = () => {
	print_format.value = "";
	if (pos_profile.value.posa_print_format_rules && customer_info.value) {
		const rule = pos_profile.value.posa_print_format_rules.find(
			(r) => r.customer_group === customer_info.value.customer_group,
		);
		if (rule) {
			print_format.value = rule.print_format;
		}
	}
};

const back_to_invoice = () => {
	uiStore.setActiveView("items");
	nextTick(() => {
		uiStore.triggerItemSearchFocus();
	});
};

const finishSubmissionNavigation = (clearInvoice = false) => {
	const submittedType = invoiceType.value;
	back_to_invoice();
	if (clearInvoice) {
		addresses.value = [];
		if (eventBus && typeof eventBus.emit === "function") {
			eventBus.emit("clear_invoice");
		} else {
			invoiceStore.clear();
			invoiceStore.resetPostingDate();
		}

		if (submittedType === "Quotation") {
			invoiceType.value = "Invoice";
			if (eventBus && typeof eventBus.emit === "function") {
				eventBus.emit("reset_invoice_type_to_invoice");
			}
		}
	}
};

const handleShowPayment = () => {
	paymentVisible.value = true;
	paymentInlineError.value = "";
	autoSyncQuickPay.value = true;
	autoSyncPaymentKey.value = "";
	advancedPanels.value = [];
	if (showCupNameInput.value) {
		advancedPanels.value = [ADVANCED_PANEL.ADDITIONAL];
	}
	nextTick(() => {
		if (showCupNameInput.value && !sanitizeCupName(cup_label_customer_name.value)) {
			focusElementInPaymentPane("[data-test='cup-label-name'] input");
		}
		setTimeout(() => {
			const btn = submitButton.value;
			if (btn?.focusPrimaryButton) {
				btn.focusPrimaryButton();
				highlightSubmit.value = true;
				return;
			}
			const el = btn && btn.$el ? btn.$el : btn;
			if (el && typeof el.focus === "function") {
				el.focus();
				highlightSubmit.value = true;
			}
		}, 100);
	});
};

const handleCreditChangeUpdate = (value) => {
	setFormatedCurrency(credit_change, "value", null, false, value);
	updateCreditChange(credit_change.value);
};

const updateCreditChange = (rawValue) => {
	const changeLimit = Math.max(-diff_payment.value, 0);
	let requestedCredit = flt(Math.abs(rawValue) || 0, currency_precision.value);

	if (requestedCredit > changeLimit) {
		requestedCredit = changeLimit;
	}

	const remainingPaidChange = flt(changeLimit - requestedCredit, currency_precision.value);

	credit_change.value = requestedCredit;
	paid_change.value = remainingPaidChange;

	if (invoice_doc.value) {
		invoice_doc.value.credit_change = requestedCredit;
		invoice_doc.value.paid_change = remainingPaidChange;
	}
};

const handlePaymentAmountChange = (payment, event) => {
	clearPaymentInlineError();
	autoSyncQuickPay.value = false;
	autoSyncPaymentKey.value = "";
	last_payment_change_was_cash.value = isCashLikePayment(payment);
	setFormatedCurrency(payment, "amount", null, false, event);

	nextTick(() => {
		autoBalancePayments(payment);
	});
};

const setPaymentToDenomination = (payment, amount) => {
	clearPaymentInlineError();
	autoSyncQuickPay.value = false;
	autoSyncPaymentKey.value = "";
	payment.amount = amount;
	if (payment.base_amount !== undefined) {
		const conversion_rate = invoice_doc.value.conversion_rate || 1;
		payment.base_amount = flt(amount * conversion_rate, currency_precision.value);
	}
	last_payment_change_was_cash.value = isCashLikePayment(payment);
	nextTick(() => {
		autoBalancePayments(payment);
	});
};

const handleSetFullAmount = (payment) => {
	clearPaymentInlineError();
	autoSyncQuickPay.value = true;
	autoSyncPaymentKey.value = resolvePaymentKey(payment);
	set_full_amount(payment);
};

const handleSetRestAmount = (payment) => {
	clearPaymentInlineError();
	autoSyncQuickPay.value = false;
	autoSyncPaymentKey.value = "";
	set_rest_amount(payment);
};

const handleQuickFillMethod = ({ payment, mode }) => {
	clearPaymentInlineError();
	if (mode === "full") {
		autoSyncQuickPay.value = true;
		autoSyncPaymentKey.value = resolvePaymentKey(payment);
		return;
	}
	autoSyncQuickPay.value = false;
	autoSyncPaymentKey.value = "";
};

const clearPaymentInlineError = () => {
	paymentInlineError.value = "";
};

const ensureAdvancedPanelExpanded = (panelValue) => {
	if (!advancedPanels.value.includes(panelValue)) {
		advancedPanels.value = [...advancedPanels.value, panelValue];
	}
};

const focusElementInPaymentPane = (selector, panelValue = null) => {
	if (panelValue !== null) {
		ensureAdvancedPanelExpanded(panelValue);
	}
	nextTick(() => {
		const target = paymentContainer.value?.querySelector(selector);
		if (!target) {
			return;
		}
		if (typeof target.focus === "function") {
			target.focus();
		}
		if (typeof target.scrollIntoView === "function") {
			target.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	});
};

const routePaymentValidationError = (message) => {
	const normalized = String(message || "").toLowerCase();
	paymentInlineError.value = message || __("Please review payment details.");

	if (
		normalized.includes("enter payment amount") ||
		normalized.includes("amount paid is not complete") ||
		normalized.includes("cash payment cannot be less")
	) {
		focusElementInPaymentPane(".payment-method-field input");
		return;
	}

	if (
		normalized.includes("credit") ||
		normalized.includes("loyalty") ||
		normalized.includes("redeem")
	) {
		focusElementInPaymentPane(".payment-redemption-panel input", ADVANCED_PANEL.REDEMPTION);
		return;
	}

	if (
		normalized.includes("write off") ||
		normalized.includes("change calculation") ||
		normalized.includes("partial payment")
	) {
		focusElementInPaymentPane(".payment-options-panel input", ADVANCED_PANEL.OPTIONS);
		return;
	}

	if (normalized.includes("delivery") || normalized.includes("due date")) {
		focusElementInPaymentPane(".payment-additional-panel input", ADVANCED_PANEL.ADDITIONAL);
		return;
	}

	if (normalized.includes("cup label name")) {
		focusElementInPaymentPane("[data-test='cup-label-name'] input");
		return;
	}

	focusElementInPaymentPane(".payment-method-field input");
};

const validateCupName = () => {
	if (!showCupNameInput.value) {
		return true;
	}

	const sanitized = sanitizeCupName(cup_label_customer_name.value);
	cup_label_customer_name.value = sanitized;
	if (invoice_doc.value) {
		invoice_doc.value.posa_cup_customer_name = sanitized;
	}

	if (cupNameRequired.value && !sanitized) {
		throw new Error(__("Cup Label Name is required for prep items"));
	}
	return true;
};

const attemptCupLabelPrint = async () => {
	if (!invoice_doc.value || !hasPrepItems.value) {
		return;
	}

	const prepItems = resolveCurrentItems();
	if (prepItems.length) {
		const existingItems = Array.isArray(invoice_doc.value.items) ? invoice_doc.value.items : [];
		const docHasPrepItems = existingItems.some((item) => isPrepItem(item));
		if (!docHasPrepItems) {
			invoice_doc.value.items = prepItems.map((item) => ({ ...item }));
		}
	}

	prefillCupNameIfNeeded();
	const effectiveCupName = sanitizeCupName(
		cup_label_customer_name.value ||
			invoice_doc.value.posa_cup_customer_name ||
			customer_info.value?.customer_name ||
			invoice_doc.value?.customer_name ||
			"",
	);
	cup_label_customer_name.value = effectiveCupName;
	invoice_doc.value.posa_cup_customer_name = effectiveCupName;

	try {
		// Build jobs first so order token and label identity are persisted on the invoice doc.
		const jobs = buildCupLabelJobs(invoice_doc.value, pos_profile.value || {});
		if (!jobs.length) {
			return;
		}

		const printer = getCupPrinterConfig(pos_profile.value || {});
		if (!printer.enabled) {
			return;
		}

		const result = printCupJobs(jobs, printer);
		if (!result.ok) {
			const reason = result.failures[0]?.reason || __("Failed to send cup labels");
			toastStore.show({
				title: __("Cup label print warning"),
				detail: reason,
				color: "warning",
			});
		}
	} catch (error) {
		toastStore.show({
			title: __("Cup label print warning"),
			detail: error?.message || __("Failed to send cup labels"),
			color: "warning",
		});
	}
};

const prefillCupNameIfNeeded = () => {
	if (!hasPrepItems.value || !invoice_doc.value) {
		return;
	}

	const existing = sanitizeCupName(
		cup_label_customer_name.value || invoice_doc.value.posa_cup_customer_name,
	);

	if (isWalkInOrder.value) {
		const normalizedExisting = normalizeCustomerValue(existing);
		const walkInReferenceNames = new Set(
			[
				invoice_doc.value?.customer,
				invoice_doc.value?.customer_name,
				customer_info.value?.customer,
				customer_info.value?.customer_name,
				selectedCustomer.value,
				pos_profile.value?.customer,
			]
				.map((value) => normalizeCustomerValue(value))
				.filter(Boolean),
		);
		const isGenericWalkInName =
			!normalizedExisting ||
			isWalkInToken(normalizedExisting) ||
			walkInReferenceNames.has(normalizedExisting);
		if (!isGenericWalkInName) {
			cup_label_customer_name.value = existing;
			invoice_doc.value.posa_cup_customer_name = existing;
			return;
		}
		cup_label_customer_name.value = "";
		invoice_doc.value.posa_cup_customer_name = "";
		return;
	}

	if (existing) {
		cup_label_customer_name.value = existing;
		invoice_doc.value.posa_cup_customer_name = existing;
		return;
	}

	const fallbackSource =
		customer_info.value?.customer_name ||
		invoice_doc.value?.customer_name ||
		invoice_doc.value?.customer ||
		"";
	const fallback = sanitizeCupName(fallbackSource);
	if (!fallback) {
		return;
	}
	cup_label_customer_name.value = fallback;
	invoice_doc.value.posa_cup_customer_name = fallback;
};

// UI Feedback Methods
const showPaidAmount = () => {
	toastStore.show({
		title: `Total Paid Amount: ${formatCurrency(total_payments.value)}`,
		color: "info",
	});
};

const creditSourceLabel = (row) => {
	if (!row) return "";
	const sourceLabel = row.source_type ? __(row.source_type) : null;
	if (sourceLabel) return `${sourceLabel}: ${row.credit_origin}`;
	return row.credit_origin;
};

const showDiffPayment = () => {
	if (!invoice_doc.value) return;
	toastStore.show({
		title: `To Be Paid: ${formatCurrency(
			diff_payment.value < 0 ? -diff_payment.value : diff_payment.value,
		)}`,
		color: "info",
	});
};

const showPaidChange = () => {
	toastStore.show({
		title: `Paid Change: ${formatCurrency(paid_change.value)}`,
		color: "info",
	});
};

const resolvePaymentKey = (payment) => {
	return String(
		payment?.name ||
			payment?.mode_of_payment ||
			payment?.account ||
			"",
	);
};

const resolveAutoSyncPayment = (payments) => {
	if (!Array.isArray(payments) || !payments.length) {
		return null;
	}

	if (autoSyncPaymentKey.value) {
		const target = payments.find((payment) => resolvePaymentKey(payment) === autoSyncPaymentKey.value);
		if (target) {
			return target;
		}
	}

	return payments.find((payment) => payment?.default === 1) || payments[0];
};

const syncQuickPayAmountsToInvoiceTotal = () => {
	if (isAutoSyncingQuickPay.value || !autoSyncQuickPay.value) {
		return;
	}

	const doc = invoice_doc.value;
	const payments = Array.isArray(doc?.payments) ? doc.payments : [];
	if (!doc || !payments.length || doc.is_return || is_credit_sale.value || is_credit_return.value) {
		return;
	}

	const precision = Math.max(currency_precision.value, 2);
	const epsilon = 1 / Math.pow(10, precision + 1);
	const invoiceTotal = Math.max(
		flt(doc.rounded_total || doc.grand_total || 0, currency_precision.value),
		0,
	);

	if (invoiceTotal <= epsilon || !hasCartItems.value) {
		const hasPositiveSettlement = payments.some((payment) => {
			const amount = Math.abs(flt(payment?.amount || 0, currency_precision.value));
			const baseAmount = Math.abs(flt(payment?.base_amount || 0, currency_precision.value));
			return amount > epsilon || baseAmount > epsilon;
		});
		if (!hasPositiveSettlement) {
			return;
		}
		isAutoSyncingQuickPay.value = true;
		try {
			payments.forEach((payment) => {
				payment.amount = 0;
				if (payment.base_amount !== undefined) {
					payment.base_amount = 0;
				}
			});
		} finally {
			isAutoSyncingQuickPay.value = false;
		}
		autoSyncPaymentKey.value = "";
		return;
	}

	const targetPayment = resolveAutoSyncPayment(payments);
	if (!targetPayment) {
		return;
	}

	autoSyncPaymentKey.value = resolvePaymentKey(targetPayment);

	const conversionRate = flt(doc.conversion_rate || 1, currency_precision.value) || 1;
	const loyaltySettled = Math.max(flt(loyalty_amount.value || 0, currency_precision.value), 0);
	const creditSettled = Math.max(
		flt(redeemed_customer_credit.value || 0, currency_precision.value),
		0,
	);

	const otherPaymentsTotal = payments.reduce((sum, payment) => {
		if (payment === targetPayment) {
			return sum;
		}
		return sum + Math.max(flt(payment?.amount || 0, currency_precision.value), 0);
	}, 0);

	const needsOtherReset = payments.some(
		(payment) =>
			payment !== targetPayment &&
			Math.abs(flt(payment?.amount || 0, currency_precision.value)) > epsilon,
	);

	// When other payments will be zeroed (needsOtherReset), don't subtract their
	// stale amounts from targetAmount — the target should cover the full remaining balance.
	const effectiveOtherTotal = needsOtherReset ? 0 : otherPaymentsTotal;

	let targetAmount = flt(
		invoiceTotal - loyaltySettled - creditSettled - effectiveOtherTotal,
		currency_precision.value,
	);
	if (targetAmount < 0) {
		targetAmount = 0;
	}

	const currentAmount = flt(targetPayment.amount || 0, currency_precision.value);
	const needsTargetUpdate = Math.abs(currentAmount - targetAmount) > epsilon;

	if (!needsTargetUpdate && !needsOtherReset) {
		return;
	}

	isAutoSyncingQuickPay.value = true;
	try {
		payments.forEach((payment) => {
			if (payment === targetPayment) {
				return;
			}
			payment.amount = 0;
			if (payment.base_amount !== undefined) {
				payment.base_amount = 0;
			}
		});

		targetPayment.amount = targetAmount;
		if (targetPayment.base_amount !== undefined) {
			targetPayment.base_amount = flt(targetAmount * conversionRate, currency_precision.value);
		}
	} finally {
		isAutoSyncingQuickPay.value = false;
	}
};

// Background Check
const clearBackgroundStatusCheck = () => {
	if (backgroundStatusCheck.value) {
		clearTimeout(backgroundStatusCheck.value);
		backgroundStatusCheck.value = null;
	}
};

const scheduleBackgroundStatusCheck = (invoiceName, doctype) => {
	clearBackgroundStatusCheck();
	if (!pos_profile.value?.posa_allow_submissions_in_background_job) {
		return;
	}
	if (!invoiceName) {
		return;
	}
	backgroundStatusCheck.value = setTimeout(async () => {
		try {
			const result = await frappe.call({
				method: "frappe.client.get_value",
				args: {
					doctype: doctype || invoice_doc.value?.doctype || "Sales Invoice",
					filters: { name: invoiceName },
					fieldname: ["docstatus"],
				},
			});
			const status = result?.message?.docstatus;
			if (status === 1) {
				return;
			}
			const reason = __("Invoice is still in draft after background submission.");
			if (eventBus && typeof eventBus.emit === "function") {
				eventBus.emit("invoice_submission_failed", {
					invoice: invoiceName,
					reason,
				});
			}
			toastStore.show({
				title: __("Error submitting invoice: {0}", [invoiceName]),
				color: "error",
				detail: reason,
			});
		} catch (err) {
			console.error("Background status check failed", err);
		} finally {
			clearBackgroundStatusCheck();
		}
	}, 10000);
};

// Submission Wrapper
const submit = async (_event, payment_received = false, print = false) => {
	loading.value = true;
	try {
		clearPaymentInlineError();
		if (!hasCartItems.value) {
			throw new Error(__("Cart is empty. Add at least one item before charging."));
		}
		await validateSubmission(payment_received);
		validateCupName();
		await attemptCupLabelPrint();
		await submitInvoiceWrapper(print);
	} catch (error) {
		console.error("Submission error:", error);
		if (error.message) {
			routePaymentValidationError(error.message);
			toastStore.show({
				title: error.message,
				color: "error",
			});
			frappe.utils.play_sound("error");
		}
	} finally {
		loading.value = false;
	}
};

const submitInvoiceWrapper = async (print) => {
	loading.value = true;
	try {
		await submitInvoice(print, {
			onPrint: (doc) => {
				if (print) {
					if (isOffline()) {
						printOfflineInvoice(doc);
					} else {
						loadPrintPage();
					}
				}
			},
				onSuccess: () => {
					clearPaymentInlineError();
					customer_credit_dict.value = [];
					redeem_customer_credit.value = false;
					is_cashback.value = true;
					show_change_dialog.value = true;
					is_credit_return.value = false;
					sales_person.value = "";
					cup_label_customer_name.value = "";
				},
			onFinishNavigation: (clearInvoice) => {
				finishSubmissionNavigation(clearInvoice);
			},
			onScheduleBackgroundCheck: (name, doctype) => {
				scheduleBackgroundStatusCheck(name, doctype);
			},
		});
	} catch (error) {
		console.error("Submission failed propagate:", error);
	} finally {
		loading.value = false;
	}
};

// Keyboard Shortcuts
const handlePaymentShortcut = (event) => {
	if (!paymentVisible.value) return;

	const isAltOnly = event.altKey && !event.ctrlKey && !event.metaKey;
	const key = event.key.toLowerCase();

	if (isAltOnly && key === "p") {
		event.preventDefault();
		event.stopPropagation();
		submit(null, false, true);
		return;
	}

	if ((isAltOnly || event.ctrlKey || event.metaKey) && key === "x") {
		event.preventDefault();
		event.stopPropagation();
		submit(null, false, false);
	}
};

const handleSubmitPaymentShortcut = ({ print = false } = {}) => {
	if (!paymentVisible.value) return;
	nextTick(() => {
		submit(null, false, print);
	});
};

const resetPaymentStateAfterCartEmpty = () => {
	if (Array.isArray(invoice_doc.value?.payments)) {
		invoice_doc.value.payments.forEach((payment) => {
			payment.amount = 0;
			if (payment.base_amount !== undefined) {
				payment.base_amount = 0;
			}
		});
	}
	paid_change.value = 0;
	credit_change.value = 0;
	loyalty_amount.value = 0;
	redeemed_customer_credit.value = 0;
	redeem_customer_credit.value = false;
	customer_credit_dict.value = [];
	is_credit_sale.value = false;
	is_write_off_change.value = false;
	is_cashback.value = true;
	is_credit_return.value = false;
	autoSyncQuickPay.value = true;
	autoSyncPaymentKey.value = "";
	cup_label_customer_name.value = "";
	if (invoice_doc.value) {
		invoice_doc.value.paid_change = 0;
		invoice_doc.value.credit_change = 0;
		invoice_doc.value.posa_cup_customer_name = "";
	}
};

// Watchers
watch(
	() => uiStore.posProfile,
	(p) => {
		if (p) {
			pos_profile.value = p;
			stock_settings.value = uiStore.stockSettings || {};
			get_mpesa_modes();
			get_print_formats();
		}
	},
	{ immediate: true },
);

watch(diff_payment, (newVal) => {
	if (is_user_editing_paid_change.value) return;

	const lastEditWasCash = last_payment_change_was_cash.value;

	if (newVal < 0) {
		const changeDue = -newVal;
		if (lastEditWasCash === false) {
			paid_change.value = flt(changeDue, currency_precision.value);
			credit_change.value = 0;
		} else {
			paid_change.value = changeDue;
		}
	} else {
		updateCreditChange(0);
	}

	last_payment_change_was_cash.value = null;
});

watch(paid_change, (newVal) => {
	const changeLimit = Math.max(-diff_payment.value, 0);
	if (newVal > changeLimit) {
		paid_change.value = changeLimit;
		credit_change.value = 0;
		paid_change_rules.value = ["Paid change can not be greater than total change!"];
	} else {
		paid_change_rules.value = [];
		credit_change.value = flt(changeLimit - newVal, currency_precision.value);
	}

	const effectivePaid = Math.min(paid_change.value, changeLimit);
	const creditAmount = flt(changeLimit - effectivePaid, currency_precision.value);

	if (invoice_doc.value) {
		invoice_doc.value.paid_change = effectivePaid;
		invoice_doc.value.credit_change = creditAmount > 0 ? creditAmount : 0;
	}
});

watch(loyalty_amount, (value) => {
	if (!invoice_doc.value) return;
	const amount = parseFloat(value) || 0;
	if (amount > available_points_amount.value + 0.001) {
		invoice_doc.value.loyalty_amount = 0;
		invoice_doc.value.redeem_loyalty_points = 0;
		invoice_doc.value.loyalty_points = 0;
		loyalty_amount.value = 0;
		toastStore.show({
			title: `Loyalty Amount can not be more than ${available_points_amount.value}`,
			color: "error",
		});
	} else {
		invoice_doc.value.loyalty_amount = flt(loyalty_amount.value);
		invoice_doc.value.redeem_loyalty_points = 1;

		let baseAmount = amount;
		const docCurrency = invoice_doc.value.currency;
		const baseCurrency = pos_profile.value.currency;

		if (docCurrency && baseCurrency && docCurrency !== baseCurrency) {
			baseAmount = amount * (invoice_doc.value.conversion_rate || 1);
		}

		invoice_doc.value.loyalty_points = parseInt(
			baseAmount / (customer_info.value.conversion_factor || 1),
		);

		if (!is_credit_sale.value && invoice_doc.value.payments) {
			const default_payment = invoice_doc.value.payments.find((p) => p.default === 1);
			if (default_payment) {
				const invoice_total = invoice_doc.value.rounded_total || invoice_doc.value.grand_total;
				const other_payments = invoice_doc.value.payments.reduce((sum, p) => {
					if (p !== default_payment) {
						return sum + flt(p.amount);
					}
					return sum;
				}, 0);
				const loyalty = flt(invoice_doc.value.loyalty_amount);
				const credit = flt(redeemed_customer_credit.value);

				let new_amount = invoice_total - loyalty - credit - other_payments;
				if (new_amount < 0) new_amount = 0;

				default_payment.amount = flt(new_amount, currency_precision.value);
			}
		}
	}
});

watch(sales_person, (newVal) => {
	if (!invoice_doc.value) return;
	if (newVal) {
		invoice_doc.value.sales_team = [
			{
				sales_person: newVal,
				allocated_percentage: 100,
			},
		];
	} else {
		invoice_doc.value.sales_team = [];
	}
});

watch(is_credit_sale, (newVal) => {
	if (!invoice_doc.value) return;
	if (newVal) {
		invoice_doc.value.payments.forEach((payment) => {
			if (payment.mode_of_payment.toLowerCase() === "cash") {
				payment.amount = 0;
			}
		});
	} else {
		invoice_doc.value.payments.forEach((payment) => {
			if (payment.mode_of_payment.toLowerCase() === "cash") {
				payment.amount = invoice_doc.value.rounded_total || invoice_doc.value.grand_total;
			}
		});
	}
});

watch(is_credit_return, (newVal) => {
	if (!invoice_doc.value) return;
	if (newVal) {
		is_cashback.value = false;
		invoice_doc.value.payments.forEach((payment) => {
			payment.amount = 0;
			if (payment.base_amount !== undefined) {
				payment.base_amount = 0;
			}
		});
	} else {
		is_cashback.value = true;
		ensureReturnPaymentsAreNegative();
	}
});

watch(
	() => invoice_doc.value.customer,
	(customer, previous) => {
		if (customer && customer !== previous) {
			get_addresses();
			set_print_format();
		} else if (!customer) {
			addresses.value = [];
			print_format.value = "";
		}
	},
);

watch(activeView, (newVal) => {
	if (newVal === "payment") {
		handleShowPayment();
	} else {
		paymentVisible.value = false;
		highlightSubmit.value = false;
		clearPaymentInlineError();
	}
});

watch(
	() => [invoice_doc.value?.grand_total, invoice_doc.value?.rounded_total, invoice_doc.value?.payments],
	() => {
		if (paymentInlineError.value) {
			clearPaymentInlineError();
		}
		const doc = invoice_doc.value;
		if (!doc || doc.is_return || is_credit_sale.value || is_credit_return.value) {
			return;
		}

		const precision = Math.max(currency_precision.value, 2);
		const epsilon = 1 / Math.pow(10, precision + 1);
		const invoiceTotal = Math.max(
			flt(doc.rounded_total || doc.grand_total || 0, currency_precision.value),
			0,
		);
		const payments = Array.isArray(doc.payments) ? doc.payments : [];
		const hasSettlement = payments.some(
			(payment) => Math.abs(flt(payment?.amount || 0, currency_precision.value)) > epsilon,
		);

		if (invoiceTotal <= epsilon && hasSettlement) {
			resetPaymentStateAfterCartEmpty();
		}
	},
	{ deep: true },
);

watch(
	() => [
		paymentVisible.value,
		hasCartItems.value,
		autoSyncQuickPay.value,
		invoice_doc.value?.grand_total,
		invoice_doc.value?.rounded_total,
		invoice_doc.value?.conversion_rate,
		Array.isArray(invoice_doc.value?.payments) ? invoice_doc.value.payments.length : 0,
		loyalty_amount.value,
		redeemed_customer_credit.value,
	],
	() => {
		syncQuickPayAmountsToInvoiceTotal();
	},
);

watch(
	() => invoiceStore.metadata.changeVersion,
	() => {
		syncPaymentDocumentTotalsFromCart();
		
		// Always reset auto sync when the cart changes, to discard stale overrides.
		autoSyncQuickPay.value = true;
		if (!autoSyncPaymentKey.value) {
			const payments = Array.isArray(invoice_doc.value?.payments) ? invoice_doc.value.payments : [];
			const preferredPayment = resolveAutoSyncPayment(payments);
			autoSyncPaymentKey.value = resolvePaymentKey(preferredPayment || payments[0]);
		}
		
		syncQuickPayAmountsToInvoiceTotal();
	},
);

watch(
	() => hasCartItems.value,
	(hasItems, hadItems) => {
		if (hasItems || !hadItems) {
			return;
		}
		resetPaymentStateAfterCartEmpty();
		if (!paymentVisible.value) {
			return;
		}
		const message = __("Cart is empty. Add items before charging.");
		paymentInlineError.value = message;
		toastStore.show({
			title: message,
			color: "warning",
		});
		uiStore.setActiveView("items");
	},
);

watch(
	() => invoice_doc.value.posa_delivery_date,
	(date) => {
		if (!date) {
			if (invoice_doc.value) {
				invoice_doc.value.shipping_address_name = null;
			}
			addresses.value = [];
			return;
		}
		if (invoice_doc.value && invoice_doc.value.customer) {
			get_addresses();
		}
	},
);

watch(customerInfo, (newInfo) => {
	customer_info.value = newInfo || "";
});

watch(
	() => invoice_doc.value?.posa_cup_customer_name,
	(value) => {
		const sanitized = sanitizeCupName(value);
		if (sanitized !== cup_label_customer_name.value) {
			cup_label_customer_name.value = sanitized;
		}
	},
	{ immediate: true },
);

watch(cup_label_customer_name, (value) => {
	const sanitized = sanitizeCupName(value);
	if (sanitized !== value) {
		cup_label_customer_name.value = sanitized;
		return;
	}
	if (invoice_doc.value) {
		invoice_doc.value.posa_cup_customer_name = sanitized;
	}
});

watch(
	() => [
		hasPrepItems.value,
		showCupNameInput.value,
		isWalkInOrder.value,
		selectedCustomer.value,
		customer_info.value?.customer,
		customer_info.value?.customer_name,
		invoice_doc.value?.customer,
		invoice_doc.value?.customer_name,
		invoice_doc.value?.posa_cup_customer_name,
	],
	() => {
		if (showCupNameInput.value) {
			ensureAdvancedPanelExpanded(ADVANCED_PANEL.ADDITIONAL);
		}
		prefillCupNameIfNeeded();
	},
	{ immediate: true },
);

watch(selectedCustomer, (newCustomer, oldCustomer) => {
	if (newCustomer === oldCustomer) return;
	customer_credit_dict.value = [];
	redeem_customer_credit.value = false;
	is_cashback.value = true;
	is_credit_return.value = false;
});

// Lifecycle
onMounted(() => {
	_shortcutHandlers.value.handlePaymentShortcut = handlePaymentShortcut.bind(this);
	document.addEventListener("keydown", _shortcutHandlers.value.handlePaymentShortcut);

	syncStore.syncPendingInvoices();
	eventBus.on("network-online", () => syncStore.syncPendingInvoices());
	eventBus.on("server-online", () => syncStore.syncPendingInvoices());

	if (eventBus) {
		eventBus.on("send_invoice_doc_payment", (doc) => {
			invoiceStore.setInvoiceDoc(doc);
			paid_change.value = flt(doc.paid_change || 0, currency_precision.value);
			credit_change.value = flt(doc.credit_change || 0, currency_precision.value);
			last_payment_change_was_cash.value = null;
			const default_payment = doc.payments.find((payment) => payment.default === 1);
			const hasReturnPayments = doc.payments.some(
				(payment) => Math.abs(flt(payment.amount || 0, currency_precision.value)) > 0,
			);
			is_credit_sale.value = false;
			is_write_off_change.value = false;

			if (doc.is_return) {
				is_return.value = true;
				is_credit_return.value = false;
				if (!hasReturnPayments) {
					doc.payments.forEach((payment) => {
						payment.amount = 0;
						payment.base_amount = 0;
					});
					if (default_payment) {
						const amount = doc.rounded_total || doc.grand_total;
						default_payment.amount = -Math.abs(amount);
						if (default_payment.base_amount !== undefined) {
							default_payment.base_amount = -Math.abs(amount);
						}
					}
				} else {
					ensureReturnPaymentsAreNegative();
				}
			} else if (default_payment) {
				default_payment.amount = flt(doc.rounded_total || doc.grand_total, currency_precision.value);
				is_credit_return.value = false;
			}
			autoSyncQuickPay.value = true;
			autoSyncPaymentKey.value = resolvePaymentKey(default_payment || doc.payments?.[0]);
			syncQuickPayAmountsToInvoiceTotal();
			initializeReturnValidity(doc);
			loyalty_amount.value = 0;
			redeemed_customer_credit.value = 0;
			if (doc.customer) {
				get_addresses();
			}
			get_sales_person_names();
		});

		eventBus.on("register_pos_profile", (data) => {
			pos_profile.value = data.pos_profile;
			stock_settings.value = data.stock_settings;
		});
		eventBus.on("add_the_new_address", (data) => {
			const normalized = normalizeAddress(data);
			if (normalized) {
				const existing = addresses.value.filter((addr) => addr.name !== normalized.name);
				addresses.value = [...existing, normalized];
				if (invoice_doc.value) {
					invoice_doc.value.shipping_address_name = normalized.name;
				}
			}
		});
		eventBus.on("update_invoice_type", (data) => {
			invoiceType.value = data;
			if (invoice_doc.value && data !== "Order") {
				invoice_doc.value.posa_delivery_date = null;
				invoice_doc.value.posa_notes = null;
				invoice_doc.value.posa_authorization_code = null;
				invoice_doc.value.shipping_address_name = null;
			} else if (invoice_doc.value && data === "Order") {
				new_delivery_date.value = formatDateDisplay(frappe.datetime.now_date());
				update_delivery_date();
			}
			if (invoice_doc.value && data === "Return") {
				invoice_doc.value.is_return = 1;
				ensureReturnPaymentsAreNegative();
				is_credit_return.value = false;
				return_valid_upto_date.value = null;
			}
		});
		eventBus.on("set_pos_settings", (data) => {
			pos_settings.value = data || {};
			if (invoice_doc.value && !invoice_doc.value.is_return) {
				initializeReturnValidity(invoice_doc.value);
			}
		});
		eventBus.on("set_mpesa_payment", (data) => {
			set_mpesa_payment(data);
		});
		eventBus.on("submit_payment_shortcut", handleSubmitPaymentShortcut);
			eventBus.on("clear_invoice", () => {
				invoiceStore.setInvoiceDoc({}); // Clear doc
				is_return.value = false;
				is_credit_return.value = false;
				return_valid_upto_date.value = null;
				cup_label_customer_name.value = "";
			});
		}

	if (activeView.value === "payment") {
		handleShowPayment("true");
	}
});

onBeforeUnmount(() => {
	eventBus.off("send_invoice_doc_payment");
	eventBus.off("register_pos_profile");
	eventBus.off("add_the_new_address");
	eventBus.off("update_invoice_type");
	eventBus.off("set_pos_settings");
	eventBus.off("set_mpesa_payment");
	eventBus.off("submit_payment_shortcut", handleSubmitPaymentShortcut);
	eventBus.off("clear_invoice");
	eventBus.off("network-online");
	eventBus.off("server-online");
	clearBackgroundStatusCheck();

	if (_shortcutHandlers.value.handlePaymentShortcut) {
		document.removeEventListener("keydown", _shortcutHandlers.value.handlePaymentShortcut);
	}
});
</script>

<style scoped>
.payments-screen {
	height: 100%;
	min-height: 0;
}

.payments-shell {
	height: 100%;
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	grid-template-rows: minmax(0, 1fr);
	overflow: hidden;
}

.payments-layout {
	height: 100%;
	display: grid;
	grid-template-columns: minmax(0, 1fr);
	grid-template-rows: auto minmax(0, 1fr) auto;
	gap: 8px;
	min-height: 0;
}

.payments-header-sticky {
	position: sticky;
	top: 0;
	z-index: 2;
	background: inherit;
}

.payments-body-scroll {
	min-height: 0;
	overflow-y: auto;
	overflow-x: hidden;
	padding-right: 2px;
	padding-bottom: 2px;
}

.payments-quick-pay-zone {
	display: grid;
	gap: 8px;
}

.cup-name-prompt-zone {
	display: grid;
	gap: 6px;
	margin-bottom: 8px;
}

.payments-section-heading {
	font-size: 0.86rem;
	font-weight: 800;
	letter-spacing: 0.03em;
	text-transform: uppercase;
	color: #4f6885;
}

.payments-advanced-panels {
	margin-bottom: 6px;
}

.payments-advanced-panels :deep(.v-expansion-panel-title) {
	min-height: 50px !important;
	font-weight: 700 !important;
	color: #1a3553 !important;
}

.payments-advanced-panels :deep(.v-expansion-panel-text__wrapper) {
	padding: 8px !important;
}

.payment-inline-error {
	font-weight: 600;
}

.payments-footer-dock {
	position: sticky;
	bottom: 0;
	background: inherit;
	padding-top: 4px;
	z-index: 3;
}

.v-text-field--readonly {
	cursor: text;
}

.v-text-field--readonly:hover {
	background-color: transparent;
}

@media (max-width: 920px) {
	.payments-layout {
		grid-template-rows: auto minmax(0, 1fr) auto;
	}
}
</style>
