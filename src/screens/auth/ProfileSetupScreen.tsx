import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Modal,
  ImageBackground,
  Image,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import Toast from 'react-native-toast-message';
import Svg, { Path } from 'react-native-svg';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface ProfileSetupScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'ProfileSetup'>;
  route: any;
}

const ProfileSetupScreen = ({ navigation, route }: ProfileSetupScreenProps) => {
  const insets = useSafeAreaInsets();
  // Phone number available from Firebase Auth, not passed as route param anymore
  const [phoneNumber] = useState(auth().currentUser?.phoneNumber || '');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showLogoutAlert, setShowLogoutAlert] = useState(false);

  /**
   * Calculate password strength
   */
  const getPasswordStrength = (pass: string) => {
    const requirements = {
      minLength: pass.length >= 6,
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      number: /[0-9]/.test(pass),
      special: /[@#$%^&*()!]/.test(pass),
    };

    if (!pass) return { score: 0, label: '', color: '#E0E0E0', requirements };

    const score = Object.values(requirements).filter(Boolean).length;

    let label = '';
    let color = '';

    if (score <= 2) {
      label = 'Weak';
      color = '#FF4458';
    } else if (score === 3) {
      label = 'Fair';
      color = '#FFA500';
    } else if (score <= 5) {
      label = 'Good';
      color = '#8BC34A';
    } else {
      label = 'Strong';
      color = '#4CAF50';
    }

    return { score, label, color, requirements };
  };

  const passwordStrength = getPasswordStrength(password);

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
        text1: 'Full Name Required',
        text2: 'Please enter your full name',
        visibilityTime: 3000,
      });
      return false;
    }
    if (!email.trim() || !email.includes('@')) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Email',
        text2: 'Please enter a valid email address',
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
        text2: 'This username is already taken',
        visibilityTime: 3000,
      });
      return false;
    }
    if (password.length < 6) {
      Toast.show({
        type: 'error',
        text1: 'Password Too Short',
        text2: 'Password must be at least 6 characters',
        visibilityTime: 3000,
      });
      return false;
    }
    if (passwordStrength.score < 4) {
      Toast.show({
        type: 'error',
        text1: 'Password Too Weak',
        text2: 'Please create a Good or Strong password',
        visibilityTime: 3000,
      });
      return false;
    }
    if (password !== confirmPassword) {
      Toast.show({
        type: 'error',
        text1: 'Passwords Don\'t Match',
        text2: 'Please make sure passwords match',
        visibilityTime: 3000,
      });
      return false;
    }
    return true;
  };

  const handleContinue = () => {
    if (!validateForm()) return;
    navigation.navigate('DOBSelection', {
      fullName,
      email,
      username,
      password,
    });
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const currentUser = auth().currentUser;
      if (!currentUser) {
        throw new Error('No authenticated user. Please log in with phone first.');
      }

      // Check if device supports Google Play Services
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      
      // Sign out from Google first to force account picker every time
      await GoogleSignin.signOut();
      
      // Sign in with Google (will show account picker)
      const userInfo = await GoogleSignin.signIn();
      
      // Get tokens
      const tokens = await GoogleSignin.getTokens();
      
      // Create Google credential
      const googleCredential = auth.GoogleAuthProvider.credential(tokens.idToken);
      
      // LINK Google credential to existing phone-authenticated account
      const userCredential = await currentUser.linkWithCredential(googleCredential);
      const linkedUser = userCredential.user;
      
      setLoading(false);
      
      // Navigate to Google profile setup (use userInfo.data for Google profile data)
      navigation.navigate('GoogleProfileSetup', {
        googleUser: {
          uid: linkedUser.uid, // Same UID as phone auth
          email: userInfo.data?.user.email || linkedUser.email,
          displayName: userInfo.data?.user.name || linkedUser.displayName,
          photoURL: userInfo.data?.user.photo || linkedUser.photoURL,
        },
      });
    } catch (error: any) {
      setLoading(false);
      console.error('Google Sign-In error:', error);
      
      if (error.code === 'sign_in_cancelled') {
        // User cancelled the sign-in
        return;
      }
      
      if (error.code === 'auth/credential-already-in-use') {
        Toast.show({
          type: 'error',
          text1: 'Google Account Already Linked',
          text2: 'This Google account is already linked to another phone number',
          visibilityTime: 4000,
        });
        return;
      }
      
      Toast.show({
        type: 'error',
        text1: 'Google Sign-In Failed',
        text2: error.message || 'Please try again',
        visibilityTime: 4000,
      });
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.bg}
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Funmate logo header — fixed above scroll */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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
            <Ionicons name="log-out-outline" size={26} color="#FFFFFF" />
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
          <KeyboardAwareScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            enableOnAndroid={true}
            extraScrollHeight={100}
            extraHeight={150}
            enableAutomaticScroll={true}
            keyboardOpeningTime={0}
          >
            {/* Page title */}
            <View style={styles.pageHeader}>
              <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>Complete Your Profile</Text>
              <Text style={styles.subtitle}>Enter your basic details</Text>
            </View>

            {/* Form Fields */}
            <View style={styles.form}>
              <TextInput
                style={[styles.input, focusedInput === 'fullName' && styles.inputFocused]}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Full Name"
                placeholderTextColor="rgba(255,255,255,0.35)"
                autoCapitalize="words"
                onFocus={() => setFocusedInput('fullName')}
                onBlur={() => setFocusedInput(null)}
              />

              <TextInput
                style={[styles.input, focusedInput === 'email' && styles.inputFocused]}
                value={email}
                onChangeText={setEmail}
                placeholder="Email Address"
                placeholderTextColor="rgba(255,255,255,0.35)"
                keyboardType="email-address"
                autoCapitalize="none"
                onFocus={() => setFocusedInput('email')}
                onBlur={() => setFocusedInput(null)}
              />

              <View style={styles.usernameContainer}>
                <TextInput
                  style={[styles.input, focusedInput === 'username' && styles.inputFocused]}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Username"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('username')}
                  onBlur={() => setFocusedInput(null)}
                />
                {username.length >= 3 && (
                  <View style={styles.usernameStatus}>
                    {checkingUsername ? (
                      <ActivityIndicator size="small" color="#9B59B6" />
                    ) : usernameAvailable === true ? (
                      <Text style={styles.availableText}>✓ Available</Text>
                    ) : usernameAvailable === false ? (
                      <Text style={styles.unavailableText}>✗ Taken</Text>
                    ) : null}
                  </View>
                )}
              </View>

              {/* Password */}
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, focusedInput === 'password' && styles.inputFocused]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('password')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color="rgba(255,255,255,0.40)"
                  />
                </TouchableOpacity>
              </View>

              {/* Password Strength Indicator */}
              {password.length > 0 && (
                <View style={styles.passwordStrengthContainer}>
                  <View style={styles.strengthBarBackground}>
                    <View
                      style={[
                        styles.strengthBarFill,
                        {
                          width: `${(passwordStrength.score / 6) * 100}%`,
                          backgroundColor: passwordStrength.color,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.strengthLabel, { color: passwordStrength.color }]}>
                    {passwordStrength.label}
                  </Text>
                </View>
              )}

              {/* Confirm Password */}
              <View style={styles.passwordContainer}>
                <TextInput
                  style={[styles.passwordInput, focusedInput === 'confirmPassword' && styles.inputFocused]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Confirm Password"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  onFocus={() => setFocusedInput('confirmPassword')}
                  onBlur={() => setFocusedInput(null)}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-outline' : 'eye-off-outline'}
                    size={22}
                    color="rgba(255,255,255,0.40)"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              onPress={handleContinue}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#8B2BE2', '#06B6D4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.continueButton}
              >
                <Text style={styles.continueButtonText}>Continue</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* OR divider */}
            <View style={styles.orRow}>
              <View style={styles.orLine} />
              <Text style={styles.orText}>OR</Text>
              <View style={styles.orLine} />
            </View>

            {/* Continue with Google Button */}
            <TouchableOpacity
              style={[styles.googleButton, { marginBottom: Math.max(32, insets.bottom + 16) }]}
              onPress={handleGoogleSignIn}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Svg width="18" height="18" viewBox="0 0 48 48" style={{ marginRight: 12 }}>
                <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                <Path fill="none" d="M0 0h48v48H0z" />
              </Svg>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </TouchableOpacity>
          </KeyboardAwareScrollView>
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
                    routes: [{ name: 'Login' }],
                  });
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.alertLogoutText}>Log Out</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,11,30,0.62)',
  },
  // Logo header row
  header: {
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
    fontSize: 30,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  // Page title section
  pageHeader: {
    paddingHorizontal: 32,
    paddingTop: 28,
    paddingBottom: 24,
  },
  title: {
    fontSize: 26,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 34,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.50)',
    fontFamily: 'Inter-Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: 40,
    paddingBottom: 40,
  },
  form: {
    paddingHorizontal: 32,
    gap: 14,
  },
  input: {
    backgroundColor: 'rgba(45,43,58,0.85)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    height: 56,
    justifyContent: 'center',
    fontFamily: 'Inter-Regular',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  inputFocused: {
    borderColor: 'rgba(139,92,246,0.60)',
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
  passwordContainer: {
    position: 'relative',
  },
  passwordInput: {
    backgroundColor: 'rgba(45,43,58,0.85)',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingRight: 50,
    fontSize: 16,
    color: '#FFFFFF',
    height: 56,
    fontFamily: 'Inter-Regular',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    top: 0,
    height: 56,
    justifyContent: 'center',
  },
  eyeIconText: {
    fontSize: 20,
  },
  passwordStrengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 6,
  },
  strengthBarBackground: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthLabel: {
    fontSize: 12,
    minWidth: 50,
    fontFamily: 'Inter-SemiBold',
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    marginHorizontal: 32,
    marginTop: 24,
  },
  googleButtonText: {
    color: '#1C1C1E',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    marginTop: 14,
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
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 32,
    marginTop: 20,
    marginBottom: 16,
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  orText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 2,
  },
  alertOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.80)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  alertBox: {
    backgroundColor: 'rgba(30,28,45,0.96)',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  alertTitle: {
    fontSize: 20,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  alertMessage: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.60)',
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
    borderColor: 'rgba(255,255,255,0.18)',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  alertCancelText: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  alertLogoutButton: {
    flex: 1,
    backgroundColor: '#FF4D6D',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  alertLogoutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
});

export default ProfileSetupScreen;
