/**
 * CREATOR GOOGLE PROFILE SETUP SCREEN
 * 
 * After linking Google credential to phone auth, this screen collects:
 * - Full Name (pre-filled from Google, editable)
 * - Username (required)
 * 
 * No DOB or Gender (creator accounts don't need dating fields)
 * 
 * Database Updates:
 * - Creates accounts/{accountId} with role: "event_creator", emailVerified: true
 * - Creates users/{userId} with minimal creator profile
 * 
 * Next: CreatorTypeSelection
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
  Modal,
  ImageBackground,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface CreatorGoogleProfileSetupScreenProps {
  navigation: any;
  route: any;
}

const CreatorGoogleProfileSetupScreen: React.FC<CreatorGoogleProfileSetupScreenProps> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // Load Google user data with proper null checks and loading state
  useEffect(() => {
    const loadGoogleUserData = async () => {
      try {
        // First check route params
        if (route.params?.googleUser) {
          setGoogleUser(route.params.googleUser);
          setFullName(route.params.googleUser.displayName || '');
          setIsLoadingUserData(false);
          return;
        }

        // Wait for Firebase Auth to initialize
        const currentUser = auth().currentUser;
        if (!currentUser) {
          console.error('No authenticated user found');
          setIsLoadingUserData(false);
          return;
        }

        // Find Google provider in providerData
        const googleProvider = currentUser.providerData?.find(
          provider => provider?.providerId === 'google.com'
        );

        if (googleProvider) {
          const userData = {
            uid: currentUser.uid,
            email: googleProvider.email || currentUser.email || '',
            displayName: googleProvider.displayName || currentUser.displayName || '',
            photoURL: googleProvider.photoURL || currentUser.photoURL || null,
          };
          setGoogleUser(userData);
          setFullName(userData.displayName);
        } else {
          // No Google provider found - shouldn't happen, but handle gracefully
          console.warn('No Google provider found in providerData');
          const fallbackData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || null,
          };
          setGoogleUser(fallbackData);
          setFullName(fallbackData.displayName);
        }
      } catch (error) {
        console.error('Error loading Google user data:', error);
      } finally {
        setIsLoadingUserData(false);
      }
    };

    loadGoogleUserData();
  }, [route.params]);

  // Check username availability with debounce
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        return;
      }

      setCheckingUsername(true);
      try {
        const snapshot = await firestore()
          .collection('users')
          .where('username', '==', username.toLowerCase())
          .limit(1)
          .get();
        
        setUsernameAvailable(snapshot.empty);
      } catch (error) {
        console.error('Username check error:', error);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const validateForm = () => {
    if (!fullName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Name Required',
        text2: 'Please enter your name',
        visibilityTime: 3000,
      });
      return false;
    }
    if (!username.trim() || username.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Username',
        text2: 'Username must be at least 3 characters',
        visibilityTime: 3000,
      });
      return false;
    }
    if (usernameAvailable === false) {
      Toast.show({
        type: 'error',
        text1: 'Username Taken',
        text2: 'This username is already in use',
        visibilityTime: 3000,
      });
      return false;
    }
    return true;
  };

  const handleContinue = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      const accountId = user.uid;

      // Create account document (Google users are auto-verified)
      await firestore().collection('accounts').doc(accountId).set({
        authUid: user.uid,
        role: 'event_creator',
        creatorType: null, // Set later in CreatorTypeSelection
        status: 'pending_verification',
        phoneVerified: true, // Phone was verified first
        emailVerified: true, // Google accounts are verified
        identityVerified: false,
        bankVerified: false,
        signupStep: 'creator_type_selection', // Creator needs to choose type next
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Create user document (minimal creator profile)
      await firestore().collection('users').doc(accountId).set({
        accountId,
        username: username.toLowerCase(),
        name: fullName,
        // No dating fields (age, gender, bio, interests, photos, etc.)
        creatorDetails: {
          organizationName: null,
          businessAddress: null,
          experienceYears: null,
          bio: null,
          socialLinks: null,
        },
        isVerified: false,
        premiumStatus: 'free',
        signupComplete: false, // Creator hasn't completed setup yet
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastActiveAt: firestore.FieldValue.serverTimestamp(),
      });

      setLoading(false);
      Toast.show({
        type: 'success',
        text1: 'Profile Created!',
        text2: 'Your Google account is verified',
        visibilityTime: 3000,
      });
      
      setTimeout(() => {
        navigation.navigate('CreatorTypeSelection');
      }, 1000);
    } catch (error: any) {
      setLoading(false);
      console.error('Profile creation error:', error);
      Toast.show({
        type: 'error',
        text1: 'Setup Failed',
        text2: error.message || 'Failed to create profile',
        visibilityTime: 4000,
      });
    }
  };
  // Show loading screen while fetching user data
  if (isLoadingUserData || !googleUser) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg_splash.webp')}
        style={styles.bg}
        blurRadius={6}
      >
        <View style={styles.overlay} />
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </ImageBackground>
    );
  }
  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.bg}
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Funmate Logo Header */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        {navigation.canGoBack() ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => setShowLogoutAlert(true)}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <TouchableWithoutFeedback
        onPress={() => {
          Keyboard.dismiss();
          setFocusedInput(null);
        }}
      >
        <View style={{ flex: 1 }}>
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
          >
            {/* Page title + Google account info */}
            <View style={styles.pageHeader}>
              <Text style={styles.title}>Complete Your Profile</Text>
              <Text style={styles.subtitle}>Just a few more details</Text>

              {/* Google Account Info */}
              <View style={styles.googleInfoContainer}>
                {googleUser.photoURL && (
                  <Image
                    source={{ uri: googleUser.photoURL }}
                    style={styles.googleAvatar}
                  />
                )}
                <View style={styles.googleTextContainer}>
                  <Text style={styles.googleLabel}>Signing in with Google</Text>
                  <Text style={styles.googleEmail}>{googleUser.email}</Text>
                </View>
              </View>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <View>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={[styles.input, focusedInput === 'fullName' && styles.inputFocused]}
                  value={fullName}
                  onChangeText={setFullName}
                  placeholder="Your Name"
                  placeholderTextColor="#7F93AA"
                  autoCapitalize="words"
                  editable={!loading}
                  onFocus={() => setFocusedInput('fullName')}
                  onBlur={() => setFocusedInput(null)}
                />
              </View>

              <View>
                <Text style={styles.label}>Username</Text>
                <View style={styles.usernameContainer}>
                  <TextInput
                    style={[styles.input, focusedInput === 'username' && styles.inputFocused]}
                    value={username}
                    onChangeText={setUsername}
                    placeholder="@username"
                    placeholderTextColor="#7F93AA"
                    autoCapitalize="none"
                    editable={!loading}
                    onFocus={() => setFocusedInput('username')}
                    onBlur={() => setFocusedInput(null)}
                  />
                  {username.length >= 3 && (
                    <View style={styles.usernameStatus}>
                      {checkingUsername ? (
                        <ActivityIndicator size="small" color="#A855F7" />
                      ) : usernameAvailable === true ? (
                        <Text style={styles.availableText}>✓ Available</Text>
                      ) : usernameAvailable === false ? (
                        <Text style={styles.unavailableText}>✗ Taken</Text>
                      ) : null}
                    </View>
                  )}
                </View>
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B2BE2', '#06B6D4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.continueButton, { marginBottom: Math.max(32, insets.bottom + 16) }]}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.continueButtonText}>Continue</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </View>
      </TouchableWithoutFeedback>

      {/* Logout Confirmation Modal */}
      <Modal
        visible={showLogoutAlert}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutAlert(false)}
      >
        <View style={styles.alertOverlay}>
          <View style={styles.alertBox}>
            <Text style={styles.alertTitle}>Use Different Number?</Text>
            <Text style={styles.alertMessage}>
              You'll need to verify your phone number again.
            </Text>
            <View style={styles.alertButtons}>
              <TouchableOpacity
                style={styles.alertCancelButton}
                onPress={() => setShowLogoutAlert(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.alertCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.alertLogoutButton}
                onPress={async () => {
                  setShowLogoutAlert(false);
                  await auth().signOut();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Login' as never }],
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.alertLogoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1621',
  },
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,11,30,0.62)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.60)',
    fontFamily: 'Inter-Regular',
  },
  scrollView: {
    flex: 1,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  pageHeader: {
    paddingHorizontal: 32,
    paddingTop: 58,
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 32,
    paddingTop: 40,
    paddingBottom: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
  },
  googleInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,28,45,0.88)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  googleAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginRight: 12,
  },
  googleTextContainer: {
    flex: 1,
  },
  googleLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 2,
    fontFamily: 'Inter-Regular',
  },
  googleEmail: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  form: {
    paddingHorizontal: 32,
    gap: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(45,43,58,0.85)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    height: 54,
    justifyContent: 'center',
    fontFamily: 'Inter-Regular',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  inputFocused: {
    borderColor: 'rgba(139,92,246,0.80)',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  inputText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  placeholderText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
  },
  usernameContainer: {
    position: 'relative',
  },
  usernameStatus: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableText: {
    color: '#2ECC71',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  unavailableText: {
    color: '#FF4D6D',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    marginTop: 32,
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
  bottomSpacer: {
    height: 40,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  alertBox: {
    backgroundColor: '#1A1530',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  alertTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  alertMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  alertButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  alertCancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  alertCancelText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  alertLogoutButton: {
    flex: 1,
    backgroundColor: '#FF4D6D',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  alertLogoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});

export default CreatorGoogleProfileSetupScreen;
