import pytest

from app.catalog import get_item, verify_price
from app.config import settings
from app.db import get_db
from seed import seed


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_path", str(tmp_path / "test.db"))
    seed()


def test_seed_is_idempotent():
    seed()
    conn = get_db()
    assert conn.execute("SELECT COUNT(*) FROM catalog").fetchone()[0] == 12
    assert conn.execute("SELECT COUNT(*) FROM merchants").fetchone()[0] == 4


def test_genuine_price_verifies():
    item = get_item("p_201")
    assert item["price"] == "24.99"
    assert item["currency"] == "USD"
    assert verify_price(item) is True


def test_tampered_price_fails_verification():
    conn = get_db()
    conn.execute("UPDATE catalog SET price = '0.01' WHERE item_id = 'p_201'")
    conn.commit()
    assert verify_price(get_item("p_201")) is False


def test_tampered_merchant_fails_verification():
    conn = get_db()
    conn.execute("UPDATE catalog SET merchant_id = 'm_999' WHERE item_id = 'p_201'")
    conn.commit()
    assert verify_price(get_item("p_201")) is False
