import requests
import json
from datetime import date, timedelta

BACKEND_URL = "http://127.0.0.1:8000"
FRONTEND_PROXY_URL = "http://localhost:5173"

def run_live_demo_test():
    print("=" * 60)
    print("  GROCIQ LIVE DEMO SCENARIO VALIDATION")
    print("=" * 60)

    # Step 1: Health check direct & via proxy
    res = requests.get(f"{BACKEND_URL}/api/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_data = res.json()
    print("[PASS] Step 1A: Backend Health Endpoint Responding:")
    print(f"       App: {health_data['app']}, Team: {health_data['team']}")
    print(f"       Members: {', '.join(health_data['members'])}")

    res_proxy = requests.get(f"{FRONTEND_PROXY_URL}/api/health")
    assert res_proxy.status_code == 200, f"Frontend proxy to backend failed: {res_proxy.text}"
    print("[PASS] Step 1B: Frontend Proxy /api/health responding successfully.")

    # Dashboard check
    res_dash = requests.get(f"{BACKEND_URL}/api/dashboard")
    assert res_dash.status_code == 200
    dash_data = res_dash.json()
    print(f"[PASS] Step 1C: Dashboard Summary: {dash_data['total_active_items']} active items, "
          f"{dash_data['items_needing_review']} needing review, "
          f"{dash_data['outcomes_summary']['waste_avoidance_rate']}% waste avoidance rate.")

    # Step 2: Add "Spinach" with near-term date (2 days from today)
    today = date.today()
    spinach_payload = {
        "name": "Spinach",
        "quantity": 2.0,
        "unit": "bunches",
        "category": "Vegetables",
        "purchase_date": today.isoformat(),
        "expiry_date": (today + timedelta(days=2)).isoformat(),
        "price": 3.49,
        "notes": "Farm fresh spinach"
    }
    res_create = requests.post(f"{BACKEND_URL}/api/items", json=spinach_payload)
    assert res_create.status_code == 201, f"Create item failed: {res_create.text}"
    spinach_item = res_create.json()
    item_id = spinach_item["id"]
    print(f"[PASS] Step 2: Added 'Spinach' (ID: {item_id}, Qty: 2 bunches, Expiry: {spinach_item['expiry_date']})")

    # Step 3: Show item in Use First and explain why it appears
    res_recs = requests.get(f"{BACKEND_URL}/api/recommendations")
    assert res_recs.status_code == 200
    recs = res_recs.json()
    spinach_rec = next((r for r in recs if r["item_id"] == item_id), None)
    assert spinach_rec is not None, "Spinach not found in recommendations"
    assert spinach_rec["urgency_tier"] in ("HIGH", "URGENT"), f"Expected HIGH/URGENT tier, got {spinach_rec['urgency_tier']}"
    print(f"[PASS] Step 3: Spinach appears in Use First Ranking:")
    print(f"       Urgency Tier: {spinach_rec['urgency_tier']}")
    print(f"       Reason/Explanation: '{spinach_rec['explanation']}'")
    print(f"       Recommended Action: '{spinach_rec['recommended_action']}'")
    print(f"       Disclaimer: '{spinach_rec['disclaimer']}'")

    # Step 4: Add "Spinach" to shopping list and demonstrate duplicate warning
    res_dup = requests.get(f"{BACKEND_URL}/api/duplicates?name=Spinach")
    assert res_dup.status_code == 200
    dup_data = res_dup.json()
    assert dup_data["is_duplicate"] is True, "Expected duplicate detection for Spinach"
    print(f"[PASS] Step 4: Duplicate Warning Triggered:")
    print(f"       Matched Inventory Item: '{dup_data['matched_item_name']}'")
    print(f"       Existing Quantity: {dup_data['existing_quantity']} {dup_data['existing_unit']}")
    print(f"       Message: '{dup_data['message']}'")

    # Save to shopping list
    res_shop = requests.post(f"{BACKEND_URL}/api/shopping-list", json={
        "name": "Spinach",
        "quantity": 1.0,
        "unit": "bunches",
        "category": "Vegetables",
        "notes": "Need for salad"
    })
    assert res_shop.status_code == 201
    shop_item = res_shop.json()
    assert shop_item.get("duplicate_warning") is not None
    print(f"[PASS]        Added to shopping list with attached duplicate alert.")

    # Step 5: Record a consumed outcome for the item
    outcome_payload = {
        "outcome_type": "consumed",
        "quantity": 1.0,
        "reason": "Used in dinner pasta and smoothie",
        "date": today.isoformat()
    }
    res_outcome = requests.post(f"{BACKEND_URL}/api/items/{item_id}/outcome", json=outcome_payload)
    assert res_outcome.status_code == 200, f"Record outcome failed: {res_outcome.text}"
    outcome_record = res_outcome.json()
    print(f"[PASS] Step 5: Recorded Outcome for Spinach:")
    print(f"       Type: {outcome_record['outcome_type'].upper()}")
    print(f"       Quantity: {outcome_record['quantity']} {outcome_record['unit']}")
    print(f"       Reason: '{outcome_record['reason']}'")

    # Verify inventory was updated (1 bunch remaining)
    res_item_after = requests.get(f"{BACKEND_URL}/api/items/{item_id}")
    assert res_item_after.status_code == 200
    assert res_item_after.json()["quantity"] == 1.0
    print(f"       Inventory updated consistently: 1.0 bunch remaining.")

    # Step 6: Open analytics and show saved outcome in recent activity and metrics
    res_summary = requests.get(f"{BACKEND_URL}/api/outcomes/summary")
    assert res_summary.status_code == 200
    summary = res_summary.json()
    recent = summary["recent_activity"]
    latest_outcome = recent[0] if recent else None
    assert latest_outcome is not None and latest_outcome["item_name"] == "Spinach"
    print(f"[PASS] Step 6: Outcome Verified in Analytics Stream:")
    print(f"       Latest Activity: '{latest_outcome['item_name']}' - {latest_outcome['outcome_type']}")
    print(f"       Waste Avoidance Rate: {summary['waste_avoidance_rate']}%")
    print(f"       Total Tracked Outcomes: {summary['total_tracked']}")

    print("=" * 60)
    print("  ALL 6 STEPS OF MANDATORY LIVE DEMO SCENARIO PASSED!")
    print("=" * 60)

if __name__ == "__main__":
    run_live_demo_test()
