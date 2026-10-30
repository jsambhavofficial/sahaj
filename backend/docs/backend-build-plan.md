# SamarthCare AI — Backend Build Plan (handoff)

Written 2026-10-29 for a fresh chat that will build the backend. Read this file first, then `docs/system-overview.md` (product plan). The SQLAlchemy models in `app/modules/*/models.py` and the Alembic migrations are the source of truth for the schema; `docs/superpowers/specs/2026-10-29-database-schema-design.md` is **stale** (written for the old dataset) and only useful for intent.

---

## 0. Working agreements (from the user, follow them)

- **Never commit, push or force-push unless explicitly asked. Never add a `Co-Authored-By` line or any Claude attribution** to commits or PR text. Use short plain-language commit messages when asked.
- **Never print secret values** from `backend/.env` (DB URL, Exotel keys, tokens). Check them by key name and length only, and test credentials with read-only calls that report success or failure.
- The user is the backend dev on a hackathon team. Mobile apps (senior app, coordinator app) and the ops web dashboard are built by a teammate, so **the OpenAPI contract is the product**. Keep `/docs` accurate and stable.
- Do not invent facts about third-party APIs. Where this plan says "verify", read the provider docs first.
- Never create folder names with trailing spaces (it broke Windows pulls once).

## 1. Goal and constraints (hackathon brief DEV_104)

Detect gradual decline in seniors living at home; tell a Care Coordinator **who needs attention today, why, and what to do next**. Constraints: not a diagnosis tool (never tell a senior or family they have a condition, never advise medication changes), low-tech seniors (voice, Hindi/Hinglish), low alert fatigue (precision matters), privacy (role-based access, consent for family sharing, mask personal data before any external service), low cost.

Clients, one FastAPI backend:
| Client | Built by | Users |
|---|---|---|
| Senior mobile app | teammate | seniors |
| Coordinator mobile app | teammate | care coordinators |
| Ops web dashboard | teammate | operations managers (admin too) |
| Family | no app in v1 | weekly summary and urgent alerts by SMS/WhatsApp, consent-gated |

## 2. Current state (what already exists)

**Repo:** git root is `Samarth_2.0/`; everything is under `backend/`.
```
backend/
  app/                FastAPI backend (this plan builds it out)
    main.py           create_app(); only GET /health exists today
    core/             config.py (Settings), database.py (engine/session/get_db), security.py (scrypt password hashing); deps.py, exceptions.py, logging.py are EMPTY
    db/               base.py (Base, JSONType, helpers), models.py (imports all models), seed.py (working)
    modules/<name>/   models.py is DONE; router/service/repository/schemas are EMPTY
                      auth seniors coordinators vitals medications checkins risk alerts family ops voice messages notifications
    integrations/     base.py, masking.py, bhashini/{stt,tts}.py, bedrock/llm.py, stub/ — all EMPTY
    jobs/             nightly_scoring.py, weekly_family_summary.py — EMPTY
  migrations/         Alembic (0001 create tables, 0002 RLS + API-role lockdown + ops views) — applied to Supabase
  ml/                 teammate's data generator + OLD risk engine; run from inside ml/ (its tests: 59 pass). Raw data in ml/data/raw
  tests/app/          empty
  requirements.txt  alembic.ini  .env.example  .env (gitignored)  .seed_credentials.txt (gitignored)
```
**Uncommitted:** the models, Alembic setup, migrations, seed script and `core/*` changes are in the working tree, not committed (the user decides when). Only the early scaffold and the stale spec are committed.

**Database (Supabase Postgres 17, project ref `whxutovolxcipdxugvhg`):** 29 tables + `alembic_version`, 5 views, RLS enabled on all tables with no policies (only the backend, connecting as the DB owner, reads/writes; the Supabase REST API sees nothing), `anon`/`authenticated` roles have no privileges. Seeded with the **new dataset**:
250 seniors, 627 users (125 coordinators, 1 ops, 1 admin, 250 senior users, 250 family users), 465 conditions, 541 medication schedules, 60,834 medication events, 73,073 vitals, 24,500 daily-activity rows, 2,189 accelerometer windows, 7,000 coordinator calls (6,041 with transcripts → 106,412 `call_turns`), 2,059 voice-note `messages`, 16,351 `nlp_cues`, 3,059 `family_interactions`, 250 `family_links`.
**Not seeded (empty):** `daily_risk_scores`, `alerts`, `alert_events`, `alert_feedback`, `priority_lists`, `priority_list_items`, `checkins`, `senior_memory_items`, `device_tokens`, `notifications`, `weekly_family_summaries`, `audit_log`. Risk scores and alerts will come from the teammate's new risk model (not done yet).

**Dataset facts that affect the API:**
- Observation window per senior is `enrollment_date`..`observation_end_date` (about 2026-07-06 to 2026-10-11). The real "today" is later, so **every date-based endpoint must accept an optional `date` parameter**, and there should be a configurable demo clock (`DEMO_TODAY`, default = latest date in the data) so the demo shows a populated "today".
- Cities are names (`Bengaluru`, `Jaipur`, …), stored in `seniors.city` and `users.city`. Languages are `hindi`/`hinglish`. Living arrangement values: `alone`, `with_spouse`, `with_domestic_help_or_family`. Family consent levels: `full` / `summary_and_urgent` / `urgent_only` (175/53/22 seniors).
- `nlp_cues` were loaded from the dataset's own `extracted_cues_json`/`primary_cue` (extractor_version `dataset_v2`), not from our NLP code. Do not present them as measured NLP accuracy.
- Senior phone numbers are deliberately invalid (`+910000…`). For Exotel tests, set a real tester number on a demo senior and coordinator.
- Ground-truth files live in `ml/data/evaluation/` and must **never** be loaded or exposed through the API.
- Demo logins are in `backend/.seed_credentials.txt` (password shared by all demo staff accounts; coordinators are `coord_001@demo.samarth.local` etc., plus `ops@`, `admin@`, and `family.f0001@` to `f0003@`). Seniors have `users` rows (role `senior`, `external_ref` = senior id) with no password.

**Deployment:** Render service (`https://sahaj-irgo.onrender.com`): Root Directory `backend`, build `pip install -r requirements.txt`, start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`, set `PYTHON_VERSION`. It deploys from GitHub `main` and currently serves only `/health`, `/docs`, `/openapi.json`. Env vars must be set in Render's dashboard (it does not read `.env`).

**Environment variables** (names only; never print values). Present in `.env`: `DATABASE_URL` (must be `postgresql+psycopg://…` session pooler), `SUPABASE_ACCESS_TOKEN` (MCP only, the app must not use it), `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_ACCOUNT_SID`, `EXOTEL_SUBDOMAIN` (`api.exotel.com`, verified working), `EXOTEL_CALLER_ID` (the ExoPhone), `PUBLIC_BASE_URL` (now the Render URL, **has a trailing slash; strip it in code**). Missing: `JWT_SECRET` (must be set to a long random string before auth), `BHASHINI_API_KEY`, AWS/Bedrock credentials (pending from a friend's account), Supabase Storage settings (`SUPABASE_URL`, service key, bucket name, only if using Storage), FCM credentials, `ENVIRONMENT=production` on Render, optional `DEMO_TODAY`. `core/config.py` currently declares only a few fields; add each new setting there.

**Tooling available to the builder:** Supabase MCP (project-pinned: list_tables, execute_sql, apply_migration, get_advisors, logs). Use `get_advisors` after every DDL change. Python venv is `backend/.venv` (Python 3.14; if a package lacks wheels, use 3.12). Alembic quirk: to regenerate an earlier revision, move later revision files aside first, or Alembic cannot load the chain.

## 3. Architecture rules

- **Layering, per module:** `router.py` (HTTP/WebSocket only) → `service.py` (business logic, authorization decisions) → `repository.py` (SQLAlchemy queries only) → `models.py`. Routers never touch the DB directly; repositories hold no business rules. `schemas.py` holds Pydantic request/response models.
- **Providers behind interfaces** in `integrations/base.py` (Protocols): `STTProvider`, `TTSProvider`, `LLMProvider`, `TelephonyProvider`, `PushProvider`, `StorageProvider`, plus `integrations/stub/` implementations. A factory chooses the real or stub provider from settings, so the app and tests run with no external accounts.
- **Masking choke point:** `integrations/masking.py` is the only path by which text reaches an external service (LLM, STT, push). It replaces names/phone numbers with tokens before sending and restores them after. Senior names/phones exist only in `senior_contacts`; never put them in prompts, logs, push bodies or memory items.
- **Auth/authz:** JWT access tokens (short-lived) with role claim. Dependencies in `core/deps.py`: `get_current_user`, `require_role(...)`. Scope helpers in services, not routers: a coordinator sees only seniors where `seniors.coordinator_id = user.id`; ops sees seniors by `users.city` / `team_id` (admin sees all); a senior sees only their own data; family sees only linked seniors and only what their consent level allows. Every read of a senior's data by staff/family writes `audit_log` (no PII in `detail`).
- **Errors:** consistent JSON `{ "error": {"code": "...", "message": "..."} }` via handlers in `core/exceptions.py`; 401/403/404/422 used correctly.
- **Time:** stored as `timestamptz` (UTC); dataset times were loaded as `Asia/Kolkata`. API returns ISO 8601 with offset.
- **CORS:** enable for the web dashboard origin(s) and development; mobile apps do not need it.
- **Pagination:** `limit`/`offset` with sane maxima on every list endpoint.
- **Safety text rule:** any generated text shown to seniors or family must never state or imply a diagnosis or change medication. Add a post-generation guard (blocklist/regex plus prompt rule) in one function used by all generators.

## 4. API contract (v1, prefix `/api/v1`)

Build these, document them in OpenAPI with examples, and keep field names stable. Response shapes should be minimal and explicit.

### 4.1 Auth
- `POST /auth/login` (email + password) → access token, user, role. Staff and demo family accounts.
- `POST /auth/refresh`, `POST /auth/logout` (optional for v1; keep simple).
- `POST /auth/senior/pair` (coordinator-issued one-time pairing code → senior device token) and `POST /auth/senior/login` (senior id + device token → access token). Seniors have no password; keep this to a simple code exchange suitable for a demo.
- `GET /auth/me`.
- `POST /devices` (register push token: platform, token), `DELETE /devices/{id}`.

### 4.2 Coordinator app
- `GET /coordinators/me/today?date=` → the ranked list: latest `priority_lists` revision for the date with items (`rank`, `previous_rank`, `senior` summary, `risk_score`, `risk_level`, `reasons[]` plain language, `suggested_action`, `alert_id`, `ai_call_done`). This is the brief's headline output.
- `GET /coordinators/me/seniors` (caseload, filter/sort).
- `GET /seniors/{id}` (profile without contact PII unless needed for calling, conditions, health profile, baseline, consent level), `/seniors/{id}/risk-history`, `/vitals`, `/medications` (schedules + adherence), `/activity`, `/calls`, `/messages`, `/cues`, `/memory` (open agent memory items), `/family-interactions`.
- `GET /alerts` (own seniors; filters status/severity), `GET /alerts/{id}`, `POST /alerts/{id}/acknowledge`, `/escalate`, `/resolve` (each writes `alert_events`), `POST /alerts/{id}/feedback` (useful bool, outcome, comment).
- `POST /calls/connect` {senior_id} → starts an Exotel click-to-call (coordinator's phone first, then the senior), creates a `calls` row, returns call id/status. `GET /calls/{id}` (status, transcript turns, summary, cues).
- `GET/POST /seniors/{id}/messages` (text now; voice-note upload via multipart), `POST /messages/{id}/read`.
- `GET /notifications`, `POST /notifications/{id}/read`.

### 4.3 Senior app
- `GET /me/home` → today's medications (with taken state), pending reminders, last coordinator message, next check-in.
- `POST /me/medications/{medication_id}/confirm` (writes `medication_events`, source `senior_app_confirmation`).
- `POST /me/vitals` (optional self-report: type, value, unit; source `senior_app`) and `POST /me/report` (free-text how-I-feel → a `checkins` row with channel `app_checkin`, cues extracted).
- `POST /me/messages` (text or voice note to coordinator), `GET /me/messages`.
- `POST /me/call-coordinator` → same as `/calls/connect` from the senior side.
- `WS /ws/voice-agent` (see section 6).
- `GET /me/notifications`.

### 4.4 Ops dashboard
All scoped by the caller's city/team (admin sees all); backed by the `v_ops_*` views plus joins:
- `GET /ops/overview?from=&to=&city=` (KPIs: open alerts, alert volume, median time to acknowledge/resolve, share marked useful, AI-call completion, coverage).
- `GET /ops/alerts/volume`, `/ops/alerts/response-times`, `/ops/alerts/outcomes`, `/ops/alerts/precision`.
- `GET /ops/coordinators` (caseload, activity from `v_ops_coordinator_activity`, alerts handled, open-alert backlog), `GET /ops/coordinators/{id}`.
- `GET /ops/seniors` (all senior details with filters: city, risk level, coordinator, consent level), `GET /ops/seniors/{id}` (same detail as coordinator view, audit-logged).
- `GET /ops/cities` (rollups). `GET /ops/reports/daily?date=` (the daily report: ranked list across the team).
- Admin only: `POST /admin/jobs/{name}/run?date=` to trigger jobs on demand for the demo (nightly scoring, priority build, reminders, family summaries).

### 4.5 Family (no app; staff-triggered/system)
- `GET /seniors/{id}/family-summary?week=` (staff view of the generated summary) and a job that generates and "sends" weekly summaries via a `MessageProvider` (stub logs for v1). Obey consent level: `full` = summary + urgent + details, `summary_and_urgent` = summary + urgent, `urgent_only` = urgent only. Urgent alert notifications to family use the same gate. A demo-only family login (`family.f0001@…`) may read their senior's allowed summary via `GET /family/me/summary`.

### 4.6 Webhooks and system
- `POST /webhooks/exotel/call-status` (JSON; Exotel `StatusCallback`). Authenticate it: shared secret in the URL/header you register with Exotel, reject others. Match by `provider_call_sid`, update the `calls` row, then enqueue recording processing.
- `GET /health` (exists), `GET /health/db` (checks DB connectivity, no secrets).

## 5. Risk, priority list and alert logic

The real risk model is the teammate's work and is not ready. Do **not** build ML here. Build the plumbing behind an interface so the model can be dropped in:

- `modules/risk`: `RiskScorer` protocol: `score(senior_id, date) -> DailyRiskScore fields` (score 0-100, level LOW/MODERATE/HIGH/URGENT_REVIEW, `top_factors` list of `{rule_id, category, evidence, window, points_contributed, is_safety_tripwire}` matching the old engine's shape, `recommended_action`, `data_quality_flags`, `scoring_version`).
- Provide a clearly labelled **`HeuristicScorer`** (`scoring_version="heuristic-0"`) so the frontend and demo work now: points for missed/unverified critical medication doses, vitals outside the senior's own baseline (median ± k×IQR from `senior_baselines`), sleep/steps drops vs baseline, negative cues (pain, low_mood, loneliness, weakness, poor_sleep, low_appetite, fall) in the last 3-7 days, `urgency_flag` calls/voice notes, missed check-in calls, and a safety tripwire for falls (accelerometer `label=fall`) and severe vitals. Output plain-language `evidence` strings. Replace or wrap it when the teammate's model arrives; keep the same output contract.
- `jobs/nightly_scoring`: for a given date, score all seniors, upsert `daily_risk_scores`, create/update `alerts` (dedupe: one open alert per senior until resolved; severity from level; `triggering_signals` = the plain-language evidence list; write `alert_events`), then build `priority_lists` revision 1 (`morning_build`) per coordinator.
- **Re-rank after the AI call:** when an `ai_agent` call finishes (and its cues are saved), re-score that senior for the day, update the alert if needed, and write a new `priority_lists` revision (`post_ai_call`) with `previous_rank` set and `ai_call_done=true` for that senior. A new alert creates a `new_alert` revision. The coordinator endpoint always returns the highest revision for the date.
- Alert rules: avoid alert fatigue (cooldown/dedupe, escalate only on severity increase), every alert carries reasons and a suggested next step (call, visit, doctor, medicine review), never a diagnosis.
- Coordinator feedback (`alert_feedback`) feeds `v_ops_alert_precision`; leave a hook for later threshold tuning, do not build the learning loop in v1.

## 6. Voice agent (AI wellbeing call inside the senior app)

- **Transport:** `WS /ws/voice-agent?token=…`. Protocol (document it for the teammate): client sends `{type:"start", language}` then audio chunks (binary frames) and `{type:"end_utterance"}`; server replies with `{type:"transcript", text}` (optional), `{type:"agent_text", text}` and binary audio frames or `{type:"agent_audio", url|base64}`, then `{type:"turn_done"}`; `{type:"call_end", summary}` at the end. Keep it request/response per turn (record clip → STT → LLM → TTS) rather than true streaming; expect a short pause per turn.
- **Per turn:** STT (Bhashini) → mask → LLM (Claude on Bedrock) → TTS (Bhashini). 3-4 wellbeing questions per call, Hindi/Hinglish, warm and simple.
- **Memory (`senior_memory_items`):** at call start `context_builder` loads: last call summary, open memory items, today's risk factors, missed medicines, recent vitals, hobbies/background from `senior_health_profile`. Store exactly what was sent in `calls.context_snapshot`. At call end `summarizer` writes `calls.summary`, creates/updates/resolves memory items (kinds: symptom, medication_issue, mood, promise, topic; only from what the senior said or system facts; never a diagnosis, never names or phone numbers), saves `call_turns` and `nlp_cues`, then triggers the re-rank (section 5).
- **Cue extraction for new text:** the old regex extractor in `ml/src/features/nlp_extractor.py` is the only extractor in the repo (Hindi/English/Hinglish, negation, historical context). Either wrap it or have the LLM return structured cues validated against the cue vocabulary seen in the data (`loneliness, low_mood, pain, weakness, poor_sleep, low_appetite, fall, …`). Pick one, keep the same `nlp_cues` shape.
- **Providers:** Bhashini (STT/TTS; **verify the current API, auth and language codes in its docs**; `BHASHINI_API_KEY` not yet obtained), Claude via Bedrock (credentials pending; **build and test against the stub LLM first**; a `StubLLM` with scripted replies must make the whole flow demoable). Every provider failure must degrade gracefully (fallback phrase, end call politely, mark `calls.status`).
- **Safety:** system prompt forbids diagnosis, medication advice and reassurance that something is "fine" medically; urgent phrases (fall, chest pain, can't breathe, etc.) must immediately set `urgency_flag`, create/raise an alert, and tell the senior the coordinator will call.

## 7. Phone call recording (senior ↔ coordinator) via Exotel

Verified: Exotel credentials work (read-only call returned 200) on host `api.exotel.com`.
- `TelephonyProvider.connect_call(from_number, to_number, caller_id, record=True, callback_url)`: `POST https://{subdomain}/v1/Accounts/{sid}/Calls/connect` with HTTP Basic auth (key:token), form fields `From`, `To`, `CallerId` (ExoPhone), `Record=true`, `RecordingChannels=dual`, `StatusCallback={PUBLIC_BASE_URL}/api/v1/webhooks/exotel/call-status`, `StatusCallbackContentType=application/json`. Exotel rings `From` first, then dials `To`. Returns `Call.Sid`. Trial accounts may only reach verified numbers and may need KYC for more — check before assuming a call will connect.
- Create the `calls` row (`kind=phone_bridge`, `provider=exotel`, `provider_call_sid`, `recording_consent` recorded) before dialling.
- Webhook payload (JSON) includes `CallSid`, `Status`, `From`, `To`, `Duration`, `RecordingUrl`, `StartTime`, `EndTime`. On completion: download the recording immediately (the link may expire), store in a private bucket (`StorageProvider`), set `recording_path`/`recording_expires_at`, then process in a background task: transcribe each channel with Bhashini (dual channel gives labelled speakers: coordinator vs senior), insert `call_turns`, summarise (masked) into `calls.summary`, extract cues, set `transcript_status`, `processed_at`, re-score the senior, and push a `call_summary_ready` notification to the coordinator.
- Consent: both parties are told the call is recorded; keep `recording_consent` and `consent_at`. Retention: a job deletes audio past `recording_expires_at`; only path/transcript/summary stay in the DB.
- Fallback built first: **voice-note exchange** (`messages`, kind `voice_note`) through the same store → STT → summary → cues pipeline, with no telephony account needed.
- Local testing needs a public URL (the Render deployment, or a tunnel); keep a fake `TelephonyProvider` that simulates the webhook for tests.

## 8. Notifications and reminders

- `PushProvider` (FCM; `firebase-admin`; stub logs to console/DB). `notifications` rows are created first, then sent; update `delivery_status`. **Push text must be generic** (no names, no conditions) because it travels through a third party; put ids in `data` so the app opens the right screen.
- Medication reminder job: from `medication_schedules.scheduled_times` (list of "HH:MM" in IST) for active, non-SOS schedules, create `medication_reminder` notifications for the senior; if a dose stays unconfirmed past a grace period, mark it `missed`/`unknown` per rule and feed the risk inputs. Daily check-in prompt for the AI call per `seniors.checkin_days_of_week` / `checkin_preferred_hour`.
- Coordinator notifications: `alert_new`, `alert_escalated`, `priority_list_updated`, `message_received`, `call_summary_ready`.
- Scheduler: in-process APScheduler is enough for v1 (single Render instance), plus the admin "run job now" endpoint for demos. Make jobs idempotent (safe to run twice for the same date).

## 9. Build order (each phase: working code, tests, OpenAPI visible, advisors clean)

1. **Foundation.** Settings (all env fields, strip trailing slash of `PUBLIC_BASE_URL`, `DEMO_TODAY`), error handlers, logging, CORS, router assembly under `/api/v1`, `GET /health/db`. Split `requirements.txt` (API) from `ml/requirements.txt` (pandas, scikit-learn, faker) so Render builds stay small. Tests scaffolding in `tests/app` (SQLite in-memory via dependency override; models create_all works on SQLite; Postgres-only things such as views are tested against Supabase or skipped).
2. **Auth and authorization.** JWT, `login`, `me`, role/scope dependencies, senior pairing/login, device tokens, audit logging helper. Tests for every scope rule (coordinator cannot see another coordinator's senior; family respects consent level; senior sees only self).
3. **Read APIs for the coordinator app.** Senior detail, vitals, medications/adherence, activity, calls with transcripts, messages, cues, family interactions, caseload. This unblocks the teammate immediately because the data is already seeded.
4. **Risk plumbing + priority list.** `RiskScorer` interface, `HeuristicScorer`, nightly job, alert creation/dedupe, priority list revisions, `GET /coordinators/me/today`, alert actions and feedback. Run the job for the dataset's date range so history exists.
5. **Deploy.** Commit when the user asks, push, set Render env vars and `PYTHON_VERSION`, confirm `/docs` shows the real API, give the teammate the URL and demo logins. Re-run `get_advisors`.
6. **Ops APIs.** Overview, volume, response times, outcomes, precision, coordinator activity, cities, daily report, admin job triggers.
7. **Provider interfaces and stubs.** STT/TTS/LLM/Telephony/Push/Storage protocols, stub implementations, factories, `masking.py` with tests (names and phone numbers never survive into outbound text).
8. **Messages and voice notes.** Text + voice-note upload, storage, STT, summary, cues.
9. **Voice agent.** WebSocket, session, context builder, memory, summariser, safety guard, re-rank trigger. Works end to end with stubs; swap in Bhashini and Bedrock when keys exist.
10. **Exotel calling + webhook + recording pipeline.**
11. **Notifications and reminder jobs.**
12. **Family summaries** (template first; LLM text later through the same safety guard) and delivery stub.
13. **Hardening and deliverables.** Rate limits on auth, input validation, secrets audit, README with run instructions, update `docs` (replace the stale schema spec with a short schema README generated from the models), the 4-page write-up inputs (architecture, models used, how the synthetic data was built, results), dataset and model citations, demo script.

## 10. Testing and verification standards

- `pytest` for new code in `tests/app` (unit tests for services/scorer/masking, API tests with `TestClient`). The research tests run separately: `cd ml && python -m pytest` (59 pass).
- After any DDL: `alembic revision --autogenerate`, read the generated file, `alembic upgrade head`, then `get_advisors` (security and performance). RLS must stay on for every new table, and new tables need a new migration that enables it (the `0002` DO-block only covers tables existing at that time) and revokes API-role privileges.
- Never claim something works without running it. For endpoints, call them against the seeded Supabase data and report real responses (without secrets).
- Keep `seed.py` working (`python -m app.db.seed --reset` reloads everything in about 40 seconds using COPY; it is destructive, so only run it when asked).

## 11. Open items the builder must resolve with the user

- Bhashini API key and the exact STT/TTS endpoints/languages (verify docs).
- Bedrock access (friend's AWS account) and which Claude model id to call.
- Exotel trial limits (verified-number rules, KYC) and which real numbers to use in demos.
- FCM project and credentials; Supabase Storage bucket and retention period.
- When the teammate's risk model lands: its input/output contract versus `RiskScorer`.
- Who triggers a commit/push and when (user only).
