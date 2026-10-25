from fastapi import APIRouter, Query
from typing import List, Optional
from ..database import get_db
from ..models import RecommendationOut
from ..rules_engine import rank_items_for_recommendations

router = APIRouter(prefix="/api/recommendations", tags=["Recommendations"])

@router.get("", response_model=List[RecommendationOut])
def get_recommendations(
    tier: Optional[str] = Query(None, description="Filter by urgency tier: URGENT, HIGH, MEDIUM, LOW, UNCLASSIFIED"),
    category: Optional[str] = Query(None, description="Filter by grocery category")
):
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM items WHERE status = 'active';")
        active_items = [dict(row) for row in cursor.fetchall()]

    ranked = rank_items_for_recommendations(active_items)

    if tier and tier.upper() != "ALL":
        ranked = [r for r in ranked if r["urgency_tier"] == tier.upper()]

    if category and category != "All":
        ranked = [r for r in ranked if r["category"] == category]

    return ranked
