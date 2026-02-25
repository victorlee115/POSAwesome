// Copyright (c) 20201 Youssef Restom and contributors
// For license information, please see license.txt

frappe.ui.form.on("POS Profile", {
	setup: function (frm) {
		frm.set_query("posa_cash_mode_of_payment", function (doc) {
			return {
				filters: { type: "Cash" },
			};
		});

		frm.set_query("posa_default_expense_account", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					root_type: "Expense",
				},
			};
		});

		frm.set_query("posa_back_office_cash_account", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Cash",
				},
			};
		});

		frm.set_query("posa_default_source_account", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Cash",
				},
			};
		});

		frm.set_query("account", "posa_allowed_expense_accounts", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					root_type: "Expense",
				},
			};
		});

		frm.set_query("account", "posa_allowed_source_accounts", function (doc) {
			return {
				filters: {
					company: doc.company,
					is_group: 0,
					account_type: "Cash",
				},
			};
		});

		frappe.call({
			method: "posawesome.posawesome.api.utilities.get_language_options",
			callback: function (r) {
				if (!r.exc) {
					frm.fields_dict["posa_language"].df.options = r.message;
					frm.refresh_field("posa_language");
				}
			},
		});
	},

	refresh: function (frm) {
		if (frm.is_new()) {
			return;
		}

		frm.add_custom_button(
			__("Setup Matcha Menu"),
			() => {
				frappe.confirm(
					__(
						"This will create/update matcha drink items, prices, and modifier profiles for this POS Profile. Continue?",
					),
					() => {
						frappe.call({
							method: "posawesome.posawesome.api.matcha_setup.setup_matcha_takeaway_menu",
							args: {
								pos_profile: frm.doc.name,
							},
							freeze: true,
							freeze_message: __("Setting up matcha menu..."),
							callback: function (r) {
								if (r.exc || !r.message) {
									return;
								}
								const message = r.message || {};
								const createdCount = Array.isArray(message.created_items)
									? message.created_items.length
									: 0;
								const updatedCount = Array.isArray(message.updated_items)
									? message.updated_items.length
									: 0;
								frappe.msgprint({
									title: __("Matcha Menu Ready"),
									indicator: "green",
									message: __(
										"Created: {0}<br>Updated: {1}<br>Price List: {2}",
										[
											createdCount,
											updatedCount,
											message.price_list || __("Not set"),
										],
									),
								});
								frm.reload_doc();
							},
						});
					},
				);
			},
			__("POS Awesome"),
		);
	},
});
