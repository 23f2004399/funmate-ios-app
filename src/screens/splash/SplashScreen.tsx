import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Animated,
  Easing,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  // Animation values
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textSlide = useRef(new Animated.Value(30)).current;
  const glowScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    // Animation sequence: Text first, then heart grows once and beats
    Animated.sequence([
      // Step 1: Text fade-in and slide-up (no heart yet)
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(textSlide, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      
      // Step 2: Heart grows from nothing ONCE
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 5,
          tension: 50,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(logoRotate, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      
      // Small delay before beating
      Animated.delay(200),
      
      // Step 3: Heart beats (grow-shrink) twice
      Animated.sequence([
        // First beat
        Animated.timing(logoScale, {
          toValue: 1.15,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        // Second beat
        Animated.timing(logoScale, {
          toValue: 1.15,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1,
          duration: 250,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    // Continuous wave animation for glow (slow, subtle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.2,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Navigate after 3 seconds
    const timer = setTimeout(() => {
      onFinish();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onFinish, logoScale, logoRotate, logoOpacity, textOpacity, textSlide, glowScale]);

  // Rotation interpolation
  const rotateInterpolation = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-10deg', '0deg'],
  });

  return (
    <LinearGradient
      colors={['#0E1621', '#16283D']}
      style={styles.container}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* Glow effect behind logo */}
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: logoOpacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.2],
            }),
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Animated Logo */}
      <Animated.Image
        source={require('../../assets/logo.png')}
        style={[
          styles.logo,
          {
            opacity: logoOpacity,
            transform: [
              { scale: logoScale },
              { rotate: rotateInterpolation },
            ],
          },
        ]}
        resizeMode="contain"
      />

      {/* Animated Text */}
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textOpacity,
            transform: [{ translateY: textSlide }],
          },
        ]}
      >
        <Text style={styles.appName}>Funmate</Text>
        <Text style={styles.tagline}>Find Fun. Find Friends. Find Love.</Text>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#378BBB',
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 40,
    zIndex: 1,
  },
  textContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  appName: {
    fontSize: 56,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: 2,
    fontFamily: 'Inter-Bold',
  },
  tagline: {
    fontSize: 18,
    color: '#B8C7D9',
    marginTop: 16,
    fontWeight: '400',
    fontFamily: 'Inter-Regular',
  },
});

export default SplashScreen;
