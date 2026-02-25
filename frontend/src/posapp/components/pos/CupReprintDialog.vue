<template>
	<v-dialog :model-value="modelValue" max-width="560" @update:model-value="onDialogUpdate">
		<v-card class="reprint-dialog-card">
			<v-card-title class="d-flex align-center">
				<span>{{ __("Reprint Cup Label") }}</span>
				<v-spacer />
				<v-btn icon variant="text" @click="closeDialog">
					<v-icon>mdi-close</v-icon>
				</v-btn>
			</v-card-title>
			<v-card-text>
				<div class="text-body-2 text-medium-emphasis mb-3">
					{{ __("Select one cup to reprint.") }}
				</div>
				<div class="d-flex flex-wrap ga-2">
					<v-chip
						v-for="entry in labels"
						:key="entry.label_id"
						:variant="selectedLabelId === entry.label_id ? 'flat' : 'outlined'"
						:color="selectedLabelId === entry.label_id ? 'primary' : undefined"
						class="cup-chip"
						@click="selectedLabelId = entry.label_id"
					>
						{{ `${entry.order_sequence || 0}/${entry.order_sequence_total || 0}` }}
					</v-chip>
				</div>
				<div v-if="selectedEntry" class="mt-4 text-caption text-medium-emphasis">
					<div>{{ selectedEntry.drink_name || selectedEntry.item_name }}</div>
					<div>{{ selectedEntry.modifiers_compact || selectedEntry.modifiers || "-" }}</div>
				</div>
			</v-card-text>
			<v-card-actions class="px-4 pb-4">
				<v-spacer />
				<v-btn variant="text" @click="closeDialog">{{ __("Cancel") }}</v-btn>
				<v-btn color="primary" :disabled="!selectedEntry" @click="printSelected">
					{{ __("Print Selected Cup") }}
				</v-btn>
			</v-card-actions>
		</v-card>
	</v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { CupLabelPayloadItem } from "../../services/matchaService";

const __ = (window as any).__;

const props = defineProps<{
	modelValue: boolean;
	labels: CupLabelPayloadItem[];
}>();

const emit = defineEmits<{
	(e: "update:modelValue", value: boolean): void;
	(e: "print", label: CupLabelPayloadItem): void;
}>();

const selectedLabelId = ref<string>("");

const sortedLabels = computed(() =>
	[...(props.labels || [])].sort((a, b) => {
		const aOrder = Number(a?.order_sequence || 0);
		const bOrder = Number(b?.order_sequence || 0);
		if (aOrder !== bOrder) return aOrder - bOrder;
		return String(a?.label_id || "").localeCompare(String(b?.label_id || ""));
	}),
);

const labels = computed(() => sortedLabels.value);

const selectedEntry = computed(() =>
	labels.value.find((entry) => entry.label_id === selectedLabelId.value) || null,
);

const closeDialog = () => {
	emit("update:modelValue", false);
};

const onDialogUpdate = (value: boolean) => {
	emit("update:modelValue", value);
};

const printSelected = () => {
	if (!selectedEntry.value) return;
	emit("print", selectedEntry.value);
};

watch(
	() => props.modelValue,
	(value) => {
		if (!value) return;
		selectedLabelId.value = labels.value[0]?.label_id || "";
	},
	{ immediate: true },
);
</script>

<style scoped>
.reprint-dialog-card {
	border-radius: 14px;
}

.cup-chip {
	cursor: pointer;
}
</style>
