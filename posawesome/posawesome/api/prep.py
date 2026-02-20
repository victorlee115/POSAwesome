from __future__ import annotations

from typing import Any

import frappe
from frappe import _
from frappe.utils import cint

from posawesome.posawesome.api.modifiers import ALLOWED_PREP_STATUSES


def _resolve_parent_doctype(invoice_name: str) -> str:
    if frappe.db.exists("POS Invoice", invoice_name):
        return "POS Invoice"
    if frappe.db.exists("Sales Invoice", invoice_name):
        return "Sales Invoice"
    frappe.throw(_("Invoice {0} was not found").format(invoice_name))


def _resolve_item_doctype(parent_doctype: str) -> str:
    return "POS Invoice Item" if parent_doctype == "POS Invoice" else "Sales Invoice Item"


def _load_row(item_doctype: str, invoice_name: str, line_id: str):
    filters: list[list[Any]] = [["parent", "=", invoice_name]]

    candidates = []
    if line_id:
        candidates.append(["name", "=", line_id])
        candidates.append(["posa_row_id", "=", line_id])
        if str(line_id).isdigit():
            candidates.append(["idx", "=", cint(line_id)])

    rows = []
    if candidates:
        rows = frappe.get_all(
            item_doctype,
            filters=filters,
            or_filters=candidates,
            fields=[
                "name",
                "idx",
                "item_code",
                "item_name",
                "qty",
                "posa_row_id",
                "posa_prep_status",
                "posa_drink_code",
                "posa_modifiers_json",
            ],
            limit=1,
        )

    if rows:
        return rows[0]

    frappe.throw(_("Invoice line {0} was not found").format(line_id))


@frappe.whitelist()
def transition_status(invoice_name: str, line_id: str, status: str):
    if status not in ALLOWED_PREP_STATUSES:
        frappe.throw(_("Invalid prep status: {0}").format(status))

    parent_doctype = _resolve_parent_doctype(invoice_name)
    item_doctype = _resolve_item_doctype(parent_doctype)
    row = _load_row(item_doctype, invoice_name, line_id)

    frappe.db.set_value(item_doctype, row["name"], "posa_prep_status", status, update_modified=True)

    return {
        "invoice_doctype": parent_doctype,
        "invoice_name": invoice_name,
        "item_doctype": item_doctype,
        "line_id": row["name"],
        "status": status,
    }


@frappe.whitelist()
def get_prep_queue(
    pos_profile: str | None = None,
    status: str | None = None,
    limit: int = 80,
):
    if status and status not in ALLOWED_PREP_STATUSES:
        frappe.throw(_("Invalid prep status: {0}").format(status))

    limit = max(min(cint(limit) or 80, 300), 1)
    status_list = (status,) if status else ("Paid", "In Prep", "Ready")

    params = {
        "limit": limit,
        "statuses": tuple(status_list),
        "pos_profile": pos_profile,
    }

    payload: list[dict[str, Any]] = []

    specs = [
        ("POS Invoice", "POS Invoice Item", False),
        ("Sales Invoice", "Sales Invoice Item", True),
    ]

    for parent_doctype, item_doctype, require_is_pos in specs:
        if not frappe.db.exists("DocType", parent_doctype):
            continue

        parent_table = f"`tab{parent_doctype}`"
        item_table = f"`tab{item_doctype}`"

        conditions = [
            "parent.docstatus = 1",
            "ifnull(item.posa_prep_status, 'Paid') in %(statuses)s",
        ]

        if require_is_pos:
            conditions.append("ifnull(parent.is_pos, 0) = 1")

        if pos_profile:
            conditions.append("parent.pos_profile = %(pos_profile)s")

        sql = f"""
            select
                parent.name as invoice_name,
                '{parent_doctype}' as invoice_doctype,
                parent.posting_date,
                parent.posting_time,
                parent.customer,
                parent.pos_profile,
                item.name as line_id,
                item.idx,
                item.posa_row_id,
                item.item_code,
                item.item_name,
                item.qty,
                item.rate,
                item.amount,
                ifnull(item.posa_prep_status, 'Paid') as posa_prep_status,
                item.posa_drink_code,
                item.posa_modifier_summary,
                item.posa_modifiers_json
            from {parent_table} parent
            inner join {item_table} item on item.parent = parent.name
            where {' and '.join(conditions)}
            order by parent.posting_date desc, parent.posting_time desc, item.idx asc
            limit %(limit)s
        """

        rows = frappe.db.sql(sql, params, as_dict=True)
        payload.extend(rows)

    payload = sorted(
        payload,
        key=lambda row: (
            str(row.get("posting_date") or ""),
            str(row.get("posting_time") or ""),
            row.get("invoice_name") or "",
            int(row.get("idx") or 0),
        ),
        reverse=True,
    )[:limit]

    for row in payload:
        suffix = str(row.get("invoice_name") or "").split("-")[-1]
        idx = row.get("idx") or ""
        row["queue_token"] = f"{suffix}-{idx}"

    return payload
