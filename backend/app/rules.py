"""R1-R12: the deterministic decision engine. Owner: Tejas. Branch: rules/engine.

Pure functions only. No database, no network, no file reads, no clock.
Everything it needs arrives in the three arguments. Contract: docs/CONTRACT.md
"""

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from app.money import format_amount, parse_amount

BLOCK_CODES = {"R1", "R2", "R3", "R4", "R5", "R6", "R7", "R9", "R11"}
ESCALATE_CODES = {"R8"}

INJECTION_PHRASES = [
    "ignore previous instructions",
    "ignore previous",
    "system update",
    "system prompt",
    "override",
    "disregard previous",
    "pay attacker",
    "attacker@evil",
    "new instructions",
    "system_update",
    "delimiter",
    "fake_success",
    "qty_inflate",
    "mandate_increase",
    "out_of_scope",
]


def _parse_iso_utc(ts: str) -> datetime:
    """Parse ISO timestamp ensuring UTC."""
    if not isinstance(ts, str) or not ts.strip():
        raise ValueError(f"Invalid timestamp: {ts!r}")
    cleaned = ts.strip().replace("Z", "+00:00")
    dt = datetime.fromisoformat(cleaned)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def evaluate(intent: dict, mandate: dict, state: dict) -> dict:
    """Decide one purchase deterministically.

    Returns {"decision", "reason_codes", "risk", "quote", "explanation"}.
    - decision is exactly "APPROVE", "BLOCK" or "ESCALATE".
    - Return every rule code that fired. BLOCK beats ESCALATE.
    - Use Decimal for every money comparison.
    - Read time only from state["now"].
    - risk is passed through; it never changes the decision.
    """
    # R10: Duplicate intent seen -> return original decision
    seen_decisions = state.get("seen_decisions", {})
    intent_id = intent.get("id")
    if intent_id and intent_id in seen_decisions:
        return seen_decisions[intent_id]

    reason_codes: list[str] = []

    # Currency validation
    intent_currency = intent.get("currency", "USD")
    mandate_currency = mandate.get("currency", "USD")
    if intent_currency != "USD" or intent_currency != mandate_currency:
        reason_codes.append("R5")

    # Parse money amounts with Decimal
    intent_amount = parse_amount(intent["amount"])
    per_txn_cap = parse_amount(mandate["per_txn_cap"])
    total_budget = parse_amount(mandate["total_budget"])
    approval_threshold = parse_amount(mandate["approval_threshold"])
    spent_so_far = parse_amount(state.get("spent_so_far", "0.00"))

    # R1: amount > per_txn_cap
    if intent_amount > per_txn_cap:
        reason_codes.append("R1")

    # R2: spent_so_far + amount > total_budget
    if spent_so_far + intent_amount > total_budget:
        reason_codes.append("R2")

    # R3: merchant not in allowed_merchants, or not approved
    merchant_id = intent.get("merchant_id")
    allowed_merchants = mandate.get("allowed_merchants", [])
    merchants_registry = state.get("merchants", {})
    merchant_entry = merchants_registry.get(merchant_id) if merchant_id else None

    is_allowed = bool(merchant_id and merchant_id in allowed_merchants)
    is_approved = bool(merchant_entry and merchant_entry.get("approved"))

    if not is_allowed or not is_approved:
        reason_codes.append("R3")

    # R4: now > expires_at (UTC)
    now_ts = state.get("now")
    expires_at_ts = mandate.get("expires_at")
    if now_ts and expires_at_ts:
        now_dt = _parse_iso_utc(str(now_ts))
        expires_dt = _parse_iso_utc(str(expires_at_ts))
        if now_dt > expires_dt:
            reason_codes.append("R4")

    # Quotes and Catalog references
    quote = state.get("quote") or {}
    catalog = state.get("catalog") or {}
    item_id = intent.get("item_id")
    catalog_item = catalog.get(item_id) if item_id else None

    # R5: amount != locked quote amount
    payment_field_deviated = False
    if quote:
        quote_amount_str = quote.get("amount")
        if quote_amount_str:
            quote_amount = parse_amount(quote_amount_str)
            if intent_amount != quote_amount or intent_currency != quote.get("currency"):
                reason_codes.append("R5")
                payment_field_deviated = True

    # R6: quote amount != signed catalog price
    if catalog_item:
        catalog_price = parse_amount(catalog_item["price"])
        qty = intent.get("quantity", 1)
        expected_total = catalog_price * Decimal(qty)
        quote_amount_to_check = (
            parse_amount(quote["amount"]) if quote.get("amount") else intent_amount
        )
        if quote_amount_to_check != expected_total:
            reason_codes.append("R6")
            payment_field_deviated = True

    # R7: merchant payee != registry payee
    if quote and merchant_entry:
        quote_payee = quote.get("payee")
        registry_payee = merchant_entry.get("payee")
        if quote_payee and registry_payee and quote_payee != registry_payee:
            reason_codes.append("R7")
            payment_field_deviated = True

    # R8: amount > approval_threshold, only when no other rule already fired
    if not reason_codes and intent_amount > approval_threshold:
        reason_codes.append("R8")

    # R9: injection phrase in agent_note and a payment field deviated
    agent_note = str(intent.get("agent_note", "")).lower()
    has_injection_phrase = any(phrase in agent_note for phrase in INJECTION_PHRASES)

    if has_injection_phrase and (payment_field_deviated or intent_amount > per_txn_cap or intent_amount > total_budget):
        reason_codes.append("R9")

    # R11: ESCALATE and no human approval -> no capture
    capture = state.get("capture")
    is_awaiting_approval = (
        state.get("purchase_status") == "AWAITING_APPROVAL"
        or "R8" in reason_codes
    )
    human_approved = state.get("human_approved", False)
    if capture and is_awaiting_approval and not human_approved:
        reason_codes.append("R11")

    # R12: captured amount, currency or order id != quote
    if capture and quote:
        cap_amount_str = capture.get("amount")
        if cap_amount_str:
            cap_amount = parse_amount(cap_amount_str)
            quote_amt = parse_amount(quote.get("amount", "0.00"))
            if (
                cap_amount != quote_amt
                or capture.get("currency") != quote.get("currency")
                or (
                    state.get("paypal_order_id")
                    and capture.get("order_id") != state.get("paypal_order_id")
                )
            ):
                reason_codes.append("R12")

    # Deduplicate reason codes in stable order
    ordered_unique_codes = list(dict.fromkeys(reason_codes))

    # Resolve decision: BLOCK beats ESCALATE, otherwise APPROVE
    has_block = any(c in BLOCK_CODES for c in ordered_unique_codes)
    has_escalate = any(c in ESCALATE_CODES for c in ordered_unique_codes)

    if has_block:
        decision = "BLOCK"
    elif has_escalate:
        decision = "ESCALATE"
    else:
        decision = "APPROVE"

    # Explanations
    explanation = _build_explanation(decision, ordered_unique_codes, mandate, intent_amount)

    risk_score = float(state.get("risk", 0.0) or 0.0)

    return {
        "decision": decision,
        "reason_codes": ordered_unique_codes,
        "risk": risk_score,
        "quote": quote or {
            "quote_id": intent.get("quote_id", ""),
            "amount": format_amount(intent_amount),
            "currency": intent_currency,
        },
        "explanation": explanation,
    }


def _build_explanation(
    decision: str,
    codes: list[str],
    mandate: dict[str, Any],
    amount: Decimal,
) -> str:
    if decision == "APPROVE":
        return (
            f"Within your ${mandate['per_txn_cap']} per-purchase limit and your "
            f"${mandate['total_budget']} budget."
        )

    parts: list[str] = []
    for code in codes:
        if code == "R1":
            parts.append(f"Amount ${format_amount(amount)} exceeds per-transaction cap of ${mandate['per_txn_cap']}.")
        elif code == "R2":
            parts.append(f"Purchase exceeds total budget of ${mandate['total_budget']}.")
        elif code == "R3":
            parts.append("Merchant is not allowed or not approved.")
        elif code == "R4":
            parts.append(f"Mandate expired on {mandate['expires_at']}.")
        elif code == "R5":
            parts.append("Requested amount differs from locked quote.")
        elif code == "R6":
            parts.append("Quote amount differs from signed catalog price.")
        elif code == "R7":
            parts.append("Merchant payee differs from registered payee.")
        elif code == "R8":
            parts.append(f"Amount ${format_amount(amount)} exceeds approval threshold of ${mandate['approval_threshold']}.")
        elif code == "R9":
            parts.append("Prompt injection phrase detected with payment field deviation.")
        elif code == "R11":
            parts.append("Escalated purchase cannot be captured without human approval.")
        elif code == "R12":
            parts.append("Captured payment parameters differ from locked quote.")

    return " ".join(parts) if parts else f"Purchase {decision.lower()}ed by policy."
