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

The chat assistant has two providers, selected by `AI_PROVIDER` (default `gemini`):

- **`gemini`** — needs `GEMINI_API_KEY` (Google Gemini, an `AIza…` key); `GEMINI_MODEL` is optional (defaults to `gemini-2.5-flash`). Read at module load by `src/services/geminiClient.js`. Uses native function calling.
- **`nim`** — needs `NIM_API_KEY` (NVIDIA NIM, an `nvapi-…` key from build.nvidia.com); `NIM_MODEL` is optional (default `google/gemma-3n-e4b-it`); `NIM_BASE_URL` is optional (defaults to `https://integrate.api.nvidia.com/v1`). Read at module load by `src/services/nimClient.js`. The endpoint is OpenAI-compatible, so the `openai` npm SDK talks to it directly. Because Gemma has no native function calling, this path uses **JSON-mode prompting** — see the assistant section.

Without the configured provider's key the app still boots — the assistant just returns a "configure ..._API_KEY" message. Keys live in `.env` only (gitignored) with placeholders in `.env.example`. The optional Telegram bot adds `TELEGRAM_BOT_TOKEN` (from @BotFather) and `TELEGRAM_ALLOWED_IDS` (CSV allowlist of Telegram user ids); see the Telegram bot section.

## Architecture

Classic Express-5 + EJS server. No build step, no frontend framework. Request flow:

1. `server.js` registers view engine, static middlewares (`public/` and `node_modules` re-exposed as `/vendor` so EJS templates can load `apexcharts` directly), body parsers (`urlencoded` for forms, `express.json()` for the assistant's JSON API), money/currency locals, and mounts six routers under `/tags`, `/gastos`, `/dashboard`, `/contas`, `/relatorios`, `/assistente`. `/` redirects to `/dashboard`.
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

### AI chat assistant (`/assistente`)

An in-app port of `specs/input_gastos.md`. The channel-agnostic core is `src/services/assistenteCore.js`, which exposes `processarMensagem({ history, message, canal })` → `{ reply, inseridos }`. Two thin channels call it:
  - **Web** — `assistenteController.js`: `GET /assistente` renders the chat page; `POST /assistente/mensagem` takes `{ message, history }` (history is text-only turns kept client-side and posted back each turn) and returns `{ reply, inseridos }`.
  - **Telegram** — `src/services/telegramBot.js` (see below).

The model never writes SQL. It calls server-side **tools** — `consultar_gastos`, `totais_por_tag` (read), `verificar_duplicatas` (read, mandatory before any insert), and `registrar_gasto` (write) — whose handlers (`executeTool`) run the same parameterized `loadSql` queries as everything else (`gastos/query_flexible.sql`, `gastos/sum_flexible.sql`, `gastos/find_similar.sql`, plus the shared `insert.sql` / `totals_by_tag_range.sql`). Optional filters use the `($n::type IS NULL OR col = $n)` idiom so one static `.sql` file covers all filter combinations.

`processarMensagem` dispatches on `AI_PROVIDER`:

- **`gemini` (default)** — `processarMensagemGemini` uses `@google/genai` with **native function calling**. The model emits `functionCall` parts; the server executes the tool and feeds back `functionResponse` parts. `generateWithRetry` retries transient 429/500/503 from Gemini with backoff. Gemini 2.5 sometimes returns empty text after a successful tool call — `fallbackReplyIfInserted` provides a friendly "✅ Gasto registrado (id N)" so the UI never shows "(sem resposta)".
- **`nim`** — `processarMensagemNim` uses the `openai` SDK against `integrate.api.nvidia.com/v1`. Because Gemma 3n has no native function calling, the model is prompted (via `TOOLS_DOC_NIM` appended to the system instruction) to emit EXACTLY one JSON per turn: `{"tool":"<name>","args":{...}}` or `{"final":"<text>"}`. `extractJson` is tolerant — strips ```json fences and walks balanced braces to recover a JSON object even if the model wraps it in prose. After each tool call, the server appends the assistant JSON and a `RESULTADO de <tool>: …` user message, then loops.
- The whole tool loop runs inside one `processarMensagem` call (capped at `MAX_STEPS = 6`). Both paths share `executeTool` and `buildSystemInstruction(canal, provider)`.
- `buildSystemInstruction(canal)` is rebuilt per request and injects today's UTC date + the live tags/contas lists, so relative dates and tag/conta names resolve correctly. `canal` only changes the output style: `'web'` allows Markdown/tables; `'telegram'` forces plain text (Telegram renders neither). The prompt enforces the spec's flow: always check duplicates → show a summary → **wait for explicit user confirmation** before calling `registrar_gasto`. Unlike the HTTP form path, the assistant's installment inserts **do** append the ` (parcela X/Y)` suffix (matching the spec).
- Tag names are resolved case-insensitively; an unknown tag is created on insert (`resolveTagId(..., { criarSeNaoExistir: true })`). The web view renders assistant replies as Markdown via `marked` (CDN).

### Telegram bot (`src/services/telegramBot.js`)

`startTelegramBot()` is called from `server.js` after `listen()`. With no `TELEGRAM_BOT_TOKEN` it no-ops; otherwise it runs **long polling** (`getUpdates`, no webhook/public URL needed — works the same locally and on Railway) and routes each text message through `processarMensagem({ canal: 'telegram' })`.

- **Access control is mandatory** — the bot writes to the real DB. Only Telegram user ids in `TELEGRAM_ALLOWED_IDS` (CSV) are served; everyone else just gets their own id echoed back. An **empty allowlist denies everyone** (and the echo is how the owner discovers their id for first setup).
- Conversation history is kept server-side in an in-memory `Map` keyed by `chat_id` (resets on restart; `/reset` and `/start` clear it). Replies are split into 4096-char chunks.
- Runs inside the single web process; assumes one replica (a second `getUpdates` consumer would 409).

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
