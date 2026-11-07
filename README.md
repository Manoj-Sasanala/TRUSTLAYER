# TRUSTLAYER — AI can decide. TRUSTLAYER decides whether it can spend.

Trust and security layer for AI agents that spend money via PayPal.

User sets a scoped mandate (budget, per-txn cap, allowed merchants, expiry). Agent proposes purchases. Deterministic Trust Engine verifies every intent, only then triggers PayPal sandbox payment.

`LLM proposes, code disposes.`

## Start here (team)

1. Read `docs/CONTRACT.md` — frozen payloads, the twelve rules, the API.
2. Find your path and branch in `docs/OWNERS.md`.
3. Open your assigned issue in [Issues](https://github.com/Manoj-Sasanala/TRUSTLAYER/issues).
4. Copy your block from `docs/AGENT_PROMPTS.md` into your coding agent.

Never push to `main`. Push your branch, open a PR, Manoj merges.

## Status
Day 1: backend complete except the rules engine and the live PayPal capture (54 tests).
`rules.py` is Tejas's stub; the dashboard and docs are their owners' work.

Run it: `cd backend && uvicorn app.main:app --reload`, then open `/docs`. The database seeds
itself on boot. Every endpoint works; anything that needs a decision returns 501 until the
rules engine lands.

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
