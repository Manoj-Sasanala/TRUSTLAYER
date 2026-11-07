import pytest
from pydantic import ValidationError

from app.schemas import Decision, Mandate, PurchaseIntent


def intent(**overrides):
    base = dict(
        id="p_1",
        mandate_id="m_1",
        merchant_id="m_101",
        item_id="p_204",
        quantity=1,
        amount="24.99",
        currency="USD",
        quote_id="q_331",
        agent_note="cheapest option with good reviews",
    )
    base.update(overrides)
    return PurchaseIntent(**base)


def test_accepts_valid_intent():
    assert intent().amount == "24.99"


def test_rejects_float_amount():
    with pytest.raises(ValidationError):
        intent(amount=24.99)


def test_rejects_wrong_currency():
    with pytest.raises(ValidationError):
        intent(currency="INR")


def test_rejects_extra_field():
    with pytest.raises(ValidationError):
        intent(payee="attacker@evil.com")


def test_decision_rejects_unknown_value():
    with pytest.raises(ValidationError):
        Decision(decision="ALLOW", reason_codes=[], risk=0.1, quote={}, explanation="")


def test_risk_must_be_between_zero_and_one():
    with pytest.raises(ValidationError):
        Decision(decision="BLOCK", reason_codes=[], risk=1.4, quote={}, explanation="")


def test_mandate_rejects_float_budget():
    with pytest.raises(ValidationError):
        Mandate(
            id="m_1",
            total_budget=200.0,
            per_txn_cap="50.00",
            allowed_merchants=["m_101"],
            allowed_categories=["electronics"],
            currency="USD",
            expires_at="2026-11-30T00:00:00Z",
            approval_threshold="40.00",
        )
