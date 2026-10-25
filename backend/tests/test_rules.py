import unittest
from datetime import date, timedelta
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from backend.app.rules_engine import evaluate_item_risk, rank_items_for_recommendations
from backend.app.duplicate_engine import normalize_grocery_name, check_duplicate

class TestRulesEngine(unittest.TestCase):
    def setUp(self):
        self.today = date(2026, 10, 25)

    def test_missing_date_unclassified(self):
        item = {"id": 1, "name": "Fuji Apples", "category": "Fruits", "expiry_date": None}
        rec = evaluate_item_risk(item, reference_date=self.today)
        self.assertEqual(rec["urgency_tier"], "UNCLASSIFIED")
        self.assertIn("Date information missing", rec["explanation"])
        self.assertIn("not a food-safety assessment", rec["disclaimer"])

    def test_overdue_date_urgent(self):
        past_date = (self.today - timedelta(days=2)).isoformat()
        item = {"id": 2, "name": "Yogurt", "category": "Dairy", "expiry_date": past_date}
        rec = evaluate_item_risk(item, reference_date=self.today)
        self.assertEqual(rec["urgency_tier"], "URGENT")
        self.assertIn("Overdue by 2 day(s)", rec["explanation"])

    def test_imminent_date_high(self):
        near_date = (self.today + timedelta(days=2)).isoformat()
        item = {"id": 3, "name": "Spinach", "category": "Vegetables", "expiry_date": near_date}
        rec = evaluate_item_risk(item, reference_date=self.today)
        self.assertEqual(rec["urgency_tier"], "HIGH")
        self.assertIn("in 2 day(s)", rec["explanation"])

    def test_medium_date(self):
        med_date = (self.today + timedelta(days=4)).isoformat()
        item = {"id": 4, "name": "Sourdough", "category": "Bakery", "expiry_date": med_date}
        rec = evaluate_item_risk(item, reference_date=self.today)
        self.assertEqual(rec["urgency_tier"], "MEDIUM")

    def test_low_date(self):
        future_date = (self.today + timedelta(days=20)).isoformat()
        item = {"id": 5, "name": "Rice", "category": "Grains", "expiry_date": future_date}
        rec = evaluate_item_risk(item, reference_date=self.today)
        self.assertEqual(rec["urgency_tier"], "LOW")
        self.assertIn("No urgent signal", rec["explanation"])

class TestDuplicateEngine(unittest.TestCase):
    def test_normalization(self):
        self.assertEqual(normalize_grocery_name("Tomatoes!"), "tomato")
        self.assertEqual(normalize_grocery_name("Fresh Apples"), "fresh apple")
        self.assertEqual(normalize_grocery_name("Baby Spinach"), "baby spinach")

    def test_duplicate_exact_and_fuzzy(self):
        inventory = [
            {"id": 1, "name": "Baby Spinach", "quantity": 1.0, "unit": "bags"},
            {"id": 2, "name": "Whole Milk", "quantity": 1.0, "unit": "gallons"}
        ]
        
        # Test 1: exact word "Baby Spinach"
        res1 = check_duplicate("Baby Spinach", inventory)
        self.assertTrue(res1["is_duplicate"])
        self.assertEqual(res1["matched_item_id"], 1)

        # Test 2: token containment "Spinach"
        res2 = check_duplicate("Spinach", inventory)
        self.assertTrue(res2["is_duplicate"])
        self.assertEqual(res2["matched_item_id"], 1)

        # Test 3: non-match "Almond Flour"
        res3 = check_duplicate("Almond Flour", inventory)
        self.assertFalse(res3["is_duplicate"])

if __name__ == "__main__":
    unittest.main()
