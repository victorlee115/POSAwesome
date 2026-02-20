from __future__ import annotations

import json
import re
from collections import OrderedDict
from typing import Any

import frappe
from frappe import _
from frappe.utils import flt

ALLOWED_PREP_STATUSES = ("Paid", "In Prep", "Ready", "Collected")


def _parse_json(value: Any, default: Any):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            return json.loads(value)
        except Exception:
            return default
    return default


def _slug(value: str) -> str:
    txt = re.sub(r"[^A-Za-z0-9]+", "-", (value or "").strip())
    txt = txt.strip("-").upper()
    return txt[:10] if txt else ""


def derive_drink_code(item_code: str, prefix: str | None = None, option_codes: list[str] | None = None) -> str:
    base = _slug(item_code) or "DRINK"
    parts = []
    if prefix:
        parts.append(_slug(prefix))
    parts.append(base)
    for code in option_codes or []:
        normalized = _slug(code)
        if normalized:
            parts.append(normalized)
    return "-".join(parts)[:48]


def _resolve_profile_for_item(item_code: str, pos_profile: str | None = None):
    if not item_code:
        return None

    profile_name = frappe.db.get_value("Item", item_code, "posa_modifier_profile")
    if not profile_name:
        return None

    profile = frappe.get_cached_doc("POSA Modifier Profile", profile_name)
    if getattr(profile, "disabled", 0):
        return None

    if pos_profile and getattr(profile, "pos_profile", None) and profile.pos_profile != pos_profile:
        return None

    if pos_profile and getattr(profile, "company", None):
        profile_company = frappe.db.get_value("POS Profile", pos_profile, "company")
        if profile_company and profile.company != profile_company:
            return None

    return profile


def _build_profile_payload(profile_doc):
    if not profile_doc:
        return {
            "profile": None,
            "groups": [],
            "defaults": {},
            "drink_code_prefix": None,
            "default_prep_status": "Paid",
        }

    grouped: OrderedDict[str, dict[str, Any]] = OrderedDict()
    rows = sorted(
        list(getattr(profile_doc, "options", []) or []),
        key=lambda row: (
            int(getattr(row, "group_sort_order", 0) or 0),
            (getattr(row, "group_name", "") or "").lower(),
            int(getattr(row, "sort_order", 0) or 0),
            int(getattr(row, "idx", 0) or 0),
        ),
    )

    for row in rows:
        if not getattr(row, "is_available", 1):
            continue

        group_name = (getattr(row, "group_name", "") or "").strip()
        option_label = (getattr(row, "option_label", "") or "").strip()
        option_value = (getattr(row, "option_value", "") or option_label).strip()

        if not group_name or not option_value:
            continue

        if group_name not in grouped:
            grouped[group_name] = {
                "name": group_name,
                "required": False,
                "allow_multiple": False,
                "options": [],
                "sort_order": int(getattr(row, "group_sort_order", 0) or 0),
            }

        group = grouped[group_name]
        group["required"] = bool(group["required"] or getattr(row, "is_required", 0))
        group["allow_multiple"] = bool(group["allow_multiple"] or getattr(row, "allow_multiple", 0))

        group["options"].append(
            {
                "label": option_label or option_value,
                "value": option_value,
                "code": (getattr(row, "option_code", "") or "").strip(),
                "price_delta": flt(getattr(row, "price_delta", 0)),
                "is_default": bool(getattr(row, "is_default", 0)),
                "parent_option_group": (getattr(row, "parent_option_group", "") or "").strip(),
                "parent_option_value": (getattr(row, "parent_option_value", "") or "").strip(),
                "sort_order": int(getattr(row, "sort_order", 0) or 0),
            }
        )

    groups = []
    defaults = {}

    for group_name, group in grouped.items():
        options = sorted(
            group["options"],
            key=lambda entry: (int(entry.get("sort_order") or 0), (entry.get("label") or "").lower()),
        )
        group["options"] = options

        for option in options:
            if option.get("is_default"):
                defaults.setdefault(group_name, []).append(option.get("value"))

        if not defaults.get(group_name) and options:
            defaults[group_name] = [options[0].get("value")]

        groups.append(group)

    default_prep_status = getattr(profile_doc, "default_prep_status", None) or "Paid"
    if default_prep_status not in ALLOWED_PREP_STATUSES:
        default_prep_status = "Paid"

    return {
        "profile": profile_doc.name,
        "groups": groups,
        "defaults": defaults,
        "drink_code_prefix": getattr(profile_doc, "drink_code_prefix", None),
        "default_prep_status": default_prep_status,
    }


def _normalize_selections(raw_payload: dict[str, Any] | None):
    payload = raw_payload or {}

    if isinstance(payload.get("selections"), dict):
        payload = payload.get("selections")

    normalized: dict[str, list[str]] = {}

    for group_name, value in payload.items():
        if value in (None, ""):
            continue

        values: list[str] = []

        if isinstance(value, list):
            for entry in value:
                if isinstance(entry, dict):
                    option_value = entry.get("value") or entry.get("option_value") or entry.get("label")
                    if option_value:
                        values.append(str(option_value).strip())
                elif entry:
                    values.append(str(entry).strip())
        elif isinstance(value, dict):
            option_value = value.get("value") or value.get("option_value") or value.get("label")
            if option_value:
                values.append(str(option_value).strip())
        else:
            values.append(str(value).strip())

        cleaned = [entry for entry in values if entry]
        if cleaned:
            normalized[str(group_name)] = cleaned

    return normalized


def _check_dependencies(selected: dict[str, list[str]], option: dict[str, Any]) -> bool:
    parent_group = (option.get("parent_option_group") or "").strip()
    parent_value = (option.get("parent_option_value") or "").strip()

    if not parent_group:
        return True

    selected_values = selected.get(parent_group) or []
    return parent_value in selected_values


def _validate_selection(profile_payload: dict[str, Any], item_payload: dict[str, Any]):
    selected = _normalize_selections(_parse_json(item_payload.get("posa_modifiers_json"), {}))

    errors: list[str] = []
    selected_option_codes: list[str] = []
    selected_option_labels: list[str] = []
    delta_total = 0.0

    for group in profile_payload.get("groups", []):
        group_name = group.get("name")
        if not group_name:
            continue

        selected_values = selected.get(group_name, [])
        available_options = [
            option
            for option in group.get("options", [])
            if _check_dependencies(selected, option)
        ]
        option_by_value = {option.get("value"): option for option in available_options}

        if group.get("required") and not selected_values:
            errors.append(_("Missing required modifier group: {0}").format(group_name))
            continue

        if not group.get("allow_multiple") and len(selected_values) > 1:
            errors.append(_("Group {0} does not allow multiple selections").format(group_name))

        for selected_value in selected_values:
            option = option_by_value.get(selected_value)
            if not option:
                errors.append(
                    _("Option {0} is not valid for group {1}").format(selected_value, group_name)
                )
                continue

            delta_total += flt(option.get("price_delta"))
            selected_option_labels.append(option.get("label") or selected_value)
            if option.get("code"):
                selected_option_codes.append(option.get("code"))

    return {
        "errors": errors,
        "selected": selected,
        "delta_total": delta_total,
        "summary": " / ".join(selected_option_labels),
        "option_codes": selected_option_codes,
    }


@frappe.whitelist()
def get_modifier_profile(item_code: str, pos_profile: str | None = None):
    profile = _resolve_profile_for_item(item_code, pos_profile)
    return _build_profile_payload(profile)


@frappe.whitelist()
def validate_and_price(invoice_payload: str | dict[str, Any]):
    payload = _parse_json(invoice_payload, {})
    if not isinstance(payload, dict):
        payload = {}

    pos_profile = payload.get("pos_profile")
    items = payload.get("items") or []

    response_items = []
    errors = []

    for item in items:
        item_code = item.get("item_code")
        profile = _resolve_profile_for_item(item_code, pos_profile)
        profile_payload = _build_profile_payload(profile)

        if not profile_payload.get("profile"):
            response_items.append(
                {
                    "item_code": item_code,
                    "posa_row_id": item.get("posa_row_id"),
                    "delta_total": 0,
                    "summary": "",
                    "drink_code": derive_drink_code(item_code),
                    "modifiers_json": item.get("posa_modifiers_json") or "",
                }
            )
            continue

        validated = _validate_selection(profile_payload, item)
        drink_code = derive_drink_code(
            item_code,
            profile_payload.get("drink_code_prefix"),
            validated.get("option_codes"),
        )

        if validated["errors"]:
            for message in validated["errors"]:
                errors.append(
                    {
                        "item_code": item_code,
                        "posa_row_id": item.get("posa_row_id"),
                        "message": message,
                    }
                )

        base_rate = flt(item.get("rate") or item.get("price_list_rate") or 0)
        response_items.append(
            {
                "item_code": item_code,
                "posa_row_id": item.get("posa_row_id"),
                "profile": profile_payload.get("profile"),
                "delta_total": validated["delta_total"],
                "summary": validated["summary"],
                "drink_code": drink_code,
                "computed_rate": base_rate + validated["delta_total"],
                "default_prep_status": profile_payload.get("default_prep_status") or "Paid",
                "modifiers_json": json.dumps(
                    {
                        "profile": profile_payload.get("profile"),
                        "selections": validated["selected"],
                        "summary": validated["summary"],
                    }
                ),
            }
        )

    return {
        "valid": len(errors) == 0,
        "items": response_items,
        "errors": errors,
    }


def validate_invoice_doc_modifiers(doc):
    profile_cache: dict[str, dict[str, Any]] = {}

    for row in doc.get("items") or []:
        if row.get("posa_prep_status") not in ALLOWED_PREP_STATUSES:
            row.posa_prep_status = "Paid"

        item_code = row.get("item_code")
        if not item_code:
            continue

        if item_code not in profile_cache:
            profile = _resolve_profile_for_item(item_code, doc.get("pos_profile"))
            profile_cache[item_code] = _build_profile_payload(profile)

        profile_payload = profile_cache.get(item_code) or {}

        if not profile_payload.get("profile"):
            row.posa_modifiers_json = ""
            row.posa_modifier_summary = ""
            row.posa_modifiers_delta = 0
            row.posa_drink_code = row.get("posa_drink_code") or derive_drink_code(item_code)
            continue

        validated = _validate_selection(profile_payload, row.as_dict())
        if validated["errors"]:
            frappe.throw(
                _("Item {0}: {1}").format(item_code, "; ".join(validated["errors"]))
            )

        row.posa_modifiers_json = json.dumps(
            {
                "profile": profile_payload.get("profile"),
                "selections": validated.get("selected") or profile_payload.get("defaults") or {},
                "summary": validated.get("summary") or "",
            }
        )
        row.posa_modifier_summary = validated.get("summary") or ""
        row.posa_modifiers_delta = flt(validated.get("delta_total") or 0)
        if not row.get("posa_prep_status"):
            row.posa_prep_status = profile_payload.get("default_prep_status") or "Paid"

        row.posa_drink_code = row.get("posa_drink_code") or derive_drink_code(
            item_code,
            profile_payload.get("drink_code_prefix"),
            validated.get("option_codes"),
        )
