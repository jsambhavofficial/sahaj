import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import { SeniorItem } from '../../types';
import { greetingFor, initialsOf, levelPalette, riskGroupOf, type RiskGroup } from '../../api/mappers';
import {
  Users,
  Bell,
  AlertTriangle,
  RotateCw,
  ChevronRight,
} from 'lucide-react-native';

interface Props {
  onSelectSenior: (senior: SeniorItem) => void;
  onOpenCallNotes?: () => void;
}

export const CoordinatorDashboard: React.FC<Props> = ({ onSelectSenior, onOpenCallNotes }) => {
  const { seniorsList, caseloadTotal, user } = useAppState();
  const [activeTab, setActiveTab] = useState<'all' | RiskGroup>('all');

  const countOf = (g: RiskGroup) => seniorsList.filter((s) => riskGroupOf(s.risk_level) === g).length;
  const openAlerts = seniorsList.filter((s) => s.alert_id).length;
  const aiCallsDone = seniorsList.filter((s) => s.ai_call_done).length;
  const filteredSeniors =
    activeTab === 'all' ? seniorsList : seniorsList.filter((s) => riskGroupOf(s.risk_level) === activeTab);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* Top Header */}
      <View style={styles.header}>
        <View style={styles.userProfile}>
          <View style={[styles.avatarContainer, { backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: '#0D6B58' }}>{initialsOf(user?.display_name ?? '')}</Text>
          </View>
          <View>
            <Text style={styles.greetingText}>{greetingFor(new Date().getHours())},</Text>
            <Text style={styles.userName}>{user?.display_name ?? 'Care Coordinator'}</Text>
            <Text style={styles.userRole}>Care Coordinator</Text>
          </View>
        </View>

        <TouchableOpacity style={styles.bellButton} activeOpacity={0.7}>
          <Bell size={22} color="#334155" />
          {openAlerts > 0 && <View style={styles.badgeDot} />}
        </TouchableOpacity>
      </View>

      {/* Metric Summary Cards Grid */}
      <View style={styles.metricsGrid}>
        {/* Total Seniors */}
        <View style={[styles.metricCard, { backgroundColor: '#EFF9F6', borderColor: '#DCF2EC' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#D4F1E9' }]}>
            <Users size={16} color="#0E7A68" />
          </View>
          <Text style={styles.metricLabel}>Total{'\n'}Seniors</Text>
          <Text style={[styles.metricValue, { color: '#0E7A68' }]}>{caseloadTotal}</Text>
        </View>

        {/* Critical Alerts */}
        <TouchableOpacity
          style={[styles.metricCard, { backgroundColor: '#FDF2F2', borderColor: '#FDE3E3' }]}
          onPress={() => {
            setActiveTab('critical');
            if (onOpenCallNotes) onOpenCallNotes();
          }}
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#FCE6E6' }]}>
            <Bell size={16} color="#E03A3A" />
          </View>
          <Text style={styles.metricLabel}>Critical{'\n'}Alerts</Text>
          <Text style={[styles.metricValue, { color: '#E03A3A' }]}>{countOf('critical')}</Text>
        </TouchableOpacity>

        {/* Moderate Risk */}
        <TouchableOpacity
          style={[styles.metricCard, { backgroundColor: '#FFF8EE', borderColor: '#FEEDD6' }]}
          onPress={() => setActiveTab('moderate')}
          activeOpacity={0.8}
        >
          <View style={[styles.iconCircle, { backgroundColor: '#FDECCF' }]}>
            <AlertTriangle size={16} color="#D97706" />
          </View>
          <Text style={styles.metricLabel}>Moderate{'\n'}Risk</Text>
          <Text style={[styles.metricValue, { color: '#D97706' }]}>{countOf('moderate')}</Text>
        </TouchableOpacity>

        {/* Follow-up */}
        <View style={[styles.metricCard, { backgroundColor: '#F6F4FE', borderColor: '#E9E4FC' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#EDE7FD' }]}>
            <RotateCw size={16} color="#6366F1" />
          </View>
          <Text style={styles.metricLabel}>AI calls{'\n'}done</Text>
          <Text style={[styles.metricValue, { color: '#6366F1' }]}>{aiCallsDone}</Text>
        </View>
      </View>

      {/* Priority Queue Section */}
      <View style={styles.queueSection}>
        <View style={styles.queueHeader}>
          <Text style={styles.queueTitle}>Priority Queue</Text>
          <TouchableOpacity activeOpacity={0.7} onPress={() => setActiveTab('all')}>
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'critical' ? styles.tabCriticalActive : styles.tabCriticalInactive,
            ]}
            onPress={() => setActiveTab('critical')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'critical' ? styles.tabTextActive : styles.tabTextCritical,
              ]}
            >
              {`Critical ${countOf('critical')}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'moderate' ? styles.tabModerateActive : styles.tabModerateInactive,
            ]}
            onPress={() => setActiveTab('moderate')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'moderate' ? styles.tabTextActive : styles.tabTextModerate,
              ]}
            >
              {`Moderate ${countOf('moderate')}`}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabButton,
              activeTab === 'low' ? styles.tabLowActive : styles.tabLowInactive,
            ]}
            onPress={() => setActiveTab('low')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'low' ? styles.tabTextActive : styles.tabTextLow,
              ]}
            >
              {`Low ${countOf('low')}`}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Seniors List */}
        <View style={styles.seniorsList}>
          {filteredSeniors.length === 0 && seniorsList.length > 0 ? (
            <Text style={styles.viewAllText}>Nobody in this group right now.</Text>
          ) : null}
          {filteredSeniors.map((senior) => {
            const palette = levelPalette(senior.risk_level);
            return (
              <TouchableOpacity
                key={senior.senior_id}
                style={styles.seniorCard}
                onPress={() => onSelectSenior(senior)}
                activeOpacity={0.85}
              >
                <View style={styles.seniorLeft}>
                  <View
                    style={[
                      styles.avatarBadge,
                      { backgroundColor: palette.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarBadgeText,
                        { color: palette.fg },
                      ]}
                    >
                      {senior.avatarInitials}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.seniorName}>{senior.display_name}</Text>
                    <Text style={styles.seniorMeta}>
                      {senior.age} • {senior.senior_id}
                    </Text>
                  </View>
                </View>

                <View style={styles.seniorRight}>
                  <View
                    style={[
                      styles.scoreCircle,
                      { backgroundColor: palette.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scoreText,
                        { color: palette.fg },
                      ]}
                    >
                      {senior.risk_score}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#94A3B8" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  userProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#D1FAE5',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  greetingText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  userRole: {
    fontSize: 11,
    color: '#94A3B8',
    fontWeight: '500',
  },
  bellButton: {
    padding: 8,
    position: 'relative',
  },
  badgeDot: {
    position: 'absolute',
    top: 6,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  metricCard: {
    flex: 1,
    minHeight: 104,
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 10.5,
    color: '#475569',
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 13,
  },
  metricValue: {
    fontSize: 17,
    fontWeight: '800',
  },
  queueSection: {
    gap: 12,
  },
  queueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  queueTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  viewAllText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0E7A68',
  },
  filterTabs: {
    flexDirection: 'row',
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabCriticalActive: {
    backgroundColor: '#E8505B',
  },
  tabCriticalInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  tabModerateActive: {
    backgroundColor: '#D97706',
  },
  tabModerateInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  tabLowActive: {
    backgroundColor: '#10B981',
  },
  tabLowInactive: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  tabTextCritical: {
    color: '#E8505B',
  },
  tabTextModerate: {
    color: '#D97706',
  },
  tabTextLow: {
    color: '#10B981',
  },
  seniorsList: {
    gap: 10,
    paddingTop: 4,
  },
  seniorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  seniorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  seniorName: {
    fontSize: 14.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  seniorMeta: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  seniorRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
