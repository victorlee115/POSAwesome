from __future__ import annotations

from typing import Iterable

import frappe
from frappe import _
from frappe.utils import flt


def _get_ingredient_qty(item_code: str, warehouse: str | None = None) -> float:
    if not item_code:
        return 0.0

    if warehouse:
        row = frappe.db.sql(
            """
            select sum(actual_qty) as qty
            from `tabBin`
            where item_code = %s and warehouse = %s
            """,
            (item_code, warehouse),
            as_dict=True,
        )
        return flt((row[0] or {}).get("qty") if row else 0)

    row = frappe.db.sql(
        """
        select sum(actual_qty) as qty
        from `tabBin`
        where item_code = %s
        """,
        (item_code,),
        as_dict=True,
    )
    return flt((row[0] or {}).get("qty") if row else 0)


def get_unavailable_item_reason_map(
    item_codes: Iterable[str],
    default_warehouse: str | None = None,
    pos_profile: str | None = None,
):
    item_codes = sorted({code for code in (item_codes or []) if code})
    if not item_codes:
        return {}

    filters: dict[str, object] = {
        "disabled": 0,
        "affected_item": ["in", item_codes],
    }

    if pos_profile and frappe.db.has_column("POSA Ingredient Rule", "pos_profile"):
        filters["pos_profile"] = ["in", ["", pos_profile]]

    rules = frappe.get_all(
        "POSA Ingredient Rule",
        filters=filters,
        fields=[
            "name",
            "ingredient_item",
            "affected_item",
            "warehouse",
            "min_available_qty",
            "message",
        ],
        order_by="modified desc",
    )

    if not rules:
        return {}

    qty_cache: dict[tuple[str, str | None], float] = {}
    blocked: dict[str, str] = {}

    for rule in rules:
        ingredient = rule.get("ingredient_item")
        affected = rule.get("affected_item")
        if not ingredient or not affected:
            continue

        warehouse = rule.get("warehouse") or default_warehouse
        cache_key = (ingredient, warehouse)
        if cache_key not in qty_cache:
            qty_cache[cache_key] = _get_ingredient_qty(ingredient, warehouse)

        current_qty = qty_cache[cache_key]
        min_qty = flt(rule.get("min_available_qty") or 0)
        if current_qty > min_qty:
            continue

        message = (rule.get("message") or "").strip()
        if not message:
            message = _("Unavailable now: {0} is low in stock").format(ingredient)
        blocked.setdefault(affected, message)

    return blocked
