# Campus Visitor Pass

A one-page proof for the Bay Atlantic University team project. Visitors request a campus pass, the **host** approves or denies it, and the **guard** checks the pass code at the gate.

The architecture is **client–server with a REST API** (Next.js · TypeScript · Tailwind CSS). The decision, the rejected alternatives, the diagram, the security and testability scenarios and the ADRs are in **[docs/architecture-decision-document.md](docs/architecture-decision-document.md)**.

## Run it

Requires Node.js 20.9 or newer (developed on Node 24).

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | What it does |
|---|---|
| `npm run dev` | Start the app with hot reload |
| `npm test` | Run the Vitest suite once (`npm run test:watch` to keep it running) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript checks |
| `npm run build` then `npm start` | Production build and server |


## Demo script (about 3 minutes)

1. Click **Reset & load sample data** to load fictional visitors covering every state.
2. **Visitor:** submit the form with a bad name (e.g. `R2-D2`) or a past date to see the field errors. Then submit a valid request to *Dr. Alicia Moreno*.
3. **Visitor → Try to break the rules:** *Approve my own request* and *Claim to be a host* both get **403**. *Skip the form's checks* gets **400**, because the server validates again.
4. **Host** (acting as Dr. Moreno): approve the request. The host only sees a masked code (`••••-2XPA`). The **Audit trail** lists the refused attempts from step 3.
5. **Visitor:** the pass code now appears under *My requests*.
6. **Guard:** type the code (lowercase works) → **VALID**. Try `ZZZZ-9999` → **INVALID**. After 5 wrong codes in a minute the guard is locked out (**429**).
7. Keep an eye on the **API activity** panel: every click is a REST call, and the page itself holds no rules.

## REST API

| Method & path | Who | Purpose |
|---|---|---|
| `GET /api/demo-accounts` | anyone | Accounts the role switcher can sign in as |
| `POST /api/session` `{ userId }` | anyone | Demo sign-in. Sets a signed, httpOnly, SameSite=Strict cookie |
| `GET /api/session` · `DELETE /api/session` | signed in | Who am I · sign out |
| `GET /api/hosts` | visitor, host | Staff a visitor can visit |
| `GET /api/pass-requests[?status=]` | visitor, host | Visitors see their own requests; hosts see requests addressed to them |
| `POST /api/pass-requests` `{ visitorName, visitDate, hostId }` | visitor | Submit a request |
| `PATCH /api/pass-requests/:id` `{ status: "approved" \| "denied" }` | addressed host | Decide; approving issues the pass code |
| `POST /api/pass-verifications` `{ code }` | guard | `{ valid: true, visitorName, … }` or `{ valid: false }` |
| `GET /api/audit-events` | host | Recent audit events (no visitor names, masked codes) |
| `POST /api/demo-data` | signed in, dev only | Wipe the store and load fake data |

Errors always have the shape `{ "error": { "code", "message", "fields"? } }`, with status 400, 401, 403, 404, 409, 413, 415 or 429.

## Where things live

```
src/
├─ app/                     Next.js App Router
│  ├─ page.tsx              the one page (client)
│  └─ api/**/route.ts       REST layer: HTTP ⇄ service calls, nothing else
├─ components/              React views: role switcher, Visitor / Host / Guard, API activity
├─ lib/api-client.ts        the browser's only way to reach the server
├─ shared/                  used by both sides: API types, validation schemas, dates, pass codes
└─ server/                  never shipped to the browser (`import "server-only"`)
   ├─ http/api-route.ts     cookies, JSON parsing, cross-site check, error → status mapping
   ├─ auth/                 session tokens, demo directory, permission policy table
   ├─ services/             Auth Service, Pass Service (authorize → validate → rules → audit), demo data
   ├─ domain/               entities and business errors
   ├─ ports.ts              interfaces: Clock, PassCodeGenerator, Repository, AuditLog, …
   ├─ adapters/             in-memory stores, system clock, crypto codes, attempt limiter
   └─ container.ts          composition root: wires adapters, or test fakes
tests/                      Vitest: service rules, session tokens, REST handlers end to end
docs/                       decision document, Excalidraw diagram (+ PNG export)
```

## Limits of the proof

- Data lives in the server's memory and resets on restart. A PostgreSQL adapter would implement `PassRequestRepository` and `AuditLog`.
- The role switcher is a demo sign-in and lets anyone pick any role. University SSO would replace `POST /api/session`, and nothing else would change.
- All names in the demo data are fictional.
