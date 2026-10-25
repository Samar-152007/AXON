from fastapi import APIRouter, HTTPException, Query, status
from typing import List, Dict, Any, Optional
from ..database import get_db
from ..models import OutcomeOut

router = APIRouter(prefix="/api/outcomes", tags=["Outcomes & Analytics"])

@router.get("", response_model=List[OutcomeOut])
def get_outcomes(
    outcome_type: Optional[str] = Query(None, description="Filter by consumed, discarded, or donated"),
    limit: int = Query(50, ge=1, le=200)
):
    with get_db() as conn:
        cursor = conn.cursor()
        query = "SELECT * FROM outcomes WHERE 1=1"
        params = []
        if outcome_type and outcome_type.lower() != "all":
            query += " AND outcome_type = ?"
            params.append(outcome_type.lower())

        query += " ORDER BY date DESC, id DESC LIMIT ?"
        params.append(limit)

        cursor.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

@router.get("/summary")
def get_outcomes_summary() -> Dict[str, Any]:
    with get_db() as conn:
        cursor = conn.cursor()
        
        # Calculate financial sums
        cursor.execute("""
            SELECT 
                outcome_type,
                COUNT(*) as count,
                SUM(quantity) as total_qty,
                SUM(quantity * COALESCE(unit_price, 0)) as total_val,
                SUM(COALESCE(financial_loss, 0)) as total_loss
            FROM outcomes
            GROUP BY outcome_type;
        """)
        rows = cursor.fetchall()
        breakdown = {row["outcome_type"]: {
            "count": row["count"],
            "total_qty": round(row["total_qty"] or 0, 1),
            "total_val": round(row["total_val"] or 0, 2),
            "total_loss": round(row["total_loss"] or 0, 2)
        } for row in rows}

        consumed = breakdown.get("consumed", {"count": 0, "total_qty": 0, "total_val": 0.0, "total_loss": 0.0})
        discarded = breakdown.get("discarded", {"count": 0, "total_qty": 0, "total_val": 0.0, "total_loss": 0.0})
        donated = breakdown.get("donated", {"count": 0, "total_qty": 0, "total_val": 0.0, "total_loss": 0.0})
        total_tracked = consumed["count"] + discarded["count"] + donated["count"]

        saved = consumed["count"] + donated["count"]
        efficiency = round((saved / total_tracked * 100), 1) if total_tracked > 0 else 100.0

        # Financial values
        total_waste_val = discarded["total_loss"] if discarded["total_loss"] > 0 else discarded["total_val"]
        household_burn_rate = round(total_waste_val / 4.28, 2) if total_waste_val > 0 else 0.0

        from .analytics import generate_gamified_message
        gamified_msg, burn_status, _ = generate_gamified_message(total_waste_val)

        # Recent outcomes for analytics activity stream
        cursor.execute("SELECT * FROM outcomes ORDER BY date DESC, id DESC LIMIT 8;")
        recent = [dict(r) for r in cursor.fetchall()]

        return {
            "consumed": consumed,
            "discarded": discarded,
            "donated": donated,
            "total_tracked": total_tracked,
            "waste_avoidance_rate": efficiency,
            "total_waste_value": total_waste_val,
            "household_burn_rate": household_burn_rate,
            "gamified_message": gamified_msg,
            "currency_symbol": "₹",
            "total_consumed_value": consumed["total_val"],
            "burn_rate_status": burn_status,
            "recent_activity": recent
        }
