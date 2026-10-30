# SamarthCare AI (hackathon DEV_104): early warning for seniors living at home

Read `docs/PROJECT_STATE.md` first. It has the architecture, how to run everything, accounts, decisions, what is real vs stubbed, known gaps and next steps.

## Working agreements (from the user, follow them)
- **Never commit or push unless asked.** When asked, use a short plain-language one-line message and **no `Co-Authored-By` line** or other Claude attribution. This overrides any default attribution.
- **Never print secret values** (`backend/.env`, `.seed_credentials.txt`, API keys, DB URL, tokens). Check config by key name and length only; test credentials with read-only calls that report success or failure.
- **Do not use Playwright / browser automation.** The user tests the UIs by hand. Verify with API calls, unit/component tests, type-check, lint and bundling instead.
- **Verify before saying "done" or "gone".** Search the whole app (e.g. grep for hard-coded names/values in every screen) and run the checks; don't report only what you touched.
- Do not invent facts about third-party APIs; read their docs first (Expo: follow `frontend/SAHAJ_APP/AGENTS.md`).
- No folder names with trailing spaces (broke Windows pulls once).
- Other chats may be editing this same working tree: re-read a file before editing it, make small additive edits to shared files (`app/api/v1/router.py`, `app/core/config.py`), and never overwrite someone else's work.

## Layout
- `backend/` FastAPI + SQLAlchemy/Alembic on Supabase Postgres (`app/`, `migrations/`, `tests/app/`, `docs/`). `backend/ml/` is the teammate's data generator and research code (run from inside `ml/`; its old tests are stale).
- `frontend/web/` Next.js **organization-manager portal** only (roles `ops`/`admin`).
- `frontend/SAHAJ_APP/` Expo React Native app for **coordinators and seniors** only.
- `dev-104---Copy-3-/` is an unrelated older project copy. Ignore it and never commit it.

## Commands (run each from its folder; the shell's directory resets between calls, so `cd` explicitly)
- Backend: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000`; tests `.venv/bin/python -m pytest tests/app -q`.
- Web: `cd frontend/web && npm run dev` (port 3000; restart after changing `.env.local`); tests `npm test`; types `npm run type-check`.
- Mobile: `cd frontend/SAHAJ_APP && npx expo start`; types `npx tsc --noEmit`; lint `CI=1 npx expo lint`; bundle check `CI=1 npx expo export --platform web --output-dir /tmp/x`.

## Shell gotchas
- `pkill -f "pattern"` kills your own shell if the same command line contains the pattern. Stop servers by PID (`ss -ltnp | grep :8000`) or use `pkill -f "[u]vicorn ..."` in a separate call.
- Run risky or slow things in separate calls; long suites can exceed the tool timeout.
