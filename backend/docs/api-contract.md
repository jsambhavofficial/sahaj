# SamarthCare AI — API Contract (v1)

For the senior app, coordinator app and ops web dashboard. Live OpenAPI (always authoritative for what is built): `https://sahaj-irgo.onrender.com/docs` and `/openapi.json`. Locally: `uvicorn app.main:app` then `http://localhost:8000/docs`.

**Status:** every endpoint below is built and tested against stub providers (no Bhashini, Bedrock, Exotel or FCM account needed). The live OpenAPI at `/docs` is authoritative; section 9 lists where the built API differs from or extends the first draft of this document. Real STT/TTS/LLM/telephony/push providers switch on through env settings and do not change any shape.

## 1. Conventions

| Topic | Rule |
|---|---|
| Base URL | `{host}/api/v1` (health checks are at `{host}/health`, `{host}/health/db`) |
| Auth | `Authorization: Bearer <access_token>` on everything except login, refresh, senior pair/login, health, webhooks |
| Content type | JSON (`application/json`); uploads are `multipart/form-data` |
| IDs | Seniors: text (`S0001`). Alerts: text (`ALT_00001`). Everything else: UUID strings |
| Times | ISO 8601 with offset, e.g. `2026-10-11T16:28:00+05:30`. Dates: `2026-10-11` |
| "Today" | Dataset ends 2026-10-11, so date endpoints take optional `date=YYYY-MM-DD`; when omitted the server uses its demo date (`DEMO_TODAY`). Always send `date` if you want a deterministic screen |
| Pagination | `limit` (default 50, max 200), `offset` (default 0). List responses: `{ "items": [...], "total": 123, "limit": 50, "offset": 0 }` |
| Errors | Always `{ "error": { "code": "...", "message": "...", "details": [...]? } }` |
| CORS | Browser origins in `CORS_ORIGINS` on the server. Tell the backend dev your dashboard origin |

**Error codes:** `unauthorized` / `invalid_credentials` / `invalid_token` / `token_expired` (401), `forbidden` (403), `not_found` (404), `conflict` / `pairing_code_used` (409), `validation_error` (422, `details` = `[{field, message}]`), `rate_limited` (429), `internal_error` (500).

**Token handling:** access token lasts 60 min, refresh token 14 days. On a 401 with `token_expired`, call `/auth/refresh` once, retry, otherwise send the user to login. Senior devices should store the `device_token` securely and re-login with it silently.

### Enums

| Name | Values |
|---|---|
| role | `coordinator`, `senior`, `ops`, `admin`, `family` |
| risk_level | `LOW`, `MODERATE`, `HIGH`, `URGENT_REVIEW` |
| alert status | `OPEN`, `ACKNOWLEDGED`, `ESCALATED`, `RESOLVED` |
| alert severity | `MODERATE`, `HIGH`, `URGENT_REVIEW` |
| feedback outcome | `called`, `visited`, `doctor`, `no_action` |
| language | `hindi`, `hinglish`, `english` |
| consent level (family) | `full`, `summary_and_urgent`, `urgent_only` |
| living arrangement | `alone`, `with_spouse`, `with_domestic_help_or_family` |
| call kind | `ai_agent`, `phone_bridge` |
| call status | `queued`, `in_progress`, `completed`, `abandoned`, `failed`, `declined`, `no_answer`, `busy` |
| transcript_status | `pending`, `done`, `failed`, `not_applicable` |
| speaker | `agent`, `senior`, `coordinator` |
| medication status | `taken`, `missed`, `unknown` |
| vital measurement_type | `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_glucose`, `spo2`, `weight` (plus `heart_rate`, `temperature` where present in data) |
| notification kind | `medication_reminder`, `checkin_prompt`, `alert_new`, `alert_escalated`, `priority_list_updated`, `message_received`, `call_summary_ready` |
| platform | `android`, `ios`, `web` |

### Who can call what

| Area | senior | coordinator | ops | admin | family |
|---|---|---|---|---|---|
| Auth, devices | yes | yes | yes | yes | login only |
| `/me/*` (senior app) | yes | – | – | – | – |
| Coordinator endpoints | – | own caseload | – | yes | – |
| `/ops/*` | – | – | own city (all if no city) | all | – |
| `/family/me/*` | – | – | – | – | linked seniors, per consent |

A coordinator asking for another coordinator's senior gets **403**. Unknown id gets **404**.

---

## 2. Auth and devices (all clients)

### POST `/auth/login` — LIVE
Staff and demo family accounts (seniors do not use this).
```json
// request
{ "email": "coord_001@demo.samarth.local", "password": "…" }
// 200
{ "access_token": "…", "refresh_token": "…", "token_type": "bearer", "expires_in": 3600,
  "user": { "id": "uuid", "role": "coordinator", "display_name": "Care Coordinator 001",
            "email": "coord_001@demo.samarth.local", "external_ref": "COORD_001",
            "city": "Bengaluru", "team_id": "TEAM_BENGALURU" } }
// 401  { "error": { "code": "invalid_credentials", "message": "Incorrect email or password" } }
```
Demo accounts: `coord_001@demo.samarth.local` … (one per coordinator), `ops@demo.samarth.local`, `admin@demo.samarth.local`, `family.f0001@demo.samarth.local` (also f0002, f0003). Password: ask the backend dev (same for all).

### POST `/auth/refresh` — LIVE
`{ "refresh_token": "…" }` → same body as login.

### GET `/auth/me` — LIVE
→ the `user` object above.

### Senior device pairing — LIVE
1. Coordinator app: `POST /auth/senior/pairing-code` with `{ "senior_id": "S0001" }` (coordinator of that senior, or admin) → `{ "pairing_code": "<long signed string>", "expires_in": 900 }`. Show it as a QR code / deep link.
2. Senior app: `POST /auth/senior/pair` with `{ "pairing_code": "…" }` → login body plus `{ "senior_id": "S0001", "device_token": "…" }`. Single use: a second redemption returns 409 `pairing_code_used`. Pairing again replaces the previous device.
3. Later launches: `POST /auth/senior/login` with `{ "senior_id": "S0001", "device_token": "…" }` → login body.

### POST `/devices` — LIVE
Register a push token (FCM). Idempotent.
```json
// request
{ "platform": "android", "token": "<fcm token>", "app_version": "1.0.3" }
// 200
{ "id": "uuid", "platform": "android", "app_version": "1.0.3", "created_at": "…" }
```
### DELETE `/devices/{id}` — LIVE
204. Only your own devices (else 404).

---

## 3. Coordinator app

### GET `/coordinators/me/today?date=` — LIVE (headline screen)
The ranked "who needs attention today" list: the latest priority-list revision for the date.
```json
{
  "date": "2026-10-11", "revision": 3, "reason": "post_ai_call", "generated_at": "…",
  "items": [
    { "rank": 1, "previous_rank": 4,
      "senior": { "senior_id": "S0042", "display_name": "Shanti Khanna", "age": 71, "city": "Bengaluru",
                  "preferred_language": "hinglish" },
      "risk_score": 78, "risk_level": "HIGH",
      "reasons": ["Steps averaged 54% of her baseline for 3 days", "Missed 2 of 3 BP tablets this week"],
      "suggested_action": "Call today and ask about dizziness; consider a visit if she is unsteady.",
      "alert_id": "ALT_00123", "ai_call_done": true }
  ]
}
```
`previous_rank` is null on the first revision; a larger previous than current means "moved up". The list changes after each AI call, so refresh when you receive a `priority_list_updated` push or on pull-to-refresh. Reasons are plain language and never a diagnosis.

### GET `/coordinators/me/seniors` — LIVE
Caseload. Query: `q` (id), `risk_level`, `sort` (`risk`, `name`, `last_contact`), `limit`, `offset`.
Item: `{ senior_id, display_name, age, city, preferred_language, living_arrangement, risk_score, risk_level, open_alert_id, last_contact_at }` (risk fields are for `date`, default demo date).

### Senior detail — LIVE
All require access to that senior (own caseload for coordinators).

| Endpoint | Returns |
|---|---|
| `GET /seniors/{id}` | `{ senior_id, display_name, age, gender, city, living_arrangement, preferred_language, communication_style, family_consent_level, conditions: [{category, condition}], health_profile: {cognitive_status, fall_risk_level, mobility_aid, hobbies:[…], …}, baseline: {…}, contact: {phone} }` (phone only for the senior's coordinator, admin) |
| `GET /seniors/{id}/risk-history?from=&to=` | `[{ date, risk_score, risk_level, top_factors:[{rule_id, category, evidence, window, points_contributed, is_safety_tripwire}], recommended_action, scoring_version }]` |
| `GET /seniors/{id}/vitals?type=&from=&to=` | `[{ measurement_id, measured_at, measurement_type, value, unit, context, source, quality_status }]` |
| `GET /seniors/{id}/medications` | `{ schedules: [{ medication_id, drug_name, dosage, indication, times_per_day, scheduled_times:["08:00"], criticality, is_active }], adherence: { last_7d_pct, last_30d_pct, missed_critical_7d }, recent_events: [{ scheduled_at, status, actual_at, record_source }] }` |
| `GET /seniors/{id}/activity?from=&to=` | `[{ date, steps, active_minutes, sleep_hours, appetite_level, mood_level, social_contact_count, data_available }]` |
| `GET /seniors/{id}/calls` | call list (see call object below, without turns) |
| `GET /seniors/{id}/messages` | message list (see Messages) |
| `GET /seniors/{id}/cues?from=&to=` | `[{ cue_type, cue_value, temporal_context, negated, uncertain, source_type, at }]` |
| `GET /seniors/{id}/memory` | open agent memory: `[{ id, kind, content, status, first_seen_at, last_seen_at, follow_up_after }]` |
| `GET /seniors/{id}/family-interactions` | `[{ interaction_id, at, channel, category, family_message, coordinator_reply_en, counselor_summary, suggested_action, escalation_needed }]` |

Each of these reads is audit-logged on the server.

### Alerts — LIVE
| Endpoint | Notes |
|---|---|
| `GET /alerts?status=&severity=&senior_id=` | own seniors; paginated |
| `GET /alerts/{id}` | alert + `events[]` history |
| `POST /alerts/{id}/acknowledge` | body `{ "note"?: "…" }` |
| `POST /alerts/{id}/escalate` | body `{ "note": "…" }` |
| `POST /alerts/{id}/resolve` | body `{ "resolution_reason": "…", "note"?: "…" }` |
| `POST /alerts/{id}/feedback` | body `{ "useful": true, "outcome": "called", "comment"?: "…" }` |

Alert object:
```json
{ "alert_id": "ALT_00123", "senior_id": "S0042", "status": "OPEN", "severity": "HIGH",
  "created_at": "…", "last_updated_at": "…",
  "triggering_signals": ["Steps averaged 54% of baseline for 3 days"],
  "recommended_next_step": "Call and ask about dizziness",
  "resolution_reason": null, "assigned_to": null,
  "events": [{ "at": "…", "from_status": "OPEN", "to_status": "ACKNOWLEDGED", "actor": "Care Coordinator 001", "note": null }] }
```
Status changes return the updated alert. Invalid transitions (for example resolving an already resolved alert) return 409.

### Calls (coordinator ↔ senior, recorded) — LIVE
`POST /calls/connect` needs a coordinator (own seniors), senior (self) or admin token. Only admin may pass `coordinator_id` or test phone numbers.
```json
// request
{ "senior_id": "S0001", "recording_consent": true, "initiator": "coordinator" }
// 202 (call object)
{ "id": "uuid", "senior_id": "S0001", "kind": "phone_bridge", "status": "queued",
  "transcript_status": "pending", "started_at": null, "ended_at": null, "duration_sec": null,
  "recording_stored": false, "recording_expires_at": null, "summary": null, "urgency_flag": false,
  "turns": [], "cues": [] }
```
`GET /calls/{id}` returns the same object; poll every ~5 s until `status` is terminal and `transcript_status` is `done` or `failed`. When ready the coordinator also gets a `call_summary_ready` push. `turns[]` = `{ turn_index, speaker, text, offset_ms }`; `cues[]` = `{ cue_type, cue_value, temporal_context, negated, uncertain }`. `POST /calls/{id}/process` re-runs transcription (support use). Ringing order: the initiator's phone first, then the other person. `recording_consent: false` is rejected.

### Messages — LIVE
One thread per senior and their coordinator.
- `GET /seniors/{id}/messages?limit=&before=` → `{ items: [Message], … }` newest first.
- `POST /seniors/{id}/messages` — JSON `{ "body": "…" }` for text, or `multipart/form-data` with `audio` (m4a/aac/wav, ≤ 60 s) and optional `language` for a voice note.
- `POST /messages/{id}/read` → 204.

Message: `{ id, senior_id, sender: { user_id, role, display_name }, kind: "text"|"voice_note", body, audio_url?, transcript?, summary?, language, created_at, delivered_at, read_at }`. For voice notes `transcript` and `summary` fill in a few seconds after upload; `audio_url` is a short-lived signed URL.

### Notifications — LIVE
- `GET /notifications?unread=true` → `{ items: [{ id, kind, title, body, data, scheduled_for, sent_at, read_at }] }`
- `POST /notifications/{id}/read` → 204.

Push payloads are generic text (no names or conditions); open the right screen from `data`, e.g. `{ "alert_id": "ALT_00123" }`, `{ "call_id": "uuid" }`, `{ "senior_id": "S0042" }`, `{ "date": "2026-10-11" }`.

---

## 4. Senior app

All `/me/*` are senior-token only and always refer to the signed-in senior.

### GET `/me/home` — LIVE
```json
{ "greeting_name": "Shanti ji", "language": "hinglish", "date": "2026-10-11",
  "medications_today": [{ "medication_id": "MED_S0001_01", "drug_name": "Amlodipine", "dosage": "5 mg",
                          "scheduled_at": "2026-10-11T08:00:00+05:30", "status": "taken|missed|unknown|pending" }],
  "last_message": { "…": "Message object or null" },
  "next_checkin": { "at": "2026-10-11T16:00:00+05:30", "kind": "ai_call" } }
```
### POST `/me/medications/{medication_id}/confirm` — LIVE
Body `{ "scheduled_at": "…" }` → 200 `{ "status": "taken", "actual_at": "…" }`. Recorded as source `senior_app_confirmation`.
### POST `/me/vitals` — LIVE (optional)
`{ "measurement_type": "blood_pressure_systolic", "value": 130, "unit": "mmHg", "measured_at"?: "…" }` → 201.
### POST `/me/report` — LIVE
Free-text "how are you feeling": `{ "text": "…", "language"?: "hindi" }` → 201 `{ "checkin_id": "uuid" }`. Backend extracts cues; no diagnosis is returned.
### Messages with the coordinator — LIVE
`GET /me/messages`, `POST /me/messages` (same body/multipart rules as the coordinator side), `POST /messages/{id}/read`.
### POST `/me/call-coordinator` — LIVE
Same behaviour and response as `POST /calls/connect` with `initiator: "senior"` and the senior inferred from the token. Body `{ "recording_consent": true }`. The app must show the "this call is recorded" notice before sending.
### GET `/me/notifications` — LIVE
Same shape as coordinator notifications.

### WebSocket `WS /ws/voice-agent?token=<access_token>` — LIVE
AI wellbeing call in Hindi/Hinglish. One turn = record a clip, send it, play the reply. Expect a short pause per turn.

Client → server:
- `{"type":"start","language":"hinglish"}` (JSON text frame)
- binary frames: audio clip for the current utterance (16 kHz mono WAV or the format agreed with the backend dev)
- `{"type":"end_utterance"}`
- `{"type":"end_call"}` (user hangs up)

Server → client:
- `{"type":"ready","call_id":"uuid"}` after `start`
- `{"type":"transcript","text":"…"}` what the senior said (optional to display)
- `{"type":"agent_text","text":"…"}` the agent's reply text
- `{"type":"agent_audio","format":"wav","base64":"…"}` or binary audio frames, then `{"type":"turn_done"}`
- `{"type":"call_end","call_id":"uuid","summary":"…"}`
- `{"type":"error","code":"…","message":"…"}` — on provider failure the agent says a polite fallback phrase and ends the call; the app should show a retry option.

---

## 5. Ops web dashboard

Roles `ops` (own city; all cities if the account has none) and `admin` (all). All ranges: `from`/`to` dates, optional `city`, `coordinator_id`.

| Endpoint | Returns | Status |
|---|---|---|
| `GET /ops/overview` | `{ open_alerts, alerts_in_range, median_minutes_to_ack, median_minutes_to_resolve, useful_share, ai_call_completion_rate, seniors_covered, seniors_total }` | LIVE |
| `GET /ops/alerts/volume` | `[{ day, city, severity, status, alerts }]` | LIVE |
| `GET /ops/alerts/response-times` | `[{ alert_id, city, coordinator_id, severity, created_at, minutes_to_ack, minutes_to_resolve }]` | LIVE |
| `GET /ops/alerts/outcomes` | `[{ city, resolution_reason, useful, outcome, alerts }]` | LIVE |
| `GET /ops/alerts/precision` | `[{ city, week_start, rated_alerts, useful_alerts, precision }]` | LIVE |
| `GET /ops/coordinators` | `[{ coordinator_id, display_name, city, caseload, open_alerts, alerts_handled, calls, messages_sent }]` | LIVE |
| `GET /ops/coordinators/{id}` | coordinator detail with daily activity series | LIVE |
| `GET /ops/seniors?city=&risk_level=&coordinator_id=&consent_level=&q=` | paginated senior rows (same fields as the caseload item plus coordinator and city) | LIVE |
| `GET /ops/seniors/{id}` | same detail as `GET /seniors/{id}` (audit-logged) | LIVE |
| `GET /ops/cities` | `[{ city, seniors, coordinators, open_alerts, avg_risk, high_risk_count }]` | LIVE |
| `GET /ops/reports/daily?date=` | team-wide ranked list: `[{ coordinator, items: [priority item] }]` | LIVE |
| `POST /admin/jobs/{name}/run?date=` | admin only. `name`: `nightly_scoring`, `priority_build`, `reminders`, `family_summaries`. → `{ "job": "...", "date": "...", "status": "ok" }` | LIVE |

Note: `useful_share` / `precision` are `null` until coordinators have rated alerts. Charts should handle empty series. Risk scores and alerts come from the nightly job; the dataset window has been backfilled, but any date outside 2026-07-06 to 2026-10-11 will be empty until the job runs for it.

---

## 6. Family (no app in v1)

- `GET /family/me/summary?week=` — LIVE. Demo family login only. Returns the weekly summary for the linked senior, filtered by consent level: `full` = summary and details, `summary_and_urgent` = summary, `urgent_only` = 403 (urgent alerts go out by SMS/WhatsApp, not here). `{ senior_id, week_start, language, body_text, generated_by }`.
- `GET /seniors/{id}/family-summary?week=` — LIVE. Staff view of the same.

---

## 7. System

| Endpoint | Notes |
|---|---|
| `GET /health` | LIVE. `{ "status": "healthy", "environment": "…" }` |
| `GET /health/db` | LIVE. `{ "status": "healthy", "database": "ok" }` or 503 |
| `POST /api/v1/webhooks/exotel/call-status` | Called by Exotel only (not by apps). Secret-gated |

---

## 8. Demo data and dates

- Seeded cohort: 250 seniors, 125 coordinators, 7,000 calls with transcripts, vitals, medications, activity. Risk scores, alerts and priority lists are generated by the nightly job (heuristic scorer `heuristic-0`) for the dataset window 2026-07-06 to 2026-10-11; always pass `date=2026-10-11` (or set `DEMO_TODAY`) for a populated "today".
- Seeded senior phone numbers are deliberately invalid. Real calling needs a tester number set on a demo senior and coordinator.
- Pending integrations: Bhashini (STT/TTS), Bedrock (LLM), FCM (push), Exotel trial limits. Until configured, the voice agent uses a scripted Hindi/Hinglish dialogue, summaries are labelled stub text, and pushes are recorded but not delivered.

## 9. Differences from the first draft of this contract

- **Senior reads:** `vitals`, `activity`, `risk-history`, `cues`, `memory`, `family-interactions` return plain arrays (optional `limit`); `/calls` and `/coordinators/me/seniors` use the `{items,total,limit,offset}` envelope. Seniors may read only their own detail, vitals, medications and activity.
- **Messages:** `audio_url` points at the authenticated `GET /messages/{id}/audio` (send the Bearer token) instead of a signed URL. Messages also carry `duration_sec` and `urgency_flag` (null for senior viewers; `summary` is hidden from seniors). `POST /seniors/{id}/messages` returns 201 and also accepts `before` for paging. Voice notes: m4a/aac/wav, up to 2 MB (413 `payload_too_large`).
- **Senior app:** `greeting_name` is "Shanti ji" style for hindi/hinglish seniors. A dose shows `pending` for 3 hours after its time, then `unknown`. `POST /me/call-coordinator` exists and requires `recording_consent: true`.
- **Calls:** a senior can see call status but never the transcript, summary or cues. `POST /calls/{id}/process` is for coordinators/admin.
- **Alerts:** alerts are created at risk score 50+ or on a safety tripwire; MODERATE scores appear on the priority list but raise no alert. `acknowledge` is allowed from OPEN or ESCALATED. A resolved alert suppresses a new one for 48 hours unless severity rises. Feedback sent twice for the same alert updates the first (201).
- **Today list:** admin must pass `coordinator_id` (422 otherwise). If no list exists for the date, revision 1 is built on the fly.
- **Ops:** `useful_share` and `precision` are fractions 0 to 1 and `null` with no data. `/ops/seniors` items add `coordinator_name`; `/ops/seniors` and `/ops/cities` accept `date`; `/ops/coordinators/{id}` returns the summary row plus `daily[]`.
- **Family and notifications:** `GET /notifications` lists only rows whose time has passed. The staff family-summary GET returns 404 until the job (or `POST /admin/jobs/family_summaries/run`) has generated one. `GET /family/me/summary` needs `senior_id` when the family user is linked to several seniors; the stricter of the senior's and the link's consent level applies.
- **Rate limits:** login, refresh, senior pair and senior login allow 20 requests per minute per IP, then 429 `rate_limited`.
- **Voice agent WebSocket:** closes with code 4401 on a bad token. Silence is re-asked twice and an idle socket closes after 180 s. Urgent phrases (chest pain, breathlessness, fainting, a fall) get an immediate "your coordinator will call you" reply and end the call as completed.
