# Manufacturing Process Tracking Platform — Assignment Summary

## Summary of Requirements

The application supports fictional manufacturing order creation, five-step production tracking, resource consumption records, and traceable production history. The prototype is intended for local technical review and does not process patient data or claim medical-device regulatory compliance.

## Functional Specifications

Users can create and search orders, review status and production progress, and inspect each order's five steps, timestamps, unit-aware consumption records, and activity timeline. A production board groups ready and active jobs by step. Operators can start only the eligible next step, record consumption against active resources, and complete a step after recording at least one consumption. Resources can be created and deactivated without deleting history. Dashboard metrics are queried from PostgreSQL.

## Software Design

The system is a Next.js modular monolith. App Router pages call REST Route Handlers; workflow rules and transactional operations live in server services, with Prisma as the database access layer. PostgreSQL stores orders, workflow master data, order steps, resources, consumption, events, and yearly order counters. Database uniqueness, foreign keys, positive-value checks, a partial unique index, and transactions support data integrity. Zod validates API inputs. Docker Compose runs PostgreSQL and the application; migrations and idempotent demo seeding run at startup.

## Simplified User Manual

Open the Dashboard to review current activity. Select **Orders → Create order** to enter product, quantity, and optional due date/notes. On the Production Board, start the order's ready step, record one or more resource consumptions, then confirm completion. The next step becomes eligible. Open an order number to review all steps, consumption, and the event timeline. Use Resources to create resources, adjust activation, and inspect consumption history.

## Software Summary

The implementation uses Next.js, React, TypeScript, Tailwind CSS, Prisma, PostgreSQL, Zod, Vitest, Playwright, and Docker Compose. Consumption records preserve resource name, category, and unit snapshots. The fictional demo seed is idempotent. Final checks include seven passing unit tests and three passing database-backed Playwright tests; type checking, linting, production build, and Docker startup were verified.

**AI-assisted development disclosure:** AI tools assisted with requirement analysis, code drafting, and documentation. The developer is responsible for reviewing implementation choices, verifying behavior, and executing the required tests before submission.
