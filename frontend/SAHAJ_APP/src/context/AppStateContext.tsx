import React, { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Alert } from 'react-native';
import {
  AuthStatus, DataStatus, Language, MedicationItem, SeniorItem, SessionUser, UserRole, VitalsState,
} from '../types';
import * as live from '../api/live';
import { configureAuth } from '../api/http';
import { clearSession, loadSession, saveSession, saveTokens } from '../api/session';
import {
  NO_SENIOR, ZERO_VITALS, avatarColorOf, initialsOf, messageOf,
  type RiskPoint, type SeniorProfile, type VitalDto,
} from '../api/mappers';

// Calls ring real phones and are recorded, and the server may be running with a stand-in
// telephony provider. Off by default: the call screen then only simulates a call.
const REAL_CALLS = process.env.EXPO_PUBLIC_ENABLE_REAL_CALLS === 'true';

interface AppContextType {
  // Who is signed in
  authStatus: AuthStatus;
  authError: string | null;
  user: SessionUser | null;
  role: UserRole | null;
  /** The role picked on the welcome screen, before signing in. */
  pendingRole: UserRole | null;
  setPendingRole: (role: UserRole | null) => void;
  loginCoordinator: (email: string, password: string) => Promise<boolean>;
  loginSenior: (pairingCode: string) => Promise<boolean>;
  logout: () => Promise<void>;
  /** Kept for the old "Change Role" button: null signs out, a role starts sign-in for that role. */
  setRole: (role: UserRole | null) => void;

  // Loading real data
  dataStatus: DataStatus;
  dataError: string | null;
  refreshData: () => Promise<void>;

  language: Language;
  setLanguage: (lang: Language) => void;
  activeScreen: string;
  setActiveScreen: (screen: string) => void;

  // Seniors
  seniorsList: SeniorItem[];
  /** Everyone in the coordinator's caseload (the ranked list can be shorter). */
  caseloadTotal: number;
  activeSenior: SeniorItem;
  /** Detail of the active senior, for the overview and trend screens. null until loaded. */
  seniorProfile: SeniorProfile | null;
  riskHistory: RiskPoint[];
  readings: VitalDto[];
  lastCall: live.LastCall | null;
  detailLoading: boolean;
  setActiveSeniorById: (id: string) => void;
  createPairingCode: () => Promise<{ pairing_code: string; expires_in: number }>;

  // Medications (one item per dose)
  medications: MedicationItem[];
  confirmMedication: (id: string) => Promise<void>;

  // Vitals
  vitals: VitalsState;
  updateVitals: (newVitals: Partial<VitalsState>) => Promise<void>;

  // Call & alert state
  activeCall: { active: boolean; recipient: string; message: string } | null;
  startCall: (recipientName: string, seniorId?: string) => Promise<void>;
  endCall: () => void;

  alertResolved: boolean;
  markAlertActionTaken: () => Promise<boolean>;

  checkInStatus: string | null;
  submitQuickCheckIn: (feeling: string) => Promise<boolean>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: ReactNode }) => {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('booting');
  const [authError, setAuthError] = useState<string | null>(null);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [pendingRole, setPendingRole] = useState<UserRole | null>(null);
  const [language, setLanguage] = useState<Language>('hi');
  const [activeScreen, setActiveScreen] = useState<string>('welcome');

  const [dataStatus, setDataStatus] = useState<DataStatus>('idle');
  const [dataError, setDataError] = useState<string | null>(null);
  const [seniorsList, setSeniorsList] = useState<SeniorItem[]>([]);
  const [caseloadTotal, setCaseloadTotal] = useState(0);
  const [activeSenior, setActiveSenior] = useState<SeniorItem>(NO_SENIOR);
  const [seniorProfile, setSeniorProfile] = useState<SeniorProfile | null>(null);
  const [riskHistory, setRiskHistory] = useState<RiskPoint[]>([]);
  const [readings, setReadings] = useState<VitalDto[]>([]);
  const [lastCall, setLastCall] = useState<live.LastCall | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [medications, setMedications] = useState<MedicationItem[]>([]);
  const [vitals, setVitals] = useState<VitalsState>(ZERO_VITALS);

  const [activeCall, setActiveCall] = useState<{ active: boolean; recipient: string; message: string } | null>(null);
  const [alertResolved, setAlertResolved] = useState<boolean>(false);
  const [checkInStatus, setCheckInStatus] = useState<string | null>(null);

  const tokens = useRef<{ access: string | null; refresh: string | null }>({ access: null, refresh: null });
  const deviceToken = useRef<string | null>(null);
  const reportDate = useRef<string>('');
  const detailRequest = useRef(0); // ignore a slow reply for a senior the coordinator has already left

  const role: UserRole | null = user && (user.role === 'coordinator' || user.role === 'senior') ? user.role : null;

  // ---- sessions ------------------------------------------------------------------------------------
  const clearDetail = useCallback(() => {
    setMedications([]);
    setVitals(ZERO_VITALS);
    setSeniorProfile(null);
    setRiskHistory([]);
    setReadings([]);
    setLastCall(null);
  }, []);

  const resetData = useCallback(() => {
    clearDetail();
    setCaseloadTotal(0);
    setDetailLoading(false);
    setSeniorsList([]);
    setActiveSenior(NO_SENIOR);
    setDataStatus('idle');
    setDataError(null);
    setAlertResolved(false);
    setCheckInStatus(null);
    setActiveCall(null);
  }, [clearDetail]);

  // ---- data ----------------------------------------------------------------------------------------
  const loadSeniorDetail = useCallback(async (seniorId: string, date: string) => {
    const ticket = ++detailRequest.current;
    clearDetail();
    setDetailLoading(true);
    try {
      const d = await live.fetchSeniorDetail(seniorId, date);
      if (ticket !== detailRequest.current) return;
      setMedications(d.medications);
      setVitals(d.vitals);
      setSeniorProfile(d.profile);
      setRiskHistory(d.riskHistory);
      setReadings(d.readings);
      setLastCall(d.lastCall);
      setDetailLoading(false);
    } catch (e) {
      if (ticket !== detailRequest.current) return;
      setDetailLoading(false);
      setDataError(messageOf(e));
      setDataStatus('error');
    }
  }, [clearDetail]);

  const loadData = useCallback(
    async (u: SessionUser, keepSeniorId?: string) => {
      setDataStatus('loading');
      setDataError(null);
      try {
        if (u.role === 'coordinator') {
          const today = await live.fetchToday();
          reportDate.current = today.date;
          setSeniorsList(today.seniors);
          setCaseloadTotal(today.caseloadTotal);
          // a refresh keeps the senior the coordinator is looking at, if they are still on the list
          const shown = today.seniors.find((s) => s.senior_id === keepSeniorId) ?? today.seniors[0];
          setActiveSenior(shown ?? NO_SENIOR);
          if (!keepSeniorId) setAlertResolved(false);
          if (shown) await loadSeniorDetail(shown.senior_id, today.date);
          else clearDetail();
        } else {
          const home = await live.fetchHome();
          const me: SeniorItem = {
            ...NO_SENIOR,
            senior_id: u.external_ref ?? '',
            display_name: home.greeting || u.display_name,
            preferred_language: home.language,
            avatarInitials: initialsOf(home.greeting || u.display_name),
            avatarColor: avatarColorOf(u.external_ref ?? u.id),
          };
          setActiveSenior(me);
          setSeniorsList([me]);
          clearDetail();
          setMedications(home.medications);
          setLanguage(home.language === 'english' ? 'en' : 'hi');
        }
        setDataStatus((s) => (s === 'error' ? s : 'ready'));
      } catch (e) {
        setDataError(messageOf(e));
        setDataStatus('error');
      }
    },
    [loadSeniorDetail, clearDetail]
  );

  const signOut = useCallback(
    async (message: string | null = null) => {
      tokens.current = { access: null, refresh: null };
      deviceToken.current = null;
      await clearSession();
      resetData();
      setUser(null);
      setPendingRole(null);
      setAuthError(message);
      setAuthStatus('signedOut');
    },
    [resetData]
  );
  const signOutRef = useRef(signOut);
  useEffect(() => {
    signOutRef.current = signOut;
  }, [signOut]);
  const userRef = useRef<SessionUser | null>(null);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const adopt = useCallback(async (r: live.LoginResult) => {
    tokens.current = { access: r.access_token, refresh: r.refresh_token ?? null };
    if (r.device_token) deviceToken.current = r.device_token;
    await saveSession({
      accessToken: r.access_token,
      refreshToken: r.refresh_token ?? null,
      user: r.user,
      deviceToken: deviceToken.current,
    });
    setUser(r.user);
    setAuthError(null);
    setAuthStatus('signedIn');
    void loadData(r.user);
  }, [loadData]);

  // Wire the HTTP client to the current tokens, and restore a saved session on launch.
  useEffect(() => {
    configureAuth({
      getTokens: () => tokens.current,
      setTokens: (access, refresh) => {
        tokens.current = { access, refresh };
        void saveTokens(access, refresh);
      },
      renew: async () => {
        const seniorId = userRef.current?.external_ref;
        if (!deviceToken.current || !seniorId) return false;
        try {
          const r = await live.loginWithDevice(seniorId, deviceToken.current);
          tokens.current = { access: r.access_token, refresh: r.refresh_token ?? null };
          await saveTokens(r.access_token, r.refresh_token ?? null);
          return true;
        } catch {
          return false;
        }
      },
      onExpired: () => void signOutRef.current('Your session has expired. Please sign in again.'),
    });
    let cancelled = false;
    (async () => {
      const saved = await loadSession();
      if (cancelled) return;
      if (saved) {
        tokens.current = { access: saved.accessToken, refresh: saved.refreshToken };
        deviceToken.current = saved.deviceToken ?? null;
        setUser(saved.user);
        setAuthStatus('signedIn');
        void loadData(saved.user);
      } else {
        setAuthStatus('signedOut');
      }
    })();
    return () => {
      cancelled = true;
      configureAuth(null);
    };
  }, [loadData]);

  const loginCoordinator = useCallback(
    async (email: string, password: string) => {
      setAuthStatus('signingIn');
      setAuthError(null);
      try {
        const r = await live.loginWithPassword(email, password);
        if (r.user.role !== 'coordinator') {
          setAuthStatus('signedOut');
          setAuthError(
            r.user.role === 'senior'
              ? 'This is a senior account. Choose "Senior" and use your pairing code.'
              : 'This app is for care coordinators and seniors. Organization managers sign in on the web portal.'
          );
          return false;
        }
        await adopt(r);
        return true;
      } catch (e) {
        setAuthStatus('signedOut');
        setAuthError(messageOf(e));
        return false;
      }
    },
    [adopt]
  );

  const loginSenior = useCallback(
    async (pairingCode: string) => {
      setAuthStatus('signingIn');
      setAuthError(null);
      try {
        await adopt(await live.pairWithCode(pairingCode));
        return true;
      } catch (e) {
        setAuthStatus('signedOut');
        setAuthError(messageOf(e));
        return false;
      }
    },
    [adopt]
  );

  const logout = useCallback(() => signOut(null), [signOut]);

  const setRole = (next: UserRole | null) => {
    if (next === null) void logout();
    else setPendingRole(next);
  };

  const refreshData = useCallback(async () => {
    if (user) await loadData(user, activeSenior.senior_id || undefined);
  }, [user, loadData, activeSenior.senior_id]);

  const setActiveSeniorById = (id: string) => {
    const found = seniorsList.find((s) => s.senior_id === id);
    if (!found) return;
    setActiveSenior(found);
    setAlertResolved(false);
    if (role === 'coordinator') void loadSeniorDetail(found.senior_id, reportDate.current);
  };

  const createPairingCode = () => {
    if (!activeSenior.senior_id) return Promise.reject(new Error('Choose a senior first.'));
    return live.createPairingCode(activeSenior.senior_id);
  };

  // ---- actions ---------------------------------------------------------------------------------------
  const confirmMedication = async (doseId: string) => {
    if (role !== 'senior') {
      Alert.alert('Only the senior can do this', 'A dose is marked as taken from the senior\'s own phone.');
      return;
    }
    const before = medications;
    setMedications((prev) => prev.map((m) => (m.medication_id === doseId ? { ...m, status: 'taken' } : m)));
    try {
      await live.confirmDose(doseId);
    } catch (e) {
      setMedications(before);
      Alert.alert('Could not save', messageOf(e));
    }
  };

  const updateVitals = async (changed: Partial<VitalsState>) => {
    const before = vitals;
    setVitals((prev) => ({ ...prev, ...changed }));
    try {
      await live.postVitals(changed);
    } catch (e) {
      setVitals(before);
      Alert.alert('Could not save', messageOf(e));
    }
  };

  const startCall = async (recipientName: string, seniorId?: string) => {
    if (!REAL_CALLS) {
      setActiveCall({ active: true, recipient: recipientName, message: 'Demo mode: no real call is placed.' });
      return;
    }
    setActiveCall({ active: true, recipient: recipientName, message: 'Connecting phone bridge (recorded session)...' });
    try {
      if (role === 'coordinator') await live.startCoordinatorCall(seniorId || activeSenior.senior_id);
      else await live.startSeniorCall();
    } catch (e) {
      setActiveCall(null);
      Alert.alert('Could not start the call', messageOf(e));
    }
  };

  const endCall = () => setActiveCall(null);

  const markAlertActionTaken = async (): Promise<boolean> => {
    const alertId = activeSenior.alert_id;
    if (!alertId) {
      Alert.alert('No open alert', `${activeSenior.display_name} has no open alert right now.`);
      return false;
    }
    try {
      await live.resolveAlertWithFeedback(alertId, 'Coordinator followed up with the senior.');
      await refreshData();
      setAlertResolved(true);
      return true;
    } catch (e) {
      Alert.alert('Could not resolve the alert', messageOf(e));
      return false;
    }
  };

  const submitQuickCheckIn = async (feeling: string): Promise<boolean> => {
    try {
      await live.postReport(`Feeling: ${feeling}`, language === 'hi' ? 'hindi' : 'english');
      setCheckInStatus(`Submitted: "${feeling}"`);
      return true;
    } catch (e) {
      setCheckInStatus(null);
      Alert.alert('Could not send', messageOf(e));
      return false;
    }
  };

  return (
    <AppContext.Provider
      value={{
        authStatus, authError, user, role, pendingRole, setPendingRole, loginCoordinator, loginSenior, logout, setRole,
        dataStatus, dataError, refreshData,
        language, setLanguage, activeScreen, setActiveScreen,
        seniorsList, caseloadTotal, activeSenior, seniorProfile, riskHistory, readings, lastCall, detailLoading,
        setActiveSeniorById, createPairingCode,
        medications, confirmMedication,
        vitals, updateVitals,
        activeCall, startCall, endCall,
        alertResolved, markAlertActionTaken,
        checkInStatus, submitQuickCheckIn,
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
