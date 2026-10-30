# SamarthCare AI backend

FastAPI + SQLAlchemy 2 + Postgres (Supabase). Detects gradual decline in seniors living at home and tells a care coordinator who needs attention today, why, and what to do next. Not a diagnosis tool.

- API contract for app and web teams: `docs/api-contract.md` (live OpenAPI at `/docs`)
- Product and architecture: `docs/system-overview.md`; build plan: `docs/backend-build-plan.md`
- Database: `docs/database-schema.md` (generated from the models)

## Run locally

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env        # fill DATABASE_URL (postgresql+psycopg://...) and JWT_SECRET
alembic upgrade head        # creates tables, RLS and ops views
python -m app.db.seed       # loads the synthetic cohort (--reset wipes first; destructive)
uvicorn app.main:app --reload
```
Demo logins are written to `.seed_credentials.txt` (gitignored) by the seed script. The seed is the only thing that needs pandas; the API itself runs from `requirements.txt`.

Dates: the dataset ends 2026-10-11. Set `DEMO_TODAY=2026-10-11` to make "today" endpoints show data.

Score history for the dataset window (about 30 s per day against a remote database):
```bash
python -m app.jobs.backfill --from 2026-07-06 --to 2026-10-11 --lists-from 2026-09-28
```

## Tests
```bash
pytest                       # API tests, in-memory SQLite, stub providers, no accounts
cd ml && python -m pytest    # research code
```

## Layout
```
app/
  api/            router assembly (/api/v1) and health checks
  core/           settings, database, security (scrypt + JWT), errors, rate limit, safety guard
  db/             Base, models import point, seed, schema doc generator
  integrations/   provider interfaces + stubs, Exotel, Bhashini, storage, masking (only path to external services)
  jobs/           nightly scoring, priority lists, reminders, weekly family summaries, scheduler, backfill
  modules/<name>/ router -> service -> repository -> models (auth, seniors, vitals, medications, checkins,
                  risk, alerts, coordinators, calls, messages, me, voice, notifications, family, ops)
migrations/       Alembic (0001 tables, 0002 RLS + API-role lockdown + ops views)
ml/               data generator and the research risk engine (separate requirements)
```

Rules: routers do HTTP only, services decide authorization and business rules, repositories hold queries. Seniors' names and phone numbers live only in `senior_contacts` and never reach prompts, logs or push text (masking). Generated text shown to seniors or family passes `app/core/safety.py` (no diagnosis, no medication advice).

## Configuration (environment)
Names only; see `.env.example`. `DATABASE_URL`, `JWT_SECRET` (required; production refuses the default), `ENVIRONMENT`, `CORS_ORIGINS`, `DEMO_TODAY`, `PUBLIC_BASE_URL` (webhooks), `EXOTEL_*`, `BHASHINI_*`, `AWS_*`/`BEDROCK_MODEL_ID`, `SUPABASE_URL`/`SUPABASE_SERVICE_KEY`/`STORAGE_BUCKET`, `FCM_CREDENTIALS_JSON`, `SCHEDULER_ENABLED`. Provider switches `STT_PROVIDER`, `TTS_PROVIDER`, `LLM_PROVIDER`, `TELEPHONY_PROVIDER`, `PUSH_PROVIDER`, `STORAGE_PROVIDER` default to `stub` so everything runs with no accounts.

## Deploy (Render)
Root Directory `backend`; build `pip install -r requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set every variable above in the Render dashboard (it does not read `.env`), `ENVIRONMENT=production`, a long random `JWT_SECRET`, `SCHEDULER_ENABLED=true` for one instance, and `PUBLIC_BASE_URL` to the service URL. Run `alembic upgrade head` against the production database before the first deploy.

## Database changes
Edit models, `alembic revision --autogenerate -m "..."`, read the file, `alembic upgrade head`. New tables need RLS enabled and API-role privileges revoked in their own migration (the 0002 block only covers tables that existed then). Regenerate the schema doc with `python -m app.db.schema_doc > docs/database-schema.md`.

## Known limits
The risk scorer is a labelled heuristic (`heuristic-0`) behind the `RiskScorer` interface; the research team's model drops in via `risk_scorer`. Bhashini, Bedrock and FCM run as stubs until credentials exist. Cue extraction is the rule-based Hindi/English/Hinglish extractor; the seeded `nlp_cues` come from the dataset's own annotations, not from measured NLP accuracy.
