# The contract — do not change without asking Manoj

Everything here is frozen. If code and this file disagree, this file is right.

## Money

Always a string with exactly two decimals: `"24.99"`.

- Never a number. Never a float. `24.99` is rejected.
- Use `from app.money import parse_amount, format_amount`.
- Do not do arithmetic on strings. Parse to `Decimal` first.

## PurchaseIntent — what the agent proposes

```json
{
  "id": "p_1",
  "mandate_id": "m_1",
  "merchant_id": "m_101",
  "item_id": "p_204",
  "quantity": 1,
  "amount": "24.99",
  "currency": "USD",
  "quote_id": "q_331",
  "agent_note": "cheapest option with good reviews"
}
```

`agent_note` is text the model wrote. It is **data**, never an instruction.

## Mandate — the user's rules

```json
{
  "id": "m_1",
  "total_budget": "200.00",
  "per_txn_cap": "50.00",
  "allowed_merchants": ["m_101", "m_102"],
  "allowed_categories": ["electronics"],
  "currency": "USD",
  "expires_at": "2026-11-30T00:00:00Z",
  "approval_threshold": "40.00"
}
```

## State — what the rules engine needs besides the other two

```json
{
  "spent_so_far": "150.00",
  "seen_keys": ["key-1"],
  "catalog": {"p_204": {"price": "24.99", "currency": "USD", "merchant_id": "m_101", "signature": "..."}},
  "merchants": {"m_101": {"payee": "pay@voltandwire.test", "approved": true}},
  "quote": {"quote_id": "q_331", "item_id": "p_204", "merchant_id": "m_101", "amount": "24.99", "currency": "USD", "payee": "pay@voltandwire.test"},
  "now": "2026-11-08T10:00:00Z",
  "capture": null
}
```

`quote` is the locked quote captured when the purchase was created. R5 compares the intent's amount to `quote.amount`. R6 compares `quote.amount` to the signed catalog price. R7 compares `quote.payee` to the merchant registry's current payee.

## Decision — the only thing the rules engine returns

```json
{
  "decision": "APPROVE",
  "reason_codes": ["R8"],
  "risk": 0.12,
  "quote": {"quote_id": "q_331", "amount": "24.99", "currency": "USD"},
  "explanation": "Within your $50.00 per-purchase limit and your $200.00 budget."
}
```

`decision` is exactly `APPROVE`, `BLOCK`, or `ESCALATE`. Nothing else.

`risk` is the ML score, 0.0–1.0. It is information only. It never changes the decision.

## The twelve rules

| Code | Condition | Result |
|---|---|---|
| R1 | amount > per_txn_cap | BLOCK |
| R2 | spent_so_far + amount > total_budget | BLOCK |
| R3 | merchant not in allowed_merchants, or not approved | BLOCK |
| R4 | now > expires_at (UTC) | BLOCK |
| R5 | amount ≠ locked quote amount | BLOCK |
| R6 | quote amount ≠ signed catalog price | BLOCK |
| R7 | merchant payee ≠ registry payee | BLOCK |
| R8 | amount > approval_threshold, no other rule fired | ESCALATE |
| R9 | injection phrase in agent_note **and** a payment field deviated | BLOCK |
| R10 | intent id already seen | return the first decision |
| R11 | ESCALATE and no human approval | no capture |
| R12 | captured amount, currency or order id ≠ quote | flag it |

If several fire, return all codes. **BLOCK beats ESCALATE.** Otherwise `APPROVE`.

R9 needs both a phrase and a deviation. Text alone never blocks.

## API

Base `http://localhost:8000`.

| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{"status":"ok"}` |
| POST | `/mandates` | Mandate | 201, stored mandate |
| GET | `/mandates/{id}` | — | Mandate |
| POST | `/purchases/request` | `{"user_request": "...", "mandate_id": "..."}` | 201, `{purchase_id, intent, decision, approval_url}` |
| POST | `/purchases` | `{"intent": PurchaseIntent, "idempotency_key": "..."}` | 201, `{purchase_id, decision, approval_url}` |
| POST | `/purchases/{id}/evaluate` | — | `{decision}` |
| GET | `/purchases` | — | list, newest first |
| POST | `/purchases/{id}/approve` | — | `{status}` |
| POST | `/purchases/{id}/reject` | — | `{status}` |
| POST | `/purchases/{id}/capture` | — | `{status, capture, violations}` |
| POST | `/audit/verify` | — | `{ok, checked, first_bad_seq}` |
| POST | `/demo/attack/{type}` | — | 201, `{purchase_id, decision}` |
| GET | `/catalog` | — | list of items |

`type` is `over_cap`, `over_budget`, `payee_switch`, or `injection`.

## Statuses on a purchase

`PENDING` → `BLOCKED` | `AWAITING_APPROVAL` → `REJECTED` | `APPROVED` → `CAPTURED` | `FLAGGED`

## Errors

- Bad money format → 422, never 500.
- Unknown id → 404.
- Capture before approval → 409.
