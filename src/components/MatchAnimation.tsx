/**
 * MATCH ANIMATION - "RADIANT PULSE"
 * 
 * Animated overlay that appears when two users mutually match.
 * 
 * Animation Phases:
 * 1. The Merge: Two avatars slide in from edges and meet in center
 * 2. The Pulse: Avatars replaced with heart that pulses
 * 3. The Radiant Ripple: Concentric circles expand outward
 * 4. UI Overlay: "It's a Match!" with action buttons
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  TouchableOpacity,
  Image,
  Modal,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width, height } = Dimensions.get('window');
const AVATAR_SIZE = 120;
const HEART_SIZE = 140;
const CENTER_X = width / 2;
const CENTER_Y = height / 2;

interface MatchAnimationProps {
  visible: boolean;
  currentUserPhoto?: string;
  matchedUserPhoto?: string;
  matchedUserName?: string;
  onSendMessage: () => void;
  onKeepSwiping: () => void;
}

const MatchAnimation: React.FC<MatchAnimationProps> = ({
  visible,
  currentUserPhoto,
  matchedUserPhoto,
  matchedUserName = 'Someone',
  onSendMessage,
  onKeepSwiping,
}) => {
  const insets = useSafeAreaInsets();
  // Animation values
  const leftAvatarX = useRef(new Animated.Value(-200)).current;
  const rightAvatarX = useRef(new Animated.Value(width + 200)).current;
  const avatarOpacity = useRef(new Animated.Value(1)).current;
  const heartOpacity = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(0.5)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const contentY = useRef(new Animated.Value(50)).current;

  // Ripple animation values (3 concentric circles)
  const ripple1Scale = useRef(new Animated.Value(0)).current;
  const ripple1Opacity = useRef(new Animated.Value(0.8)).current;
  const ripple2Scale = useRef(new Animated.Value(0)).current;
  const ripple2Opacity = useRef(new Animated.Value(0.8)).current;
  const ripple3Scale = useRef(new Animated.Value(0)).current;
  const ripple3Opacity = useRef(new Animated.Value(0.8)).current;

  const [showUI, setShowUI] = useState(false);

  useEffect(() => {
    if (visible) {
      startAnimation();
    } else {
      resetAnimation();
    }
  }, [visible]);

  const startAnimation = () => {
    setShowUI(false);

    // Reset all values
    leftAvatarX.setValue(-200);
    rightAvatarX.setValue(width + 200);
    avatarOpacity.setValue(1);
    heartOpacity.setValue(0);
    heartScale.setValue(0.5);
    overlayOpacity.setValue(0);
    contentY.setValue(50);
    ripple1Scale.setValue(0);
    ripple1Opacity.setValue(0.8);
    ripple2Scale.setValue(0);
    ripple2Opacity.setValue(0.8);
    ripple3Scale.setValue(0);
    ripple3Opacity.setValue(0.8);

    // Start the sequence
    Animated.sequence([
      // Phase 1: Fade in overlay
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),

      // Phase 1: The Merge - Avatars slide in
      Animated.parallel([
        Animated.spring(leftAvatarX, {
          toValue: CENTER_X - AVATAR_SIZE - 20,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.spring(rightAvatarX, {
          toValue: CENTER_X + 20,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]),

      // Phase 2: The Pulse - Avatars fade out, heart fades in
      Animated.parallel([
        Animated.timing(avatarOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(heartOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(heartScale, {
          toValue: 1,
          tension: 40,
          friction: 5,
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      // Phase 3: The Radiant Ripple + Continuous heart pulse
      startRippleAnimation();
      startHeartPulse();
      showUIElements();
    });
  };

  const startHeartPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(heartScale, {
          toValue: 1.2,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heartScale, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const startRippleAnimation = () => {
    // Stagger the ripples
    const createRipple = (
      scaleValue: Animated.Value,
      opacityValue: Animated.Value,
      delay: number
    ) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scaleValue, {
              toValue: 3,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
            Animated.timing(opacityValue, {
              toValue: 0,
              duration: 2000,
              easing: Easing.out(Easing.ease),
              useNativeDriver: true,
            }),
          ]),
          // Reset for loop
          Animated.parallel([
            Animated.timing(scaleValue, {
              toValue: 0,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacityValue, {
              toValue: 0.8,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    };

    // Start all three ripples with staggered delays
    createRipple(ripple1Scale, ripple1Opacity, 0).start();
    createRipple(ripple2Scale, ripple2Opacity, 400).start();
    createRipple(ripple3Scale, ripple3Opacity, 800).start();
  };

  const showUIElements = () => {
    setShowUI(true);
    Animated.spring(contentY, {
      toValue: 0,
      tension: 40,
      friction: 7,
      useNativeDriver: true,
    }).start();
  };

  const resetAnimation = () => {
    setShowUI(false);
    leftAvatarX.setValue(-200);
    rightAvatarX.setValue(width + 200);
    avatarOpacity.setValue(1);
    heartOpacity.setValue(0);
    heartScale.setValue(0.5);
    overlayOpacity.setValue(0);
    contentY.setValue(50);
    ripple1Scale.setValue(0);
    ripple2Scale.setValue(0);
    ripple3Scale.setValue(0);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onKeepSwiping}
    >
      <StatusBar backgroundColor="rgba(0, 0, 0, 0.85)" barStyle="light-content" />
      <Animated.View
        style={[
          styles.container,
          { opacity: overlayOpacity },
        ]}
      >
        {/* Semi-transparent background */}
        <View style={styles.backdrop} />

      {/* Ripple circles */}
      <View style={styles.rippleContainer}>
        <Animated.View
          style={[
            styles.rippleCircle,
            {
              transform: [{ scale: ripple1Scale }],
              opacity: ripple1Opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.rippleCircle,
            {
              transform: [{ scale: ripple2Scale }],
              opacity: ripple2Opacity,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.rippleCircle,
            {
              transform: [{ scale: ripple3Scale }],
              opacity: ripple3Opacity,
            },
          ]}
        />
      </View>

      {/* Left avatar (current user) */}
      <Animated.View
        style={[
          styles.avatar,
          {
            left: 0,
            transform: [{ translateX: leftAvatarX }],
            opacity: avatarOpacity,
          },
        ]}
      >
        {currentUserPhoto ? (
          <Image source={{ uri: currentUserPhoto }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={60} color="#CCCCCC" />
          </View>
        )}
      </Animated.View>

      {/* Right avatar (matched user) */}
      <Animated.View
        style={[
          styles.avatar,
          {
            left: 0,
            transform: [{ translateX: rightAvatarX }],
            opacity: avatarOpacity,
          },
        ]}
      >
        {matchedUserPhoto ? (
          <Image source={{ uri: matchedUserPhoto }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={60} color="#CCCCCC" />
          </View>
        )}
      </Animated.View>

      {/* Heart icon */}
      <Animated.View
        style={[
          styles.heartContainer,
          {
            opacity: heartOpacity,
            transform: [{ scale: heartScale }],
          },
        ]}
      >
        <Ionicons name="heart" size={HEART_SIZE} color="#FF4458" />
      </Animated.View>

      {/* UI Overlay */}
      {showUI && (
        <Animated.View
          style={[
            styles.contentContainer,
            {
              transform: [{ translateY: contentY }],
              bottom: 40 + insets.bottom, // Dynamic bottom positioning above navbar
            },
          ]}
        >
          <Text style={styles.title}>It's a Match!</Text>
          <Text style={styles.subtitle}>
            You and {matchedUserName} liked each other
          </Text>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={onSendMessage}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>Send Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={onKeepSwiping}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Keep Swiping</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
    elevation: 9999, // Android needs elevation for proper z-ordering
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
  },
  rippleContainer: {
    position: 'absolute',
    top: CENTER_Y - HEART_SIZE / 2,
    left: CENTER_X - HEART_SIZE / 2,
    width: HEART_SIZE,
    height: HEART_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rippleCircle: {
    position: 'absolute',
    width: HEART_SIZE,
    height: HEART_SIZE,
    borderRadius: HEART_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FF4458',
  },
  avatar: {
    position: 'absolute',
    top: CENTER_Y - AVATAR_SIZE / 2,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    backgroundColor: '#F5F5F5',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  heartContainer: {
    position: 'absolute',
    top: CENTER_Y - HEART_SIZE / 2,
    left: CENTER_X - HEART_SIZE / 2,
    width: HEART_SIZE,
    height: HEART_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentContainer: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 40,
  },
  buttonContainer: {
    width: width - 80,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#FF4458',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#FF4458',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default MatchAnimation;
