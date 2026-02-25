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
        "POS Profile": [
            {
                "fieldname": "posa_enable_cup_labels",
                "label": "Enable Cup Labels",
                "fieldtype": "Check",
                "default": "1",
                "insert_after": "posa_enable_prep_queue",
            },
            {
                "fieldname": "posa_require_cup_customer_name",
                "label": "Require Cup Customer Name",
                "fieldtype": "Check",
                "default": "1",
                "insert_after": "posa_enable_cup_labels",
            },
            {
                "fieldname": "posa_cup_label_printer_ip",
                "label": "Cup Label Printer IP",
                "fieldtype": "Data",
                "insert_after": "posa_require_cup_customer_name",
            },
            {
                "fieldname": "posa_cup_label_printer_port",
                "label": "Cup Label Printer Port",
                "fieldtype": "Int",
                "default": "9100",
                "insert_after": "posa_cup_label_printer_ip",
            },
            {
                "fieldname": "posa_cup_label_terminal_code",
                "label": "Cup Label Terminal Code",
                "fieldtype": "Data",
                "default": "A",
                "insert_after": "posa_cup_label_printer_port",
                "description": "Prefix used in generated order tokens for cup labels.",
            },
        ],
        "POS Invoice": [
            {
                "fieldname": "posa_order_token",
                "label": "POSA Order Token",
                "fieldtype": "Data",
                "insert_after": "posa_authorization_code",
                "read_only": 1,
            },
            {
                "fieldname": "posa_cup_customer_name",
                "label": "POSA Cup Customer Name",
                "fieldtype": "Data",
                "insert_after": "posa_order_token",
                "read_only": 1,
            },
        ],
        "Sales Invoice": [
            {
                "fieldname": "posa_order_token",
                "label": "POSA Order Token",
                "fieldtype": "Data",
                "insert_after": "posa_authorization_code",
                "read_only": 1,
            },
            {
                "fieldname": "posa_cup_customer_name",
                "label": "POSA Cup Customer Name",
                "fieldtype": "Data",
                "insert_after": "posa_order_token",
                "read_only": 1,
            },
        ],
        "POS Invoice Item": [
            {
                "fieldname": "posa_is_prep_item",
                "label": "POSA Is Prep Item",
                "fieldtype": "Check",
                "default": "0",
                "insert_after": "posa_drink_code",
            },
        ],
        "Sales Invoice Item": [
            {
                "fieldname": "posa_is_prep_item",
                "label": "POSA Is Prep Item",
                "fieldtype": "Check",
                "default": "0",
                "insert_after": "posa_drink_code",
            },
        ],
    }

    for doctype, definitions in fields.items():
        for definition in definitions:
            _upsert_custom_field(doctype, definition)

    frappe.clear_cache(doctype="POS Profile")
    frappe.clear_cache(doctype="POS Invoice")
    frappe.clear_cache(doctype="Sales Invoice")
