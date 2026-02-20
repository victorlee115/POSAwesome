from __future__ import annotations

import frappe
from frappe import _
from frappe.model.document import Document
from frappe.utils import flt


class POSAIngredientRule(Document):
    def validate(self):
        if self.ingredient_item == self.affected_item:
            frappe.throw(_("Ingredient item and affected item cannot be the same."))

        self.min_available_qty = flt(self.min_available_qty)
        if self.min_available_qty < 0:
            frappe.throw(_("Minimum available quantity cannot be negative."))
