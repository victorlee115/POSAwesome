from __future__ import annotations

import json
from typing import Any

import frappe
from frappe import _
from frappe.utils import cint, flt


MATCHA_ROOT_GROUP = "Matcha Takeaway"


MATCHA_MENU_ITEMS = (
    {
        "item_code": "MTC-MATCHA-LATTE",
        "item_name": "Matcha Latte",
        "item_group": "Classic Matcha",
        "rate": 11.9,
        "description": "Ceremonial matcha whisked with milk.",
        "modifier_profile": "Matcha Latte Modifiers",
        "popular_rank": 1,
    },
    {
        "item_code": "MTC-STRAWBERRY-MATCHA-LATTE",
        "item_name": "Strawberry Matcha Latte",
        "item_group": "Fruit Matcha",
        "rate": 13.9,
        "description": "House strawberry puree layered with matcha latte.",
        "modifier_profile": "Matcha Latte Modifiers",
        "popular_rank": 2,
    },
    {
        "item_code": "MTC-MANGO-MATCHA-LATTE",
        "item_name": "Mango Matcha Latte",
        "item_group": "Fruit Matcha",
        "rate": 13.9,
        "description": "Mango-forward matcha latte for takeaway rush periods.",
        "modifier_profile": "Matcha Latte Modifiers",
        "popular_rank": 3,
    },
    {
        "item_code": "MTC-VANILLA-MATCHA-LATTE",
        "item_name": "Vanilla Matcha Latte",
        "item_group": "Classic Matcha",
        "rate": 12.9,
        "description": "Vanilla-infused matcha latte.",
        "modifier_profile": "Matcha Latte Modifiers",
        "popular_rank": 4,
    },
    {
        "item_code": "MTC-DIRTY-MATCHA-LATTE",
        "item_name": "Dirty Matcha Latte",
        "item_group": "Signature Matcha",
        "rate": 14.9,
        "description": "Matcha latte finished with an espresso shot.",
        "modifier_profile": "Matcha Latte Modifiers",
        "popular_rank": 5,
    },
    {
        "item_code": "MTC-HOJICHA-MATCHA-LATTE",
        "item_name": "Hojicha Matcha Latte",
        "item_group": "Signature Matcha",
        "rate": 14.5,
        "description": "Roasted hojicha notes with smooth matcha body.",
        "modifier_profile": "Matcha Latte Modifiers",
        "popular_rank": 6,
    },
    {
        "item_code": "MTC-MATCHA-LEMONADE",
        "item_name": "Matcha Lemonade",
        "item_group": "Fruit Matcha",
        "rate": 12.5,
        "description": "Bright citrus lemonade topped with whisked matcha.",
        "modifier_profile": "Matcha Cold Modifiers",
        "popular_rank": 7,
    },
    {
        "item_code": "MTC-YUZU-MATCHA-TONIC",
        "item_name": "Yuzu Matcha Tonic",
        "item_group": "Signature Matcha",
        "rate": 14.5,
        "description": "Yuzu citrus and sparkling tonic with matcha.",
        "modifier_profile": "Matcha Cold Modifiers",
        "popular_rank": 8,
    },
)


def _group_options(
    *,
    group_name: str,
    group_sort_order: int,
    required: int,
    allow_multiple: int,
    options: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for idx, option in enumerate(options, start=1):
        rows.append(
            {
                "group_name": group_name,
                "group_sort_order": group_sort_order,
                "option_label": option["label"],
                "option_value": option.get("value", option["label"]),
                "option_code": option.get("code", ""),
                "price_delta": flt(option.get("delta") or 0),
                "is_default": cint(option.get("default") or 0),
                "is_required": cint(required),
                "allow_multiple": cint(allow_multiple),
                "is_available": 1,
                "parent_option_group": option.get("parent_group") or "",
                "parent_option_value": option.get("parent_value") or "",
                "sort_order": idx,
            }
        )
    return rows


MATCHA_PROFILE_DEFINITIONS = (
    {
        "title": "Matcha Latte Modifiers",
        "description": "Default tablet-friendly modifiers for matcha milk drinks.",
        "drink_code_prefix": "MTC",
        "default_prep_status": "Paid",
        "options": (
            _group_options(
                group_name="Size",
                group_sort_order=10,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "Small", "code": "S", "delta": -1.0},
                    {"label": "Regular", "code": "R", "default": 1},
                    {"label": "Large", "code": "L", "delta": 2.0},
                ],
            )
            + _group_options(
                group_name="Temperature",
                group_sort_order=20,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "Iced", "code": "IC", "default": 1},
                    {"label": "Hot", "code": "HOT"},
                ],
            )
            + _group_options(
                group_name="Sugar Level",
                group_sort_order=30,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "0%", "code": "S0"},
                    {"label": "25%", "code": "S25"},
                    {"label": "50%", "code": "S50", "default": 1},
                    {"label": "75%", "code": "S75"},
                    {"label": "100%", "code": "S100"},
                ],
            )
            + _group_options(
                group_name="Milk Option",
                group_sort_order=40,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "Whole Milk", "code": "WM", "default": 1},
                    {"label": "Oat Milk", "code": "OM", "delta": 1.5},
                    {"label": "Soy Milk", "code": "SM", "delta": 1.2},
                    {"label": "Almond Milk", "code": "AM", "delta": 1.5},
                    {"label": "Coconut Milk", "code": "CM", "delta": 1.3},
                ],
            )
            + _group_options(
                group_name="Ice Level",
                group_sort_order=50,
                required=1,
                allow_multiple=0,
                options=[
                    {
                        "label": "No Ice",
                        "code": "I0",
                        "parent_group": "Temperature",
                        "parent_value": "Iced",
                    },
                    {
                        "label": "Light Ice",
                        "code": "I1",
                        "default": 1,
                        "parent_group": "Temperature",
                        "parent_value": "Iced",
                    },
                    {
                        "label": "Regular Ice",
                        "code": "I2",
                        "parent_group": "Temperature",
                        "parent_value": "Iced",
                    },
                    {
                        "label": "Extra Ice",
                        "code": "I3",
                        "parent_group": "Temperature",
                        "parent_value": "Iced",
                    },
                ],
            )
            + _group_options(
                group_name="Add Ons",
                group_sort_order=60,
                required=0,
                allow_multiple=1,
                options=[
                    {"label": "Boba", "code": "BOB", "delta": 1.5},
                    {"label": "Cream Top", "code": "CRM", "delta": 1.8},
                    {"label": "Extra Matcha Shot", "code": "EMS", "delta": 2.2},
                    {"label": "Matcha Jelly", "code": "JEL", "delta": 1.6},
                ],
            )
        ),
    },
    {
        "title": "Matcha Cold Modifiers",
        "description": "Modifier profile for lemonade/tonic style matcha drinks.",
        "drink_code_prefix": "MTC",
        "default_prep_status": "Paid",
        "options": (
            _group_options(
                group_name="Size",
                group_sort_order=10,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "Small", "code": "S", "delta": -1.0},
                    {"label": "Regular", "code": "R", "default": 1},
                    {"label": "Large", "code": "L", "delta": 2.0},
                ],
            )
            + _group_options(
                group_name="Sugar Level",
                group_sort_order=20,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "0%", "code": "S0"},
                    {"label": "25%", "code": "S25"},
                    {"label": "50%", "code": "S50", "default": 1},
                    {"label": "75%", "code": "S75"},
                    {"label": "100%", "code": "S100"},
                ],
            )
            + _group_options(
                group_name="Ice Level",
                group_sort_order=30,
                required=1,
                allow_multiple=0,
                options=[
                    {"label": "No Ice", "code": "I0"},
                    {"label": "Light Ice", "code": "I1"},
                    {"label": "Regular Ice", "code": "I2", "default": 1},
                    {"label": "Extra Ice", "code": "I3"},
                ],
            )
            + _group_options(
                group_name="Add Ons",
                group_sort_order=40,
                required=0,
                allow_multiple=1,
                options=[
                    {"label": "Extra Matcha Shot", "code": "EMS", "delta": 2.2},
                    {"label": "Lemon Slice", "code": "LEM", "delta": 0.8},
                    {"label": "Yuzu Foam", "code": "YF", "delta": 1.9},
                ],
            )
        ),
    },
)


def _ensure_item_group(name: str, parent_group: str, is_group: int = 0) -> str:
    existing = frappe.db.exists("Item Group", name)
    if not existing:
        doc = frappe.get_doc(
            {
                "doctype": "Item Group",
                "item_group_name": name,
                "parent_item_group": parent_group,
                "is_group": cint(is_group),
            }
        )
        doc.insert(ignore_permissions=True)
        return doc.name

    frappe.db.set_value(
        "Item Group",
        name,
        {
            "parent_item_group": parent_group,
            "is_group": cint(is_group),
        },
        update_modified=False,
    )
    return name


def _resolve_root_item_group() -> str:
    root = frappe.db.get_value(
        "Item Group",
        {"is_group": 1, "parent_item_group": ("in", ("", None))},
        "name",
    )
    return root or "All Item Groups"


def _ensure_modifier_profile(
    profile_definition: dict[str, Any], *, company: str | None, pos_profile: str | None
) -> str:
    profile_name = profile_definition["title"]
    existing = frappe.db.exists("POSA Modifier Profile", profile_name)
    if existing:
        doc = frappe.get_doc("POSA Modifier Profile", profile_name)
    else:
        doc = frappe.new_doc("POSA Modifier Profile")
        doc.title = profile_name

    doc.disabled = 0
    doc.description = profile_definition.get("description") or ""
    doc.company = company or ""
    doc.pos_profile = pos_profile or ""
    doc.default_prep_status = profile_definition.get("default_prep_status") or "Paid"
    doc.drink_code_prefix = profile_definition.get("drink_code_prefix") or "MTC"
    doc.options = []
    for option in profile_definition.get("options") or ():
        doc.append("options", option)

    if existing:
        doc.save(ignore_permissions=True)
    else:
        doc.insert(ignore_permissions=True)
    return doc.name


def _ensure_item(item_definition: dict[str, Any], stock_uom: str = "Nos") -> str:
    item_code = item_definition["item_code"]
    existing = frappe.db.exists("Item", item_code)
    data = {
        "item_code": item_code,
        "item_name": item_definition["item_name"],
        "description": item_definition.get("description") or "",
        "item_group": item_definition["item_group"],
        "stock_uom": stock_uom,
        "is_stock_item": 0,
        "is_sales_item": 1,
        "disabled": 0,
    }

    if not existing:
        doc = frappe.get_doc({"doctype": "Item", **data})
        doc.insert(ignore_permissions=True)
        return doc.name

    frappe.db.set_value("Item", item_code, data, update_modified=False)
    return item_code


def _ensure_item_price(
    *, item_code: str, price_list: str, currency: str | None, rate: float
) -> str:
    filters = {"item_code": item_code, "price_list": price_list}
    existing = frappe.db.get_value("Item Price", filters, "name")
    if existing:
        frappe.db.set_value(
            "Item Price",
            existing,
            {
                "price_list_rate": flt(rate),
                "currency": currency or frappe.db.get_value("Price List", price_list, "currency"),
            },
            update_modified=False,
        )
        return existing

    doc = frappe.get_doc(
        {
            "doctype": "Item Price",
            "item_code": item_code,
            "price_list": price_list,
            "price_list_rate": flt(rate),
            "currency": currency or frappe.db.get_value("Price List", price_list, "currency"),
        }
    )
    doc.insert(ignore_permissions=True)
    return doc.name


def _set_item_matcha_fields(item_code: str, modifier_profile: str, popular_rank: int):
    updates = {}
    if frappe.db.has_column("Item", "posa_modifier_profile"):
        updates["posa_modifier_profile"] = modifier_profile
    if frappe.db.has_column("Item", "posa_popular_rank"):
        updates["posa_popular_rank"] = cint(popular_rank)
    if updates:
        frappe.db.set_value("Item", item_code, updates, update_modified=False)


@frappe.whitelist()
def setup_matcha_takeaway_menu(pos_profile: str | None = None, price_list: str | None = None):
    """
    Create or update a realistic matcha takeaway catalog and modifier profiles.
    This method is idempotent and safe to run multiple times.
    """
    frappe.only_for(("System Manager", "Sales Manager"))

    target_pos_profile = (pos_profile or "").strip() or frappe.db.get_value(
        "POS Profile", {}, "name", order_by="modified desc"
    )
    if not target_pos_profile:
        frappe.throw(_("No POS Profile found. Create a POS Profile first."))

    pos_profile_doc = frappe.get_doc("POS Profile", target_pos_profile)
    company = pos_profile_doc.company
    target_price_list = (
        (price_list or "").strip()
        or pos_profile_doc.selling_price_list
        or frappe.db.get_value("Price List", {"selling": 1}, "name")
    )
    if not target_price_list:
        frappe.throw(_("No selling price list found. Configure one before bootstrapping menu items."))

    currency = frappe.db.get_value("Price List", target_price_list, "currency")

    root_group = _resolve_root_item_group()
    _ensure_item_group(MATCHA_ROOT_GROUP, root_group, is_group=1)
    for subgroup_name in ("Classic Matcha", "Fruit Matcha", "Signature Matcha"):
        _ensure_item_group(subgroup_name, MATCHA_ROOT_GROUP, is_group=0)

    profiles: dict[str, str] = {}
    for profile_definition in MATCHA_PROFILE_DEFINITIONS:
        profile_name = _ensure_modifier_profile(
            profile_definition, company=company, pos_profile=target_pos_profile
        )
        profiles[profile_definition["title"]] = profile_name

    created_items: list[str] = []
    updated_items: list[str] = []
    for item_definition in MATCHA_MENU_ITEMS:
        item_code = item_definition["item_code"]
        exists_before = bool(frappe.db.exists("Item", item_code))
        _ensure_item(item_definition, stock_uom="Nos")
        _ensure_item_price(
            item_code=item_code,
            price_list=target_price_list,
            currency=currency,
            rate=flt(item_definition.get("rate") or 0),
        )
        profile_name = profiles.get(item_definition["modifier_profile"]) or ""
        _set_item_matcha_fields(item_code, profile_name, cint(item_definition["popular_rank"]))
        if exists_before:
            updated_items.append(item_code)
        else:
            created_items.append(item_code)

    if frappe.db.has_column("POS Profile", "posa_popular_items_json"):
        popular_item_codes = [item["item_code"] for item in MATCHA_MENU_ITEMS[:8]]
        frappe.db.set_value(
            "POS Profile",
            target_pos_profile,
            "posa_popular_items_json",
            json.dumps(popular_item_codes),
            update_modified=False,
        )
    if frappe.db.has_column("POS Profile", "posa_enable_prep_queue"):
        frappe.db.set_value(
            "POS Profile",
            target_pos_profile,
            "posa_enable_prep_queue",
            1,
            update_modified=False,
        )

    frappe.db.commit()
    frappe.clear_cache(doctype="Item")
    frappe.clear_cache(doctype="POSA Modifier Profile")
    frappe.clear_cache(doctype="POS Profile")

    return {
        "ok": True,
        "pos_profile": target_pos_profile,
        "price_list": target_price_list,
        "currency": currency,
        "modifier_profiles": sorted(profiles.values()),
        "created_items": created_items,
        "updated_items": updated_items,
        "total_menu_items": len(MATCHA_MENU_ITEMS),
        "message": _("Matcha takeaway menu configured successfully."),
    }
