# frontend/ — the screen judges see

Owner: Deepika. Branch: `ui/dashboard`. Deadline: end of day 4. Freeze 22:00.

## Scaffold it

```bash
cd F:\paypal
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm i ag-grid-react ag-grid-community
```

Then create these files:

```
src/api.ts                      fetch wrappers, base URL from VITE_API_URL
src/mock.ts                     fake decisions for the first day
src/App.tsx                     four panels on one page
src/components/MandateEditor.tsx
src/components/DecisionFeed.tsx
src/components/AttackLab.tsx
src/components/AuditPanel.tsx
```

## The four panels

1. **Mandate editor** — budget, per-purchase cap, approval threshold, expiry, allowed merchants. Button: "Save my rules".
2. **Decision feed** — **AG Grid Community, not a plain table.** Columns: time, item, amount, decision, reason codes, risk. Refresh every 2 seconds. Row colours: APPROVE green, BLOCK red, ESCALATE amber.
3. **Attack lab** — four buttons: Over cap, Over budget, Wrong payee, Injection.
4. **Audit panel** — one button "Verify records". Shows "OK, 12 records verified" or "BROKEN at record 7".

## API

Base `http://localhost:8000`. Proxy `/api` in `vite.config.ts` to avoid CORS.

Endpoints and payloads: `docs/CONTRACT.md`.

Start with `mock.ts`. Do not wait for the backend.

## Rules

- Money is a string: `"24.99"`. Never parse it into a number.
- Missing field → show `-`. Never crash during the demo.
- No placeholder text on screen when recording.
- Visible keyboard focus.
- No Redux, no Tailwind, no component library. Four files and AG Grid.
