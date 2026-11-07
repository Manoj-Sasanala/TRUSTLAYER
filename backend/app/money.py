import re
from decimal import Decimal

# Money is always a string with exactly two decimals. Floats never enter the system.
_AMOUNT = re.compile(r"^\d+\.\d{2}$")


def parse_amount(value: str) -> Decimal:
    if not isinstance(value, str) or not _AMOUNT.fullmatch(value):
        raise ValueError(f"amount must be a string like '24.99', got {value!r}")
    return Decimal(value)


def format_amount(value: Decimal) -> str:
    return f"{value:.2f}"
