# GrocIQ — Smarter Inventory. Less Waste.

> **Triwizathon Round 2 | Team AXON**  
> **Team Members:** Samarjeet Suryawanshi, Shivanjali Desai, Poonam Pawar, Angel Kambale  
> **Tagline:** Smarter inventory. Less waste.

---

## 1. Product Overview

GrocIQ is a transparent, feedback-driven grocery inventory management system designed for modern households. Rather than making black-box AI claims, GrocIQ empowers households through a transparent, explainable product loop:

$$\text{Capture} \longrightarrow \text{Confirm} \longrightarrow \text{Inventory} \longrightarrow \text{Assess Risk} \longrightarrow \text{Explain} \longrightarrow \text{Recommend Action} \longrightarrow \text{Record Outcome} \longrightarrow \text{Evaluate}$$

### Core Innovation:
- **Transparent Rules Engine:** Items are prioritized for attention based on confirmed approaching dates, overdue recorded dates, and missing information. Each recommendation explains **why** it appears.
- **Duplicate-Purchase Guard:** Prevents unnecessary waste and overspending by alerting users when items already exist in household stock.
- **Outcome Ledger:** Real household waste reduction metrics derived only from explicit user-confirmed outcomes (Consumed, Discarded, Donated).
- **Enchanted Pantry UI:** Polished Dark Academia aesthetic featuring forest green, midnight blue, antique gold accents, and parchment cards while preserving modern SaaS usability.

---

## 2. Architecture & Tech Stack

- **Frontend:** React 19 + Vite 8 + Tailwind CSS v4 + Lucide Icons. Configured with a backend reverse proxy on `/api` to `http://127.0.0.1:8000`.
- **Backend:** Python 3.13 + FastAPI + Uvicorn. REST API architecture with clean Pydantic schema validation.
- **Database:** SQLite with WAL mode (`grociq.db`), foreign keys enabled, and index optimization for rapid local execution. Structured for direct migration to PostgreSQL.
- **Intelligence Engines:**
  - `backend/app/rules_engine.py`: Deterministic risk prioritization and explainable recommendations.
  - `backend/app/duplicate_engine.py`: Normalized tokenization and fuzzy similarity matching (RapidFuzz).
  - `backend/app/seed_data.py`: Realistic, labeled sample dataset with instant reset and clean-slate testing.

---

## 3. Setup & Running Locally

### Prerequisites:
- Python 3.10+ (Tested on Python 3.13)
- Node.js 18+ (Tested on Node.js v24 / npm 11)

### Quick Start Commands:

#### Step 1: Clone / Enter Project Directory
```bash
cd c:\Users\Samarjeet\OneDrive\Desktop\bgfg
```

#### Step 2: Install Backend Dependencies & Start Server
```bash
# Optional: install dependencies if not globally installed
python -m pip install -r backend/requirements.txt

# Start backend server (runs on http://127.0.0.1:8000)
python backend/run.py
```

#### Step 3: Install Frontend Dependencies & Start Dev Server
In a second terminal window:
```bash
cd frontend
npm install
npm run dev
```

The application will be live at **`http://localhost:5173`**.

---

## 4. Suggested API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health status, team metadata, and version |
| `GET` | `/api/dashboard` | Live summary stats, attention queue, duplicate warnings, and outcomes |
| `GET` | `/api/items` | List inventory items (supports `?category=`, `?status=`, `?search=`) |
| `POST` | `/api/items` | Add new grocery item (validates name, quantity > 0, price >= 0) |
| `GET` | `/api/items/{id}` | Retrieve specific grocery item |
| `PUT` | `/api/items/{id}` | Update item details |
| `DELETE` | `/api/items/{id}` | Delete item from inventory |
| `POST` | `/api/items/{id}/outcome` | Record outcome (Consumed, Discarded, Donated) & update inventory |
| `GET` | `/api/recommendations` | Prioritized "Use First" items with explicit reasons and disclaimer |
| `GET` | `/api/duplicates` | Real-time duplicate check (`?name=Spinach`) |
| `GET` | `/api/shopping-list` | List shopping items with attached inventory duplicate alerts |
| `POST` | `/api/shopping-list` | Add item to shopping list |
| `PUT` | `/api/shopping-list/{id}` | Update quantity, purchased state |
| `DELETE` | `/api/shopping-list/{id}` | Remove item from shopping list |
| `POST` | `/api/shopping-list/{id}/convert-to-inventory` | Move purchased shopping item directly into active inventory |
| `GET` | `/api/outcomes` | Outcome history logs (supports `?outcome_type=`, `?limit=`) |
| `GET` | `/api/outcomes/summary` | Waste avoidance efficiency rate and category breakdowns |
| `POST` | `/api/receipt/extract` | Extract candidate items from receipt text or image |
| `POST` | `/api/receipt/confirm` | Batch import confirmed receipt items into inventory |
| `POST` | `/api/admin/reset-sample-data` | Reset to realistic labeled sample demo data |
| `POST` | `/api/admin/clear-data` | Clear all data to test empty states |

---

## 5. Automated Test Suite

Run backend business logic unit tests:
```bash
python backend/tests/test_rules.py
```
*Result: 7/7 unit tests passed (`OK`).*

Run complete API end-to-end integration tests:
```bash
python backend/tests/test_api.py
```
*Result: 8/8 API integration tests passed (`OK`).*

Run live-demo scenario verification:
```bash
python test_demo_flow.py
```
*Result: All 6 demo steps verified end-to-end.*

---

## 6. Live-Demo Script for Judges (3-5 Minutes)

### **Step 1: Dashboard & Household Summary (30s)**
- Open `http://localhost:5173`.
- Point out the **Enchanted Pantry** theme, Team AXON header, and the 4 live metric cards: Active Inventory, Needs Review, Duplicate Warnings, and Shopping List.
- Explain the waste avoidance rate and note the `Sample Data` indicator (which allows resetting or clearing anytime).

### **Step 2: Add Grocery Item with Approaching Date (45s)**
- Click **"+ Add Grocery"**.
- Enter:
  - **Name:** `Spinach`
  - **Quantity:** `2 bunches`
  - **Category:** `Vegetables`
  - **Best-Before Date:** Set to 2 days from today.
- Click **"Add to Inventory"**. Point out the success toast.

### **Step 3: Explainable "Use First" Review (45s)**
- Navigate to the **"Use First"** tab.
- Show `Spinach` ranked in the **HIGH PRIORITY** queue.
- Read the transparent explanation aloud:
  > *"Why this appears: Approaching recorded best-before date in 2 day(s)..."*
- Point out the explicit disclaimer that GrocIQ does not make food safety determinations or invent dates.
- Show items with missing dates under the **"MISSING DATE"** filter, demonstrating that GrocIQ handles unknown dates explicitly without guessing.

### **Step 4: Smart Shopping List & Duplicate Detection (45s)**
- Navigate to the **"Shopping List"** tab.
- In the item name input, type `Spinach`.
- Observe the instant duplicate warning:
  > *"⚠️ Review Before Buying — You currently have 2 bunches of Spinach in active inventory."*
- Add the item to demonstrate that users remain in control of purchasing decisions.

### **Step 5: Record Item Outcome (30s)**
- Return to **Inventory** or **Use First**.
- On `Spinach`, click **"Log Outcome"**.
- Select **"Consumed"**, set quantity to `1`, enter reason `"Used in dinner pasta"`, and click **"Record as CONSUMED"**.
- Show that inventory immediately reflects 1 remaining bunch and prevents double logging.

### **Step 6: Real-Time Analytics & Historical Ledger (45s)**
- Navigate to the **"Outcomes & Logs"** tab.
- Show how the saved outcome immediately appears in the historical ledger table.
- Point out the real-time update in the **Waste Avoidance Rate** and the multi-segment utilization bar.

---

## 7. Status & Limitations

### Completed & Fully Operational (P0 + P1):
- Full inventory CRUD with search, category filtering, and status filtering.
- Transparent, explainable rules engine ranking items with clear human explanations.
- Real-time duplicate detection on normalized and fuzzy names.
- Smart shopping list with inventory duplicate warnings and one-click "Move to Inventory" action.
- Complete outcome tracking (Consumed, Discarded, Donated) with quantity preservation.
- Live dashboard with real-time metric counters, alerts, and waste avoidance calculation.
- Receipt parser with dual mode: image upload and receipt text parser with candidate review screen.
- Reset & clear sample data buttons for rapid judge demonstration.
- Polished, responsive Enchanted Pantry aesthetic with Google Fonts (`Cinzel` & `Plus Jakarta Sans`).

### Known Limitations:
- Local OCR uses Tesseract if installed; when unavailable in sandboxed environments, the system automatically uses the verified receipt text parser fallback.
- Multi-user authentication is omitted in this MVP (P2 requirement) to keep local operation zero-friction without external dependencies.
