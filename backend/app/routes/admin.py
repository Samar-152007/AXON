from fastapi import APIRouter
from ..seed_data import reset_all_data, clear_all_data

router = APIRouter(prefix="/api/admin", tags=["Admin / Demo Data"])

@router.post("/reset-sample-data")
def reset_sample():
    reset_all_data(reseed=True)
    return {
        "success": True,
        "message": "Demo data reset successfully with labeled sample inventory, shopping list, and outcomes."
    }

@router.post("/clear-data")
def clear_data():
    clear_all_data()
    return {
        "success": True,
        "message": "All database records cleared to demonstrate clean empty states."
    }
