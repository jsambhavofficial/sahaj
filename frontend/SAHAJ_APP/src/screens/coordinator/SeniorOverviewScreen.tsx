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
import Svg, { Circle } from 'react-native-svg';
import { levelLabel, levelPalette, riskTrend } from '../../api/mappers';
import {
  ChevronLeft,
  MoreVertical,
  Phone,
  ShieldAlert,
  Home,
  Activity,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';

interface Props {
  senior?: SeniorItem;
  onBack: () => void;
  onNavigateTab: (tab: 'overview' | 'trends' | 'medications') => void;
}

export const SeniorOverviewScreen: React.FC<Props> = ({
  senior,
  onBack,
  onNavigateTab,
}) => {
  const { activeSenior, startCall, seniorProfile, riskHistory, detailLoading } = useAppState();
  const currentSenior = senior || activeSenior;
  const palette = levelPalette(currentSenior.risk_level);
  const trend = riskTrend(riskHistory);
  const baseline = seniorProfile?.baseline;
  const dash = (v: number | null | undefined, digits = 0) => (v === null || v === undefined ? '—' : v.toFixed(digits));
  const GAUGE_LENGTH = 94.25; // circumference of the r=15 ring
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'medications'>('overview');

  const handleTabPress = (tab: 'overview' | 'trends' | 'medications') => {
    setActiveTab(tab);
    onNavigateTab(tab);
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.navIconBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.navIconBtn} activeOpacity={0.7}>
          <MoreVertical size={20} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Section */}
        <View style={styles.profileHeader}>
          {/* Avatar with gradient ring */}
          <View style={[styles.avatarRing, { backgroundColor: currentSenior.avatarColor, alignItems: 'center', justifyContent: 'center' }]}>
            <Text style={{ fontSize: 30, fontWeight: '800', color: '#FFFFFF' }}>{currentSenior.avatarInitials}</Text>
          </View>

          <Text style={styles.seniorName}>{currentSenior.display_name}</Text>
          <Text style={styles.demographics}>
            {[currentSenior.age ? `${currentSenior.age} years` : null, seniorProfile?.gender, `ID: ${currentSenior.senior_id}`].filter(Boolean).join(' • ')}
          </Text>

          {/* Quick Actions Row */}
          <View style={styles.quickActionsRow}>
            <TouchableOpacity
              style={styles.callSeniorBtn}
              onPress={() => startCall(currentSenior.display_name, currentSenior.senior_id)}
              activeOpacity={0.88}
            >
              <Phone size={14} color="#FFFFFF" />
              <Text style={styles.callSeniorText}>Call Senior</Text>
            </TouchableOpacity>

            <View style={styles.riskBadge}>
              <ShieldAlert size={14} color={palette.fg} />
              <Text style={[styles.riskBadgeText, { color: palette.fg }]}>{levelLabel(currentSenior.risk_level)} risk</Text>
            </View>
          </View>
        </View>

        {/* Tab Bar Navigation */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'overview' && styles.tabItemActive]}
            onPress={() => handleTabPress('overview')}
          >
            <Text
              style={[styles.tabLabel, activeTab === 'overview' && styles.tabLabelActive]}
            >
              Overview
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'trends' && styles.tabItemActive]}
            onPress={() => handleTabPress('trends')}
          >
            <Text
              style={[styles.tabLabel, activeTab === 'trends' && styles.tabLabelActive]}
            >
              Health Trends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'medications' && styles.tabItemActive]}
            onPress={() => handleTabPress('medications')}
          >
            <Text
              style={[styles.tabLabel, activeTab === 'medications' && styles.tabLabelActive]}
            >
              Medications
            </Text>
          </TouchableOpacity>
        </View>

        {/* Basic Information Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Basic Information</Text>
          <View style={styles.infoList}>
            {/* Living */}
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <View style={[styles.infoIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Home size={13} color="#EF4444" />
                </View>
                <Text style={styles.infoText}>{seniorProfile?.living ?? (detailLoading ? 'Loading…' : '—')}</Text>
              </View>
              <ChevronRight size={14} color="#94A3B8" />
            </View>

            {/* Medical Conditions */}
            <View style={styles.infoRow}>
              <View style={styles.infoLeft}>
                <View style={[styles.infoIcon, { backgroundColor: '#FEE2E2' }]}>
                  <Activity size={13} color="#EF4444" />
                </View>
                <Text style={styles.infoText}>
                  {seniorProfile
                    ? seniorProfile.conditions.length > 0 ? seniorProfile.conditions.join(', ') : 'No chronic conditions recorded'
                    : detailLoading ? 'Loading…' : '—'}
                </Text>
              </View>
              <ChevronRight size={14} color="#94A3B8" />
            </View>
          </View>
        </View>

        {/* Baseline (Individual) Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Baseline (Individual)</Text>
          <View style={styles.baselineGrid}>
            <View style={styles.baselineBox}>
              <Text style={styles.baselineLabel}>BP</Text>
              <Text style={styles.baselineValue}>
                {baseline ? `${dash(baseline.sbp)}/${dash(baseline.dbp)}` : '—'}
              </Text>
              <Text style={styles.baselineUnit}>mmHg</Text>
            </View>

            <View style={styles.baselineBox}>
              <Text style={styles.baselineLabel}>SUGAR</Text>
              <Text style={styles.baselineValue}>{dash(baseline?.sugar)}</Text>
              <Text style={styles.baselineUnit}>mg/dL</Text>
            </View>

            <View style={styles.baselineBox}>
              <Text style={styles.baselineLabel}>SPO2</Text>
              <Text style={styles.baselineValue}>{baseline?.spo2 == null ? '—' : `${dash(baseline.spo2)}%`}</Text>
              <Text style={styles.baselineUnit}>-</Text>
            </View>

            <View style={styles.baselineBox}>
              <Text style={styles.baselineLabel}>WEIGHT</Text>
              <Text style={styles.baselineValue}>{dash(baseline?.weight, 1)}</Text>
              <Text style={styles.baselineUnit}>kg</Text>
            </View>
          </View>
        </View>

        {/* Current Risk Score Card */}
        <View style={styles.card}>
          <View style={styles.riskHeader}>
            <Text style={styles.cardTitle}>Current Risk Score</Text>
            <TouchableOpacity onPress={() => handleTabPress('trends')} activeOpacity={0.7}>
              <Text style={styles.viewDetailsText}>View details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.riskBody}>
            {/* Circular Gauge Representation */}
            <View style={styles.gaugeContainer}>
              <Svg width="72" height="72" viewBox="0 0 36 36">
                <Circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={palette.bg}
                  strokeWidth="3.5"
                />
                <Circle
                  cx="18"
                  cy="18"
                  r="15"
                  fill="none"
                  stroke={palette.stroke}
                  strokeWidth="3.5"
                  strokeDasharray={`${(Math.min(100, Math.max(0, currentSenior.risk_score)) / 100) * GAUGE_LENGTH}, ${GAUGE_LENGTH}`}
                  strokeLinecap="round"
                  transform="rotate(-90 18 18)"
                />
              </Svg>
              <View style={styles.gaugeInner}>
                <Text style={styles.gaugeNumber}>{currentSenior.risk_score}</Text>
                <Text style={styles.gaugeDenominator}>/100</Text>
              </View>
            </View>

            <View style={styles.riskMeta}>
              <View style={[styles.moderatePill, { backgroundColor: palette.bg }]}>
                <Text style={[styles.moderatePillText, { color: palette.fg }]}>{levelLabel(currentSenior.risk_level)}</Text>
              </View>

              {trend ? (
                <View style={styles.trendRow}>
                  {trend.delta > 0 ? <TrendingUp size={14} color="#DC2626" /> : <TrendingDown size={14} color="#16A34A" />}
                  <Text style={styles.trendText}>{trend.text}</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7FAF9',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  profileHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    padding: 3,
    backgroundColor: '#2A9D8F',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  seniorName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1E293B',
  },
  demographics: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '500',
    marginTop: 3,
    marginBottom: 12,
  },
  quickActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  callSeniorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C7370',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#0C7370',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  callSeniorText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  riskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF2EC',
    borderWidth: 1,
    borderColor: '#FBD5C4',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  riskBadgeText: {
    color: '#D94824',
    fontSize: 12,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    marginBottom: 14,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabItemActive: {
    borderBottomColor: '#0C7370',
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#94A3B8',
  },
  tabLabelActive: {
    color: '#0C7370',
    fontWeight: '700',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 12,
  },
  infoList: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  infoIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#334155',
  },
  baselineGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  baselineBox: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  baselineLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
  },
  baselineValue: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
  },
  baselineUnit: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 2,
  },
  riskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  viewDetailsText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0C7370',
  },
  riskBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginTop: 4,
  },
  gaugeContainer: {
    width: 72,
    height: 72,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeNumber: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E293B',
    lineHeight: 18,
  },
  gaugeDenominator: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
  },
  riskMeta: {
    gap: 8,
  },
  moderatePill: {
    backgroundColor: '#FFF3EA',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  moderatePillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#DC6516',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#16A34A',
  },
});

