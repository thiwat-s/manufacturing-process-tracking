# Manufacturing Process Tracking Platform

A local operations prototype for tracking fictional custom manufacturing orders across five controlled production steps. It records resource use and an append-only activity timeline. It is not certified for medical device manufacturing and must not be used with patient or other sensitive production data.

## Features

- Live dashboard metrics, step activity, resource totals by resource and unit, and recent production events.
- Order creation with a database-backed yearly sequence, search, derived status, and detail/history views.
- Five-step production board with eligibility checks, concurrent orders, consumption entry, and confirmed completion.
- Resource catalog with soft activation/deactivation and consumption history.
- PostgreSQL constraints and transactions enforce positive quantities, unique order numbering, valid transitions, one active step per order, and immutable historical records through the normal API.
- Idempotent demo seed for eight fictional orders, ten resources, and valid production history.

## Technology and structure

Next.js App Router, React, TypeScript, Tailwind CSS, Zod, React Hook Form dependencies, Lucide React, Prisma ORM, PostgreSQL, Vitest, Playwright, Docker Compose.

Route Handlers under `src/app/api` provide REST endpoints. `src/server/services` holds workflow rules and transaction operations; Prisma is isolated behind server data access. Client pages call the API and never access Prisma. The workflow master data is stored in `production_steps`; each order receives exactly five `order_steps`.

## Production workflow

Material Preparation → Manufacturing → Post-processing → Quality Inspection → Labelling & Packaging.

An order's status is derived from its five step statuses. Only the next pending step can start. Consumption is recorded only against an active step and active resource. Each step needs at least one consumption record to complete. Each state change and consumption write its production event within the same transaction. Resource name, category, and unit are snapshotted per consumption record so later master-data edits do not rewrite history. Quantities are not combined across resource identities or units.

## Docker quick start

Prerequisite: Docker Desktop or Docker Engine with Compose.

```bash
docker compose up --build
```

Open <http://localhost:3000>. The app waits for the PostgreSQL health check, deploys migrations, and runs the idempotent seed before starting. The `manufacturing-data` volume preserves the local database. Stop with `Ctrl+C`; remove the volume only when intentionally resetting local data (`docker compose down -v`). Compose uses local demo credentials; do not expose this setup to a network.

## Local development

Prerequisites: Node.js 22 or newer and PostgreSQL 15 or newer.

1. Create a PostgreSQL database and copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to the local database connection string.
3. Install and initialize:

```bash
npm install
npm run db:deploy
npm run db:seed
npm run dev
```

Open <http://localhost:3000>. For schema iteration, use `npm run db:migrate -- --name change_name`. Prisma client generation is `npm run db:generate`.

## API overview

- `GET /api/dashboard`
- `GET|POST /api/orders`, `GET /api/orders/:id`, `GET /api/orders/:id/timeline`
- `GET /api/production/board`
- `POST /api/orders/:id/steps/:stepId/start|complete`
- `GET|POST /api/orders/:id/steps/:stepId/consumptions`
- `GET|POST /api/resources`, `PATCH /api/resources/:id`
- `GET /api/consumptions`

Order listing accepts `search`, `status`, `dueBefore`, `sort` (`createdAt` or `dueDate`), `direction`, `page`, and `pageSize`. API errors use `{ error: { code, message } }` and do not return stack traces.

## Tests

`npm test` runs the deterministic unit tests. The Playwright full-workflow test requires a **dedicated** database whose name includes `manufacturing_test`; the Playwright config refuses to start otherwise. Create that database, set `DATABASE_URL` to it, apply the migration and seed, then run:

```bash
npm run db:deploy
npm run db:seed
npm run test:e2e
```

The end-to-end workflow writes and leaves test records in that isolated database. Do not point it at a developer or shared database. Run `npm run typecheck` and `npm run build` for static and production checks.

Install the Playwright browser once with `npx playwright install chromium` if it is not already present on the machine.

For a repeatable responsive layout audit, start the app with `npm run dev`, then run `npm run audit:responsive` in another terminal. It checks all five UI routes at widths from 320px through 1440px, exercises small-screen dialogs, and writes screenshots plus measurements under `artifacts/responsive-audit/`. The audit stubs API responses so it can verify layout without a database; it does not replace the database-backed workflow test.

## Environment variables

| Variable       | Purpose                                                    |
| -------------- | ---------------------------------------------------------- |
| `DATABASE_URL` | PostgreSQL connection string; required by Prisma and tests |
| `NODE_ENV`     | Node environment (`development` or `production`)           |

## Database overview

`Order`, `ProductionStep`, `OrderStep`, `Resource`, `ResourceConsumption`, `ProductionEvent`, and `OrderNumberCounter` are the core models. Migrations are in `prisma/migrations`. Database constraints include positive order/consumption quantities, foreign keys with delete restrictions, unique workflow sequence and codes, unique order-step pairs, and a PostgreSQL partial unique index limiting an order to one in-progress step.

## Known limitations

- Authentication, authorization, inventory balance, machine scheduling, and resource stock deduction are outside the prototype scope.
- Resource quantities retain their recorded units and are not converted between units.
- Resource units are labels and are not converted. The snapshot migration backfills existing rows with their current resource name and category; earlier names cannot be recovered from the pre-migration database. Consumption history is retained; normal application APIs do not edit or delete consumption or event records.
- This prototype is not production-ready for sensitive medical data and makes no regulatory-compliance claim.
