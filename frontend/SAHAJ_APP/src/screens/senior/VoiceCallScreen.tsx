import React, { useEffect } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Mic, PhoneOff, Send, Volume2 } from 'lucide-react-native';
import { useAppState } from '../../context/AppStateContext';
import { useVoiceCall } from '../../voice/useVoiceCall';
import type { Phase } from '../../voice/callMachine';

interface Props {
  onBack: () => void;
}

const TEXT: Record<'hi' | 'en', Record<string, string>> = {
  hi: {
    title: 'सहज से बात करें',
    connecting: 'जुड़ रहे हैं…',
    agent_speaking: 'सहज बोल रहे हैं…',
    your_turn: 'मैं सुन रहा हूँ…',
    recording: 'बोलिए, मैं सुन रहा हूँ। पूरा होने पर रुक जाइए।',
    thinking: 'समझ रहा हूँ…',
    tap_talk: 'बोलिए',
    tap_send: 'भेजिए',
    hang_up: 'कॉल खत्म करें',
    retry: 'फिर कोशिश करें',
    close: 'बंद करें',
    ended: 'बात-चीत पूरी हुई। धन्यवाद!',
    you_said: 'आपने कहा',
    too_short: 'आवाज़ बहुत छोटी थी। कृपया बटन दबाकर फिर बोलिए।',
    note: 'यह एक सहायक है, डॉक्टर नहीं। आपातकाल में अपने देखभालकर्ता को फ़ोन करें।',
  },
  en: {
    title: 'Talk to Sahaj',
    connecting: 'Connecting…',
    agent_speaking: 'Sahaj is speaking…',
    your_turn: 'Listening…',
    recording: 'Go ahead, I am listening. Pause when you are done.',
    thinking: 'One moment…',
    tap_talk: 'Speak',
    tap_send: 'Send',
    hang_up: 'End call',
    retry: 'Try again',
    close: 'Close',
    ended: 'The chat is over. Thank you!',
    you_said: 'You said',
    too_short: 'That was too short. Please tap the button and speak again.',
    note: 'This is an assistant, not a doctor. In an emergency, call your caretaker.',
  },
};

const STATUS_KEY: Partial<Record<Phase, string>> = {
  connecting: 'connecting',
  agent_speaking: 'agent_speaking',
  your_turn: 'your_turn',
  recording: 'recording',
  thinking: 'thinking',
};

export const VoiceCallScreen: React.FC<Props> = ({ onBack }) => {
  const { language } = useAppState();
  const t = TEXT[language === 'hi' ? 'hi' : 'en'];
  const { state, micDebug, start, startTalking, stopTalking, hangUp } = useVoiceCall();
  const { phase } = state;

  useEffect(() => {
    void start();
  }, [start]);

  const finished = phase === 'ended' || phase === 'error';
  const canTalk = phase === 'your_turn' || (phase === 'agent_speaking' && state.turnDone);
  const recording = phase === 'recording';
  const busy = phase === 'connecting' || phase === 'thinking';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t.title}</Text>

      <ScrollView contentContainerStyle={styles.body}>
        {state.agentText ? <Text style={styles.agentText}>{state.agentText}</Text> : null}
        {state.transcript && !finished ? (
          <Text style={styles.transcript}>
            {t.you_said}: {state.transcript}
          </Text>
        ) : null}
        {phase === 'ended' ? <Text style={styles.status}>{t.ended}</Text> : null}
        {__DEV__ && phase === 'recording' && micDebug ? <Text style={styles.audioIssue}>{micDebug}</Text> : null}
        {state.audioIssue ? <Text style={styles.audioIssue}>Sound problem: {state.audioIssue}</Text> : null}
        {state.error ? <Text style={styles.error}>{state.error.code === 'too_short' ? t.too_short : state.error.message}</Text> : null}
        {phase === 'ended' && state.summary ? <Text style={styles.summary}>{state.summary}</Text> : null}
      </ScrollView>

      {!finished ? (
        <>
          <View style={styles.statusRow}>
            {busy ? <ActivityIndicator color="#0D6B58" /> : phase === 'agent_speaking' ? <Volume2 size={22} color="#0D6B58" /> : null}
            <Text style={styles.status}>{t[STATUS_KEY[phase] ?? 'connecting']}</Text>
          </View>

          <TouchableOpacity
            style={[styles.mic, recording && styles.micRecording, !canTalk && !recording && styles.micDisabled]}
            disabled={!canTalk && !recording}
            onPress={recording ? () => void stopTalking() : () => void startTalking()}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={recording ? t.tap_send : t.tap_talk}
          >
            {recording ? <Send size={44} color="#FFFFFF" /> : <Mic size={44} color="#FFFFFF" />}
            <Text style={styles.micLabel}>{recording ? t.tap_send : t.tap_talk}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.hangUp} onPress={hangUp} accessibilityRole="button">
            <PhoneOff size={20} color="#B91C1C" />
            <Text style={styles.hangUpText}>{t.hang_up}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <View style={styles.actions}>
          {phase === 'error' && state.error?.code !== 'auth' ? (
            <TouchableOpacity style={styles.primary} onPress={() => void start()} accessibilityRole="button">
              <Text style={styles.primaryText}>{t.retry}</Text>
            </TouchableOpacity>
          ) : null}
          <TouchableOpacity style={styles.secondary} onPress={onBack} accessibilityRole="button">
            <Text style={styles.secondaryText}>{t.close}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.note}>{t.note}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0FAF7', padding: 20 },
  title: { fontSize: 26, fontWeight: '700', color: '#0F172A', textAlign: 'center', marginTop: 8 },
  body: { flexGrow: 1, justifyContent: 'center', paddingVertical: 16 },
  agentText: { fontSize: 24, lineHeight: 34, color: '#0F172A', textAlign: 'center' },
  transcript: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 16 },
  audioIssue: { fontSize: 13, color: '#B45309', textAlign: 'center', marginTop: 12 },
  summary: { fontSize: 16, color: '#334155', textAlign: 'center', marginTop: 16 },
  error: { fontSize: 18, color: '#B91C1C', textAlign: 'center', marginTop: 16 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, minHeight: 32 },
  status: { fontSize: 18, color: '#0D6B58', textAlign: 'center', fontWeight: '600' },
  mic: {
    alignSelf: 'center', width: 168, height: 168, borderRadius: 84, backgroundColor: '#0D6B58',
    alignItems: 'center', justifyContent: 'center', marginVertical: 16, gap: 6,
  },
  micRecording: { backgroundColor: '#DC2626' },
  micDisabled: { backgroundColor: '#94A3B8' },
  micLabel: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  hangUp: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 12 },
  hangUpText: { color: '#B91C1C', fontSize: 16, fontWeight: '600' },
  actions: { gap: 12, marginVertical: 16 },
  primary: { backgroundColor: '#0D6B58', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  secondary: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', borderWidth: 1, borderColor: '#A7F3D0' },
  secondaryText: { color: '#0D6B58', fontSize: 18, fontWeight: '600' },
  note: { fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4 },
});
