import httpx

from app.config import settings

SANDBOX = "https://api-m.sandbox.paypal.com"
LIVE = "https://api-m.paypal.com"


def base_url() -> str:
    return SANDBOX if settings.paypal_env == "sandbox" else LIVE


async def get_access_token() -> str:
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(
            f"{base_url()}/v1/oauth2/token",
            auth=(settings.paypal_client_id, settings.paypal_client_secret),
            data={"grant_type": "client_credentials"},
        )
        response.raise_for_status()
        return response.json()["access_token"]


async def _call(method: str, path: str, headers: dict | None = None, **kwargs) -> dict:
    token = await get_access_token()
    merged = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        **(headers or {}),
    }
    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.request(
            method, f"{base_url()}{path}", headers=merged, **kwargs
        )
        response.raise_for_status()
        return response.json()


async def create_order(
    amount: str, currency: str, reference_id: str, request_id: str
) -> dict:
    """`amount` is the 2-decimal string from the locked quote. PayPal-Request-Id makes retries safe."""
    return await _call(
        "POST",
        "/v2/checkout/orders",
        headers={"PayPal-Request-Id": request_id},
        json={
            "intent": "CAPTURE",
            "purchase_units": [
                {
                    "reference_id": reference_id,
                    "amount": {"currency_code": currency, "value": amount},
                }
            ],
        },
    )


async def get_order(order_id: str) -> dict:
    return await _call("GET", f"/v2/checkout/orders/{order_id}")


async def capture_order(order_id: str) -> dict:
    return await _call("POST", f"/v2/checkout/orders/{order_id}/capture", json={})


def approve_url(order: dict) -> str | None:
    for link in order.get("links", []):
        if link.get("rel") == "approve":
            return link.get("href")
    return None


def verify_capture(order: dict, quote: dict) -> list[str]:
    """Compare what PayPal says moved against the locked quote. Empty list means clean."""
    try:
        capture = order["purchase_units"][0]["payments"]["captures"][0]
    except (KeyError, IndexError):
        return ["R12_NO_CAPTURE"]

    violations = []
    amount = capture.get("amount", {})
    if amount.get("value") != quote["amount"]:
        violations.append("R5_AMOUNT")
    if amount.get("currency_code") != quote["currency"]:
        violations.append("R5_CURRENCY")
    if quote.get("order_id") and order.get("id") != quote["order_id"]:
        violations.append("R12_ORDER")
    return violations
