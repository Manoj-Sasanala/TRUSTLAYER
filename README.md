# TRUSTLAYER — AI can decide. TRUSTLAYER decides whether it can spend.

Trust and security layer for AI agents that spend money via PayPal.

User sets a scoped mandate (budget, per-txn cap, allowed merchants, expiry). Agent proposes purchases. Deterministic Trust Engine verifies every intent, only then triggers PayPal sandbox payment.

`LLM proposes, code disposes.`

## Status
Day 1: backend foundations built and tested (32 tests). The rules engine, agent and dashboard are stubs their owners fill in.

## Quickstart
- Backend: `cd backend && pip install -r requirements.txt && uvicorn app.main:app --reload`
- Frontend: `frontend/` React + Vite + AG Grid — see `frontend/README.md`
- Rules engine: `backend/app/rules.py` R1-R12 — see `docs/CONTRACT.md`

## Team docs
- `docs/CONTRACT.md` — frozen payloads, rules, API. Read this first.
- `docs/OWNERS.md` — who owns which path, branch and deadline.
- `docs/AGENT_PROMPTS.md` — copy-paste prompt for each person's coding agent.
- `docs/superpowers/plans/` — the full 18-task plan.

## PayPal integration (sandbox)
- Orders v2: create order, buyer approve, capture, verify amount/currency/orderID
- Idempotency via `PayPal-Request-Id`

## AI
- Gemini API, structured PurchaseIntent JSON, Pydantic-validated. Mock fallback if LLM fails.

## Contributors
- [Manoj-Sasanala](https://github.com/Manoj-Sasanala)
- [tejasnayak24](https://github.com/tejasnayak24)
- [deepikajdev](https://github.com/deepikajdev)
- [Adarsh-Thakur-03](https://github.com/Adarsh-Thakur-03)

## License
MIT — see LICENSE
