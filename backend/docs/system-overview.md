# SamarthCare AI — System Overview and Product Plan

Hackathon brief: DEV_104, "Early Warning for Seniors Living at Home" (Samarth Life Management). Last updated: 2026-10-29.

This is the single reference for what we are building: three clients (senior app, coordinator app, ops web dashboard) on one FastAPI backend. Companion docs: the database design in `docs/superpowers/specs/2026-10-29-database-schema-design.md` (v1.1, includes calls, messages, priority lists, device tokens, notifications and the ops views) and the earlier research work in `ml/docs/`.

---

## 1. The goal

Detect gradual health and wellbeing decline in seniors living at home, and tell a Care Coordinator **who needs attention today, why, and what to do next**.

Brief constraints that shape every decision:
- Not a diagnosis tool: it flags risk and routes to a human. It never tells a senior or family they have a condition.
- Low-tech seniors: voice and simple interactions, Hindi and English.
- Alert fatigue: precision matters as much as recall.
- Privacy: role-based access, family consent, no personal data to external services without masking.
- Low cost: runs on modest cloud resources and stays affordable at 10,000+ seniors.

## 2. Users and clients

| User | Client | What they need |
|---|---|---|
| Senior | Mobile app | Simple ways to share how they feel; reminders; reach the coordinator |
| Care Coordinator | Mobile app | Ranked daily list with reason and suggested action; calling; alerts |
| Operations manager | Web dashboard | Alert volumes, response times, outcomes across a city or team; all senior details and reports; coordinator activity |
| Family member | No app in v1 | Weekly summary and urgent alerts by SMS/WhatsApp, only with the senior's consent |

Only **seniors** and **coordinators** log in to the mobile app. Ops managers use the web dashboard. All three clients use the same FastAPI backend with role-based access.

## 3. Senior mobile app

1. **Call the coordinator.** The call is recorded; the recording reaches the backend, is transcribed, summarised, and used for insights (see section 6).
2. **Send a text or voice note** to the coordinator (transcribed and summarised).
3. **Medication reminders.** Push notification at each scheduled dose; the senior confirms "taken". Confirmations are stored as medication events with source `senior_app_confirmation`.
4. **Optional self-report.** The senior can enter vitals (BP, sugar, SpO2, weight) or other details if they want to.
5. **AI voice agent.** A scheduled daily wellbeing call, in Hindi or English, inside the app (section 5).

Limitation to state honestly in the write-up: many seniors use basic phones and no apps. The phone-call path (coordinator calls and the telephony bridge) is the fallback for them.

## 4. Coordinator mobile app

1. **Daily priority list.** The ranked list of seniors from the brief: for each, the reason (plain language) and a suggested action. This is the "daily report" the brief asks for.
2. **Re-ranking after the AI call.** The list is built in the morning. After each senior's daily AI call finishes, that senior is re-scored and the list is updated (a new revision of the same day's list).
3. **Calling.** Same call system as the senior side; every call is recorded, transcribed and summarised into an insight on that senior.
4. **Alerts.** Acknowledge, escalate or resolve an alert, and mark it useful or not (this feedback is the model-improvement loop from the brief's stretch goals).
5. **Senior detail.** History, vitals, medication adherence, recent notes, and the AI agent's memory of open concerns.
6. **Push notifications** for new or escalated alerts.

## 5. AI voice agent

- Lives inside the senior app; audio streams to the backend over a WebSocket.
- Each turn: **STT** (speech to text) -> **LLM** (decides the reply) -> **TTS** (text to speech), 3-4 wellbeing questions per call.
- **Memory:** the agent starts each call with context from before (last call summary, open concerns, today's risk factors, missed medicines, recent vitals). At the end it writes a summary, updates the memory items, and saves extracted cues. Open concerns, not whole transcripts, are what carry over.
- **Providers (all behind interfaces so they can be swapped or stubbed):**
  - STT and TTS: Bhashini (Indian languages, free to register).
  - LLM: Claude on AWS Bedrock (access via a friend's account, pending; stub until it arrives).
- **Safety:** names and phone numbers are masked before anything leaves the backend. The agent never states or implies a diagnosis.
- After a call ends, the senior is re-scored and the coordinator's priority list gets a new revision.

## 6. Recording phone calls (senior <-> coordinator)

We do not need an in-app VoIP call. We need the recording of a normal call to reach the backend.

Chosen approach: **Exotel click-to-call** (credentials already tested and working; account on the `api.exotel.com` host).

Flow:
1. The app asks the backend to call.
2. The backend calls Exotel `POST /v1/Accounts/{sid}/Calls/connect` with `From`, `To`, `CallerId` (our ExoPhone), `Record=true`, `RecordingChannels=dual`, `StatusCallback`, `StatusCallbackContentType=application/json`.
3. Exotel rings both phones and joins them. Both talk on their normal dialer and see the ExoPhone number.
4. When the call ends Exotel posts to our webhook with `CallSid`, `Status`, `Duration`, `StartTime`, `EndTime`, `RecordingUrl`.
5. The backend downloads the recording immediately (the URL may expire) into a private storage bucket, transcribes each channel with Bhashini (dual channel gives a labelled transcript without speaker separation), summarises it with the LLM (masked), stores cues, re-scores the senior, and updates the priority list.

Requirements and risks:
- Needs a **public webhook URL** (tunnel in development, deployed URL later). `PUBLIC_BASE_URL` currently points at localhost and must change.
- Trial accounts may restrict calls to verified numbers; KYC may be needed for a full account.
- **Consent:** both parties are told the call is recorded. Audio is kept in a private bucket with an expiry; the database stores the path, transcript and summary only.
- Fallback built first: **voice-note exchange** (no live call, no telephony account), which exercises the same store -> transcribe -> summarise -> score pipeline.
- Rejected: on-device call recording (impossible on iPhone, unreliable and policy-restricted on Android) and in-app VoIP/WebRTC (too much mobile work for the value).

## 7. Notifications

Push notifications (FCM) for both apps:
- Senior: medication reminders, daily check-in prompt, replies from the coordinator.
- Coordinator: new or escalated alerts, updated priority list, messages.

Backend needs `device_tokens` (user, platform, token) and `notifications` (what was sent to whom, read state), plus scheduled jobs for reminders.

## 8. Ops web dashboard

For the operations manager, scoped by city or team:
- Alert volumes over time, by severity and city.
- Response times: alert created -> acknowledged -> resolved (from alert history).
- Outcomes: resolution reasons and coordinator feedback (useful or not, and what action followed).
- Coordinator activity: calls, messages, alerts handled, caseload.
- All senior details and reports (with role-based access and audit logging).
- Model health: precision of alerts as marked by coordinators; false-alarm trend.

Backend: `ops` role, `/ops/*` endpoints and SQL views for the aggregates.

## 9. Backend architecture

- **Stack:** FastAPI (REST plus WebSocket), SQLAlchemy 2 and Alembic, Postgres on Supabase (session pooler), JWT auth with roles, Docker. Hosting: one container on a simple host (Render or Railway), with an ngrok/Cloudflare tunnel as the demo fallback. Modest and cheap by design.
- **Layout:** `backend/app/` with feature modules (router, service, repository, models, schemas each), `core/` plumbing, `integrations/` for providers behind interfaces (Bhashini, Bedrock, Exotel, stubs, a masking choke point), `jobs/` for scheduled work. The earlier data generation and risk engine live in `backend/ml/` and are reused by the risk module.
- **Providers behind interfaces:** STT, TTS, LLM, telephony. Stubs for development and tests.
- **Data:** the synthetic cohort (200 seniors, 90 days) is loaded by a seed script. Ground-truth files stay in `ml/data` for evaluation only and are never exposed through the API.
- **Privacy:** direct identifiers only in `senior_contacts`; Row Level Security on every table with no policies (only the backend reads); audit log; no raw audio in the database.

## 10. Risk engine (reused from the earlier work)

- Personalised daily risk score 0-100 from the senior's own baseline, with bands LOW, MODERATE, HIGH, URGENT_REVIEW.
- Rules baseline plus an Isolation Forest anomaly model; independent safety tripwires for falls, very high BP, low SpO2.
- Multilingual (Hindi, Hinglish, English) NLP cue extraction with negation handling.
- Measured on synthetic ground truth: 77 of 100 planted episodes detected, 100% of acute events; median detection delay 3 days; alert precision 21.8% (the number to improve first).
- Known weak spots: mild/intermittent episodes (47.5% recall), and the ML detector currently beats the rules on AUC (0.650 vs 0.604).

## 11. Build order

1. Database: models, first Alembic migration, apply to Supabase, enable RLS, seed the cohort.
2. Auth and roles (coordinator, senior, ops), device tokens.
3. Coordinator priority list endpoint and alert actions (acknowledge, resolve, feedback).
4. Provider interfaces and stubs (STT, TTS, LLM, telephony); masking.
5. Voice agent: session, context builder, memory, summariser, WebSocket.
6. Recording pipeline: voice-note upload first, then Exotel click-to-call and webhook.
7. Notifications and medication reminder jobs.
8. Ops endpoints and views.
9. Precision and ML improvements; evaluation numbers for the write-up.
10. README, 4-page write-up, dataset and model citations, demo script.

## 12. Open questions

- Who builds the mobile apps and the ops web dashboard, and with what stack?
- Family weekly summary: template first, LLM later? Delivery by SMS or WhatsApp?
- Audio storage: Supabase Storage bucket and retention period.
- Whether the Exotel trial allows calls to the demo numbers, and whether KYC is needed.
- Bedrock access timing (stub until then).
- Public URL for webhooks (tunnel now, hosted later).
