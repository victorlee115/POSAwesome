type AnyRecord = Record<string, any>;

export interface CupLabelJob {
	labelId: string;
	invoiceName: string;
	lineId: string;
	lineIdx: number;
	lineCupIndex: number;
	lineCupTotal: number;
	orderSequence: number;
	orderSequenceTotal: number;
	orderToken: string;
	cupName: string;
	drinkName: string;
	modifiers: string;
	alerts: string;
	qrPayload: string;
}

export interface CupPrinterConfig {
	enabled: boolean;
	ip: string;
	port: number;
}

export interface CupPrintFailure {
	labelId?: string;
	reason: string;
}

export interface CupPrintResult {
	ok: boolean;
	sentCount: number;
	failures: CupPrintFailure[];
}

type FullyApi = {
	sendHexDataToTcpPort?: (_hex: string, _ip: string, _port: number) => boolean;
};

const ORDER_TOKEN_MAX = 8;
const CUP_NAME_MAX = 24;
const DRINK_NAME_MAX = 24;
const MODIFIERS_MAX = 48;
const ALERTS_MAX = 24;
const LABEL_ID_MAX = 64;
const DAILY_COUNTER_KEY_PREFIX = "posa:cup_token";
const FAILED_JOBS_KEY = "posa:cup_label_failed_jobs";
const FAILED_JOBS_LIMIT = 20;

const orderedModifierGroups: Array<{ label: string; aliases: string[] }> = [
	{ label: "TEMPERATURE", aliases: ["temperature", "temp"] },
	{ label: "SIZE", aliases: ["size"] },
	{ label: "MILK", aliases: ["milk"] },
	{ label: "SWEETNESS", aliases: ["sweetness", "sugar", "sweet"] },
	{ label: "ICE", aliases: ["ice", "ice level"] },
];

const normalizeBoolean = (value: any): boolean => {
	if (value === true || value === 1 || value === "1") return true;
	if (typeof value === "string") {
		const text = value.trim().toLowerCase();
		return text === "true" || text === "yes" || text === "on";
	}
	return false;
};

const normalizeBooleanWithDefault = (value: any, defaultValue: boolean): boolean => {
	if (value === undefined || value === null || value === "") {
		return defaultValue;
	}
	return normalizeBoolean(value);
};

const localDateKey = () => {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, "0");
	const d = String(now.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
};

const nowHHMM = () => {
	const now = new Date();
	return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

const printableAscii = (value: any) =>
	String(value || "")
		.replace(/[^\x20-\x7E]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const truncate = (value: string, max: number) => value.slice(0, Math.max(0, max)).trim();

const upperAscii = (value: any, max: number) => truncate(printableAscii(value).toUpperCase(), max);

const tsplSafe = (value: any, max: number) =>
	upperAscii(value, max)
		.replace(/["\\]/g, " ")
		.replace(/\s+/g, " ")
		.trim();

const nextDailyCounter = (profileName: string) => {
	try {
		const key = `${DAILY_COUNTER_KEY_PREFIX}:${profileName || "default"}:${localDateKey()}`;
		const current = Number.parseInt(localStorage.getItem(key) || "0", 10) || 0;
		const next = current + 1;
		localStorage.setItem(key, String(next));
		return next;
	} catch (_error) {
		return Date.now() % 1000;
	}
};

const resolveOrderToken = (invoiceDoc: AnyRecord, posProfile: AnyRecord) => {
	const existing = upperAscii(invoiceDoc?.posa_order_token, ORDER_TOKEN_MAX);
	if (existing) {
		invoiceDoc.posa_order_token = existing;
		return existing;
	}

	const terminal = upperAscii(posProfile?.posa_cup_label_terminal_code || "A", 2) || "A";
	const counter = String(nextDailyCounter(String(posProfile?.name || ""))).padStart(3, "0");
	const generated = upperAscii(`${terminal}${counter}`, ORDER_TOKEN_MAX);
	invoiceDoc.posa_order_token = generated;
	return generated;
};

const resolveCupName = (invoiceDoc: AnyRecord) => {
	const persisted = printableAscii(invoiceDoc?.posa_cup_customer_name);
	if (persisted) {
		return truncate(persisted, CUP_NAME_MAX);
	}
	const fallback = printableAscii(invoiceDoc?.customer_name || invoiceDoc?.customer || "");
	return truncate(fallback, CUP_NAME_MAX);
};

const toCupCount = (qty: any) => {
	const parsed = Math.abs(Number.parseFloat(String(qty ?? "0")));
	if (!Number.isFinite(parsed) || parsed <= 0) return 1;
	return Math.max(1, Math.ceil(parsed));
};

const parseSelections = (raw: any): Record<string, string[]> => {
	if (!raw) return {};
	let payload: any = raw;
	if (typeof raw === "string") {
		try {
			payload = JSON.parse(raw);
		} catch (_error) {
			return {};
		}
	}
	const selections = payload?.selections && typeof payload.selections === "object" ? payload.selections : payload;
	if (!selections || typeof selections !== "object") return {};

	const normalized: Record<string, string[]> = {};
	for (const [group, value] of Object.entries(selections)) {
		const values: string[] = [];
		if (Array.isArray(value)) {
			for (const entry of value) {
				if (entry && typeof entry === "object") {
					values.push(printableAscii((entry as any).label || (entry as any).value || ""));
				} else {
					values.push(printableAscii(entry));
				}
			}
		} else if (value && typeof value === "object") {
			values.push(printableAscii((value as any).label || (value as any).value || ""));
		} else {
			values.push(printableAscii(value));
		}
		const cleaned = values.filter(Boolean);
		if (cleaned.length) normalized[printableAscii(group)] = cleaned;
	}
	return normalized;
};

const normalizeGroupKey = (key: string) => printableAscii(key).toLowerCase().trim();

const prettyMilkValue = (v: string) => {
  const u = upperAscii(v, 24);
  if (u === "MILK") return "DAIRY MILK";
  if (u === "OAT") return "OAT MILK";
  if (u === "SOY") return "SOY MILK";
  if (u === "ALMOND") return "ALMOND MILK";
  return u; // fallback
};

const prettySugarValue = (v: string) => {
  const u = upperAscii(v, 24);
  // keep percentages as-is; append "SUGAR" later
  if (u === "0") return "0%";
  if (u === "50") return "50%";
  if (u === "100") return "100%";
  return u; // e.g. "0%","50%","100%"
};

const getOrderedModifierText = (item: AnyRecord) => {
  const grouped = parseSelections(item?.posa_modifiers_json);

  // Find keys in a tolerant way
  const milkKey = Object.keys(grouped).find((k) => ["milk", "milk options"].includes(normalizeGroupKey(k)));
  const sugarKey = Object.keys(grouped).find((k) => ["sugar", "sweetness", "sugar level"].includes(normalizeGroupKey(k)));

  const parts: string[] = [];

  if (milkKey) {
    const values = grouped[milkKey] || [];
	const [first] = values;              // first: string | undefined
	const milk = first ? prettyMilkValue(first) : "";
	if (milk) parts.push(milk);
  }

  if (sugarKey) {
    const values = grouped[sugarKey] || [];
	const [first] = values;
	const sugar = first ? prettySugarValue(first) : "";
	if (sugar) parts.push(`${sugar} SUGAR`);
  }

  // If we got at least one of milk/sugar, return clean output
  if (parts.length) {
    return truncate(parts.join(", "), MODIFIERS_MAX);
  }

  // Fallback to old behavior if nothing matched
  const fallback = printableAscii(item?.posa_modifier_summary || "");
  return truncate(fallback, MODIFIERS_MAX);
};

const deriveAlerts = (drinkName: string, modifiers: string) => {
	const text = `${drinkName} ${modifiers}`.toLowerCase();
	const alerts: string[] = [];

	if (text.includes("milk") || text.includes("dairy") || text.includes("whole") || text.includes("skim")) {
		alerts.push("ALLERGEN: MILK");
	} else if (text.includes("soy")) {
		alerts.push("ALLERGEN: SOY");
	} else if (text.includes("almond") || text.includes("nut")) {
		alerts.push("ALLERGEN: NUT");
	}

	if (text.includes("no ice")) alerts.push("NO ICE");
	if (text.includes("decaf")) alerts.push("DECAF");
	if (text.includes("extra hot")) alerts.push("EXTRA HOT");

	return truncate(alerts.join("|"), ALERTS_MAX);
};

const isPrepItem = (item: AnyRecord) => {
	if (normalizeBoolean(item?.posa_is_prep_item)) return true;
	return Boolean(item?.posa_drink_code || item?.posa_modifiers_json);
};

const resolveLineId = (item: AnyRecord, index: number) =>
	printableAscii(item?.name || item?.posa_row_id || `LINE-${index + 1}`);

const resolveInvoiceName = (invoiceDoc: AnyRecord) => printableAscii(invoiceDoc?.name || "TEMP-INVOICE");

function wrapLines(
  text: string,
  maxCharsPerLine: number = 24,
  maxLines: number = 3
): string[] {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines: string[] = [];
  let cur = "";

  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + " " + w).length <= maxCharsPerLine) cur += " " + w;
    else {
      lines.push(cur);
      cur = w;
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);

  while (lines.length < maxLines) lines.push("");

  // add ellipsis if we truncated
  const full = words.join(" ");
  const shown = lines.join(" ").trim();
  if (shown.length < full.length && maxLines > 0) {
    // Use ASCII dots because tsplSafe() strips non-ASCII like "…"
	const cut = Math.max(0, maxCharsPerLine - 3);
	lines[maxLines - 1] = lines[maxLines - 1].slice(0, cut) + "...";
  }

  return lines;
}

const buildTspl = (job: CupLabelJob) => {
  const header = tsplSafe(`${job.orderToken} ${job.orderSequence}/${job.orderSequenceTotal}`, 26);
  const cupName = tsplSafe(job.cupName, 18);
  const drinkName = tsplSafe(job.drinkName, 18);

  // 3 lines of modifiers, 24 chars each
  const normalizedMods = (job.modifiers || "")
  .replace(/\s*\|\s*/g, ", ")
  .replace(/\s+/g, " ")
  .trim();

  const [m1, m2, m3] = wrapLines(normalizedMods, 24, 3).map((s) => tsplSafe(s, 24));
  return (
    "SIZE 40 mm,30 mm\r\n" +
    "GAP 3 mm,0\r\n" +
    "DIRECTION 0\r\n" +
    "REFERENCE 10,22\r\n" +
    "SPEED 4\r\n" +
    "DENSITY 8\r\n" +
    "CLS\r\n" +
    `TEXT 0,4,"0",0,1,1,"${header}"\r\n` +
    `TEXT 0,20,"0",0,1,1,"${cupName}"\r\n` +
    `TEXT 0,44,"0",0,2,2,"${drinkName}"\r\n` +
    `TEXT 0,92,"0",0,1,1,"${m1}"\r\n` +
    `TEXT 0,112,"0",0,1,1,"${m2}"\r\n` +
    `TEXT 0,132,"0",0,1,1,"${m3}"\r\n` +
    "PRINT 1,1\r\n"
  );
};

const toHex = (tspl: string) => {
	const bytes = new TextEncoder().encode(tspl);
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
};

const getFullyApi = (): FullyApi | null => {
	if (typeof window === "undefined") return null;
	return (window as any).fully || null;
};

const appendFailureJobs = (jobs: CupLabelJob[], reason: string) => {
	try {
		const now = Date.now();
		const prev = JSON.parse(localStorage.getItem(FAILED_JOBS_KEY) || "[]");
		const next = (Array.isArray(prev) ? prev : []).concat(
			jobs.map((job) => ({
				timestamp: now,
				reason,
				label_id: job.labelId,
				invoice_name: job.invoiceName,
			})),
		);
		localStorage.setItem(FAILED_JOBS_KEY, JSON.stringify(next.slice(-FAILED_JOBS_LIMIT)));
	} catch (_error) {
		// Ignore localStorage failures for print telemetry.
	}
};

export const getCupPrinterConfig = (posProfile: AnyRecord): CupPrinterConfig => {
	const enabled = normalizeBooleanWithDefault(posProfile?.posa_enable_cup_labels, true);
	const ip = printableAscii(posProfile?.posa_cup_label_printer_ip || "");
	const port = Number.parseInt(String(posProfile?.posa_cup_label_printer_port || "9100"), 10) || 9100;
	return { enabled, ip, port };
};

export const buildCupLabelJobs = (invoiceDoc: AnyRecord, posProfile: AnyRecord): CupLabelJob[] => {
	if (!invoiceDoc || !Array.isArray(invoiceDoc.items) || !invoiceDoc.items.length) return [];

	const invoiceName = resolveInvoiceName(invoiceDoc);
	const orderToken = resolveOrderToken(invoiceDoc, posProfile || {});
	const cupName = resolveCupName(invoiceDoc);
	const jobs: Omit<CupLabelJob, "orderSequence" | "orderSequenceTotal">[] = [];

	invoiceDoc.posa_order_token = orderToken;
	invoiceDoc.posa_cup_customer_name = cupName;

	for (let lineIdx = 0; lineIdx < invoiceDoc.items.length; lineIdx += 1) {
		const item = invoiceDoc.items[lineIdx];
		if (!isPrepItem(item)) continue;

		const lineId = resolveLineId(item, lineIdx);
		const cups = toCupCount(item?.qty);
		const drinkName = truncate(printableAscii(item?.item_name || item?.item_code || "DRINK"), DRINK_NAME_MAX);
		const modifiers = getOrderedModifierText(item);
		const alerts = deriveAlerts(drinkName, modifiers);

		for (let cupIndex = 1; cupIndex <= cups; cupIndex += 1) {
			const labelId = truncate(`${invoiceName}|${lineId}|${cupIndex}`, LABEL_ID_MAX);
			jobs.push({
				labelId,
				invoiceName,
				lineId,
				lineIdx: Number(item?.idx || lineIdx + 1),
				lineCupIndex: cupIndex,
				lineCupTotal: cups,
				orderToken,
				cupName,
				drinkName,
				modifiers,
				alerts,
				qrPayload: `${orderToken}|${labelId}`,
			});
		}
	}

	const orderTotal = jobs.length;
	return jobs.map((job, idx) => ({
		...job,
		orderSequence: idx + 1,
		orderSequenceTotal: orderTotal,
	}));
};

export const printSingleCup = (
	job: CupLabelJob,
	config: CupPrinterConfig,
): CupPrintResult => {
	if (!config?.enabled) {
		return {
			ok: true,
			sentCount: 0,
			failures: [],
		};
	}

	if (!config.ip || !config.port) {
		return {
			ok: false,
			sentCount: 0,
			failures: [{ labelId: job?.labelId, reason: "Missing cup label printer IP/port configuration" }],
		};
	}

	const fully = getFullyApi();
	if (!fully?.sendHexDataToTcpPort) {
		return {
			ok: false,
			sentCount: 0,
			failures: [{ labelId: job?.labelId, reason: "Fully Kiosk TCP API unavailable" }],
		};
	}

	try {
		const tspl = buildTspl(job);
		const hex = toHex(tspl);
		const sent = Boolean(fully.sendHexDataToTcpPort(hex, config.ip, config.port));
		if (!sent) {
			return {
				ok: false,
				sentCount: 0,
				failures: [{ labelId: job?.labelId, reason: "Printer send returned false" }],
			};
		}
		return {
			ok: true,
			sentCount: 1,
			failures: [],
		};
	} catch (error: any) {
		return {
			ok: false,
			sentCount: 0,
			failures: [{ labelId: job?.labelId, reason: error?.message || "Unknown print error" }],
		};
	}
};

export const printCupJobs = (
	jobs: CupLabelJob[],
	config: CupPrinterConfig,
): CupPrintResult => {
	if (!jobs.length || !config?.enabled) {
		return { ok: true, sentCount: 0, failures: [] };
	}

	let sentCount = 0;
	const failures: CupPrintFailure[] = [];

	for (const job of jobs) {
		const result = printSingleCup(job, config);
		sentCount += result.sentCount;
		if (result.failures.length) {
			failures.push(...result.failures);
		}
	}

	if (failures.length) {
		appendFailureJobs(jobs, failures[0]?.reason || "cup-label-print-failure");
	}

	return {
		ok: failures.length === 0,
		sentCount,
		failures,
	};
};
