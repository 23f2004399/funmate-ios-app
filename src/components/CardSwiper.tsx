/**
 * CUSTOM CARD SWIPER COMPONENT
 * 
 * Simple, reliable card swiper using PanResponder
 * Built specifically for Funmate to avoid third-party library issues
 * 
 * IMPORTANT: Parent component should filter out swiped cards from the data array.
 * This component always shows data[0] as the top card.
 */

import React, { useRef, useMemo, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Animated,
  PanResponder,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

const { width } = Dimensions.get('window');
const SWIPE_THRESHOLD = width * 0.25;
const SWIPE_OUT_DURATION = 300; // Slightly slower for smoother feel

interface CardSwiperProps {
  data: any[];
  renderCard: (item: any, index: number, swipeProgress?: { direction: 'left' | 'right' | 'none', progress: number }) => React.ReactElement | null;
  onSwipeRight?: (index: number) => void;
  onSwipeLeft?: (index: number) => void;
  onSwipedAll?: () => void;
  cardStyle?: any;
  stackSize?: number;
}

export const CardSwiper: React.FC<CardSwiperProps> = ({
  data,
  renderCard,
  onSwipeRight,
  onSwipeLeft,
  onSwipedAll,
  cardStyle,
  stackSize = 3,
}) => {
  // Use refs to avoid stale closures in PanResponder
  const position = useRef(new Animated.ValueXY()).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const isSwipingRef = useRef(false);
  const callbacksRef = useRef({ onSwipeRight, onSwipeLeft, onSwipedAll });
  const dataRef = useRef(data);
  const currentCardIdRef = useRef(data[0]?.id); // Track current top card
  const swipeProgressValue = useRef({ direction: 'none' as 'left' | 'right' | 'none', progress: 0 });
  const forceUpdateRef = useRef(0);
  const [, setForceUpdate] = React.useState(0);

  // Keep refs updated on every render
  callbacksRef.current = { onSwipeRight, onSwipeLeft, onSwipedAll };
  dataRef.current = data;

  /**
   * KEY FIX: Reset position/opacity when the TOP CARD CHANGES
   * This ensures we only reset AFTER React has re-rendered with new data
   */
  useEffect(() => {
    const newCardId = data[0]?.id;
    
    // Only reset if the card actually changed (not on initial render)
    if (newCardId !== currentCardIdRef.current) {
      // New card is now on top - reset position immediately
      position.setValue({ x: 0, y: 0 });
      opacity.setValue(1);
      isSwipingRef.current = false;
      currentCardIdRef.current = newCardId;
      // Reset swipe progress so new card starts with blue border
      swipeProgressValue.current = { direction: 'none', progress: 0 };
      setForceUpdate(prev => prev + 1);
    }
  }, [data, position, opacity]);

  const resetPosition = () => {
    Animated.spring(position, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: true,
    }).start();
  };

  const handleSwipeComplete = (direction: 'right' | 'left') => {
    const { onSwipeRight, onSwipeLeft, onSwipedAll } = callbacksRef.current;
    const currentData = dataRef.current;

    // Check if this was the last card BEFORE calling callbacks
    const wasLastCard = currentData.length <= 1;

    // Call parent callbacks to update state
    // The useEffect watching data[0]?.id will handle resetting position
    if (direction === 'right' && onSwipeRight) {
      onSwipeRight(0);
    } else if (direction === 'left' && onSwipeLeft) {
      onSwipeLeft(0);
    }

    // Call onSwipedAll if this was the last card
    if (wasLastCard && onSwipedAll) {
      onSwipedAll();
    }

    // DON'T reset position here - let useEffect handle it when data changes
    // This prevents the flash because we wait for React to re-render first
  };

  const forceSwipe = (direction: 'right' | 'left') => {
    if (isSwipingRef.current) return;
    isSwipingRef.current = true;
    
    // Reset swipe progress immediately when swipe completes
    swipeProgressValue.current = { direction: 'none', progress: 0 };

    const x = direction === 'right' ? width + 100 : -width - 100;
    
    // Animate position off-screen while fading out
    // Card fades completely before swipe finishes for cleaner exit
    Animated.parallel([
      Animated.timing(position, {
        toValue: { x, y: 0 },
        duration: SWIPE_OUT_DURATION,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: SWIPE_OUT_DURATION * 0.5, // Fade out in first half
        useNativeDriver: true,
      }),
    ]).start(() => handleSwipeComplete(direction));
  };

  // Create PanResponder once, use refs for current values
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !isSwipingRef.current,
        onPanResponderMove: (_, gesture) => {
          if (!isSwipingRef.current) {
            position.setValue({ x: gesture.dx, y: gesture.dy });
            
            // Calculate swipe progress for border animation
            const direction = gesture.dx > 0 ? 'right' : gesture.dx < 0 ? 'left' : 'none';
            const progress = Math.min(Math.abs(gesture.dx) / SWIPE_THRESHOLD, 1);
            swipeProgressValue.current = { direction, progress };
            
            // Force re-render to update border (throttled for performance)
            forceUpdateRef.current++;
            if (forceUpdateRef.current % 2 === 0) {
              setForceUpdate(prev => prev + 1);
            }
          }
        },
        onPanResponderRelease: (_, gesture) => {
          if (isSwipingRef.current) return;

          if (gesture.dx > SWIPE_THRESHOLD) {
            forceSwipe('right');
          } else if (gesture.dx < -SWIPE_THRESHOLD) {
            forceSwipe('left');
          } else {
            resetPosition();
            // Reset swipe progress when card snaps back
            swipeProgressValue.current = { direction: 'none', progress: 0 };
            setForceUpdate(prev => prev + 1);
          }
        },
      }),
    []
  );

  const getCardStyle = () => {
    const rotate = position.x.interpolate({
      inputRange: [-width * 1.5, 0, width * 1.5],
      outputRange: ['-30deg', '0deg', '30deg'],
    });

    return {
      opacity, // Add opacity for smooth fade
      transform: [
        { translateX: position.x },
        { translateY: position.y },
        { rotate },
      ],
    };
  };

  const getLikeOpacity = () => {
    return position.x.interpolate({
      inputRange: [0, SWIPE_THRESHOLD],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
  };

  const getNopeOpacity = () => {
    return position.x.interpolate({
      inputRange: [-SWIPE_THRESHOLD, 0],
      outputRange: [1, 0],
      extrapolate: 'clamp',
    });
  };

  const renderCards = () => {
    if (data.length === 0) {
      return null;
    }

    return data
      .slice(0, stackSize)
      .map((item, i) => {
        if (i === 0) {
          // Top card - draggable
          return (
            <Animated.View
              key={item.id || `card-${i}`}
              style={[styles.card, getCardStyle(), cardStyle]}
              {...panResponder.panHandlers}
            >
              {renderCard(item, i, swipeProgressValue.current)}
            </Animated.View>
          );
        }

        // Stack cards behind
        return (
          <Animated.View
            key={item.id || `card-${i}`}
            style={[
              styles.card,
              {
                transform: [{ scale: 1 - 0.05 * i }],
                opacity: 1 - 0.3 * i,
                zIndex: -i,
              },
              cardStyle,
            ]}
          >
            {renderCard(item, i)}
          </Animated.View>
        );
      })
      .reverse();
  };

  return (
    <View style={styles.container}>
      {renderCards()}

      {/* Like Overlay (Heart - Right Side) */}
      {data.length > 0 && (
        <Animated.View
          style={[
            styles.overlayIcon,
            styles.likeOverlay,
            { opacity: getLikeOpacity() },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="heart" size={100} color="#FF4458" />
        </Animated.View>
      )}

      {/* Nope Overlay (Cross - Left Side) */}
      {data.length > 0 && (
        <Animated.View
          style={[
            styles.overlayIcon,
            styles.nopeOverlay,
            { opacity: getNopeOpacity() },
          ]}
          pointerEvents="none"
        >
          <Ionicons name="close-circle" size={100} color="#8C8C8C" />
        </Animated.View>
      )}
    </View>
  );
};

const CARD_WIDTH = width * 0.9;
const CARD_LEFT_MARGIN = (width - CARD_WIDTH) / 2;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    position: 'absolute',
    width: CARD_WIDTH,
    left: CARD_LEFT_MARGIN,
    top: 40,
  },
  overlayIcon: {
    position: 'absolute',
    top: '35%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  likeOverlay: {
    right: 50,
  },
  nopeOverlay: {
    left: 50,
  },
});

export default CardSwiper;
