import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';
import { colors } from '../../theme/colors';

interface Props {
  size?: number;
  showTagline?: boolean;
  theme?: 'teal' | 'lavender';
}

export const BrandLogo: React.FC<Props> = ({
  size = 48,
  showTagline = true,
  theme = 'teal',
}) => {
  const isLavender = theme === 'lavender';
  const primaryColor = isLavender ? colors.lavenderPrimary : colors.primaryTeal;
  const secondaryColor = isLavender ? '#C084FC' : '#52B788';
  const lightColor = isLavender ? colors.lavenderMedium : colors.mintMedium;

  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
        {/* Soft background glow */}
        <Circle cx="32" cy="32" r="28" fill={lightColor} opacity="0.4" />
        
        {/* Four-leaf caring emblem */}
        <G transform="translate(32, 32)">
          {/* Top Leaf */}
          <Path
            d="M0 0 C -8 -10, -12 -22, 0 -26 C 12 -22, 8 -10, 0 0"
            fill={primaryColor}
          />
          {/* Right Leaf */}
          <Path
            d="M0 0 C 10 -8, 22 -12, 26 0 C 22 12, 10 8, 0 0"
            fill={secondaryColor}
          />
          {/* Bottom Leaf */}
          <Path
            d="M0 0 C 8 10, 12 22, 0 26 C -12 22, -8 10, 0 0"
            fill={primaryColor}
            opacity="0.85"
          />
          {/* Left Leaf */}
          <Path
            d="M0 0 C -10 8, -22 12, -26 0 C -22 -12, -10 -8, 0 0"
            fill={secondaryColor}
            opacity="0.85"
          />
          {/* Center heart/seed core */}
          <Circle cx="0" cy="0" r="3.5" fill="#FFFFFF" />
        </G>
      </Svg>
      <View style={styles.textContainer}>
        <Text style={[styles.title, { color: primaryColor }]}>SAHAJ</Text>
        {showTagline && (
          <Text style={styles.tagline}>Care that feels closer.</Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  textContainer: {
    alignItems: 'center',
    marginTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13,
    color: colors.textMedium,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
});

export default BrandLogo;
