import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import {
  ChevronLeft,
  MoreVertical,
  ChevronRight,
  TrendingUp,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
  onViewDetails?: () => void;
}

export const HealthTrendsScreen: React.FC<Props> = ({ onBack, onViewDetails }) => {
  const { vitals } = useAppState();
  const [activeFilter, setActiveFilter] = useState<'BP' | 'Sugar' | 'SpO2' | 'Pulse' | 'Weight'>('BP');

  return (
    <View style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.navIconBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Health Trends</Text>
        <TouchableOpacity style={styles.navIconBtn} activeOpacity={0.7}>
          <MoreVertical size={20} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Vitals Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterBar}
        >
          {(['BP', 'Sugar', 'SpO2', 'Pulse', 'Weight'] as const).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter)}
                activeOpacity={0.8}
              >
                {isActive && <View style={styles.activeDot} />}
                <Text
                  style={[styles.filterChipText, isActive && styles.filterChipTextActive]}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Blood Pressure Chart Card */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>Blood Pressure (mmHg)</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#1E6FE3' }]} />
                <Text style={styles.legendLabel}>Systolic</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#9333EA' }]} />
                <Text style={styles.legendLabel}>Diastolic</Text>
              </View>
            </View>
          </View>

          {/* SVG Chart Graphic Container */}
          <View style={styles.chartGraphicContainer}>
            {/* Horizontal Grid lines */}
            <View style={styles.gridLinesContainer}>
              {[160, 120, 80, 40].map((val) => (
                <View key={val} style={styles.gridLineRow}>
                  <Text style={styles.yAxisLabel}>{val}</Text>
                  <View style={styles.dashedLine} />
                </View>
              ))}
            </View>

            {/* SVG Trend Lines & Dots */}
            <View style={styles.svgWrapper}>
              <Svg width="100%" height="130" viewBox="0 0 300 130" fill="none">
                {/* Systolic Line (Blue) ~125-135 */}
                <Path
                  d="M 15 42 L 60 40 L 105 48 L 155 42 L 205 45 L 255 52 L 285 48"
                  stroke="#1E6FE3"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx="15" cy="42" r="3.5" fill="#1E6FE3" />
                <Circle cx="60" cy="40" r="3.5" fill="#1E6FE3" />
                <Circle cx="105" cy="48" r="3.5" fill="#1E6FE3" />
                <Circle cx="155" cy="42" r="3.5" fill="#1E6FE3" />
                <Circle cx="205" cy="45" r="3.5" fill="#1E6FE3" />
                <Circle cx="255" cy="52" r="3.5" fill="#1E6FE3" />
                <Circle cx="285" cy="48" r="3.5" fill="#1E6FE3" />

                {/* Diastolic Line (Purple) ~75-85 */}
                <Path
                  d="M 15 85 L 60 84 L 105 90 L 155 86 L 205 88 L 255 94 L 285 90"
                  stroke="#9333EA"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Circle cx="15" cy="85" r="3.5" fill="#9333EA" />
                <Circle cx="60" cy="84" r="3.5" fill="#9333EA" />
                <Circle cx="105" cy="90" r="3.5" fill="#9333EA" />
                <Circle cx="155" cy="86" r="3.5" fill="#9333EA" />
                <Circle cx="205" cy="88" r="3.5" fill="#9333EA" />
                <Circle cx="255" cy="94" r="3.5" fill="#9333EA" />
                <Circle cx="285" cy="90" r="3.5" fill="#9333EA" />
              </Svg>
            </View>

            {/* X-Axis Dates */}
            <View style={styles.xAxisRow}>
              {['22 Apr', '23 Apr', '24 Apr', '25 Apr', '26 Apr', '27 Apr', '28 Apr'].map(
                (date) => (
                  <Text key={date} style={styles.xAxisLabel}>
                    {date}
                  </Text>
                )
              )}
            </View>
          </View>
        </View>

        {/* Recent Readings Card */}
        <View style={styles.readingsCard}>
          <View style={styles.readingsHeader}>
            <Text style={styles.readingsTitle}>Recent Readings</Text>
            <TouchableOpacity onPress={onViewDetails} activeOpacity={0.7}>
              <Text style={styles.viewDetailsText}>View details</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gaugeRow}>
            {/* Circular Gauge */}
            <View style={styles.gaugeWrapper}>
              <Svg width="90" height="90" viewBox="0 0 100 100">
                <Circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#F1F5F9"
                  strokeWidth="8"
                />
                <Circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke="#FB923C"
                  strokeWidth="8"
                  strokeDasharray="238.76"
                  strokeDashoffset="76.4"
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </Svg>
              <View style={styles.gaugeInner}>
                <Text style={styles.gaugeValue}>68</Text>
                <Text style={styles.gaugeDenominator}>/100</Text>
              </View>
            </View>

            {/* Trend info */}
            <View style={styles.gaugeInfo}>
              <View style={styles.moderateBadge}>
                <Text style={styles.moderateBadgeText}>Moderate</Text>
              </View>
              <View style={styles.trendRow}>
                <TrendingUp size={15} color="#0A7360" />
                <Text style={styles.trendLabel}>12% from last week</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Primary Action Button: View details */}
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onViewDetails}
          activeOpacity={0.88}
        >
          <Text style={styles.actionBtnText}>View details</Text>
          <ChevronRight size={18} color="#0A7360" />
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAF9',
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navIconBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  filterBar: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    marginBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#E5F5EF',
    borderColor: '#BCE8D8',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#0A7360',
  },
  filterChipText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: '#64748B',
  },
  filterChipTextActive: {
    color: '#0A7360',
    fontWeight: '700',
  },
  chartCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chartTitle: {
    fontSize: 13.5,
    fontWeight: '800',
    color: '#1E293B',
  },
  legendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  legendLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#475569',
  },
  chartGraphicContainer: {
    height: 190,
    position: 'relative',
    justifyContent: 'space-between',
  },
  gridLinesContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 24,
    justifyContent: 'space-between',
  },
  gridLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  yAxisLabel: {
    width: 26,
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  dashedLine: {
    flex: 1,
    height: 1,
    borderWidth: 0.5,
    borderColor: '#F1F5F9',
    borderStyle: 'dashed',
    marginLeft: 4,
  },
  svgWrapper: {
    position: 'absolute',
    left: 28,
    right: 0,
    top: 5,
    bottom: 24,
  },
  xAxisRow: {
    position: 'absolute',
    bottom: 0,
    left: 28,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  xAxisLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '500',
  },
  readingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
  },
  readingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  readingsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  viewDetailsText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A7360',
  },
  gaugeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
  },
  gaugeWrapper: {
    width: 90,
    height: 90,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
    lineHeight: 24,
  },
  gaugeDenominator: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '600',
  },
  gaugeInfo: {
    flex: 1,
    gap: 10,
  },
  moderateBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  moderateBadgeText: {
    color: '#D97706',
    fontSize: 12,
    fontWeight: '800',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
  },
  actionBtn: {
    backgroundColor: '#E6F4EE',
    borderWidth: 1,
    borderColor: '#CDE9DC',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 4,
  },
  actionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0A7360',
  },
});
