/**
 * Match Radius Screen  (Option C – Ruler Scroll)
 *
 * Third step of the deferred dating-preferences flow.
 * Data is NOT written to DB here – passed via nav params to AboutMeScreen.
 *
 * UI: A horizontal snap-scroll ruler with tick marks.
 * Values: 1 km … 100 km (one stop per km).
 * Default: 25 km.
 *
 * Skip → AboutMe with matchRadiusKm: 25 (default)
 * Continue → AboutMe with selected radius
 */

import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ImageBackground,
  Image,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

type RelationshipIntent = 'casual' | 'long_term' | 'hookups' | 'friendship' | 'unsure';
type Gender = 'male' | 'female' | 'trans' | 'non_binary';

// ── Ruler constants ────────────────────────────────────────────────────────────
const RADIUS_STEPS = Array.from({ length: 100 }, (_, i) => i + 1); // 1 … 100
const DEFAULT_RADIUS = 25;
const DEFAULT_INDEX = DEFAULT_RADIUS - 1; // 24  (0-based index of 25)

const TICK_WIDTH = 30;  // px per step — narrower to keep 100 ticks manageable
const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Horizontal padding so the first/last item can be centred under the needle
const RULER_SIDE_PAD = (SCREEN_WIDTH - TICK_WIDTH) / 2;
// Explicit snap offsets — eliminates floating-point drift from snapToInterval
const SNAP_OFFSETS = RADIUS_STEPS.map((_, i) => i * TICK_WIDTH);

// ──────────────────────────────────────────────────────────────────────────────

interface MatchRadiusScreenProps {
  navigation?: any;
  route?: {
    params?: {
      relationshipIntent?: RelationshipIntent | null;
      interestedIn?: Gender[];
    };
  };
}

const MatchRadiusScreen: React.FC<MatchRadiusScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const relationshipIntent = route?.params?.relationshipIntent ?? null;
  const interestedIn = route?.params?.interestedIn ?? [];

  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_INDEX);
  const scrollRef = useRef<ScrollView>(null);

  // Scroll to the default position after the layout is ready
  useEffect(() => {
    const timer = setTimeout(() => {
      scrollRef.current?.scrollTo({
        x: DEFAULT_INDEX * TICK_WIDTH,
        animated: false,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const buildParams = (radius: number) => ({
    relationshipIntent,
    interestedIn,
    matchRadiusKm: radius,
  });

  const handleSkip = () => {
    navigation.navigate('AboutMe' as never, buildParams(DEFAULT_RADIUS) as never);
  };

  const handleContinue = () => {
    navigation.navigate('AboutMe' as never, buildParams(RADIUS_STEPS[selectedIndex]) as never);
  };

  const handleScrollEnd = (e: any) => {
    const offset = e.nativeEvent.contentOffset.x;
    const index = Math.round(offset / TICK_WIDTH);
    const clamped = Math.max(0, Math.min(index, RADIUS_STEPS.length - 1));
    setSelectedIndex(clamped);
  };

  /** Tap a tick to jump to it */
  const scrollToIndex = (index: number) => {
    scrollRef.current?.scrollTo({ x: index * TICK_WIDTH, animated: true });
    setSelectedIndex(index);
  };

  const selectedKm = RADIUS_STEPS[selectedIndex];

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.bg}
      resizeMode="cover"
      blurRadius={3}
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

        {/* ── Header ────────────────────────────────── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Funmate</Text>
          </View>

          <TouchableOpacity style={styles.skipBtn} onPress={handleSkip} activeOpacity={0.7}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── Body ──────────────────────────────────── */}
        <View style={styles.body}>
          <Text style={styles.title}>Match Radius</Text>
          <Text style={styles.subtitle}>How far should we look for your matches?</Text>

          {/* Location pin pulse */}
          <View style={styles.pinContainer}>
            <View style={styles.ring3} />
            <View style={styles.ring2} />
            <View style={styles.ring1} />
            <View style={styles.pinCore}>
              <Ionicons name="location" size={28} color="#FFFFFF" />
            </View>
          </View>

          {/* Value display */}
          <View style={styles.valueCard}>
            <Text style={styles.valueBig}>{selectedKm}</Text>
            <Text style={styles.valueUnit}>km</Text>
          </View>
          <Text style={styles.valueHint}>away from you</Text>

          {/* ── Ruler ─────────────────────────────── */}
          <View style={styles.rulerWrapper}>
            {/* Fixed centre needle */}
            <View style={styles.needleContainer} pointerEvents="none">
              <View style={styles.needle} />
              {/* Downward triangle */}
              <View style={styles.triangle} />
            </View>

            {/* Left gradient fade */}
            <LinearGradient
              colors={['rgba(13,11,30,0.96)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientLeft}
              pointerEvents="none"
            />

            {/* Scroll ruler */}
            <ScrollView
              ref={scrollRef}
              horizontal
              snapToOffsets={SNAP_OFFSETS}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: RULER_SIDE_PAD }}
              onMomentumScrollEnd={handleScrollEnd}
              scrollEventThrottle={16}
              style={styles.ruler}
            >
              {RADIUS_STEPS.map((value, index) => {
                const isActive = index === selectedIndex;
                const isMajor = value % 10 === 0;          // 10, 20, … 100 — tall + label
                const isSemi  = !isMajor && value % 5 === 0; // 5, 15, … — medium
                return (
                  <TouchableOpacity
                    key={value}
                    onPress={() => scrollToIndex(index)}
                    activeOpacity={0.7}
                    style={styles.tickItem}
                  >
                    {/* Tick line */}
                    <View
                      style={[
                        styles.tickLine,
                        isMajor ? styles.tickLineMajor : isSemi ? styles.tickLineSemi : styles.tickLineMinor,
                        isActive && styles.tickLineActive,
                      ]}
                    />
                    {/* Label: shown on every 10-km mark + selected */}
                    {(isMajor || isActive) && (
                      <Text style={[styles.tickLabel, isActive && styles.tickLabelActive]}>
                        {value}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Right gradient fade */}
            <LinearGradient
              colors={['transparent', 'rgba(13,11,30,0.96)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientRight}
              pointerEvents="none"
            />
          </View>

          {/* Range labels */}
          <View style={styles.rangeRow}>
            <Text style={styles.rangeLabel}>◀ Closer</Text>
            <Text style={styles.rangeLabel}>Further ▶</Text>
          </View>
        </View>

        {/* ── Continue button ───────────────────────── */}
        <View style={[styles.footer, { paddingBottom: Math.max(32, insets.bottom + 16) }]}>
          <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
            <LinearGradient
              colors={['#8B2BE2', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.continueBtn}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13,11,30,0.72)',
  },

  /* Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  logo: { width: 30, height: 30 },
  appName: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  skipBtn: {
    width: 40,
    alignItems: 'flex-end',
    paddingVertical: 6,
  },
  skipText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#A855F7',
  },

  /* Body */
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 32,
  },

  /* Concentric rings (location pulse) */
  pinContainer: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  ring3: {
    position: 'absolute',
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.15)',
  },
  ring2: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.30)',
  },
  ring1: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.50)',
  },
  pinCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#8B2BE2',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 16,
    elevation: 12,
  },

  /* Value display */
  valueCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    marginBottom: 4,
  },
  valueBig: {
    fontSize: 64,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    lineHeight: 70,
  },
  valueUnit: {
    fontSize: 24,
    fontFamily: 'Inter-SemiBold',
    color: '#A855F7',
    marginBottom: 10,
  },
  valueHint: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 32,
  },

  /* Ruler */
  rulerWrapper: {
    width: SCREEN_WIDTH,
    height: 80,
    position: 'relative',
    justifyContent: 'center',
  },

  ruler: {
    height: 80,
  },

  tickItem: {
    width: TICK_WIDTH,
    height: 80,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 14,
    gap: 6,
  },

  tickLine: {
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  tickLineMinor: {
    height: 12,
  },
  tickLineSemi: {
    height: 20,
    width: 1.5,
    backgroundColor: 'rgba(255,255,255,0.30)',
  },
  tickLineMajor: {
    height: 26,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
  tickLineActive: {
    backgroundColor: '#A855F7',
    width: 3,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 6,
  },

  tickLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.35)',
    textAlign: 'center',
  },
  tickLabelActive: {
    color: '#A855F7',
    fontFamily: 'Inter-SemiBold',
    fontSize: 12,
  },

  /* Fixed needle overlay */
  needleContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
    pointerEvents: 'none' as any,
  },
  needle: {
    width: 2,
    height: 40,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
    elevation: 8,
  },
  triangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#A855F7',
  },

  /* Edge gradient fades */
  gradientLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 5,
  },
  gradientRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    zIndex: 5,
  },

  /* Range hints */
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: SCREEN_WIDTH - 40,
    marginTop: 10,
  },
  rangeLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#475569',
  },

  /* Footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  continueBtn: {
    height: 54,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  continueBtnText: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

export default MatchRadiusScreen;
