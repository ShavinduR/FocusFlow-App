import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTheme } from '../theme/useTheme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

interface Props {
  progress: number; // 0–1
  size?: number;
  stroke?: number;
  color: string;
  label?: string;
  sublabel?: string;
}

export function ProgressRing({ progress, size = 120, stroke = 12, color, label, sublabel }: Props) {
  const { colors, fonts } = useTheme();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const value = useSharedValue(0);

  useEffect(() => {
    value.value = withTiming(Math.max(0, Math.min(1, progress)), { duration: 900, easing: Easing.out(Easing.cubic) });
  }, [progress, value]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: circumference * (1 - value.value) }));

  return (
    <View style={{ width: size, height: size }} accessibilityLabel={`${label ?? ''} ${Math.round(progress * 100)} percent`}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceAlt} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${circumference} ${circumference}`} animatedProps={animatedProps}
        />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {label && <Text style={{ color: colors.text, fontFamily: fonts.semibold, fontSize: size * 0.2 }}>{label}</Text>}
        {sublabel && <Text style={{ color: colors.textMuted, fontFamily: fonts.regular, fontSize: Math.max(10, size * 0.09) }}>{sublabel}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
