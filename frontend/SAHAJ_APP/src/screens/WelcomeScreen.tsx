import React from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppState } from '../context/AppStateContext';
import { BotanicalDecor } from '../components/common/BotanicalDecor';
import { UserCheck, ChevronRight, User } from 'lucide-react-native';

const SAHAJ_LOGO = require('../../assets/sahaj_hero.png');

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

  const heroSize = Math.min(width * 0.85, 320);

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
        {/* Hero Section with Official Sahaj AI Artwork */}
        <View style={styles.heroSection}>
          <Image
            source={SAHAJ_LOGO}
            style={[styles.heroImage, { width: heroSize, height: heroSize }]}
            resizeMode="contain"
          />
        </View>

        {/* Role Selection Actions */}
        <View style={styles.actionsSection}>
          {/* Primary Button: Care Coordinator */}
          <TouchableOpacity
            style={styles.coordinatorButton}
            onPress={() => handleChoose('coordinator')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Continue as Care Coordinator"
          >
            <View style={styles.buttonLeftGroup}>
              <View style={styles.coordIconWrapper}>
                <UserCheck size={22} color="#FFFFFF" />
              </View>
              <Text style={styles.coordinatorButtonText}>Care Coordinator</Text>
            </View>
            <ChevronRight size={22} color="rgba(255,255,255,0.9)" strokeWidth={2.5} />
          </TouchableOpacity>

          {/* Secondary Button: Senior */}
          <TouchableOpacity
            style={styles.seniorButton}
            onPress={() => handleChoose('senior')}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Continue as Senior"
          >
            <View style={styles.buttonLeftGroup}>
              <View style={styles.seniorIconWrapper}>
                <User size={22} color="#0D6B58" />
              </View>
              <Text style={styles.seniorButtonText}>Senior</Text>
            </View>
            <ChevronRight size={22} color="#0D6B58" strokeWidth={2.5} />
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
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    zIndex: 10,
  },
  heroImage: {
    alignSelf: 'center',
  },
  actionsSection: {
    width: '100%',
    paddingBottom: 24,
    gap: 16,
    zIndex: 20,
  },
  coordinatorButton: {
    width: '100%',
    height: 66,
    backgroundColor: '#0D6B58',
    borderRadius: 33,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    shadowColor: '#0A4A3D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  coordIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coordinatorButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  seniorButton: {
    width: '100%',
    height: 66,
    backgroundColor: '#FFFFFF',
    borderRadius: 33,
    borderWidth: 2,
    borderColor: 'rgba(13, 107, 88, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  seniorIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EBF7F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seniorButtonText: {
    color: '#0D6B58',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
