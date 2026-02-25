export type ModifierOption = {
	label: string;
	value: string;
	code?: string;
	price_delta?: number;
	is_default?: boolean;
	parent_option_group?: string;
	parent_option_value?: string;
};

export type ModifierGroup = {
	name: string;
	required?: boolean;
	allow_multiple?: boolean;
	options: ModifierOption[];
};

export type ModifierProfilePayload = {
	profile?: string | null;
	groups?: ModifierGroup[];
	defaults?: Record<string, string[]>;
	drink_code_prefix?: string | null;
	default_prep_status?: string;
};

const isOptionVisible = (
	option: ModifierOption | undefined,
	selections: Record<string, string[]>,
): boolean => {
	if (!option) {
		return false;
	}
	const parentGroup = String(option.parent_option_group || "").trim();
	const parentValue = String(option.parent_option_value || "").trim();
	if (!parentGroup) {
		return true;
	}
	const selectedParentValues = selections[parentGroup] || [];
	return selectedParentValues.includes(parentValue);
};

export function normalizeModifierSelections(
	input: unknown,
): Record<string, string[]> {
	if (!input || typeof input !== "object") {
		return {};
	}

	const source = (input as any).selections && typeof (input as any).selections === "object"
		? (input as any).selections
		: (input as any);

	const normalized: Record<string, string[]> = {};
	Object.entries(source).forEach(([groupName, value]) => {
		if (!value) {
			return;
		}

		const values: string[] = [];
		if (Array.isArray(value)) {
			value.forEach((entry) => {
				if (!entry) {
					return;
				}
				if (typeof entry === "object") {
					const objectValue =
						(entry as any).value ||
						(entry as any).option_value ||
						(entry as any).label;
					if (objectValue) {
						values.push(String(objectValue));
					}
					return;
				}
				values.push(String(entry));
			});
		} else if (typeof value === "object") {
			const objectValue =
				(value as any).value ||
				(value as any).option_value ||
				(value as any).label;
			if (objectValue) {
				values.push(String(objectValue));
			}
		} else {
			values.push(String(value));
		}

		const cleaned = values.map((entry) => entry.trim()).filter(Boolean);
		if (cleaned.length) {
			normalized[groupName] = cleaned;
		}
	});

	return normalized;
}

export function buildDefaultSelections(
	profile: ModifierProfilePayload | null | undefined,
): Record<string, string[]> {
	if (!profile) {
		return {};
	}

	if (profile.defaults && typeof profile.defaults === "object") {
		return normalizeModifierSelections(profile.defaults);
	}

	const defaults: Record<string, string[]> = {};
	(profile.groups || []).forEach((group) => {
		if (!group || !group.name || !Array.isArray(group.options) || !group.options.length) {
			return;
		}
		const explicit = group.options.filter((option) => option?.is_default);
		if (explicit.length) {
			defaults[group.name] = explicit.map((option) => String(option.value));
			return;
		}
		const firstOption = group.options[0];
		if (group.required && firstOption) {
			defaults[group.name] = [String(firstOption.value)];
		}
	});

	return defaults;
}

export function buildModifierSignature(selections: Record<string, string[]>): string {
	const entries: Array<[string, string[]]> = Object.entries(selections)
		.map(([group, values]): [string, string[]] => [
			group,
			(values || []).map((value) => String(value).trim()).filter(Boolean).sort(),
		])
		.filter(([, values]) => values.length > 0)
		.sort(([a], [b]) => String(a).localeCompare(String(b)));

	return JSON.stringify(entries);
}

export function buildModifierSummary(
	profile: ModifierProfilePayload | null | undefined,
	selections: Record<string, string[]>,
): { summary: string; delta: number; optionCodes: string[] } {
	if (!profile || !Array.isArray(profile.groups)) {
		return {
			summary: "",
			delta: 0,
			optionCodes: [],
		};
	}

	const labelParts: string[] = [];
	const optionCodes: string[] = [];
	let delta = 0;
	const prunedSelections = pruneModifierSelections(profile, selections);

	profile.groups.forEach((group) => {
		const selectedValues = prunedSelections[group.name] || [];
		if (!selectedValues.length) {
			return;
		}

		selectedValues.forEach((value) => {
			const option = (group.options || []).find(
				(entry) => entry.value === value && isOptionVisible(entry, prunedSelections),
			);
			if (!option) {
				labelParts.push(value);
				return;
			}
			labelParts.push(option.label || option.value || value);
			delta += Number(option.price_delta || 0);
			if (option.code) {
				optionCodes.push(option.code);
			}
		});
	});

	return {
		summary: labelParts.join(" / "),
		delta,
		optionCodes,
	};
}

export function pruneModifierSelections(
	profile: ModifierProfilePayload | null | undefined,
	selections: Record<string, string[]>,
): Record<string, string[]> {
	const normalized = normalizeModifierSelections(selections);
	if (!profile || !Array.isArray(profile.groups) || !profile.groups.length) {
		return normalized;
	}

	let current = { ...normalized };
	const maxIterations = profile.groups.length + 2;

	for (let i = 0; i < maxIterations; i += 1) {
		let changed = false;
		const next: Record<string, string[]> = {};

		profile.groups.forEach((group) => {
			const groupName = group?.name;
			if (!groupName) {
				return;
			}
			const selectedValues = current[groupName] || [];
			if (!selectedValues.length) {
				return;
			}
			const visibleValues = new Set(
				(group.options || [])
					.filter((option) => isOptionVisible(option, current))
					.map((option) => option.value),
			);

			const cleanedValues = selectedValues.filter((value) => visibleValues.has(value));
			if (cleanedValues.length) {
				next[groupName] = cleanedValues;
			}
			if (cleanedValues.length !== selectedValues.length) {
				changed = true;
			}
		});

		current = next;
		if (!changed) {
			break;
		}
	}

	return current;
}

export function buildDrinkCode(
	itemCode: string,
	prefix: string | null | undefined,
	optionCodes: string[] = [],
): string {
	const slug = (value: string) =>
		value
			.replace(/[^A-Za-z0-9]+/g, "-")
			.replace(/(^-|-$)/g, "")
			.toUpperCase()
			.slice(0, 10);

	const parts: string[] = [];
	if (prefix) {
		const p = slug(prefix);
		if (p) {
			parts.push(p);
		}
	}

	const item = slug(itemCode || "DRINK") || "DRINK";
	parts.push(item);

	optionCodes.forEach((code) => {
		const token = slug(code);
		if (token) {
			parts.push(token);
		}
	});

	return parts.join("-").slice(0, 48);
}
