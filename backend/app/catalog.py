import hashlib
import hmac

from app.canonical import canonical
from app.config import settings
from app.db import get_db

SIGNED_FIELDS = ("item_id", "merchant_id", "price", "currency")


def sign_price(item: dict) -> str:
    body = {field: item[field] for field in SIGNED_FIELDS}
    key = settings.catalog_signing_key.encode()
    return hmac.new(key, canonical(body).encode(), hashlib.sha256).hexdigest()


def verify_price(item: dict) -> bool:
    return hmac.compare_digest(sign_price(item), item.get("signature", ""))


def get_item(item_id: str) -> dict | None:
    conn = get_db()
    row = conn.execute("SELECT * FROM catalog WHERE item_id = ?", (item_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_items() -> list[dict]:
    conn = get_db()
    rows = conn.execute("SELECT * FROM catalog ORDER BY item_id").fetchall()
    conn.close()
    return [dict(row) for row in rows]
