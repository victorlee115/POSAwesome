from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document


class POSAModifierProfile(Document):
    def validate(self):
        self._validate_options()

    def _validate_options(self):
        if not self.options:
            frappe.throw(_("Add at least one modifier option row."))

        seen_group_option = set()
        defaults_per_group = {}

        for row in self.options:
            group_name = (row.group_name or "").strip()
            option_value = (row.option_value or row.option_label or "").strip()

            if not group_name:
                frappe.throw(_("Modifier group name is required for every option."))

            if not option_value:
                frappe.throw(_("Option value is required for group {0}.").format(group_name))

            row.group_name = group_name
            row.option_value = option_value

            dedupe_key = (group_name.lower(), option_value.lower())
            if dedupe_key in seen_group_option:
                frappe.throw(
                    _("Duplicate option {0} found in group {1}.").format(option_value, group_name)
                )
            seen_group_option.add(dedupe_key)

            if row.is_default:
                default_key = group_name.lower()
                if default_key in defaults_per_group:
                    frappe.throw(
                        _("Only one default option is allowed in group {0}.").format(group_name)
                    )
                defaults_per_group[default_key] = option_value

            if row.parent_option_group and not row.parent_option_value:
                frappe.throw(
                    _(
                        "Row {0}: Parent option value is required when parent group is set."
                    ).format(row.idx)
                )

        self.option_count = len(self.options)
