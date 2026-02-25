<template>
	<div v-if="items.length" class="quick-order-bar">
		<div class="quick-order-scroll" ref="scrollEl">
			<button
				v-for="item in items"
				:key="item.item_code"
				class="quick-order-pill"
				@click="$emit('select-item', item)"
			>
				{{ item.item_name }}
			</button>
		</div>
	</div>
</template>

<script setup>
import { ref } from "vue";

defineProps({
	items: { type: Array, default: () => [] },
});

defineEmits(["select-item"]);

const scrollEl = ref(null);
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
	transition: background 0.08s, color 0.08s;
	-webkit-tap-highlight-color: transparent;
	touch-action: manipulation;
}

.quick-order-pill:active {
	background: #1d4ed8;
	color: #ffffff;
	border-color: #1d4ed8;
}
</style>
