import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { useAppState } from '../../context/AppStateContext';
import { BotanicalDecor } from '../../components/common/BotanicalDecor';
import {
  ChevronLeft,
  ChevronRight,
  Activity,
  Droplets,
  Wind,
  Heart,
  Scale,
  CheckCircle2,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
}

export const EnterVitalsScreen: React.FC<Props> = ({ onBack }) => {
  const { vitals, updateVitals } = useAppState();

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [activeMetric, setActiveMetric] = useState<string>('bp');
  const [tempValue1, setTempValue1] = useState<string>('');
  const [tempValue2, setTempValue2] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const openEditor = (metric: string) => {
    setActiveMetric(metric);
    if (metric === 'bp') {
      setTempValue1(vitals.bpSystolic.toString());
      setTempValue2(vitals.bpDiastolic.toString());
    } else if (metric === 'sugar') {
      setTempValue1(vitals.sugar.toString());
    } else if (metric === 'spo2') {
      setTempValue1(vitals.spo2.toString());
    } else if (metric === 'pulse') {
      setTempValue1(vitals.pulse.toString());
    } else if (metric === 'weight') {
      setTempValue1(vitals.weight.toString());
    }
    setEditModalVisible(true);
  };

  const saveEditedMetric = async () => {
    if (activeMetric === 'bp') {
      const sys = parseInt(tempValue1) || vitals.bpSystolic;
      const dia = parseInt(tempValue2) || vitals.bpDiastolic;
      await updateVitals({ bpSystolic: sys, bpDiastolic: dia });
    } else if (activeMetric === 'sugar') {
      const sugar = parseInt(tempValue1) || vitals.sugar;
      await updateVitals({ sugar });
    } else if (activeMetric === 'spo2') {
      const spo2 = parseInt(tempValue1) || vitals.spo2;
      await updateVitals({ spo2 });
    } else if (activeMetric === 'pulse') {
      const pulse = parseInt(tempValue1) || vitals.pulse;
      await updateVitals({ pulse });
    } else if (activeMetric === 'weight') {
      const weight = parseInt(tempValue1) || vitals.weight;
      await updateVitals({ weight });
    }
    setEditModalVisible(false);
  };

  const handleSubmitAll = async () => {
    setSubmitted(true);
    await updateVitals(vitals);
    Alert.alert(
      'Vitals Recorded',
      'Your latest readings have been saved and shared with your Care Coordinator.'
    );
  };

  return (
    <View style={styles.container}>
      {/* Decorative Botanical Ornaments */}
      <BotanicalDecor position="top-right" variant="mint" style={styles.decorTR} />
      <BotanicalDecor position="bottom-left" variant="mint" style={styles.decorBL} />
      <BotanicalDecor position="bottom-right" variant="lavender" style={styles.decorBR} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1B2A47" />
        </TouchableOpacity>
        <View style={styles.headerTitles}>
          <Text style={styles.mainTitle}>Enter Vitals</Text>
          <Text style={styles.subTitle}>Add your health readings</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Card 1: Blood Pressure */}
        <TouchableOpacity
          style={styles.vitalCard}
          onPress={() => openEditor('bp')}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#E3F7F5' }]}>
              <Activity size={24} color="#00A896" />
            </View>
            <View>
              <Text style={styles.cardLabel}>
                Blood Pressure <Text style={styles.cardUnit}>(mmHg)</Text>
              </Text>
              <Text style={styles.cardValue}>
                {vitals.bpSystolic} / {vitals.bpDiastolic}
              </Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B9C4D4" />
        </TouchableOpacity>

        {/* Card 2: Blood Sugar */}
        <TouchableOpacity
          style={styles.vitalCard}
          onPress={() => openEditor('sugar')}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#F0EAFF' }]}>
              <Droplets size={24} color="#7C4DFF" />
            </View>
            <View>
              <Text style={styles.cardLabel}>
                Blood Sugar <Text style={styles.cardUnit}>(mg/dL)</Text>
              </Text>
              <Text style={styles.cardValue}>{vitals.sugar}</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B9C4D4" />
        </TouchableOpacity>

        {/* Card 3: SpO2 */}
        <TouchableOpacity
          style={styles.vitalCard}
          onPress={() => openEditor('spo2')}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#E7F3FF' }]}>
              <Wind size={24} color="#2979FF" />
            </View>
            <View>
              <Text style={styles.cardLabel}>
                SpO₂ <Text style={styles.cardUnit}>(%)</Text>
              </Text>
              <Text style={styles.cardValue}>{vitals.spo2}</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B9C4D4" />
        </TouchableOpacity>

        {/* Card 4: Pulse */}
        <TouchableOpacity
          style={styles.vitalCard}
          onPress={() => openEditor('pulse')}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#FFEBEE' }]}>
              <Heart size={24} color="#FF3366" />
            </View>
            <View>
              <Text style={styles.cardLabel}>
                Pulse <Text style={styles.cardUnit}>(bpm)</Text>
              </Text>
              <Text style={styles.cardValue}>{vitals.pulse}</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B9C4D4" />
        </TouchableOpacity>

        {/* Card 5: Weight */}
        <TouchableOpacity
          style={styles.vitalCard}
          onPress={() => openEditor('weight')}
          activeOpacity={0.85}
        >
          <View style={styles.cardLeft}>
            <View style={[styles.iconBox, { backgroundColor: '#E8EDFC' }]}>
              <Scale size={24} color="#335EEA" />
            </View>
            <View>
              <Text style={styles.cardLabel}>
                Weight <Text style={styles.cardUnit}>(kg)</Text>
              </Text>
              <Text style={styles.cardValue}>{vitals.weight}</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#B9C4D4" />
        </TouchableOpacity>

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitBtn, submitted && styles.submitBtnDone]}
          onPress={handleSubmitAll}
          activeOpacity={0.88}
        >
          {submitted ? (
            <View style={styles.submitBtnRow}>
              <CheckCircle2 size={20} color="#FFFFFF" />
              <Text style={styles.submitBtnText}>Submitted</Text>
            </View>
          ) : (
            <Text style={styles.submitBtnText}>Submit</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      {/* Edit Value Modal */}
      <Modal visible={editModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Update {activeMetric.toUpperCase()}
            </Text>

            {activeMetric === 'bp' ? (
              <View style={styles.bpInputRow}>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Systolic</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={tempValue1}
                    onChangeText={setTempValue1}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
                <Text style={styles.slashText}>/</Text>
                <View style={styles.inputCol}>
                  <Text style={styles.inputLabel}>Diastolic</Text>
                  <TextInput
                    style={styles.modalInput}
                    value={tempValue2}
                    onChangeText={setTempValue2}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              </View>
            ) : (
              <View style={styles.singleInputRow}>
                <TextInput
                  style={styles.modalInput}
                  value={tempValue1}
                  onChangeText={setTempValue1}
                  keyboardType="numeric"
                  maxLength={4}
                  autoFocus
                />
              </View>
            )}

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setEditModalVisible(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={saveEditedMetric}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FE',
  },
  decorTR: {
    top: -15,
    right: -15,
    opacity: 0.45,
  },
  decorBL: {
    bottom: -15,
    left: -15,
    opacity: 0.4,
  },
  decorBR: {
    bottom: -15,
    right: -15,
    opacity: 0.4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    zIndex: 10,
    gap: 8,
  },
  backBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitles: {
    flex: 1,
  },
  mainTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: '#1B2A47',
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: 13,
    color: '#6B7B95',
    fontWeight: '500',
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 36,
    zIndex: 10,
    gap: 12,
  },
  vitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: 'rgba(241, 245, 249, 0.9)',
    shadowColor: '#6E82A0',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 2,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardLabel: {
    fontSize: 13.5,
    fontWeight: '600',
    color: '#73839C',
  },
  cardUnit: {
    fontSize: 12,
    color: '#9AA7BB',
    fontWeight: '400',
  },
  cardValue: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1B2A47',
    letterSpacing: -0.3,
    marginTop: 2,
  },
  submitBtn: {
    height: 54,
    backgroundColor: '#008B74',
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#008B74',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 4,
  },
  submitBtnDone: {
    backgroundColor: '#059669',
  },
  submitBtnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 16,
  },
  bpInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 20,
  },
  inputCol: {
    alignItems: 'center',
  },
  inputLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 4,
  },
  slashText: {
    fontSize: 24,
    color: '#94A3B8',
    marginTop: 14,
  },
  singleInputRow: {
    width: 120,
    marginBottom: 20,
  },
  modalInput: {
    width: 80,
    height: 48,
    backgroundColor: '#F8FAFC',
    borderWidth: 1.5,
    borderColor: '#008B74',
    borderRadius: 14,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '800',
    color: '#1B2A47',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  modalSaveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 18,
    alignItems: 'center',
    backgroundColor: '#008B74',
  },
  modalSaveText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
