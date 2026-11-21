# DuePilot

**Know your cash before your clients pay.**

DuePilot is a cash-flow forecasting app for small service businesses and freelancers
in India. It is meant to answer one question: given the invoices you have issued, the
payments you expect, and the bills you have to pay, will the bank balance go negative,
and on which day?

## Problem

Small businesses often have profitable work on paper but run short of cash, because
clients pay late and the money arrives in lumps. Spreadsheets show what is owed but not
when the balance will dip below zero. DuePilot will model the daily ledger, flag negative
days in a 30/60/90-day forecast, and let you test "what if this client pays a week late?"
without changing the real records.

## Status: Phase 1 — foundation only

Implemented so far:

- Next.js 15 (App Router), TypeScript and Tailwind CSS scaffold
- PostgreSQL schema (Drizzle ORM) and migration runner
- Environment validation (`lib/env.ts`)
- Email and password sign-up and log-in, with bcrypt hashing, server-side sessions
  (hashed tokens stored in the database), an httpOnly session cookie, same-origin checks
  on state-changing actions and login rate limiting
- A protected `/app` shell with navigation, and placeholder pages for each section

Not built yet: onboarding, clients, invoices, payments, expenses, the forecast engine,
scenarios, the action centre, reminders and AI note extraction. The placeholder pages say
so. Do not treat the current app as a working cash-flow tool.

## Running locally

Requirements: Node.js 18.18 or newer and a PostgreSQL database.

1. Install dependencies: `npm install`
2. Copy the environment template and fill in the values: `cp .env.example .env`
   - `DATABASE_URL`: a PostgreSQL connection string
   - `SESSION_SECRET`: at least 32 characters
   - `APP_URL`: the public origin, for example `http://localhost:3000`

   The values are validated the first time the app reads them, and an invalid value
   produces an error that names the failing variable.
3. Apply the database migrations: `npm run db:migrate`
4. Start the development server: `npm run dev`, then open `http://localhost:3000` and
   sign up at `/signup`.

## Scripts

| Script                | What it does                                         |
| --------------------- | ---------------------------------------------------- |
| `npm run dev`         | Start the Next.js development server                 |
| `npm run build`       | Create a production build                            |
| `npm run start`       | Serve the production build                           |
| `npm run lint`        | Run ESLint through `next lint`                       |
| `npm run typecheck`   | Run `tsc --noEmit`                                   |
| `npm run test`        | Run the Vitest suite                                 |
| `npm run db:generate` | Generate a new Drizzle migration from schema changes |
| `npm run db:migrate`  | Apply pending migrations to `DATABASE_URL`           |

## Tests

`npm run test` runs the unit tests (password hashing, session tokens, environment parsing,
same-origin checks, rate limiting). The database integration test runs only when
`DATABASE_URL` is set; otherwise it is skipped with a console message.

## More documentation

Architecture, the forecast methodology, test results, the demo script and the build log
will be added in later phases.
