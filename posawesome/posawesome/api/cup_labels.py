from __future__ import annotations

import frappe
from frappe import _
from frappe.utils import now_datetime


def _resolve_parent_doctype(invoice_name: str) -> str:
    if frappe.db.exists("POS Invoice", invoice_name):
        return "POS Invoice"
    if frappe.db.exists("Sales Invoice", invoice_name):
        return "Sales Invoice"
    frappe.throw(_("Invoice {0} was not found").format(invoice_name))


@frappe.whitelist()
def log_reprint_event(
    invoice_name: str,
    line_id: str | None = None,
    label_id: str | None = None,
    result: str | None = None,
):
    parent_doctype = _resolve_parent_doctype(invoice_name)

    message = [
        f"Cup Label Reprint @ {now_datetime()}",
        f"Result: {result or 'unknown'}",
        f"Line: {line_id or '-'}",
        f"Label: {label_id or '-'}",
        f"User: {frappe.session.user}",
    ]

    comment = frappe.get_doc(
        {
            "doctype": "Comment",
            "comment_type": "Info",
            "reference_doctype": parent_doctype,
            "reference_name": invoice_name,
            "content": "<br>".join(message),
        }
    )
    comment.insert(ignore_permissions=True)

    return {"ok": True, "comment": comment.name}
