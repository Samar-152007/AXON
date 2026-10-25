from datetime import date, timedelta
from typing import Dict, Any, List
from .database import get_db
from .duplicate_engine import normalize_grocery_name

def get_sample_items() -> List[Dict[str, Any]]:
    today = date.today()
    return [
        {
            "name": "Fresh Whole Milk",
            "quantity": 1.0,
            "unit": "gallons",
            "category": "Dairy",
            "purchase_date": (today - timedelta(days=5)).isoformat(),
            "expiry_date": (today + timedelta(days=2)).isoformat(), # Imminent! High priority
            "unit_price": 75.0,
            "price": 75.0,
            "notes": "Farm fresh seal intact.",
            "is_sample": 1
        },
        {
            "name": "Greek Vanilla Yogurt",
            "quantity": 1.0,
            "unit": "tubs",
            "category": "Dairy",
            "purchase_date": (today - timedelta(days=12)).isoformat(),
            "expiry_date": (today - timedelta(days=1)).isoformat(), # Overdue recorded date for review!
            "unit_price": 150.0,
            "price": 150.0,
            "notes": "Opened 4 days ago.",
            "is_sample": 1
        },
        {
            "name": "Honeycrisp Apples",
            "quantity": 6.0,
            "unit": "units",
            "category": "Fruits",
            "purchase_date": (today - timedelta(days=2)).isoformat(),
            "expiry_date": None, # Missing date explicitly!
            "unit_price": 30.0,
            "price": 180.0,
            "notes": "Crisp orchard apples, stored in fruit bowl.",
            "is_sample": 1
        },
        {
            "name": "Artisan Sourdough Loaf",
            "quantity": 1.0,
            "unit": "loaves",
            "category": "Bakery",
            "purchase_date": (today - timedelta(days=1)).isoformat(),
            "expiry_date": (today + timedelta(days=4)).isoformat(), # Medium priority
            "unit_price": 120.0,
            "price": 120.0,
            "notes": "Local bakery batch.",
            "is_sample": 1
        },
        {
            "name": "Basmati Rice",
            "quantity": 5.0,
            "unit": "kg",
            "category": "Grains",
            "purchase_date": (today - timedelta(days=20)).isoformat(),
            "expiry_date": (today + timedelta(days=180)).isoformat(), # Safe horizon
            "unit_price": 90.0,
            "price": 450.0,
            "notes": "Sealed pantry tub.",
            "is_sample": 1
        },
        {
            "name": "Extra Virgin Olive Oil",
            "quantity": 1.0,
            "unit": "bottles",
            "category": "Pantry",
            "purchase_date": (today - timedelta(days=30)).isoformat(),
            "expiry_date": (today + timedelta(days=240)).isoformat(),
            "unit_price": 720.0,
            "price": 720.0,
            "notes": "Cold pressed.",
            "is_sample": 1
        }
    ]

def get_sample_shopping_items() -> List[Dict[str, Any]]:
    return [
        {
            "name": "Free-Range Eggs",
            "quantity": 12.0,
            "unit": "units",
            "category": "Dairy",
            "unit_price": 10.0,
            "notes": "Grade A Large"
        },
        {
            "name": "Rolled Oats",
            "quantity": 1.0,
            "unit": "kg",
            "category": "Grains",
            "unit_price": 160.0,
            "notes": "For morning porridge"
        }
    ]

def get_sample_outcomes() -> List[Dict[str, Any]]:
    today = date.today()
    return [
        {
            "item_name": "Baby Spinach",
            "quantity": 1.0,
            "unit": "bags",
            "category": "Vegetables",
            "outcome_type": "consumed",
            "unit_price": 50.0,
            "financial_loss": 0.0,
            "reason": "Used in dinner pasta and morning smoothie.",
            "date": (today - timedelta(days=5)).isoformat()
        },
        {
            "item_name": "Ripe Bananas",
            "quantity": 6.0,
            "unit": "units",
            "category": "Fruits",
            "outcome_type": "consumed",
            "unit_price": 10.0,
            "financial_loss": 0.0,
            "reason": "Made banana bread.",
            "date": (today - timedelta(days=4)).isoformat()
        },
        {
            "item_name": "Heavy Cream",
            "quantity": 1.0,
            "unit": "tubs",
            "category": "Dairy",
            "outcome_type": "discarded",
            "unit_price": 220.0,
            "financial_loss": 220.0,
            "reason": "Curdled before weekend baking.",
            "date": (today - timedelta(days=3)).isoformat()
        },
        {
            "item_name": "Organic Strawberries",
            "quantity": 1.0,
            "unit": "boxes",
            "category": "Fruits",
            "outcome_type": "discarded",
            "unit_price": 180.0,
            "financial_loss": 180.0,
            "reason": "Molded at the bottom of the punnet.",
            "date": (today - timedelta(days=2)).isoformat()
        },
        {
            "item_name": "Fresh Paneer",
            "quantity": 1.0,
            "unit": "packs",
            "category": "Dairy",
            "outcome_type": "discarded",
            "unit_price": 120.0,
            "financial_loss": 120.0,
            "reason": "Past date and smelled sour.",
            "date": (today - timedelta(days=1)).isoformat()
        },
        {
            "item_name": "Brown Bread Loaf",
            "quantity": 1.0,
            "unit": "loaves",
            "category": "Bakery",
            "outcome_type": "donated",
            "unit_price": 55.0,
            "financial_loss": 0.0,
            "reason": "Shared with building security staff before leaving for weekend.",
            "date": (today - timedelta(days=1)).isoformat()
        }
    ]

def seed_sample_database(clear_first: bool = False):
    """
    Populates the database with realistic, clearly-flagged sample data and financial unit prices.
    """
    with get_db() as conn:
        cursor = conn.cursor()
        
        if clear_first:
            cursor.execute("DELETE FROM outcomes;")
            cursor.execute("DELETE FROM shopping_items;")
            cursor.execute("DELETE FROM items;")

        # Check if items already exist
        cursor.execute("SELECT COUNT(*) as count FROM items;")
        count = cursor.fetchone()["count"]
        if count > 0 and not clear_first:
            return # Already has data

        # Seed items
        for item in get_sample_items():
            norm = normalize_grocery_name(item["name"])
            u_price = item.get("unit_price", item.get("price", 0.0))
            cursor.execute("""
            INSERT INTO items (name, normalized_name, quantity, unit, category, unit_price, price, purchase_date, expiry_date, notes, status, is_sample)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?);
            """, (item["name"], norm, item["quantity"], item["unit"], item["category"], 
                  u_price, u_price, item["purchase_date"], item["expiry_date"], item["notes"], item["is_sample"]))

        # Seed shopping list
        for s in get_sample_shopping_items():
            norm = normalize_grocery_name(s["name"])
            u_price = s.get("unit_price", 0.0)
            cursor.execute("""
            INSERT INTO shopping_items (name, normalized_name, quantity, unit, category, unit_price, notes, is_purchased)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0);
            """, (s["name"], norm, s["quantity"], s["unit"], s["category"], u_price, s["notes"]))

        # Seed outcomes with financial loss
        for o in get_sample_outcomes():
            u_price = o.get("unit_price", 0.0)
            loss = o.get("financial_loss", 0.0)
            cursor.execute("""
            INSERT INTO outcomes (item_name, quantity, unit, category, outcome_type, unit_price, financial_loss, reason, date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
            """, (o["item_name"], o["quantity"], o["unit"], o["category"], o["outcome_type"], u_price, loss, o["reason"], o["date"]))

def reset_all_data(reseed: bool = True):
    seed_sample_database(clear_first=True) if reseed else clear_all_data()

def clear_all_data():
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM outcomes;")
        cursor.execute("DELETE FROM shopping_items;")
        cursor.execute("DELETE FROM items;")
