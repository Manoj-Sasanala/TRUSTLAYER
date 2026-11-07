"""The agent. Owner: Tejas. Branch: agent/gemini.

The model may only CHOOSE an item that already exists in the catalog.
It never sets the amount, the merchant, or the payee.
Contract: docs/CONTRACT.md
"""


class NoMatchError(Exception):
    """No catalog item fits the request."""


def propose(user_request: str, catalog: list[dict], mandate: dict) -> dict:
    """Return a PurchaseIntent-shaped dict.

    Try Gemini first when settings.agent_mode == "gemini".
    On any error, timeout, or invalid JSON, call mock_propose instead.
    Never raise to the caller except NoMatchError.
    """
    raise NotImplementedError("Tejas: implement Gemini + mock fallback")


def mock_propose(user_request: str, catalog: list[dict]) -> dict:
    """Deterministic fallback: substring match on the user request, cheapest item wins."""
    raise NotImplementedError("Tejas: implement the mock matcher")
