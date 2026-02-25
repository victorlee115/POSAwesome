from __future__ import annotations

import json
import math
import re
from collections import OrderedDict

import frappe
from frappe import _
from frappe.utils import cint

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


def _normalize_modifier_values(value) -> list[str]:
    values: list[str] = []

    if isinstance(value, list):
        for row in value:
            if isinstance(row, dict):
                values.append(str(row.get("label") or row.get("value") or "").strip())
            else:
                values.append(str(row or "").strip())
    elif isinstance(value, dict):
        values.append(str(value.get("label") or value.get("value") or "").strip())
    else:
        values.append(str(value or "").strip())

    return [entry for entry in values if entry]


def _extract_grouped_modifiers(modifiers_payload) -> OrderedDict[str, list[str]]:
    payload = _parse_modifiers(modifiers_payload)
    selections = payload.get("selections") if isinstance(payload, dict) else {}

    if not isinstance(selections, dict):
        return OrderedDict()

    grouped: OrderedDict[str, list[str]] = OrderedDict()
    for group_name, value in selections.items():
        cleaned = _normalize_modifier_values(value)
        if cleaned:
            grouped[str(group_name).strip()] = cleaned
    return grouped


def _find_group_value(grouped: OrderedDict[str, list[str]], aliases: tuple[str, ...]):
    alias_set = {alias.lower() for alias in aliases}
    for key, values in grouped.items():
        if key.strip().lower() in alias_set:
            return key, values
    return None, None


def _compact_modifier_text(modifiers_payload) -> str:
    grouped = _extract_grouped_modifiers(modifiers_payload)
    if not grouped:
        return ""

    order = (
        ("TEMPERATURE", ("temperature", "temp")),
        ("SIZE", ("size",)),
        ("MILK", ("milk",)),
        ("SWEETNESS", ("sweetness", "sugar", "sweet")),
        ("ICE", ("ice", "ice level")),
    )

    parts: list[str] = []
    consumed_keys: set[str] = set()

    for label, aliases in order:
        key, values = _find_group_value(grouped, aliases)
        if key and values:
            consumed_keys.add(key)
            parts.append(f"{label} {'/'.join(values)}")

    for key, values in grouped.items():
        if key in consumed_keys:
            continue
        normalized_key = re.sub(r"\s+", " ", str(key).strip()).upper()
        if not normalized_key:
            continue
        parts.append(f"{normalized_key} {'/'.join(values)}")

    return " | ".join(parts)


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


def _to_cup_count(qty) -> int:
    try:
        numeric_qty = abs(float(qty))
    except Exception:
        numeric_qty = 1.0

    if numeric_qty <= 0:
        return 1
    return max(1, int(math.ceil(numeric_qty)))


def _is_prep_item(row) -> bool:
    raw = row.get("posa_is_prep_item")
    if raw in (1, "1", True, "true", "True", "YES", "Yes", "yes"):
        return True
    if raw in (0, "0", False, "false", "False", "", None):
        return bool(row.get("posa_drink_code") or row.get("posa_modifiers_json"))
    return bool(raw)


def _derive_order_token(doc) -> str:
    token = str(doc.get("posa_order_token") or "").strip()
    if token:
        return token
    return str(doc.name).split("-")[-1]


def _derive_cup_customer_name(doc) -> str:
    value = str(doc.get("posa_cup_customer_name") or "").strip()
    if value:
        return value
    fallback = str(doc.get("customer_name") or doc.get("customer") or "").strip()
    return fallback


def _derive_alerts(item_name: str, modifiers_text: str) -> str:
    text = f"{item_name or ''} {modifiers_text or ''}".lower()
    alerts: list[str] = []

    if any(token in text for token in ("milk", "dairy", "whole", "skim", "creamer")):
        alerts.append("ALLERGEN: MILK")
    elif "soy" in text:
        alerts.append("ALLERGEN: SOY")
    elif "almond" in text or "nut" in text:
        alerts.append("ALLERGEN: NUT")

    if "no ice" in text:
        alerts.append("NO ICE")
    if "decaf" in text:
        alerts.append("DECAF")
    if "extra hot" in text:
        alerts.append("EXTRA HOT")

    return " | ".join(alerts[:2])


@frappe.whitelist()
def get_label_payload(invoice_name: str):
    parent_doctype = _resolve_parent_doctype(invoice_name)
    doc = frappe.get_doc(parent_doctype, invoice_name)

    order_token = _derive_order_token(doc)
    cup_customer_name = _derive_cup_customer_name(doc)

    expanded_labels = []
    for row in doc.get("items") or []:
        if not _is_prep_item(row):
            continue

        modifiers_short = row.get("posa_modifier_summary") or _condense_modifiers(
            row.get("posa_modifiers_json")
        )
        modifiers_compact = _compact_modifier_text(row.get("posa_modifiers_json")) or modifiers_short
        cup_count = _to_cup_count(row.get("qty"))

        for cup_index in range(1, cup_count + 1):
            line_id = row.name
            label_id = f"{doc.name}|{line_id}|{cup_index}"
            expanded_labels.append(
                {
                    "invoice_name": doc.name,
                    "invoice_doctype": parent_doctype,
                    "line_id": line_id,
                    "line_idx": row.idx,
                    "label_id": label_id,
                    "line_cup_index": cup_index,
                    "line_cup_total": cup_count,
                    "item_code": row.item_code,
                    "item_name": row.item_name,
                    "drink_name": row.item_name,
                    "qty": row.qty,
                    "cup_qty": 1,
                    "prep_status": row.get("posa_prep_status") or "Paid",
                    "drink_code": row.get("posa_drink_code") or derive_drink_code(row.item_code),
                    "modifiers": modifiers_short,
                    "modifiers_compact": modifiers_compact,
                    "alerts": _derive_alerts(row.item_name, modifiers_compact or modifiers_short),
                    "order_token": order_token,
                    "cup_customer_name": cup_customer_name,
                    "is_prep_item": cint(row.get("posa_is_prep_item") or 0),
                }
            )

    order_total = len(expanded_labels)
    labels = []
    for index, entry in enumerate(expanded_labels, start=1):
        row_token = f"{order_token}-{entry.get('line_idx')}"
        labels.append(
            {
                **entry,
                "order_sequence": index,
                "order_sequence_total": order_total,
                "queue_token": row_token,
            }
        )

    return {
        "invoice": {
            "name": doc.name,
            "doctype": parent_doctype,
            "posting_date": doc.posting_date,
            "posting_time": doc.posting_time,
            "customer": doc.customer,
            "customer_name": doc.get("customer_name"),
            "order_token": order_token,
            "cup_customer_name": cup_customer_name,
        },
        "labels": labels,
    }
