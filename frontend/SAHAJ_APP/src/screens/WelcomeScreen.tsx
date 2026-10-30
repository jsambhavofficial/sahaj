import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppState } from '../context/AppStateContext';
import { BotanicalDecor } from '../components/common/BotanicalDecor';
import { CaringIllustration } from '../components/illustrations/CaringIllustration';
import Svg, { Path } from 'react-native-svg';
import { UserCheck, ChevronRight, User } from 'lucide-react-native';

interface Props {
  onSelectRole: (role: 'coordinator' | 'senior') => void;
}

export const WelcomeScreen: React.FC<Props> = ({ onSelectRole }) => {
  const { setRole } = useAppState();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const handleChoose = (role: 'coordinator' | 'senior') => {
    setRole(role);
    onSelectRole(role);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Botanical Backdrop Ornaments */}
      <BotanicalDecor position="top-left" variant="mint" style={styles.decorTL} />
      <BotanicalDecor position="top-right" variant="mint" style={styles.decorTR} />
      <BotanicalDecor position="bottom-left" variant="mint" style={styles.decorBL} />
      <BotanicalDecor position="bottom-right" variant="mint" style={styles.decorBR} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Brand Header */}
        <View style={styles.brandingSection}>
          {/* SAHAJ Lotus / Heart Healthcare Emblem */}
          <View style={styles.emblemContainer}>
            <Svg width="56" height="56" viewBox="0 0 64 64" fill="none">
              <Path
                d="M30.5 44C21 43 14 34 14 23C14 15 21 11 26 15C30 18.2 31.5 24 31.5 29C31.5 35 31 40 30.5 44Z"
                fill="#157B67"
                opacity={0.95}
              />
              <Path
                d="M33.5 44C43 43 50 34 50 23C50 15 43 11 38 15C34 18.2 32.5 24 32.5 29C32.5 35 33 40 33.5 44Z"
                fill="#157B67"
                opacity={0.95}
              />
              <Path d="M32 18C29 25 29 33 32 38C35 33 35 25 32 18Z" fill="#3AB294" />
              <Path d="M26 44C30 46.5 34 46.5 38 44C35 48 29 48 26 44Z" fill="#0D6B58" />
            </Svg>
          </View>

          {/* Main Title */}
          <Text style={styles.brandTitle}>SAHAJ</Text>
          {/* Tagline */}
          <Text style={styles.brandTagline}>Healthier Todays, Safer Tomorrows</Text>
        </View>

        {/* Hero Illustration Section */}
        <View style={styles.heroSection}>
          <CaringIllustration width={Math.min(width * 0.76, 290)} height={220} />
        </View>

        {/* Role Selection Actions */}
        <View style={styles.actionsSection}>
          {/* Primary Button: Care Coordinator */}
          <TouchableOpacity
            style={styles.coordinatorButton}
            onPress={() => handleChoose('coordinator')}
            activeOpacity={0.88}
          >
            <View style={styles.buttonLeftGroup}>
              <View style={styles.coordIconWrapper}>
                <UserCheck size={18} color="#FFFFFF" />
              </View>
              <Text style={styles.coordinatorButtonText}>Care Coordinator</Text>
            </View>
            <ChevronRight size={20} color="rgba(255,255,255,0.85)" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Secondary Button: Senior */}
          <TouchableOpacity
            style={styles.seniorButton}
            onPress={() => handleChoose('senior')}
            activeOpacity={0.88}
          >
            <View style={styles.buttonLeftGroup}>
              <View style={styles.seniorIconWrapper}>
                <User size={18} color="#0D6B58" />
              </View>
              <Text style={styles.seniorButtonText}>Senior</Text>
            </View>
            <ChevronRight size={20} color="#0D6B58" strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EAF7F0',
  },
  decorTL: {
    top: -20,
    left: -20,
  },
  decorTR: {
    top: -20,
    right: -20,
  },
  decorBL: {
    bottom: -20,
    left: -20,
  },
  decorBR: {
    bottom: -20,
    right: -20,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  brandingSection: {
    alignItems: 'center',
    paddingTop: 10,
    zIndex: 10,
  },
  emblemContainer: {
    width: 60,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: 3.5,
    color: '#0D6B58',
    textTransform: 'uppercase',
  },
  brandTagline: {
    fontSize: 13,
    fontWeight: '500',
    color: '#065F46',
    marginTop: 4,
    opacity: 0.9,
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    zIndex: 10,
  },
  actionsSection: {
    width: '100%',
    paddingBottom: 24,
    gap: 14,
    zIndex: 20,
  },
  coordinatorButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#0D6B58',
    borderRadius: 28,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    shadowColor: '#0A4A3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  coordIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordinatorButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  seniorButton: {
    width: '100%',
    height: 56,
    backgroundColor: '#FFFFFF',
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: 'rgba(13, 107, 88, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  seniorIconWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EBF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seniorButtonText: {
    color: '#0D6B58',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
