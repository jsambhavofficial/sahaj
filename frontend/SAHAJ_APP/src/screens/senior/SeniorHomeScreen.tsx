import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  Image,
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
import {
  Phone,
  Mic,
  Globe,
  Square,
  Play,
  Pause,
  RotateCcw,
  Send,
  Trash2,
  CheckCircle2,
  X,
  Volume2,
  LogOut,
} from 'lucide-react-native';

const SENIOR_AVATAR = require('../../../assets/senior_avatar.jpg');
const SAHAJ_LOGO = require('../../../assets/sahaj_hero.png');

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
  const { language, setLanguage, activeSenior, startCall, sendVoiceNote, logout } = useAppState();
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
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Section: Brand Header & Greeting Profile Card */}
        <View style={styles.topSection}>
          {/* Brand Header */}
          <View style={styles.brandHeader}>
            <Image source={SAHAJ_LOGO} style={styles.brandLogo} resizeMode="contain" />
            <TouchableOpacity
              style={styles.bellBtn}
              onPress={() => void logout()}
              activeOpacity={0.7}
              accessibilityLabel="Log out"
            >
              <LogOut size={26} color="#008774" />
            </TouchableOpacity>
          </View>

          {/* Greeting Profile Card */}
          <View style={styles.greetingCard}>
            <View style={styles.avatarWrapper}>
              <Image
                source={SENIOR_AVATAR}
                style={styles.avatarImage}
                resizeMode="cover"
              />
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
        </View>

        {/* Center: Two Big Action Buttons Covering All Leftover Space */}
        <View style={styles.actionsSection}>
          {/* 1. Big ORANGE Button: Call Care Coordinator */}
          <TouchableOpacity
            style={styles.callCoordinatorBtn}
            onPress={() => {
              startCall('Your Care Coordinator');
              onStartCall();
            }}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Call Care Coordinator"
          >
            <View style={styles.phoneIconCircle}>
              <Phone size={34} color="#FFFFFF" fill="#FFFFFF" />
            </View>
            <View style={styles.btnLabelWrapper}>
              <Text style={styles.btnTitle}>
                {selectedLang === 'hi' ? 'केयर कोऑर्डिनेटर को कॉल करें' : 'Call Care Coordinator'}
              </Text>
              <Text style={styles.btnSubtitleRed}>
                {selectedLang === 'hi' ? 'तुरंत बात करने के लिए टैप करें' : 'Tap to connect immediately'}
              </Text>
            </View>
          </TouchableOpacity>

          {/* 2. Big GREEN Button: Record Voice Note & Send */}
          {recordingState === 'idle' && (
            <TouchableOpacity
              style={styles.voiceNoteBtn}
              onPress={startRecording}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="Record Voice Note"
            >
              <View style={styles.micIconCircle}>
                <Mic size={34} color="#FFFFFF" />
              </View>
              <View style={styles.btnLabelWrapper}>
                <Text style={styles.btnTitle}>
                  {selectedLang === 'hi' ? 'आवाज़ संदेश रिकॉर्ड करें' : 'Record Voice Note'}
                </Text>
                <Text style={styles.btnSubtitleGreen}>
                  {selectedLang === 'hi' ? 'बोलें और संदेश भेजें' : 'Tap to record & send voice note'}
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
                    <Volume2 size={20} color="#059669" />
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
              <ActivityIndicator size="small" color="#059669" />
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

        {/* Bottom Section: Language Bar Just Above the Navigation Bar */}
        <View style={styles.bottomLangBar}>
          <View style={styles.langBarCard}>
            <View style={styles.langLabelGroup}>
              <Globe size={18} color="#0D6B58" />
              <Text style={styles.langLabelText}>
                {selectedLang === 'hi' ? 'भाषा' : 'Language'}
              </Text>
            </View>

            <View style={styles.langPillsGroup}>
              {/* Hindi Option */}
              <TouchableOpacity
                style={[
                  styles.langPill,
                  selectedLang === 'hi' ? styles.langPillActive : styles.langPillInactive,
                ]}
                onPress={() => handleLangChange('hi')}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel="Switch language to Hindi"
              >
                <Text
                  style={[
                    styles.langPillText,
                    selectedLang === 'hi' ? styles.langPillTextActive : styles.langPillTextInactive,
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
                accessibilityRole="button"
                accessibilityLabel="Switch language to English"
              >
                <Text
                  style={[
                    styles.langPillText,
                    selectedLang === 'en' ? styles.langPillTextActive : styles.langPillTextInactive,
                  ]}
                >
                  English
                </Text>
              </TouchableOpacity>
            </View>
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
  decorBL: {
    position: 'absolute',
    bottom: -15,
    left: -15,
    zIndex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    zIndex: 2,
  },
  topSection: {
    marginBottom: 6,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  brandLogo: {
    width: 150,
    height: 56,
  },
  bellBtn: {
    marginLeft: 'auto',
    padding: 8,
    marginRight: 14,
  },
  greetingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    padding: 14,
    gap: 14,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  avatarWrapper: {
    width: 70,
    height: 70,
    borderRadius: 35,
    overflow: 'hidden',
    backgroundColor: '#FEEFD5',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  greetingTextContainer: {
    flex: 1,
  },
  helloText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 3,
  },
  feelingQuestion: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Big Action Buttons - Covering leftover space
  actionsSection: {
    flex: 1,
    justifyContent: 'space-evenly',
    gap: 14,
    marginVertical: 10,
  },
  callCoordinatorBtn: {
    flex: 1,
    minHeight: 125,
    backgroundColor: '#EA580C',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  phoneIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnLabelWrapper: {
    flex: 1,
  },
  btnTitle: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '800',
    letterSpacing: 0.2,
    lineHeight: 27,
  },
  btnSubtitleRed: {
    color: '#FFEDD5',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },
  voiceNoteBtn: {
    flex: 1,
    minHeight: 125,
    backgroundColor: '#059669',
    borderRadius: 24,
    paddingVertical: 18,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  micIconCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSubtitleGreen: {
    color: '#D1FAE5',
    fontSize: 14,
    marginTop: 4,
    fontWeight: '600',
  },

  // Live Recording Active Styles
  liveRecordCard: {
    flex: 1,
    minHeight: 125,
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
    justifyContent: 'center',
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
    backgroundColor: '#059669',
    shadowColor: '#059669',
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
    flex: 1,
    minHeight: 125,
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
    justifyContent: 'center',
    gap: 12,
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
    backgroundColor: '#DCFCE7',
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
    backgroundColor: '#059669',
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
    backgroundColor: '#059669',
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
    flex: 1,
    minHeight: 100,
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
    flex: 1,
    minHeight: 100,
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

  // Language Section - Bottom Just Above Navigation Bar
  bottomLangBar: {
    paddingTop: 8,
    paddingBottom: 2,
  },
  langBarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  langLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 4,
  },
  langLabelText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0D6B58',
  },
  langPillsGroup: {
    flexDirection: 'row',
    gap: 8,
  },
  langPill: {
    paddingVertical: 7,
    paddingHorizontal: 18,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillActive: {
    backgroundColor: '#0D6B58',
    shadowColor: '#0D6B58',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 2,
  },
  langPillInactive: {
    backgroundColor: '#F1F5F9',
  },
  langPillText: {
    fontSize: 13,
    fontWeight: '700',
  },
  langPillTextActive: {
    color: '#FFFFFF',
  },
  langPillTextInactive: {
    color: '#475569',
  },
});
