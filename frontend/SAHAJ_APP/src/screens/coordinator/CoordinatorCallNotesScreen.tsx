import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import {
  ChevronLeft,
  MoreVertical,
  AlertTriangle,
  Activity,
  Pill,
  HeartPulse,
  Phone,
  Home,
  Calendar,
  Building2,
  ChevronRight,
  CheckCircle2,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
  onCallSenior?: () => void;
}

export const CoordinatorCallNotesScreen: React.FC<Props> = ({ onBack, onCallSenior }) => {
  const { alertResolved, markAlertActionTaken, activeSenior, startCall } = useAppState();
  const [marked, setMarked] = useState(alertResolved);

  const handleActionTaken = async () => {
    await markAlertActionTaken();
    setMarked(true);
    Alert.alert('Action Logged', 'Follow-up action has been recorded in the audit trail.');
  };

  const handleCallNow = () => {
    if (onCallSenior) {
      onCallSenior();
    } else {
      startCall(activeSenior.display_name, activeSenior.senior_id);
    }
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
        {/* Score & Alert Card */}
        <View style={styles.scoreAlertCard}>
          <View style={styles.cardLeft}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>92</Text>
            </View>

            <View style={styles.scoreMeta}>
              <Text style={styles.lastCallText}>Last call – 27 Apr, 5:42 PM</Text>
              <View style={styles.criticalPill}>
                <AlertTriangle size={12} color="#EF4444" />
                <Text style={styles.criticalPillText}>Critical</Text>
              </View>
            </View>
          </View>

          <View style={styles.completedBadge}>
            <Text style={styles.completedText}>Completed</Text>
          </View>
        </View>

        {/* Why this alert? Section */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Why this alert?</Text>

          <View style={styles.reasonList}>
            {/* Reason 1 */}
            <View style={styles.reasonRow}>
              <View style={styles.reasonIconCircle}>
                <Activity size={14} color="#EF4444" />
              </View>
              <View style={styles.reasonTextWrapper}>
                <Text style={styles.reasonMain}>
                  BP increased from <Text style={styles.boldText}>128/82</Text> to{' '}
                  <Text style={styles.boldText}>148/96</Text>
                </Text>
                <Text style={styles.reasonSub}>(≥ 20 mmHg ↑)</Text>
              </View>
            </View>

            {/* Reason 2 */}
            <View style={styles.reasonRow}>
              <View style={styles.reasonIconCircle}>
                <Pill size={14} color="#EF4444" />
              </View>
              <View style={styles.reasonTextWrapper}>
                <Text style={styles.reasonMain}>Missed 2 medication doses</Text>
                <Text style={styles.reasonSub}>(anti-hypertensive)</Text>
              </View>
            </View>

            {/* Reason 3 */}
            <View style={styles.reasonRow}>
              <View style={styles.reasonIconCircle}>
                <HeartPulse size={14} color="#EF4444" />
              </View>
              <View style={styles.reasonTextWrapper}>
                <Text style={styles.reasonMain}>Call notes mention "chest heaviness"</Text>
                <Text style={styles.reasonSub}>(3 days ago)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Recommended Action Section */}
        <View style={styles.card}>
          <Text style={styles.sectionHeading}>Recommended Action</Text>

          <View style={styles.actionItemsList}>
            {/* Action 1: Call senior now */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleCallNow}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowLeft}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#FEE2E2' }]}>
                  <Phone size={14} color="#EF4444" />
                </View>
                <Text style={styles.actionTitle}>Call senior now</Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Action 2: Schedule home visit */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => Alert.alert('Schedule Home Visit', 'Visit request dispatched to field nurse.')}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowLeft}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Home size={14} color="#6366F1" />
                </View>
                <Text style={styles.actionTitle}>Schedule home visit</Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Action 3: Request repeat BP reading */}
            <TouchableOpacity
              style={styles.actionRow}
              onPress={() => Alert.alert('BP Reading', 'Notification sent to senior app to re-measure vitals.')}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowLeft}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Calendar size={14} color="#6366F1" />
                </View>
                <Text style={styles.actionTitle}>Request repeat BP reading</Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>

            {/* Action 4: Arrange medical review */}
            <TouchableOpacity
              style={[styles.actionRow, { borderBottomWidth: 0 }]}
              onPress={() => Alert.alert('Medical Review', 'Case summary forwarded to consulting physician.')}
              activeOpacity={0.7}
            >
              <View style={styles.actionRowLeft}>
                <View style={[styles.actionIconCircle, { backgroundColor: '#EEF2FF' }]}>
                  <Building2 size={14} color="#6366F1" />
                </View>
                <Text style={styles.actionTitle}>Arrange medical review</Text>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Primary Action Button */}
        <TouchableOpacity
          style={[styles.primaryActionBtn, marked && styles.primaryActionBtnDone]}
          onPress={handleActionTaken}
          activeOpacity={0.88}
        >
          {marked ? (
            <View style={styles.btnRow}>
              <CheckCircle2 size={18} color="#FFFFFF" />
              <Text style={styles.primaryActionBtnText}>Action Taken ✓</Text>
            </View>
          ) : (
            <Text style={styles.primaryActionBtnText}>Mark as Action Taken</Text>
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
  sectionHeading: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 12,
  },
  reasonList: {
    gap: 12,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reasonIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  reasonTextWrapper: {
    flex: 1,
  },
  reasonMain: {
    fontSize: 13,
    color: '#334155',
    lineHeight: 18,
    fontWeight: '500',
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
  },
  reasonSub: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 1,
  },
  actionItemsList: {
    gap: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
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

