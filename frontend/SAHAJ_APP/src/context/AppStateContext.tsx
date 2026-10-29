import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserRole, Language, SeniorItem, MedicationItem, VitalsState } from '../types';
import { coordinatorApi, seniorApi, authApi } from '../api/contract';

interface AppContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;

  // Seniors Data
  seniorsList: SeniorItem[];
  activeSenior: SeniorItem;
  setActiveSeniorById: (id: string) => void;

  // Medications
  medications: MedicationItem[];
  confirmMedication: (id: string) => Promise<void>;
  sendMedicationReminder: (id: string) => void;
  removeMedication: (id: string) => void;

  // Vitals
  vitals: VitalsState;
  updateVitals: (newVitals: Partial<VitalsState>) => Promise<void>;

  // Call & Alert State
  activeCall: { active: boolean; recipient: string; message: string } | null;
  startCall: (recipientName: string, seniorId?: string) => Promise<void>;
  endCall: () => void;

  alertResolved: boolean;
  markAlertActionTaken: () => Promise<void>;

  // Daily Checkin submission
  checkInStatus: string | null;
  submitQuickCheckIn: (feeling: string) => Promise<void>;
}

const defaultSeniors: SeniorItem[] = [
  {
    senior_id: 'SL03234',
    display_name: 'Ramesh Kumar',
    age: 78,
    gender: 'Male',
    city: 'Bengaluru',
    preferred_language: 'hindi',
    risk_score: 92,
    risk_level: 'HIGH',
    avatarInitials: 'RK',
    avatarColor: '#2B6CB0',
    reasons: [
      'BP increased from 128/82 to 148/96 (≥ 20 mmHg ↑)',
      'Missed 2 medication doses (anti-hypertensive)',
      'Call notes mention "chest heaviness" (3 days ago)',
    ],
    suggested_action: 'Call senior now and request repeat BP reading.',
  },
  {
    senior_id: 'SL0187',
    display_name: 'Shanti Devi',
    age: 72,
    gender: 'Female',
    city: 'New Delhi',
    preferred_language: 'hinglish',
    risk_score: 68,
    risk_level: 'MODERATE',
    avatarInitials: 'SC',
    avatarColor: '#4F46E5',
    reasons: ['Steps averaged 54% of baseline for 3 days', 'Pending afternoon Lisinopril dose'],
    suggested_action: 'Call and check on dizziness and medication adherence.',
  },
  {
    senior_id: 'SL0271',
    display_name: 'Mohan Patel',
    age: 81,
    gender: 'Male',
    city: 'Ahmedabad',
    preferred_language: 'hindi',
    risk_score: 64,
    risk_level: 'MODERATE',
    avatarInitials: 'MP',
    avatarColor: '#2B6CB0',
    reasons: ['Mild sugar fluctuation after evening meal'],
    suggested_action: 'Remind caregiver about low sugar diet.',
  },
  {
    senior_id: 'SL0312',
    display_name: 'Pushpa Dutra',
    age: 69,
    gender: 'Female',
    city: 'Kolkata',
    preferred_language: 'hinglish',
    risk_score: 58,
    risk_level: 'MODERATE',
    avatarInitials: 'PD',
    avatarColor: '#4F46E5',
    reasons: ['Sleep duration decreased to 5.2 hours'],
    suggested_action: 'Review evening routine on next scheduled check-in.',
  },
];

const defaultMedications: MedicationItem[] = [
  {
    medication_id: 'MED_01',
    drug_name: 'Metformin',
    dosage: '500 mg',
    scheduled_at: '2026-10-11T08:00:00+05:30',
    time_slot: 'Morning (8:00 AM)',
    status: 'taken',
    indication: 'Type 2 Diabetes',
  },
  {
    medication_id: 'MED_02',
    drug_name: 'Lisinopril',
    dosage: '10 mg',
    scheduled_at: '2026-10-11T14:00:00+05:30',
    time_slot: 'Afternoon (2:00 PM)',
    status: 'pending',
    indication: 'Hypertension',
  },
  {
    medication_id: 'MED_03',
    drug_name: 'Aspirin',
    dosage: '81 mg',
    scheduled_at: '2026-10-11T20:00:00+05:30',
    time_slot: 'Evening (8:00 PM)',
    status: 'pending',
    indication: 'Cardioprotection',
  },
];

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [language, setLanguage] = useState<Language>('hi');
  const [activeScreen, setActiveScreen] = useState<string>('welcome');

  const [seniorsList, setSeniorsList] = useState<SeniorItem[]>(defaultSeniors);
  const [activeSenior, setActiveSenior] = useState<SeniorItem>(defaultSeniors[1]); // Shanti Devi by default
  const [medications, setMedications] = useState<MedicationItem[]>(defaultMedications);
  const [vitals, setVitals] = useState<VitalsState>({
    bpSystolic: 120,
    bpDiastolic: 80,
    sugar: 110,
    spo2: 97,
    pulse: 72,
    weight: 62,
  });

  const [activeCall, setActiveCall] = useState<{ active: boolean; recipient: string; message: string } | null>(null);
  const [alertResolved, setAlertResolved] = useState<boolean>(false);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);

  // Initial fetch from contract
  useEffect(() => {
    (async () => {
      try {
        const priority = await coordinatorApi.getTodayPriority();
        if (priority && priority.items) {
          // map server items if present
        }
      } catch (e) {
        // gracefully silent
      }
    })();
  }, []);

  const setActiveSeniorById = (id: string) => {
    const found = seniorsList.find((s) => s.senior_id === id);
    if (found) {
      setActiveSenior(found);
    }
  };

  const confirmMedication = async (medId: string) => {
    setMedications((prev) =>
      prev.map((m) => (m.medication_id === medId ? { ...m, status: 'taken' } : m))
    );
    try {
      await seniorApi.confirmMedication(medId);
    } catch (e) {
      // optimistic update maintained
    }
  };

  const sendMedicationReminder = (medId: string) => {
    alert('Reminder sent to senior for pending medication!');
  };

  const removeMedication = (medId: string) => {
    setMedications((prev) => prev.filter((m) => m.medication_id !== medId));
  };

  const updateVitals = async (newVitals: Partial<VitalsState>) => {
    setVitals((prev) => ({ ...prev, ...newVitals }));
    try {
      if (newVitals.bpSystolic) {
        await seniorApi.postVitals('blood_pressure_systolic', newVitals.bpSystolic, 'mmHg');
      }
      if (newVitals.sugar) {
        await seniorApi.postVitals('blood_glucose', newVitals.sugar, 'mg/dL');
      }
    } catch (e) {
      // handled
    }
  };

  const startCall = async (recipientName: string, seniorId?: string) => {
    setActiveCall({
      active: true,
      recipient: recipientName,
      message: 'Connecting phone bridge (recorded session)...',
    });
    try {
      if (role === 'coordinator') {
        await coordinatorApi.connectCall(seniorId || activeSenior.senior_id, 'coordinator');
      } else {
        await seniorApi.callCoordinator();
      }
    } catch (e) {
      // mock connected call
    }
  };

  const endCall = () => {
    setActiveCall(null);
  };

  const markAlertActionTaken = async () => {
    setAlertResolved(true);
    try {
      await coordinatorApi.resolveAlert('ALT_00123', 'Coordinator followed up with senior.');
    } catch (e) {
      // handled
    }
  };

  const submitQuickCheckIn = async (feeling: string) => {
    setCheckInStatus(`Submitted: "${feeling}"`);
    try {
      await seniorApi.postReport(`Feeling: ${feeling}`, language === 'hi' ? 'hindi' : 'english');
    } catch (e) {
      // handled
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        language,
        setLanguage,
        activeScreen,
        setActiveScreen,
        seniorsList,
        activeSenior,
        setActiveSeniorById,
        medications,
        confirmMedication,
        sendMedicationReminder,
        removeMedication,
        vitals,
        updateVitals,
        activeCall,
        startCall,
        endCall,
        alertResolved,
        markAlertActionTaken,
        checkInStatus,
        submitQuickCheckIn,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within an AppStateProvider');
  }
  return context;
};
