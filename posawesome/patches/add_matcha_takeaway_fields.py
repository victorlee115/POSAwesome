from __future__ import annotations

import frappe
from frappe.custom.doctype.custom_field.custom_field import create_custom_field


def _upsert_custom_field(doctype: str, definition: dict):
    fieldname = definition["fieldname"]
    name = f"{doctype}-{fieldname}"

    if not frappe.db.exists("Custom Field", name):
        create_custom_field(doctype, definition)
        return

    updates = {
        key: value
        for key, value in definition.items()
        if key not in {"insert_after", "name", "owner", "creation", "modified"}
    }
    if updates:
        frappe.db.set_value("Custom Field", name, updates, update_modified=False)

    insert_after = definition.get("insert_after")
    if insert_after:
        frappe.db.set_value(
            "Custom Field",
            name,
            "insert_after",
            insert_after,
            update_modified=False,
        )


def execute():
    fields = {
        "Item": [
            {
                "fieldname": "posa_modifier_profile",
                "label": "POSA Modifier Profile",
                "fieldtype": "Link",
                "options": "POSA Modifier Profile",
                "insert_after": "variant_of",
                "in_standard_filter": 1,
            },
            {
                "fieldname": "posa_popular_rank",
                "label": "POSA Popular Rank",
                "fieldtype": "Int",
                "insert_after": "posa_modifier_profile",
                "description": "Lower number appears first in the one-tap popular drinks bar.",
            },
        ],
        "POS Profile": [
            {
                "fieldname": "posa_section_matcha_takeaway",
                "label": "Matcha Takeaway",
                "fieldtype": "Section Break",
                "insert_after": "posa_section_inventory_controls",
                "collapsible": 1,
            },
            {
                "fieldname": "posa_popular_items_json",
                "label": "Popular Items JSON",
                "fieldtype": "Long Text",
                "insert_after": "posa_section_matcha_takeaway",
                "description": "Optional JSON array of item codes for one-tap favorites.",
            },
            {
                "fieldname": "posa_enable_prep_queue",
                "label": "Enable Prep Queue",
                "fieldtype": "Check",
                "default": "1",
                "insert_after": "posa_popular_items_json",
            },
        ],
        "Sales Invoice Item": [
            {
                "fieldname": "posa_modifiers_json",
                "label": "POSA Modifiers JSON",
                "fieldtype": "Long Text",
                "insert_after": "posa_notes",
                "read_only": 1,
                "print_hide": 1,
            },
            {
                "fieldname": "posa_modifier_summary",
                "label": "POSA Modifier Summary",
                "fieldtype": "Data",
                "insert_after": "posa_modifiers_json",
                "read_only": 1,
            },
            {
                "fieldname": "posa_modifiers_delta",
                "label": "POSA Modifier Delta",
                "fieldtype": "Float",
                "insert_after": "posa_modifier_summary",
                "default": "0",
            },
            {
                "fieldname": "posa_prep_status",
                "label": "POSA Prep Status",
                "fieldtype": "Select",
                "options": "Paid\nIn Prep\nReady\nCollected",
                "insert_after": "posa_modifiers_delta",
                "default": "Paid",
                "in_standard_filter": 1,
            },
            {
                "fieldname": "posa_drink_code",
                "label": "POSA Drink Code",
                "fieldtype": "Data",
                "insert_after": "posa_prep_status",
                "in_list_view": 1,
            },
        ],
        "POS Invoice Item": [
            {
                "fieldname": "posa_modifiers_json",
                "label": "POSA Modifiers JSON",
                "fieldtype": "Long Text",
                "insert_after": "posa_notes",
                "read_only": 1,
                "print_hide": 1,
            },
            {
                "fieldname": "posa_modifier_summary",
                "label": "POSA Modifier Summary",
                "fieldtype": "Data",
                "insert_after": "posa_modifiers_json",
                "read_only": 1,
            },
            {
                "fieldname": "posa_modifiers_delta",
                "label": "POSA Modifier Delta",
                "fieldtype": "Float",
                "insert_after": "posa_modifier_summary",
                "default": "0",
            },
            {
                "fieldname": "posa_prep_status",
                "label": "POSA Prep Status",
                "fieldtype": "Select",
                "options": "Paid\nIn Prep\nReady\nCollected",
                "insert_after": "posa_modifiers_delta",
                "default": "Paid",
                "in_standard_filter": 1,
            },
            {
                "fieldname": "posa_drink_code",
                "label": "POSA Drink Code",
                "fieldtype": "Data",
                "insert_after": "posa_prep_status",
                "in_list_view": 1,
            },
        ],
    }

    for doctype, definitions in fields.items():
        for definition in definitions:
            _upsert_custom_field(doctype, definition)

    frappe.clear_cache(doctype="Item")
    frappe.clear_cache(doctype="POS Profile")
