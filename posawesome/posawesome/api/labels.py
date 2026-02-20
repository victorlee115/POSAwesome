from __future__ import annotations

import json

import frappe
from frappe import _

from posawesome.posawesome.api.modifiers import derive_drink_code


def _resolve_parent_doctype(invoice_name: str) -> str:
    if frappe.db.exists("POS Invoice", invoice_name):
        return "POS Invoice"
    if frappe.db.exists("Sales Invoice", invoice_name):
        return "Sales Invoice"
    frappe.throw(_("Invoice {0} was not found").format(invoice_name))


def _parse_modifiers(value):
    if not value:
        return {}
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return {}
    return {}


def _condense_modifiers(modifiers_payload) -> str:
    payload = _parse_modifiers(modifiers_payload)
    selections = payload.get("selections") if isinstance(payload, dict) else {}

    if not isinstance(selections, dict):
        return ""

    parts = []
    for group_name, value in selections.items():
        if not value:
            continue

        if isinstance(value, list):
            labels = []
            for row in value:
                if isinstance(row, dict):
                    labels.append(str(row.get("label") or row.get("value") or "").strip())
                else:
                    labels.append(str(row).strip())
            cleaned = [entry for entry in labels if entry]
            if cleaned:
                parts.append(f"{group_name}: {', '.join(cleaned)}")
            continue

        if isinstance(value, dict):
            label = str(value.get("label") or value.get("value") or "").strip()
            if label:
                parts.append(f"{group_name}: {label}")
            continue

        parts.append(f"{group_name}: {str(value).strip()}")

    return " | ".join(parts)


@frappe.whitelist()
def get_label_payload(invoice_name: str):
    parent_doctype = _resolve_parent_doctype(invoice_name)
    doc = frappe.get_doc(parent_doctype, invoice_name)

    labels = []
    for row in doc.get("items") or []:
        modifiers_short = row.get("posa_modifier_summary") or _condense_modifiers(
            row.get("posa_modifiers_json")
        )
        labels.append(
            {
                "invoice_name": doc.name,
                "invoice_doctype": parent_doctype,
                "line_id": row.name,
                "line_idx": row.idx,
                "queue_token": f"{str(doc.name).split('-')[-1]}-{row.idx}",
                "item_code": row.item_code,
                "item_name": row.item_name,
                "qty": row.qty,
                "prep_status": row.get("posa_prep_status") or "Paid",
                "drink_code": row.get("posa_drink_code") or derive_drink_code(row.item_code),
                "modifiers": modifiers_short,
            }
        )

    return {
        "invoice": {
            "name": doc.name,
            "doctype": parent_doctype,
            "posting_date": doc.posting_date,
            "posting_time": doc.posting_time,
            "customer": doc.customer,
        },
        "labels": labels,
    }
