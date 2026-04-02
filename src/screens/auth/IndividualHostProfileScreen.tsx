/**
 * INDIVIDUAL HOST PROFILE SCREEN
 * 
 * Final step for Individual Host signup - collect profile information:
 * - Host Bio (required)
 * - Experience years (optional)
 * - Host Category (optional)
 * - Social Links: Instagram, X (Twitter), LinkedIn, Facebook (all optional)
 * 
 * Database Updates:
 * - Updates users/{userId}.creatorDetails with bio, experience, category
 * - Updates users/{userId}.socialHandles with social links
 * - Sets signupStep to 'complete'
 * 
 * Next: MainTabs (signup complete)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type RootStackParamList = {
  IndividualHostProfile: undefined;
  MainTabs: undefined;
  HostTabs: undefined;
};

type IndividualHostProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'IndividualHostProfile'
>;

type IndividualHostProfileScreenRouteProp = RouteProp<
  RootStackParamList,
  'IndividualHostProfile'
>;

interface Props {
  navigation: IndividualHostProfileScreenNavigationProp;
  route: IndividualHostProfileScreenRouteProp;
}

interface GlowInputProps {
  iconName?: string;
  customIcon?: React.ReactNode;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  multiline?: boolean;
  numberOfLines?: number;
  style?: any;
  onFocus?: (e: any) => void;
  onBlur?: (e: any) => void;
}

const GlowInput: React.FC<GlowInputProps> = ({
  iconName,
  customIcon,
  style,
  multiline,
  numberOfLines,
  ...inputProps
}) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = (e: any) => {
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
    inputProps.onFocus?.(e);
  };

  const handleBlur = (e: any) => {
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
    inputProps.onBlur?.(e);
  };

  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#233B57', '#378BBB'],
  });

  return (
    <Animated.View
      style={[
        styles.inputContainer,
        { borderColor },
        multiline && styles.inputContainerMultiline,
      ]}
    >
      {customIcon ? (
        <View style={[styles.inputIcon, multiline && styles.inputIconMultiline]}>
          {customIcon}
        </View>
      ) : (
        <Ionicons
          name={iconName as any}
          size={20}
          color="#7F93AA"
          style={[styles.inputIcon, multiline && styles.inputIconMultiline]}
        />
      )}
      <TextInput
        {...inputProps}
        style={[
          styles.input,
          style,
          multiline && styles.inputMultiline,
        ]}
        placeholderTextColor="#7F93AA"
        onFocus={handleFocus}
        onBlur={handleBlur}
        multiline={multiline}
        numberOfLines={numberOfLines}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </Animated.View>
  );
};

// Simple glowing input for social handles
const GlowingSocialInput: React.FC<{
  style: any;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  maxLength?: number;
}> = ({ style, value, onChangeText, placeholder, maxLength }) => {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      style={[
        style,
        focused && {
          borderColor: '#378BBB',
          shadowColor: '#378BBB',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 12,
          elevation: 8,
        },
      ]}
      placeholder={placeholder}
      placeholderTextColor="#7F93AA"
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      autoCapitalize="none"
      maxLength={maxLength}
    />
  );
};

const HOST_CATEGORIES = [
  'Music & Concerts',
  'Sports & Fitness',
  'Food & Dining',
  'Nightlife & Parties',
  'Arts & Culture',
  'Workshops & Classes',
  'Networking & Business',
  'Adventure & Outdoors',
  'Other',
];

const IndividualHostProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [bio, setBio] = useState('');
  const [experience, setExperience] = useState('');
  const [category, setCategory] = useState('');
  const [instagram, setInstagram] = useState('');
  const [twitter, setTwitter] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [facebook, setFacebook] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canGoBack = useRef(navigation.canGoBack()).current;

  const isFormValid = (): boolean => {
    return bio.trim().length >= 50;
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      Toast.show({
        type: 'error',
        text1: 'Bio Required',
        text2: 'Please write a bio of at least 50 characters to help users know more about you as a host.',
        visibilityTime: 4000,
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Prepare creator details
      const creatorDetails = {
        bio: bio.trim(),
        experienceYears: experience ? parseInt(experience) : null,
        category: category || null,
      };

      // Prepare social handles (only include if provided)
      const socialHandles: any = {};
      if (instagram.trim()) {
        socialHandles.instagram = instagram.trim().replace('@', '');
      }
      if (twitter.trim()) {
        socialHandles.twitter = twitter.trim().replace('@', '');
      }
      if (linkedin.trim()) {
        socialHandles.linkedin = linkedin.trim();
      }
      if (facebook.trim()) {
        socialHandles.facebook = facebook.trim();
      }

      // Update user document
      await firestore().collection('users').doc(user.uid).update({
        creatorDetails,
        socialHandles: Object.keys(socialHandles).length > 0 ? socialHandles : null,
      });

      // Update account - mark Individual Host signup as complete
      await firestore().collection('accounts').doc(user.uid).update({
        signupStep: 'individual_host_complete',
      });

      setIsSubmitting(false);

      Toast.show({
        type: 'success',
        text1: 'Profile Complete! 🎉',
        text2: "You're all set as a host!",
        visibilityTime: 2000,
      });

      // Navigate to Host Dashboard
      setTimeout(() => {
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'HostTabs' as any }],
          })
        );
      }, 2000);
    } catch (error: any) {
      console.error('Profile save error:', error);
      setIsSubmitting(false);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Failed to save profile. Please try again.',
        visibilityTime: 4000,
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {canGoBack && (
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.content,
          canGoBack ? styles.contentWithHeader : styles.contentNoHeader,
          { paddingBottom: Math.max(120, insets.bottom + 80) },
        ]}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title Section */}
        <View style={styles.titleSection}>
          <View style={styles.iconCircle}>
            <Ionicons name="person-circle-outline" size={32} color="#378BBB" />
          </View>
          <Text style={styles.title}>Complete Your Host Profile</Text>
          <Text style={styles.subtitle}>
            Help event-goers know more about you and your events
          </Text>
        </View>

        {/* Bio Section */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Host Bio <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.helperText}>
            Tell people about your experience hosting events (min 50 characters)
          </Text>
          <GlowInput
            placeholder="I've been organizing music events for 5 years, specializing in live concerts and DJ nights..."
            value={bio}
            onChangeText={setBio}
            multiline
            numberOfLines={4}
            maxLength={500}
          />
          <Text style={styles.characterCount}>
            {bio.length}/500 characters
          </Text>
        </View>

        {/* Experience Section */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Years of Experience <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <GlowInput
            iconName="time-outline"
            placeholder="e.g., 5"
            value={experience}
            onChangeText={(text) => setExperience(text.replace(/\D/g, ''))}
            keyboardType="numeric"
            maxLength={2}
          />
        </View>

        {/* Category Section */}
        <View style={styles.section}>
          <Text style={styles.label}>
            Primary Event Category <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <TouchableOpacity
            onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
            activeOpacity={0.7}
          >
            <View style={styles.dropdownContainer}>
              <Ionicons name="pricetag-outline" size={20} color="#7F93AA" style={styles.inputIcon} />
              <Text style={[styles.dropdownText, !category && styles.dropdownPlaceholder]}>
                {category || 'Select your main event category'}
              </Text>
              <Ionicons
                name={showCategoryDropdown ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#7F93AA"
              />
            </View>
          </TouchableOpacity>

          {showCategoryDropdown && (
            <View style={styles.dropdown}>
              <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                {HOST_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategoryDropdown(false);
                    }}
                    style={styles.dropdownItem}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        category === cat && styles.dropdownItemTextSelected,
                      ]}
                    >
                      {cat}
                    </Text>
                    {category === cat && (
                      <Ionicons name="checkmark" size={20} color="#378BBB" />
                    )}
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Social Links Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Social Links <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <Text style={styles.helperText}>
            Connect your social profiles to build trust
          </Text>

          <View style={styles.socialLinksContainer}>
            {/* Instagram */}
            <View style={styles.socialInputRow}>
              <View style={[styles.socialIconWrapper, { backgroundColor: '#E4405F' }]}>
                <Ionicons name="logo-instagram" size={18} color="#FFFFFF" />
              </View>
              <GlowingSocialInput
                style={styles.socialInput}
                placeholder="@username"
                value={instagram}
                onChangeText={setInstagram}
                maxLength={30}
              />
            </View>

            {/* X (Twitter) */}
            <View style={styles.socialInputRow}>
              <View style={[styles.socialIconWrapper, { backgroundColor: '#000000' }]}>
                <Text style={styles.xLogo}>𝕏</Text>
              </View>
              <GlowingSocialInput
                style={styles.socialInput}
                placeholder="@username"
                value={twitter}
                onChangeText={setTwitter}
                maxLength={30}
              />
            </View>

            {/* LinkedIn */}
            <View style={styles.socialInputRow}>
              <View style={[styles.socialIconWrapper, { backgroundColor: '#0A66C2' }]}>
                <Ionicons name="logo-linkedin" size={18} color="#FFFFFF" />
              </View>
              <GlowingSocialInput
                style={styles.socialInput}
                placeholder="Profile URL or username"
                value={linkedin}
                onChangeText={setLinkedin}
                maxLength={100}
              />
            </View>

            {/* Facebook */}
            <View style={styles.socialInputRow}>
              <View style={[styles.socialIconWrapper, { backgroundColor: '#1877F2' }]}>
                <Ionicons name="logo-facebook" size={18} color="#FFFFFF" />
              </View>
              <GlowingSocialInput
                style={styles.socialInput}
                placeholder="Profile URL or username"
                value={facebook}
                onChangeText={setFacebook}
                maxLength={100}
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={!isFormValid() || isSubmitting}
          activeOpacity={0.8}
          style={styles.submitButtonContainer}
        >
          <LinearGradient
            colors={
              isFormValid() && !isSubmitting
                ? ['#378BBB', '#4FC3F7']
                : ['#1B2F48', '#1B2F48']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Complete Profile</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1621',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 10,
    zIndex: 10,
    backgroundColor: 'transparent',
  },
  backButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
  },
  contentWithHeader: {
    paddingTop: 100,
  },
  contentNoHeader: {
    paddingTop: 60,
  },
  titleSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(55, 139, 187, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  required: {
    color: '#FF4D6D',
  },
  optional: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
  },
  helperText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    marginBottom: 12,
    lineHeight: 18,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    marginBottom: 16,
    minHeight: 56,
  },
  inputContainerMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
    minHeight: 120,
  },
  inputIcon: {
    marginRight: 12,
  },
  inputIconMultiline: {
    marginTop: 2,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  inputMultiline: {
    paddingVertical: 8,
    minHeight: 90,
  },
  characterCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    textAlign: 'right',
    marginTop: -12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  socialLinksContainer: {
    gap: 12,
  },
  socialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  socialIconWrapper: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInput: {
    flex: 1,
    backgroundColor: '#1B2F48',
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#233B57',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#FFFFFF',
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#233B57',
    paddingHorizontal: 16,
    height: 56,
  },
  dropdownText: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  dropdownPlaceholder: {
    color: '#7F93AA',
  },
  dropdown: {
    backgroundColor: '#16283D',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#233B57',
    maxHeight: 250,
  },
  dropdownScroll: {
    maxHeight: 250,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#233B57',
  },
  dropdownItemText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#B8C7D9',
  },
  dropdownItemTextSelected: {
    color: '#378BBB',
  },
  submitButtonContainer: {
    marginBottom: 40,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  submitButtonText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  xLogo: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
});

export default IndividualHostProfileScreen;
