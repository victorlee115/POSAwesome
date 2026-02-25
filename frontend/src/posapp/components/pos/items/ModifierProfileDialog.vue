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

					<div
						v-for="group in groups"
						:key="group.name"
						class="modifier-group"
						:class="{ 'modifier-group-invalid': invalidGroupSet.has(group.name) }"
					>
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
						<div
							v-if="invalidGroupSet.has(group.name)"
							class="modifier-group-hint text-error"
						>
							{{ __("Please select") }}: {{ group.name }}
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
				<v-btn color="primary" variant="flat" :disabled="!canApply" @click="emitConfirm">{{
					__("Apply")
				}}</v-btn>
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
	pruneModifierSelections,
	type ModifierGroup,
	type ModifierOption,
	type ModifierProfilePayload,
} from "../../../utils/modifierUtils";

const __ = (window as any).__;

const props = defineProps<{
	modelValue: boolean;
	item: any;
	profile: ModifierProfilePayload | null;
	initialSelections?: Record<string, string[] | string> | null;
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

const getSanitizedSelections = (input: Record<string, string[]>) => {
	return pruneModifierSelections(props.profile, input);
};

const computedSummary = computed(() => buildModifierSummary(props.profile, getSanitizedSelections(selections.value)));
const computedDelta = computed(() => Number(computedSummary.value.delta || 0));
const invalidRequiredGroups = computed(() => {
	const activeSelections = getSanitizedSelections(selections.value);
	return groups.value
		.filter((group) => {
			if (!group.required) {
				return false;
			}
			const visibleOptions = getVisibleOptions(group);
			if (!visibleOptions.length) {
				return false;
			}
			return !(activeSelections[group.name] || []).length;
		})
		.map((group) => group.name);
});
const invalidGroupSet = computed(() => new Set(invalidRequiredGroups.value));
const canApply = computed(() => {
	if (props.loading) {
		return false;
	}
	if (!groups.value.length) {
		return true;
	}
	return invalidRequiredGroups.value.length === 0;
});

const buildInitialSelections = () => {
	const defaults = buildDefaultSelections(props.profile);
	const initial = normalizeModifierSelections(props.initialSelections || {});
	const merged = Object.keys(initial).length ? initial : defaults;
	selections.value = getSanitizedSelections(normalizeModifierSelections(merged));
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
			if (group.required && current.length <= 1) {
				// Keep at least one choice for required multi-select groups.
				selections.value[groupName] = [...current];
			} else {
				selections.value[groupName] = current.filter((value) => value !== option.value);
			}
		} else {
			selections.value[groupName] = [...current, option.value];
		}
		selections.value = getSanitizedSelections(selections.value);
		return;
	}

	if (selected && group.required) {
		// Keep one selection for required single-choice groups to avoid accidental invalid state.
		selections.value[groupName] = [option.value];
	} else {
		selections.value[groupName] = selected ? [] : [option.value];
	}
	selections.value = getSanitizedSelections(selections.value);
};

const validateSelections = () => {
	const messages: string[] = [];
	invalidRequiredGroups.value.forEach((groupName) => {
		messages.push(`${__("Please select")}: ${groupName}`);
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

	const normalizedSelections = getSanitizedSelections(selections.value);
	const summary = computedSummary.value;
	const itemCode = props.item?.item_code || "";
	const drinkCode = buildDrinkCode(
		itemCode,
		props.profile?.drink_code_prefix,
		summary.optionCodes,
	);
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

.modifier-group-invalid {
	border-color: rgba(var(--v-theme-error), 0.45);
	background: rgba(var(--v-theme-error), 0.05);
}

.modifier-group-title {
	font-weight: 700;
}

.modifier-options-wrap {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.modifier-group-hint {
	margin-top: 8px;
	font-size: 0.78rem;
	font-weight: 600;
}

.modifier-chip-selected {
	background-color: rgba(var(--v-theme-primary), 0.12) !important;
	border-color: rgb(var(--v-theme-primary)) !important;
}
</style>
