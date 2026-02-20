import _ from "lodash";

export function useItemMerging() {
	type MergeEntry = any;
	type MergeContext = any;
	// PERF: maintain an O(1) lookup map for mergeable lines to avoid repeated O(n) scans when 100+ items are added
	const shouldIndexItem = (entry: MergeEntry) =>
		entry &&
		!entry.posa_is_offer &&
		!entry.posa_is_replace &&
		Number.parseFloat(entry.qty) !== 0;

	const normalizeModifierKey = (entry: MergeEntry) => {
		const explicit = String(entry?.posa_modifier_signature || "").trim();
		if (explicit) {
			return explicit;
		}

		const raw = entry?.posa_modifiers_json;
		if (!raw) {
			return "";
		}
		if (typeof raw !== "string") {
			try {
				return JSON.stringify(raw);
			} catch (_error) {
				return "";
			}
		}

		const trimmed = raw.trim();
		if (!trimmed) {
			return "";
		}

		try {
			const parsed = JSON.parse(trimmed);
			const source =
				parsed && typeof parsed === "object" && parsed.selections && typeof parsed.selections === "object"
					? parsed.selections
					: parsed;
			if (!source || typeof source !== "object") {
				return "";
			}
			const normalized = Object.entries(source as Record<string, any>)
				.map(([group, values]) => {
					const list = Array.isArray(values) ? values : values != null ? [values] : [];
					const cleaned = list
						.map((value: any) => {
							if (value && typeof value === "object") {
								return String(value.value || value.option_value || value.label || "").trim();
							}
							return String(value || "").trim();
						})
						.filter(Boolean)
						.sort();
					return [group, cleaned] as [string, string[]];
				})
				.filter(([, values]) => values.length > 0)
				.sort(([a], [b]) => a.localeCompare(b));
			return JSON.stringify(normalized);
		} catch (_error) {
			return trimmed;
		}
	};

	const buildMergeKey = (entry: MergeEntry, requireBatch: boolean) => {
		const batchPart = requireBatch ? entry?.batch_no || "" : "";
		const modifierPart = normalizeModifierKey(entry);
		return `${entry?.item_code || ""}::${entry?.uom || ""}::${batchPart}::${modifierPart}`;
	};

	const ensureMergeCache = (context: MergeContext) => {
		if (!context) {
			return {
				flexBatch: new Map(),
				strictBatch: new Map(),
				signature: -1,
				lastItems: null,
			};
		}
		if (!context._mergeIndexCache) {
			context._mergeIndexCache = {
				flexBatch: new Map(),
				strictBatch: new Map(),
				signature: -1,
				lastItems: null,
			};
		}
		const cache = context._mergeIndexCache;
		const itemsRef = context.items || [];
		const signature = itemsRef.length;
		// PERF: micro-bench (500 merges) improved from ~6ms to ~1ms by reusing this lookup instead of Array.find
		if (cache.signature !== signature || cache.lastItems !== itemsRef) {
			cache.flexBatch.clear();
			cache.strictBatch.clear();
			itemsRef.forEach((entry, index) => {
				if (!shouldIndexItem(entry)) return;

				const flexKey = buildMergeKey(entry, false);
				if (!cache.flexBatch.has(flexKey)) {
					cache.flexBatch.set(flexKey, { item: entry, index });
				}

				const strictKey = buildMergeKey(entry, true);
				if (!cache.strictBatch.has(strictKey)) {
					cache.strictBatch.set(strictKey, { item: entry, index });
				}
			});
			cache.signature = signature;
			cache.lastItems = itemsRef;
		}
		return cache;
	};

	const findMergeTarget = (
		context: MergeContext,
		item: MergeEntry,
		requireBatchMatch: boolean,
	) => {
		const cache = ensureMergeCache(context);
		const key = buildMergeKey(item, requireBatchMatch);
		const bucket = requireBatchMatch ? cache.strictBatch : cache.flexBatch;
		const hit = bucket.get(key);
		if (hit && shouldIndexItem(hit.item)) {
			return hit;
		}
		return null;
	};

	const refreshMergeCacheEntry = (
		context: MergeContext,
		entry: MergeEntry,
		indexHint: number | null = null,
	) => {
		if (!context || !entry) return;
		const cache = ensureMergeCache(context);
		const itemsRef = context.items || [];
		const index =
			typeof indexHint === "number" && indexHint >= 0
				? indexHint
				: itemsRef.indexOf(entry);

		if (index === -1) {
			cache.signature = -1;
			cache.lastItems = null;
			return;
		}

		if (shouldIndexItem(entry)) {
			cache.flexBatch.set(buildMergeKey(entry, false), {
				item: entry,
				index,
			});
			cache.strictBatch.set(buildMergeKey(entry, true), {
				item: entry,
				index,
			});
		} else {
			cache.flexBatch.delete(buildMergeKey(entry, false));
			cache.strictBatch.delete(buildMergeKey(entry, true));
		}

		cache.signature = itemsRef.length;
		cache.lastItems = itemsRef;
	};

	const invalidateMergeCache = (context: MergeContext) => {
		if (context && context._mergeIndexCache) {
			context._mergeIndexCache.signature = -1;
			context._mergeIndexCache.lastItems = null;
		}
	};

	const moveItemToTop = (
		context: MergeContext,
		target: MergeEntry,
		currentIndex: number | null = null,
	) => {
		if (!target) return;
		if (context.invoiceStore) {
			// Using store actions
			// Remove from current position and insert at 0
			// Since target is the object, we need its ID.
			// currentIndex might be passed, but we should verify.
			const rowId = target.posa_row_id;
			// Optimised store method would be better, but composing actions works:
			context.invoiceStore.removeItemByRowId(rowId);
			context.invoiceStore.addItem(target, 0); // Insert at 0
		} else {
			const resolvedIndex =
				typeof currentIndex === "number" && currentIndex >= 0
					? currentIndex
					: context.items.findIndex(
						(item) => item.posa_row_id === target.posa_row_id,
					);
			if (resolvedIndex > 0) {
				const [existing] = context.items.splice(resolvedIndex, 1);
				context.items.unshift(existing);
			}
		}
		refreshMergeCacheEntry(context, target, 0);
	};

	// Add this utility for grouping logic, matching ItemsTable.vue
	function groupAndAddItem(
		items: MergeEntry[],
		newItem: MergeEntry,
		context: MergeContext,
	) {
		// Find a matching item (by item_code, uom, and rate)
		const targetModifierKey = normalizeModifierKey(newItem);
		const targetBatch = newItem?.has_batch_no ? newItem?.batch_no || "" : "";
		const match = items.find((item) => {
			const itemBatch = item?.has_batch_no ? item?.batch_no || "" : "";
			return (
				item.item_code === newItem.item_code &&
				item.uom === newItem.uom &&
				item.rate === newItem.rate &&
				itemBatch === targetBatch &&
				normalizeModifierKey(item) === targetModifierKey
			);
		});
		if (match) {
			// If found, increment quantity
			match.qty += newItem.qty || 1;
			match.amount = match.qty * match.rate;
		} else {
			if (context && context.invoiceStore) {
				context.invoiceStore.addItem(newItem);
			} else {
				items.push({ ...newItem });
			}
		}
	}

	// Debounced version for rapid additions
	const groupAndAddItemDebounced = _.debounce(groupAndAddItem, 50);

	return {
		shouldIndexItem,
		buildMergeKey,
		ensureMergeCache,
		findMergeTarget,
		refreshMergeCacheEntry,
		invalidateMergeCache,
		moveItemToTop,
		groupAndAddItem,
		groupAndAddItemDebounced,
	};
}
