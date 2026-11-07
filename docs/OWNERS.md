# Who builds what

Four people. One owner per path. Do not edit another person's path without asking.

| Person | Branch | Owns | Deadline | Done means |
|---|---|---|---|---|
| Manoj | `main` | `backend/app/main.py`, `store.py`, `paypal.py`, `db.py`, `catalog.py`, `agent.py`, deploy | Day 5 | `$0.01` capture works, API live |
| Tejas | `rules/engine` | `backend/app/rules.py`, `backend/tests/test_rules.py`, `eval/run.py`, `ml/` | Day 3 | 14 tests pass, 40/40 blocked |
| Deepika | `ui/dashboard` | `frontend/` | Day 4 | 4 panels, AG Grid, attack buttons |
| Adarsh | `docs/proof` | `eval/attacks.json`, `README.md`, `docs/`, video, Devpost | Day 6 | video uploaded, README complete |

## Rules for everyone

1. `git checkout -b <your-branch>` before you start.
2. Never `git push origin main`. Push your branch, open a PR, Manoj merges.
3. Never commit `.env`, `*.db`, `*.csv`, or `node_modules/`.
4. Read `docs/CONTRACT.md` before writing code. It is frozen.
5. One commit per meaningful step. Small commits.
6. Do not add dependencies without asking. FastAPI + httpx + pytest on the backend. Vite + React + AG Grid on the frontend.
7. If something in the contract is missing, ask. Do not invent an endpoint.

## What is already built

- `backend/app/config.py` — settings
- `backend/app/money.py` — money as strings
- `backend/app/schemas.py` — PurchaseIntent, Mandate, Decision, Quote
- `backend/app/db.py` — SQLite schema
- `backend/app/catalog.py` — signed prices
- `backend/app/merchants.py` — merchant registry
- `backend/app/audit.py` — hash chain
- `backend/app/paypal.py` — Orders v2 client
- `backend/seed.py` — 12 products, 4 merchants
- 32 tests

## The build order that cannot change

1. PayPal `$0.01` capture (Manoj) — without this there is no project.
2. Rules engine + 14 tests (Tejas).
3. Purchase API (Manoj).
4. Attack corpus 40/40 (Adarsh data, Tejas runner).
5. Dashboard (Deepika).
6. Agent (Manoj).
7. Deploy + video (Manoj + Adarsh).

Anything not on this list is cut.
