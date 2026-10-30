import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Animated,
} from 'react-native';
import {
  useAudioRecorder,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from 'expo-audio';
import { useAppState } from '../../context/AppStateContext';
import { BotanicalDecor } from '../../components/common/BotanicalDecor';
import Svg, { Ellipse, Path, Circle, Rect } from 'react-native-svg';
import {
  Phone,
  Mic,
  ChevronDown,
  Settings,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Trash2,
  CheckCircle2,
  X,
  Volume2,
} from 'lucide-react-native';

interface Props {
  onStartCall: () => void;
  onOpenCheckIn: () => void;
  onOpenVoiceNote?: () => void;
}

type RecordingState = 'idle' | 'recording' | 'review' | 'uploading' | 'success';

export const SeniorHomeScreen: React.FC<Props> = ({
  onStartCall,
  onOpenCheckIn,
}) => {
  const { language, setLanguage, activeSenior, startCall, sendVoiceNote } = useAppState();
  const [selectedLang, setSelectedLang] = useState<'hi' | 'en'>(language);

  // Live Audio Recording States
  const [recordingState, setRecordingState] = useState<RecordingState>('idle');
  const [recordDurationSec, setRecordDurationSec] = useState<number>(0);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);

  // Expo Audio recorder & player hooks
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const player = useAudioPlayer(recordedUri);
  const playerStatus = useAudioPlayerStatus(player);

  const isPlaying = Boolean(playerStatus.playing);
  const playProgress =
    playerStatus.duration > 0
      ? Math.min(1, Math.max(0, playerStatus.currentTime / playerStatus.duration))
      : 0;

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pulseAnim] = useState(() => new Animated.Value(1));

  // Pulse animation for active recording dot
  useEffect(() => {
    if (recordingState === 'recording') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.25,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingState, pulseAnim]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (recorder.isRecording) {
        recorder.stop().catch(() => {});
      }
      if (player.playing) {
        player.pause();
      }
    };
  }, [recorder, player]);

  const handleLangChange = (lang: 'hi' | 'en') => {
    setSelectedLang(lang);
    setLanguage(lang);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // 1. Start live recording using expo-audio
  const startRecording = async () => {
    try {
      // Check & request microphone permission
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          selectedLang === 'hi' ? 'माइक्रोफ़ोन अनुमति चाहिए' : 'Permission Required',
          selectedLang === 'hi'
            ? 'आवाज़ रिकॉर्ड करने के लिए माइक्रोफ़ोन की अनुमति की आवश्यकता है।'
            : 'Microphone permission is required to record a voice note for your coordinator.'
        );
        return;
      }

      // Configure audio session for recording
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });

      if (player.playing) {
        player.pause();
      }

      await recorder.prepareToRecordAsync();
      recorder.record();

      setRecordedUri(null);
      setRecordDurationSec(0);
      setRecordingState('recording');

      // Start duration counter (max 60 seconds)
      let sec = 0;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        sec += 1;
        setRecordDurationSec(sec);
        if (sec >= 60) {
          void stopRecording();
        }
      }, 1000);
    } catch (err: unknown) {
      console.error('Failed to start recording:', err);
      Alert.alert(
        selectedLang === 'hi' ? 'त्रुटि' : 'Recording Error',
        selectedLang === 'hi'
          ? 'रिकॉर्डिंग शुरू नहीं हो सकी। कृपया पुनः प्रयास करें।'
          : 'Could not start recording. Please try again.'
      );
      setRecordingState('idle');
    }
  };

  // 2. Stop live recording and prepare preview
  const stopRecording = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recorder.stop();
      const uri = recorder.uri;

      if (!uri) {
        setRecordingState('idle');
        return;
      }

      // Switch audio session back to normal speaker playback
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
      });

      setRecordedUri(uri);
      setRecordingState('review');
    } catch (err: unknown) {
      console.error('Failed to stop recording:', err);
      setRecordingState('idle');
    }
  };

  // 3. Cancel / discard recording
  const cancelRecording = async () => {
    try {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (recorder.isRecording) {
        await recorder.stop().catch(() => {});
      }
      if (player.playing) {
        player.pause();
      }
    } catch {
      // safe cleanup
    } finally {
      setRecordedUri(null);
      setRecordDurationSec(0);
      setRecordingState('idle');
    }
  };

  // 4. Play / pause preview of recorded audio using expo-audio player
  const togglePlayPreview = async () => {
    if (!recordedUri) return;
    try {
      if (playerStatus.playing) {
        player.pause();
      } else {
        if (playerStatus.currentTime >= playerStatus.duration && playerStatus.duration > 0) {
          await player.seekTo(0);
        }
        player.play();
      }
    } catch (err: unknown) {
      console.error('Error playing sound preview:', err);
    }
  };

  // 5. Send recorded audio to backend endpoint
  const sendRecordedVoiceNote = async () => {
    if (!recordedUri) return;
    try {
      if (player.playing) {
        player.pause();
      }
      setRecordingState('uploading');
      const duration = Math.max(1, Math.min(60, recordDurationSec));
      const success = await sendVoiceNote(recordedUri, duration);
      if (success) {
        setRecordingState('success');
        setTimeout(() => {
          void cancelRecording();
        }, 3500);
      } else {
        setRecordingState('review');
      }
    } catch {
      Alert.alert(
        selectedLang === 'hi' ? 'भेजने में समस्या' : 'Send Failed',
        selectedLang === 'hi'
          ? 'आवाज़ संदेश नहीं भेजा जा सका। कृपया दोबारा प्रयास करें।'
          : 'Could not send the voice note. Please try again.'
      );
      setRecordingState('review');
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
            <Text style={styles.helloText}>
              {selectedLang === 'hi' ? 'नमस्ते' : 'Hello'}, {activeSenior.display_name}
            </Text>
            <Text style={styles.feelingQuestion}>
              {selectedLang === 'hi' ? 'आज आप कैसा महसूस कर रहे हैं?' : 'How are you feeling today?'}
            </Text>
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
              <Text style={styles.btnTitle}>
                {selectedLang === 'hi' ? 'केयर कोऑर्डिनेटर को कॉल करें' : 'Call Care Coordinator'}
              </Text>
              <Text style={styles.btnSubtitle}>
                {selectedLang === 'hi' ? 'बात करने के लिए टैप करें' : 'Tap to connect'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 2. Real Live Audio Recording Section (Line 165) */}
          {recordingState === 'idle' && (
            <TouchableOpacity
              style={styles.voiceNoteBtn}
              onPress={startRecording}
              activeOpacity={0.88}
            >
              <View style={styles.micIconCircle}>
                <Mic size={24} color="#FFFFFF" />
              </View>
              <View style={styles.btnLabelWrapper}>
                <Text style={styles.btnTitle}>
                  {selectedLang === 'hi' ? 'आवाज़ संदेश रिकॉर्ड करें' : 'Record Voice Note'}
                </Text>
                <Text style={styles.btnSubtitlePurple}>
                  {selectedLang === 'hi' ? 'अपनी बात या हाल साझा करें!' : 'Share how you feel!'}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          {/* Active Live Recording Card */}
          {recordingState === 'recording' && (
            <View style={styles.liveRecordCard}>
              <View style={styles.recordTopRow}>
                <View style={styles.recordDotRow}>
                  <Animated.View style={[styles.recordingDot, { opacity: pulseAnim }]} />
                  <Text style={styles.recordingLabel}>
                    {selectedLang === 'hi' ? 'रिकॉर्डिंग चालू है...' : 'Recording Voice Note...'}
                  </Text>
                </View>
                <Text style={styles.recordTimer}>
                  {formatTimer(recordDurationSec)} <Text style={styles.recordMaxTimer}>/ 01:00</Text>
                </Text>
              </View>

              {/* Soundwave bars animation */}
              <View style={styles.waveformContainer}>
                {[14, 24, 38, 20, 32, 16, 28, 42, 22, 12].map((height, i) => (
                  <Animated.View
                    key={i}
                    style={[
                      styles.waveBar,
                      {
                        height: Math.max(8, height * (0.6 + Math.sin(recordDurationSec * 2 + i) * 0.4)),
                        opacity: pulseAnim,
                      },
                    ]}
                  />
                ))}
              </View>

              {/* Controls: Cancel & Stop */}
              <View style={styles.recordControlRow}>
                <TouchableOpacity
                  style={styles.cancelRecordBtn}
                  onPress={cancelRecording}
                  activeOpacity={0.8}
                >
                  <X size={18} color="#DC2626" />
                  <Text style={styles.cancelRecordText}>
                    {selectedLang === 'hi' ? 'रद्द करें' : 'Cancel'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.stopRecordBtn}
                  onPress={stopRecording}
                  activeOpacity={0.88}
                >
                  <Square size={18} color="#FFFFFF" fill="#FFFFFF" />
                  <Text style={styles.stopRecordText}>
                    {selectedLang === 'hi' ? 'रोकें और सुनें' : 'Stop & Review'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Review & Preview Recorded Audio Card */}
          {recordingState === 'review' && (
            <View style={styles.reviewCard}>
              <View style={styles.reviewHeaderRow}>
                <View style={styles.reviewHeaderLeft}>
                  <View style={styles.micReviewCircle}>
                    <Volume2 size={20} color="#6B46C1" />
                  </View>
                  <View>
                    <Text style={styles.reviewTitle}>
                      {selectedLang === 'hi' ? 'आवाज़ संदेश तैयार है' : 'Voice Note Ready'}
                    </Text>
                    <Text style={styles.reviewDuration}>
                      {formatTimer(recordDurationSec)} {selectedLang === 'hi' ? 'सेकंड' : 'seconds recorded'}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity onPress={cancelRecording} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Trash2 size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Playback Preview Bar */}
              <View style={styles.playbackRow}>
                <TouchableOpacity
                  style={styles.playPauseBtn}
                  onPress={togglePlayPreview}
                  activeOpacity={0.85}
                >
                  {isPlaying ? (
                    <Pause size={20} color="#FFFFFF" fill="#FFFFFF" />
                  ) : (
                    <Play size={20} color="#FFFFFF" fill="#FFFFFF" />
                  )}
                </TouchableOpacity>
                <View style={styles.trackContainer}>
                  <View style={styles.trackBackground}>
                    <View style={[styles.trackFill, { width: `${Math.round(playProgress * 100)}%` }]} />
                  </View>
                  <Text style={styles.trackHint}>
                    {isPlaying
                      ? (selectedLang === 'hi' ? 'सुन रहे हैं...' : 'Playing preview...')
                      : (selectedLang === 'hi' ? 'सुनने के लिए टैप करें' : 'Tap to listen')}
                  </Text>
                </View>
              </View>

              {/* Action Buttons: Re-record or Send */}
              <View style={styles.reviewActionsRow}>
                <TouchableOpacity
                  style={styles.reRecordBtn}
                  onPress={cancelRecording}
                  activeOpacity={0.8}
                >
                  <RotateCcw size={16} color="#64748B" />
                  <Text style={styles.reRecordText}>
                    {selectedLang === 'hi' ? 'फिर से रिकॉर्ड करें' : 'Record Again'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.sendRecordBtn}
                  onPress={sendRecordedVoiceNote}
                  activeOpacity={0.88}
                >
                  <Send size={18} color="#FFFFFF" />
                  <Text style={styles.sendRecordText}>
                    {selectedLang === 'hi' ? 'कोऑर्डिनेटर को भेजें' : 'Send to Coordinator'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Uploading In Progress */}
          {recordingState === 'uploading' && (
            <View style={styles.statusBox}>
              <ActivityIndicator size="small" color="#9474E6" />
              <Text style={styles.statusBoxText}>
                {selectedLang === 'hi'
                  ? 'आवाज़ संदेश भेजा जा रहा है...'
                  : 'Sending voice note to Care Coordinator...'}
              </Text>
            </View>
          )}

          {/* Success Banner */}
          {recordingState === 'success' && (
            <View style={styles.successBox}>
              <View style={styles.successIconCircle}>
                <CheckCircle2 size={24} color="#16A34A" />
              </View>
              <View style={styles.successTextWrapper}>
                <Text style={styles.successTitle}>
                  {selectedLang === 'hi' ? 'संदेश सफलतापूर्वक भेजा गया!' : 'Voice Note Sent!'}
                </Text>
                <Text style={styles.successSubtitle}>
                  {selectedLang === 'hi'
                    ? 'आपके केयर कोऑर्डिनेटर को संदेश मिल गया है।'
                    : 'Your Care Coordinator has received your message.'}
                </Text>
              </View>
            </View>
          )}
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

            {/* Decorative Settings Cog */}
            <TouchableOpacity style={styles.settingsCogBtn} activeOpacity={0.8}>
              <Settings size={20} color="#64748B" />
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
    backgroundColor: '#F8F9FD',
  },
  decorTR: {
    position: 'absolute',
    top: -15,
    right: -15,
    zIndex: 1,
  },
  decorBL: {
    position: 'absolute',
    bottom: -15,
    left: -15,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    zIndex: 2,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
  },
  logoSquare: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4340CA',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  brandTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#3B368C',
    letterSpacing: 2.2,
  },
  greetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    gap: 16,
    marginBottom: 20,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarWrapper: {
    width: 74,
    height: 74,
    borderRadius: 37,
    overflow: 'hidden',
    backgroundColor: '#FEEFD5',
  },
  greetingTextContainer: {
    flex: 1,
  },
  helloText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  feelingQuestion: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
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

  // Live Recording Active Styles
  liveRecordCard: {
    backgroundColor: '#FAF5FF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#D8B4FE',
    shadowColor: '#9474E6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
    gap: 12,
  },
  recordTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recordDotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
  },
  recordingLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#7C3AED',
  },
  recordTimer: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E293B',
  },
  recordMaxTimer: {
    fontSize: 12,
    fontWeight: '500',
    color: '#94A3B8',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    backgroundColor: 'rgba(216, 180, 254, 0.2)',
    borderRadius: 16,
    paddingHorizontal: 12,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
    backgroundColor: '#9474E6',
  },
  recordControlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  cancelRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelRecordText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#DC2626',
  },
  stopRecordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#9474E6',
    shadowColor: '#9474E6',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  stopRecordText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Review & Preview Card Styles
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    gap: 14,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reviewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  micReviewCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3E8FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  reviewDuration: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 1,
  },
  playbackRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 10,
  },
  playPauseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#9474E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackContainer: {
    flex: 1,
    gap: 4,
  },
  trackBackground: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  trackFill: {
    height: '100%',
    backgroundColor: '#9474E6',
    borderRadius: 3,
  },
  trackHint: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  reviewActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reRecordBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
  },
  reRecordText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  sendRecordBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: '#008774',
    shadowColor: '#008774',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  sendRecordText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // Uploading Box
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#FAF5FF',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: '#D8B4FE',
  },
  statusBoxText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#7C3AED',
  },

  // Success Box
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0FDF4',
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  successIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  successTextWrapper: {
    flex: 1,
  },
  successTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#166534',
  },
  successSubtitle: {
    fontSize: 12,
    color: '#15803D',
    marginTop: 2,
  },

  // Language Section
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
