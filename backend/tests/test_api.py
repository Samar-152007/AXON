import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Use a test database to keep tests isolated
os.environ["GROCIQ_DB_PATH"] = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test_grociq.db")

from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import init_db
from backend.app.seed_data import seed_sample_database

class TestGrocIQAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        seed_sample_database(clear_first=True)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        test_db = os.environ.get("GROCIQ_DB_PATH")
        if test_db and os.path.exists(test_db):
            try:
                os.remove(test_db)
            except Exception:
                pass

    def test_01_health_check(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["team"], "AXON")
        self.assertIn("Samarjeet Suryawanshi", data["members"])

    def test_02_create_and_read_item(self):
        payload = {
            "name": "Fresh Spinach",
            "quantity": 2.0,
            "unit": "bunches",
            "category": "Vegetables",
            "purchase_date": "2026-10-25",
            "expiry_date": "2026-10-28",
            "price": 2.99,
            "notes": "Farm organic"
        }
        resp = self.client.post("/api/items", json=payload)
        self.assertEqual(resp.status_code, 201)
        item = resp.json()
        self.assertEqual(item["name"], "Fresh Spinach")
        self.assertEqual(item["quantity"], 2.0)
        item_id = item["id"]

        # Retrieve item
        get_resp = self.client.get(f"/api/items/{item_id}")
        self.assertEqual(get_resp.status_code, 200)
        self.assertEqual(get_resp.json()["id"], item_id)

    def test_03_validation_rules(self):
        # Empty name must fail validation
        resp1 = self.client.post("/api/items", json={"name": "   ", "quantity": 1})
        self.assertEqual(resp1.status_code, 422)

        # Quantity <= 0 must fail
        resp2 = self.client.post("/api/items", json={"name": "Milk", "quantity": 0})
        self.assertEqual(resp2.status_code, 422)

        # Negative price must fail
        resp3 = self.client.post("/api/items", json={"name": "Bread", "quantity": 1, "price": -5.0})
        self.assertEqual(resp3.status_code, 422)

    def test_04_recommendations(self):
        resp = self.client.get("/api/recommendations")
        self.assertEqual(resp.status_code, 200)
        recs = resp.json()
        self.assertGreater(len(recs), 0)
        # Check first recommendation has explanation and disclaimer
        first = recs[0]
        self.assertIn("explanation", first)
        self.assertIn("urgency_tier", first)
        self.assertIn("disclaimer", first)

    def test_05_duplicate_detection(self):
        # We have "Fresh Spinach" in inventory from test_02
        resp = self.client.get("/api/duplicates?name=Spinach")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertTrue(data["is_duplicate"])
        self.assertIn("Review before buying", data["message"])

    def test_06_shopping_list_flow(self):
        # Add item
        resp = self.client.post("/api/shopping-list", json={
            "name": "Spinach",
            "quantity": 1.0,
            "unit": "bunches",
            "category": "Vegetables",
            "notes": "Weekly salads"
        })
        self.assertEqual(resp.status_code, 201)
        data = resp.json()
        self.assertIsNotNone(data.get("duplicate_warning")) # Flagged as duplicate against inventory!
        shop_id = data["id"]

        # Mark as purchased
        upd = self.client.put(f"/api/shopping-list/{shop_id}", json={"is_purchased": True})
        self.assertEqual(upd.status_code, 200)
        self.assertTrue(upd.json()["is_purchased"])

    def test_07_outcome_recording(self):
        # Create an item to consume
        create_resp = self.client.post("/api/items", json={
            "name": "Strawberries",
            "quantity": 1.0,
            "unit": "boxes",
            "category": "Fruits",
            "purchase_date": "2026-10-25"
        })
        item_id = create_resp.json()["id"]

        # Record consumed
        outcome_resp = self.client.post(f"/api/items/{item_id}/outcome", json={
            "outcome_type": "consumed",
            "reason": "Made delicious smoothie bowl.",
            "date": "2026-10-25"
        })
        self.assertEqual(outcome_resp.status_code, 200)
        self.assertEqual(outcome_resp.json()["outcome_type"], "consumed")

        # Second attempt must be rejected (prevent accidental duplicate outcomes)
        second_resp = self.client.post(f"/api/items/{item_id}/outcome", json={
            "outcome_type": "consumed"
        })
        self.assertEqual(second_resp.status_code, 400)

    def test_08_dashboard_and_analytics(self):
        resp = self.client.get("/api/dashboard")
        self.assertEqual(resp.status_code, 200)
        dash = resp.json()
        self.assertIn("total_active_items", dash)
        self.assertIn("outcomes_summary", dash)
        self.assertIn("recent_outcomes", dash)
        self.assertIn("duplicate_warnings_count", dash)

        summary_resp = self.client.get("/api/outcomes/summary")
        self.assertEqual(summary_resp.status_code, 200)
        summary = summary_resp.json()
        self.assertIn("waste_avoidance_rate", summary)

if __name__ == "__main__":
    unittest.main()
