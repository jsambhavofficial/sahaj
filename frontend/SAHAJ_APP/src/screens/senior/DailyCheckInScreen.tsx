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
import { BotanicalDecor } from '../../components/common/BotanicalDecor';
import { RobotAvatar } from '../../components/illustrations/RobotAvatar';
import Svg, { Path } from 'react-native-svg';
import {
  ChevronLeft,
  Bot,
  Phone,
  AlertTriangle,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react-native';

interface Props {
  onBack: () => void;
  onCallStarted?: () => void;
}

export const DailyCheckInScreen: React.FC<Props> = ({ onBack, onCallStarted }) => {
  const { submitQuickCheckIn, startCall } = useAppState();
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const handleStartCall = () => {
    startCall('SAHAJ AI Voice Assistant');
    if (onCallStarted) onCallStarted();
  };

  const handleOptionPress = async (feeling: string) => {
    setSelectedOption(feeling);
    await submitQuickCheckIn(feeling);
    Alert.alert('Response Recorded', `Thank you Shanti ji! We noted that "${feeling}". Your Care Coordinator Neha has been notified.`);
  };

  return (
    <View style={styles.container}>
      {/* Decorative Botanical Flora */}
      <BotanicalDecor position="top-left" variant="mint" style={styles.decorTL} />
      <BotanicalDecor position="bottom-right" variant="lavender" style={styles.decorBR} />

      {/* Top Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={24} color="#1E293B" />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Daily Check-in</Text>

        {/* Top-Right Badge: + AI Call */}
        <TouchableOpacity
          style={styles.aiCallBadge}
          onPress={handleStartCall}
          activeOpacity={0.8}
        >
          <Text style={styles.plusSign}>+</Text>
          <Bot size={14} color="#9333EA" />
          <Text style={styles.aiCallText}>AI Call</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Mascot / Avatar Greeting Section */}
        <View style={styles.mascotSection}>
          <View style={styles.robotGlowContainer}>
            <RobotAvatar size={100} />
          </View>

          <Text style={styles.greetingTitle}>Hi Shanti ji,</Text>
          <Text style={styles.greetingSubtitle}>
            I'm your SAHAJ assistant.{'\n'}
            Let's check how you're feeling today.
          </Text>
        </View>

        {/* Primary Action: Start Call Button */}
        <TouchableOpacity
          style={styles.startCallBtn}
          onPress={handleStartCall}
          activeOpacity={0.88}
        >
          <View style={styles.phoneIconCircle}>
            <Phone size={22} color="#FFFFFF" fill="#FFFFFF" />
          </View>
          <Text style={styles.startCallText}>Start Call</Text>
        </TouchableOpacity>

        {/* Quick Response Options */}
        <View style={styles.quickOptionsSection}>
          <Text style={styles.quickOptionsTitle}>Or choose a quick option</Text>

          <View style={styles.optionsList}>
            {/* Option 1: I feel fine */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: '#FEF7DF', borderColor: 'rgba(251, 235, 192, 0.7)' },
                selectedOption === 'I feel fine' && styles.optionCardSelected,
              ]}
              onPress={() => handleOptionPress('I feel fine')}
              activeOpacity={0.85}
            >
              <View style={[styles.emojiCircle, { backgroundColor: '#FDE89C' }]}>
                <Text style={styles.emojiText}>😊</Text>
              </View>
              <Text style={[styles.optionLabel, { color: '#3D3314' }]}>I feel fine</Text>
              {selectedOption === 'I feel fine' && (
                <CheckCircle2 size={18} color="#059669" style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            {/* Option 2: I need help */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: '#FDECED', borderColor: 'rgba(249, 206, 211, 0.7)' },
                selectedOption === 'I need help' && styles.optionCardSelected,
              ]}
              onPress={() => handleOptionPress('I need help')}
              activeOpacity={0.85}
            >
              <View style={[styles.emojiCircle, { backgroundColor: '#FCA5A5' }]}>
                <AlertTriangle size={16} color="#DC2626" />
              </View>
              <Text style={[styles.optionLabel, { color: '#5C1C24' }]}>I need help</Text>
              {selectedOption === 'I need help' && (
                <CheckCircle2 size={18} color="#059669" style={styles.checkIcon} />
              )}
            </TouchableOpacity>

            {/* Option 3: I want to talk */}
            <TouchableOpacity
              style={[
                styles.optionCard,
                { backgroundColor: '#F2ECFD', borderColor: 'rgba(222, 208, 250, 0.7)' },
                selectedOption === 'I want to talk' && styles.optionCardSelected,
              ]}
              onPress={() => handleOptionPress('I want to talk')}
              activeOpacity={0.85}
            >
              <View style={[styles.emojiCircle, { backgroundColor: '#D8B4FE' }]}>
                <MessageSquare size={16} color="#7E22CE" />
              </View>
              <Text style={[styles.optionLabel, { color: '#351A61' }]}>I want to talk</Text>
              {selectedOption === 'I want to talk' && (
                <CheckCircle2 size={18} color="#059669" style={styles.checkIcon} />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Footer Disclaimer */}
        <View style={styles.footerNote}>
          <ShieldCheck size={16} color="#64748B" />
          <Text style={styles.footerNoteText}>
            Your answers will be shared with your care coordinator.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F9FD',
  },
  decorTL: {
    top: -15,
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
    paddingHorizontal: 18,
    paddingVertical: 10,
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
    color: '#142240',
  },
  aiCallBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3E8FF',
    borderWidth: 1,
    borderColor: '#E9D5FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    gap: 4,
  },
  plusSign: {
    fontSize: 13,
    fontWeight: '800',
    color: '#9333EA',
  },
  aiCallText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7E22CE',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 32,
    zIndex: 10,
  },
  mascotSection: {
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 20,
  },
  robotGlowContainer: {
    marginBottom: 12,
  },
  greetingTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#14233C',
  },
  greetingSubtitle: {
    fontSize: 14,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 4,
    fontWeight: '500',
  },
  startCallBtn: {
    backgroundColor: '#0D8E75',
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#0E8A73',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
    marginBottom: 24,
  },
  phoneIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startCallText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  quickOptionsSection: {
    marginBottom: 20,
  },
  quickOptionsTitle: {
    textAlign: 'center',
    fontSize: 13.5,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
  },
  optionsList: {
    gap: 11,
  },
  optionCard: {
    borderRadius: 28,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    gap: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  optionCardSelected: {
    borderWidth: 2,
    borderColor: '#059669',
  },
  emojiCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiText: {
    fontSize: 16,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '700',
    flex: 1,
  },
  checkIcon: {
    marginLeft: 'auto',
  },
  footerNote: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 16,
  },
  footerNoteText: {
    fontSize: 11.5,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 16,
  },
});
