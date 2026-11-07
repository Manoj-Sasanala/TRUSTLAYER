import pytest

from app.audit import GENESIS, append, record_hash, verify
from app.config import settings
from app.db import get_db, init_db


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_path", str(tmp_path / "test.db"))
    init_db()


def test_chain_verifies():
    append("decision", {"purchase_id": "p1", "decision": "APPROVE"})
    append("capture", {"purchase_id": "p1", "capture_id": "CAP1"})
    append("decision", {"purchase_id": "p2", "decision": "BLOCK"})

    result = verify()

    assert result == {"ok": True, "checked": 3, "first_bad_seq": None}


def test_tamper_is_detected_at_the_right_row():
    append("decision", {"purchase_id": "p1"})
    append("decision", {"purchase_id": "p2"})
    append("decision", {"purchase_id": "p3"})

    conn = get_db()
    conn.execute(
        "UPDATE audit_chain SET payload = ? WHERE seq = 2", ('{"purchase_id":"forged"}',)
    )
    conn.commit()
    conn.close()

    result = verify()

    assert result["ok"] is False
    assert result["first_bad_seq"] == 2


def test_key_order_does_not_change_the_hash():
    assert record_hash({"a": 1, "b": 2}, GENESIS) == record_hash({"b": 2, "a": 1}, GENESIS)


def test_genesis_is_sixty_four_zeros():
    assert GENESIS == "0" * 64
