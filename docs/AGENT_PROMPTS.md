# Give these prompts to your coding agent

Each person pastes their own block. The agent reads the contract, works only in the allowed files, and opens a PR.

---

## Tejas — rules engine, eval runner, ML

```
You are working in https://github.com/Manoj-Sasanala/TRUSTLAYER

Before writing anything, read:
- docs/CONTRACT.md
- docs/OWNERS.md
- backend/app/rules.py (stub)
- backend/app/money.py
- backend/app/catalog.py

Create branch: rules/engine

JOB 1 — the rules engine (do this first)
Implement backend/app/rules.py and backend/tests/test_rules.py.

1. evaluate(intent, mandate, state) must be pure. No database, no network, no file reads,
   no clock. Time comes from state["now"].
2. Use Decimal for every money comparison. Never float.
3. Return every rule code that fired. BLOCK beats ESCALATE. Otherwise APPROVE.
4. R9 only fires when an injection phrase AND a payment field deviation are both present.
5. Write the 14 tests FIRST, run them, watch them fail, then implement.
   One test per rule R1-R12, one clean APPROVE, one where two rules fire.

JOB 2 — the eval runner
Implement eval/run.py per eval/README.md. It imports app.rules.evaluate directly.
Adarsh writes eval/attacks.json; you write the runner that reads it.
It must print "Block rate: N/40 (X%)" and exit 1 on any miss.

JOB 3 — ML (last, only if JOB 1 and 2 are green)
Your model is in ml/. It is broken: it compares raw dollars against scaled cutoffs,
so $1 and $99,999 both score about 0.7. Retrain without StandardScaler, train on
synthetic purchases in our range ($1-$500) instead of PaySim, and add:
  score_intent(amount, txn_count_1h, mandate_limit, merchant_is_new, hour_of_day)
returning {"risk", "band", "reasons"}. It never returns a decision.
Add 5 tests in ml/tests/test_score.py.

Never edit files outside your list. Never push to main.
  git add backend/app/rules.py backend/tests/test_rules.py eval/run.py ml/
  git commit -m "feat(rules): R1-R12 engine, eval runner, retrained score"
  git push origin rules/engine
Then open a Pull Request.

Report back: PR link, pytest output, block rate.
```

---

## Manoj — backend API, agent, deploy

```
You are working in https://github.com/Manoj-Sasanala/TRUSTLAYER

Read: docs/CONTRACT.md, docs/OWNERS.md, backend/app/store.py (stub), backend/app/agent.py (stub).

Branch: main (you are the merger).

1. Implement backend/app/store.py: mandates, quotes, purchases, get_spent.
2. Add the routes in docs/CONTRACT.md to backend/app/main.py.
3. Idempotency: same key returns the first result, never a second purchase or PayPal order.
4. Budget check runs inside BEGIN IMMEDIATE so two clicks cannot double-spend.
5. Implement backend/app/agent.py: Gemini with JSON mode, mock fallback, and the
   injection test using product p_205.
6. Deploy to Render + Vercel.

Never commit .env. Never weaken a test to go green.
```

---

## Deepika — the dashboard

```
You are working in https://github.com/Manoj-Sasanala/TRUSTLAYER

Before writing anything, read:
- docs/CONTRACT.md
- docs/OWNERS.md
- frontend/README.md

Create branch: ui/dashboard

Follow frontend/README.md exactly. Build one page with four panels:
Mandate editor, Decision feed (AG Grid Community), Attack lab, Audit panel.

Start with src/mock.ts so you are not blocked by the backend.
Then switch to the real API.

Money is a string, never a number. Missing field shows "-". Never crash.

Never edit backend/. Never push to main.
  git add frontend/
  git commit -m "feat(ui): dashboard with ag grid feed and attack lab"
  git push origin ui/dashboard
Then open a Pull Request.

Report back: PR link and one screenshot of all four panels.
```

---

## Adarsh — attack data, docs, video

```
You are working in https://github.com/Manoj-Sasanala/TRUSTLAYER

Before writing anything, read:
- docs/CONTRACT.md
- docs/OWNERS.md
- eval/README.md

Create branch: docs/proof

JOB 1 — eval/attacks.json (do this first, it is needed on day 4)
Write 40 attack entries exactly as eval/README.md describes.
Distribution: over_cap 8, over_budget 8, unapproved_merchant 6, price_mismatch 6,
payee_switch 6, injection 6 (one each: system_update, delimiter, fake_success,
qty_inflate, mandate_increase, out_of_scope).
Use the real catalog ids and prices from backend/seed.py.
Do not write eval/run.py — Tejas owns it.

JOB 2 — docs
1. Rewrite README.md for a judge with 3 minutes: what it is, one-line pitch,
   setup in 5 commands, every PayPal API used, every AI tool used, security design.
2. docs/ARCHITECTURE.md with one mermaid diagram: user -> agent -> rules -> paypal -> audit.
3. docs/EVAL.md explaining the 40-attack corpus.
4. docs/DEMO_SCRIPT.md — the 3-minute shot list.
5. docs/DEVPOST.md — submission text.

Do not invent features. If it is not in the repo, it does not go in the README.

Never push to main.
  git add eval/attacks.json README.md docs/
  git commit -m "feat(eval): attack corpus; docs: readme, architecture, demo script"
  git push origin docs/proof
Then open a Pull Request.
```
