import sqlite3

from app.config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS mandates(
  id TEXT PRIMARY KEY,
  total_budget TEXT NOT NULL,
  per_txn_cap TEXT NOT NULL,
  allowed_merchants TEXT NOT NULL,
  allowed_categories TEXT NOT NULL,
  currency TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  approval_threshold TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS merchants(
  merchant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  payee TEXT NOT NULL,
  approved INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS catalog(
  item_id TEXT PRIMARY KEY,
  merchant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  price TEXT NOT NULL,
  currency TEXT NOT NULL,
  category TEXT NOT NULL,
  signature TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes(
  quote_id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL,
  merchant_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  currency TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchases(
  id TEXT PRIMARY KEY,
  mandate_id TEXT NOT NULL,
  intent TEXT NOT NULL,
  decision TEXT NOT NULL,
  risk REAL NOT NULL,
  status TEXT NOT NULL,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_chain(
  seq INTEGER PRIMARY KEY,
  ts TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
"""


def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(settings.database_path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    conn = sqlite3.connect(settings.database_path)
    try:
        conn.executescript(SCHEMA)
        conn.commit()
    finally:
        conn.close()
