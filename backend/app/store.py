import json
from datetime import datetime, timezone
from decimal import Decimal
from uuid import uuid4

from app.db import get_db
from app.merchants import get_merchant
from app.money import format_amount

UPDATABLE = {"status", "paypal_order_id", "paypal_capture_id"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _as_text(value) -> str:
    return value if isinstance(value, str) else value.isoformat()


def _mandate_row(row) -> dict:
    data = dict(row)
    data["allowed_merchants"] = json.loads(data["allowed_merchants"])
    data["allowed_categories"] = json.loads(data["allowed_categories"])
    return data


def _purchase_row(row) -> dict:
    data = dict(row)
    data["intent"] = json.loads(data["intent"])
    data["decision"] = json.loads(data["decision"])
    return data


def create_mandate(data: dict) -> dict:
    conn = get_db()
    try:
        conn.execute(
            # Upsert: the editor saves the same mandate id every time.
            "INSERT INTO mandates(id, total_budget, per_txn_cap, allowed_merchants,"
            " allowed_categories, currency, expires_at, approval_threshold)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            " ON CONFLICT(id) DO UPDATE SET"
            " total_budget=excluded.total_budget, per_txn_cap=excluded.per_txn_cap,"
            " allowed_merchants=excluded.allowed_merchants,"
            " allowed_categories=excluded.allowed_categories,"
            " currency=excluded.currency, expires_at=excluded.expires_at,"
            " approval_threshold=excluded.approval_threshold",
            (
                data["id"],
                data["total_budget"],
                data["per_txn_cap"],
                json.dumps(data["allowed_merchants"]),
                json.dumps(data.get("allowed_categories", [])),
                data.get("currency", "USD"),
                _as_text(data["expires_at"]),
                data["approval_threshold"],
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_mandate(data["id"])


def get_mandate(mandate_id: str) -> dict | None:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM mandates WHERE id = ?", (mandate_id,)).fetchone()
    finally:
        conn.close()
    return _mandate_row(row) if row else None


def get_spent(mandate_id: str) -> str:
    """Sum of CAPTURED amounts only. Decimal in Python, because SQLite SUM on TEXT returns a float."""
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT intent FROM purchases WHERE mandate_id = ? AND status = 'CAPTURED'",
            (mandate_id,),
        ).fetchall()
    finally:
        conn.close()

    total = Decimal("0.00")
    for row in rows:
        total += Decimal(json.loads(row["intent"])["amount"])
    return format_amount(total)


def create_quote(item: dict) -> dict:
    quote_id = f"q_{uuid4().hex[:12]}"
    merchant = get_merchant(item["merchant_id"]) or {"payee": ""}
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO quotes(quote_id, item_id, merchant_id, amount, currency, payee, created_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                quote_id,
                item["item_id"],
                item["merchant_id"],
                item["price"],
                item["currency"],
                merchant["payee"],
                _now(),
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_quote(quote_id)


def get_quote(quote_id: str) -> dict | None:
    conn = get_db()
    try:
        row = conn.execute("SELECT * FROM quotes WHERE quote_id = ?", (quote_id,)).fetchone()
    finally:
        conn.close()
    return dict(row) if row else None


def save_purchase(
    intent: dict,
    decision: dict,
    idempotency_key: str | None = None,
    status: str = "PENDING",
    paypal_order_id: str | None = None,
) -> dict:
    now = _now()
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO purchases(id, mandate_id, intent, decision, risk, status,"
            " paypal_order_id, paypal_capture_id, idempotency_key, created_at, updated_at)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (
                intent["id"],
                intent["mandate_id"],
                json.dumps(intent),
                json.dumps(decision),
                decision["risk"],
                status,
                paypal_order_id,
                None,
                idempotency_key,
                now,
                now,
            ),
        )
        conn.commit()
    finally:
        conn.close()
    return get_purchase(intent["id"])


def get_purchase(purchase_id: str) -> dict | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM purchases WHERE id = ?", (purchase_id,)
        ).fetchone()
    finally:
        conn.close()
    return _purchase_row(row) if row else None


def find_by_key(idempotency_key: str) -> dict | None:
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM purchases WHERE idempotency_key = ?", (idempotency_key,)
        ).fetchone()
    finally:
        conn.close()
    return _purchase_row(row) if row else None


def list_purchases() -> list[dict]:
    conn = get_db()
    try:
        rows = conn.execute(
            "SELECT * FROM purchases ORDER BY created_at DESC, rowid DESC"
        ).fetchall()
    finally:
        conn.close()
    return [_purchase_row(row) for row in rows]


def update_purchase(purchase_id: str, **fields) -> None:
    updates = {key: value for key, value in fields.items() if key in UPDATABLE}
    if not updates:
        return
    assignments = ", ".join(f"{key} = ?" for key in updates)
    conn = get_db()
    try:
        conn.execute(
            f"UPDATE purchases SET {assignments}, updated_at = ? WHERE id = ?",
            (*updates.values(), _now(), purchase_id),
        )
        conn.commit()
    finally:
        conn.close()
