from fastapi import APIRouter
from typing import Dict, Any, List
from ..database import get_db
from ..rules_engine import rank_items_for_recommendations
from ..duplicate_engine import check_duplicate

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])

@router.get("")
def get_dashboard_summary() -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()

        # 1. Active items
        cursor.execute("SELECT * FROM items WHERE status = 'active';")
        active_items = [dict(row) for row in cursor.fetchall()]
        total_active = len(active_items)

        # Check if sample data is present
        cursor.execute("SELECT COUNT(*) as count FROM items WHERE is_sample = 1;")
        sample_count = cursor.fetchone()["count"]
        has_sample_data = sample_count > 0

        # Category breakdown
        category_counts: Dict[str, int] = {}
        for item in active_items:
            cat = item.get("category", "Other")
            category_counts[cat] = category_counts.get(cat, 0) + 1

        # 2. Urgent / High risk recommendations
        ranked_recs = rank_items_for_recommendations(active_items)
        urgent_reviews = [r for r in ranked_recs if r["urgency_tier"] in ("URGENT", "HIGH")]

        # 3. Shopping list items (unpurchased)
        cursor.execute("SELECT * FROM shopping_items WHERE is_purchased = 0;")
        shopping_rows = [dict(row) for row in cursor.fetchall()]
        shopping_count = len(shopping_rows)

        # 4. Duplicate checks across shopping list against active inventory
        duplicate_warnings = []
        for s_item in shopping_rows:
            match = check_duplicate(s_item["name"], active_items)
            if match["is_duplicate"]:
                duplicate_warnings.append({
                    "shopping_item_name": s_item["name"],
                    "matched_item_name": match["matched_item_name"],
                    "existing_quantity": match["existing_quantity"],
                    "existing_unit": match["existing_unit"],
                    "message": match["message"]
                })

        # 5. Outcome stats with financial totals
        cursor.execute("""
            SELECT 
                outcome_type,
                COUNT(*) as count,
                SUM(COALESCE(financial_loss, quantity * COALESCE(unit_price, 0))) as total_loss
            FROM outcomes
            GROUP BY outcome_type;
        """)
        outcomes_rows = cursor.fetchall()
        outcomes_by_type = {row["outcome_type"]: row["count"] for row in outcomes_rows}
        discarded_financial_loss = sum(row["total_loss"] for row in outcomes_rows if row["outcome_type"] == "discarded") or 0.0

        consumed_count = outcomes_by_type.get("consumed", 0)
        discarded_count = outcomes_by_type.get("discarded", 0)
        donated_count = outcomes_by_type.get("donated", 0)
        total_outcomes = consumed_count + discarded_count + donated_count

        waste_avoidance_rate = (
            round(((consumed_count + donated_count) / total_outcomes * 100), 1)
            if total_outcomes > 0 else 100.0
        )
        total_waste_val = round(discarded_financial_loss, 2)
        burn_rate = round(total_waste_val / 4.28, 2) if total_waste_val > 0 else 0.0

        # 6. Recent outcomes (last 5)
        cursor.execute("SELECT * FROM outcomes ORDER BY date DESC, id DESC LIMIT 5;")
        recent_outcomes = [dict(row) for row in cursor.fetchall()]

    return {
        "total_active_items": total_active,
        "items_needing_review": len(urgent_reviews),
        "urgent_recommendations": urgent_reviews[:4],
        "shopping_list_count": shopping_count,
        "duplicate_warnings_count": len(duplicate_warnings),
        "duplicate_warnings": duplicate_warnings[:3],
        "outcomes_summary": {
            "consumed": consumed_count,
            "discarded": discarded_count,
            "donated": donated_count,
            "total": total_outcomes,
            "waste_avoidance_rate": waste_avoidance_rate,
            "total_waste_value": total_waste_val,
            "household_burn_rate": burn_rate,
            "currency_symbol": "₹"
        },
        "category_distribution": category_counts,
        "recent_outcomes": recent_outcomes,
        "has_sample_data": has_sample_data
    }
