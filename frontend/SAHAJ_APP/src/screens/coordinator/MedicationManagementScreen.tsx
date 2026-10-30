import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import { BotanicalDecor } from '../../components/common/BotanicalDecor';
import {
  ChevronLeft,
  MoreVertical,
  Bell,
  CheckCircle2,
  Clock,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
}

export const MedicationManagementScreen: React.FC<Props> = ({ onBack }) => {
  const { medications, activeSenior } = useAppState();

  return (
    <View style={styles.container}>
      {/* Botanical Corner Watermarks */}
      <BotanicalDecor position="bottom-left" variant="mint" style={styles.watermarkBL} />
      <BotanicalDecor position="bottom-right" variant="mint" style={styles.watermarkBR} />

      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={onBack} style={styles.navIconBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Medication Management</Text>
        <TouchableOpacity style={styles.navIconBtn} activeOpacity={0.7}>
          <MoreVertical size={20} color="#1E293B" />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Reminder Banner Card */}
        <View style={styles.bannerCard}>
          <View style={styles.bannerTop}>
            <View style={styles.bellCircle}>
              <Bell size={18} color="#0A6356" />
            </View>
            <Text style={styles.bannerText}>
              {activeSenior.senior_id ? `Today's doses for ${activeSenior.display_name}` : "Today's doses"}, and whether each one was taken
            </Text>
          </View>
        </View>

        {/* Medication Schedule Section */}
        <View style={styles.scheduleSection}>
          <Text style={styles.sectionTitle}>Medication Schedule</Text>

          <View style={styles.medList}>
            {medications.map((med) => {
              const isTaken = med.status === 'taken';
              const isMissed = med.status === 'missed';
              return (
                <View key={med.medication_id} style={styles.medCard}>
                  <View
                    style={[
                      styles.medIconCircle,
                      { backgroundColor: isTaken ? '#EBF7F3' : '#FFF8EB' },
                    ]}
                  >
                    {isTaken ? (
                      <CheckCircle2 size={18} color="#059669" />
                    ) : (
                      <Clock size={18} color="#D97706" />
                    )}
                  </View>

                  <View style={styles.medDetails}>
                    <Text style={styles.medName}>
                      {med.drug_name} {med.dosage}
                    </Text>
                    <Text style={styles.medTime}>{med.time_slot}</Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      isTaken ? styles.pillTaken : styles.pillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        isTaken ? styles.textTaken : styles.textPending,
                        isMissed && { color: '#B91C1C' },
                      ]}
                    >
                      {isTaken ? 'Taken' : isMissed ? 'Missed' : 'Pending'}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
          {medications.length === 0 ? (
            <Text style={styles.medTime}>No medicines are scheduled for this senior.</Text>
          ) : null}
        </View>

        <View style={styles.footerNoteCard}>
          <View style={styles.footerLeft}>
            <View style={styles.checkCircle}>
              <Bell size={14} color="#059669" />
            </View>
            <Text style={styles.footerText}>
              The senior is reminded automatically at every dose time. If a dose is overdue, call them.
            </Text>
          </View>
        </View>

        {/* Footer Status Card */}
        <View style={styles.footerNoteCard}>
          <View style={styles.footerLeft}>
            <View style={styles.checkCircle}>
              <CheckCircle2 size={14} color="#059669" />
            </View>
            <Text style={styles.footerText}>
              A dose is marked taken by the senior in their own app, or recorded after a coordinator call.
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FBFDFC',
  },
  watermarkBL: {
    bottom: -20,
    left: -20,
    opacity: 0.35,
  },
  watermarkBR: {
    bottom: -20,
    right: -20,
    opacity: 0.35,
  },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
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
    paddingHorizontal: 18,
    paddingBottom: 36,
    zIndex: 10,
  },
  bannerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: '#ECFDF5',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
    marginBottom: 16,
  },
  bannerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bellCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#EAF5F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: '600',
    color: '#334155',
    lineHeight: 17,
  },
  bannerBottom: {
    alignItems: 'flex-end',
    marginTop: 4,
  },
  viewHistoryLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A6356',
  },
  scheduleSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 12,
  },
  medList: {
    gap: 10,
  },
  medCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 3,
    elevation: 1,
  },
  medIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medDetails: {
    flex: 1,
  },
  medName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  medTime: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 14,
  },
  pillTaken: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  pillPending: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  statusPillText: {
    fontSize: 11.5,
    fontWeight: '700',
  },
  textTaken: {
    color: '#059669',
  },
  textPending: {
    color: '#D97706',
  },
  actionButtonsGroup: {
    gap: 10,
    marginBottom: 16,
  },
  sendReminderBtn: {
    backgroundColor: '#0A6356',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    shadowColor: '#0A6356',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  btnMainTitle: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  btnSubtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    marginTop: 1,
  },
  removeMedBtn: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  removeTitle: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '700',
  },
  removeSubtitle: {
    color: '#F87171',
    fontSize: 10,
    marginTop: 1,
  },
  footerNoteCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ECFDF5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  checkCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#ECFDF5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
    lineHeight: 14,
    flex: 1,
  },
  footerHistoryLink: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0A6356',
  },
});

