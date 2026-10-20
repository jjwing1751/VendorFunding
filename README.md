# Fundline

Retailer-side vendor funding management: vendors submit CAISSP deal contracts at the UPC level, category managers review them against approval rules, and every promotion shows whether it is vendor funded, shared, or retailer funded. Every action is recorded in a tamper-evident audit trail.

This is the **prototype for user feedback (MVP scope)**. It ships with fictional sample data for “Northfield Market” so testers can click through realistic deals.

## What's included

| Area | Capabilities |
|---|---|
| Sign-in and security | Email + password (bcrypt, cost 12), forced change of temporary passwords, password policy, account lockout after 5 failed attempts (15 min), per-IP throttling, TOTP two-step verification (required for Admins, optional or role-required for others), server-side sessions in HttpOnly/Secure/SameSite cookies with 2-hour idle and 12-hour absolute timeouts, sign out everywhere, security headers (CSP, HSTS, frame-deny) |
| Users and roles | Admin, Category director, Category manager, Item setup, Analyst, Vendor admin, Vendor user, Vendor viewer. Editable permission grid, custom roles, category assignments, MFA-required roles. Vendor admins manage their own team. Deactivate, reset password/MFA, unlock, delete (with last-admin protection). |
| Vendors | Add, edit category/settlement/compliance score, archive (users deactivated, open deals withdrawn), delete only when there is no deal history |
| Item master | Items by UPC with cost, pack, regular retail and baseline; UPC history across deals and promotions; overlap warnings |
| Events | Quarterly event plans with vehicles, media spend, funding targets, deal cutoff, lock/reopen/complete |
| CAISSP deals | UPC-level entry that mirrors the spreadsheet (Total OI, Deal Case Cost, Net Unit Cost), import of the existing CAISSP .xlsx, drafts, sign and submit, counter-offers, accept counter, withdraw, comments (with internal notes) |
| Approval rules | Versioned rules (margin, vendor share of markdown, lift, incremental GM, compliance, cap, event fit, UPC overlap, item master, cutoff), recommendation and score, auto-approval, category scope, over-cap approval by directors, segregation of duties (you can’t approve a deal you entered) |
| Funding | Vendor funded / Shared / Retailer funded on every deal and promotion, funding mix, retailer-funded promotions by UPC, funding requests to vendors |
| Calendar | Six-month view of events, deals and retailer promotions colored by funding source |
| Funding vs. billed vs. target | Funding & performance: per event and overall, target → committed (approved deals at forecast) → earned (contract rates × actual units, ad fees, accruals) → billed and collected (from Bill Back Manager). Same funnel on every event, deal and vendor |
| Billing reconciliation (Bill Back Manager) | Billing is done in Bill Back Manager. Fundline exports a ready-to-bill CSV (billable earned − already billed, per deal) and imports Bill Back Manager’s invoice/claim file by deal number, then flags each deal Ready to bill, Under-billed, Over-billed, Disputed, Billed in full or Collected |
| Accruals | Accrual deals earn % of purchases received (from receipts uploads) over the deal period. Earned to date vs committed with pace, billed, balance, claim deadline (rule: claim window after deal end, default 90 days) and Expiring/Expired flags |
| Event performance | Baseline vs forecast vs actual units by event, deal and UPC; actual lift and forecast accuracy; promo and incremental gross margin; return on media spend; vendor $ per incremental unit |
| Vendor scorecards | Committed, earned, billed, collected, unbilled, collection rate, share of markdown, on-time submission, approval and auto-approval rates, lift delivered vs forecast, compliance. Vendors see their own scorecard and accruals |
| Sales & receipts uploads | CSV by UPC and week (POS sales; receipts), any date in the week, store rows summed, UPCs matched with or without dashes, leading zeros or check digit; re-uploads replace |
| Demo accounts and walkthroughs | One shared demo sign-in per role (picked from the login page), each with a guided walkthrough of that role’s workflow that ticks off steps from the audit trail; Admin → Demo accounts lists them and resets the sample data between test sessions |
| Audit | Append-only, SHA-256 hash-chained log of sign-ins, decisions, contract edits, admin and rule changes, with chain verification |

Not in this release (see the capability map): live POS/receiving feeds (CSV uploads for now), a direct Bill Back Manager integration (file exchange for now), autopilot learning, notifications, e-signature provider, SSO.

### Bill Back Manager file exchange

- **Out:** Billing reconciliation → Export ready to bill (`/api/export/ready-to-bill.csv`): `deal_number, vendor_number, vendor_name, settlement, deal_type, deal_start, deal_end, units_sold, bill_back_and_scan, ad_fee, accrual_rate, accrual_purchases, accrual_earned, billable_earned, already_billed, amount_to_bill, collected, status`.
- **In:** a CSV with one row per invoice or claim. Required: the Fundline deal number, an invoice/claim number, and the amount billed. Optional: amount collected, invoice date, status, method. Common header names are recognized (for example `Deal #`, `Claim Number`, `Invoice Amount`, `Amount Paid`).
- **Still needed:** a sample of Bill Back Manager’s actual export and import layouts, and whether it carries the Fundline deal number on each claim. Until then the column names are best guesses; tell us the real headers and they can be added.

## Deploy to Render

1. Push this repository to GitHub.
2. In Render: **New + → Blueprint**, choose the repo. Render reads `render.yaml` and creates:
   - `fundline-db`: PostgreSQL
   - `fundline`: Node web service (`npm ci && npm run build`, then `npm run render-start`)
3. When prompted, set **ADMIN_EMAIL** (your email). Leave **ADMIN_PASSWORD** blank to have a random temporary password printed once in the service logs, or set one.
4. After the first deploy, open the service URL, sign in with the admin email and temporary password, choose a new password, and set up two-step verification (required for Admins).
5. Add testers on **Users**. Each new user gets a temporary password to share with them securely; they change it at first sign-in.
   Or hand testers the shared demo password (next section).

### Demo accounts

With `DEMO_ACCOUNTS=true` the login page lists one shared account per role. Testers click **Use**, enter the shared password (`DEMO_PASSWORD`, or the one printed once in the first deploy log), and land on **My work** with a walkthrough for that role.

| Role | Email | Company | Walkthrough |
|---|---|---|---|
| Admin | avery.admin@northfield.test | Retailer | Add and support a user, change a role, add a vendor, verify the audit trail, reset the demo |
| Category director | dana.director@northfield.test | Retailer | Decide a rule exception (DL-0006), tune a rule, plan and lock an event |
| Category manager | casey.cm@northfield.test | Retailer (Salty Snacks, Candy, Breakfast, Center Store Meals) | Approve DL-0005, counter DL-0004, internal note on DL-0003, request vendor funding, read the calendar |
| Finance / AR | fran.finance@northfield.test | Retailer (all categories) | Read the funding funnel, find unbilled deals, export ready-to-bill, import Bill Back Manager results, chase an expiring accrual, upload sales |
| Item setup | ivy.items@northfield.test | Retailer | UPC history, add an item, update a cost |
| Analyst (read only) | andre.analyst@northfield.test | Retailer | Calendar funding mix, deal economics, read-only check, audit |
| Vendor admin | kim.brandt@prairiegold.test | Prairie Gold Snacks | Add a teammate, enter and submit a CAISSP deal, comment |
| Vendor user | pat.haas@harvesttable.test | Harvest Table Foods | Reply to and accept the counter on DL-0007, start a draft |
| Vendor viewer | tara.greer@summithome.test | Summit Home Care | Read-only deals, calendar and items |

How they differ from real accounts:
- No two-step verification (testers can’t share an authenticator), and the password can’t be changed in the app. Lockout after 5 failed attempts still applies; an admin can unlock.
- A demo account can manage only users that testers added (marked **Demo**), never real accounts or the built-in demo logins. Users a demo admin or vendor admin creates are demo users too.
- Testers share data. Between sessions, an admin uses **Admin → Demo accounts → Reset**: it reloads the sample deals, events, promotions and items, restores built-in roles and default rules, removes tester-added users and vendors, and restarts every walkthrough. Real users and the audit trail are kept.
- Walkthrough steps tick off when the user’s own action appears in the audit trail; any step can also be marked done by hand. Every user (demo or not) can open **Guided walkthrough** in the sidebar.
- Set `DEMO_ACCOUNTS=false` before real users or vendor data arrive; on the next start every demo account is deactivated.

On every start the service runs database migrations and an idempotent seed (roles, default rules, first admin, and sample data when `SEED_DEMO=true` and the database has no vendors). Set `SEED_DEMO=false` before connecting real data.

Plans in `render.yaml` are `starter` (web) and `basic-256mb` (database). Change them in the file or the Render dashboard.

### Environment variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (set from the Render database) |
| `ADMIN_EMAIL` | First admin account, created when no active admin exists |
| `ADMIN_NAME` | Display name for that admin |
| `ADMIN_PASSWORD` | Optional initial password; blank generates one and logs it once |
| `SEED_DEMO` | `true` loads the fictional sample data on an empty database |
| `DEMO_ACCOUNTS` | `true` turns on the shared demo sign-ins (defaults to `SEED_DEMO`); `false` deactivates them at the next start |
| `DEMO_PASSWORD` | Shared password for the demo sign-ins; blank generates one and logs it once. Changing it re-sets every demo account at the next start |
| `RETAILER_NAME` | Name shown in the app header |

## Run locally

Requires Node 20.11+ and PostgreSQL 14+.

```bash
cp .env.example .env          # set DATABASE_URL and ADMIN_EMAIL
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
```

Tests:

```bash
npm test                      # economics, CAISSP math, TOTP vectors, password policy
npm run test:e2e -- http://localhost:3000   # browser smoke test (needs Playwright installed and a fresh seeded DB)
DEMO_PASSWORD=... npm run test:e2e:demo -- http://localhost:3000   # demo accounts, walkthroughs and reset (fresh seeded DB)
DEMO_PASSWORD=... npm run test:e2e:funding -- http://localhost:3000   # funding, billing, accruals, uploads (fresh seeded DB)
```

## Project layout

```
src/app/login            sign-in, MFA challenge
src/app/(app)            signed-in pages: My work, deals, events, promotions, calendar, items, admin, audit, account, help
src/lib/auth.ts          sessions, role/permission checks, category scope
src/lib/economics.ts     CAISSP line math, deal economics, approval rules, funding classification
src/lib/caissp.ts        CAISSP .xlsx reader
src/lib/audit.ts         hash-chained audit log
src/lib/measure.ts       committed / earned / billable / billed / collected, accruals, event lift and margin, scorecards
src/lib/ingest.ts        sales, receipts and Bill Back Manager CSV imports
src/lib/demo.ts          sample data (incl. 26 weeks of generated sales/receipts and billing history), demo accounts, reset
src/lib/guides.ts        per-role guided walkthroughs
src/db/schema.ts         Drizzle ORM schema (PostgreSQL); migrations in drizzle/
scripts/                 migrate and seed (run at startup on Render)
```

Schema changes: edit `src/db/schema.ts`, run `npm run db:generate`, commit the new file in `drizzle/`.

## Security notes and known limits

- Authorization is enforced on the server in every page and action; hidden buttons are not the control.
- Vendor users only ever see their own company’s deals and items; other vendors’ records return 404.
- Temporary passwords are shown once to the admin who created them and are never stored in plain text.
- The login throttle is in memory (one instance). Use a shared store before running more than one instance.
- The CSP allows inline scripts because Next.js injects them; moving to nonce-based CSP is a hardening item.
- Money is stored as double precision for the prototype; move to numeric/decimal before billing goes live.
- Forecasts use a default lift curve; actual lift is measured once sales are uploaded, but the forecast model doesn't learn from it yet.
- Weekly sales are prorated by day when a deal starts or ends mid-week, which assumes even sales within the week.
- Earned off-invoice is estimated from units sold × the per-unit allowance, not from invoice-level receiving.
- Demo sales, receipts and billing history are generated, not real. On an existing demo deployment, run Admin → Demo accounts → Reset once to load them.
