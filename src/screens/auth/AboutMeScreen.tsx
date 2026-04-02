/**
 * About Me Screen
 *
 * FINAL step of the dating-preferences flow.
 * This is the ONLY screen in this flow that writes to Firestore.
 *
 * Receives via route.params (all deferred from previous screens):
 *   - relationshipIntent
 *   - interestedIn
 *   - matchRadiusKm
 *
 * Adds its own fields:
 *   - bio, height, occupation, socialHandles
 *
 * On "Complete Profile": saves everything + sets signupStep = 'complete'
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  TextInput,
  Platform,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { SocialHandles } from '../../types/database';

type RelationshipIntent = 'casual' | 'long_term' | 'hookups' | 'friendship' | 'unsure';
type Gender = 'male' | 'female' | 'trans' | 'non_binary';

// Common occupations for autocomplete
const OCCUPATION_SUGGESTIONS = [
  'Software Engineer', 'Doctor', 'Nurse', 'Teacher', 'Professor',
  'Lawyer', 'Accountant', 'Marketing Manager', 'Data Analyst', 'Designer',
  'Product Manager', 'Consultant', 'Entrepreneur', 'Student', 'Researcher',
  'Engineer', 'Architect', 'Photographer', 'Writer', 'Artist',
  'Chef', 'Pilot', 'Flight Attendant', 'HR Manager', 'Sales Manager',
  'Business Analyst', 'Financial Analyst', 'Investment Banker', 'Trader', 'Real Estate Agent',
  'Dentist', 'Pharmacist', 'Physiotherapist', 'Psychologist', 'Veterinarian',
  'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Chemical Engineer',
  'Content Creator', 'Influencer', 'Journalist', 'Editor', 'Filmmaker',
  'Fashion Designer', 'Interior Designer', 'Graphic Designer', 'UX Designer', 'UI Designer',
  'Personal Trainer', 'Yoga Instructor', 'Life Coach', 'Counselor',
  'Police Officer', 'Military', 'Firefighter', 'Government Employee',
  'Banker', 'Insurance Agent', 'Travel Agent', 'Event Planner',
  'CA', 'CS', 'MBA', 'PhD Student', 'Medical Student', 'Law Student',
];

// ──────────────────────────────────────────────────────────────────────────────

interface AboutMeScreenProps {
  navigation?: any;
  route?: {
    params?: {
      relationshipIntent?: RelationshipIntent | null;
      interestedIn?: Gender[];
      matchRadiusKm?: number;
    };
  };
}

const AboutMeScreen: React.FC<AboutMeScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();

  // Deferred data from previous steps (defaults if skipped)
  const relationshipIntent = route?.params?.relationshipIntent ?? null;
  const interestedIn: Gender[] = route?.params?.interestedIn ?? [];
  const matchRadiusKm = route?.params?.matchRadiusKm ?? 25;

  // Own fields
  const [bio, setBio] = useState('');
  const [height, setHeight] = useState<number | null>(null);
  const [occupation, setOccupation] = useState('');
  const [filteredOccupations, setFilteredOccupations] = useState<string[]>([]);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Social handles
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [facebook, setFacebook] = useState('');
  const [twitter, setTwitter] = useState('');

  const [saving, setSaving] = useState(false);

  const handleOccupationChange = (text: string) => {
    setOccupation(text);
    if (text.length >= 2) {
      const filtered = OCCUPATION_SUGGESTIONS.filter((occ) =>
        occ.toLowerCase().includes(text.toLowerCase()),
      ).slice(0, 5);
      setFilteredOccupations(filtered);
    } else {
      setFilteredOccupations([]);
    }
  };

  /**
   * Write ALL deferred + own data to Firestore.
   * This is the single DB-write point for this entire 4-screen flow.
   */
  const handleComplete = async () => {
    if (bio.trim().length > 0 && bio.trim().length < 20) {
      Toast.show({
        type: 'error',
        text1: 'Bio Too Short',
        text2: 'Please write at least 20 characters, or leave it empty',
        visibilityTime: 3000,
      });
      return;
    }

    setSaving(true);
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('Not authenticated');

      const socialHandles: SocialHandles | null =
        instagram || linkedin || facebook || twitter
          ? {
              instagram: instagram.trim() || null,
              linkedin: linkedin.trim() || null,
              facebook: facebook.trim() || null,
              twitter: twitter.trim() || null,
            }
          : null;

      const heightData = height ? { value: height, displayUnit: 'cm' } : null;

      // ── Single Firestore write for the entire 4-screen flow ──────────────
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          // Own fields
          bio: bio.trim() || null,
          height: heightData,
          occupation: occupation.trim() || null,
          socialHandles,
          // Deferred fields from previous screens
          relationshipIntent,
          interestedIn,
          matchRadiusKm,
          signupComplete: true,
        });

      await firestore().collection('accounts').doc(userId).update({
        signupStep: 'complete',
        status: 'active',
      });

      console.log('✅ Profile completed — all dating preferences saved');

      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as never }] });
    } catch (error: any) {
      console.error('❌ Error saving profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Could not save. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  /** Skip – save deferred prefs with empty AboutMe fields and go to MainTabs */
  const handleSkip = async () => {
    setSaving(true);
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('Not authenticated');

      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          bio: null,
          height: null,
          occupation: null,
          socialHandles: null,
          relationshipIntent,
          interestedIn,
          matchRadiusKm,
          signupComplete: true,
        });

      await firestore().collection('accounts').doc(userId).update({
        signupStep: 'complete',
        status: 'active',
      });

      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' as never }] });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Could not skip. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const bioLen = bio.length;
  const bioShowInvalid = bioLen > 0 && bioLen < 20;
  const bioValid = bioLen === 0 || (bioLen >= 20 && bioLen <= 500);

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

          {/* Skip (right) */}
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={handleSkip}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* ── Scrollable form ───────────────────────── */}
        <KeyboardAwareScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          enableOnAndroid={true}
          extraScrollHeight={100}
          extraHeight={150}
          enableAutomaticScroll={true}
          keyboardOpeningTime={0}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.title}>Almost Done!</Text>
          <Text style={styles.subtitle}>Tell people a little about yourself</Text>

          {/* ── Bio ─────────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About Me</Text>
            <Text style={styles.sectionSub}>Tell others what makes you unique</Text>

            <View style={styles.textAreaWrap}>
              <TextInput
                style={[styles.textArea, focusedInput === 'bio' && styles.inputFocused]}
                placeholder="I love hiking, trying new restaurants, binge-watching sci-fi…"
                placeholderTextColor="#475569"
                value={bio}
                onChangeText={setBio}
                onFocus={() => setFocusedInput('bio')}
                onBlur={() => setFocusedInput(null)}
                multiline
                scrollEnabled={false}
                maxLength={500}
                textAlignVertical="top"
              />
              <Text
                style={[
                  styles.charCount,
                  bioLen >= 20 && styles.charCountOk,
                  bioShowInvalid && styles.charCountBad,
                ]}
              >
                {bioLen}/500{' '}
                {bioLen === 0 ? '(optional)' : bioLen >= 20 ? '✓' : `(min 20)`}
              </Text>
            </View>
          </View>

          {/* ── Height ──────────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Height</Text>
            <Text style={styles.sectionSub}>Optional but helps with matching</Text>

            <View style={[styles.inputRow, focusedInput === 'height' && styles.inputFocused]}>
              <Ionicons name="body-outline" size={22} color="#A855F7" style={{ marginRight: 12 }} />
              <TextInput
                style={styles.inputField}
                placeholder="Enter height in cm"
                placeholderTextColor="#475569"
                value={height ? height.toString() : ''}
                onChangeText={(t) => {
                  if (t === '') { setHeight(null); return; }
                  const n = parseInt(t, 10);
                  if (!isNaN(n) && n > 0 && n <= 300) setHeight(n);
                }}
                onFocus={() => setFocusedInput('height')}
                onBlur={() => setFocusedInput(null)}
                keyboardType="numeric"
                maxLength={3}
              />
              <Text style={styles.inputUnit}>cm</Text>
            </View>
          </View>

          {/* ── Occupation ──────────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Occupation</Text>
            <Text style={styles.sectionSub}>What do you do?</Text>

            <View>
              <View style={[styles.inputRow, focusedInput === 'occupation' && styles.inputFocused]}>
                <Ionicons name="briefcase-outline" size={22} color="#A855F7" style={{ marginRight: 12 }} />
                <TextInput
                  style={styles.inputField}
                  placeholder="e.g., Software Engineer, Doctor…"
                  placeholderTextColor="#475569"
                  value={occupation}
                  onChangeText={handleOccupationChange}
                  onFocus={() => setFocusedInput('occupation')}
                  onBlur={() => setFocusedInput(null)}
                  maxLength={50}
                />
              </View>

              {filteredOccupations.length > 0 && occupation.length >= 2 && (
                <View style={styles.suggestionsList}>
                  {filteredOccupations.map((occ, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.suggestionItem}
                      onPress={() => {
                        setOccupation(occ);
                        setFilteredOccupations([]);
                      }}
                    >
                      <Text style={styles.suggestionText}>{occ}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* ── Social Handles ──────────────────────── */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Social Handles</Text>
            <Text style={styles.sectionSub}>Help people connect with you (optional)</Text>

            <View style={styles.socialList}>
              {/* Instagram */}
              <View style={styles.socialRow}>
                <View style={[styles.socialIcon, { backgroundColor: '#E4405F' }]}>
                  <Ionicons name="logo-instagram" size={18} color="#FFFFFF" />
                </View>
                <TextInput
                  style={[styles.socialInput, focusedInput === 'instagram' && styles.inputFocused]}
                  placeholder="@username"
                  placeholderTextColor="#475569"
                  value={instagram}
                  onChangeText={setInstagram}
                  onFocus={() => setFocusedInput('instagram')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  maxLength={30}
                />
              </View>

              {/* LinkedIn */}
              <View style={styles.socialRow}>
                <View style={[styles.socialIcon, { backgroundColor: '#0A66C2' }]}>
                  <Ionicons name="logo-linkedin" size={18} color="#FFFFFF" />
                </View>
                <TextInput
                  style={[styles.socialInput, focusedInput === 'linkedin' && styles.inputFocused]}
                  placeholder="Profile URL or username"
                  placeholderTextColor="#475569"
                  value={linkedin}
                  onChangeText={setLinkedin}
                  onFocus={() => setFocusedInput('linkedin')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  maxLength={100}
                />
              </View>

              {/* Facebook */}
              <View style={styles.socialRow}>
                <View style={[styles.socialIcon, { backgroundColor: '#1877F2' }]}>
                  <Ionicons name="logo-facebook" size={18} color="#FFFFFF" />
                </View>
                <TextInput
                  style={[styles.socialInput, focusedInput === 'facebook' && styles.inputFocused]}
                  placeholder="Profile URL or username"
                  placeholderTextColor="#475569"
                  value={facebook}
                  onChangeText={setFacebook}
                  onFocus={() => setFocusedInput('facebook')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  maxLength={100}
                />
              </View>

              {/* X / Twitter */}
              <View style={styles.socialRow}>
                <View style={[styles.socialIcon, { backgroundColor: '#000000' }]}>
                  <Text style={styles.xLogo}>𝕏</Text>
                </View>
                <TextInput
                  style={[styles.socialInput, focusedInput === 'twitter' && styles.inputFocused]}
                  placeholder="@username"
                  placeholderTextColor="#475569"
                  value={twitter}
                  onChangeText={setTwitter}
                  onFocus={() => setFocusedInput('twitter')}
                  onBlur={() => setFocusedInput(null)}
                  autoCapitalize="none"
                  maxLength={30}
                />
              </View>
            </View>
          </View>

          <View style={{ height: 20 }} />
        </KeyboardAwareScrollView>

        {/* ── Complete Profile button ───────────────── */}
        <View style={[styles.footer, { paddingBottom: Math.max(32, insets.bottom + 16) }]}>
          <TouchableOpacity onPress={handleComplete} activeOpacity={0.85} disabled={saving}>
            <LinearGradient
              colors={['#8B2BE2', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.completeBtn}
            >
              <Text style={styles.completeBtnText}>
                {saving ? 'Saving…' : 'Complete Profile'}
              </Text>
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
    paddingTop: 8,
    paddingBottom: 120,
  },

  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#94A3B8',
    marginBottom: 28,
  },

  /* Section */
  section: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#64748B',
    marginBottom: 12,
  },

  /* Bio */
  textAreaWrap: { position: 'relative' },
  textArea: {
    backgroundColor: 'rgba(22,28,48,0.85)',
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    minHeight: 120,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  charCount: {
    position: 'absolute',
    bottom: 12,
    right: 16,
    fontSize: 12,
    fontFamily: 'Inter-Medium',
    color: '#475569',
  },
  charCountOk: { color: '#10B981' },
  charCountBad: { color: '#EF4444' },

  /* Focused glow — applied to any input */
  inputFocused: {
    borderColor: '#A855F7',
  },

  /* Generic input row */
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(22,28,48,0.85)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
  },
  inputField: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    paddingVertical: 14,
  },
  inputUnit: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#94A3B8',
    marginLeft: 8,
  },

  /* Occupation suggestions */
  suggestionsList: {
    marginTop: 8,
    backgroundColor: 'rgba(22,28,48,0.95)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  suggestionItem: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  suggestionText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },

  /* Social handles */
  socialList: { gap: 12 },
  socialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInput: {
    flex: 1,
    backgroundColor: 'rgba(22,28,48,0.85)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  xLogo: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },

  /* Footer */
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  completeBtn: {
    height: 54,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  completeBtnText: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
});

export default AboutMeScreen;
