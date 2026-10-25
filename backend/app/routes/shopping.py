from fastapi import APIRouter, HTTPException, status
from typing import List, Dict, Any, Optional
from ..database import get_db
from ..models import ShoppingItemCreate, ShoppingItemUpdate, ShoppingItemOut
from ..duplicate_engine import normalize_grocery_name, check_duplicate

router = APIRouter(prefix="/api/shopping-list", tags=["Shopping List"])

@router.get("", response_model=List[Dict[str, Any]])
def get_shopping_list():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE status = 'active';")
        active_items = [dict(row) for row in cursor.fetchall()]

        cursor.execute("SELECT * FROM shopping_items ORDER BY is_purchased ASC, id DESC;")
        shopping_rows = [dict(row) for row in cursor.fetchall()]

    # Augment each shopping item with duplicate check warning
    results = []
    for item in shopping_rows:
        warning = check_duplicate(item["name"], active_items) if not item["is_purchased"] else None
        item_dict = dict(item)
        item_dict["duplicate_warning"] = warning if (warning and warning["is_duplicate"]) else None
        results.append(item_dict)

    return results

@router.post("", status_code=status.HTTP_201_CREATED)
def add_shopping_item(payload: ShoppingItemCreate):
    norm = normalize_grocery_name(payload.name)
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Check duplicate before saving so we can return warning immediately
        cursor.execute("SELECT * FROM items WHERE status = 'active';")
        active_items = [dict(row) for row in cursor.fetchall()]
        duplicate_check = check_duplicate(payload.name, active_items)

        cursor.execute("""
            INSERT INTO shopping_items (name, normalized_name, quantity, unit, category, notes, is_purchased)
            VALUES (?, ?, ?, ?, ?, ?, 0)
        """, (
            payload.name,
            norm,
            payload.quantity,
            payload.unit,
            payload.category,
            payload.notes
        ))
        new_id = cursor.lastrowid
        cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (new_id,))
        row = dict(cursor.fetchone())
        row["duplicate_warning"] = duplicate_check if duplicate_check["is_duplicate"] else None
        return row

ALLOWED_SHOPPING_UPDATE_COLUMNS = {
    "name", "quantity", "unit", "category", "notes", "is_purchased"
}

@router.put("/{item_id}")
def update_shopping_item(item_id: int, payload: ShoppingItemUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Shopping item #{item_id} not found")

        updates = []
        params = []
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field in ALLOWED_SHOPPING_UPDATE_COLUMNS and value is not None:
                updates.append(f"{field} = ?")
                params.append(value)
                if field == "name":
                    updates.append("normalized_name = ?")
                    params.append(normalize_grocery_name(value))
                if field == "is_purchased" and value is True:
                    updates.append("purchased_at = CURRENT_TIMESTAMP")
                elif field == "is_purchased" and value is False:
                    updates.append("purchased_at = NULL")

        if not updates:
            return dict(existing)

        params.append(item_id)
        # Columns are strictly validated against ALLOWED_SHOPPING_UPDATE_COLUMNS whitelist
        sql = f"UPDATE shopping_items SET {', '.join(updates)} WHERE id = ?"  # nosec B608
        cursor.execute(sql, params)

        cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,))
        return dict(cursor.fetchone())

@router.delete("/{item_id}")
def delete_shopping_item(item_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM shopping_items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Shopping item #{item_id} not found")

        cursor.execute("DELETE FROM shopping_items WHERE id = ?", (item_id,))
        return {"success": True, "message": f"Removed '{row['name']}' from shopping list"}

@router.post("/{item_id}/convert-to-inventory")
def convert_to_inventory(item_id: int):
    """
    Convenience action: moves a purchased shopping list item directly into active inventory.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM shopping_items WHERE id = ?", (item_id,))
        s_item = cursor.fetchone()
        if not s_item:
            raise HTTPException(status_code=404, detail=f"Shopping item #{item_id} not found")

        # Mark as purchased
        cursor.execute("UPDATE shopping_items SET is_purchased = 1, purchased_at = CURRENT_TIMESTAMP WHERE id = ?", (item_id,))

        # Create active inventory item
        from datetime import date
        today = date.today().isoformat()
        cursor.execute("""
            INSERT INTO items (name, normalized_name, quantity, unit, category, purchase_date, notes, status, is_sample)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'active', 0)
        """, (
            s_item["name"],
            s_item["normalized_name"],
            s_item["quantity"],
            s_item["unit"],
            s_item["category"],
            today,
            f"Added from shopping list. {s_item['notes'] or ''}".strip()
        ))
        new_inv_id = cursor.lastrowid
        cursor.execute("SELECT * FROM items WHERE id = ?", (new_inv_id,))
        return {
            "success": True,
            "message": f"Converted '{s_item['name']}' to active inventory item #{new_inv_id}",
            "inventory_item": dict(cursor.fetchone())
        }
