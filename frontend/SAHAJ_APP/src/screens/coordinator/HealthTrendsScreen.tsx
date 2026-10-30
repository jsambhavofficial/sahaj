import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import Svg, { Circle, Path, Line, Text as SvgText } from 'react-native-svg';
import {
  VITAL_KINDS, chartGeometry, levelLabel, levelPalette, recentReadings, riskTrend, vitalKindInfo, vitalSeries,
  type VitalKind,
} from '../../api/mappers';
import {
  ChevronLeft,
  MoreVertical,
  ChevronRight,
  TrendingUp,
  TrendingDown,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
  onViewDetails?: () => void;
}

export const HealthTrendsScreen: React.FC<Props> = ({ onBack, onViewDetails }) => {
  const { activeSenior, readings, riskHistory, detailLoading } = useAppState();
  const [activeFilter, setActiveFilter] = useState<VitalKind>('BP');

  const info = vitalKindInfo(activeFilter);
  const series = vitalSeries(readings, activeFilter, 7);
  const geo = chartGeometry(series);
  const latest = recentReadings(readings, activeFilter, 5);
  const palette = levelPalette(activeSenior.risk_level);
  const trend = riskTrend(riskHistory);
  const GAUGE_LENGTH = 238.76; // circumference of the r=38 ring

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
          {VITAL_KINDS.map((filter) => {
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

        {/* Trend chart for the chosen vital: daily averages from the senior's real readings */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <Text style={styles.chartTitle}>{info.title}</Text>
            <View style={styles.legendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#1E6FE3' }]} />
                <Text style={styles.legendLabel}>{info.names[0]}</Text>
              </View>
              {info.names[1] ? (
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#9333EA' }]} />
                  <Text style={styles.legendLabel}>{info.names[1]}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {geo ? (
            <>
              <Svg width="100%" height={geo.height} viewBox={`0 0 ${geo.width} ${geo.height}`} fill="none">
                {geo.ticks.map((tick) => (
                  <React.Fragment key={`${tick.label}-${tick.y}`}>
                    <Line x1={geo.plot.left} x2={geo.plot.right} y1={tick.y} y2={tick.y} stroke="#E2E8F0" strokeWidth={1} strokeDasharray="3 3" />
                    <SvgText x={geo.plot.left - 6} y={tick.y + 3} fontSize="9" fill="#94A3B8" textAnchor="end">{tick.label}</SvgText>
                  </React.Fragment>
                ))}
                <Path d={geo.a.d} stroke="#1E6FE3" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
                {geo.a.dots.map((d, i) => <Circle key={`a${i}`} cx={d.x} cy={d.y} r={3.5} fill="#1E6FE3" />)}
                {geo.b ? <Path d={geo.b.d} stroke="#9333EA" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" /> : null}
                {geo.b ? geo.b.dots.map((d, i) => <Circle key={`b${i}`} cx={d.x} cy={d.y} r={3.5} fill="#9333EA" />) : null}
                {geo.xLabels.map((l, i) => (
                  <SvgText key={`x${i}`} x={l.x} y={geo.height - 8} fontSize="9" fill="#94A3B8" textAnchor="middle">{l.label}</SvgText>
                ))}
              </Svg>
              <Text style={styles.chartCaption}>Daily average, last {series.length} day{series.length === 1 ? '' : 's'} with readings</Text>
            </>
          ) : (
            <Text style={styles.emptyNote}>{detailLoading ? 'Loading readings…' : `No ${activeFilter} readings recorded for ${activeSenior.display_name} yet.`}</Text>
          )}
        </View>

        {/* Latest individual readings of the chosen vital */}
        <View style={styles.readingsCard}>
          <View style={styles.readingsHeader}>
            <Text style={styles.readingsTitle}>Recent Readings</Text>
          </View>
          {latest.length === 0 ? (
            <Text style={styles.emptyNote}>Nothing to show yet.</Text>
          ) : (
            latest.map((r, i) => (
              <View key={i} style={styles.readingRow}>
                <Text style={styles.readingAt}>{r.at}</Text>
                <Text style={styles.readingValue}>{r.text}</Text>
              </View>
            ))
          )}
        </View>

        {/* Overall risk for this senior */}
        <View style={styles.readingsCard}>
          <View style={styles.readingsHeader}>
            <Text style={styles.readingsTitle}>Risk score</Text>
            <TouchableOpacity onPress={onViewDetails} activeOpacity={0.7}>
              <Text style={styles.viewDetailsText}>Why?</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.gaugeRow}>
            <View style={styles.gaugeWrapper}>
              <Svg width="90" height="90" viewBox="0 0 100 100">
                <Circle cx="50" cy="50" r="38" fill="none" stroke="#F1F5F9" strokeWidth="8" />
                <Circle
                  cx="50"
                  cy="50"
                  r="38"
                  fill="none"
                  stroke={palette.stroke}
                  strokeWidth="8"
                  strokeDasharray={GAUGE_LENGTH}
                  strokeDashoffset={GAUGE_LENGTH * (1 - Math.min(100, Math.max(0, activeSenior.risk_score)) / 100)}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </Svg>
              <View style={styles.gaugeInner}>
                <Text style={styles.gaugeValue}>{activeSenior.risk_score}</Text>
                <Text style={styles.gaugeDenominator}>/100</Text>
              </View>
            </View>

            <View style={styles.gaugeInfo}>
              <View style={[styles.moderateBadge, { backgroundColor: palette.bg }]}>
                <Text style={[styles.moderateBadgeText, { color: palette.fg }]}>{levelLabel(activeSenior.risk_level)}</Text>
              </View>
              {trend ? (
                <View style={styles.trendRow}>
                  {trend.delta > 0 ? <TrendingUp size={15} color="#DC2626" /> : <TrendingDown size={15} color="#0A7360" />}
                  <Text style={styles.trendLabel}>{trend.text}</Text>
                </View>
              ) : null}
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
  chartCaption: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
  emptyNote: { fontSize: 13, color: '#64748B', paddingVertical: 14 },
  readingRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  readingAt: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  readingValue: { fontSize: 14, color: '#0F172A', fontWeight: '800' },
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
