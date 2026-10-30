> **STALE:** written for the old dataset. The SQLAlchemy models and Alembic migrations are the source of truth; see `docs/database-schema.md` (generated). Kept only for design intent.

# SamarthCare AI — Database Schema Design (v1)

Status: draft for review (v1.1: adds phone-call recording, messages, priority lists, push notifications and ops views; see `docs/system-overview.md`). Target: Supabase Postgres 17, accessed only by the FastAPI backend (SQLAlchemy 2 + Alembic).

## 1. Conventions

- **IDs:** dataset-origin entities keep their text IDs (`S0001`, `CHK_000001`, `MED_S0001_01`, `ALT_00001`) so the seed script is a straight load. New entities created by the app (users, calls, turns, memory items, summaries, audit rows) use `uuid` with `gen_random_uuid()`.
- **Time:** `timestamptz` for events, `date` for day-grain rows. All stored in UTC; the dataset's naive timestamps are treated as `Asia/Kolkata` on seed.
- **Enums:** `text` plus a `CHECK` constraint (cheap to extend, no `ALTER TYPE` migrations). Allowed values are listed per column.
- **Flexible payloads:** `jsonb` (top factors, call context snapshot, extracted cues).
- **Row Level Security:** enabled on every table with no policies. The app connects with the database role, which bypasses RLS; the Supabase REST/anon API sees nothing. Access control is enforced in FastAPI.
- **Privacy split:** direct identifiers (name, phone) live only in `senior_contacts`. No other table, prompt, log or LLM payload carries them.
- **Audio:** never stored in Postgres. Recordings and voice notes live in a private Supabase Storage bucket with an expiry; the DB keeps only the path, consent flag, transcript and summary. The AI voice agent stores transcripts only (no audio).
- **Not in the DB:** ground truth (`decline_episodes`, `*_with_ground_truth`, `nlp_annotations`) and derived feature tables (`daily_risk_features`, `daily_master`, `master_dataset`). They stay in `ml/data` and are rebuilt from DB tables when needed.

## 2. Tables

### 2.1 Access and audit

**users**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| role | text | `coordinator`, `family`, `ops`, `admin`, `senior` |
| external_ref | text unique null | dataset id, e.g. `COORD_001` |
| display_name | text | |
| email | text unique null | |
| phone | text null | coordinator's number for click-to-call; senior numbers live in `senior_contacts` |
| password_hash | text null | null for seniors (device token auth) |
| city_id | text null | ops/coordinator scope |
| team_id | text null | ops scope by team |
| is_active | bool default true | |
| created_at | timestamptz | |

**family_links**: family user ↔ senior, with consent.
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| family_user_id | uuid FK users | |
| senior_id | text FK seniors | |
| relationship | text | daughter, son, spouse, daughter_in_law, other |
| consent_given | bool | must be true to see anything |
| consent_at | timestamptz null | |
| unique | (family_user_id, senior_id) | |

**audit_log**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| actor_user_id | uuid FK users null | |
| action | text | `view_senior`, `ack_alert`, `view_family_summary`, ... |
| senior_id | text null | |
| detail | jsonb | no PII |
| at | timestamptz | |

### 2.2 Senior

**seniors** (from `senior_profiles.csv`)
| column | type | notes |
|---|---|---|
| senior_id | text PK | `S0001` |
| age | int | |
| preferred_language | text | `hindi`, `english`, `hinglish` |
| city_id | text | `CITY_CHANDIGARH` |
| location_detail | text null | free-text area, no street address |
| living_arrangement | text | `alone`, `with_spouse`, `with_family` (all in the dataset), plus `with_house_help` (app-only, from the team's requirements) |
| coordinator_id | uuid FK users | |
| user_id | uuid FK users unique null | the senior's own login row (device-token auth); needed so messages and notifications can reference the senior |
| expected_checkin_frequency | text | `daily`, `alternate_days`, `weekly_3x` |
| family_consent | bool | master switch; per-person consent lives on `family_links` |
| cohort_start_date, cohort_end_date | date null | demo cohort window |
| is_active | bool | |
| created_at | timestamptz | |

**senior_contacts** (synthesised by seed; never in dataset)
| column | type | notes |
|---|---|---|
| senior_id | text PK FK seniors | |
| full_name | text | |
| phone | text null | |
| device_token_hash | text null | in-app auth for the senior |

**senior_conditions** (synthesised by seed)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| senior_id | text FK | |
| condition | text | hypertension, diabetes_t2, copd, arthritis, ... |
| since_year | int null | |

**senior_baselines** (from `senior_baselines.csv`, 1:1 with seniors). All the `baseline_*` columns map directly: `bp_systolic`, `bp_diastolic`, `blood_glucose`, `glucose_context`, `spo2`, `weight`, `steps`, `active_minutes`, `sleep_hours`, `appetite_level`, `mood_level`, `med_adherence_tendency`, `checkin_participation_tendency`, plus `updated_at`.

### 2.3 Signals

**vitals** (55,581 rows)
| column | type | notes |
|---|---|---|
| measurement_id | text PK | `M0000001` |
| senior_id | text FK | |
| measured_at | timestamptz | |
| measurement_type | text | `blood_pressure_systolic`, `blood_pressure_diastolic`, `blood_glucose`, `spo2`, `weight` |
| value | numeric | |
| unit | text | |
| context | text null | resting, fasting, post_meal |
| source | text | home_bp_monitor, manual, ... |
| quality_status | text | `valid`, `questionable`, `device_artifact` |
| index | (senior_id, measurement_type, measured_at) | replaces the proposed `(senior_id, timestamp)` PK, which collides when BP and sugar share a timestamp |

**daily_activity** (18,000 rows): PK `(senior_id, date)`; `steps`, `active_minutes`, `sleep_hours`, `appetite_level`, `mood_level`, `social_contact_count`, `activity_source`, `data_available`.

**medication_schedules** (434 rows)
| column | type | notes |
|---|---|---|
| medication_id | text PK | `MED_S0001_01` |
| senior_id | text FK | |
| drug_name | text | synthesised by seed |
| dosage | text | synthesised, e.g. `5 mg` |
| start_date, end_date | date | |
| times_per_day | int | |
| scheduled_times | jsonb | e.g. `["08:00","20:00"]` |
| is_active | bool | |

**medication_events** (52,110 rows): PK `medication_event_id`; `senior_id`, `medication_id` FK, `scheduled_at`, `status` (`taken`, `missed`, `unknown`), `actual_at` null, `record_source` (`smart_pillbox`, `senior_app_confirmation`, `coordinator_call`), `verification_status`. Index `(senior_id, scheduled_at)`.

**activity_events** (phase 2, stretch): derived fall/inactivity events from phone or wearable sensors. Columns: `id`, `senior_id`, `event_type` (`fall_suspected`, `long_inactivity`), `detected_at`, `confidence`, `detail jsonb`. Raw accelerometer samples are intentionally not stored.

### 2.4 Conversations

**checkins** (12,828 rows; all non-voice-bot check-in sources)
| column | type | notes |
|---|---|---|
| checkin_id | text PK | |
| senior_id | text FK | |
| at | timestamptz | |
| channel | text | `phone_call`, `coordinator_visit`, `whatsapp_voice`, `app_checkin` (dataset); `voice_agent`, `phone_bridge`, `voice_note`, `one_tap`, `missed_call` (app-only) |
| language | text | |
| note_text | text null | transcript or coordinator note |
| transcription_status | text | `verified`, `auto_transcribed` (dataset); `failed`, `none` (app-only) |
| consent_status | text | |
| source_role | text | `care_coordinator`, `senior_citizen` (dataset); `voice_agent`, `coordinator` (app-only) |
| call_id | uuid FK calls null | set when the check-in came from an AI call or a recorded phone call |

**nlp_cues** (extractor output; same shape as `nlp_annotations.csv` but produced by the live extractor)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| source_type | text | `checkin`, `call`, `message` |
| source_id | text | id of the check-in, call or message (no FK, since the source varies) |
| senior_id | text FK | denormalised for queries |
| cue_type | text | pain, confusion, low_appetite, loneliness, fall, no_new_concern, ... |
| cue_value | text | |
| temporal_context | text | current, historical |
| negated | bool | |
| uncertain | bool | |
| confidence | numeric | |
| extractor_version | text | |

**calls** (both the AI wellbeing call and the recorded senior ↔ coordinator phone call)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| kind | text | `ai_agent`, `phone_bridge` |
| senior_id | text FK | |
| coordinator_id | uuid FK users null | null for AI calls |
| initiated_by_user_id | uuid FK users null | who tapped call (null = scheduler) |
| provider | text | `in_app` (AI agent), `exotel` |
| provider_call_sid | text unique null | Exotel `CallSid`, used to match the webhook |
| status | text | `queued`, `in_progress`, `completed`, `abandoned`, `failed`, `declined`, `no_answer`, `busy` |
| started_at, ended_at | timestamptz null | |
| duration_sec | int null | |
| language | text null | |
| recording_path | text null | private bucket path (`phone_bridge` only) |
| recording_expires_at | timestamptz null | retention limit |
| recording_consent | bool | both parties told the call is recorded |
| consent_at | timestamptz null | |
| transcript_status | text | `pending`, `done`, `failed`, `not_applicable` |
| context_snapshot | jsonb null | AI calls: exactly what the agent was told at start (summary, open memory items, today's risk factors, missed meds) |
| summary | text null | LLM summary written after the call (masked input) |
| model_info | jsonb | stt/llm/tts provider and versions |
| processed_at | timestamptz null | when transcription, summary, cues and rescoring finished |
| index | (senior_id, started_at desc), (provider_call_sid) | |

**call_turns** (transcript segments; for dual-channel recordings each channel is one speaker)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| call_id | uuid FK calls | |
| turn_index | int | unique with call_id |
| speaker | text | `agent`, `senior`, `coordinator` |
| text | text | transcript, as spoken |
| language | text null | |
| stt_confidence | numeric null | |
| cues | jsonb null | per-turn extracted cues |
| offset_ms | int null | position in the recording |
| at | timestamptz | |

**messages** (senior ↔ their coordinator; text and voice notes)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| senior_id | text FK | thread key: one thread per senior and their coordinator |
| sender_user_id | uuid FK users | |
| kind | text | `text`, `voice_note` |
| body | text null | text messages |
| audio_path | text null | private bucket path (voice notes) |
| transcript | text null | STT result |
| summary | text null | short summary for the coordinator |
| language | text null | |
| checkin_id | text FK checkins null | link to the check-in/cues this message produced |
| created_at, delivered_at, read_at | timestamptz | |
| index | (senior_id, created_at) | |

**senior_memory_items** (the agent's "what we know from before")
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| senior_id | text FK | |
| kind | text | `symptom`, `medication_issue`, `mood`, `promise`, `topic` |
| content | text | short, no names or phone numbers |
| status | text | `open`, `resolved` |
| first_seen_call_id, last_seen_call_id | uuid FK calls null | |
| first_seen_at, last_seen_at | timestamptz | |
| follow_up_after | date null | |
| resolved_at | timestamptz null | |

Rule: items are only created from senior statements or system facts, never from model speculation, and never contain a diagnosis.

**family_observations** (2,167 rows): PK `observation_id`; `senior_id`, `observed_at`, `observer_role`, `family_user_id` null FK, `observation_type` (mobility_change, mood_change, ...), `note`, `consent_valid`, `verification_status`.

### 2.5 Risk, alerts, summaries

**daily_risk_scores** (18,000 rows): PK `(senior_id, date)`; `risk_score` int 0-100, `risk_level` (`LOW`, `MODERATE`, `HIGH`, `URGENT_REVIEW`), `confidence_level`, `baseline_confidence`, `top_factors jsonb`, `recommended_action text`, `data_quality_flags jsonb`, `scoring_version`, `computed_at`. Index `(date, risk_score desc)` for the coordinator's ranked list.

**alerts** (546 rows): PK `alert_id` (text for seed, `ALT_xxxxx`); `senior_id`, `created_at`, `last_updated_at`, `status` (`OPEN`, `ACKNOWLEDGED`, `ESCALATED`, `RESOLVED`), `severity` (`MODERATE`, `HIGH`, `URGENT_REVIEW`), `triggering_signals jsonb` (list of plain-language reasons), `recommended_next_step`, `resolution_reason` null, `assigned_to` uuid null FK users. Indexes `(status, severity)`, `(senior_id, created_at)`.

**alert_events** (status history): `id`, `alert_id` FK, `actor_user_id` null, `from_status`, `to_status`, `note`, `at`.

**alert_feedback** (coordinator learning loop): `id`, `alert_id` FK, `coordinator_id` FK users, `useful` bool, `outcome` (`called`, `visited`, `doctor`, `no_action`), `comment`, `at`.

**weekly_family_summaries**: `id`, `senior_id`, `week_start date`, `body_text`, `language`, `generated_by` (`template`, `llm`), `sent_at` null; unique `(senior_id, week_start)`. Only generated when consent is on.

### 2.6 Coordinator priority list

**priority_lists** (one row per build of a coordinator's day list; a new revision is written after each AI call, new alert or manual refresh)
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| coordinator_id | uuid FK users | |
| list_date | date | |
| revision | int | 1 = morning build |
| reason | text | `morning_build`, `post_ai_call`, `new_alert`, `manual_refresh` |
| created_at | timestamptz | |
| unique | (coordinator_id, list_date, revision) | |

**priority_list_items**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| list_id | uuid FK priority_lists | |
| rank | int | 1 = most urgent; unique with list_id |
| senior_id | text FK | |
| risk_score | int | copied from `daily_risk_scores` at build time |
| risk_level | text | |
| reasons | jsonb | plain-language reasons (top factors) |
| suggested_action | text | |
| alert_id | text FK alerts null | open alert, if any |
| ai_call_done | bool | whether today's AI call has happened |
| previous_rank | int null | rank in the prior revision, for "moved up" display |

The app shows the highest revision for today; older revisions stay for audit and for the ops dashboard.

### 2.7 Notifications and devices

**device_tokens**: `id`, `user_id` FK, `platform` (`android`, `ios`, `web`), `token` unique (FCM), `app_version`, `created_at`, `last_seen_at`, `revoked_at` null.

**notifications**
| column | type | notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK users | recipient |
| kind | text | `medication_reminder`, `checkin_prompt`, `alert_new`, `alert_escalated`, `priority_list_updated`, `message_received`, `call_summary_ready` |
| title, body | text | push text; keep generic (no names or conditions) since push goes through a third party |
| data | jsonb | ids to open the right screen |
| scheduled_for | timestamptz | |
| sent_at | timestamptz null | |
| delivery_status | text | `pending`, `sent`, `failed`, `skipped` |
| read_at | timestamptz null | |
| index | (user_id, scheduled_for), (delivery_status, scheduled_for) | |

Medication reminders are generated by a scheduled job from `medication_schedules.scheduled_times`; each reminder is a `notifications` row, and the senior's "taken" tap writes a `medication_events` row (source `senior_app_confirmation`).

### 2.8 Ops dashboard views (no new tables)

SQL views over existing tables, scoped by `users.city_id` / `team_id` in the API:
- `v_ops_alert_response`: per alert, minutes from created to first acknowledged and to resolved (from `alert_events`), city, coordinator.
- `v_ops_alert_volume`: alerts per day, city, severity, status.
- `v_ops_outcomes`: resolution reasons and `alert_feedback` (useful or not, outcome).
- `v_ops_coordinator_activity`: per coordinator per day: alerts handled, calls (`calls`), messages sent, list revisions viewed.
- `v_ops_alert_precision`: share of alerts marked useful, by city and week.

## 3. Relationships (summary)

```
users(coordinator) 1─* seniors 1─1 senior_contacts
                       seniors 1─1 senior_baselines
                       seniors 1─* senior_conditions, vitals, daily_activity,
                                   medication_schedules 1─* medication_events,
                                   checkins 1─* nlp_cues, calls 1─* call_turns, messages,
                                   senior_memory_items, family_observations,
                                   daily_risk_scores, alerts 1─* alert_events, alert_feedback,
                                   weekly_family_summaries
users(family) *─* seniors  via family_links
users(coordinator) 1─* priority_lists 1─* priority_list_items *─1 seniors
users 1─* device_tokens, notifications
```

## 4. Seed mapping

| Source CSV | Target |
|---|---|
| `raw/senior_profiles.csv` | `seniors` (+ synthesised `senior_contacts`, `senior_conditions`) |
| `raw/senior_baselines.csv` | `senior_baselines` |
| `raw/vitals.csv` | `vitals` |
| `raw/daily_activity.csv` | `daily_activity` |
| `raw/medication_schedules.csv` | `medication_schedules` (+ synthesised drug name and dosage) |
| `raw/medication_events.csv` | `medication_events` |
| `raw/checkins.csv` | `checkins` |
| `raw/family_observations.csv` | `family_observations` |
| `processed/daily_risk_scores.csv` | `daily_risk_scores` |
| `processed/alert_events.csv` | `alerts` (the CSV is one row per alert, not per transition) |
| `coordinator_id` values | `users` rows with role `coordinator` |
| generated | `priority_lists` / `priority_list_items` revision 1 for each coordinator and day, built from `daily_risk_scores` (top N by score) so the demo has history |

Not seeded: `nlp_annotations.csv` (evaluation labels). `nlp_cues` is filled by running the live extractor over the seeded check-ins.

## 5. Open points to confirm

1. Enum values were checked against the dataset (8 cities, 10 coordinators, 200 seniors). App-only values are marked as such in each table so the CHECK constraints allow both.
2. Coordinators and family members become `users`; seed creates one demo user per coordinator and a few family users with a known dev password. Passwords never go in the repo; they come from env at seed time.
3. Seniors authenticate in the mobile app with a device token rather than a password.
4. `activity_events` is deferred until the sensor stretch goal.
5. Calls: `calls` covers both the AI agent call (`in_app`, no audio kept) and the Exotel phone bridge (`exotel`, audio in a private bucket). The Exotel webhook is matched through `provider_call_sid`.
6. Family members have no mobile app in v1; the weekly summary goes out by SMS or WhatsApp, so `device_tokens` only applies to seniors, coordinators and ops.
7. Audio retention period and bucket name are to be decided (`recording_expires_at` is ready for it).
