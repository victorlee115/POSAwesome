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
		<CupReprintDialog
			v-model="reprintDialogVisible"
			:labels="reprintCandidates"
			@print="handleDialogReprint"
		/>
	</v-card>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

import CupReprintDialog from "./CupReprintDialog.vue";
import matchaService, { type CupLabelPayloadItem } from "../../services/matchaService";
import { getCupPrinterConfig, printSingleCup, type CupLabelJob } from "../../services/cupLabelService";
import { normalizeModifierSelections } from "../../utils/modifierUtils";

const __ = (window as any).__;
const frappe = (window as any).frappe;

const props = defineProps<{
	posProfile?: any;
}>();
defineEmits<{
	back: [];
}>();

const loading = ref(false);
const rows = ref<any[]>([]);
const statusFilter = ref("");
const reprintDialogVisible = ref(false);
const reprintCandidates = ref<CupLabelPayloadItem[]>([]);
const reprintInvoice = ref<any>(null);
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

const notify = (message: string, indicator: "green" | "orange" | "red" | "blue" = "blue") => {
	if (frappe?.show_alert) {
		frappe.show_alert({ message, indicator }, 5);
		return;
	}
	console.info(message);
};

const buildJobFromPayload = (invoice: any, label: CupLabelPayloadItem): CupLabelJob => {
	const orderToken = String(label.order_token || invoice?.order_token || "").trim();
	const labelId = String(
		label.label_id ||
			`${invoice?.name || label.invoice_name || "TEMP"}|${label.line_id || "LINE"}|${label.line_cup_index || 1}`,
	).trim();
	return {
		labelId,
		invoiceName: String(invoice?.name || label.invoice_name || "").trim(),
		lineId: String(label.line_id || "").trim(),
		lineIdx: Number(label.line_idx || 0),
		lineCupIndex: Number(label.line_cup_index || 1),
		lineCupTotal: Number(label.line_cup_total || 1),
		orderSequence: Number(label.order_sequence || 1),
		orderSequenceTotal: Number(label.order_sequence_total || 1),
		orderToken,
		cupName: String(label.cup_customer_name || invoice?.cup_customer_name || "").trim(),
		drinkName: String(label.drink_name || label.item_name || "").trim(),
		modifiers: String(label.modifiers_compact || label.modifiers || "").trim(),
		alerts: String(label.alerts || "").trim(),
		qrPayload: `${orderToken}|${labelId}`,
	};
};

const logReprintEvent = async (
	invoiceName: string,
	lineId: string,
	labelId: string,
	result: string,
) => {
	try {
		await matchaService.logCupLabelReprint({
			invoice_name: invoiceName,
			line_id: lineId,
			label_id: labelId,
			result,
		});
	} catch (_error) {
		// Logging errors should never block reprint flow.
	}
};

const printPayloadLabel = async (invoice: any, label: CupLabelPayloadItem) => {
	const printer = getCupPrinterConfig(props.posProfile || {});
	if (!printer.enabled) {
		notify(__("Cup labels are disabled in POS Profile"), "orange");
		return;
	}

	const job = buildJobFromPayload(invoice, label);
	const result = printSingleCup(job, printer);
	const failure = result.failures[0]?.reason || "";
	if (result.ok) {
		notify(__("Cup label printed"), "green");
	} else {
		notify(failure || __("Failed to print cup label"), "orange");
	}

	await logReprintEvent(job.invoiceName, job.lineId, job.labelId, result.ok ? "sent" : `failed:${failure}`);
};

const printLabel = async (row: any) => {
	try {
		const payload = await matchaService.getLabelPayload(row.invoice_name);
		const invoice = payload?.invoice;
		const labels = Array.isArray(payload?.labels) ? payload.labels : [];
		if (!invoice || !labels.length) {
			return;
		}

		const lineLabels = labels
			.filter((entry) => String(entry?.line_id || "") === String(row?.line_id || ""))
			.sort((a, b) => Number(a?.order_sequence || 0) - Number(b?.order_sequence || 0));
		if (!lineLabels.length) {
			notify(__("No cup labels found for selected line"), "orange");
			return;
		}

		const candidates = lineLabels;
		if (!candidates.length) {
			return;
		}

		if (candidates.length === 1) {
			const onlyLabel = candidates[0];
			if (!onlyLabel) {
				return;
			}
			await printPayloadLabel(invoice, onlyLabel);
			return;
		}

		reprintInvoice.value = invoice;
		reprintCandidates.value = candidates;
		reprintDialogVisible.value = true;
	} catch (error) {
		console.error("Failed to print label", error);
	}
};

const handleDialogReprint = async (label: CupLabelPayloadItem) => {
	const invoice = reprintInvoice.value;
	reprintDialogVisible.value = false;
	if (!invoice || !label) return;
	await printPayloadLabel(invoice, label);
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
