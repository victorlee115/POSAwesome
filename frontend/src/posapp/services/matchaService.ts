import api from "./api";

export interface ModifierValidationItem {
	item_code: string;
	posa_row_id?: string;
	rate?: number;
	price_list_rate?: number;
	posa_modifiers_json?: string;
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
		return api.call("posawesome.posawesome.api.labels.get_label_payload", {
			invoice_name: invoiceName,
		});
	},
};

export default matchaService;
