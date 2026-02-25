<template>
	<div class="sticky-header">
		<v-row class="items">
			<v-col
				class="pb-0"
				:cols="posProfile.posa_input_qty || posProfile.posa_new_line ? undefined : 12"
			>
				<v-text-field
					density="compact"
					clearable
					autofocus
					variant="solo"
					color="primary"
					:label="frappe._('Search Items')"
					hint="Search by item code, serial number, batch no or barcode"
					hide-details
					:model-value="searchInput"
					@update:model-value="
						(val) => {
							$emit('update:searchInput', val);
							$emit('search-input', val);
						}
					"
					@keydown.esc="$emit('esc')"
					@keydown.enter="$emit('enter')"
					@keydown="$emit('search-keydown', $event)"
					@click:clear="$emit('clear-search')"
					@click:prepend-inner="$emit('focus')"
					@paste="$emit('search-paste', $event)"
					prepend-inner-icon="mdi-magnify"
					@focus="$emit('focus')"
					ref="debounce_search"
				>
					<template v-slot:append-inner>
						<v-btn
							v-if="posProfile.posa_enable_camera_scanning"
							icon="mdi-camera"
							size="small"
							color="primary"
							variant="text"
							:disabled="scannerLocked"
							@click="$emit('start-camera')"
							:title="
								scannerLocked
									? __('Acknowledge the error to resume scanning')
									: __('Scan with Camera')
							"
						>
						</v-btn>
					</template>
				</v-text-field>
			</v-col>
			<v-col cols="3" class="pb-0" v-if="posProfile.posa_input_qty">
				<v-text-field
					density="compact"
					variant="solo"
					color="primary"
					:label="frappe._('QTY')"
					hide-details
					:model-value="qtyInput"
					@update:model-value="$emit('update:qtyInput', $event)"
					type="text"
					@keydown.enter="$emit('enter')"
					@keydown.esc="$emit('esc')"
					@focus="$emit('clear-qty')"
					@click="$emit('clear-qty')"
					@blur="$emit('blur-qty')"
				></v-text-field>
			</v-col>
			<v-col cols="2" class="pb-0" v-if="posProfile.posa_new_line">
				<v-checkbox
					:model-value="newLine"
					@update:model-value="$emit('update:newLine', $event)"
					color="accent"
					value="true"
					label="NLine"
					density="default"
					hide-details
				></v-checkbox>
			</v-col>
			<v-col cols="12" class="dynamic-margin-xs" v-if="!tabletCompact">
				<div class="settings-container">
					<div class="settings-actions">
						<v-btn
							v-if="context === 'purchase'"
							density="compact"
							variant="text"
							color="primary"
							prepend-icon="mdi-plus"
							@click="$emit('open-new-item')"
							class="settings-btn"
						>
							{{ __("New Item") }}
						</v-btn>
						<v-btn
							density="compact"
							variant="text"
							color="primary"
							prepend-icon="mdi-cog-outline"
							@click="$emit('toggle-settings')"
							class="settings-btn"
						>
							{{ __("Settings") }}
						</v-btn>
						<v-btn
							density="compact"
							variant="text"
							color="primary"
							prepend-icon="mdi-refresh"
							@click="$emit('reload-items')"
							class="settings-btn"
						>
							{{ __("Reload Items") }}
						</v-btn>
					</div>
					<div class="settings-meta">
						<span v-if="syncStatus" class="text-caption text-info font-weight-bold sync-status-label">
							{{ syncStatus }}
						</span>
						<span
							v-if="enableBackgroundSync && !syncStatus"
							class="text-caption text-medium-emphasis last-sync-label"
						>
							{{ __("Last sync:") }} {{ lastSyncTime }}
						</span>
					</div>
				</div>
			</v-col>
		</v-row>
	</div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
	searchInput: { type: String, default: "" },
	qtyInput: { type: [String, Number], default: 1 },
	newLine: { type: [Boolean, Array], default: false },
	posProfile: { type: Object, required: true },
	scannerLocked: { type: Boolean, default: false },
	enableBackgroundSync: { type: Boolean, default: false },
	lastSyncTime: { type: String, default: "" },
	syncStatus: { type: String, default: "" },
	context: { type: String, default: "pos" },
	tabletCompact: { type: Boolean, default: false },
});

defineEmits([
	"update:searchInput",
	"update:qtyInput",
	"update:newLine",
	"esc",
	"enter",
	"search-keydown",
	"clear-search",
	"search-input",
	"search-paste",
	"focus",
	"clear-qty",
	"blur-qty",
	"start-camera",
	"open-new-item",
	"toggle-settings",
	"reload-items",
]);

const debounce_search = ref(null);

defineExpose({
	debounce_search,
});
</script>

<style scoped>
.sticky-header {
	position: sticky;
	top: 0;
	z-index: 5;
}

.items {
	margin: 0;
}

.settings-container {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	gap: 8px;
	padding: 4px 0;
}

.settings-actions {
	display: flex;
	flex-wrap: wrap;
	gap: 8px;
}

.settings-meta {
	min-height: 18px;
	display: flex;
	align-items: center;
}

.settings-btn {
	text-transform: none !important;
	letter-spacing: 0.01em !important;
	font-weight: 700 !important;
}

.last-sync-label {
	white-space: nowrap;
	font-size: 0.75rem;
}

.dynamic-margin-xs {
	margin-top: 4px;
}

@media (max-width: 960px) {
	.settings-container {
		grid-template-columns: minmax(0, 1fr);
	}

	.settings-meta {
		justify-content: flex-start;
	}
}

@media (max-width: 760px) {
	.settings-actions {
		flex-direction: column;
	}
}
</style>
