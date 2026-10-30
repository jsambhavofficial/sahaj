import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Path, Circle, G } from 'react-native-svg';

interface Props {
  position?: 'top-right' | 'top-left' | 'bottom-left' | 'bottom-right';
  variant?: 'mint' | 'lavender';
  style?: ViewStyle;
}

export const BotanicalDecor: React.FC<Props> = ({
  position = 'top-right',
  variant = 'mint',
  style,
}) => {
  const isLavender = variant === 'lavender';
  const leafColor1 = isLavender ? '#D8B4F8' : '#A7E8BD';
  const leafColor2 = isLavender ? '#C084FC' : '#52B788';
  const leafColor3 = isLavender ? '#EDE9FE' : '#D8F3E5';
  const flowerColor = isLavender ? '#F472B6' : '#FFB5A7';

  let containerStyle: ViewStyle = { position: 'absolute', zIndex: 0 };
  let transform: any = [];

  if (position === 'top-right') {
    containerStyle = { ...containerStyle, top: -10, right: -10 };
  } else if (position === 'top-left') {
    containerStyle = { ...containerStyle, top: -10, left: -10 };
    transform.push({ scaleX: -1 });
  } else if (position === 'bottom-left') {
    containerStyle = { ...containerStyle, bottom: -10, left: -10 };
    transform.push({ scaleY: -1 });
  } else {
    containerStyle = { ...containerStyle, bottom: -10, right: -10 };
    transform.push({ scale: -1 });
  }

  return (
    <View pointerEvents="none" style={[containerStyle, { transform }, style]}>
      <Svg width="120" height="120" viewBox="0 0 120 120" fill="none">
        {/* Soft decorative background leaf */}
        <Path
          d="M120 0C90 10 60 40 70 80C80 120 110 110 120 120"
          stroke={leafColor3}
          strokeWidth="3"
          strokeDasharray="4 4"
        />
        {/* Main curved leaf branch */}
        <Path
          d="M115 5C85 25 65 60 75 105"
          stroke={leafColor2}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        {/* Leaf 1 */}
        <Path
          d="M95 20C82 15 72 24 74 36C87 38 98 32 95 20Z"
          fill={leafColor1}
          opacity="0.8"
        />
        {/* Leaf 2 */}
        <Path
          d="M78 45C66 42 58 52 61 62C72 64 81 56 78 45Z"
          fill={leafColor2}
          opacity="0.75"
        />
        {/* Leaf 3 */}
        <Path
          d="M92 52C102 46 112 50 114 62C103 66 93 60 92 52Z"
          fill={leafColor3}
          opacity="0.9"
        />
        {/* Leaf 4 */}
        <Path
          d="M72 75C60 76 56 88 62 96C72 95 78 86 72 75Z"
          fill={leafColor1}
          opacity="0.7"
        />
        {/* Small delicate flower */}
        <G opacity="0.85">
          <Circle cx="88" cy="88" r="4.5" fill={flowerColor} />
          <Circle cx="84" cy="85" r="3.5" fill="#FED7AA" />
          <Circle cx="92" cy="85" r="3.5" fill="#FED7AA" />
          <Circle cx="88" cy="93" r="3.5" fill="#FED7AA" />
        </G>
        {/* Dew dots */}
        <Circle cx="104" cy="38" r="2.5" fill={leafColor2} opacity="0.6" />
        <Circle cx="64" cy="70" r="2" fill={leafColor1} opacity="0.5" />
      </Svg>
    </View>
  );
};

export default BotanicalDecor;
