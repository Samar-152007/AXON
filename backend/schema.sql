-- GrocIQ Waste-to-Wealth Financial Engine Schema
-- PostgreSQL DDL & Migration Script

-- 1. Create or Update inventory_items table
CREATE TABLE IF NOT EXISTS inventory_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    normalized_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL DEFAULT 1.0 CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL DEFAULT 'units',
    category VARCHAR(100) NOT NULL DEFAULT 'Other',
    unit_price NUMERIC(10, 2) DEFAULT 0.00 CHECK (unit_price >= 0), -- Cost per unit in ₹
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
    expiry_date DATE,
    notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'consumed', 'discarded', 'donated')),
    is_sample BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration statement if inventory_items already exists:
-- ALTER TABLE inventory_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00 CHECK (unit_price >= 0);

-- 2. Create or Update outcome_events table
CREATE TABLE IF NOT EXISTS outcome_events (
    id SERIAL PRIMARY KEY,
    item_id INTEGER REFERENCES inventory_items(id) ON DELETE SET NULL,
    item_name VARCHAR(255) NOT NULL,
    quantity NUMERIC(10, 2) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(50) NOT NULL,
    category VARCHAR(100) NOT NULL,
    event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('consumed', 'discarded', 'donated')),
    unit_price NUMERIC(10, 2) DEFAULT 0.00 CHECK (unit_price >= 0),
    -- Financial loss is computed as quantity * unit_price when event_type = 'discarded'
    financial_loss NUMERIC(10, 2) GENERATED ALWAYS AS (
        CASE 
            WHEN event_type = 'discarded' THEN (quantity * COALESCE(unit_price, 0.00))
            ELSE 0.00 
        END
    ) STORED,
    reason TEXT,
    event_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Migration statement if outcome_events already exists:
-- ALTER TABLE outcome_events ADD COLUMN IF NOT EXISTS unit_price NUMERIC(10, 2) DEFAULT 0.00;
-- ALTER TABLE outcome_events ADD COLUMN IF NOT EXISTS financial_loss NUMERIC(10, 2);

-- 3. Indexes for fast aggregation in Waste-to-Wealth Dashboard
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_outcome_events_date_type ON outcome_events(event_date, event_type);
CREATE INDEX IF NOT EXISTS idx_outcome_events_loss ON outcome_events(financial_loss) WHERE event_type = 'discarded';

-- 4. Analytics View for Monthly Household Financial Loss & Burn Rate
CREATE OR REPLACE VIEW v_waste_to_wealth_summary AS
SELECT 
    DATE_TRUNC('month', event_date) AS month_period,
    COUNT(CASE WHEN event_type = 'discarded' THEN 1 END) AS total_discard_events,
    SUM(CASE WHEN event_type = 'discarded' THEN (quantity * COALESCE(unit_price, 0)) ELSE 0 END) AS total_waste_value,
    SUM(CASE WHEN event_type = 'consumed' THEN (quantity * COALESCE(unit_price, 0)) ELSE 0 END) AS total_consumed_value,
    SUM(CASE WHEN event_type = 'donated' THEN (quantity * COALESCE(unit_price, 0)) ELSE 0 END) AS total_donated_value,
    ROUND(
        (SUM(CASE WHEN event_type = 'discarded' THEN (quantity * COALESCE(unit_price, 0)) ELSE 0 END) / 4.28), 
        2
    ) AS household_burn_rate_per_week
FROM outcome_events
GROUP BY DATE_TRUNC('month', event_date);

-- ============================================================================
-- 5. Supabase Realtime Configuration (Turned on for target tables)
-- ============================================================================
-- Realtime requires REPLICA IDENTITY FULL to stream complete row payloads
ALTER TABLE IF EXISTS inventory_items REPLICA IDENTITY FULL;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE inventory_items;
    END IF;
END $$;
