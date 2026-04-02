/**
 * Interested In Screen
 *
 * Second step of the deferred dating-preferences flow.
 * Data is NOT written to DB here – passed via nav params to AboutMeScreen.
 *
 * Skip → MatchRadius with interestedIn: []
 * Continue → MatchRadius with selected gender preferences
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';

type Gender = 'male' | 'female' | 'trans' | 'non_binary';
type RelationshipIntent = 'casual' | 'long_term' | 'hookups' | 'friendship' | 'unsure';

const GENDER_OPTIONS: {
  value: Gender;
  label: string;
  icon: string;
  description: string;
  accentColor: string;
}[] = [
  {
    value: 'male',
    label: 'Men',
    icon: 'male',
    description: 'Interested in men',
    accentColor: '#3B82F6',
  },
  {
    value: 'female',
    label: 'Women',
    icon: 'female',
    description: 'Interested in women',
    accentColor: '#EC4899',
  },
  {
    value: 'trans',
    label: 'Trans',
    icon: 'transgender',
    description: 'Interested in trans people',
    accentColor: '#10B981',
  },
  {
    value: 'non_binary',
    label: 'Non-binary',
    icon: 'male-female',
    description: 'Interested in non-binary',
    accentColor: '#A855F7',
  },
];

interface InterestedInScreenProps {
  navigation?: any;
  route?: {
    params?: {
      relationshipIntent?: RelationshipIntent | null;
    };
  };
}

const InterestedInScreen: React.FC<InterestedInScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const relationshipIntent = route?.params?.relationshipIntent ?? null;
  const [selected, setSelected] = useState<Gender[]>([]);

  const toggleGender = (g: Gender) => {
    setSelected((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const buildParams = (interestedIn: Gender[]) => ({
    relationshipIntent,
    interestedIn,
  });

  const handleSkip = () => {
    navigation.navigate('MatchRadius' as never, buildParams([]) as never);
  };

  const handleContinue = () => {
    navigation.navigate('MatchRadius' as never, buildParams(selected) as never);
  };

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

          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── Content ───────────────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Who Are You{'\n'}Interested In?</Text>
          <Text style={styles.subtitle}>Select all that apply</Text>

          <View style={styles.grid}>
            {GENDER_OPTIONS.map((option) => {
              const isActive = selected.includes(option.value);
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.card,
                    isActive && styles.cardActive,
                    isActive && { shadowColor: option.accentColor },
                  ]}
                  onPress={() => toggleGender(option.value)}
                  activeOpacity={0.8}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      {
                        backgroundColor: isActive
                          ? option.accentColor + '33'
                          : 'rgba(255,255,255,0.06)',
                      },
                    ]}
                  >
                    <Ionicons
                      name={option.icon as any}
                      size={40}
                      color={isActive ? option.accentColor : '#94A3B8'}
                    />
                  </View>

                  <Text style={[styles.cardLabel, isActive && { color: '#FFFFFF' }]}>
                    {option.label}
                  </Text>
                  <Text style={[styles.cardDesc, isActive && { color: '#CBD5E1' }]}>
                    {option.description}
                  </Text>

                  {isActive && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark-circle" size={18} color={option.accentColor} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

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

  /* Scroll */
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    lineHeight: 40,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    marginBottom: 28,
  },

  /* 2×2 grid */
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    backgroundColor: 'rgba(22,28,48,0.85)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 18,
    alignItems: 'center',
    gap: 10,
    minHeight: 175,
    position: 'relative',
  },
  cardActive: {
    borderColor: '#A855F7',
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 14,
    elevation: 62,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardLabel: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#94A3B8',
    textAlign: 'center',
  },
  cardDesc: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    textAlign: 'center',
  },

  checkBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
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

export default InterestedInScreen;
