import sqlite3
import os
from contextlib import contextmanager
from typing import Generator

default_db = (
    "/tmp/grociq.db"
    if os.environ.get("VERCEL")
    else os.path.join(os.path.dirname(os.path.dirname(__file__)), "grociq.db")
)
DB_PATH = os.environ.get("GROCIQ_DB_PATH", default_db)

def get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn

@contextmanager
def get_db() -> Generator[sqlite3.Connection, None, None]:
    conn = get_db_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

def init_db():
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 1. Items table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            normalized_name TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 1.0,
            unit TEXT NOT NULL DEFAULT 'units',
            category TEXT NOT NULL DEFAULT 'Other',
            unit_price REAL DEFAULT 0.0,
            price REAL,
            purchase_date TEXT NOT NULL,
            expiry_date TEXT,
            notes TEXT,
            status TEXT NOT NULL DEFAULT 'active',
            is_sample BOOLEAN NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)
        
        # 2. Shopping list table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS shopping_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            normalized_name TEXT NOT NULL,
            quantity REAL NOT NULL DEFAULT 1.0,
            unit TEXT NOT NULL DEFAULT 'units',
            category TEXT NOT NULL DEFAULT 'Other',
            unit_price REAL DEFAULT 0.0,
            notes TEXT,
            is_purchased BOOLEAN NOT NULL DEFAULT 0,
            added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            purchased_at TIMESTAMP
        );
        """)
        
        # 3. Outcomes table
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS outcomes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER,
            item_name TEXT NOT NULL,
            quantity REAL NOT NULL,
            unit TEXT NOT NULL,
            category TEXT NOT NULL,
            outcome_type TEXT NOT NULL, -- 'consumed', 'discarded', 'donated'
            unit_price REAL DEFAULT 0.0,
            financial_loss REAL DEFAULT 0.0,
            reason TEXT,
            date TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE SET NULL
        );
        """)

        # Dynamic migrations for existing databases
        for col_sql in [
            "ALTER TABLE items ADD COLUMN unit_price REAL DEFAULT 0.0;",
            "ALTER TABLE outcomes ADD COLUMN unit_price REAL DEFAULT 0.0;",
            "ALTER TABLE outcomes ADD COLUMN financial_loss REAL DEFAULT 0.0;",
            "ALTER TABLE shopping_items ADD COLUMN unit_price REAL DEFAULT 0.0;"
        ]:
            try:
                cursor.execute(col_sql)
            except sqlite3.OperationalError:
                pass

        # Backfill unit_price from price where available
        cursor.execute("UPDATE items SET unit_price = price WHERE (unit_price IS NULL OR unit_price = 0.0) AND price IS NOT NULL AND price > 0;")

        # 4. Posts table with user_id ownership for RLS
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS posts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        """)

        # Indexes for fast querying
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_items_norm ON items(normalized_name);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_shopping_purchased ON shopping_items(is_purchased);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_outcomes_date ON outcomes(date);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_outcomes_type ON outcomes(outcome_type);")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);")
