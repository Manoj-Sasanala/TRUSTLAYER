"""The day-1 gate: prove PayPal sandbox moves real (test) money.

Run from backend/:  python scripts/prove_paypal.py
Requires PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in backend/.env
"""

import asyncio
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.config import settings
from app.paypal import approve_url, capture_order, create_order, get_order, verify_capture


async def main() -> int:
    if not settings.paypal_client_id or not settings.paypal_client_secret:
        print("Missing PayPal credentials. Put them in backend/.env and try again.")
        return 1

    amount, currency = "0.01", "USD"
    request_id = f"prove-{uuid.uuid4()}"

    print(f"Creating a {amount} {currency} sandbox order...")
    order = await create_order(amount, currency, "prove", request_id)
    order_id = order["id"]
    print("order id:", order_id)
    print("approve:", approve_url(order))

    input("Log in with a sandbox personal account, approve, then press Enter...")

    current = await get_order(order_id)
    print("status after approval:", current["status"])

    unit = current["purchase_units"][0]["amount"]
    if unit["value"] != amount or unit["currency_code"] != currency:
        print("STOP: PayPal shows a different amount than the quote.", unit)
        return 1

    capture = await capture_order(order_id)
    capture_id = capture["purchase_units"][0]["payments"]["captures"][0]["id"]

    violations = verify_capture(
        capture, {"amount": amount, "currency": currency, "order_id": order_id}
    )
    if violations:
        print("STOP: capture does not match the quote.", violations)
        return 1

    print("capture id:", capture_id)
    print("PASS: 0.01 USD created, approved, captured and verified.")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
