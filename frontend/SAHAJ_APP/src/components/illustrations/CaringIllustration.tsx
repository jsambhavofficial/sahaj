import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle, Rect, G, Defs, LinearGradient, Stop } from 'react-native-svg';

export const CaringIllustration = ({ width = 280, height = 210 }: { width?: number; height?: number }) => {
  return (
    <View style={styles.container}>
      <Svg width={width} height={height} viewBox="0 0 280 210" fill="none">
        <Defs>
          <LinearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#E8F8F2" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#D5F1E5" stopOpacity="0.4" />
          </LinearGradient>
          <LinearGradient id="nurseJacket" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#0D5C4E" />
            <Stop offset="100%" stopColor="#083E34" />
          </LinearGradient>
          <LinearGradient id="seniorShawl" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#FBBF24" />
            <Stop offset="100%" stopColor="#D97706" />
          </LinearGradient>
        </Defs>

        {/* Soft background oval backdrop */}
        <Circle cx="140" cy="115" r="95" fill="url(#bgGrad)" />

        {/* Small floating hearts */}
        <Path
          d="M205 60 C 200 50, 188 54, 192 64 C 196 74, 205 80, 205 80 C 205 80, 214 74, 218 64 C 222 54, 210 50, 205 60 Z"
          fill="#34D399"
          opacity="0.8"
        />
        <Path
          d="M75 90 C 72 82, 62 86, 65 94 C 68 102, 75 106, 75 106 C 75 106, 82 102, 85 94 C 88 86, 78 82, 75 90 Z"
          fill="#A7F3D0"
          opacity="0.7"
        />

        {/* CARE COORDINATOR (Left Character) */}
        <G>
          {/* Hair back */}
          <Path
            d="M80 75 C 75 40, 125 40, 120 75 C 120 95, 78 95, 80 75 Z"
            fill="#1E293B"
          />
          {/* Face */}
          <Circle cx="100" cy="72" r="22" fill="#FBD5C0" />
          {/* Hair front & bun */}
          <Path
            d="M80 65 C 85 45, 115 45, 120 65 C 115 60, 95 60, 80 65 Z"
            fill="#0F172A"
          />
          <Circle cx="76" cy="55" r="9" fill="#0F172A" />
          {/* Facial features */}
          <Circle cx="94" cy="71" r="2.2" fill="#1E293B" />
          <Circle cx="108" cy="71" r="2.2" fill="#1E293B" />
          <Path
            d="M97 80 Q 101 84 105 80"
            stroke="#9A3412"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          {/* Coordinator body & coat */}
          <Path
            d="M72 135 C 72 100, 128 100, 128 135 L 135 210 L 65 210 Z"
            fill="url(#nurseJacket)"
          />
          {/* White inner shirt / collar */}
          <Path
            d="M93 94 L 100 115 L 107 94 Z"
            fill="#FFFFFF"
          />
          {/* ID Badge / Stethoscope hint */}
          <Rect x="82" y="115" width="10" height="14" rx="2" fill="#E2E8F0" />
          <Rect x="84" y="118" width="6" height="4" rx="1" fill="#0D5C4E" />

          {/* Coordinator holding Tablet */}
          <Rect x="95" y="140" width="30" height="42" rx="4" fill="#334155" />
          <Rect x="98" y="143" width="24" height="34" rx="2" fill="#E0F2FE" />
          {/* Hand holding tablet */}
          <Circle cx="96" cy="162" r="7" fill="#FBD5C0" />
        </G>

        {/* SENIOR CITIZEN (Right Character - smiling grandmother) */}
        <G>
          {/* Senior Gray Hair */}
          <Circle cx="175" cy="85" r="25" fill="#E2E8F0" />
          <Path
            d="M152 82 C 155 60, 195 60, 198 82 C 190 75, 160 75, 152 82 Z"
            fill="#CBD5E1"
          />
          {/* Hair Bun */}
          <Circle cx="198" cy="74" r="10" fill="#CBD5E1" />
          {/* Face */}
          <Circle cx="173" cy="88" r="20" fill="#FEE2E2" />
          {/* Kind eyes (smiling curved arcs) */}
          <Path
            d="M165 87 Q 168 84 171 87"
            stroke="#475569"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <Path
            d="M178 87 Q 181 84 184 87"
            stroke="#475569"
            strokeWidth="2"
            strokeLinecap="round"
          />
          {/* Gentle smile */}
          <Path
            d="M171 96 Q 175 101 179 96"
            stroke="#E11D48"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Cheerful blush */}
          <Circle cx="163" cy="94" r="3.5" fill="#FDA4AF" opacity="0.6" />
          <Circle cx="185" cy="94" r="3.5" fill="#FDA4AF" opacity="0.6" />
          {/* Glasses */}
          <Circle cx="168" cy="86" r="6" stroke="#94A3B8" strokeWidth="1.2" fill="none" />
          <Circle cx="181" cy="86" r="6" stroke="#94A3B8" strokeWidth="1.2" fill="none" />
          <Path d="M174 86 L 175 86" stroke="#94A3B8" strokeWidth="1.5" />

          {/* Warm Mustard Shawl / Sweater */}
          <Path
            d="M145 135 C 145 108, 205 108, 205 135 L 215 210 L 138 210 Z"
            fill="url(#seniorShawl)"
          />
          {/* Hand gently resting forward */}
          <Circle cx="140" cy="155" r="7.5" fill="#FEE2E2" />
        </G>
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

export default CaringIllustration;
