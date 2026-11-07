from decimal import Decimal

import pytest

from app.money import format_amount, parse_amount


def test_parses_two_decimals():
    assert parse_amount("24.99") == Decimal("24.99")


@pytest.mark.parametrize("bad", [25.0, 25, "25", "25.999", "abc", "-1.00", "", None])
def test_rejects_non_money(bad):
    with pytest.raises(ValueError):
        parse_amount(bad)


def test_formats_two_decimals():
    assert format_amount(Decimal("5")) == "5.00"
    assert format_amount(Decimal("24.9")) == "24.90"
