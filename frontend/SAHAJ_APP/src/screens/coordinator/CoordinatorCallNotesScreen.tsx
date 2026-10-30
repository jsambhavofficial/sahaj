import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import { formatWhen, levelLabel, levelPalette } from '../../api/mappers';
import * as live from '../../api/live';
import {
  ChevronLeft,
  MoreVertical,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
}

const SENTIMENT: Record<string, { bg: string; fg: string }> = {
  positive: { bg: '#EAF7EE', fg: '#16A34A' },
  neutral: { bg: '#F1F5F9', fg: '#475569' },
  concerned: { bg: '#FEF3C7', fg: '#B45309' },
  negative: { bg: '#FEE2E2', fg: '#DC2626' },
};

const label = (s: string) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

const ReportCard: React.FC<{
  report: live.AiCallReport;
  open: boolean;
  turns: live.CallTranscriptTurn[] | 'loading' | 'error' | undefined;
  onToggle: () => void;
}> = ({ report, open, turns, onToggle }) => {
  const tone = report.sentiment ? SENTIMENT[report.sentiment.toLowerCase()] ?? SENTIMENT.neutral : null;
  const answered =
    report.questionsAnswered != null && report.questionsTotal != null
      ? `Answered ${report.questionsAnswered} of ${report.questionsTotal} questions`
      : null;
  return (
    <TouchableOpacity style={styles.card} onPress={onToggle} activeOpacity={0.85}>
      <View style={styles.reportTop}>
        <Text style={styles.reportDate}>{report.startedAt ? formatWhen(report.startedAt) : 'Date unknown'}</Text>
        <View style={styles.badgeRow}>
          {report.urgent ? (
            <View style={[styles.badge, { backgroundColor: '#FEE2E2' }]}>
              <Text style={[styles.badgeText, { color: '#DC2626' }]}>Urgent</Text>
            </View>
          ) : null}
          {tone && report.sentiment ? (
            <View style={[styles.badge, { backgroundColor: tone.bg }]}>
              <Text style={[styles.badgeText, { color: tone.fg }]}>{label(report.sentiment)}</Text>
            </View>
          ) : null}
          {open ? <ChevronUp size={16} color="#94A3B8" /> : <ChevronDown size={16} color="#94A3B8" />}
        </View>
      </View>

      <Text style={styles.reasonMain}>
        {report.summary ?? (report.status === 'completed' ? 'No summary was written.' : `Call ${label(report.status).toLowerCase()}.`)}
      </Text>

      {report.cueTypes.length > 0 ? (
        <View style={styles.chipRow}>
          {report.cueTypes.map((c) => (
            <View key={c} style={styles.chip}>
              <Text style={styles.chipText}>{label(c)}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {answered ? <Text style={styles.reasonSub}>{answered}</Text> : null}

      {open ? (
        <View style={styles.transcript}>
          {turns === undefined || turns === 'loading' ? (
            <ActivityIndicator color="#0D6B58" />
          ) : turns === 'error' ? (
            <Text style={styles.reasonSub}>Could not load the conversation.</Text>
          ) : turns.length === 0 ? (
            <Text style={styles.reasonSub}>No conversation was saved for this call.</Text>
          ) : (
            turns.map((t) => (
              <View key={t.index} style={styles.turn}>
                <Text style={styles.turnWho}>{t.speaker === 'agent' ? 'Sahaj assistant' : 'Senior'}</Text>
                <Text style={styles.reasonMain}>{t.text}</Text>
              </View>
            ))
          )}
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

export const CoordinatorCallNotesScreen: React.FC<Props> = ({ onBack }) => {
  const { alertResolved, markAlertActionTaken, activeSenior, lastCall } = useAppState();
  const palette = levelPalette(activeSenior.risk_level);
  const seniorId = activeSenior.senior_id;
  // Results are tagged with the senior they belong to, so switching seniors shows the spinner, not stale data.
  const [loaded, setLoaded] = useState<{ seniorId: string; reports: live.AiCallReport[]; error: boolean } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [turnsById, setTurnsById] = useState<Record<string, live.CallTranscriptTurn[] | 'loading' | 'error'>>({});
  const current = loaded?.seniorId === seniorId ? loaded : null;
  const loading = current === null;
  const error = current?.error ?? false;
  const reports = current?.reports ?? [];

  useEffect(() => {
    let cancelled = false;
    live
      .fetchAiCallReports(seniorId)
      .then((r) => !cancelled && setLoaded({ seniorId, reports: r, error: false }))
      .catch(() => !cancelled && setLoaded({ seniorId, reports: [], error: true }));
    return () => {
      cancelled = true;
    };
  }, [seniorId]);

  const toggle = (id: string) => {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (turnsById[id] && turnsById[id] !== 'error') return;
    setTurnsById((m) => ({ ...m, [id]: 'loading' }));
    live
      .fetchCallTranscript(id)
      .then((t) => setTurnsById((m) => ({ ...m, [id]: t })))
      .catch(() => setTurnsById((m) => ({ ...m, [id]: 'error' })));
  };
  const canResolve = Boolean(activeSenior.alert_id) && !alertResolved;

  const handleActionTaken = async () => {
    const resolved = await markAlertActionTaken();
    if (resolved) Alert.alert('Alert resolved', 'The alert was resolved and your follow-up was recorded.');
  };

  return (
    <View style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.navIconBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Call Notes</Text>
        <TouchableOpacity style={styles.navIconBtn} activeOpacity={0.7}>
          <MoreVertical size={20} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Score & alert status: the senior's real score and level */}
        <View style={styles.scoreAlertCard}>
          <View style={styles.cardLeft}>
            <View style={styles.scoreCircle}>
              <Text style={[styles.scoreValue, { color: palette.fg }]}>{activeSenior.risk_score}</Text>
            </View>

            <View style={styles.scoreMeta}>
              <Text style={styles.lastCallText}>
                {lastCall?.startedAt ? `Last call – ${formatWhen(lastCall.startedAt)}` : 'No calls recorded yet'}
              </Text>
              <View style={[styles.criticalPill, { backgroundColor: palette.bg }]}>
                <AlertTriangle size={12} color={palette.fg} />
                <Text style={[styles.criticalPillText, { color: palette.fg }]}>{levelLabel(activeSenior.risk_level)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>
              {alertResolved ? 'Resolved' : activeSenior.alert_id ? 'Open alert' : 'No open alert'}
            </Text>
          </View>
        </View>

        <Text style={styles.listHeading}>AI check-in calls</Text>
        {loading ? (
          <ActivityIndicator color="#0D6B58" style={{ marginVertical: 24 }} />
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.reasonMain}>Could not load the call reports.</Text>
          </View>
        ) : reports.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.reasonMain}>No AI check-in calls yet for this senior.</Text>
          </View>
        ) : (
          reports.map((r) => (
            <ReportCard
              key={r.id}
              report={r}
              open={openId === r.id}
              turns={turnsById[r.id]}
              onToggle={() => toggle(r.id)}
            />
          ))
        )}

        {/* Resolves the alert on the server and records that the coordinator followed up */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, alertResolved && styles.primaryActionBtnDone, !canResolve && !alertResolved && { opacity: 0.5 }]}
          onPress={handleActionTaken}
          disabled={!canResolve}
          activeOpacity={0.88}
        >
          {alertResolved ? (
            <View style={styles.btnRow}>
              <CheckCircle2 size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Alert resolved ✓</Text>
            </View>
          ) : (
            <Text style={styles.primaryActionBtnText}>{canResolve ? 'Mark as Action Taken' : 'No open alert to resolve'}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
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
    paddingBottom: 36,
  },
  scoreAlertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  scoreCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#EF4444',
  },
  scoreMeta: {
    gap: 6,
  },
  lastCallText: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '500',
  },
  criticalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    gap: 4,
    alignSelf: 'flex-start',
  },
  criticalPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#EF4444',
  },
  completedBadge: {
    backgroundColor: '#EAF7EE',
    borderWidth: 1,
    borderColor: '#D1FAE5',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
  },
  completedText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#16A34A',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  listHeading: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 10,
  },
  reportTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  reportDate: { fontSize: 13, fontWeight: '800', color: '#0F172A' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  transcript: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', gap: 10 },
  turn: { gap: 2 },
  turnWho: { fontSize: 11, fontWeight: '700', color: '#0D6B58' },
  reasonMain: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
  reasonSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  primaryActionBtn: {
    backgroundColor: '#0D6B58',
    borderRadius: 28,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0D6B58',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
    marginTop: 6,
  },
  primaryActionBtnDone: {
    backgroundColor: '#059669',
  },
  btnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 14.5,
    fontWeight: '700',
  },
});

