from fastapi import APIRouter, Query
from typing import Optional, List, Dict, Any
from ..database import get_db
from ..models import DuplicateMatch
from ..duplicate_engine import check_duplicate

router = APIRouter(prefix="/api/duplicates", tags=["Duplicate Detection"])

@router.get("", response_model=DuplicateMatch)
def check_item_duplicate(name: str = Query(..., min_length=1, description="Candidate item name to check")):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE status = 'active';")
        active_items = [dict(row) for row in cursor.fetchall()]

    result = check_duplicate(name, active_items)
    return result

@router.get("/all-warnings")
def get_all_duplicate_warnings() -> List[Dict[str, Any]]:
    """
    Scans the entire shopping list against active inventory to flag potential duplicate buys.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE status = 'active';")
        active_items = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("SELECT * FROM shopping_items WHERE is_purchased = 0;")
        shopping_items = [dict(row) for row in cursor.fetchall()]

    warnings = []
    for s_item in shopping_items:
        match = check_duplicate(s_item["name"], active_items)
        if match["is_duplicate"]:
            warnings.append({
                "shopping_item_id": s_item["id"],
                "shopping_item_name": s_item["name"],
                "shopping_quantity": s_item["quantity"],
                "shopping_unit": s_item["unit"],
                "inventory_item_id": match["matched_item_id"],
                "inventory_item_name": match["matched_item_name"],
                "inventory_quantity": match["existing_quantity"],
                "inventory_unit": match["existing_unit"],
                "similarity_score": match["similarity_score"],
                "message": match["message"]
            })

    return warnings
