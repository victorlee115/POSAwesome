import api from "./api";

export interface ModifierValidationItem {
	item_code: string;
	posa_row_id?: string;
	rate?: number;
	price_list_rate?: number;
	posa_modifiers_json?: string;
}

export interface CupLabelPayloadItem {
	invoice_name: string;
	invoice_doctype: string;
	line_id: string;
	line_idx: number;
	label_id: string;
	line_cup_index: number;
	line_cup_total: number;
	order_sequence: number;
	order_sequence_total: number;
	order_token: string;
	queue_token: string;
	item_code: string;
	item_name: string;
	drink_name?: string;
	qty: number;
	cup_qty?: number;
	prep_status?: string;
	drink_code?: string;
	modifiers?: string;
	modifiers_compact?: string;
	alerts?: string;
	cup_customer_name?: string;
	is_prep_item?: number;
}

export interface CupLabelPayload {
	invoice: {
		name: string;
		doctype: string;
		posting_date?: string;
		posting_time?: string;
		customer?: string;
		customer_name?: string;
		order_token?: string;
		cup_customer_name?: string;
	};
	labels: CupLabelPayloadItem[];
}

const matchaService = {
	getModifierProfile(itemCode: string, posProfile?: string) {
		return api.call("posawesome.posawesome.api.modifiers.get_modifier_profile", {
			item_code: itemCode,
			pos_profile: posProfile,
		});
	},

	validateAndPrice(payload: {
		pos_profile?: string;
		items: ModifierValidationItem[];
	}) {
		return api.call("posawesome.posawesome.api.modifiers.validate_and_price", {
			invoice_payload: JSON.stringify(payload || {}),
		});
	},

	getPrepQueue(args: { pos_profile?: string; status?: string; limit?: number } = {}) {
		return api.call("posawesome.posawesome.api.prep.get_prep_queue", args);
	},

	transitionPrepStatus(invoiceName: string, lineId: string, status: string) {
		return api.call("posawesome.posawesome.api.prep.transition_status", {
			invoice_name: invoiceName,
			line_id: lineId,
			status,
		});
	},

	getLabelPayload(invoiceName: string) {
		return api.call<CupLabelPayload>("posawesome.posawesome.api.labels.get_label_payload", {
			invoice_name: invoiceName,
		});
	},

	logCupLabelReprint(args: {
		invoice_name: string;
		line_id?: string;
		label_id?: string;
		result?: string;
	}) {
		return api.call("posawesome.posawesome.api.cup_labels.log_reprint_event", args);
	},
};

export default matchaService;
