frappe.ui.form.on("POSA Modifier Profile", {
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
	},
});
