import React, { useState } from 'react';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  Share,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppState } from '../context/AppStateContext';
import { formatPairingCode } from '../api/mappers';

// Screens
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { LoginScreen } from '../screens/LoginScreen';

// Coordinator Screens
import { CoordinatorDashboard } from '../screens/coordinator/CoordinatorDashboard';
import { SeniorOverviewScreen } from '../screens/coordinator/SeniorOverviewScreen';
import { HealthTrendsScreen } from '../screens/coordinator/HealthTrendsScreen';
import { MedicationManagementScreen } from '../screens/coordinator/MedicationManagementScreen';
import { CoordinatorCallNotesScreen } from '../screens/coordinator/CoordinatorCallNotesScreen';
import { CoordinatorBottomNav, CoordinatorTab } from '../components/common/CoordinatorBottomNav';

// Senior Screens
import { SeniorHomeScreen } from '../screens/senior/SeniorHomeScreen';
import { DailyCheckInScreen } from '../screens/senior/DailyCheckInScreen';
import { VoiceCallScreen } from '../screens/senior/VoiceCallScreen';
import { EnterVitalsScreen } from '../screens/senior/EnterVitalsScreen';
import { SeniorNotificationsScreen } from '../screens/senior/SeniorNotificationsScreen';
import { SeniorBottomNav, SeniorTab } from '../components/common/SeniorBottomNav';

import { Phone, PhoneOff, UserCheck, RefreshCw } from 'lucide-react-native';

export default function AppEntry() {
  const {
    role,
    pendingRole,
    setPendingRole,
    authStatus,
    user,
    logout,
    dataStatus,
    dataError,
    refreshData,
    seniorsList,
    createPairingCode,
    activeSenior,
    setActiveSeniorById,
    activeCall,
    endCall,
    language,
    setLanguage,
  } = useAppState();

  const insets = useSafeAreaInsets();

  // Coordinator Navigation Sub-state
  const [coordTab, setCoordTab] = useState<CoordinatorTab>('home');
  const [coordSubView, setCoordSubView] = useState<'overview' | 'trends' | 'medications' | 'notes'>('overview');

  // Senior Navigation Sub-state
  const [seniorTab, setSeniorTab] = useState<SeniorTab>('home');

  // A coordinator can show a code that pairs a senior's phone with this app
  const [pairing, setPairing] = useState<{ code: string; minutes: number } | null>(null);
  const [pairingError, setPairingError] = useState<string | null>(null);

  const sharePairingCode = async () => {
    if (!pairing) return;
    try {
      await Share.share({
        message: `Sahaj pairing code for ${activeSenior.display_name} (valid ${pairing.minutes} minutes, works once):\n\n${formatPairingCode(pairing.code)}`,
      });
    } catch {
      /* the share sheet was dismissed or is unavailable */
    }
  };

  const showPairingCode = async () => {
    setPairing(null);
    setPairingError(null);
    try {
      const r = await createPairingCode();
      setPairing({ code: r.pairing_code, minutes: Math.max(1, Math.round(r.expires_in / 60)) });
    } catch (e) {
      setPairingError(e instanceof Error ? e.message : 'Could not create a code.');
    }
  };

  // 1. Restoring a saved session, then Welcome -> sign in
  if (authStatus === 'booting') {
    return (
      <View style={styles.bootScreen}>
        <ActivityIndicator size="large" color="#0D6B58" />
      </View>
    );
  }
  if (!role) {
    if (!pendingRole) {
      return <WelcomeScreen onSelectRole={(selectedRole) => setPendingRole(selectedRole)} />;
    }
    return <LoginScreen role={pendingRole} onBack={() => setPendingRole(null)} />;
  }

  // Shown under the role banner while real data loads, fails, or there is nothing to show
  const renderDataStatus = () => {
    if (dataStatus === 'loading') {
      return (
        <View style={styles.statusRow}>
          <ActivityIndicator size="small" color="#0D6B58" />
          <Text style={styles.statusText}>Loading your latest data…</Text>
        </View>
      );
    }
    if (dataStatus === 'error') {
      return (
        <View style={[styles.statusRow, styles.statusError]}>
          <Text style={[styles.statusText, { color: '#B91C1C', flex: 1 }]}>{dataError ?? 'Could not load your data.'}</Text>
          <TouchableOpacity onPress={() => void refreshData()} style={styles.retryBtn} accessibilityRole="button">
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      );
    }
    if (dataStatus === 'ready' && role === 'coordinator' && seniorsList.length === 0) {
      return (
        <View style={styles.statusRow}>
          <Text style={styles.statusText}>No seniors are assigned to you yet.</Text>
        </View>
      );
    }
    return null;
  };

  // 2. Active Call In-Progress Overlay (Simulating Live Bridge)
  const renderActiveCallModal = () => {
    if (!activeCall) return null;

    return (
      <Modal visible={true} transparent animationType="slide">
        <View style={styles.callModalContainer}>
          <View style={styles.callCard}>
            <View style={styles.callPulsingIcon}>
              <Phone size={36} color="#FFFFFF" />
            </View>
            <Text style={styles.callTitle}>Care Call</Text>
            <Text style={styles.callRecipient}>{activeCall.recipient}</Text>
            <Text style={styles.callNotice}>{activeCall.message}</Text>

            <TouchableOpacity
              style={styles.endCallButton}
              onPress={endCall}
              activeOpacity={0.88}
            >
              <PhoneOff size={22} color="#FFFFFF" />
              <Text style={styles.endCallText}>End Call</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  // 3. Coordinator Flow
  if (role === 'coordinator') {
    let mainContent;

    if (coordTab === 'home') {
      mainContent = (
        <CoordinatorDashboard
          onSelectSenior={(senior) => {
            setActiveSeniorById(senior.senior_id);
            setCoordSubView('overview');
            setCoordTab('seniors');
          }}
          onOpenCallNotes={() => {
            setCoordTab('notes');
          }}
        />
      );
    } else if (coordTab === 'seniors') {
      if (coordSubView === 'trends') {
        mainContent = (
          <HealthTrendsScreen
            onBack={() => setCoordSubView('overview')}
            onViewDetails={() => setCoordTab('notes')}
          />
        );
      } else if (coordSubView === 'medications') {
        mainContent = (
          <MedicationManagementScreen onBack={() => setCoordSubView('overview')} />
        );
      } else {
        mainContent = (
          <SeniorOverviewScreen
            senior={activeSenior}
            onBack={() => setCoordTab('home')}
            onNavigateTab={(tab) => {
              if (tab === 'trends') setCoordSubView('trends');
              else if (tab === 'medications') setCoordSubView('medications');
              else setCoordSubView('overview');
            }}
          />
        );
      }
    } else if (coordTab === 'notes') {
      mainContent = (
        <CoordinatorCallNotesScreen
          onBack={() => setCoordTab('home')}
          onCallSenior={() => {
            // Handled by context
          }}
        />
      );
    } else if (coordTab === 'profile') {
      mainContent = (
        <View style={styles.profileContainer}>
          <View style={styles.profileHeaderBox}>
            <View style={styles.profileAvatarBox}>
              <UserCheck size={36} color="#0D6B58" />
            </View>
            <Text style={styles.profileName}>{user?.display_name ?? 'Care Coordinator'}</Text>
            <Text style={styles.profileRole}>
              Care Coordinator{user?.city ? ` • ${user.city}` : ''}
            </Text>
            {user?.email ? <Text style={styles.profileRole}>{user.email}</Text> : null}
          </View>

          {activeSenior.senior_id ? (
            <View style={styles.pairBox}>
              <Text style={styles.pairTitle}>{`Pair ${activeSenior.display_name}'s phone`}</Text>
              <Text style={styles.pairHelp}>Make a 6-digit code, then open the app on their phone, choose Senior and type the code in. It works once.</Text>
              <TouchableOpacity style={styles.pairBtn} onPress={() => void showPairingCode()} activeOpacity={0.85} accessibilityRole="button">
                <Text style={styles.pairBtnText}>Show pairing code</Text>
              </TouchableOpacity>
              {pairing ? (
                <View style={styles.pairResult}>
                  <Text style={styles.pairCode} accessibilityLabel={`Pairing code ${pairing.code.split('').join(' ')}`}>{formatPairingCode(pairing.code)}</Text>
                  <Text style={styles.pairHelp}>Works once, for {pairing.minutes} minutes. A new code cancels this one.</Text>
                  <TouchableOpacity style={styles.pairBtn} onPress={() => void sharePairingCode()} activeOpacity={0.85} accessibilityRole="button">
                    <Text style={styles.pairBtnText}>Share code (WhatsApp, SMS…)</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              {pairingError ? <Text style={[styles.pairHelp, { color: '#B91C1C' }]}>{pairingError}</Text> : null}
            </View>
          ) : null}

          <TouchableOpacity
            style={styles.switchRoleCard}
            onPress={() => void logout()}
            activeOpacity={0.8}
          >
            <RefreshCw size={20} color="#0D6B58" />
            <Text style={styles.switchRoleCardText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={[styles.appWrapper, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Top Role Indicator Bar */}
        <View style={styles.topRoleBanner}>
          <View style={styles.roleTag}>
            <UserCheck size={14} color="#0D6B58" />
            <Text style={styles.roleTagText}>Care Coordinator Mode</Text>
          </View>
          <TouchableOpacity
            onPress={() => void logout()}
            style={styles.switchRoleBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.switchRoleText}>Sign out</Text>
          </TouchableOpacity>
        </View>
        {renderDataStatus()}

        <View style={styles.screenContainer}>{mainContent}</View>

        {/* Coordinator Bottom Nav */}
        <CoordinatorBottomNav
          currentTab={coordTab}
          onTabChange={(tab) => {
            setCoordTab(tab);
            if (tab === 'seniors') setCoordSubView('overview');
          }}
        />

        {renderActiveCallModal()}
      </View>
    );
  }

  // 4. Senior Flow
  let seniorContent;
  if (seniorTab === 'home') {
    seniorContent = (
      <SeniorHomeScreen
        onStartCall={() => setSeniorTab('checkin')}
        onOpenCheckIn={() => setSeniorTab('checkin')}
      />
    );
  } else if (seniorTab === 'checkin') {
    seniorContent = <DailyCheckInScreen onBack={() => setSeniorTab('home')} onOpenAiCall={() => setSeniorTab('aicall')} />;
  } else if (seniorTab === 'aicall') {
    seniorContent = <VoiceCallScreen onBack={() => setSeniorTab('home')} />;
  } else if (seniorTab === 'vitals') {
    seniorContent = <EnterVitalsScreen onBack={() => setSeniorTab('home')} />;
  } else if (seniorTab === 'notifications') {
    seniorContent = (
      <SeniorNotificationsScreen onBack={() => setSeniorTab('home')} />
    );
  } else if (seniorTab === 'voicenote') {
    seniorContent = (
      <SeniorHomeScreen
        onStartCall={() => setSeniorTab('checkin')}
        onOpenCheckIn={() => setSeniorTab('checkin')}
      />
    );
  } else if (seniorTab === 'language') {
    seniorContent = (
      <SeniorHomeScreen
        onStartCall={() => setSeniorTab('checkin')}
        onOpenCheckIn={() => setSeniorTab('checkin')}
      />
    );
  }

  return (
    <View style={[styles.appWrapper, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {renderDataStatus()}

      <View style={styles.screenContainer}>{seniorContent}</View>

      {/* Senior 6-Tab Bottom Nav */}
      <SeniorBottomNav
        currentTab={seniorTab}
        onTabChange={(tab) => {
          if (tab === 'language') {
            setLanguage(language === 'hi' ? 'en' : 'hi');
          }
          setSeniorTab(tab);
        }}
      />

      {renderActiveCallModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  appWrapper: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topRoleBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 6,
    backgroundColor: '#E8F5F1',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  roleTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  roleTagText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0D6B58',
  },
  switchRoleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BCE8D8',
    backgroundColor: '#FFFFFF',
  },
  switchRoleText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#0D6B58',
  },
  screenContainer: {
    flex: 1,
  },
  bootScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F4FBF8',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
  },
  statusError: { backgroundColor: '#FEF2F2' },
  statusText: { fontSize: 12.5, fontWeight: '600', color: '#475569' },
  retryBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#FECACA' },
  retryText: { fontSize: 12.5, fontWeight: '800', color: '#B91C1C' },
  pairBox: { width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, gap: 8, borderWidth: 1, borderColor: '#D1FAE5' },
  pairTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  pairHelp: { fontSize: 12.5, color: '#64748B', lineHeight: 18 },
  pairBtn: { backgroundColor: '#0D6B58', borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  pairCode: { fontSize: 40, fontWeight: '800', letterSpacing: 6, color: '#0F172A', textAlign: 'center' },
  pairBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  pairResult: { gap: 8, paddingTop: 4 },
  profileContainer: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
  },
  profileHeaderBox: {
    alignItems: 'center',
    gap: 8,
  },
  profileAvatarBox: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D1FAE5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  profileRole: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  switchRoleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  switchRoleCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0D6B58',
  },
  callModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  callCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#1E293B',
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  callPulsingIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: '#0D9488',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  callTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  callRecipient: {
    fontSize: 20,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 4,
    marginBottom: 8,
    textAlign: 'center',
  },
  callNotice: {
    fontSize: 11.5,
    color: '#34D399',
    fontWeight: '600',
    marginBottom: 24,
  },
  endCallButton: {
    backgroundColor: '#DC2626',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    gap: 10,
  },
  endCallText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
