# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — development with nodemon (watches `.js`, `.ejs`, `.sql`, `.json`).
- `npm start` — production start (`node server.js`).
- `docker-compose up -d` — brings up the app + Postgres 16 locally (see `README.docker.md`).
- Database migrations under `migrations/` are applied **manually** against the target database (e.g. `source .env && psql "$DATABASE_URL" -f migrations/001_add_parcelas.sql`). There is no migration runner.
- No test suite, linter, or typechecker is configured — don't claim tests pass without adding them.

## Environment

`src/db/index.js` prefers `DATABASE_URL` (with optional `PGSSL=true`) over individual `PG*` vars. `.env` is loaded once from `server.js` via `dotenv`. The legacy Basic Auth middleware is commented out in `server.js` — leave it in place; do not re-enable without being asked.

## Architecture

Classic Express-5 + EJS server. No build step, no frontend framework. Request flow:

1. `server.js` registers view engine, static middlewares (`public/` and `node_modules` re-exposed as `/vendor` so EJS templates can load `apexcharts` directly), money/currency locals, and mounts five routers under `/tags`, `/gastos`, `/dashboard`, `/contas`, `/relatorios`. `/` redirects to `/dashboard`.
2. Each controller in `src/controllers/*Controller.js` exports `{ router }` and uses `query` + `loadSql` from `src/db`.
3. `loadSql('<feature>/<name>.sql')` reads raw SQL from `src/models/<feature>/` **at module load time**. Every SQL statement the app runs lives as a standalone file there — **do not inline SQL in controllers**. Adding a new query means adding a `.sql` file and a `loadSql(...)` binding at the top of the controller.
4. Views live in `src/views/<feature>/*.ejs` with `partials/header.ejs` shared. Reports and dashboard load ApexCharts from `/vendor/apexcharts/...`.

### Domain model

The app is a pt-BR personal finance tracker (`contabiliza`). Core entities:

- **gastos** — expenses. Columns include `descricao_gasto`, `valor`, `tag_id`, `tipo` (`'pix' | 'cartao' | 'debito'`), `conta_id`, `data_efetivacao timestamptz`, plus the installment trio added by `migrations/001_add_parcelas.sql`: `parcela_numero`, `parcela_total`, `parcela_grupo_id UUID`. The installment columns are nullable — a non-installment gasto has all three `NULL`.
- **tags** — free-form categories.
- **contas** — bank accounts (Nubank, Mercado Pago, BTG, etc.).

### Installments (parcelas)

Installment logic lives in `gastosController.js` POST `/gastos`. When `num_parcelas > 1` the controller generates one `parcela_grupo_id` (`crypto.randomUUID()`) and inserts **one row per parcela**, each with `valor = valor_total / N` and `data_efetivacao` advanced by `setUTCMonth(month + i - 1)`. The spec in `specs/input_gastos.md` additionally describes suffixing the descrição with `(parcela X/Y)` for chat-based inserts — the HTTP form path currently does not apply that suffix; match existing behavior unless asked to change it.

### Dates are UTC-start, end is exclusive

Every date-filtered query uses the pattern `data_efetivacao >= $start AND data_efetivacao < $end`. Controllers share small helpers (`parseYmdToUtcStart`, `addDays`) that convert a `YYYY-MM-DD` query param into a UTC-midnight `Date`, then compute an **exclusive** end by adding one day to the user-supplied end date. Preserve this convention in any new date filter — do **not** use `BETWEEN` or inclusive end dates, and do not rely on server local time.

### Reports

`reportsController.js` renders three pages (`/relatorios/tags-mensal`, `/relatorios/totais-periodo`, `/relatorios/tag-mes-detalhes`) and exposes one JSON endpoint (`/relatorios/api/expenses-by-tag`) used by client-side drill-down. The sentinel string `'— sem tag —'` (with em-dash) represents "no tag" in querystring params and maps to SQL `NULL`.

## Chat-based expense input (specs/input_gastos.md)

When the user asks Claude in chat to record a gasto, follow `specs/input_gastos.md` strictly. Non-obvious rules worth re-reading before acting:

- Always run `source .env && psql "$DATABASE_URL" -c "..."` in the same shell invocation — do not assume `DATABASE_URL` is exported.
- **Duplicate check is mandatory before any INSERT** — query by similar `descricao_gasto ILIKE` and by exact `valor` within ±3 days of `data_efetivacao`, then confirm with the user before inserting.
- For installments from chat, generate the UUID, insert N rows, and append ` (parcela X/Y)` to each descrição.
- Confirm with the user (show a summary) before running the INSERT, then report the returned `id`.

## Conventions

- Commit messages follow Conventional Commits as documented in `specs/conventional_commits.md` (pt-BR descriptions are fine; types are English: `feat`, `fix`, `refactor`, etc.). There are matching `/commit`, `/review`, `/debug`, `/deploy`, `/new-feature`, `/code-style` slash commands under `.claude/commands/`.
- All user-visible strings and column names are Portuguese — keep new UI copy, route names (`/relatorios`, `/gastos`), and schema names in pt-BR for consistency.
- Money formatting goes through `app.locals.money` / `app.locals.currency` (pt-BR, BRL). Use these in templates instead of ad-hoc `toFixed`.
