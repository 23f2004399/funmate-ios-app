import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Animated,
  ActivityIndicator,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import Toast from 'react-native-toast-message';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

type RootStackParamList = {
  IndividualBankDetails: undefined;
  IndividualHostProfile: undefined;
};

type IndividualBankDetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'IndividualBankDetails'
>;

type IndividualBankDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  'IndividualBankDetails'
>;

interface Props {
  navigation: IndividualBankDetailsScreenNavigationProp;
  route: IndividualBankDetailsScreenRouteProp;
}

interface GlowInputProps {
  iconName: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  style?: any;
  onFocus?: (e: any) => void;
  onBlur?: (e: any) => void;
}

const GlowInput: React.FC<GlowInputProps> = ({
  iconName,
  style,
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
    <Animated.View style={[styles.inputContainer, { borderColor }]}>
      <Ionicons
        name={iconName as any}
        size={20}
        color="#7F93AA"
        style={styles.inputIcon}
      />
      <TextInput
        {...inputProps}
        style={[styles.input, style]}
        placeholderTextColor="#7F93AA"
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </Animated.View>
  );
};

const IndividualBankDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState<'savings' | 'current'>('savings');
  const [isFetchingBank, setIsFetchingBank] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const canGoBack = useRef(navigation.canGoBack()).current;

  /**
   * IFSC Auto-Fetch using Razorpay's Free Public API
   * API: https://ifsc.razorpay.com/{ifsc}
   * 
   * Example Response:
   * {
   *   "BANK": "State Bank of India",
   *   "IFSC": "SBIN0001234",
   *   "BRANCH": "New Delhi Main Branch",
   *   "ADDRESS": "...",
   *   "CITY": "NEW DELHI",
   *   "DISTRICT": "NEW DELHI",
   *   "STATE": "DELHI"
   * }
   * 
   * Error: 404 if IFSC not found
   */
  const fetchBankName = async (ifsc: string) => {
    if (ifsc.length !== 11) {
      setBankName('');
      return;
    }

    setIsFetchingBank(true);

    try {
      const response = await fetch(`https://ifsc.razorpay.com/${ifsc}`);
      
      if (!response.ok) {
        throw new Error('Invalid IFSC code');
      }

      const data = await response.json() as { BANK?: string; IFSC?: string; BRANCH?: string };
      setBankName(data.BANK || 'Unknown Bank');
      setIsFetchingBank(false);
    } catch (error: any) {
      console.error('IFSC fetch error:', error);
      setBankName('');
      setIsFetchingBank(false);
      Toast.show({
        type: 'error',
        text1: 'Invalid IFSC Code',
        text2: 'Please check and enter a valid IFSC code',
      });
    }
  };

  const handleIfscChange = (text: string) => {
    const upperText = text.toUpperCase();
    setIfscCode(upperText);
    
    if (upperText.length === 11) {
      fetchBankName(upperText);
    } else {
      setBankName('');
    }
  };

  const validateForm = (): boolean => {
    if (!accountHolderName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Account Holder Name Required',
        text2: 'Please enter the account holder name',
        visibilityTime: 2000,
      });
      return false;
    }

    if (!accountNumber.trim() || accountNumber.length < 9) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Account Number',
        text2: 'Account number must be at least 9 digits',
        visibilityTime: 2000,
      });
      return false;
    }

    if (accountNumber !== confirmAccountNumber) {
      Toast.show({
        type: 'error',
        text1: 'Account Number Mismatch',
        text2: 'Please ensure both account numbers match',
        visibilityTime: 2000,
      });
      return false;
    }

    if (!ifscCode.trim() || ifscCode.length !== 11) {
      Toast.show({
        type: 'error',
        text1: 'Invalid IFSC Code',
        text2: 'IFSC code must be 11 characters',
        visibilityTime: 2000,
      });
      return false;
    }

    if (!bankName) {
      Toast.show({
        type: 'error',
        text1: 'Bank Name Not Found',
        text2: 'Please enter a valid IFSC code to fetch bank name',
        visibilityTime: 2000,
      });
      return false;
    }

    return true;
  };

  const isFormComplete = (): boolean => {
    return (
      accountHolderName.trim().length > 0 &&
      accountNumber.trim().length >= 9 &&
      confirmAccountNumber.trim().length >= 9 &&
      accountNumber === confirmAccountNumber &&
      ifscCode.trim().length === 11 &&
      bankName.trim().length > 0
    );
  };

  const verifyBankAccount = async () => {
    if (!validateForm()) {
      return;
    }

    setIsVerifying(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Call Razorpay verification API
      const verificationResult = await verifyWithRazorpay(
        accountHolderName,
        accountNumber,
        ifscCode
      );

      if (verificationResult.success) {
        // Store bank details in Firestore
        await saveBankDetails(user.uid, verificationResult);

        // Update signup step before navigation
        await firestore().collection('accounts').doc(user.uid).update({
          signupStep: 'individual_host_profile',
        });

        Toast.show({
          type: 'success',
          text1: 'Bank Account Verified ✓',
          text2: 'Moving to profile setup...',
          visibilityTime: 2000,
        });

        setTimeout(() => {
          navigation.navigate('IndividualHostProfile');
        }, 1500);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Verification Failed',
          text2: verificationResult.reason || 'Unable to verify bank account',
          visibilityTime: 3000,
        });
      }
    } catch (error: any) {
      console.error('Bank verification error:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Error',
        text2: 'Please check your connection and try again',
        visibilityTime: 3000,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const verifyWithRazorpay = async (
    holderName: string,
    accNum: string,
    ifsc: string
  ): Promise<{
    success: boolean;
    bypass?: boolean;
    bankReturnedName?: string;
    nameMismatch?: boolean;
    verificationId?: string;
    contactId?: string;
    fundAccountId?: string;
    reason?: string;
  }> => {
    // ========================================
    // BYPASS MODE (No actual verification)
    // ========================================
    console.log('[BYPASS] Skipping Razorpay bank verification');
    console.log('[BYPASS] Account Holder:', holderName);
    console.log('[BYPASS] Account Number:', accNum);
    console.log('[BYPASS] IFSC:', ifsc);
    console.log('[BYPASS] Bank:', bankName);

    return {
      success: true,
      bypass: true,
      bankReturnedName: holderName, // In bypass mode, assume name matches
      nameMismatch: false,
      contactId: 'cont_mock123456',
      fundAccountId: 'fa_mock123456',
      verificationId: 'fav_mock123456',
    };

    // ========================================
    // RAZORPAY INTEGRATION GUIDE
    // ========================================
    //
    // ⚠️ SECURITY: NEVER call Razorpay API from frontend!
    // Always use a secure backend (Cloud Function or Express server)
    //
    // ========================================
    // BACKEND SETUP REQUIRED
    // ========================================
    //
    // 1. Create Cloud Function or Express endpoint:
    //    POST /api/verify-bank-account
    //
    // 2. Environment Variables Needed:
    //    - RAZORPAY_KEY_ID (from Razorpay Dashboard)
    //    - RAZORPAY_KEY_SECRET (from Razorpay Dashboard)
    //
    // 3. Install Razorpay SDK (backend):
    //    npm install razorpay
    //
    // ========================================
    // RAZORPAY FUND ACCOUNT VALIDATION API
    // ========================================
    //
    // Razorpay API Endpoint:
    // POST https://api.razorpay.com/v1/fund_accounts/validations
    //
    // What it does:
    // - Deposits ₹1 to the account (instant reversal)
    // - Verifies account is active
    // - Returns bank's official account holder name
    // - Validates IFSC code
    //
    // Backend Implementation:
    // ```javascript
    // const Razorpay = require('razorpay');
    //
    // const razorpay = new Razorpay({
    //   key_id: process.env.RAZORPAY_KEY_ID,
    //   key_secret: process.env.RAZORPAY_KEY_SECRET
    // });
    //
    // // Step 1: Create Fund Account
    // const fundAccount = await razorpay.fundAccount.create({
    //   contact_id: contactId, // Create contact first if needed
    //   account_type: "bank_account",
    //   bank_account: {
    //     name: accountHolderName,
    //     ifsc: ifscCode,
    //     account_number: accountNumber
    //   }
    // });
    //
    // // Step 2: Validate Fund Account (Penny Drop)
    // const validation = await razorpay.fundAccount.fetch(fundAccount.id).validate({
    //   amount: 100, // ₹1.00 in paise
    //   currency: "INR",
    //   notes: {
    //     userId: userId,
    //     purpose: "bank_verification"
    //   }
    // });
    //
    // // Response format:
    // {
    //   "id": "fav_xxxxxxxxxxxxx",
    //   "fund_account": {
    //     "id": "fa_xxxxxxxxxxxxx",
    //     "account_type": "bank_account",
    //     "bank_account": {
    //       "ifsc": "SBIN0001234",
    //       "bank_name": "State Bank of India",
    //       "name": "Rahul Sharma", // ← Bank's official name
    //       "account_number": "XXXXXXXXXXXX1234" // Last 4 digits
    //     }
    //   },
    //   "status": "completed", // or "failed"
    //   "results": {
    //     "account_status": "active", // or "invalid"
    //     "registered_name": "Rahul Sharma" // ← Use this for comparison
    //   },
    //   "created_at": 1234567890
    // }
    // ```
    //
    // ========================================
    // NAME MATCHING LOGIC (Handle Mismatches)
    // ========================================
    //
    // User enters: "Rahul S."
    // Bank returns: "Rahul Sharma"
    //
    // Implement fuzzy matching in backend:
    // ```javascript
    // function namesMatch(userInput, bankName) {
    //   // Normalize: lowercase, remove extra spaces, remove dots
    //   const normalize = (str) => str.toLowerCase().replace(/\./g, '').replace(/\s+/g, ' ').trim();
    //   
    //   const input = normalize(userInput);
    //   const bank = normalize(bankName);
    //   
    //   // Exact match
    //   if (input === bank) return { match: true, method: 'exact' };
    //   
    //   // Check if input is substring of bank name (e.g., "Rahul S" in "Rahul Sharma")
    //   if (bank.includes(input)) return { match: true, method: 'partial' };
    //   
    //   // Check if bank name starts with input (common for abbreviated names)
    //   if (bank.startsWith(input)) return { match: true, method: 'prefix' };
    //   
    //   // Use Levenshtein distance for typos (optional)
    //   // const distance = levenshteinDistance(input, bank);
    //   // if (distance <= 3) return { match: true, method: 'fuzzy' };
    //   
    //   return { match: false };
    // }
    // ```
    //
    // ========================================
    // FRONTEND IMPLEMENTATION
    // ========================================
    //
    // Uncomment this code when backend is ready:
    //
    // try {
    //   const user = auth().currentUser;
    //   if (!user) throw new Error('User not authenticated');
    //
    //   const idToken = await user.getIdToken();
    //
    //   const response = await fetch('YOUR_BACKEND_URL/api/verify-bank-account', {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${idToken}`,
    //     },
    //     body: JSON.stringify({
    //       accountHolderName: holderName,
    //       accountNumber: accNum,
    //       ifscCode: ifsc,
    //       bankName: bankName,
    //     }),
    //   });
    //
    //   if (!response.ok) {
    //     const errorData = await response.json();
    //     throw new Error(errorData.message || 'Verification failed');
    //   }
    //
    //   const data = await response.json();
    //
    //   // Expected response format:
    //   // {
    //   //   success: true,
    //   //   bankReturnedName: "Rahul Sharma",
    //   //   nameMismatch: false, // true if fuzzy match failed
    //   //   verificationId: "fav_xxxxxxxxxxxxx",
    //   //   accountStatus: "active"
    //   // }
    //
    //   return data;
    //
    // } catch (error) {
    //   console.error('Razorpay verification error:', error);
    //   throw error;
    // }
    //
    // ========================================
    // BACKEND RESPONSIBILITIES
    // ========================================
    //
    // Your backend should:
    // 1. Call Razorpay Fund Account Validation API
    // 2. Perform name matching logic
    // 3. Store verification result in Firestore
    // 4. Update account status (bankVerified: true)
    // 5. Return verification result to frontend
    //
    // ========================================
    // FIRESTORE SCHEMA
    // ========================================
    //
    // bankAccounts/{accountId}:
    // {
    //   accountId: user.uid,
    //   bankName: "State Bank of India",
    //   accountHolderName: "Rahul S.", // What user entered
    //   accountLast4: "1234", // Last 4 digits only
    //   ifsc: "SBIN0001234",
    //   
    //   status: "verified", // or "pending" | "rejected"
    //   
    //   bankVerificationMeta: {
    //     bankReturnedName: "Rahul Sharma", // What Razorpay returned
    //     nameMismatch: false, // If fuzzy match failed
    //     verificationId: "fav_xxxxxxxxxxxxx" // Razorpay verification ID
    //   },
    //   
    //   verifiedAt: Timestamp,
    //   createdAt: Timestamp
    // }
    //
    // accounts/{accountId}:
    // {
    //   bankVerified: true, // Update this after successful verification
    //   ...other fields
    // }
    //
    // ========================================
    // ERROR HANDLING
    // ========================================
    //
    // Common errors:
    // - Invalid IFSC code → "IFSC code not found"
    // - Account number invalid → "Account does not exist"
    // - Name mismatch (too different) → "Name does not match bank records"
    // - Bank API down → "Verification service unavailable"
    //
    // Backend should return:
    // {
    //   success: false,
    //   reason: "Name mismatch: You entered 'XYZ' but bank has 'ABC'"
    // }
  };

  const saveBankDetails = async (
    accountId: string,
    verificationResult: any
  ) => {
    const accountLast4 = accountNumber.slice(-4);

    const bankData = {
      accountId,
      bankName,
      accountHolderName,
      accountLast4,
      ifsc: ifscCode.toUpperCase(),
      accountType,
      razorpayContactId: verificationResult.bypass ? verificationResult.contactId : verificationResult.contactId || null,
      razorpayFundAccountId: verificationResult.bypass ? verificationResult.fundAccountId : verificationResult.fundAccountId || null,
      status: verificationResult.bypass ? 'pending' : 'verified',
      bankVerificationMeta: verificationResult.bypass
        ? null
        : {
            bankReturnedName: verificationResult.bankReturnedName || null,
            nameMismatch: verificationResult.nameMismatch || false,
            verificationId: verificationResult.verificationId || null,
          },
      verifiedAt: verificationResult.bypass
        ? null
        : firestore.FieldValue.serverTimestamp(),
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    // Store in bankAccounts collection
    await firestore().collection('bankAccounts').doc(accountId).set(bankData);

    // Update accounts collection
    await firestore().collection('accounts').doc(accountId).update({
      bankVerified: verificationResult.bypass ? false : true,
    });

    console.log('Bank details saved to Firestore');
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
            <Ionicons name="card-outline" size={32} color="#378BBB" />
          </View>
          <Text style={styles.title}>Payout Bank Details</Text>
          <Text style={styles.subtitle}>
            Enter your bank details to receive event payouts
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color="#2ECC71" />
            <Text style={styles.infoText}>
              Your account will be verified securely
            </Text>
          </View>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <GlowInput
            iconName="person-outline"
            placeholder="Account Holder Name"
            value={accountHolderName}
            onChangeText={setAccountHolderName}
            autoCapitalize="words"
          />

          <GlowInput
            iconName="card-outline"
            placeholder="Account Number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            keyboardType="numeric"
            maxLength={18}
          />

          <GlowInput
            iconName="card-outline"
            placeholder="Confirm Account Number"
            value={confirmAccountNumber}
            onChangeText={setConfirmAccountNumber}
            keyboardType="numeric"
            maxLength={18}
          />
          {confirmAccountNumber && accountNumber !== confirmAccountNumber && (
            <Text style={styles.errorText}>Account numbers do not match</Text>
          )}

          <GlowInput
            iconName="git-branch-outline"
            placeholder="IFSC Code (e.g., SBIN0001234)"
            value={ifscCode}
            onChangeText={handleIfscChange}
            autoCapitalize="characters"
            maxLength={11}
          />

          {/* Bank Name - Auto-filled & Disabled */}
          <View style={styles.bankNameContainer}>
            <View style={[styles.inputContainer, { borderColor: '#233B57' }]} pointerEvents="none">
              <Ionicons
                name="business-outline"
                size={20}
                color="#7F93AA"
                style={styles.inputIcon}
              />
              <TextInput
                placeholder="Bank Name (Auto-filled)"
                value={bankName}
                editable={false}
                style={[styles.input, styles.disabledInput]}
                placeholderTextColor="#7F93AA"
              />
            </View>
            {isFetchingBank && (
              <View style={styles.fetchingIndicator}>
                <ActivityIndicator size="small" color="#378BBB" />
              </View>
            )}
          </View>

          {/* Account Type Radio Buttons */}
          <View style={styles.accountTypeSection}>
            <Text style={styles.accountTypeLabel}>Account Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setAccountType('savings')}
                activeOpacity={0.7}
              >
                <View style={styles.radioCircle}>
                  {accountType === 'savings' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioText}>Savings Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setAccountType('current')}
                activeOpacity={0.7}
              >
                <View style={styles.radioCircle}>
                  {accountType === 'current' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioText}>Current Account</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            💡 Find your IFSC code on your chequebook or bank passbook
          </Text>
        </View>

        {/* Verify Button */}
        <TouchableOpacity
          onPress={verifyBankAccount}
          disabled={!isFormComplete() || isVerifying}
          activeOpacity={0.8}
          style={styles.verifyButtonContainer}
        >
          <LinearGradient
            colors={
              isFormComplete() && !isVerifying
                ? ['#378BBB', '#4FC3F7']
                : ['#1B2F48', '#1B2F48']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.verifyButton}
          >
            {isVerifying ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.verifyButtonText}>Verify & Save</Text>
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
  infoCard: {
    backgroundColor: '#16283D',
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#233B57',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#B8C7D9',
    marginLeft: 12,
  },
  formSection: {
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    marginBottom: 16,
    height: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  helpSection: {
    backgroundColor: 'rgba(55, 139, 187, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
  },
  helpText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    lineHeight: 20,
  },
  verifyButtonContainer: {
    marginBottom: 40,
  },
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  verifyButtonText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  bankNameContainer: {
    position: 'relative',
  },
  disabledInput: {
    color: '#7F93AA',
  },
  fetchingIndicator: {
    position: 'absolute',
    right: 16,
    top: 18,
  },
  accountTypeSection: {
    marginTop: 8,
  },
  accountTypeLabel: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#B8C7D9',
    marginBottom: 12,
  },
  radioGroup: {
    flexDirection: 'row',
    gap: 16,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#233B57',
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#378BBB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  radioSelected: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#378BBB',
  },
  radioText: {
    fontSize: 14,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    flex: 1,
  },
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#FF5252',
    marginTop: 6,
    marginBottom: 12,
  },
});

export default IndividualBankDetailsScreen;
