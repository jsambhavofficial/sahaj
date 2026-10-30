# Project state (SamarthCare AI)

Written 2026-10-30 so a fresh session can continue. The brief is the hackathon problem statement DEV_104 (Samarth Life Management): detect gradual decline in seniors living at home and tell a Care Coordinator who needs attention today, why, and what to do next. It must not diagnose, must work for low-tech Hindi-speaking seniors, avoid alert fatigue, protect privacy and stay cheap.

Working agreements and shell gotchas are in the root `CLAUDE.md`. Backend contract: `backend/docs/api-contract.md`. Schema: `backend/docs/database-schema.md`. `backend/docs/system-overview.md` and `backend-build-plan.md` are the original plan (partly historical).

## 1. What exists

| Part | Where | Who uses it | State |
|---|---|---|---|
| API | `backend/app` (FastAPI, ~60 operations + a voice WebSocket) | all clients | Built and tested (338 tests in `tests/app`) |
| Database | Supabase Postgres (project ref `whxutovolxcipdxugvhg`), Alembic head `0003` | the API only | 29 tables + 5 `v_ops_*` views, Row Level Security on, API roles revoked |
| Web portal | `frontend/web` (Next.js) | organization managers (`ops`, `admin`) | Overview, Seniors (+detail), Alerts, Coordinators, Reports on live `/ops` data. 118 tests. |
| Mobile app | `frontend/SAHAJ_APP` (Expo) | coordinators and seniors | Real sign-in and real data on every screen. Not run on a device yet. |
| Research code | `backend/ml` | teammate (Suhani) | Dataset generator and an older risk engine; its tests are stale |

Data is a synthetic cohort: 250 seniors, 125 coordinators, observation window about 2026-07-06 to 2026-10-11. The backend setting `DEMO_TODAY=2026-10-11` makes that last day "today". Ground-truth files live in `backend/ml/data/evaluation` and must never be loaded into the DB or exposed.

## 2. Run it

Each from its own folder (use `cd` explicitly). Secrets live in `backend/.env` (gitignored; names are listed in `backend/.env.example`).

- Backend: `cd backend && .venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000` (`0.0.0.0` so a phone on the same Wi-Fi can reach it). Docs at `/docs`.
- Web: `cd frontend/web && npm run dev` (port 3000). `.env.local` sets `NEXT_PUBLIC_DATA_SOURCE=live`, `NEXT_PUBLIC_API_BASE_URL`, `NEXT_PUBLIC_DEMO_DATE`. Restart after editing it.
- Mobile: `cd frontend/SAHAJ_APP && npx expo start`. `.env` sets `EXPO_PUBLIC_API_BASE_URL` (the computer's LAN address, e.g. `http://<ip>:8000/api/v1`; Android emulator `10.0.2.2`) and `EXPO_PUBLIC_ENABLE_REAL_CALLS=false`.
- Tests: backend `cd backend && .venv/bin/python -m pytest tests/app -q`; web `cd frontend/web && npm test` (also runs the mobile app's pure-logic tests in `src/tests/mobileApp.test.ts`).
- Seed (destructive, reloads the cohort in about 40 s): `cd backend && .venv/bin/python -m app.db.seed --reset`. Only when asked.
- Migrations: `cd backend && .venv/bin/alembic upgrade head`. New tables need RLS enabled in a new migration. After DDL, run the Supabase advisors (the Supabase MCP is registered for this project).

## 3. Accounts (synthetic data only)

All demo staff accounts share one password, the one on the web login page (also in `backend/.seed_credentials.txt`, gitignored).
- Web (organization manager): `ops@demo.samarth.local`, `admin@demo.samarth.local`, and the user's `adityaalba11@gmail.com` (ops).
- Mobile coordinator: `coord_001@demo.samarth.local` ... one per coordinator, and the user's `adityaalba27@gmail.com` (10 Bengaluru seniors, e.g. Mohan Singh S0094 is urgent).
- Mobile senior: no password. A coordinator makes a one-time pairing code (profile tab), shares it, and the senior pastes it. The code is a ~200-character signed token.
- Family demo logins exist (`family.f0001@...`) but there is no family app.

## 4. Decisions already made

- Web = organization-manager portal only. Coordinators and seniors use the mobile app. The web refuses other roles (`NEXT_PUBLIC_WEB_ROLES`).
- Providers sit behind interfaces and default to stubs. Real: Bhashini speech-to-text and text-to-speech (`STT_PROVIDER=bhashini`, `TTS_PROVIDER=bhashini`, optional `BHASHINI_TTS_MODEL=iitm`). Stub: LLM (Bedrock access still pending), push, storage (local disk; Supabase Storage is coded).
- Phone calls: Exotel is blocked, because it requires business KYC (a shop/Udyam/trade certificate) before outbound API calls. Fallback built instead: `POST /api/v1/calls/import` takes an uploaded recording and runs the same pipeline (store, per-channel transcript, masked summary, cues). In-app calling was chosen as the next step (LiveKit/Agora-style), not built. Mobile calls are simulated unless `EXPO_PUBLIC_ENABLE_REAL_CALLS=true`.
- Privacy: names and phone numbers are masked before text goes to an external service. Audio sent to Bhashini cannot be masked, so use only synthetic or consented voices.
- Risk scoring is a labelled heuristic stand-in (`scoring_version heuristic-0`) behind a `RiskScorer` interface. The real model is the teammate's work.

## 5. Not done / known gaps (be honest about these)

1. Nothing is deployed. Render still serves old code until the work is pushed and its env vars and start command (`uvicorn app.main:app`, root dir `backend`) are set.
2. The ML part of the brief is not wired into the backend: no supervised or anomaly model, no precision/recall/days-early evaluation against the planted declines (brief deliverable 4). Suhani's vital-forecasting models sit in `backend/ml/models/vitals`, unused. Her risk-calculation backend modules (`voice`, `checkins`, `risk` services) were replaced by ours in the working tree; they are intact in commit `be5bf55` and her two test files `backend/tests/test_all_endpoints.py` and `test_risk_calculation.py` cannot run.
3. Real LLM (Bedrock), real push (FCM), real telephony, in-app calling and the AI voice agent in the mobile app are not done. "Record Voice Note", "AI Call" and the dashboard bell are placeholders.
4. Mobile: seniors cannot read their own vitals (no endpoint), so vitals show 0 until entered. Pairing codes are too long to type; short codes need a backend change.
5. `backend/ml` tests: 16 of 59 fail since the dataset was replaced. `ml/README.md` describes the old layout. No 4-page write-up, citations or demo script yet.
6. Managers cannot act on alerts in the web portal (coordinators resolve them in the app). Visit/calendar/document pages from the older design remain in `frontend/web` but are unreachable and have no backend.
7. Several mobile "More" icons are inert.

## 6. Git state when this was written

- Single branch `main`; not pushed. `stash@{0}` holds the pre-merge local work from a conflicted `git stash pop`; it can be dropped once the commit is verified.
- `dev-104---Copy-3-/` is an unrelated project copy that is deliberately not committed.

## 7. Suggested next steps

1. Push and deploy (Render), then point the mobile `.env` and web `.env.local` at the deployed URL.
2. Integrate the teammate's risk model and vital-forecast models into the `RiskScorer` interface and write the evaluation (precision, recall, days early) against `backend/ml/data/evaluation`.
3. Test the mobile app on a device or simulator; fix what looks wrong.
4. Bedrock LLM + the voice agent in the mobile app; short pairing codes; in-app calling.
5. Write-up (4 pages), dataset and model citations, demo script.
