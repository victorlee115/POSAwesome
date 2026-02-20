frappe.ui.form.on("POSA Ingredient Rule", {
	setup(frm) {
		frm.set_query("pos_profile", () => {
			if (!frm.doc.company) {
				return {};
			}
			return {
				filters: {
					company: frm.doc.company,
				},
			};
		});
		frm.set_query("warehouse", () => {
			if (!frm.doc.company) {
				return { filters: { is_group: 0 } };
			}
			return {
				filters: {
					company: frm.doc.company,
					is_group: 0,
				},
			};
		});
	},
});
