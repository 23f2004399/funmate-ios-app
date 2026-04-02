import React from 'react';
import { Text, StyleSheet } from 'react-native';

interface HeartArrowLogoProps {
  size?: number;
  color?: string;
}

/**
 * ⚠️ PLACEHOLDER LOGO - Replace with actual heart-arrow SVG/vector design
 * Search for: "PLACEHOLDER_LOGO_EMOJI" to find and replace when real logo is ready
 */
const HeartArrowLogo = ({ size = 120 }: HeartArrowLogoProps) => {
  return (
    <Text style={[styles.emoji, { fontSize: size }]}>
      💘 {/* PLACEHOLDER_LOGO_EMOJI */}
    </Text>
  );
};

const styles = StyleSheet.create({
  emoji: {
    textAlign: 'center',
  },
});

export default HeartArrowLogo;
