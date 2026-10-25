from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import date
import re

VALID_CATEGORIES = [
    "Vegetables",
    "Fruits",
    "Dairy",
    "Grains",
    "Pantry",
    "Bakery",
    "Frozen",
    "Beverages",
    "Meat & Seafood",
    "Snacks",
    "Other"
]

class ItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="Item name cannot be empty")
    quantity: float = Field(..., gt=0, lt=1000000, description="Quantity must be positive and reasonable")
    unit: str = Field(default="units", max_length=50)
    category: str = Field(default="Other", max_length=50)
    unit_price: Optional[float] = Field(default=None, ge=0, lt=1000000, description="Cost per unit in ₹")
    price: Optional[float] = Field(default=None, ge=0, lt=1000000, description="Cost per unit in ₹")
    purchase_date: str = Field(default_factory=lambda: date.today().isoformat())
    expiry_date: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default="", max_length=2000)

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Item name cannot be empty or whitespace only")
        return s

    @field_validator("expiry_date")
    def validate_expiry(cls, v: Optional[str]) -> Optional[str]:
        if not v or v.strip() == "":
            return None
        v = v.strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Expiry date must be in YYYY-MM-DD format or empty")
        return v

    @field_validator("purchase_date")
    def validate_purchase(cls, v: str) -> str:
        v = v.strip()
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("Purchase date must be in YYYY-MM-DD format")
        return v

    @model_validator(mode="after")
    def sync_prices(self):
        # Sync unit_price and price bidirectionally
        if self.unit_price is None and self.price is not None:
            self.unit_price = self.price
        elif self.price is None and self.unit_price is not None:
            self.price = self.unit_price
        return self

class ItemCreate(ItemBase):
    is_sample: Optional[bool] = False

class ItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0, lt=1000000)
    unit: Optional[str] = Field(default=None, max_length=50)
    category: Optional[str] = Field(default=None, max_length=50)
    unit_price: Optional[float] = Field(default=None, ge=0, lt=1000000)
    price: Optional[float] = Field(default=None, ge=0, lt=1000000)
    purchase_date: Optional[str] = None
    expiry_date: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def sync_prices(self):
        if self.unit_price is None and self.price is not None:
            self.unit_price = self.price
        elif self.price is None and self.unit_price is not None:
            self.price = self.unit_price
        return self

class ItemOut(ItemBase):
    id: int
    normalized_name: str
    status: str
    is_sample: bool
    created_at: str
    updated_at: str

class ShoppingItemBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    quantity: float = Field(default=1.0, gt=0, lt=1000000)
    unit: str = Field(default="units", max_length=50)
    category: str = Field(default="Other", max_length=50)
    unit_price: Optional[float] = Field(default=None, ge=0, lt=1000000)
    notes: Optional[str] = Field(default="", max_length=2000)

    @field_validator("name")
    def validate_name(cls, v: str) -> str:
        s = v.strip()
        if not s:
            raise ValueError("Shopping item name cannot be empty")
        return s

class ShoppingItemCreate(ShoppingItemBase):
    pass

class ShoppingItemUpdate(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    quantity: Optional[float] = Field(default=None, gt=0, lt=1000000)
    unit: Optional[str] = Field(default=None, max_length=50)
    category: Optional[str] = Field(default=None, max_length=50)
    unit_price: Optional[float] = Field(default=None, ge=0, lt=1000000)
    notes: Optional[str] = Field(default=None, max_length=2000)
    is_purchased: Optional[bool] = None

class ShoppingItemOut(ShoppingItemBase):
    id: int
    normalized_name: str
    is_purchased: bool
    added_at: str
    purchased_at: Optional[str] = None

class OutcomeCreate(BaseModel):
    outcome_type: str = Field(..., description="Must be 'consumed', 'discarded', or 'donated'")
    quantity: Optional[float] = Field(default=None, gt=0, lt=1000000)
    unit_price: Optional[float] = Field(default=None, ge=0, lt=1000000)
    reason: Optional[str] = Field(default="", max_length=1000)
    date: Optional[str] = Field(default_factory=lambda: date.today().isoformat())

    @field_validator("outcome_type")
    def validate_outcome_type(cls, v: str) -> str:
        valid = ["consumed", "discarded", "donated"]
        if v.lower() not in valid:
            raise ValueError(f"Outcome type must be one of: {', '.join(valid)}")
        return v.lower()

class OutcomeOut(BaseModel):
    id: int
    item_id: Optional[int]
    item_name: str
    quantity: float
    unit: str
    category: str
    outcome_type: str
    unit_price: Optional[float] = 0.0
    financial_loss: Optional[float] = 0.0
    reason: Optional[str]
    date: str
    created_at: str

class DuplicateMatch(BaseModel):
    is_duplicate: bool
    matched_item_id: Optional[int] = None
    matched_item_name: Optional[str] = None
    existing_quantity: Optional[float] = None
    existing_unit: Optional[str] = None
    similarity_score: float = 0.0
    message: str

class RecommendationOut(BaseModel):
    item_id: int
    name: str
    category: str
    quantity: float
    unit: str
    unit_price: Optional[float] = 0.0
    expiry_date: Optional[str]
    days_remaining: Optional[int]
    urgency_tier: str
    urgency_score: int
    explanation: str
    recommended_action: str
    disclaimer: str

class WasteToWealthSummary(BaseModel):
    total_waste_value: float # Sum of quantity * unit_price for all discarded events this month in ₹
    household_burn_rate: float # Average money lost per week in ₹
    gamified_message: str # Dynamic comparison (e.g. coffees, pizzas)
    currency_symbol: str = "₹"
    total_consumed_value: float
    total_donated_value: float
    total_tracked_value: float
    waste_avoidance_rate: float
    burn_rate_status: str # 'PRUDENT', 'MODERATE', 'ALERT'
    month_name: str
    item_breakdown: List[Dict[str, Any]] = []
    savings_opportunities: List[Dict[str, Any]] = []
