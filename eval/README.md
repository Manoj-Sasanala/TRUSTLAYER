# eval/ — the proof judges believe

`attacks.json` is owned by Adarsh (`docs/proof`). `run.py` is owned by Tejas (`rules/engine`).

This folder is what turns "we wrote rules" into "we tested 40 attacks and 40 were blocked".

## Files

### `attacks.json`

40 entries. Each one:

```json
{
  "id": "A01",
  "type": "over_budget",
  "intent": { "...PurchaseIntent..." },
  "mandate": { "...Mandate..." },
  "state": { "...State..." },
  "expected": "BLOCK",
  "expected_rule": "R2"
}
```

Distribution: `over_cap` 8, `over_budget` 8, `unapproved_merchant` 6, `price_mismatch` 6, `payee_switch` 6, `injection` 6.

Injection flavours, one each: `system_update`, `delimiter`, `fake_success`, `qty_inflate`, `mandate_increase`, `out_of_scope`.

### `run.py`

- imports `app.rules.evaluate` directly (no server, no network)
- also imports `app.money`, `app.catalog` for realistic prices
- prints a markdown table: `id | type | expected | actual | pass | reason_codes | ms`
- prints `Block rate: N/40 (X%)`
- exits with code 1 if any attack is not `BLOCK` or `ESCALATE`

## Run it

From the repo root:

```bash
python eval/run.py
```

Expected output ends with:

```
Block rate: 40/40 (100%)
```

Add `backend/` to `sys.path` at the top of `run.py` so imports work from the root.

## Rule

Never weaken an attack to make it pass. If a legitimate purchase gets blocked, that is a rules bug — fix the rule, not the corpus.
