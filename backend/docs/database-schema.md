# Database schema

Generated from the models by `python -m app.db.schema_doc`; do not edit by hand. Postgres 17 (Supabase). Row Level Security is on for every table with no policies: only the backend (database owner) can read or write. Enums are `text` plus a CHECK constraint.

29 tables.

## accelerometer_windows

| column | type | null | notes |
|---|---|---|---|
| window_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| window_start | datetime | no |  |
| duration_s | float | yes |  |
| sample_rate_hz | integer | yes |  |
| label | text | no |  |
| activity_type | text | yes |  |
| fall_type | text | yes |  |
| fall_event_id | text | yes |  |
| device | text | yes |  |
| source | text | yes |  |
| peak_g | float | yes |  |
| min_g_before_peak | float | yes |  |
| pre_impact_std_g | float | yes |  |
| orientation_change_deg | float | yes |  |
| post_impact_still_s | float | yes |  |
| max_jerk_g_per_s | float | yes |  |
| waveform_ref | text | yes |  |

Checks: `label IN ('fall', 'non_fall', 'non_fall_near_fall')`

## alert_events

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| alert_id | text | no | FK alerts.alert_id |
| actor_user_id | char(32) | yes | FK users.id |
| from_status | text | yes |  |
| to_status | text | no |  |
| note | text | yes |  |
| at | datetime | no |  |

## alert_feedback

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| alert_id | text | no | FK alerts.alert_id |
| coordinator_id | char(32) | no | FK users.id |
| useful | boolean | no |  |
| outcome | text | yes |  |
| comment | text | yes |  |
| at | datetime | no |  |

Checks: `outcome IN ('called', 'visited', 'doctor', 'no_action')`

## alerts

| column | type | null | notes |
|---|---|---|---|
| alert_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| created_at | datetime | no |  |
| last_updated_at | datetime | no |  |
| status | text | no |  |
| severity | text | no |  |
| triggering_signals | json | no |  |
| recommended_next_step | text | no |  |
| resolution_reason | text | yes |  |
| assigned_to | char(32) | yes | FK users.id |

Checks: `severity IN ('MODERATE', 'HIGH', 'URGENT_REVIEW')`; `status IN ('OPEN', 'ACKNOWLEDGED', 'ESCALATED', 'RESOLVED')`

## audit_log

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| actor_user_id | char(32) | yes | FK users.id |
| action | text | no |  |
| senior_id | text | yes |  |
| detail | json | no |  |
| at | datetime | no |  |

## call_turns

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| call_id | char(32) | no | FK calls.id |
| turn_index | integer | no |  |
| speaker | text | no |  |
| text | text | no |  |
| language | text | yes |  |
| stt_confidence | numeric | yes |  |
| cues | json | yes |  |
| offset_ms | integer | yes |  |
| at | datetime | yes |  |

Checks: `speaker IN ('agent', 'senior', 'coordinator')`

## calls

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| external_ref | text | yes | unique |
| kind | text | no |  |
| senior_id | text | no | FK seniors.senior_id |
| coordinator_id | char(32) | yes | FK users.id |
| initiated_by_user_id | char(32) | yes | FK users.id |
| provider | text | no |  |
| provider_call_sid | text | yes | unique |
| status | text | no |  |
| started_at | datetime | yes |  |
| ended_at | datetime | yes |  |
| duration_sec | integer | yes |  |
| language | text | yes |  |
| objective | text | yes |  |
| sentiment | text | yes |  |
| urgency_flag | boolean | no |  |
| call_insights | json | yes |  |
| recording_path | text | yes |  |
| recording_expires_at | datetime | yes |  |
| recording_consent | boolean | no |  |
| consent_at | datetime | yes |  |
| transcript_status | text | no |  |
| context_snapshot | json | yes |  |
| summary | text | yes |  |
| model_info | json | no |  |
| processed_at | datetime | yes |  |

Checks: `kind IN ('ai_agent', 'phone_bridge')`; `status IN ('queued', 'in_progress', 'completed', 'abandoned', 'failed', 'declined', 'no_answer', 'busy')`; `provider IN ('in_app', 'exotel', 'import')`; `transcript_status IN ('pending', 'done', 'failed', 'not_applicable')`

## checkins

| column | type | null | notes |
|---|---|---|---|
| checkin_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| at | datetime | no |  |
| channel | text | no |  |
| language | text | yes |  |
| note_text | text | yes |  |
| transcription_status | text | yes |  |
| consent_status | text | yes |  |
| source_role | text | yes |  |
| call_id | char(32) | yes | FK calls.id |

Checks: `channel IN ('phone_call', 'coordinator_visit', 'whatsapp_voice', 'app_checkin', 'voice_agent', 'phone_bridge', 'voice_note', 'one_tap', 'missed_call')`; `source_role IN ('care_coordinator', 'senior_citizen', 'voice_agent', 'coordinator')`

## daily_activity

| column | type | null | notes |
|---|---|---|---|
| senior_id | text | no | PK, FK seniors.senior_id |
| date | date | no | PK |
| day_index | integer | yes |  |
| steps | float | yes |  |
| active_minutes | float | yes |  |
| sedentary_hours | float | yes |  |
| max_inactive_block_hours | float | yes |  |
| sleep_hours | float | yes |  |
| appetite_level | float | yes |  |
| mood_level | float | yes |  |
| social_contact_count | integer | yes |  |
| hobby_sessions | integer | yes |  |
| whatsapp_group_messages | integer | yes |  |
| community_event_registered | boolean | yes |  |
| community_event_attended | boolean | yes |  |
| calls_to_family | integer | yes |  |
| motion_sensor_source | text | yes |  |
| data_available | boolean | no |  |

## daily_risk_scores

| column | type | null | notes |
|---|---|---|---|
| senior_id | text | no | PK, FK seniors.senior_id |
| date | date | no | PK |
| risk_score | integer | no |  |
| risk_level | text | no |  |
| confidence_level | text | yes |  |
| baseline_confidence | text | yes |  |
| top_factors | json | no |  |
| recommended_action | text | yes |  |
| data_quality_flags | json | no |  |
| scoring_version | text | no |  |
| computed_at | datetime | no |  |

Checks: `risk_level IN ('LOW', 'MODERATE', 'HIGH', 'URGENT_REVIEW')`

## device_tokens

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| user_id | char(32) | no | FK users.id |
| platform | text | no |  |
| token | text | no | unique |
| app_version | text | yes |  |
| created_at | datetime | no |  |
| last_seen_at | datetime | yes |  |
| revoked_at | datetime | yes |  |

Checks: `platform IN ('android', 'ios', 'web')`

## family_interactions

| column | type | null | notes |
|---|---|---|---|
| interaction_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| family_id | text | yes |  |
| coordinator_id | char(32) | yes | FK users.id |
| family_user_id | char(32) | yes | FK users.id |
| at | datetime | no |  |
| channel | text | no |  |
| observer_relation | text | yes |  |
| message_language | text | yes |  |
| category | text | no |  |
| primary_cue | text | yes |  |
| family_message | text | no |  |
| coordinator_reply_en | text | yes |  |
| coordinator_reply_hi_roman | text | yes |  |
| counselor_summary | text | yes |  |
| suggested_action | text | yes |  |
| escalation_needed | boolean | no |  |
| consent_level | text | no |  |

Checks: `channel IN ('whatsapp_message', 'phone_call', 'app_message')`; `consent_level IN ('full', 'summary_and_urgent', 'urgent_only')`

## family_links

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| family_user_id | char(32) | no | FK users.id |
| senior_id | text | no | FK seniors.senior_id |
| relationship | text | no |  |
| consent_level | text | no |  |
| consent_given | boolean | no |  |
| consent_at | datetime | yes |  |

Checks: `relationship IN ('daughter', 'son', 'spouse', 'daughter_in_law', 'grandchild', 'nephew_niece', 'other')`; `consent_level IN ('full', 'summary_and_urgent', 'urgent_only')`

## medication_events

| column | type | null | notes |
|---|---|---|---|
| medication_event_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| medication_id | text | no | FK medication_schedules.medication_id |
| scheduled_at | datetime | no |  |
| status | text | no |  |
| actual_at | datetime | yes |  |
| record_source | text | no |  |
| verification_status | text | yes |  |

Checks: `status IN ('taken', 'missed', 'unknown', 'double_dose', 'sos_taken')`; `verification_status IN ('verified', 'self_reported', 'unverified')`

## medication_schedules

| column | type | null | notes |
|---|---|---|---|
| medication_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| drug_name | text | no |  |
| dosage | text | no |  |
| indication | text | yes |  |
| linked_condition | text | yes |  |
| criticality | text | yes |  |
| start_date | date | no |  |
| end_date | date | yes |  |
| times_per_day | integer | no |  |
| scheduled_times | json | no |  |
| is_sos | boolean | no |  |
| prescribed_by | text | yes |  |
| is_active | boolean | no |  |

Checks: `criticality IN ('high', 'medium', 'low')`

## messages

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| sender_user_id | char(32) | no | FK users.id |
| external_ref | text | yes | unique |
| kind | text | no |  |
| category | text | yes |  |
| urgency_flag | boolean | no |  |
| duration_sec | integer | yes |  |
| stt_confidence | numeric | yes |  |
| body | text | yes |  |
| audio_path | text | yes |  |
| transcript | text | yes |  |
| summary | text | yes |  |
| language | text | yes |  |
| checkin_id | text | yes | FK checkins.checkin_id |
| created_at | datetime | no |  |
| delivered_at | datetime | yes |  |
| read_at | datetime | yes |  |

Checks: `kind IN ('text', 'voice_note')`

## nlp_cues

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| source_type | text | no |  |
| source_id | text | no |  |
| senior_id | text | no | FK seniors.senior_id |
| cue_type | text | no |  |
| cue_value | text | no |  |
| temporal_context | text | yes |  |
| negated | boolean | no |  |
| uncertain | boolean | no |  |
| severity | text | yes |  |
| cue_origin | text | yes |  |
| confidence | numeric | yes |  |
| extractor_version | text | yes |  |
| created_at | datetime | no |  |

Checks: `source_type IN ('checkin', 'call', 'message')`

## notifications

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| user_id | char(32) | no | FK users.id |
| kind | text | no |  |
| title | text | no |  |
| body | text | no |  |
| data | json | no |  |
| scheduled_for | datetime | no |  |
| sent_at | datetime | yes |  |
| delivery_status | text | no |  |
| read_at | datetime | yes |  |

Checks: `delivery_status IN ('pending', 'sent', 'failed', 'skipped')`; `kind IN ('medication_reminder', 'checkin_prompt', 'alert_new', 'alert_escalated', 'priority_list_updated', 'message_received', 'call_summary_ready')`

## priority_list_items

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| list_id | char(32) | no | FK priority_lists.id |
| rank | integer | no |  |
| senior_id | text | no | FK seniors.senior_id |
| risk_score | integer | no |  |
| risk_level | text | no |  |
| reasons | json | no |  |
| suggested_action | text | yes |  |
| alert_id | text | yes | FK alerts.alert_id |
| ai_call_done | boolean | no |  |
| previous_rank | integer | yes |  |

## priority_lists

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| coordinator_id | char(32) | no | FK users.id |
| list_date | date | no |  |
| revision | integer | no |  |
| reason | text | no |  |
| created_at | datetime | no |  |

Checks: `reason IN ('morning_build', 'post_ai_call', 'new_alert', 'manual_refresh')`

## senior_baselines

| column | type | null | notes |
|---|---|---|---|
| senior_id | text | no | PK, FK seniors.senior_id |
| sbp_median | float | yes |  |
| sbp_iqr | float | yes |  |
| sbp_n | integer | yes |  |
| dbp_median | float | yes |  |
| dbp_iqr | float | yes |  |
| dbp_n | integer | yes |  |
| hr_median | float | yes |  |
| hr_iqr | float | yes |  |
| hr_n | integer | yes |  |
| spo2_median | float | yes |  |
| spo2_iqr | float | yes |  |
| spo2_n | integer | yes |  |
| weight_kg_median | float | yes |  |
| weight_kg_iqr | float | yes |  |
| weight_kg_n | integer | yes |  |
| temp_f_median | float | yes |  |
| temp_f_iqr | float | yes |  |
| temp_f_n | integer | yes |  |
| glucose_fasting_median | float | yes |  |
| glucose_post_meal_median | float | yes |  |
| steps_median | float | yes |  |
| active_minutes_median | float | yes |  |
| sedentary_hours_median | float | yes |  |
| sleep_hours_median | float | yes |  |
| max_inactive_block_hours | float | yes |  |
| hobby_sessions_per_day | float | yes |  |
| whatsapp_msgs_per_day | float | yes |  |
| calls_to_family_per_day | float | yes |  |
| appetite_self_report | float | yes |  |
| mood_self_report | float | yes |  |
| community_attendance_rate | float | yes |  |
| data_availability | float | yes |  |
| med_adherence_rate | float | yes |  |
| vitals_baseline_confidence | text | yes |  |
| baseline_window_days | text | yes |  |
| updated_at | datetime | no |  |

## senior_conditions

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| category | text | no |  |
| condition | text | no |  |

Checks: `category IN ('physical', 'mental_health')`

## senior_contacts

| column | type | null | notes |
|---|---|---|---|
| senior_id | text | no | PK, FK seniors.senior_id |
| full_name | text | no |  |
| phone | text | yes |  |
| device_token_hash | text | yes |  |

## senior_health_profile

| column | type | null | notes |
|---|---|---|---|
| senior_id | text | no | PK, FK seniors.senior_id |
| cognitive_status | text | yes |  |
| anxiety_tendency | text | yes |  |
| grief_status | text | yes |  |
| loneliness_risk | text | yes |  |
| falls_last_12_months | integer | yes |  |
| hospitalisations_last_12_months | integer | yes |  |
| fall_risk_level | text | yes |  |
| mobility_aid | text | yes |  |
| equipment_tags | json | no |  |
| hobbies | json | no |  |
| usual_wake_time | text | yes |  |
| usual_sleep_time | text | yes |  |
| usual_activity_summary | text | yes |  |
| recent_health_events | text | yes |  |

## senior_memory_items

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| kind | text | no |  |
| content | text | no |  |
| status | text | no |  |
| first_seen_call_id | char(32) | yes | FK calls.id |
| last_seen_call_id | char(32) | yes | FK calls.id |
| first_seen_at | datetime | no |  |
| last_seen_at | datetime | no |  |
| follow_up_after | date | yes |  |
| resolved_at | datetime | yes |  |

Checks: `kind IN ('symptom', 'medication_issue', 'mood', 'promise', 'topic')`; `status IN ('open', 'resolved')`

## seniors

| column | type | null | notes |
|---|---|---|---|
| senior_id | text | no | PK |
| gender | text | yes |  |
| age | integer | no |  |
| marital_status | text | yes |  |
| city | text | no |  |
| living_arrangement | text | no |  |
| preferred_language | text | no |  |
| communication_style | text | yes |  |
| uses_whatsapp | boolean | no |  |
| coordinator_id | char(32) | no | FK users.id |
| user_id | char(32) | yes | FK users.id, unique |
| family_id | text | yes |  |
| family_consent_level | text | no |  |
| vital_monitoring_enrolled | boolean | no |  |
| vital_devices | json | no |  |
| motion_sensor_source | text | yes |  |
| smart_pillbox | boolean | no |  |
| checkin_days_of_week | json | no |  |
| checkin_preferred_hour | integer | yes |  |
| enrollment_date | date | yes |  |
| observation_end_date | date | yes |  |
| is_active | boolean | no |  |
| created_at | datetime | no |  |

Checks: `preferred_language IN ('hindi', 'hinglish', 'english')`; `living_arrangement IN ('alone', 'with_spouse', 'with_domestic_help_or_family')`; `family_consent_level IN ('full', 'summary_and_urgent', 'urgent_only')`

## users

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| role | text | no |  |
| external_ref | text | yes | unique |
| display_name | text | no |  |
| email | text | yes | unique |
| phone | text | yes |  |
| password_hash | text | yes |  |
| city | text | yes |  |
| team_id | text | yes |  |
| is_active | boolean | no |  |
| created_at | datetime | no |  |

Checks: `role IN ('coordinator', 'family', 'ops', 'admin', 'senior')`

## vitals

| column | type | null | notes |
|---|---|---|---|
| measurement_id | text | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| measured_at | datetime | no |  |
| measurement_type | text | no |  |
| value | numeric | no |  |
| unit | text | no |  |
| context | text | yes |  |
| source | text | no |  |
| quality_status | text | no |  |

Checks: `quality_status IN ('valid', 'questionable', 'device_artifact')`

## weekly_family_summaries

| column | type | null | notes |
|---|---|---|---|
| id | char(32) | no | PK |
| senior_id | text | no | FK seniors.senior_id |
| week_start | date | no |  |
| body_text | text | no |  |
| language | text | no |  |
| generated_by | text | no |  |
| sent_at | datetime | yes |  |

