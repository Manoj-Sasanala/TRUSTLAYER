import pytest

from app.paypal import approve_url, verify_capture

QUOTE = {"amount": "24.99", "currency": "USD", "order_id": "ORDER1"}


def order(value="24.99", currency="USD", order_id="ORDER1", capture_id="CAP1"):
    return {
        "id": order_id,
        "purchase_units": [
            {
                "payments": {
                    "captures": [
                        {"id": capture_id, "amount": {"value": value, "currency_code": currency}}
                    ]
                }
            }
        ],
    }


def test_clean_capture_has_no_violations():
    assert verify_capture(order(), QUOTE) == []


def test_detects_amount_mismatch():
    assert verify_capture(order(value="25.01"), QUOTE) == ["R5_AMOUNT"]


def test_detects_currency_mismatch():
    assert verify_capture(order(currency="EUR"), QUOTE) == ["R5_CURRENCY"]


def test_detects_wrong_order():
    assert verify_capture(order(order_id="ORDER2"), QUOTE) == ["R12_ORDER"]


def test_detects_missing_capture():
    assert verify_capture({"id": "ORDER1", "purchase_units": []}, QUOTE) == ["R12_NO_CAPTURE"]


def test_approve_url_is_extracted():
    payload = {
        "links": [
            {"rel": "self", "href": "https://api/self"},
            {"rel": "approve", "href": "https://paypal/approve"},
        ]
    }
    assert approve_url(payload) == "https://paypal/approve"
    assert approve_url({"links": []}) is None
