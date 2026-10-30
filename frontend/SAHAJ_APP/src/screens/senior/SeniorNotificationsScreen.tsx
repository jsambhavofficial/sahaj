import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import { BotanicalDecor } from '../../components/common/BotanicalDecor';
import {
  ChevronLeft,
  Pill,
  Heart,
  Calendar,
  Sparkles,
  Bell,
  Check,
  CheckCheck,
} from 'lucide-react-native';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  AppNotificationItem,
} from '../../api/live';

interface Props {
  onBack: () => void;
}

export const SeniorNotificationsScreen: React.FC<Props> = ({ onBack }) => {
  const { medications, confirmMedication } = useAppState();
  const [notifications, setNotifications] = useState<AppNotificationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getNotifications(false)
      .then((res) => {
        if (!cancelled) setNotifications(res.items ?? []);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await markNotificationRead(id);
    } catch {}
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    );
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead();
    } catch {}
    const now = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at || now })));
  };

  const getKindDetails = (kind: string) => {
    switch (kind) {
      case 'daily_wellbeing':
      case 'checkin_prompt':
        return {
          icon: Heart,
          color: '#E11D48',
          bg: '#FFF1F2',
          tag: 'हाल-चाल',
        };
      case 'ai_saathi':
        return {
          icon: Sparkles,
          color: '#D97706',
          bg: '#FEF3C7',
          tag: 'सहज साथी',
        };
      case 'caretaker_visit':
      case 'care_update':
        return {
          icon: Calendar,
          color: '#0D9488',
          bg: '#F0FDFA',
          tag: 'केयरटेकर',
        };
      case 'medication_reminder':
      case 'appointment_reminder':
        return {
          icon: Pill,
          color: '#2563EB',
          bg: '#EFF6FF',
          tag: 'दवाई',
        };
      default:
        return {
          icon: Bell,
          color: '#059669',
          bg: '#ECFDF5',
          tag: 'सूचना',
        };
    }
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;
  const filteredNotifications = notifications.filter((n) =>
    filter === 'unread' ? !n.read_at : true
  );

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
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>सूचनाएँ (Notifications)</Text>
          {unreadCount > 0 && (
            <View style={styles.badgeCount}>
              <Text style={styles.badgeCountText}>{unreadCount}</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 ? (
          <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
            <CheckCheck size={18} color="#0D9488" />
          </TouchableOpacity>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          onPress={() => setFilter('all')}
          style={[styles.filterPill, filter === 'all' && styles.filterPillActive]}
        >
          <Text style={[styles.filterPillText, filter === 'all' && styles.filterPillTextActive]}>
            सभी ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setFilter('unread')}
          style={[styles.filterPill, filter === 'unread' && styles.filterPillActive]}
        >
          <Text
            style={[styles.filterPillText, filter === 'unread' && styles.filterPillTextActive]}
          >
            नयी ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Real Push Notifications Section */}
        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color="#0D9488" />
            <Text style={styles.loadingText}>सूचनाएँ आ रही हैं...</Text>
          </View>
        ) : (
          <View style={styles.cardList}>
            {filteredNotifications.length === 0 && (
              <Text style={styles.loadingText}>
                {loadError ? 'सूचनाएँ नहीं आ सकीं। कृपया बाद में कोशिश करें।' : 'कोई सूचना नहीं है।'}
              </Text>
            )}
            {filteredNotifications.map((notif) => {
              const isUnread = !notif.read_at;
              const details = getKindDetails(notif.kind);
              const IconComp = details.icon;

              return (
                <View
                  key={notif.id}
                  style={[styles.notifCard, isUnread && styles.notifCardUnread]}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.iconCircle, { backgroundColor: details.bg }]}>
                        <IconComp size={20} color={details.color} />
                      </View>
                      <View>
                        <Text style={styles.tagText}>{details.tag}</Text>
                        <Text style={styles.notifTitle}>{notif.title}</Text>
                      </View>
                    </View>

                    {isUnread && (
                      <TouchableOpacity
                        onPress={() => handleMarkRead(notif.id)}
                        style={styles.markReadBtn}
                      >
                        <Check size={14} color="#0D9488" />
                        <Text style={styles.markReadText}>पढ़ा</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  <Text style={styles.notifBody}>{notif.body}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Medication Schedule Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>दवाइयाँ (Medication Schedule)</Text>
        </View>

        <View style={styles.cardList}>
          {medications.map((med) => {
            const isTaken = med.status === 'taken';

            return (
              <View key={med.medication_id} style={styles.notifCard}>
                <View style={styles.notifLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: '#EFF6FF' }]}>
                    <Pill size={20} color="#2563EB" />
                  </View>
                  <View>
                    <Text style={styles.medTitle}>
                      {med.drug_name} {med.dosage}
                    </Text>
                    <Text style={styles.medSlot}>{med.time_slot}</Text>
                  </View>
                </View>

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
    backgroundColor: '#F8FAFC',
  },
  decorBL: {
    opacity: 0.4,
  },
  decorBR: {
    opacity: 0.35,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  badgeCount: {
    backgroundColor: '#E11D48',
    borderRadius: 12,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
  },
  backBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  markAllBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F0FDFA',
  },
  placeholder: {
    width: 36,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#E2E8F0',
  },
  filterPillActive: {
    backgroundColor: '#0D9488',
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  loadingBox: {
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
  cardList: {
    gap: 10,
  },
  notifCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  notifCardUnread: {
    borderColor: '#2DD4BF',
    backgroundColor: '#F0FDFA',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0F172A',
  },
  notifBody: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 20,
    fontWeight: '500',
    paddingLeft: 48,
  },
  markReadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#CCFBF1',
  },
  markReadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0D9488',
  },
  notifLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  medTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  medSlot: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeTaken: {
    backgroundColor: '#ECFDF5',
  },
  badgePending: {
    backgroundColor: '#FEF2F2',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  textTaken: {
    color: '#059669',
  },
  textPending: {
    color: '#DC2626',
  },
  sectionHeader: {
    marginTop: 14,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
