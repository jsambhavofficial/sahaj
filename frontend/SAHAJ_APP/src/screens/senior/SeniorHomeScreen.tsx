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
import Svg, { Ellipse, Path, Circle, Rect } from 'react-native-svg';
import {
  Phone,
  Mic,
  ChevronDown,
  Settings,
} from 'lucide-react-native';

interface Props {
  onStartCall: () => void;
  onOpenCheckIn: () => void;
  onOpenVoiceNote?: () => void;
}

export const SeniorHomeScreen: React.FC<Props> = ({
  onStartCall,
  onOpenCheckIn,
  onOpenVoiceNote,
}) => {
  const { language, setLanguage, activeSenior, startCall } = useAppState();
  const [selectedLang, setSelectedLang] = useState<'hi' | 'en'>(language);

  const handleLangChange = (lang: 'hi' | 'en') => {
    setSelectedLang(lang);
    setLanguage(lang);
  };

  const handleVoiceNoteClick = () => {
    if (onOpenVoiceNote) {
      onOpenVoiceNote();
    } else {
      Alert.alert(
        'Voice Note',
        'Voice notes are coming soon. For now, use "Call Care Coordinator" or the daily check-in.'
      );
    }
  };

  return (
    <View style={styles.container}>
      {/* Decorative Botanical Flora */}
      <BotanicalDecor position="top-right" variant="mint" style={styles.decorTR} />
      <BotanicalDecor position="bottom-left" variant="lavender" style={styles.decorBL} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Brand Header */}
        <View style={styles.brandHeader}>
          {/* SAHAJ Lotus Emblem */}
          <View style={styles.logoSquare}>
            <Svg width="36" height="36" viewBox="0 0 100 100">
              <Ellipse cx="50" cy="40" rx="9" ry="18" fill="#5F67E8" />
              <Path
                d="M43 45C33 37 18 42 22 62C32 63 41 57 45 47C44.3 46.3 43.6 45.6 43 45Z"
                fill="#758AF0"
                opacity={0.9}
              />
              <Path
                d="M57 45C67 37 82 42 78 62C68 63 59 57 55 47C55.7 46.3 56.4 45.6 57 45Z"
                fill="#758AF0"
                opacity={0.9}
              />
              <Path
                d="M38 61C24 62 18 78 35 83C46 80 47 69 40 62L38 61Z"
                fill="#8E9EFA"
                opacity={0.75}
              />
              <Path
                d="M62 61C76 62 82 78 65 83C54 80 53 69 60 62L62 61Z"
                fill="#8E9EFA"
                opacity={0.75}
              />
              <Circle cx="50" cy="68" r="7" fill="#4340CA" />
            </Svg>
          </View>
          <Text style={styles.brandTitle}>SAHAJ</Text>
        </View>

        {/* Greeting Profile Card */}
        <View style={styles.greetingCard}>
          {/* Senior Woman Avatar Illustration */}
          <View style={styles.avatarWrapper}>
            <Svg width="74" height="74" viewBox="0 0 120 120">
              <Circle cx="60" cy="60" r="60" fill="#FEEFD5" />
              {/* Hair bun */}
              <Ellipse cx="60" cy="46" rx="34" ry="32" fill="#E2E8F0" />
              <Circle cx="60" cy="24" r="14" fill="#CBD5E1" />
              {/* Face */}
              <Ellipse cx="60" cy="54" rx="22" ry="24" fill="#FAD4B2" />
              {/* Saree */}
              <Path d="M25 120 C 30 85, 55 82, 60 120 Z" fill="#F59E0B" />
              <Path d="M42 90 Q 60 102 98 120 L 20 120 Z" fill="#D97706" />
              {/* Neck */}
              <Rect x="53" y="72" width="14" height="12" rx="3" fill="#F5C096" />
              {/* Bindi */}
              <Circle cx="60" cy="45" r="2.2" fill="#DC2626" />
              {/* Smile */}
              <Path
                d="M54 62 Q 60 67 66 62"
                fill="none"
                stroke="#B45309"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Eyes */}
              <Path
                d="M48 51 Q 52 49 55 52"
                fill="none"
                stroke="#475569"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              <Path
                d="M65 52 Q 68 49 72 51"
                fill="none"
                stroke="#475569"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Earrings */}
              <Circle cx="38" cy="56" r="2.5" fill="#F59E0B" />
              <Circle cx="82" cy="56" r="2.5" fill="#F59E0B" />
            </Svg>
          </View>

          <View style={styles.greetingTextContainer}>
            <Text style={styles.helloText}>Hello, {activeSenior.display_name}</Text>
            <Text style={styles.feelingQuestion}>How are you feeling today?</Text>
          </View>
        </View>

        {/* Primary Action Buttons */}
        <View style={styles.actionsSection}>
          {/* 1. Green Pill Button: Call Care Coordinator */}
          <TouchableOpacity
            style={styles.callCoordinatorBtn}
            onPress={() => {
              startCall('Your Care Coordinator');
              onStartCall();
            }}
            activeOpacity={0.88}
          >
            <View style={styles.phoneIconCircle}>
              <Phone size={24} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <View style={styles.btnLabelWrapper}>
              <Text style={styles.btnTitle}>Call Care Coordinator</Text>
              <Text style={styles.btnSubtitle}>Tap to connect</Text>
            </View>
          </TouchableOpacity>

          {/* 2. Soft Purple Pill Button: Record Voice Note */}
          <TouchableOpacity
            style={styles.voiceNoteBtn}
            onPress={handleVoiceNoteClick}
            activeOpacity={0.88}
          >
            <View style={styles.micIconCircle}>
              <Mic size={24} color="#FFFFFF" />
            </View>
            <View style={styles.btnLabelWrapper}>
              <Text style={styles.btnTitle}>Record Voice Note</Text>
              <Text style={styles.btnSubtitlePurple}>Share how you feel!</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Language Selector Section */}
        <View style={styles.langSection}>
          <View style={styles.langHeader}>
            <Text style={styles.langLabel}>Language</Text>
            <ChevronDown size={14} color="#64748B" />
          </View>

          <View style={styles.langButtonsRow}>
            {/* Hindi Option */}
            <TouchableOpacity
              style={[
                styles.langPill,
                selectedLang === 'hi' ? styles.langPillActive : styles.langPillInactive,
              ]}
              onPress={() => handleLangChange('hi')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.langText,
                  selectedLang === 'hi' ? styles.langTextActive : styles.langTextInactive,
                ]}
              >
                हिन्दी
              </Text>
            </TouchableOpacity>

            {/* English Option */}
            <TouchableOpacity
              style={[
                styles.langPill,
                selectedLang === 'en' ? styles.langPillActive : styles.langPillInactive,
              ]}
              onPress={() => handleLangChange('en')}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.langText,
                  selectedLang === 'en' ? styles.langTextActive : styles.langTextInactive,
                ]}
              >
                English
              </Text>
            </TouchableOpacity>

            {/* Settings Cog Button */}
            <TouchableOpacity
              style={styles.settingsCogBtn}
              onPress={() => Alert.alert('Settings', 'App language: Hindi/English. Connected to SamarthCare AI.')}
              activeOpacity={0.7}
            >
              <Settings size={18} color="#475569" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFD',
  },
  decorTR: {
    top: -15,
    right: -15,
    opacity: 0.7,
  },
  decorBL: {
    bottom: -15,
    left: -15,
    opacity: 0.6,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 36,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  logoSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#EEF2FF',
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    color: '#1F3365',
  },
  greetingCard: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#324673',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    width: 74,
    height: 74,
    borderRadius: 37,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#FDE68A',
  },
  greetingTextContainer: {
    flex: 1,
  },
  helloText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },
  feelingQuestion: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#1E325C',
    marginTop: 2,
    lineHeight: 22,
  },
  actionsSection: {
    gap: 14,
    marginBottom: 20,
  },
  callCoordinatorBtn: {
    backgroundColor: '#008774',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#008774',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  phoneIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabelWrapper: {
    flex: 1,
  },
  btnTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  btnSubtitle: {
    color: '#CCFBF1',
    fontSize: 12,
    marginTop: 2,
  },
  voiceNoteBtn: {
    backgroundColor: '#9474E6',
    borderRadius: 28,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#906FE2',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  micIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubtitlePurple: {
    color: '#F3E8FF',
    fontSize: 12,
    marginTop: 2,
  },
  langSection: {
    marginTop: 4,
  },
  langHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  langLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  langButtonsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  langPill: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
  },
  langPillActive: {
    backgroundColor: '#F0FAF7',
    borderColor: 'rgba(0, 135, 116, 0.7)',
  },
  langPillInactive: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: '#E2E8F0',
  },
  langText: {
    fontSize: 14,
    fontWeight: '700',
  },
  langTextActive: {
    color: '#008774',
  },
  langTextInactive: {
    color: '#334155',
  },
  settingsCogBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
