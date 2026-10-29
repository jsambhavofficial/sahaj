import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Rect, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';

export const RobotAvatar = ({ size = 90 }: { size?: number }) => {
  return (
    <View style={styles.container}>
      <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
        <Defs>
          <LinearGradient id="botGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#38BDF8" />
            <Stop offset="100%" stopColor="#0284C7" />
          </LinearGradient>
          <LinearGradient id="faceGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0F172A" />
            <Stop offset="100%" stopColor="#1E293B" />
          </LinearGradient>
          <LinearGradient id="haloGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#E0F2FE" />
            <Stop offset="100%" stopColor="#BAE6FD" />
          </LinearGradient>
        </Defs>

        {/* Outer soft aura */}
        <Circle cx="50" cy="50" r="46" fill="url(#haloGrad)" opacity="0.6" />

        {/* Little antenna */}
        <Path d="M50 26 L50 14" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
        <Circle cx="50" cy="12" r="5" fill="#38BDF8" />
        <Circle cx="50" cy="12" r="2.5" fill="#FFFFFF" />

        {/* Robot head casing */}
        <Rect x="22" y="24" width="56" height="48" rx="20" fill="url(#botGrad)" />

        {/* Cute side ear muffs */}
        <Rect x="16" y="38" width="8" height="18" rx="4" fill="#0369A1" />
        <Rect x="76" y="38" width="8" height="18" rx="4" fill="#0369A1" />

        {/* Dark Screen Face */}
        <Rect x="28" y="30" width="44" height="34" rx="14" fill="url(#faceGrad)" />

        {/* Cute cyan glowing eyes */}
        <G>
          {/* Left eye */}
          <Circle cx="40" cy="45" r="5" fill="#38BDF8" />
          <Circle cx="38.5" cy="43.5" r="1.8" fill="#FFFFFF" />
          {/* Right eye */}
          <Circle cx="60" cy="45" r="5" fill="#38BDF8" />
          <Circle cx="58.5" cy="43.5" r="1.8" fill="#FFFFFF" />
        </G>

        {/* Friendly smile */}
        <Path
          d="M44 54 Q 50 59 56 54"
          stroke="#38BDF8"
          strokeWidth="2.5"
          strokeLinecap="round"
        />

        {/* Cheerful blush cheeks */}
        <Circle cx="35" cy="53" r="2.5" fill="#FB7185" opacity="0.8" />
        <Circle cx="65" cy="53" r="2.5" fill="#FB7185" opacity="0.8" />
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default RobotAvatar;
