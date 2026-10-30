import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Heart, UserCheck } from 'lucide-react-native';
import { useAppState } from '../context/AppStateContext';
import type { UserRole } from '../types';

interface Props {
  role: UserRole;
  onBack: () => void;
}

export const LoginScreen: React.FC<Props> = ({ role, onBack }) => {
  const { authStatus, authError, loginCoordinator, loginSenior } = useAppState();
  const insets = useSafeAreaInsets();
  const busy = authStatus === 'signingIn';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');

  const isSenior = role === 'senior';
  const canSubmit = !busy && (isSenior ? code.trim().length >= 20 : email.trim().length > 3 && password.length > 0);

  const submit = () => {
    if (!canSubmit) return;
    if (isSenior) void loginSenior(code);
    else void loginCoordinator(email, password);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableOpacity onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back" disabled={busy}>
        <ArrowLeft size={22} color="#0D6B58" />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.iconCircle}>{isSenior ? <Heart size={34} color="#0D6B58" /> : <UserCheck size={34} color="#0D6B58" />}</View>

        {isSenior ? (
          <>
            <Text style={styles.title}>अपने फ़ोन को जोड़ें</Text>
            <Text style={styles.subtitle}>Connect your phone</Text>
            <Text style={styles.help}>
              केयर कोऑर्डिनेटर से मिला कोड यहाँ पेस्ट करें।{'\n'}Your care coordinator will send you a pairing code. Paste it here.
            </Text>

            <Text style={styles.label}>पेयरिंग कोड / Pairing code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              value={code}
              onChangeText={setCode}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              multiline
              placeholder="कोड पेस्ट करें / Paste the code"
              placeholderTextColor="#94A3B8"
              editable={!busy}
              onSubmitEditing={submit}
              returnKeyType="go"
              accessibilityLabel="Pairing code"
            />
          </>
        ) : (
          <>
            <Text style={styles.title}>Care Coordinator sign in</Text>
            <Text style={styles.help}>Use the email and password your organization gave you.</Text>

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              keyboardType="email-address"
              textContentType="username"
              placeholder="name@example.com"
              placeholderTextColor="#94A3B8"
              editable={!busy}
              returnKeyType="next"
              accessibilityLabel="Email"
            />

            <Text style={styles.label}>Password</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password"
                textContentType="password"
                placeholder="Your password"
                placeholderTextColor="#94A3B8"
                editable={!busy}
                onSubmitEditing={submit}
                returnKeyType="go"
                accessibilityLabel="Password"
              />
              <TouchableOpacity onPress={() => setShowPassword((s) => !s)} style={styles.showBtn} accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}>
                <Text style={styles.showText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {authError ? (
          <View style={styles.errorBox} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{authError}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.primary, !canSubmit && styles.primaryDisabled]}
          onPress={submit}
          disabled={!canSubmit}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>{isSenior ? 'जुड़ें / Connect' : 'Sign in'}</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4FBF8' },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, minHeight: 48 },
  backText: { fontSize: 15, fontWeight: '700', color: '#0D6B58' },
  content: { padding: 24, paddingTop: 8, alignItems: 'stretch', gap: 6 },
  iconCircle: { alignSelf: 'center', width: 72, height: 72, borderRadius: 36, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 16, fontWeight: '600', color: '#475569', textAlign: 'center' },
  help: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 21, marginTop: 6, marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 10, marginBottom: 6 },
  input: { backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#CBD5E1', borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 17, color: '#0F172A', minHeight: 54 },
  codeInput: { fontSize: 15, fontWeight: '600', minHeight: 96, textAlignVertical: 'top' },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1 },
  showBtn: { position: 'absolute', right: 6, paddingHorizontal: 12, paddingVertical: 10 },
  showText: { fontSize: 13, fontWeight: '700', color: '#0D6B58' },
  errorBox: { backgroundColor: '#FEF2F2', borderColor: '#FECACA', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 14 },
  errorText: { color: '#B91C1C', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  primary: { backgroundColor: '#0D6B58', borderRadius: 16, minHeight: 56, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryDisabled: { backgroundColor: '#9CC9BD' },
  primaryText: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
});
