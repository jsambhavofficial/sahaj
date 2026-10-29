import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  Platform,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppState } from '../context/AppStateContext';

// Screens
import { WelcomeScreen } from '../screens/WelcomeScreen';

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
import { EnterVitalsScreen } from '../screens/senior/EnterVitalsScreen';
import { SeniorNotificationsScreen } from '../screens/senior/SeniorNotificationsScreen';
import { SeniorBottomNav, SeniorTab } from '../components/common/SeniorBottomNav';

import { Phone, PhoneOff, UserCheck, User, RefreshCw } from 'lucide-react-native';

export default function AppEntry() {
  const {
    role,
    setRole,
    activeSenior,
    setActiveSeniorById,
    activeCall,
    endCall,
    language,
    setLanguage,
  } = useAppState();

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Coordinator Navigation Sub-state
  const [coordTab, setCoordTab] = useState<CoordinatorTab>('home');
  const [coordSubView, setCoordSubView] = useState<'overview' | 'trends' | 'medications' | 'notes'>('overview');

  // Senior Navigation Sub-state
  const [seniorTab, setSeniorTab] = useState<SeniorTab>('home');

  // 1. Welcome Screen (First when app opens)
  if (!role) {
    return <WelcomeScreen onSelectRole={(selectedRole) => setRole(selectedRole)} />;
  }

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
            <Text style={styles.callTitle}>Live Care Call</Text>
            <Text style={styles.callRecipient}>{activeCall.recipient}</Text>
            <Text style={styles.callNotice}>
              ● Recorded session • Audio bridge active
            </Text>

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
            <Text style={styles.profileName}>Neha Sharma</Text>
            <Text style={styles.profileRole}>Care Coordinator • Bengaluru</Text>
          </View>

          <TouchableOpacity
            style={styles.switchRoleCard}
            onPress={() => setRole(null)}
            activeOpacity={0.8}
          >
            <RefreshCw size={20} color="#0D6B58" />
            <Text style={styles.switchRoleCardText}>Switch / Re-select Role</Text>
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
            onPress={() => setRole(null)}
            style={styles.switchRoleBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.switchRoleText}>Change Role</Text>
          </TouchableOpacity>
        </View>

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
    seniorContent = <DailyCheckInScreen onBack={() => setSeniorTab('home')} />;
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
      {/* Top Role Indicator Bar */}
      <View style={[styles.topRoleBanner, { backgroundColor: '#F0FAF7' }]}>
        <View style={styles.roleTag}>
          <User size={14} color="#008774" />
          <Text style={[styles.roleTagText, { color: '#008774' }]}>
            Senior Mode (Shanti Devi)
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setRole(null)}
          style={[styles.switchRoleBtn, { borderColor: '#A7F3D0' }]}
          activeOpacity={0.7}
        >
          <Text style={[styles.switchRoleText, { color: '#008774' }]}>
            Change Role
          </Text>
        </TouchableOpacity>
      </View>

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
