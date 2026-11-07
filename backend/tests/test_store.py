from datetime import datetime, timezone

import pytest

from app.config import settings
from app.db import init_db
from app.store import (
    create_mandate,
    create_quote,
    find_by_key,
    get_mandate,
    get_purchase,
    get_spent,
    list_purchases,
    save_purchase,
    update_purchase,
)

MANDATE = {
    "id": "m_1",
    "total_budget": "200.00",
    "per_txn_cap": "50.00",
    "allowed_merchants": ["m_101"],
    "allowed_categories": ["electronics"],
    "currency": "USD",
    "expires_at": "2026-11-30T00:00:00Z",
    "approval_threshold": "40.00",
}

DECISION = {
    "decision": "APPROVE",
    "reason_codes": [],
    "risk": 0.1,
    "quote": {},
    "explanation": "ok",
}


def intent(purchase_id="p_1", amount="24.99"):
    return {
        "id": purchase_id,
        "mandate_id": "m_1",
        "merchant_id": "m_101",
        "item_id": "p_204",
        "quantity": 1,
        "amount": amount,
        "currency": "USD",
        "quote_id": "q_1",
        "agent_note": "",
    }


@pytest.fixture(autouse=True)
def fresh_db(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "database_path", str(tmp_path / "test.db"))
    init_db()
    create_mandate(MANDATE)


def test_mandate_roundtrip():
    stored = get_mandate("m_1")
    assert stored["total_budget"] == "200.00"
    assert stored["allowed_merchants"] == ["m_101"]
    assert get_mandate("nope") is None


def test_quote_roundtrip():
    quote = create_quote(
        {"item_id": "p_204", "merchant_id": "m_101", "price": "39.99", "currency": "USD"}
    )
    assert quote["amount"] == "39.99"
    assert quote["quote_id"].startswith("q_")


def test_spent_counts_only_captured():
    save_purchase(intent("p_1", "10.00"), DECISION, status="CAPTURED")
    save_purchase(intent("p_2", "20.00"), DECISION, status="BLOCKED")
    save_purchase(intent("p_3", "30.00"), DECISION, status="AWAITING_APPROVAL")
    assert get_spent("m_1") == "10.00"


def test_spent_uses_decimal_not_float():
    save_purchase(intent("p_1", "0.10"), DECISION, status="CAPTURED")
    save_purchase(intent("p_2", "0.20"), DECISION, status="CAPTURED")
    assert get_spent("m_1") == "0.30"


def test_idempotency_lookup():
    save_purchase(intent("p_1"), DECISION, idempotency_key="key-1")
    found = find_by_key("key-1")
    assert found["id"] == "p_1"
    assert found["intent"]["amount"] == "24.99"
    assert find_by_key("missing") is None


def test_update_and_list():
    save_purchase(intent("p_1"), DECISION)
    update_purchase("p_1", status="CAPTURED", paypal_capture_id="CAP1")
    stored = get_purchase("p_1")
    assert stored["status"] == "CAPTURED"
    assert stored["paypal_capture_id"] == "CAP1"
    assert [p["id"] for p in list_purchases()] == ["p_1"]
