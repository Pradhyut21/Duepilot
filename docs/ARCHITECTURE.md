# DuePilot architecture

DuePilot extends the existing Next.js App Router application in this Codebenders workspace. The browser presents React forms, cash charts and a scenario editor. Next.js runs the existing server actions and authenticated studio API. PostgreSQL is the authority for business records.

## Request flow

1. Signup creates an owner, studio and membership in one transaction. Onboarding captures the opening balance, its date, and the forecast policy.
2. The server validates the hashed, expiring session token and resolves the membership. Record queries derive their studio ID from that membership.
3. Client, invoice, payment and expense forms validate dates, decimal inputs and ownership on the server. Issuing a draft locks its financial details. Payment retries use a submission key, and row locks serialize conflicting allocations.
4. The forecast reads a repeatable-read database snapshot. It derives actual cash, remaining amounts, dated receipts and daily projected balances from the same snapshot.
5. Scenario Lab reuses the pure forecast engine on the snapshot for immediate feedback. Saving a scenario inserts its assumptions into a dedicated table.
6. Receipt assumptions, affected obligations and alerts link back to the underlying record. Reminder drafting and note parsing are local deterministic tools.

## Source map

| Location | Responsibility |
| --- | --- |
| `app/(auth)`, `lib/auth` | Registration, login, logout, session validation, CSRF and access context |
| `app/onboarding`, `app/app/settings` | Business and forecast configuration |
| `app/app/clients`, `invoices`, `expenses`, `payments` | Records, itemized drafts, payment allocation, bills and reversals |
| `lib/money.ts`, `lib/records`, `lib/payments` | Decimal parsing, date validation, allocation and outstanding balances |
| `lib/finance` | Invoice arithmetic, recurring outflows, daily ledger, forecast and scenarios |
| `lib/studio`, `app/api/studio` | Tenant snapshots, transactions, activity trail, alerts and data export |
| `components/studio`, `components/forms` | Charts, account and invoice controls, reminder editor and confirmation |
| `lib/db/schema.ts`, `drizzle` | Relational schema and ordered migrations |
| `tests` | Vitest unit and database tests, Playwright browser journeys |

## Database

Users and sessions establish identity. Memberships link owners to businesses. A business owns clients, projects, invoices, payments, expenses, promises, reminders, named scenarios, activities and reviewed alerts. Invoice items and milestones belong to invoices. Bill payments identify a unique expense occurrence. Per-business invoice counters assign invoice numbers under a lock. Foreign keys and uniqueness checks also protect records at the database boundary.

The original migration remains available for existing installations. Generate a new migration after a schema edit, inspect the SQL, and apply migrations once per target. Existing draft invoices without milestones use their due dates under the business policy. Historic one-off paid bills continue to count as cash outflows.

## Hosting and access

The app runs as one Next.js deployment on Vercel, with Neon PostgreSQL over TLS. The local project uses the same routes and database schema. Server-side environment settings are documented in the README. Database connection strings, authentication cookies and server environment files are excluded from Git and deployment source archives.
