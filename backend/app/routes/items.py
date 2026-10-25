from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Optional
from datetime import datetime
from ..database import get_db
from ..models import ItemCreate, ItemUpdate, ItemOut, OutcomeCreate, OutcomeOut
from ..duplicate_engine import normalize_grocery_name

router = APIRouter(tags=["Inventory"])

@router.get("", response_model=List[ItemOut])
def get_items(
    category: Optional[str] = None,
    status_filter: str = Query("active", alias="status"),
    search: Optional[str] = None
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM items WHERE 1=1"
        params = []

        if status_filter != "all":
            query += " AND status = ?"
            params.append(status_filter)

        if category and category != "All":
            query += " AND category = ?"
            params.append(category)

        if search and search.strip():
            query += " AND (name LIKE ? OR notes LIKE ?)"
            term = f"%{search.strip()}%"
            params.extend([term, term])

        query += " ORDER BY CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END, expiry_date ASC, id DESC"
        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

@router.post("", response_model=ItemOut, status_code=status.HTTP_201_CREATED)
def create_item(payload: ItemCreate):
    norm = normalize_grocery_name(payload.name)
    u_price = payload.unit_price if payload.unit_price is not None else payload.price
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO items (name, normalized_name, quantity, unit, category, unit_price, price, purchase_date, expiry_date, notes, status, is_sample)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
        """, (
            payload.name,
            norm,
            payload.quantity,
            payload.unit,
            payload.category,
            u_price,
            u_price,
            payload.purchase_date,
            payload.expiry_date,
            payload.notes,
            1 if payload.is_sample else 0
        ))
        item_id = cursor.lastrowid
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        return dict(row)

@router.get("/{item_id}", response_model=ItemOut)
def get_item(item_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Item #{item_id} not found in inventory")
        return dict(row)

ALLOWED_UPDATE_COLUMNS = {
    "name", "quantity", "unit", "category", "unit_price", "purchase_date", "expiry_date", "price", "notes"
}

@router.put("/{item_id}", response_model=ItemOut)
def update_item(item_id: int, payload: ItemUpdate):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        existing = cursor.fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail=f"Item #{item_id} not found in inventory")

        updates = []
        params = []
        for field, value in payload.model_dump(exclude_unset=True).items():
            if field in ALLOWED_UPDATE_COLUMNS and value is not None:
                updates.append(f"{field} = ?")
                params.append(value)
                if field == "name":
                    updates.append("normalized_name = ?")
                    params.append(normalize_grocery_name(value))

        if not updates:
            return dict(existing)

        updates.append("updated_at = CURRENT_TIMESTAMP")
        params.append(item_id)
        
        # Columns are strictly validated against ALLOWED_UPDATE_COLUMNS whitelist
        sql = f"UPDATE items SET {', '.join(updates)} WHERE id = ?"  # nosec B608
        cursor.execute(sql, params)
        
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        return dict(cursor.fetchone())

@router.delete("/{item_id}", status_code=status.HTTP_200_OK)
def delete_item(item_id: int):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, name FROM items WHERE id = ?", (item_id,))
        row = cursor.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail=f"Item #{item_id} not found")
        
        cursor.execute("DELETE FROM items WHERE id = ?", (item_id,))
        return {"success": True, "message": f"Item '{row['name']}' deleted from inventory"}

@router.post("/{item_id}/outcome", response_model=OutcomeOut)
def record_item_outcome(item_id: int, payload: OutcomeCreate):
    """
    Records an inventory item's outcome (consumed, discarded, donated).
    Calculates financial loss (quantity * unit_price) if discarded.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE id = ?", (item_id,))
        item = cursor.fetchone()
        if not item:
            raise HTTPException(status_code=404, detail=f"Item #{item_id} not found")

        if item["status"] != "active":
            raise HTTPException(
                status_code=400, 
                detail=f"Item '{item['name']}' is already marked as {item['status']}. Cannot record outcome again."
            )

        qty_to_record = payload.quantity if payload.quantity and payload.quantity > 0 else item["quantity"]
        item_unit_price = (
            payload.unit_price if payload.unit_price is not None
            else (item["unit_price"] if "unit_price" in item.keys() and item["unit_price"] is not None
            else (item["price"] or 0.0))
        )
        financial_loss = round(qty_to_record * item_unit_price, 2) if payload.outcome_type == 'discarded' else 0.0

        # If user consumed/discarded partial quantity
        if payload.quantity and payload.quantity < item["quantity"]:
            remaining_qty = item["quantity"] - payload.quantity
            cursor.execute("UPDATE items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (remaining_qty, item_id))
        else:
            # Mark entire item with outcome status
            cursor.execute("UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?", (payload.outcome_type, item_id))

        # Insert outcome record with unit_price and financial_loss
        cursor.execute("""
            INSERT INTO outcomes (item_id, item_name, quantity, unit, category, outcome_type, unit_price, financial_loss, reason, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item_id,
            item["name"],
            qty_to_record,
            item["unit"],
            item["category"],
            payload.outcome_type,
            item_unit_price,
            financial_loss,
            payload.reason or "",
            payload.date
        ))
        
        outcome_id = cursor.lastrowid
        cursor.execute("SELECT * FROM outcomes WHERE id = ?", (outcome_id,))
        outcome_row = cursor.fetchone()
        return dict(outcome_row)
