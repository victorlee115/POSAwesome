<template>
	<v-card class="prep-queue-card pos-themed-card" elevation="0">
		<v-card-title class="d-flex align-center py-3">
			<div>
				<div class="text-h6">{{ __("Prep Queue") }}</div>
				<div class="text-caption text-medium-emphasis">
					{{ __("Paid to handoff workflow") }}
				</div>
			</div>
			<v-spacer />
			<v-btn variant="text" color="primary" @click="$emit('back')">
				<v-icon start>mdi-arrow-left</v-icon>
				{{ __("Back to Items") }}
			</v-btn>
			<v-btn variant="tonal" color="primary" :loading="loading" @click="loadQueue">
				<v-icon start>mdi-refresh</v-icon>
				{{ __("Refresh") }}
			</v-btn>
		</v-card-title>

		<v-card-text>
			<div class="d-flex align-center flex-wrap ga-2 mb-3">
				<v-chip
					v-for="status in statusFilters"
					:key="status.value"
					:color="statusFilter === status.value ? 'primary' : undefined"
					:variant="statusFilter === status.value ? 'flat' : 'outlined'"
					@click="statusFilter = status.value"
				>
					{{ status.label }}
				</v-chip>
			</div>

			<v-data-table
				:headers="headers"
				:items="rows"
				:loading="loading"
				item-value="line_id"
				density="comfortable"
				hide-default-footer
				:items-per-page="200"
				:no-data-text="__('No queued items')"
			>
				<template #item.queue_token="{ item }">
					<v-chip size="small" color="primary" variant="tonal">{{ item.queue_token }}</v-chip>
				</template>

				<template #item.item_name="{ item }">
					<div class="font-weight-medium">{{ item.item_name }}</div>
					<div class="text-caption text-medium-emphasis">{{ item.invoice_name }}</div>
				</template>

				<template #item.modifiers="{ item }">
					<div class="text-caption text-medium-emphasis text-wrap">
						{{ item.posa_modifier_summary || formatModifiers(item.posa_modifiers_json) || "-" }}
					</div>
				</template>

				<template #item.posa_prep_status="{ item }">
					<v-chip :color="statusColor(item.posa_prep_status)" variant="tonal" size="small">
						{{ item.posa_prep_status || "Paid" }}
					</v-chip>
				</template>

				<template #item.actions="{ item }">
					<div class="d-flex align-center ga-2 flex-wrap">
						<v-btn-toggle
							:model-value="item.posa_prep_status || 'Paid'"
							mandatory
							density="compact"
							variant="outlined"
							class="prep-status-toggle"
							@update:model-value="(value) => updateStatus(item, value)"
						>
							<v-btn v-for="value in transitionStatuses" :key="value" :value="value" size="x-small">
								{{ value }}
							</v-btn>
						</v-btn-toggle>
						<v-btn
							size="small"
							variant="tonal"
							color="secondary"
							@click="printLabel(item)"
						>
							<v-icon start size="small">mdi-printer</v-icon>
							{{ __("Label") }}
						</v-btn>
					</div>
				</template>
			</v-data-table>
		</v-card-text>
	</v-card>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import matchaService from "../../services/matchaService";
import { normalizeModifierSelections } from "../../utils/modifierUtils";

const __ = (window as any).__;

const props = defineProps<{
	posProfile?: any;
}>();
defineEmits<{
	back: [];
}>();

const loading = ref(false);
const rows = ref<any[]>([]);
const statusFilter = ref("");
let pollingTimer: ReturnType<typeof setInterval> | null = null;

type PrepQueueHeader = {
	title: string;
	key: string;
	width?: number;
	align?: "start" | "center" | "end";
	sortable?: boolean;
};

const headers: PrepQueueHeader[] = [
	{ title: __("Token"), key: "queue_token", width: 110 },
	{ title: __("Drink"), key: "item_name" },
	{ title: __("Qty"), key: "qty", width: 80, align: "end" },
	{ title: __("Modifiers"), key: "modifiers" },
	{ title: __("Status"), key: "posa_prep_status", width: 120 },
	{ title: __("Actions"), key: "actions", sortable: false, width: 500 },
];

const transitionStatuses = ["Paid", "In Prep", "Ready", "Collected"];
const statusFilters = [
	{ label: __("Active"), value: "" },
	{ label: __("Paid"), value: "Paid" },
	{ label: __("In Prep"), value: "In Prep" },
	{ label: __("Ready"), value: "Ready" },
	{ label: __("Collected"), value: "Collected" },
];

const statusColor = (status: string) => {
	if (status === "Ready") return "success";
	if (status === "In Prep") return "warning";
	if (status === "Collected") return "info";
	return "primary";
};

const parseModifierPayload = (rawValue: any): Record<string, any> => {
	if (!rawValue) {
		return {};
	}
	if (typeof rawValue === "object") {
		return rawValue;
	}
	if (typeof rawValue !== "string") {
		return {};
	}
	try {
		const parsed = JSON.parse(rawValue);
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch (_error) {
		return {};
	}
};

const formatModifiers = (rawValue: any) => {
	const selections = normalizeModifierSelections(parseModifierPayload(rawValue));
	const labels = Object.entries(selections).flatMap(([group, values]) =>
		(values || []).map((value) => `${group}: ${value}`),
	);
	return labels.join(" | ");
};

const loadQueue = async () => {
	if (!props.posProfile?.name) {
		rows.value = [];
		return;
	}
	loading.value = true;
	try {
		const response = await matchaService.getPrepQueue({
			pos_profile: props.posProfile?.name,
			status: statusFilter.value || undefined,
			limit: 120,
		});
		rows.value = Array.isArray(response) ? response : [];
	} catch (error) {
		console.error("Failed to load prep queue", error);
	} finally {
		loading.value = false;
	}
};

const updateStatus = async (row: any, status: string) => {
	if (!status || status === row.posa_prep_status) {
		return;
	}
	const previous = row.posa_prep_status;
	row.posa_prep_status = status;
	try {
		await matchaService.transitionPrepStatus(
			row.invoice_name,
			String(row.line_id || row.posa_row_id || ""),
			status,
		);
	} catch (error) {
		row.posa_prep_status = previous;
		console.error("Failed to update prep status", error);
	}
};

const buildLabelHtml = (invoice: any, label: any) => {
	return `
		<!doctype html>
		<html>
			<head>
				<meta charset="utf-8" />
				<title>Label ${label.queue_token}</title>
				<style>
					body { font-family: Arial, sans-serif; padding: 8px; margin: 0; }
					.label { width: 70mm; border: 1px dashed #999; padding: 8px; border-radius: 6px; }
					.token { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
					.item { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
					.meta { font-size: 12px; color: #333; margin-bottom: 2px; }
				</style>
			</head>
			<body>
				<div class="label">
					<div class="token">${label.queue_token}</div>
					<div class="item">${label.drink_code} - ${label.item_name}</div>
					<div class="meta">Qty: ${label.qty}</div>
					<div class="meta">${label.modifiers || "No modifiers"}</div>
					<div class="meta">${invoice.name} / ${invoice.posting_time || ""}</div>
				</div>
					<script>window.print();<\/script>
			</body>
		</html>
	`;
};

const printLabel = async (row: any) => {
	try {
		const payload = await matchaService.getLabelPayload(row.invoice_name);
		const invoice = payload?.invoice;
		const labels = payload?.labels || [];
		const label = labels.find((entry: any) => entry.line_id === row.line_id) || labels[0];
		if (!invoice || !label) {
			return;
		}
		const popup = window.open("", "_blank", "width=420,height=600");
		if (!popup) {
			return;
		}
		popup.document.open();
		popup.document.write(buildLabelHtml(invoice, label));
		popup.document.close();
	} catch (error) {
		console.error("Failed to print label", error);
	}
};

watch(statusFilter, () => {
	loadQueue();
});

watch(
	() => props.posProfile?.name,
	() => {
		loadQueue();
	},
	{ immediate: true },
);

onMounted(() => {
	loadQueue();
	pollingTimer = setInterval(() => {
		loadQueue();
	}, 10000);
});

onBeforeUnmount(() => {
	if (pollingTimer) {
		clearInterval(pollingTimer);
		pollingTimer = null;
	}
});
</script>

<style scoped>
.prep-queue-card {
	height: calc(var(--container-height) + 130px);
	max-height: calc(var(--container-height) + 130px);
	overflow: auto;
	border-radius: 16px;
}

.prep-status-toggle :deep(.v-btn) {
	min-width: 78px;
}

.text-wrap {
	white-space: normal;
	word-break: break-word;
}
</style>
