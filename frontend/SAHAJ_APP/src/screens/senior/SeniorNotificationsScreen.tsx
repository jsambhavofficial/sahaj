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
  Pill,
  Droplet,
  Shield,
  Check,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
}

export const SeniorNotificationsScreen: React.FC<Props> = ({ onBack }) => {
  const { medications, confirmMedication } = useAppState();

  return (
    <View style={styles.container}>
      {/* Decorative Botanical Flora */}
      <BotanicalDecor position="bottom-left" variant="mint" style={styles.decorBL} />
      <BotanicalDecor position="bottom-right" variant="lavender" style={styles.decorBR} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardList}>
          {medications.map((med, index) => {
            const isTaken = med.status === 'taken';

            // Distinct Stitch icons & themes
            let IconComponent = Pill;
            let iconBg = '#FFF1F2';
            let iconColor = '#F43F5E';

            if (index === 1) {
              IconComponent = Droplet;
              iconBg = '#FEF2F2';
              iconColor = '#EF4444';
            } else if (index === 2) {
              IconComponent = Shield;
              iconBg = '#FFFBEB';
              iconColor = '#F59E0B';
            }

            return (
              <View key={med.medication_id} style={styles.notifCard}>
                <View style={styles.notifLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
                    <IconComponent size={20} color={iconColor} />
                  </View>
                  <View>
                    <Text style={styles.medTitle}>
                      {med.drug_name} {med.dosage}
                    </Text>
                    <Text style={styles.medSlot}>{med.time_slot}</Text>
                  </View>
                </View>

                {/* Status Badge */}
                <TouchableOpacity
                  style={[
                    styles.statusBadge,
                    isTaken ? styles.badgeTaken : styles.badgePending,
                  ]}
                  onPress={() => {
                    if (!isTaken) confirmMedication(med.medication_id);
                  }}
                  activeOpacity={0.8}
                >
                  {isTaken && <Check size={13} color="#059669" strokeWidth={3} />}
                  <Text
                    style={[
                      styles.statusBadgeText,
                      isTaken ? styles.textTaken : styles.textPending,
                    ]}
                  >
                    {isTaken ? 'Taken' : 'Pending'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FBFC',
  },
  decorBL: {
    bottom: -15,
    left: -15,
    opacity: 0.5,
  },
  decorBR: {
    bottom: -15,
    right: -15,
    opacity: 0.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  placeholder: {
    width: 36,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 36,
    zIndex: 10,
  },
  cardList: {
    gap: 12,
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.9)',
    shadowColor: '#163C60',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  notifLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  medTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  medSlot: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
    fontWeight: '500',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  badgeTaken: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#D1FAE5',
  },
  badgePending: {
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FEF3C7',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textTaken: {
    color: '#059669',
  },
  textPending: {
    color: '#D97706',
  },
});

