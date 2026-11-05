# TRUSTLAYER — AI can decide. TRUSTLAYER decides whether it can spend.

Trust and security layer for AI agents that spend money via PayPal.

User sets a scoped mandate (budget, per-txn cap, allowed merchants, expiry). Agent proposes purchases. Deterministic Trust Engine verifies every intent, only then triggers PayPal sandbox payment.

`LLM proposes, code disposes.`

## Status
Day 0 scaffold for PayPal AI Hackathon (deadline Nov 12 2026 2pm PT).

## Quickstart
- Backend: `backend/` FastAPI (coming)
- Frontend: `frontend/` React + Tailwind (coming)
- Policy engine: `backend/app/policy/` R1-R12 (coming)

See `docs/PRD.md` for full spec.

## PayPal integration (sandbox)
- Orders v2: create order, buyer approve, capture, verify amount/currency/orderID
- Idempotency via `PayPal-Request-Id`

## AI
- Gemini API, structured PurchaseIntent JSON, Pydantic-validated. Mock fallback if LLM fails.

## Contributors
- [Manoj-Sasanala](https://github.com/Manoj-Sasanala)
- [tejasnayak24](https://github.com/tejasnayak24)
- [deepikajdev](https://github.com/deepikajdev)

## License
MIT — see LICENSE
