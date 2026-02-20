<template>
	<v-dialog :model-value="modelValue" max-width="840" persistent @update:model-value="onDialogToggle">
		<v-card class="modifier-dialog-card">
			<v-card-title class="d-flex align-center">
				<div>
					<div class="text-h6">{{ __("Customize Drink") }}</div>
					<div class="text-caption text-medium-emphasis">{{ item?.item_name || "" }}</div>
				</div>
				<v-spacer />
				<v-chip
					v-if="computedDelta !== 0"
					color="success"
					variant="tonal"
					size="small"
				>
					{{ __(`Modifier Delta`) }}: {{ formatCurrency(computedDelta) }}
				</v-chip>
			</v-card-title>

			<v-card-text class="modifier-dialog-content">
				<div v-if="loading" class="py-8 text-center">
					<v-progress-circular indeterminate color="primary" />
				</div>

				<div v-else-if="!groups.length" class="py-4 text-medium-emphasis">
					{{ __("No modifier profile was found for this item.") }}
				</div>

				<div v-else>
					<v-alert
						v-if="errorMessages.length"
						type="error"
						variant="tonal"
						density="compact"
						class="mb-3"
					>
						<div v-for="(message, index) in errorMessages" :key="index">{{ message }}</div>
					</v-alert>

					<div v-for="group in groups" :key="group.name" class="modifier-group">
						<div class="d-flex align-center justify-space-between mb-2">
							<div class="modifier-group-title">
								{{ group.name }}
								<span v-if="group.required" class="text-error">*</span>
							</div>
							<div class="text-caption text-medium-emphasis">
								{{ group.allow_multiple ? __("Multiple") : __("Single") }}
							</div>
						</div>

						<div class="modifier-options-wrap">
							<v-chip
								v-for="option in getVisibleOptions(group)"
								:key="`${group.name}-${option.value}`"
								variant="outlined"
								:color="isSelected(group.name, option.value) ? 'primary' : undefined"
								:class="{ 'modifier-chip-selected': isSelected(group.name, option.value) }"
								@click="toggleOption(group, option)"
							>
								{{ option.label || option.value }}
								<span v-if="Number(option.price_delta || 0)">
									({{ formatCurrency(Number(option.price_delta || 0)) }})
								</span>
							</v-chip>
						</div>
					</div>
				</div>
			</v-card-text>

			<v-card-actions>
				<v-btn variant="text" @click="emitCancel">{{ __("Cancel") }}</v-btn>
				<v-spacer />
				<v-btn
					v-if="groups.length"
					variant="tonal"
					color="secondary"
					@click="applyDefaults"
				>
					{{ __("Use Defaults") }}
				</v-btn>
				<v-btn color="primary" variant="flat" @click="emitConfirm">{{ __("Apply") }}</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";

import {
	buildDefaultSelections,
	buildDrinkCode,
	buildModifierSignature,
	buildModifierSummary,
	normalizeModifierSelections,
	type ModifierGroup,
	type ModifierOption,
	type ModifierProfilePayload,
} from "../../../utils/modifierUtils";

const __ = (window as any).__;

const props = defineProps<{
	modelValue: boolean;
	item: any;
	profile: ModifierProfilePayload | null;
	loading?: boolean;
	formatCurrency?: (...args: any[]) => string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: boolean];
	confirm: [payload: any];
	cancel: [];
}>();

const selections = ref<Record<string, string[]>>({});
const errorMessages = ref<string[]>([]);

const groups = computed<ModifierGroup[]>(() => {
	return Array.isArray(props.profile?.groups) ? props.profile!.groups! : [];
});

const formatCurrency = (value: number) => {
	if (props.formatCurrency) {
		return props.formatCurrency(value);
	}
	return new Intl.NumberFormat(undefined, {
		minimumFractionDigits: 0,
		maximumFractionDigits: 2,
	}).format(value || 0);
};

const computedSummary = computed(() => buildModifierSummary(props.profile, selections.value));
const computedDelta = computed(() => Number(computedSummary.value.delta || 0));

const buildInitialSelections = () => {
	const defaults = buildDefaultSelections(props.profile);
	selections.value = normalizeModifierSelections(defaults);
	errorMessages.value = [];
};

watch(
	() => props.modelValue,
	(open) => {
		if (open) {
			buildInitialSelections();
		}
	},
	{ immediate: true },
);

watch(
	() => props.profile,
	() => {
		if (props.modelValue) {
			buildInitialSelections();
		}
	},
	{ deep: true },
);

const onDialogToggle = (value: boolean) => {
	emit("update:modelValue", value);
	if (!value) {
		errorMessages.value = [];
	}
};

const getVisibleOptions = (group: ModifierGroup): ModifierOption[] => {
	const options = Array.isArray(group.options) ? group.options : [];
	return options.filter((option) => {
		const parentGroup = (option.parent_option_group || "").trim();
		const parentValue = (option.parent_option_value || "").trim();
		if (!parentGroup) {
			return true;
		}
		const selectedParentValues = selections.value[parentGroup] || [];
		return selectedParentValues.includes(parentValue);
	});
};

const isSelected = (groupName: string, value: string) => {
	return (selections.value[groupName] || []).includes(value);
};

const toggleOption = (group: ModifierGroup, option: ModifierOption) => {
	errorMessages.value = [];
	const groupName = group.name;
	const current = [...(selections.value[groupName] || [])];
	const selected = current.includes(option.value);

	if (group.allow_multiple) {
		if (selected) {
			selections.value[groupName] = current.filter((value) => value !== option.value);
		} else {
			selections.value[groupName] = [...current, option.value];
		}
		return;
	}

	selections.value[groupName] = selected ? [] : [option.value];
};

const validateSelections = () => {
	const messages: string[] = [];
	groups.value.forEach((group) => {
		if (!group.required) {
			return;
		}
		const selectedValues = selections.value[group.name] || [];
		if (!selectedValues.length) {
			messages.push(`${__("Please select")}: ${group.name}`);
		}
	});
	errorMessages.value = messages;
	return messages.length === 0;
};

const applyDefaults = () => {
	buildInitialSelections();
};

const emitCancel = () => {
	emit("cancel");
	emit("update:modelValue", false);
};

const emitConfirm = () => {
	if (groups.value.length && !validateSelections()) {
		return;
	}

	const summary = computedSummary.value;
	const itemCode = props.item?.item_code || "";
	const drinkCode = buildDrinkCode(
		itemCode,
		props.profile?.drink_code_prefix,
		summary.optionCodes,
	);
	const normalizedSelections = normalizeModifierSelections(selections.value);
	const signature = buildModifierSignature(normalizedSelections);

	emit("confirm", {
		selections: normalizedSelections,
		summary: summary.summary,
		delta_total: Number(summary.delta || 0),
		option_codes: summary.optionCodes,
		drink_code: drinkCode,
		signature,
		modifiers_json: JSON.stringify({
			profile: props.profile?.profile,
			selections: normalizedSelections,
			summary: summary.summary,
		}),
		prep_status: props.profile?.default_prep_status || "Paid",
	});
	emit("update:modelValue", false);
};
</script>

<style scoped>
.modifier-dialog-card {
	border-radius: 16px;
}

.modifier-dialog-content {
	max-height: 60vh;
	overflow-y: auto;
}

.modifier-group {
	padding: 12px;
	border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
	border-radius: 12px;
	margin-bottom: 12px;
	background: rgba(var(--v-theme-surface), 0.6);
}

.modifier-group-title {
	font-weight: 700;
}

.modifier-options-wrap {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.modifier-chip-selected {
	background-color: rgba(var(--v-theme-primary), 0.12) !important;
	border-color: rgb(var(--v-theme-primary)) !important;
}
</style>
