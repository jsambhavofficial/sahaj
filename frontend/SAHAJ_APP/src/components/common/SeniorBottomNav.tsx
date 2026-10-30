import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import {
  Home,
  CalendarCheck,
  HeartPulse,
  Bell,
  Mic,
  Globe,
} from 'lucide-react-native';

export type SeniorTab = 'home' | 'checkin' | 'vitals' | 'notifications' | 'voicenote' | 'language' | 'aicall';

interface Props {
  currentTab: SeniorTab;
  onTabChange: (tab: SeniorTab) => void;
}

export const SeniorBottomNav: React.FC<Props> = ({ currentTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      {/* Tab 1: Home */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('home')}
        activeOpacity={0.7}
      >
        <Home
          size={20}
          color={currentTab === 'home' ? '#008774' : '#64748B'}
          fill={currentTab === 'home' ? '#008774' : 'none'}
        />
        <Text style={[styles.tabLabel, currentTab === 'home' && styles.tabLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Tab 2: Check-in */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('checkin')}
        activeOpacity={0.7}
      >
        <CalendarCheck
          size={20}
          color={currentTab === 'checkin' ? '#008774' : '#64748B'}
        />
        <Text style={[styles.tabLabel, currentTab === 'checkin' && styles.tabLabelActive]}>
          Check-in
        </Text>
      </TouchableOpacity>

      {/* Tab 3: Vitals */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('vitals')}
        activeOpacity={0.7}
      >
        <HeartPulse
          size={20}
          color={currentTab === 'vitals' ? '#008774' : '#64748B'}
        />
        <Text style={[styles.tabLabel, currentTab === 'vitals' && styles.tabLabelActive]}>
          Vitals
        </Text>
      </TouchableOpacity>

      {/* Tab 4: Notifications */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('notifications')}
        activeOpacity={0.7}
      >
        <Bell
          size={20}
          color={currentTab === 'notifications' ? '#008774' : '#64748B'}
        />
        <Text
          style={[
            styles.tabLabel,
            currentTab === 'notifications' && styles.tabLabelActive,
          ]}
        >
          Notifications
        </Text>
      </TouchableOpacity>

      {/* Tab 5: Voice Note */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('voicenote')}
        activeOpacity={0.7}
      >
        <Mic
          size={20}
          color={currentTab === 'voicenote' ? '#008774' : '#64748B'}
        />
        <Text style={[styles.tabLabel, currentTab === 'voicenote' && styles.tabLabelActive]}>
          Voice Note
        </Text>
      </TouchableOpacity>

      {/* Tab 6: Language */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('language')}
        activeOpacity={0.7}
      >
        <Globe
          size={20}
          color={currentTab === 'language' ? '#008774' : '#64748B'}
        />
        <Text style={[styles.tabLabel, currentTab === 'language' && styles.tabLabelActive]}>
          Language
        </Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingTop: 8,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 4,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingHorizontal: 4,
  },
  tabLabel: {
    fontSize: 9.5,
    fontWeight: '600',
    color: '#64748B',
  },
  tabLabelActive: {
    color: '#008774',
    fontWeight: '800',
  },
});

