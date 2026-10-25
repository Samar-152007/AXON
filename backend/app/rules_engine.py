from datetime import datetime, date
from typing import Dict, Any, List, Optional

DISCLAIMER_TEXT = (
    "This score is an inventory prioritization aid, not a food-safety assessment. "
    "GrocIQ does not determine whether food is safe or unsafe to eat."
)

def evaluate_item_risk(item: Dict[str, Any], reference_date: Optional[date] = None) -> Dict[str, Any]:
    """
    Transparent, explainable rules-based evaluation for an inventory item.
    Does not invent dates or make food safety claims.
    """
    if reference_date is None:
        reference_date = date.today()
        
    expiry_str = item.get("expiry_date")
    item_id = item.get("id")
    name = item.get("name", "Unknown item")
    category = item.get("category", "Other")
    quantity = item.get("quantity", 1.0)
    unit = item.get("unit", "units")
    unit_price = item.get("unit_price", item.get("price", 0.0)) or 0.0
    
    # Rule 1: Missing or blank expiry date
    if not expiry_str or not str(expiry_str).strip():
        return {
            "item_id": item_id,
            "name": name,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "expiry_date": None,
            "days_remaining": None,
            "urgency_tier": "UNCLASSIFIED",
            "urgency_score": 35,
            "explanation": "Date information missing — add a recorded date for a more specific prioritization recommendation.",
            "recommended_action": "Inspect item package and add an estimated best-before date or mark for routine use.",
            "disclaimer": DISCLAIMER_TEXT
        }

    try:
        expiry_dt = datetime.strptime(str(expiry_str).strip(), "%Y-%m-%d").date()
    except ValueError:
        return {
            "item_id": item_id,
            "name": name,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "expiry_date": str(expiry_str),
            "days_remaining": None,
            "urgency_tier": "UNCLASSIFIED",
            "urgency_score": 30,
            "explanation": f"Invalid date format '{expiry_str}' recorded. Please update to YYYY-MM-DD.",
            "recommended_action": "Correct the date in inventory settings.",
            "disclaimer": DISCLAIMER_TEXT
        }

    days_diff = (expiry_dt - reference_date).days

    # Rule 2: Past recorded date (Needs user review)
    if days_diff < 0:
        overdue_days = abs(days_diff)
        return {
            "item_id": item_id,
            "name": name,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "expiry_date": str(expiry_dt),
            "days_remaining": days_diff,
            "urgency_tier": "URGENT",
            "urgency_score": min(100, 90 + overdue_days),
            "explanation": f"Overdue by {overdue_days} day(s) against recorded date ({expiry_dt}). Needs user review.",
            "recommended_action": "Inspect item. If already used or discarded, record the outcome to keep inventory accurate.",
            "disclaimer": DISCLAIMER_TEXT
        }

    # Rule 3: Today
    if days_diff == 0:
        return {
            "item_id": item_id,
            "name": name,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "expiry_date": str(expiry_dt),
            "days_remaining": 0,
            "urgency_tier": "URGENT",
            "urgency_score": 90,
            "explanation": f"Approaching recorded best-before date TODAY ({expiry_dt}) — review and prioritize immediately.",
            "recommended_action": "Prioritize for today's meal plan or preserve/freeze if suitable.",
            "disclaimer": DISCLAIMER_TEXT
        }

    # Rule 4: Imminent (1 - 2 days)
    if days_diff <= 2:
        return {
            "item_id": item_id,
            "name": name,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "expiry_date": str(expiry_dt),
            "days_remaining": days_diff,
            "urgency_tier": "HIGH",
            "urgency_score": 80 - (days_diff * 5),
            "explanation": f"Approaching recorded best-before date in {days_diff} day(s) ({expiry_dt}) — prioritize use.",
            "recommended_action": "Schedule into next 24-48 hours meals.",
            "disclaimer": DISCLAIMER_TEXT
        }

    # Rule 5: Medium horizon (3 - 5 days)
    if days_diff <= 5:
        return {
            "item_id": item_id,
            "name": name,
            "category": category,
            "quantity": quantity,
            "unit": unit,
            "unit_price": unit_price,
            "expiry_date": str(expiry_dt),
            "days_remaining": days_diff,
            "urgency_tier": "MEDIUM",
            "urgency_score": 55 - (days_diff * 4),
            "explanation": f"Approaching recorded date within {days_diff} days ({expiry_dt}).",
            "recommended_action": "Check weekly recipe lineup to incorporate before due date.",
            "disclaimer": DISCLAIMER_TEXT
        }

    # Rule 6: Safe horizon (> 5 days)
    return {
        "item_id": item_id,
        "name": name,
        "category": category,
        "quantity": quantity,
        "unit": unit,
        "unit_price": unit_price,
        "expiry_date": str(expiry_dt),
        "days_remaining": days_diff,
        "urgency_tier": "LOW",
        "urgency_score": max(10, 30 - min(days_diff, 20)),
        "explanation": f"No urgent signal from available information ({days_diff} days remaining).",
        "recommended_action": "Maintain normal storage and pantry rotation.",
        "disclaimer": DISCLAIMER_TEXT
    }

def rank_items_for_recommendations(items: List[Dict[str, Any]], reference_date: Optional[date] = None) -> List[Dict[str, Any]]:
    """
    Ranks active inventory items by priority score (highest first).
    """
    evaluated = [evaluate_item_risk(item, reference_date) for item in items]
    
    # Sort order:
    # 1. Higher urgency score first
    # 2. If same score, items with known days_remaining first
    def sort_key(rec):
        score = rec["urgency_score"]
        days = rec["days_remaining"]
        # None days remaining put after items with specific urgent dates
        days_val = 9999 if days is None else days
        return (-score, days_val)
        
    return sorted(evaluated, key=sort_key)
