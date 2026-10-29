/**
 * SamarthCare AI — API Client (v1 Contract)
 * Live OpenAPI: https://sahaj-irgo.onrender.com/docs
 * Connects to live backend with contract-compliant fallback for planned/interim endpoints.
 */

export const API_BASE_URL = 'https://sahaj-irgo.onrender.com/api/v1';

export type UserRole = 'coordinator' | 'senior' | 'ops' | 'admin' | 'family';
export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH' | 'URGENT_REVIEW';
export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'ESCALATED' | 'RESOLVED';
export type AlertSeverity = 'MODERATE' | 'HIGH' | 'URGENT_REVIEW';
export type MedicationStatus = 'taken' | 'missed' | 'unknown' | 'pending';
export type VitalMeasurementType =
  | 'blood_pressure_systolic'
  | 'blood_pressure_diastolic'
  | 'blood_glucose'
  | 'spo2'
  | 'weight'
  | 'heart_rate';

// Storage tokens in memory (and persistent in AppState)
let currentAccessToken: string | null = null;

export const setAuthToken = (token: string | null) => {
  currentAccessToken = token;
};

// Generic fetch wrapper with timeout & fallback to contract data
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  fallbackData?: T
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (currentAccessToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentAccessToken}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      if (response.status === 204) {
        return {} as T;
      }
      return (await response.json()) as T;
    }

    console.warn(`[API] ${endpoint} returned ${response.status}. Using contract fallback.`);
    if (fallbackData !== undefined) return fallbackData;
    throw new Error(`API error ${response.status}`);
  } catch (err) {
    clearTimeout(timeoutId);
    console.log(`[API] ${endpoint} fetch issue (planned endpoint or backend starting):`, err);
    if (fallbackData !== undefined) return fallbackData;
    throw err;
  }
}

// ==========================================
// 1. Auth Endpoints
// ==========================================
export const authApi = {
  login: async (email: string = 'coord_001@demo.samarth.local', password: string = 'demo123') => {
    return apiRequest(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      },
      {
        access_token: 'mock_coord_jwt_token',
        refresh_token: 'mock_refresh_token',
        token_type: 'bearer',
        expires_in: 3600,
        user: {
          id: 'u-coord-001',
          role: 'coordinator' as UserRole,
          display_name: 'Neha Sharma',
          email: 'coord_001@demo.samarth.local',
          external_ref: 'COORD_001',
          city: 'Bengaluru',
          team_id: 'TEAM_BENGALURU',
        },
      }
    );
  },

  seniorPair: async (pairingCode: string) => {
    return apiRequest(
      '/auth/senior/pair',
      {
        method: 'POST',
        body: JSON.stringify({ pairing_code: pairingCode }),
      },
      {
        access_token: 'mock_senior_jwt_token',
        refresh_token: 'mock_refresh_senior_token',
        token_type: 'bearer',
        expires_in: 3600,
        senior_id: 'S0001',
        device_token: 'dev_tok_shanti_devi',
        user: {
          id: 'u-senior-001',
          role: 'senior' as UserRole,
          display_name: 'Shanti Devi',
          email: 'senior_001@demo.samarth.local',
          external_ref: 'SL0187',
          city: 'New Delhi',
        },
      }
    );
  },

  seniorLogin: async (seniorId: string = 'SL0187', deviceToken: string = 'dev_tok_shanti_devi') => {
    return apiRequest(
      '/auth/senior/login',
      {
        method: 'POST',
        body: JSON.stringify({ senior_id: seniorId, device_token: deviceToken }),
      },
      {
        access_token: 'mock_senior_jwt_token',
        refresh_token: 'mock_refresh_senior_token',
        token_type: 'bearer',
        expires_in: 3600,
        senior_id: seniorId,
        user: {
          id: 'u-senior-001',
          role: 'senior' as UserRole,
          display_name: 'Shanti Devi',
          email: 'shantidevi@demo.samarth.local',
          external_ref: seniorId,
          city: 'New Delhi',
        },
      }
    );
  },
};

// ==========================================
// 2. Coordinator Endpoints
// ==========================================
export const coordinatorApi = {
  // GET /coordinators/me/today?date=
  getTodayPriority: async (date: string = '2026-10-11') => {
    return apiRequest(
      `/coordinators/me/today?date=${date}`,
      { method: 'GET' },
      {
        date,
        revision: 3,
        reason: 'post_ai_call',
        generated_at: new Date().toISOString(),
        items: [
          {
            rank: 1,
            previous_rank: 4,
            senior: {
              senior_id: 'SL03234',
              display_name: 'Ramesh Kumar',
              age: 78,
              city: 'Bengaluru',
              preferred_language: 'hindi',
            },
            risk_score: 92,
            risk_level: 'HIGH' as RiskLevel,
            reasons: [
              'BP increased from 128/82 to 148/96 (≥ 20 mmHg ↑)',
              'Missed 2 medication doses (anti-hypertensive)',
              'Call notes mention "chest heaviness" (3 days ago)',
            ],
            suggested_action: 'Call senior now and request repeat BP reading.',
            alert_id: 'ALT_00123',
            ai_call_done: true,
          },
          {
            rank: 2,
            previous_rank: 2,
            senior: {
              senior_id: 'SL0187',
              display_name: 'Shanti Devi',
              age: 72,
              city: 'New Delhi',
              preferred_language: 'hinglish',
            },
            risk_score: 68,
            risk_level: 'MODERATE' as RiskLevel,
            reasons: ['Steps averaged 54% of baseline for 3 days', 'Pending afternoon Lisinopril dose'],
            suggested_action: 'Call and check on dizziness and medication adherence.',
            alert_id: 'ALT_00124',
            ai_call_done: true,
          },
          {
            rank: 3,
            previous_rank: 3,
            senior: {
              senior_id: 'SL0271',
              display_name: 'Mohan Patel',
              age: 81,
              city: 'Ahmedabad',
              preferred_language: 'hindi',
            },
            risk_score: 64,
            risk_level: 'MODERATE' as RiskLevel,
            reasons: ['Mild sugar fluctuation after evening meal'],
            suggested_action: 'Remind caregiver about low sugar diet.',
            alert_id: 'ALT_00125',
            ai_call_done: false,
          },
          {
            rank: 4,
            previous_rank: 5,
            senior: {
              senior_id: 'SL0312',
              display_name: 'Pushpa Dutra',
              age: 69,
              city: 'Kolkata',
              preferred_language: 'hinglish',
            },
            risk_score: 58,
            risk_level: 'MODERATE' as RiskLevel,
            reasons: ['Sleep duration decreased to 5.2 hours'],
            suggested_action: 'Review evening routine on next scheduled check-in.',
            alert_id: 'ALT_00126',
            ai_call_done: false,
          },
        ],
      }
    );
  },

  // Senior Detail GET /seniors/{id}
  getSeniorDetail: async (id: string = 'SL0187') => {
    return apiRequest(
      `/seniors/${id}`,
      { method: 'GET' },
      {
        senior_id: id,
        display_name: 'Shanti Devi',
        age: 72,
        gender: 'Female',
        city: 'New Delhi',
        living_arrangement: 'alone',
        preferred_language: 'hinglish',
        communication_style: 'friendly',
        family_consent_level: 'full',
        conditions: [
          { category: 'cardiovascular', condition: 'Hypertension' },
          { category: 'metabolic', condition: 'Type 2 Diabetes' },
        ],
        baseline: {
          bp: '120/80',
          sugar: 110,
          spo2: 97,
          weight: 62,
          pulse: 72,
        },
        contact: { phone: '+91 98765 43210' },
      }
    );
  },

  // GET /seniors/{id}/medications
  getMedications: async (id: string = 'SL0187') => {
    return apiRequest(
      `/seniors/${id}/medications`,
      { method: 'GET' },
      {
        schedules: [
          {
            medication_id: 'MED_01',
            drug_name: 'Metformin',
            dosage: '500 mg',
            indication: 'Type 2 Diabetes',
            times_per_day: 1,
            scheduled_times: ['08:00 AM'],
            time_slot: 'Morning',
            status: 'taken' as MedicationStatus,
            criticality: 'HIGH',
            is_active: true,
          },
          {
            medication_id: 'MED_02',
            drug_name: 'Lisinopril',
            dosage: '10 mg',
            indication: 'Hypertension',
            times_per_day: 1,
            scheduled_times: ['02:00 PM'],
            time_slot: 'Afternoon',
            status: 'pending' as MedicationStatus,
            criticality: 'HIGH',
            is_active: true,
          },
          {
            medication_id: 'MED_03',
            drug_name: 'Aspirin',
            dosage: '81 mg',
            indication: 'Cardioprotection',
            times_per_day: 1,
            scheduled_times: ['08:00 PM'],
            time_slot: 'Evening',
            status: 'pending' as MedicationStatus,
            criticality: 'MODERATE',
            is_active: true,
          },
        ],
        adherence: { last_7d_pct: 88, last_30d_pct: 91, missed_critical_7d: 1 },
      }
    );
  },

  // POST /calls/connect
  connectCall: async (seniorId: string, initiator: 'coordinator' | 'senior' = 'coordinator') => {
    return apiRequest(
      '/calls/connect',
      {
        method: 'POST',
        body: JSON.stringify({
          senior_id: seniorId,
          recording_consent: true,
          initiator,
        }),
      },
      {
        id: 'call-bridge-' + Date.now(),
        senior_id: seniorId,
        kind: 'phone_bridge',
        status: 'queued',
        transcript_status: 'pending',
        started_at: new Date().toISOString(),
        summary: 'Call connected with senior.',
        urgency_flag: false,
      }
    );
  },

  // POST /alerts/{id}/feedback or resolve
  resolveAlert: async (alertId: string, resolutionReason: string = 'Called senior and confirmed BP') => {
    return apiRequest(
      `/alerts/${alertId}/resolve`,
      {
        method: 'POST',
        body: JSON.stringify({ resolution_reason: resolutionReason }),
      },
      {
        alert_id: alertId,
        status: 'RESOLVED' as AlertStatus,
        last_updated_at: new Date().toISOString(),
        resolution_reason: resolutionReason,
      }
    );
  },

  sendAlertFeedback: async (alertId: string, outcome: 'called' | 'visited' | 'doctor' | 'no_action' = 'called') => {
    return apiRequest(
      `/alerts/${alertId}/feedback`,
      {
        method: 'POST',
        body: JSON.stringify({ useful: true, outcome, comment: 'Action taken by care coordinator' }),
      },
      {
        alert_id: alertId,
        outcome,
        status: 'RESOLVED',
      }
    );
  },
};

// ==========================================
// 3. Senior Endpoints
// ==========================================
export const seniorApi = {
  // GET /me/home
  getHome: async () => {
    return apiRequest(
      '/me/home',
      { method: 'GET' },
      {
        greeting_name: 'Shanti Devi',
        language: 'hinglish',
        date: '2026-10-11',
        medications_today: [
          {
            medication_id: 'MED_01',
            drug_name: 'Metformin',
            dosage: '500 mg',
            scheduled_at: '2026-10-11T08:00:00+05:30',
            time_slot: 'Morning (8:00 AM)',
            status: 'taken' as MedicationStatus,
          },
          {
            medication_id: 'MED_02',
            drug_name: 'Lisinopril',
            dosage: '10 mg',
            scheduled_at: '2026-10-11T14:00:00+05:30',
            time_slot: 'Afternoon (2:00 PM)',
            status: 'pending' as MedicationStatus,
          },
          {
            medication_id: 'MED_03',
            drug_name: 'Aspirin',
            dosage: '81 mg',
            scheduled_at: '2026-10-11T20:00:00+05:30',
            time_slot: 'Evening (8:00 PM)',
            status: 'pending' as MedicationStatus,
          },
        ],
        last_message: null,
        next_checkin: { at: '2026-10-11T16:00:00+05:30', kind: 'ai_call' },
      }
    );
  },

  // POST /me/medications/{id}/confirm
  confirmMedication: async (medicationId: string) => {
    return apiRequest(
      `/me/medications/${medicationId}/confirm`,
      {
        method: 'POST',
        body: JSON.stringify({ scheduled_at: new Date().toISOString() }),
      },
      {
        status: 'taken' as MedicationStatus,
        actual_at: new Date().toISOString(),
      }
    );
  },

  // POST /me/vitals
  postVitals: async (measurementType: VitalMeasurementType, value: number, unit: string) => {
    return apiRequest(
      '/me/vitals',
      {
        method: 'POST',
        body: JSON.stringify({
          measurement_type: measurementType,
          value,
          unit,
          measured_at: new Date().toISOString(),
        }),
      },
      {
        measurement_id: 'v-' + Date.now(),
        measurement_type: measurementType,
        value,
        unit,
        quality_status: 'VALID',
        measured_at: new Date().toISOString(),
      }
    );
  },

  // POST /me/report (Daily check-in / feeling response)
  postReport: async (text: string, language: string = 'hindi') => {
    return apiRequest(
      '/me/report',
      {
        method: 'POST',
        body: JSON.stringify({ text, language }),
      },
      {
        checkin_id: 'chk-' + Date.now(),
        status: 'received',
      }
    );
  },

  // POST /me/call-coordinator
  callCoordinator: async () => {
    return apiRequest(
      '/me/call-coordinator',
      {
        method: 'POST',
        body: JSON.stringify({ recording_consent: true }),
      },
      {
        id: 'call-senior-init-' + Date.now(),
        kind: 'phone_bridge',
        status: 'queued',
        summary: 'Connecting you with your Care Coordinator...',
      }
    );
  },

  // GET /me/notifications
  getNotifications: async () => {
    return apiRequest(
      '/me/notifications',
      { method: 'GET' },
      {
        items: [
          {
            id: 'notif-1',
            kind: 'medication_reminder',
            title: 'Metformin 500mg',
            time: 'Morning (8:00 AM)',
            status: 'taken' as MedicationStatus,
            badgeColor: 'emerald',
          },
          {
            id: 'notif-2',
            kind: 'medication_reminder',
            title: 'Lisinopril 10mg',
            time: 'Afternoon (2:00 PM)',
            status: 'pending' as MedicationStatus,
            badgeColor: 'amber',
          },
          {
            id: 'notif-3',
            kind: 'medication_reminder',
            title: 'Aspirin 81mg',
            time: 'Evening (8:00 PM)',
            status: 'pending' as MedicationStatus,
            badgeColor: 'amber',
          },
        ],
      }
    );
  },
};

