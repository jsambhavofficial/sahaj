import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Home, Users, FileText, User } from 'lucide-react-native';

export type CoordinatorTab = 'home' | 'seniors' | 'notes' | 'profile';

interface Props {
  currentTab: CoordinatorTab;
  onTabChange: (tab: CoordinatorTab) => void;
}

export const CoordinatorBottomNav: React.FC<Props> = ({ currentTab, onTabChange }) => {
  return (
    <View style={styles.container}>
      {/* Home Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('home')}
        activeOpacity={0.7}
      >
        <Home
          size={22}
          color={currentTab === 'home' ? '#0E7A68' : '#94A3B8'}
          fill={currentTab === 'home' ? '#0E7A68' : 'none'}
        />
        <Text style={[styles.tabLabel, currentTab === 'home' && styles.tabLabelActive]}>
          Home
        </Text>
      </TouchableOpacity>

      {/* Seniors Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('seniors')}
        activeOpacity={0.7}
      >
        <Users
          size={22}
          color={currentTab === 'seniors' ? '#0E7A68' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'seniors' && styles.tabLabelActive]}>
          Seniors
        </Text>
      </TouchableOpacity>

      {/* Notes Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('notes')}
        activeOpacity={0.7}
      >
        <FileText
          size={22}
          color={currentTab === 'notes' ? '#0E7A68' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'notes' && styles.tabLabelActive]}>
          Notes
        </Text>
      </TouchableOpacity>

      {/* Profile Tab */}
      <TouchableOpacity
        style={styles.tabItem}
        onPress={() => onTabChange('profile')}
        activeOpacity={0.7}
      >
        <User
          size={22}
          color={currentTab === 'profile' ? '#0E7A68' : '#94A3B8'}
        />
        <Text style={[styles.tabLabel, currentTab === 'profile' && styles.tabLabelActive]}>
          Profile
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
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 10,
    paddingBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 3,
  },
  tabItem: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#0E7A68',
    fontWeight: '800',
  },
});
