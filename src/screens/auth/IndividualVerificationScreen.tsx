/**
 * INDIVIDUAL HOST VERIFICATION SCREEN
 * 
 * Identity verification for individual event hosts using:
 * - Aadhaar (preferred)
 * - PAN (alternative or additional)
 * 
 * Verification Provider: Digio (https://www.digio.in/)
 * 
 * Database Updates:
 * - Creates verifications/{verificationId} with type "aadhaar_basic" or "pan_basic"
 * - Stores only verification status, NOT raw document numbers
 * - Updates accounts/{accountId}.identityVerified to true on approval
 * 
 * Next: IndividualBankDetailsScreen
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TextInputProps,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

/**
 * Animated input component - uses Animated API for glow effect
 * Animated values change UI without React re-renders, so focus is stable
 */
interface GlowInputProps extends TextInputProps {
  iconName: string;
}

const GlowInput = ({ iconName, style, ...inputProps }: GlowInputProps) => {
  // Animated value - changes don't trigger re-renders
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

  // Interpolate border color from default to glow
  const borderColor = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#233B57', '#378BBB'],
  });

  return (
    <Animated.View style={[styles.inputContainer, { borderColor }]}>
      <Ionicons
        name={iconName}
        size={20}
        color="#7F93AA"
        style={styles.inputIcon}
      />
      <TextInput
        {...inputProps}
        style={[styles.input, style]}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </Animated.View>
  );
};

interface IndividualVerificationScreenProps {
  navigation: any;
}

const IndividualVerificationScreen: React.FC<IndividualVerificationScreenProps> = ({ navigation }) => {
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Store canGoBack result once to avoid re-renders
  const canGoBack = useRef(navigation.canGoBack()).current;

  /**
   * Validate Aadhaar format (12 digits)
   */
  const validateAadhaar = (aadhaar: string): boolean => {
    const aadhaarRegex = /^\d{12}$/;
    return aadhaarRegex.test(aadhaar);
  };

  /**
   * Validate PAN format (ABCDE1234F)
   */
  const validatePAN = (pan: string): boolean => {
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  /**
   * ═══════════════════════════════════════════════════════════════════
   * � DIGIO API INTEGRATION POINT
   * ═══════════════════════════════════════════════════════════════════
   * 
   * CURRENT STATUS: BYPASS MODE (No actual verification)
   * Users can proceed without real identity verification for development.
   * 
   * WHEN READY TO INTEGRATE DIGIO:
   * 
   * 1. BACKEND SETUP (Required - Never call Digio directly from frontend):
   *    a) Create Cloud Function or Express endpoint:
   *       - Firebase: functions/src/verifyIdentity.ts
   *       - Express: routes/api/verify-identity.js
   *    
   *    b) Store Digio API credentials in environment variables:
   *       - DIGIO_API_KEY
   *       - DIGIO_CLIENT_ID
   *       - DIGIO_BASE_URL (https://api.digio.in/v2/)
   * 
   * 2. VERIFICATION FLOW:
   *    
   *    AADHAAR VERIFICATION:
   *    - Step 1: POST /aadhaar/otp - Send Aadhaar number → Digio sends OTP
   *    - Step 2: Show OTP input screen to user
   *    - Step 3: POST /aadhaar/verify - Send Aadhaar + OTP → Get verification result
   *    - Returns: { name, aadhaarLast4, verified: true/false }
   *    
   *    PAN VERIFICATION:
   *    - Step 1: POST /pan/verify - Send PAN number → Instant verification
   *    - Returns: { name, panNumber, verified: true/false }
   * 
   * 3. FIRESTORE UPDATES (Backend should handle):
   *    
   *    Create verification record:
   *    verifications/{verificationId} = {
   *      accountId: user.uid,
   *      type: "aadhaar_basic" | "pan_basic",
   *      provider: "Digio",
   *      status: "approved" | "rejected" | "pending",
   *      verifiedName: string,           // Name from Digio
   *      meta: { last4: "1234" },        // Last 4 digits only (for Aadhaar)
   *      reason: string | null,          // Rejection reason if any
   *      verifiedAt: serverTimestamp(),
   *      createdAt: serverTimestamp()
   *    }
   *    
   *    Update account status:
   *    accounts/{accountId}.identityVerified = true (only if approved)
   * 
   * 4. REPLACE THE CODE BELOW:
   *    
   *    Uncomment the actual implementation section and:
   *    - Replace 'YOUR_BACKEND_URL' with your Cloud Function URL or API endpoint
   *    - Handle OTP flow for Aadhaar (may need additional screen)
   *    - Parse response and check verification status
   *    - Return { success: true, verificationId: '...' } on approval
   * 
   * ═══════════════════════════════════════════════════════════════════
   */
  const verifyWithDigio = async (type: 'aadhaar' | 'pan', documentNumber: string) => {
    // 🚧 BYPASS MODE - Remove this section when Digio is integrated
    console.log(`[BYPASS] Skipping ${type} verification for: ${documentNumber}`);
    return { success: true, bypass: true };

    /*
    // ✅ REAL IMPLEMENTATION - Uncomment when Digio backend is ready:
    
    try {
      const user = auth().currentUser;
      if (!user) throw new Error('No authenticated user');

      // Call your backend endpoint (Cloud Function or API server)
      const response = await fetch('YOUR_BACKEND_URL/api/verify-identity', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${await user.getIdToken()}` // Firebase auth token
        },
        body: JSON.stringify({
          accountId: user.uid,
          type: type,                    // 'aadhaar' or 'pan'
          documentNumber: documentNumber, // Aadhaar (12 digits) or PAN (ABCDE1234F)
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Verification failed');
      }

      // Expected response from backend:
      // {
      //   success: true,
      //   verificationId: 'xxx',
      //   status: 'approved' | 'rejected' | 'pending',
      //   verifiedName: 'John Doe',  // From Digio
      //   message: string
      // }
      
      if (result.status !== 'approved') {
        throw new Error(result.message || 'Verification not approved');
      }

      return result;
      
    } catch (error) {
      console.error('Digio verification error:', error);
      throw error;
    }
    */
  };

  /**
   * Handle verification submission
   */
  const handleVerify = async () => {
    try {
      // Validation: At least one document required
      if (!aadhaarNumber && !panNumber) {
        Toast.show({
          type: 'error',
          text1: 'Document Required',
          text2: 'Please enter Aadhaar or PAN number',
          visibilityTime: 3000,
        });
        return;
      }

      // Validate Aadhaar if provided
      if (aadhaarNumber && !validateAadhaar(aadhaarNumber)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid Aadhaar',
          text2: 'Aadhaar must be 12 digits',
          visibilityTime: 3000,
        });
        return;
      }

      // Validate PAN if provided
      if (panNumber && !validatePAN(panNumber)) {
        Toast.show({
          type: 'error',
          text1: 'Invalid PAN',
          text2: 'PAN format should be ABCDE1234F',
          visibilityTime: 3000,
        });
        return;
      }

      setLoading(true);

      // Verify Aadhaar if provided
      if (aadhaarNumber) {
        await verifyWithDigio('aadhaar', aadhaarNumber);
      }

      // Verify PAN if provided
      if (panNumber) {
        await verifyWithDigio('pan', panNumber);
      }

      setLoading(false);

      // Update signup step before navigating
      const user = auth().currentUser;
      if (user) {
        await firestore()
          .collection('accounts')
          .doc(user.uid)
          .update({
            signupStep: 'individual_bank_details',
          });
      }

      // If verification succeeds, navigate to bank details
      Toast.show({
        type: 'success',
        text1: 'Verification Complete',
        text2: 'Your identity has been verified',
        visibilityTime: 3000,
      });

      setTimeout(() => {
        navigation.navigate('IndividualBankDetails');
      }, 1000);

    } catch (error: any) {
      setLoading(false);
      console.error('Verification error:', error);
      
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.message || 'Unable to verify identity',
        visibilityTime: 4000,
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" translucent={true} />

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
        {/* Header - Only show when navigation history exists */}
        {canGoBack && (
          <View style={styles.header}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        )}

        {/* Content */}
        <View style={[styles.content, !canGoBack && styles.contentNoHeader]}>
          <Text style={styles.title}>Verify Your Identity</Text>
          <Text style={styles.subtitle}>
            Required for hosting events and receiving payouts
          </Text>

          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark" size={24} color="#2ECC71" />
            <View style={styles.infoBannerText}>
              <Text style={styles.infoBannerTitle}>Secure Verification</Text>
              <Text style={styles.infoBannerSubtitle}>
                We use Digio for secure identity verification. Your documents are never stored.
              </Text>
            </View>
          </View>

          {/* Aadhaar Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              Aadhaar Number <Text style={styles.optional}>(Recommended)</Text>
            </Text>
            <GlowInput
              iconName="card"
              value={aadhaarNumber}
              onChangeText={(text) => setAadhaarNumber(text.replace(/\D/g, ''))}
              placeholder="Enter 12-digit Aadhaar"
              placeholderTextColor="#7F93AA"
              keyboardType="numeric"
              maxLength={12}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {aadhaarNumber.length > 0 && !validateAadhaar(aadhaarNumber) && (
              <Text style={styles.errorText}>Aadhaar must be 12 digits</Text>
            )}
          </View>

          {/* OR Divider */}
          <View style={styles.orDivider}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>OR</Text>
            <View style={styles.orLine} />
          </View>

          {/* PAN Input */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              PAN Card <Text style={styles.optional}>(Alternative)</Text>
            </Text>
            <GlowInput
              iconName="card-outline"
              value={panNumber}
              onChangeText={(text) => setPanNumber(text.toUpperCase())}
              placeholder="Enter PAN (ABCDE1234F)"
              placeholderTextColor="#7F93AA"
              maxLength={10}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            {panNumber.length > 0 && !validatePAN(panNumber) && (
              <Text style={styles.errorText}>PAN format: ABCDE1234F</Text>
            )}
          </View>

          {/* Help Text */}
          <View style={styles.helpBox}>
            <Ionicons name="information-circle" size={20} color="#378BBB" />
            <Text style={styles.helpText}>
              You can provide Aadhaar, PAN, or both for faster approval
            </Text>
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            onPress={handleVerify}
            disabled={(!aadhaarNumber && !panNumber) || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={(!aadhaarNumber && !panNumber) || loading ? ['#1B2F48', '#1B2F48'] : ['#378BBB', '#4FC3F7']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={styles.verifyButton}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>Verify Identity</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1621',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 40,
    paddingBottom: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  contentNoHeader: {
    paddingTop: 60,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter_24pt-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#B8C7D9',
    marginBottom: 24,
    lineHeight: 24,
    fontFamily: 'Inter_24pt-Regular',
  },
  infoBanner: {
    flexDirection: 'row',
    backgroundColor: '#16283D',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233B57',
  },
  infoBannerText: {
    flex: 1,
    marginLeft: 12,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#2ECC71',
    marginBottom: 4,
    fontFamily: 'Inter_24pt-Bold',
  },
  infoBannerSubtitle: {
    fontSize: 13,
    color: '#B8C7D9',
    lineHeight: 18,
    fontFamily: 'Inter_24pt-Regular',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter_24pt-Bold',
  },
  optional: {
    fontSize: 13,
    fontWeight: '400',
    color: '#7F93AA',
    fontFamily: 'Inter_24pt-Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#233B57',
    borderRadius: 12,
    paddingHorizontal: 16,
    backgroundColor: '#1B2F48',
  },
  inputContainerFocused: {
    borderColor: '#378BBB',
    shadowColor: '#378BBB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter_24pt-Regular',
  },
  errorText: {
    fontSize: 13,
    color: '#FF4D6D',
    marginTop: 6,
    marginLeft: 4,
    fontFamily: 'Inter_24pt-Regular',
  },
  orDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#233B57',
  },
  orText: {
    fontSize: 14,
    color: '#7F93AA',
    marginHorizontal: 16,
    fontWeight: '600',
    fontFamily: 'Inter_24pt-Bold',
  },
  helpBox: {
    flexDirection: 'row',
    backgroundColor: '#16283D',
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#233B57',
  },
  helpText: {
    flex: 1,
    fontSize: 13,
    color: '#B8C7D9',
    marginLeft: 10,
    lineHeight: 18,
    fontFamily: 'Inter_24pt-Regular',
  },
  verifyButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#378BBB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  verifyButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_24pt-Bold',
  },
});

export default IndividualVerificationScreen;
