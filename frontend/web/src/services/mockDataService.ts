import {
  Alert,
  DailyRiskScore,
  DashboardMetrics,
  SeniorProfile,
  SeniorSummary,
} from "../types/domain";
import {
  AlertFilterParams,
  SeniorFilterParams,
  PriorityListResponse,
  CoordinatorCaseloadItem,
  ContractPaginatedList,
  ContractSeniorDetail,
  ContractRiskHistoryItem,
  ContractVitalItem,
  ContractMedicationsResponse,
  ContractActivityItem,
  ContractCallObject,
  ContractCueRecord,
  ContractMemoryItem,
  ContractFamilyInteractionItem,
  ContractAlertObject,
  ContractAlertFeedbackRequest,
  ContractMessageItem,
  ContractNotificationItem,
  ContractNotificationPreferences,
  ContractDeviceRegister,
  ContractDeviceOut,
  SeniorHomeResponse,
  OpsOverviewResponse,
  OpsAlertVolumeItem,
  OpsResponseTimesItem,
  OpsAlertOutcomesItem,
  OpsAlertPrecisionItem,
  OpsCoordinatorItem,
  OpsCityItem,
  OpsDailyReportItem,
  AdminJobRunResponse,
  FamilyWeeklySummaryResponse,
} from "../types/api";
import {
  computeDashboardMetrics,
  MOCK_ALERTS,
  MOCK_SENIORS,
  MOCK_PRIORITY_LIST_RESPONSE,
  MOCK_OPS_OVERVIEW,
  MOCK_OPS_CITIES,
  MOCK_OPS_COORDINATORS,
  MOCK_SENIOR_HOME_DATA,
} from "../mocks/fixtures";
import { IDataService } from "./dataService";

/**
 * Deterministic In-Memory Mock Data Service.
 * Serves as the single source of truth in mock mode.
 */
export class MockDataService implements IDataService {
  readonly isMock = true;

  // Clone fixtures to keep local mutations isolated
  private seniors: SeniorProfile[];
  private alerts: Alert[];

  constructor(initialSeniors?: SeniorProfile[], initialAlerts?: Alert[]) {
    this.seniors = JSON.parse(
      JSON.stringify(initialSeniors || MOCK_SENIORS)
    ) as SeniorProfile[];
    this.alerts = JSON.parse(
      JSON.stringify(initialAlerts || MOCK_ALERTS)
    ) as Alert[];
  }

  async getDashboardMetrics(): Promise<DashboardMetrics> {
    return computeDashboardMetrics(this.seniors, this.alerts);
  }

  async listSeniors(params?: SeniorFilterParams): Promise<SeniorSummary[]> {
    let result = this.seniors.map((s) => ({
      senior_id: s.senior_id,
      display_name: s.display_name,
      age: s.age,
      preferred_language: s.preferred_language,
      city_id: s.city_id,
      living_arrangement: s.living_arrangement,
      coordinator_id: s.coordinator_id,
      expected_checkin_frequency: s.expected_checkin_frequency,
      family_consent: s.family_consent,
      current_risk_level: s.current_risk_level,
      current_risk_score: s.current_risk_score,
      last_observation_date: s.last_observation_date,
      active_alert_count: this.alerts.filter(
        (a) =>
          a.senior_id === s.senior_id &&
          (a.status === "OPEN" || a.status === "ESCALATED")
      ).length,
      attention_reason: s.attention_reason,
    }));

    // Filter by search query (id or display name)
    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (s) =>
          s.senior_id.toLowerCase().includes(q) ||
          s.display_name.toLowerCase().includes(q)
      );
    }

    // Filter by risk level
    if (params?.risk_level && params.risk_level !== "ALL") {
      result = result.filter(
        (s) =>
          s.current_risk_level.toUpperCase() ===
          params.risk_level?.toUpperCase()
      );
    }

    // Filter by city
    if (params?.city_id && params.city_id !== "ALL") {
      result = result.filter((s) => s.city_id === params.city_id);
    }

    // Filter by coordinator
    if (params?.coordinator_id && params.coordinator_id !== "ALL") {
      result = result.filter((s) => s.coordinator_id === params.coordinator_id);
    }

    // Deterministic sorting
    const sortBy = params?.sort_by || "risk_score";
    const dir = params?.sort_direction === "asc" ? 1 : -1;

    result.sort((a, b) => {
      if (sortBy === "risk_score") {
        // Missing scores sorted to end
        if (a.current_risk_score === null && b.current_risk_score === null)
          return 0;
        if (a.current_risk_score === null) return 1;
        if (b.current_risk_score === null) return -1;
        return (a.current_risk_score - b.current_risk_score) * dir;
      }
      if (sortBy === "age") {
        return (a.age - b.age) * dir;
      }
      if (sortBy === "senior_id") {
        return a.senior_id.localeCompare(b.senior_id) * dir;
      }
      if (sortBy === "last_observation_date") {
        if (!a.last_observation_date && !b.last_observation_date) return 0;
        if (!a.last_observation_date) return 1;
        if (!b.last_observation_date) return -1;
        return (
          a.last_observation_date.localeCompare(b.last_observation_date) * dir
        );
      }
      return 0;
    });

    if (params?.offset !== undefined && params?.limit !== undefined) {
      result = result.slice(params.offset, params.offset + params.limit);
    } else if (params?.limit !== undefined) {
      result = result.slice(0, params.limit);
    }

    return result;
  }

  async getSeniorById(seniorId: string): Promise<SeniorProfile | null> {
    const senior = this.seniors.find(
      (s) => s.senior_id.toUpperCase() === seniorId.toUpperCase()
    );
    if (!senior) return null;

    // Attach current related alerts from the mutable alert pool
    const relatedAlerts = this.alerts.filter(
      (a) => a.senior_id.toUpperCase() === seniorId.toUpperCase()
    );

    const activeCount = relatedAlerts.filter(
      (a) => a.status === "OPEN" || a.status === "ESCALATED"
    ).length;

    return {
      ...senior,
      active_alert_count: activeCount,
      related_alerts: relatedAlerts,
    };
  }

  async getSeniorRiskHistory(
    seniorId: string,
    startDate?: string,
    endDate?: string
  ): Promise<DailyRiskScore[]> {
    const senior = await this.getSeniorById(seniorId);
    if (!senior) return [];

    let history = [...senior.risk_history];
    if (startDate) {
      history = history.filter((h) => h.date >= startDate);
    }
    if (endDate) {
      history = history.filter((h) => h.date <= endDate);
    }
    return history.sort((a, b) => a.date.localeCompare(b.date));
  }

  async listAlerts(params?: AlertFilterParams): Promise<Alert[]> {
    let result = [...this.alerts];

    if (params?.search && params.search.trim()) {
      const q = params.search.toLowerCase().trim();
      result = result.filter(
        (a) =>
          a.alert_id.toLowerCase().includes(q) ||
          a.senior_id.toLowerCase().includes(q) ||
          (a.senior_display_name &&
            a.senior_display_name.toLowerCase().includes(q))
      );
    }

    if (params?.status && params.status !== "ALL") {
      result = result.filter(
        (a) => a.status.toUpperCase() === params.status?.toUpperCase()
      );
    }

    if (params?.severity && params.severity !== "ALL") {
      result = result.filter(
        (a) => a.severity.toUpperCase() === params.severity?.toUpperCase()
      );
    }

    if (params?.senior_id) {
      result = result.filter(
        (a) =>
          a.senior_id.toUpperCase() === params.senior_id?.toUpperCase()
      );
    }

    // Sort newest created first
    return result.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  async getAlertById(alertId: string): Promise<Alert | null> {
    const alert = this.alerts.find(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    return alert || null;
  }

  async acknowledgeAlert(
    alertId: string,
    coordinatorId: string,
    notes?: string
  ): Promise<Alert> {
    const idx = this.alerts.findIndex(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    if (idx === -1) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    const current = this.alerts[idx];
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const updated: Alert = {
      ...current,
      status: "ACKNOWLEDGED",
      last_updated_at: nowStr,
      acknowledgement_notes: notes || `Acknowledged by ${coordinatorId}`,
    };

    this.alerts[idx] = updated;

    // Update active count on senior if present
    const senior = this.seniors.find((s) => s.senior_id === current.senior_id);
    if (senior) {
      senior.active_alert_count = this.alerts.filter(
        (a) =>
          a.senior_id === senior.senior_id &&
          (a.status === "OPEN" || a.status === "ESCALATED")
      ).length;
    }

    return updated;
  }

  async resolveAlert(
    alertId: string,
    coordinatorId: string,
    resolutionReason: string
  ): Promise<Alert> {
    const idx = this.alerts.findIndex(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    if (idx === -1) {
      throw new Error(`Alert with ID ${alertId} not found`);
    }

    const current = this.alerts[idx];
    const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);

    const updated: Alert = {
      ...current,
      status: "RESOLVED",
      last_updated_at: nowStr,
      resolution_reason: `Manual resolution by ${coordinatorId}: ${resolutionReason}`,
    };

    this.alerts[idx] = updated;

    // Update active count on senior if present
    const senior = this.seniors.find((s) => s.senior_id === current.senior_id);
    if (senior) {
      senior.active_alert_count = this.alerts.filter(
        (a) =>
          a.senior_id === senior.senior_id &&
          (a.status === "OPEN" || a.status === "ESCALATED")
      ).length;
    }

    return updated;
  }

  // --- API Contract (v1) Coordinator Methods ---

  async getCoordinatorToday(date?: string): Promise<PriorityListResponse> {
    const list = JSON.parse(JSON.stringify(MOCK_PRIORITY_LIST_RESPONSE));
    if (date) list.date = date;
    return list;
  }

  async getCoordinatorSeniors(params?: {
    q?: string;
    risk_level?: string;
    sort?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractPaginatedList<CoordinatorCaseloadItem>> {
    let items: CoordinatorCaseloadItem[] = this.seniors.map((s) => ({
      senior_id: s.senior_id,
      display_name: s.display_name.replace(/\(.*\)/, "").trim() || `Senior ${s.senior_id}`,
      age: s.age,
      city: s.city_id.replace("CITY_", "").charAt(0) + s.city_id.replace("CITY_", "").slice(1).toLowerCase(),
      preferred_language: s.preferred_language,
      living_arrangement: s.living_arrangement === "with_family" ? "with_domestic_help_or_family" : s.living_arrangement,
      risk_score: s.current_risk_score,
      risk_level: s.current_risk_level,
      open_alert_id: this.alerts.find(
        (a) => a.senior_id === s.senior_id && (a.status === "OPEN" || a.status === "ESCALATED")
      )?.alert_id || null,
      last_contact_at: s.last_observation_date
        ? `${s.last_observation_date}T10:00:00+05:30`
        : null,
    }));

    if (params?.q) {
      const q = params.q.toLowerCase().trim();
      items = items.filter(
        (i) => i.senior_id.toLowerCase().includes(q) || i.display_name.toLowerCase().includes(q)
      );
    }

    if (params?.risk_level && params.risk_level !== "ALL") {
      items = items.filter((i) => i.risk_level === params.risk_level);
    }

    const limit = params?.limit || 50;
    const offset = params?.offset || 0;
    const paginated = items.slice(offset, offset + limit);

    return {
      items: paginated,
      total: items.length,
      limit,
      offset,
    };
  }

  async getContractSeniorDetail(seniorId: string): Promise<ContractSeniorDetail> {
    const senior = this.seniors.find(
      (s) => s.senior_id.toUpperCase() === seniorId.toUpperCase()
    ) || this.seniors[0];

    return {
      senior_id: senior.senior_id,
      display_name: senior.display_name,
      age: senior.age,
      gender: "Female",
      city: "Bengaluru",
      living_arrangement: "alone",
      preferred_language: senior.preferred_language,
      communication_style: "Prefers polite Hinglish or Hindi, morning calls before 11 AM",
      family_consent_level: "full",
      conditions: [
        { category: "cardiovascular", condition: "Hypertension" },
        { category: "endocrine", condition: "Type 2 Diabetes" },
      ],
      health_profile: {
        cognitive_status: "Intact",
        fall_risk_level: "Moderate",
        mobility_aid: "Walking stick for long distances",
        hobbies: ["Gardening", "Morning radio", "Bhajans"],
      },
      baseline: senior.baselines as any,
      contact: { phone: "+91 98765 43210" },
    };
  }

  async getSeniorContractRiskHistory(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractRiskHistoryItem[]> {
    const senior = this.seniors.find(
      (s) => s.senior_id.toUpperCase() === seniorId.toUpperCase()
    );
    if (!senior) return [];

    return (senior.risk_history || []).map((h) => ({
      date: h.date,
      risk_score: h.risk_score,
      risk_level: h.risk_level,
      top_factors: (h.top_contributing_factors || []).map((f) => ({
        rule_id: f.rule_id,
        category: f.category,
        evidence: f.evidence,
        window: f.window,
        points_contributed: f.points_contributed,
        is_safety_tripwire: f.is_safety_tripwire,
      })),
      recommended_action: h.recommended_action,
      scoring_version: h.scoring_version,
    }));
  }

  async getSeniorVitals(
    seniorId: string,
    type?: string,
    from?: string,
    to?: string
  ): Promise<ContractVitalItem[]> {
    const senior = this.seniors.find(
      (s) => s.senior_id.toUpperCase() === seniorId.toUpperCase()
    );
    const recent = senior?.recent_vitals || [];

    if (recent.length > 0) {
      return recent.map((v) => ({
        measurement_id: v.measurement_id,
        measured_at: v.timestamp,
        measurement_type: v.measurement_type as any,
        value: v.measurement_value,
        unit: v.unit,
        context: v.measurement_context,
        quality_status: v.quality_status,
      }));
    }

    // Default synthetic contract series
    return [
      {
        measurement_id: "m_001",
        measured_at: "2026-10-11T08:30:00+05:30",
        measurement_type: "blood_pressure_systolic",
        value: 138,
        unit: "mmHg",
        context: "resting",
        source: "device",
        quality_status: "verified",
      },
      {
        measurement_id: "m_002",
        measured_at: "2026-10-11T08:30:00+05:30",
        measurement_type: "blood_pressure_diastolic",
        value: 88,
        unit: "mmHg",
        context: "resting",
        source: "device",
        quality_status: "verified",
      },
      {
        measurement_id: "m_003",
        measured_at: "2026-10-11T08:35:00+05:30",
        measurement_type: "spo2",
        value: 97,
        unit: "%",
        context: "room_air",
        source: "pulse_ox",
        quality_status: "verified",
      },
      {
        measurement_id: "m_004",
        measured_at: "2026-10-10T09:00:00+05:30",
        measurement_type: "blood_glucose",
        value: 124,
        unit: "mg/dL",
        context: "fasting",
        source: "glucometer",
        quality_status: "verified",
      },
    ];
  }

  async getSeniorMedications(seniorId: string): Promise<ContractMedicationsResponse> {
    return {
      schedules: [
        {
          medication_id: "MED_01",
          drug_name: "Amlodipine",
          dosage: "5 mg",
          indication: "Hypertension",
          times_per_day: 1,
          scheduled_times: ["08:00"],
          criticality: "high",
          is_active: true,
        },
        {
          medication_id: "MED_02",
          drug_name: "Metformin",
          dosage: "500 mg",
          indication: "Diabetes",
          times_per_day: 2,
          scheduled_times: ["08:30", "20:30"],
          criticality: "medium",
          is_active: true,
        },
      ],
      adherence: {
        last_7d_pct: 88,
        last_30d_pct: 91,
        missed_critical_7d: 1,
      },
      recent_events: [
        {
          scheduled_at: "2026-10-11T08:00:00+05:30",
          status: "taken",
          actual_at: "2026-10-11T08:14:00+05:30",
          record_source: "senior_app_confirmation",
        },
        {
          scheduled_at: "2026-10-10T20:30:00+05:30",
          status: "missed",
          actual_at: null,
          record_source: "coordinator_checkin",
        },
      ],
    };
  }

  async getSeniorActivity(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractActivityItem[]> {
    return [
      {
        date: "2026-10-11",
        steps: 1850,
        active_minutes: 25,
        sleep_hours: 6.2,
        appetite_level: 4,
        mood_level: 3,
        social_contact_count: 2,
        data_available: true,
      },
      {
        date: "2026-10-10",
        steps: 1720,
        active_minutes: 20,
        sleep_hours: 5.8,
        appetite_level: 3,
        mood_level: 3,
        social_contact_count: 1,
        data_available: true,
      },
      {
        date: "2026-10-09",
        steps: 2900,
        active_minutes: 42,
        sleep_hours: 7.0,
        appetite_level: 4,
        mood_level: 4,
        social_contact_count: 3,
        data_available: true,
      },
    ];
  }

  async getSeniorCalls(seniorId: string): Promise<ContractCallObject[]> {
    return [
      {
        id: "call_uuid_001",
        senior_id: seniorId,
        kind: "phone_bridge",
        status: "completed",
        transcript_status: "done",
        started_at: "2026-10-10T11:00:00+05:30",
        ended_at: "2026-10-10T11:06:40+05:30",
        duration_sec: 400,
        recording_stored: true,
        recording_expires_at: "2026-11-10T11:00:00+05:30",
        summary:
          "Senior reported mild dizziness when standing up yesterday. Coordinator reminded to take morning water and medication with breakfast.",
        urgency_flag: false,
        turns: [
          {
            turn_index: 1,
            speaker: "coordinator",
            text: "Namaste Shanti ji, kaise hain aap aaj?",
            offset_ms: 1200,
          },
          {
            turn_index: 2,
            speaker: "senior",
            text: "Namaste beta, theek hoon par subah thoda chakkar jaisa lag raha tha.",
            offset_ms: 5400,
          },
        ],
        cues: [
          {
            cue_type: "symptom",
            cue_value: "dizziness",
            temporal_context: "yesterday_and_morning",
            negated: false,
            uncertain: false,
          },
        ],
      },
    ];
  }

  async getSeniorMessages(
    seniorId: string,
    limit?: number,
    before?: string
  ): Promise<ContractPaginatedList<ContractMessageItem>> {
    const sample: ContractMessageItem[] = [
      {
        id: "msg_001",
        senior_id: seniorId,
        sender: {
          user_id: "COORD_001",
          role: "coordinator",
          display_name: "Care Coordinator Pooja",
        },
        kind: "text",
        body: "Namaste! Please remember to check your BP before lunch today.",
        created_at: "2026-10-11T10:30:00+05:30",
        delivered_at: "2026-10-11T10:30:02+05:30",
        read_at: "2026-10-11T10:35:00+05:30",
      },
    ];
    return {
      items: sample,
      total: sample.length,
      limit: limit || 50,
      offset: 0,
    };
  }

  async getSeniorCues(
    seniorId: string,
    from?: string,
    to?: string
  ): Promise<ContractCueRecord[]> {
    return [
      {
        cue_type: "symptom",
        cue_value: "dizziness_standing",
        temporal_context: "past_24h",
        negated: false,
        uncertain: false,
        source_type: "phone_call",
        at: "2026-10-10T11:04:00+05:30",
      },
      {
        cue_type: "medication_adherence",
        cue_value: "delayed_morning_bp",
        temporal_context: "today",
        negated: false,
        uncertain: false,
        source_type: "senior_app",
        at: "2026-10-11T08:14:00+05:30",
      },
    ];
  }

  async getSeniorMemory(seniorId: string): Promise<ContractMemoryItem[]> {
    return [
      {
        id: "mem_001",
        kind: "family_preference",
        content: "Daughter Rohini visits every alternate Sunday afternoon.",
        status: "active",
        first_seen_at: "2026-09-01T10:00:00+05:30",
        last_seen_at: "2026-10-05T14:00:00+05:30",
        follow_up_after: null,
      },
    ];
  }

  async getSeniorFamilyInteractions(
    seniorId: string
  ): Promise<ContractFamilyInteractionItem[]> {
    return [
      {
        interaction_id: "fam_int_001",
        at: "2026-10-08T15:20:00+05:30",
        channel: "whatsapp",
        category: "routine_query",
        family_message: "Is mummy taking her diabetes tablet on time this week?",
        coordinator_reply_en:
          "Yes, 100% taken over the last 5 days. Glucometer fasting was normal at 118.",
        counselor_summary: "Reassured daughter regarding medication compliance.",
        suggested_action: "No action required.",
        escalation_needed: false,
      },
    ];
  }

  // --- Alerts Contract Methods ---

  async escalateAlert(alertId: string, note: string): Promise<ContractAlertObject> {
    const idx = this.alerts.findIndex(
      (a) => a.alert_id.toUpperCase() === alertId.toUpperCase()
    );
    if (idx !== -1) {
      this.alerts[idx].status = "ESCALATED";
      this.alerts[idx].last_updated_at = new Date().toISOString();
    }

    return {
      alert_id: alertId,
      senior_id: this.alerts[idx]?.senior_id || "S0001",
      status: "ESCALATED",
      severity: "URGENT_REVIEW",
      created_at: this.alerts[idx]?.created_at || new Date().toISOString(),
      last_updated_at: new Date().toISOString(),
      triggering_signals: ["Escalated by coordinator: " + note],
      recommended_next_step: "Immediate clinical or emergency supervisor review",
      resolution_reason: null,
      assigned_to: "Clinical Lead",
      events: [
        {
          at: new Date().toISOString(),
          from_status: "OPEN",
          to_status: "ESCALATED",
          actor: "Care Coordinator",
          note,
        },
      ],
    };
  }

  async submitAlertFeedback(
    alertId: string,
    feedback: ContractAlertFeedbackRequest
  ): Promise<any> {
    return { status: "recorded", alert_id: alertId, feedback };
  }

  // --- Calls & Messages ---

  async connectCall(
    seniorId: string,
    recordingConsent: boolean = true,
    initiator: string = "coordinator"
  ): Promise<ContractCallObject> {
    return {
      id: "call_" + Math.random().toString(36).substring(2, 9),
      senior_id: seniorId,
      kind: "phone_bridge",
      status: "queued",
      transcript_status: "pending",
      started_at: null,
      ended_at: null,
      duration_sec: null,
      recording_stored: false,
      recording_expires_at: null,
      summary: null,
      urgency_flag: false,
      turns: [],
      cues: [],
    };
  }

  async getCall(callId: string): Promise<ContractCallObject> {
    return {
      id: callId,
      senior_id: "S0042",
      kind: "phone_bridge",
      status: "completed",
      transcript_status: "done",
      started_at: "2026-10-11T14:00:00+05:30",
      ended_at: "2026-10-11T14:04:30+05:30",
      duration_sec: 270,
      recording_stored: true,
      recording_expires_at: "2026-11-11T14:00:00+05:30",
      summary: "Routine check-in call completed. Senior reported good spirits.",
      urgency_flag: false,
      turns: [
        { turn_index: 1, speaker: "coordinator", text: "Namaste!", offset_ms: 500 },
        { turn_index: 2, speaker: "senior", text: "Namaste beta, sab theek hai.", offset_ms: 2200 },
      ],
      cues: [],
    };
  }

  async processCall(callId: string): Promise<any> {
    return { status: "processing", call_id: callId };
  }

  async sendMessage(
    seniorId: string,
    body: string,
    audioBlob?: Blob,
    language?: string
  ): Promise<ContractMessageItem> {
    return {
      id: "msg_" + Math.random().toString(36).substring(2, 9),
      senior_id: seniorId,
      sender: {
        user_id: "COORD_001",
        role: "coordinator",
        display_name: "Care Coordinator",
      },
      kind: audioBlob ? "voice_note" : "text",
      body,
      language: (language as any) || "hinglish",
      created_at: new Date().toISOString(),
      delivered_at: new Date().toISOString(),
      read_at: null,
    };
  }

  async markMessageRead(messageId: string): Promise<void> {
    return;
  }

  private mockNotifications: ContractNotificationItem[] = [
    {
      id: "notif_001",
      kind: "daily_wellbeing",
      title: "नमस्ते जी!",
      body: "आज अपना हाल-चाल बताना न भूलें।",
      data: { senior_id: "S0042" },
      sent_at: new Date(Date.now() - 3600000).toISOString(),
      read_at: null,
    },
    {
      id: "notif_002",
      kind: "ai_saathi_reminder",
      title: "सहज साथी",
      body: "आपका सहज साथी आपसे बात करने के लिए तैयार है।",
      data: { senior_id: "S0042" },
      sent_at: new Date(Date.now() - 7200000).toISOString(),
      read_at: null,
    },
  ];

  private mockPreferences: Record<string, any> = {
    daily_wellbeing: true,
    ai_saathi_reminder: true,
    caretaker_visit_reminder: true,
    medication_reminder: true,
    appointment_reminder: true,
    care_update: true,
    wellbeing_concern_detected: true,
    senior_assigned: true,
    pending_followup_task: true,
    missed_checkin_verification: true,
    overdue_caretaker_visit: true,
    family_concern_submitted: true,
    reminder_time: "09:00",
  };

  async getNotifications(
    unreadOnly: boolean = true
  ): Promise<{ items: ContractNotificationItem[] }> {
    const items = unreadOnly
      ? this.mockNotifications.filter((n) => !n.read_at)
      : this.mockNotifications;
    return { items: [...items] };
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = this.mockNotifications.find((item) => item.id === id);
    if (n) {
      n.read_at = new Date().toISOString();
    }
  }

  async markAllNotificationsRead(): Promise<number> {
    let count = 0;
    const now = new Date().toISOString();
    for (const n of this.mockNotifications) {
      if (!n.read_at) {
        n.read_at = now;
        count++;
      }
    }
    return count;
  }

  async getUnreadNotificationCount(): Promise<number> {
    return this.mockNotifications.filter((n) => !n.read_at).length;
  }

  async getNotificationPreferences(): Promise<ContractNotificationPreferences> {
    return {
      preferences: { ...this.mockPreferences },
      updated_at: new Date().toISOString(),
    };
  }

  async updateNotificationPreferences(
    preferences: Record<string, any>
  ): Promise<ContractNotificationPreferences> {
    this.mockPreferences = { ...this.mockPreferences, ...preferences };
    return {
      preferences: { ...this.mockPreferences },
      updated_at: new Date().toISOString(),
    };
  }

  async registerDevice(device: ContractDeviceRegister): Promise<ContractDeviceOut> {
    return {
      id: "dev_mock_" + Math.random().toString(36).substring(2, 9),
      platform: device.platform,
      app_version: device.app_version ?? "1.0.0",
      created_at: new Date().toISOString(),
    };
  }

  // --- Senior App (/me/*) ---

  async getSeniorHome(): Promise<SeniorHomeResponse> {
    return JSON.parse(JSON.stringify(MOCK_SENIOR_HOME_DATA));
  }

  async confirmSeniorMedication(
    medicationId: string,
    scheduledAt: string
  ): Promise<{ status: string; actual_at: string }> {
    return {
      status: "taken",
      actual_at: new Date().toISOString(),
    };
  }

  async logSeniorVital(vital: {
    measurement_type: string;
    value: number;
    unit: string;
    measured_at?: string;
  }): Promise<any> {
    return { status: "recorded", vital };
  }

  async submitSeniorReport(
    text: string,
    language: string = "hindi"
  ): Promise<{ checkin_id: string }> {
    return {
      checkin_id: "chk_" + Math.random().toString(36).substring(2, 9),
    };
  }

  async callCoordinatorFromSenior(): Promise<ContractCallObject> {
    return this.connectCall("S0042", true, "senior");
  }

  // --- Ops Web Dashboard (/ops/* & /admin/*) ---

  async getOpsOverview(params?: {
    from?: string;
    to?: string;
    city?: string;
    coordinator_id?: string;
  }): Promise<OpsOverviewResponse> {
    return JSON.parse(JSON.stringify(MOCK_OPS_OVERVIEW));
  }

  async getOpsAlertsVolume(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertVolumeItem[]> {
    return [
      { day: "2026-10-09", city: "Bengaluru", severity: "HIGH", status: "RESOLVED", alerts: 8 },
      { day: "2026-10-10", city: "Bengaluru", severity: "HIGH", status: "ACKNOWLEDGED", alerts: 6 },
      { day: "2026-10-11", city: "Bengaluru", severity: "URGENT_REVIEW", status: "OPEN", alerts: 3 },
    ];
  }

  async getOpsAlertsResponseTimes(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsResponseTimesItem[]> {
    return [
      {
        alert_id: "ALT_00123",
        city: "Bengaluru",
        coordinator_id: "COORD_001",
        severity: "HIGH",
        created_at: "2026-10-11T14:10:00+05:30",
        minutes_to_ack: 14.2,
        minutes_to_resolve: 48.0,
      },
    ];
  }

  async getOpsAlertsOutcomes(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertOutcomesItem[]> {
    return [
      {
        city: "Bengaluru",
        resolution_reason: "Caretaker home visit completed; vitals rechecked",
        useful: true,
        outcome: "visited",
        alerts: 12,
      },
      {
        city: "Bengaluru",
        resolution_reason: "Coordinator telephone clarification",
        useful: true,
        outcome: "called",
        alerts: 22,
      },
    ];
  }

  async getOpsAlertsPrecision(params?: {
    from?: string;
    to?: string;
    city?: string;
  }): Promise<OpsAlertPrecisionItem[]> {
    return [
      {
        city: "Bengaluru",
        week_start: "2026-10-05",
        rated_alerts: 35,
        useful_alerts: 32,
        precision: 0.914,
      },
    ];
  }

  async getOpsCoordinators(params?: { city?: string }): Promise<OpsCoordinatorItem[]> {
    return JSON.parse(JSON.stringify(MOCK_OPS_COORDINATORS));
  }

  async getOpsCoordinatorDetail(id: string): Promise<any> {
    return {
      coordinator_id: id,
      display_name: "Care Coordinator 001",
      city: "Bengaluru",
      caseload: 22,
      open_alerts: 2,
      alerts_handled: 18,
    };
  }

  async getOpsSeniors(params?: {
    city?: string;
    risk_level?: string;
    coordinator_id?: string;
    consent_level?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<ContractPaginatedList<CoordinatorCaseloadItem>> {
    return this.getCoordinatorSeniors(params);
  }

  async getOpsCities(): Promise<OpsCityItem[]> {
    return JSON.parse(JSON.stringify(MOCK_OPS_CITIES));
  }

  async getOpsDailyReports(date?: string): Promise<OpsDailyReportItem[]> {
    return [
      {
        coordinator: {
          coordinator_id: "COORD_001",
          display_name: "Care Coordinator 001 (Pooja Rao)",
          city: "Bengaluru",
        },
        items: MOCK_PRIORITY_LIST_RESPONSE.items,
      },
    ];
  }

  async runAdminJob(jobName: string, date?: string): Promise<AdminJobRunResponse> {
    return {
      job: jobName,
      date: date || "2026-10-11",
      status: "ok",
    };
  }

  // --- Family ---

  async getFamilyWeeklySummary(week?: string): Promise<FamilyWeeklySummaryResponse> {
    return {
      senior_id: "S0042",
      week_start: week || "2026-W41",
      language: "hinglish",
      body_text:
        "Shanti ji had a safe and active week. Her blood pressure remained stable with 88% medication adherence. She enjoyed walking in the garden and spoke with her coordinator on Thursday.",
      generated_by: "samarth_ai_weekly_summarizer_v1",
    };
  }

  async getSeniorFamilySummary(
    seniorId: string,
    week?: string
  ): Promise<FamilyWeeklySummaryResponse> {
    return {
      senior_id: seniorId,
      week_start: week || "2026-W41",
      language: "hinglish",
      body_text: `Weekly care overview for Senior ${seniorId}: All routine check-ins completed smoothly. Mobility baseline maintained.`,
      generated_by: "samarth_ai_weekly_summarizer_v1",
    };
  }
}


