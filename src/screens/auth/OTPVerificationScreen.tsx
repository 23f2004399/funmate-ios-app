import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import auth, { getAuth, signInWithPhoneNumber, PhoneAuthProvider, signInWithCredential } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface OTPVerificationScreenProps {
  navigation: any;
  route: any;
}

const OTPVerificationScreen = ({ navigation, route }: OTPVerificationScreenProps) => {
  const { phoneNumber, verificationId, accountType = 'user', isLogin = false } = route.params as {
    phoneNumber: string;
    verificationId: string;
    accountType?: 'user' | 'creator';
    isLogin?: boolean;
  };
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(30);
  const [canResend, setCanResend] = useState(false);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const insets = useSafeAreaInsets();
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Countdown timer for resend
  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => {
        setResendTimer(resendTimer - 1);
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      setCanResend(true);
    }
  }, [resendTimer]);

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (key: string, index: number) => {
    // Handle backspace
    if (key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      Toast.show({
        type: 'error',
        text1: 'Incomplete Code',
        text2: 'Please enter the complete 6-digit code',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    
    try {
      console.log('Verifying OTP:', otpCode);
      
      // Use modular API to create credential and sign in
      const credential = PhoneAuthProvider.credential(verificationId, otpCode);
      const authInstance = getAuth();
      const userCredential = await signInWithCredential(authInstance, credential);
      
      const userId = userCredential.user.uid;
      console.log('Phone verified! User ID:', userId);
      
      // Check if this user already has an account (duplicate signup attempt)
      let isExistingUser = false;
      
      try {
        const accountDoc = await firestore()
          .collection('accounts')
          .doc(userId)
          .get();
        
        console.log('Account doc data:', accountDoc.data());
        console.log('Account exists?:', accountDoc.exists);
        
        // Only treat as existing if document actually has data
        isExistingUser = accountDoc.exists() && accountDoc.data() != null;
        console.log('Is existing user?:', isExistingUser);
        
      } catch (firestoreError: any) {
        // If Firestore check fails, assume new user
        console.log('Firestore check error (treating as new user):', firestoreError.code, firestoreError.message);
        isExistingUser = false;
      }
      
      // Handle LOGIN flow
      if (isLogin) {
        if (!isExistingUser) {
          // User doesn't exist - can't login
          await auth().signOut();
          setLoading(false);
          Toast.show({
            type: 'error',
            text1: 'Account Not Found',
            text2: 'No account found with this phone number. Please sign up first.',
            visibilityTime: 4000,
          });
          navigation.navigate('Login');
          return;
        }
        
        // Login successful - check account role to determine correct dashboard
        const loginAccountDoc = await firestore().collection('accounts').doc(userId).get();
        const loginSignupStep = loginAccountDoc.data()?.signupStep;
        const isHost =
          loginSignupStep === 'individual_host_complete' ||
          loginSignupStep === 'merchant_complete';

        setLoading(false);
        Toast.show({
          type: 'success',
          text1: 'Login Successful!',
          text2: 'Welcome back to Funmate',
          visibilityTime: 3000,
        });
        
        // Navigate to the correct dashboard based on account role
        setTimeout(() => {
          navigation.reset({
            index: 0,
            routes: [{ name: (isHost ? 'HostTabs' : 'MainTabs') as never }],
          });
        }, 1500);
        return;
      }
      
      // Handle SIGNUP flow
      if (isExistingUser) {
        // User already has account - check their signup progress
        const accountData = (await firestore().collection('accounts').doc(userId).get()).data();
        const signupStep = accountData?.signupStep;
        
        if (signupStep && signupStep !== 'complete') {
          // User has incomplete signup - let them continue
          setLoading(false);
          Toast.show({
            type: 'info',
            text1: 'Welcome Back!',
            text2: 'Let\'s continue setting up your profile',
            visibilityTime: 2000,
          });
          
          // Navigate based on signupStep
          const screenMap: Record<string, string> = {
            'basic_info': 'ProfileSetup',
            'photos': 'PhotoUpload',
            'liveness': 'LivenessVerification',
            'preferences': 'LookingFor',
            'interests': 'InterestsSelection',
            'permissions': 'Permissions',
          };
          
          const targetScreen = screenMap[signupStep] || 'ProfileSetup';
          navigation.navigate(targetScreen as never, accountType === 'creator' ? undefined : { phoneNumber });
          return;
        }
        
        // Signup is complete - this is a duplicate signup attempt
        await auth().signOut();
        setLoading(false);
        Toast.show({
          type: 'error',
          text1: 'Phone Number Already Registered',
          text2: 'This phone number is already linked to an account. Please log in.',
          visibilityTime: 4000,
        });
        navigation.goBack();
        return;
      }
      
      // NEW USER: Create account document with signupStep
      try {
        await firestore().collection('accounts').doc(userId).set({
          authUid: userId,
          // Phone number NOT stored here - available via auth().currentUser.phoneNumber
          role: accountType === 'creator' ? 'event_creator' : 'user',
          creatorType: null,
          status: 'pending_verification',
          phoneVerified: true,
          emailVerified: false,
          identityVerified: false,
          bankVerified: false,
          signupStep: accountType === 'creator' ? 'creator_basic_info' : 'basic_info',
          createdAt: firestore.FieldValue.serverTimestamp(),
        });
        console.log('Account document created with signupStep:', accountType === 'creator' ? 'creator_basic_info' : 'basic_info');
      } catch (createError) {
        console.error('Error creating account document:', createError);
        // Continue anyway - the signup screens will handle this
      }
      
      setLoading(false);
      
      Toast.show({
        type: 'success',
        text1: 'Phone Verified!',
        text2: accountType === 'creator' ? 'Complete your profile' : 'Let\'s set up your profile',
        visibilityTime: 2000,
      });
      
      if (accountType === 'creator') {
        console.log('New creator - navigating to CreatorBasicInfo');
        // Navigate to creator basic info (Full Name, Email, Username, Password)
        navigation.navigate('CreatorBasicInfo', { phoneNumber });
      } else {
        console.log('New user - navigating to ProfileSetup');
        // Navigate to profile setup
        navigation.navigate('ProfileSetup', { phoneNumber });
      }
    } catch (error: any) {
      setLoading(false);
      console.error('OTP verification error:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.message || 'Invalid code. Please try again',
        visibilityTime: 4000,
      });
    }
  };

  const handleResendCode = async () => {
    if (!canResend) return;
    
    try {
      console.log('Resending code to:', phoneNumber);
      
      const authInstance = getAuth();
      const newConfirmation = await signInWithPhoneNumber(
        authInstance,
        phoneNumber
      );
      
      // Reset timer
      setResendTimer(30);
      setCanResend(false);
      
      Toast.show({
        type: 'success',
        text1: 'Code Sent',
        text2: 'A new verification code has been sent',
        visibilityTime: 3000,
      });
      
      // Update verificationId in route params
      navigation.setParams({ verificationId: newConfirmation.verificationId });
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Resend Failed',
        text2: error.message || 'Failed to resend code',
        visibilityTime: 3000,
      });
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.container}
      resizeMode="cover"
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        {/* Funmate Logo — centred in header */}
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage as any} />
          <Text style={styles.appName}>Funmate</Text>
        </View>

        {/* Spacer to balance back button */}
        <View style={styles.backButton} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title}>Enter Verification Code</Text>
        <Text style={styles.subtitle}>
          We sent a code to {phoneNumber}
        </Text>

        {/* OTP Input Boxes */}
        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                inputRefs.current[index] = ref;
              }}
              style={[
                styles.otpBox,
                digit && styles.otpBoxFilled,
                focusedIndex === index && styles.otpBoxFocused,
              ]}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={({ nativeEvent }) =>
                handleKeyPress(nativeEvent.key, index)
              }
              onFocus={() => setFocusedIndex(index)}
              onBlur={() => setFocusedIndex(null)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          onPress={handleVerify}
          disabled={otp.join('').length !== 6 || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={otp.join('').length !== 6 || loading ? ['rgba(139,43,226,0.25)', 'rgba(6,182,212,0.25)'] : ['#8B2BE2', '#06B6D4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={styles.verifyButton}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Resend Code */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive code? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResendCode} activeOpacity={0.7}>
              <Text style={styles.resendLink}>Resend</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.resendTimer}>Resend in {resendTimer}s</Text>
          )}
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13, 11, 30, 0.62)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 18,
  },
  logoImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
    position: 'absolute',
    left: -36,
  },
  appName: {
    fontSize: 30,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
    paddingHorizontal: 32,
    paddingTop: 100,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 40,
    fontFamily: 'Inter-Regular',
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  otpBox: {
    width: 50,
    height: 56,
    backgroundColor: 'rgba(30, 28, 45, 0.88)',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    fontSize: 24,
    fontWeight: '600',
    color: '#FFFFFF',
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  otpBoxFilled: {
    borderColor: 'rgba(139, 92, 246, 0.60)',
  },
  otpBoxFocused: {
    borderColor: 'rgba(139, 92, 246, 0.90)',
    borderWidth: 2,
  },
  verifyButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
    marginBottom: 24,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  resendLink: {
    fontSize: 15,
    color: '#22D3EE',
    fontFamily: 'Inter-SemiBold',
  },
  resendTimer: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
  },
});

export default OTPVerificationScreen;
