"""Persistence. Owner: Manoj.

All SQL lives here. Routes never write SQL. Contract: docs/CONTRACT.md
"""


def create_mandate(data: dict) -> dict:
    raise NotImplementedError


def get_mandate(mandate_id: str) -> dict | None:
    raise NotImplementedError


def get_spent(mandate_id: str) -> str:
    """Sum of CAPTURED amounts only, as a 2-decimal string."""
    raise NotImplementedError


def create_quote(item: dict) -> dict:
    raise NotImplementedError


def get_quote(quote_id: str) -> dict | None:
    raise NotImplementedError


def save_purchase(intent: dict, decision: dict, idempotency_key: str | None) -> dict:
    raise NotImplementedError


def get_purchase(purchase_id: str) -> dict | None:
    raise NotImplementedError


def list_purchases() -> list[dict]:
    raise NotImplementedError


def update_purchase(purchase_id: str, **fields) -> None:
    raise NotImplementedError
