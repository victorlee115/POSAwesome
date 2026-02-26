<template>
	<div v-if="items.length" class="quick-order-bar">
		<div class="quick-order-scroll" ref="scrollEl">
			<button
				v-for="item in items"
				:key="item.item_code"
				class="quick-order-pill"
				:class="{ 'quick-order-pill--preset': hasPreset(item.item_code) }"
				@click="tapPill(item)"
				@touchstart.passive="startLongPress(item)"
				@touchend.passive="cancelLongPress"
				@touchcancel.passive="cancelLongPress"
				@mousedown="startLongPress(item)"
				@mouseup="cancelLongPress"
				@mouseleave="cancelLongPress"
			>
				<span class="quick-order-pill-label">{{ item.item_name }}</span>
				<span
					v-if="hasPreset(item.item_code)"
					class="quick-order-preset-dot"
					title="Preset saved — long-press to clear"
				></span>
			</button>
		</div>
	</div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from "vue";

const props = defineProps({
	items: { type: Array, default: () => [] },
	posProfileName: { type: String, default: "" },
});

const emit = defineEmits(["select-item", "quick-preset-order"]);

const scrollEl = ref(null);
const presets = ref({});
let longPressTimer = null;

function presetKey(itemCode) {
	return `posa_preset_${props.posProfileName}_${itemCode}`;
}

function loadPresets() {
	const loaded = {};
	for (const item of props.items) {
		const raw = localStorage.getItem(presetKey(item.item_code));
		if (raw) {
			try {
				loaded[item.item_code] = JSON.parse(raw);
			} catch {
				// ignore corrupt entries
			}
		}
	}
	presets.value = loaded;
}

function hasPreset(itemCode) {
	return !!presets.value[itemCode];
}

function tapPill(item) {
	const preset = presets.value[item.item_code];
	if (preset) {
		emit("quick-preset-order", { item, preset });
	} else {
		emit("select-item", item);
	}
}

function startLongPress(item) {
	cancelLongPress();
	longPressTimer = setTimeout(() => {
		longPressTimer = null;
		clearPreset(item);
	}, 600);
}

function cancelLongPress() {
	if (longPressTimer) {
		clearTimeout(longPressTimer);
		longPressTimer = null;
	}
}

function clearPreset(item) {
	localStorage.removeItem(presetKey(item.item_code));
	const updated = { ...presets.value };
	delete updated[item.item_code];
	presets.value = updated;
}

function onStorageChange(e) {
	if (e.key && e.key.startsWith("posa_preset_")) {
		loadPresets();
	}
}

function onPresetSaved() {
	loadPresets();
}

onMounted(() => {
	loadPresets();
	window.addEventListener("storage", onStorageChange);
	window.addEventListener("posa-preset-saved", onPresetSaved);
});

onUnmounted(() => {
	cancelLongPress();
	window.removeEventListener("storage", onStorageChange);
	window.removeEventListener("posa-preset-saved", onPresetSaved);
});

defineExpose({ loadPresets });
</script>

<style scoped>
.quick-order-bar {
	overflow: hidden;
	flex-shrink: 0;
}

.quick-order-scroll {
	display: flex;
	gap: 8px;
	overflow-x: auto;
	padding: 4px 2px 8px;
	scrollbar-width: none;
	-webkit-overflow-scrolling: touch;
}

.quick-order-scroll::-webkit-scrollbar {
	display: none;
}

.quick-order-pill {
	flex-shrink: 0;
	position: relative;
	background: #e9f1ff;
	border: 1.5px solid #c8daf9;
	color: #1d4ed8;
	border-radius: 999px;
	padding: 0 18px;
	font-size: 0.9rem;
	font-weight: 700;
	cursor: pointer;
	white-space: nowrap;
	min-height: 44px;
	line-height: 1;
	font-family: inherit;
	display: inline-flex;
	align-items: center;
	gap: 6px;
	transition: background 0.08s, color 0.08s, border-color 0.08s;
	-webkit-tap-highlight-color: transparent;
	touch-action: manipulation;
}

.quick-order-pill--preset {
	background: #dbeafe;
	border-color: #93c5fd;
}

.quick-order-pill:active {
	background: #1d4ed8;
	color: #ffffff;
	border-color: #1d4ed8;
}

.quick-order-pill-label {
	pointer-events: none;
}

.quick-order-preset-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: #22c55e;
	flex-shrink: 0;
	pointer-events: none;
}
</style>
