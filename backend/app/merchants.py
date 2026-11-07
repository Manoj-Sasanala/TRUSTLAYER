from app.db import get_db


def get_merchant(merchant_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM merchants WHERE merchant_id = ?", (merchant_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None


def list_merchants() -> list[dict]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM merchants ORDER BY merchant_id").fetchall()
    conn.close()
    return [dict(row) for row in rows]
