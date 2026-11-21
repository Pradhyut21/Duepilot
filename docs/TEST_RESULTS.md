# Verification record

Verification ran on 21 November 2026 in the existing Windows workspace and against the public Vercel deployment. The local runtime was Node 22.18.0. The database-backed tests used PostgreSQL with the application's Drizzle migrations.

| Command or check | Observed result |
| --- | --- |
| `npm install` and `npm ci` | Dependencies installed. The final lockfile also installed cleanly in a separate Windows directory. Vercel installed the same versions. |
| `parseEnv(process.env)` after loading the local configuration | Database URL, session secret and browser origin validated. |
| `npm run db:generate` and `npm run db:migrate` | Generated and applied additive migrations 0001 and 0002 after the original schema. |
| `npm run typecheck` | Passed. |
| `npm run lint` | Passed with zero ESLint warnings or errors. Next 15 also prints a deprecation notice for its lint wrapper. |
| `npm test` | **114 tests passed in 13 files**, including both database test files. |
| `npm run build` | Production build succeeded. Next compiled public pages, protected routes and API handlers. |
| `npm audit --omit=dev` and `npm audit` | Zero reported vulnerabilities in the production set and in the clean full dependency tree, including test and migration tools. |
| Local `npm run test:e2e` | **4 of 4 journeys passed** against the production build on port 3000. |
| Hosted `npm run test:e2e` with `TEST_BASE_URL=https://duepilot-studio-ace.vercel.app` | **4 of 4 journeys passed** on the public origin, including account persistence across logout and re-login. |
| Anonymous HTTP checks on the public origin | The landing page returned 200. The studio export returned 401. |

Vercel reported production deployment `dpl_9BTA3rCFQvyCUTBjJxhTpxyjRdDH` as Ready with the stable alias [duepilot-studio-ace.vercel.app](https://duepilot-studio-ace.vercel.app/). The CLI lost a polling connection during the build. A separate deployment inspection confirmed its terminal status and alias.

## Financial regression

The November fixture closed at a minimum of ₹17,000 with zero negative days. Delaying only the ₹35,000 unpaid receipt by 15 days produced closing balances of −₹7,000 on 1 December, −₹4,000 on 5 December, −₹18,000 on 6 December and ₹17,000 on 12 December. Nine days closed negative. Tests compared the underlying invoices, receipts and promises before and after the simulation.

## Browser and API journeys

The Playwright suite uses real Chromium, real HTTP requests and persistent records. It covers signup and onboarding, a persistent client, issuing an itemized invoice, partial payment, a scheduled bill, recalculated forecast, saved scenario, reminder edits and clipboard contents, logout, blocked access and a subsequent login that reloads the original balance. The sample journey checks six routes at 1440, 768 and 390 pixels and asserts zero uncaught page errors.

Additional coverage includes print-to-PDF bytes, multi-line draft revision and tax rounding, uncertain note extraction and owner correction, unconfirmed and invalid payments, duplicate submissions, reversal, expense payment, a second demo tenant, origin rejection and demo reset.

## Issues found during verification

- An early browser run exposed malformed SQL in invoice-number assignment. Corrected the statement and verified creation, issuance and payment through the deployed UI.
- Repeated browser runs showed same-page redirects could leave a saved form pending. Client creation now opens the saved account. Bill saves, oldest-due payment allocation and draft edits return in place and revalidate affected views. Studio API forms load a fresh document after the database confirms a write, preventing a cached client tree from briefly showing an older invoice status.
- Adjusted test selectors to target the client combobox and the specific reminder save confirmation. A transient connection reset during a cross-origin rejection check was retried using a fresh connection.
- Limited local test concurrency and allowed more time for the networked database integration tests after an overloaded run exceeded the original five-second timeout.

Browser test traces and environment files are ignored. Secret checks compared repository files with the configured credentials and checked common private-key and token patterns. Production secrets were configured through the hosting CLI.
