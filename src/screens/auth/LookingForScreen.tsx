/**
 * Looking For Screen
 *
 * First step of the deferred dating-preferences flow.
 * Data is NOT written to DB here – it's passed via navigation params
 * to the final AboutMeScreen where everything is saved together.
 *
 * Special behaviours:
 *  - Logout button (top-left): signs out → Login screen
 *  - Skip button (top-right): saves empty defaults NOW → MainTabs
 *    (so people who skip completely are not stuck in onboarding)
 *  - Continue: navigates to InterestedIn with selected intent
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
import auth from '@react-native-firebase/auth';

type RelationshipIntent = 'casual' | 'long_term' | 'hookups' | 'friendship' | 'unsure';

const RELATIONSHIP_OPTIONS: {
  value: RelationshipIntent;
  label: string;
  icon: string;
  description: string;
  accentColor: string;
}[] = [
  {
    value: 'long_term',
    label: 'Long-term',
    icon: 'heart',
    description: 'Serious relationship',
    accentColor: '#FF4D6D',
  },
  {
    value: 'casual',
    label: 'Casual',
    icon: 'cafe',
    description: 'Relaxed & fun',
    accentColor: '#F59E0B',
  },
  {
    value: 'friendship',
    label: 'Friendship',
    icon: 'people',
    description: 'Making new friends',
    accentColor: '#06B6D4',
  },
  {
    value: 'hookups',
    label: 'Hookups',
    icon: 'flame',
    description: 'Keeping it casual',
    accentColor: '#F97316',
  },
  {
    value: 'unsure',
    label: 'Unsure',
    icon: 'help-circle',
    description: 'Still figuring it out',
    accentColor: '#A855F7',
  },
];

interface LookingForScreenProps {
  navigation: any;
}

const LookingForScreen: React.FC<LookingForScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selected, setSelected] = useState<RelationshipIntent | null>(null);

  /** Sign out and return to Login */
  const handleLogout = async () => {
    try {
      await auth().signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' as never }] });
    } catch (error) {
      console.warn('Logout error:', error);
    }
  };

  /** Skip – move to the next screen without saving anything here */
  const handleSkip = () => {
    navigation.navigate('InterestedIn' as never);
  };

  /** Move forward – pass selection as nav param, no DB write */
  const handleContinue = () => {
    navigation.navigate('InterestedIn' as never, {
      relationshipIntent: selected,
    } as never);
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
          {/* Back (left) — back arrow when flowing normally, Logout when re-entering after app close */}
          {navigation.canGoBack() ? (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.logoutBtn}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={26} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Logo (center) */}
          <View style={styles.headerCenter}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
            <Text style={styles.appName}>Funmate</Text>
          </View>

          {/* Skip (right) */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── Scrollable content ────────────────────── */}
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>What Are You Looking For?</Text>
          <Text style={styles.subtitle}>No pressure — you can always change this later</Text>

          <View style={styles.list}>
            {RELATIONSHIP_OPTIONS.map((option) => {
              const isActive = selected === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.card,
                    isActive && styles.cardActive,
                    isActive && { shadowColor: option.accentColor },
                  ]}
                  onPress={() => setSelected(isActive ? null : option.value)}
                  activeOpacity={0.8}
                >
                  {/* Icon circle */}
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
                      size={26}
                      color={isActive ? option.accentColor : 'rgba(255,255,255,0.40)'}
                    />
                  </View>

                  {/* Label + description */}
                  <View style={styles.cardText}>
                    <Text style={[styles.cardLabel, isActive && { color: '#FFFFFF' }]}>
                      {option.label}
                    </Text>
                    <Text style={[styles.cardDesc, isActive && { color: 'rgba(255,255,255,0.60)' }]}>
                      {option.description}
                    </Text>
                  </View>

                  {/* Selection checkmark */}
                  {isActive && (
                    <View style={styles.checkDot}>
                      <Ionicons name="checkmark" size={14} color="#FFFFFF" />
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
    paddingBottom: 28,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoutBtn: {
    width: 42,
    height: 42,
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
    width: 80,
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

  /* Cards list */
  list: {
    gap: 14,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(30,28,45,0.88)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  cardActive: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: 'rgba(139,92,246,0.90)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 65,
  },

  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardText: {
    flex: 1,
  },
  cardLabel: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255,255,255,0.60)',
    marginBottom: 2,
  },
  cardDesc: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.35)',
  },

  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B2BE2',
    alignItems: 'center',
    justifyContent: 'center',
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

export default LookingForScreen;
