import pytest
from ml.predict import score_intent


def test_low_risk_purchase():
    """Typical small transaction during business hours with known merchant."""
    res = score_intent(
        amount="24.99",
        txn_count_1h=1,
        mandate_limit="200.00",
        merchant_is_new=False,
        hour_of_day=14,
    )
    assert isinstance(res["risk"], float)
    assert 0.0 <= res["risk"] <= 1.0
    assert res["band"] == "LOW"
    assert res["reasons"] == []


def test_high_value_purchase():
    """High value purchase near or exceeding mandate limits."""
    res = score_intent(
        amount="190.00",
        txn_count_1h=1,
        mandate_limit="200.00",
        merchant_is_new=False,
        hour_of_day=15,
    )
    assert res["risk"] > 0.30
    assert res["band"] in ("MEDIUM", "HIGH")
    assert any("limit" in r.lower() or "amount" in r.lower() for r in res["reasons"])


def test_new_merchant_purchase():
    """First-time interaction with unknown merchant."""
    res = score_intent(
        amount="45.00",
        txn_count_1h=0,
        mandate_limit="100.00",
        merchant_is_new=True,
        hour_of_day=11,
    )
    assert any("merchant" in r.lower() for r in res["reasons"])


def test_unusual_transaction_frequency():
    """Rapid velocity anomaly in a 1-hour window."""
    res = score_intent(
        amount="35.00",
        txn_count_1h=8,
        mandate_limit="200.00",
        merchant_is_new=False,
        hour_of_day=16,
    )
    assert res["risk"] >= 0.30
    assert any("velocity" in r.lower() or "past hour" in r.lower() for r in res["reasons"])


def test_invalid_input_handling():
    """Input validation must raise ValueError on malformed, negative, or invalid data."""
    # Negative amount
    with pytest.raises(ValueError):
        score_intent(-10.0, 1, 100.0, False, 12)

    # Zero or negative mandate limit
    with pytest.raises(ValueError):
        score_intent(25.0, 1, 0, False, 12)

    # Negative transaction count
    with pytest.raises(ValueError):
        score_intent(25.0, -2, 100.0, False, 12)

    # Invalid hour of day
    with pytest.raises(ValueError):
        score_intent(25.0, 1, 100.0, False, 25)

    # Non-numeric string amount
    with pytest.raises(ValueError):
        score_intent("invalid_amount", 1, 100.0, False, 12)


def test_never_returns_decision():
    """Contract rule: ML scores only; it never independently decides or blocks."""
    res = score_intent(
        amount="450.00",
        txn_count_1h=12,
        mandate_limit="100.00",
        merchant_is_new=True,
        hour_of_day=3,
    )
    assert "decision" not in res
    assert "status" not in res
    assert "risk" in res
    assert "band" in res
