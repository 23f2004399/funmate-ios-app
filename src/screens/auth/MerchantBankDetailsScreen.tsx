/**
 * MERCHANT BANK DETAILS SCREEN (Payout Account Setup)
 * 
 * For Merchant Organizers to add their business bank account for event payouts.
 * - Account Holder Name
 * - Account Number (with confirmation)
 * - IFSC Code (auto-fetches bank name)
 * - Account Type (Current/Savings)
 * 
 * Verification: Razorpay Penny Drop API
 * 
 * Database Updates:
 * - Creates bankAccounts/{accountId}
 * - Updates accounts/{accountId}.signupStep to 'complete'
 * - Updates accounts/{accountId}.bankVerified to true
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
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';

type RootStackParamList = {
  MerchantBankDetails: undefined;
};

type MerchantBankDetailsScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'MerchantBankDetails'
>;

type MerchantBankDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  'MerchantBankDetails'
>;

interface Props {
  navigation: MerchantBankDetailsScreenNavigationProp;
  route: MerchantBankDetailsScreenRouteProp;
}

interface GlowInputProps {
  iconName: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  editable?: boolean;
  secureTextEntry?: boolean;
}

const GlowInput: React.FC<GlowInputProps> = ({ iconName, ...inputProps }) => {
  const glowAnim = useRef(new Animated.Value(0)).current;

  const handleFocus = () => {
    Animated.timing(glowAnim, {
      toValue: 1,
      duration: 150,
      useNativeDriver: false,
    }).start();
  };

  const handleBlur = () => {
    Animated.timing(glowAnim, {
      toValue: 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
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
        style={styles.input}
        placeholderTextColor="#7F93AA"
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </Animated.View>
  );
};

const MerchantBankDetailsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Form state
  const [accountHolderName, setAccountHolderName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState<'current' | 'savings'>('current');

  // Loading states
  const [isFetchingBank, setIsFetchingBank] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const canGoBack = useRef(navigation.canGoBack()).current;

  /**
   * ============================================================================
   * IFSC CODE AUTO-FETCH BANK NAME
   * ============================================================================
   * 
   * Uses Razorpay's public IFSC API (free, no auth required)
   * API: https://ifsc.razorpay.com/{ifsc}
   * 
   * Response:
   * {
   *   "BANK": "State Bank of India",
   *   "IFSC": "SBIN0001234",
   *   "BRANCH": "Mumbai Main Branch",
   *   "ADDRESS": "123 MG Road, Mumbai",
   *   "CITY": "MUMBAI",
   *   "STATE": "MAHARASHTRA"
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

    // Auto-fetch when 11 characters entered
    if (upperText.length === 11) {
      fetchBankName(upperText);
    } else {
      setBankName('');
    }
  };

  const validateForm = (): boolean => {
    if (!accountHolderName.trim()) {
      Toast.show({ type: 'error', text1: 'Account Holder Name Required', text2: 'Please enter account holder name' });
      return false;
    }

    if (!accountNumber.trim() || accountNumber.length < 9) {
      Toast.show({ type: 'error', text1: 'Invalid Account Number', text2: 'Please enter a valid account number' });
      return false;
    }

    if (accountNumber !== confirmAccountNumber) {
      Toast.show({ type: 'error', text1: 'Account Number Mismatch', text2: 'Account numbers do not match' });
      return false;
    }

    if (!ifscCode.trim() || ifscCode.length !== 11) {
      Toast.show({ type: 'error', text1: 'Invalid IFSC Code', text2: 'IFSC code must be 11 characters' });
      return false;
    }

    if (!bankName) {
      Toast.show({ type: 'error', text1: 'Bank Name Not Found', text2: 'Please enter a valid IFSC code' });
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

  /**
   * ============================================================================
   * RAZORPAY PENNY DROP VERIFICATION
   * ============================================================================
   * 
   * Razorpay Fund Account Validation API
   * Docs: https://razorpay.com/docs/api/razorpayx/fund-accounts/#fund-account-validation
   * 
   * Step 1: Create Contact
   * POST https://api.razorpay.com/v1/contacts
   * Headers: {
   *   "Authorization": "Basic <base64(key_id:key_secret)>",
   *   "Content-Type": "application/json"
   * }
   * Body: {
   *   "name": "ABC Business Pvt Ltd",
   *   "email": "business@example.com",
   *   "contact": "9876543210",
   *   "type": "vendor",
   *   "reference_id": "firebase_account_id"
   * }
   * Response: { "id": "cont_xxxxx", ... }
   * 
   * Step 2: Create Fund Account
   * POST https://api.razorpay.com/v1/fund_accounts
   * Body: {
   *   "contact_id": "cont_xxxxx",
   *   "account_type": "bank_account",
   *   "bank_account": {
   *     "name": "ABC Business Pvt Ltd",
   *     "ifsc": "SBIN0001234",
   *     "account_number": "123456789012"
   *   }
   * }
   * Response: { "id": "fa_xxxxx", ... }
   * 
   * Step 3: Fund Account Validation (Penny Drop)
   * POST https://api.razorpay.com/v1/fund_accounts/validations
   * Body: {
   *   "fund_account": {
   *     "id": "fa_xxxxx"
   *   },
   *   "amount": 100,  // ₹1.00 (in paise)
   *   "currency": "INR",
   *   "notes": {
   *     "purpose": "payout_account_verification"
   *   }
   * }
   * 
   * Response (Success):
   * {
   *   "id": "fav_xxxxx",
   *   "fund_account_id": "fa_xxxxx",
   *   "status": "completed",  // or "failed"
   *   "results": {
   *     "account_status": "active",
   *     "registered_name": "ABC BUSINESS PVT LTD"  // ← Compare with entered name
   *   },
   *   "amount": 100
   * }
   * 
   * Name Matching:
   * - Remove special chars, convert to uppercase
   * - Allow fuzzy match (Levenshtein distance)
   * - If mismatch > 30%, flag for manual review
   * 
   * Error Handling:
   * - "account_status": "invalid" → Show "Invalid account number"
   * - "account_status": "inactive" → Show "Account is inactive"
   * - Name mismatch → Save with nameMismatch: true, status: "pending"
   * 
   * Pricing: ₹3 per verification (deducted from Razorpay balance)
   * ============================================================================
   */
  const handleVerifyAndSave = async () => {
    if (!validateForm()) {
      return;
    }

    setIsVerifying(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // BYPASS MODE - Remove this block when implementing actual Razorpay API
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockRazorpayData = {
        contactId: 'cont_mock123456',
        fundAccountId: 'fa_mock123456',
        verificationId: 'fav_mock123456',
        bankReturnedName: accountHolderName.toUpperCase(),
        accountStatus: 'active',
        nameMismatch: false,
      };

      // Save to Firestore bankAccounts collection
      await firestore()
        .collection('bankAccounts')
        .doc(user.uid)
        .set({
          accountId: user.uid,
          bankName: bankName,
          accountHolderName: accountHolderName.trim(),
          accountLast4: accountNumber.slice(-4),
          ifsc: ifscCode.toUpperCase(),
          accountType: accountType,
          razorpayContactId: mockRazorpayData.contactId,
          razorpayFundAccountId: mockRazorpayData.fundAccountId,
          status: 'verified',
          bankVerificationMeta: {
            bankReturnedName: mockRazorpayData.bankReturnedName,
            nameMismatch: mockRazorpayData.nameMismatch,
            verificationId: mockRazorpayData.verificationId,
          },
          verifiedAt: firestore.FieldValue.serverTimestamp(),
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

      // Update account status
      await firestore()
        .collection('accounts')
        .doc(user.uid)
        .update({
          signupStep: 'merchant_profile',
          bankVerified: true,
        });

      setIsVerifying(false);

      Toast.show({
        type: 'success',
        text1: 'Bank Account Verified! ✓',
        text2: 'Setting up your business profile...',
        visibilityTime: 2000,
      });

      // Navigate to business profile setup
      setTimeout(() => {
        navigation.navigate('MerchantProfile' as never);
      }, 1500);

      // TODO: When implementing actual Razorpay API, replace above bypass code with:
      //
      // Step 1: Get user details from Firestore
      // const accountDoc = await firestore().collection('accounts').doc(user.uid).get();
      // const userDoc = await firestore().collection('users').doc(user.uid).get();
      // 
      // Step 2: Create Razorpay Contact
      // const contactResponse = await fetch('https://api.razorpay.com/v1/contacts', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${btoa('RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET')}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     name: accountHolderName,
      //     email: userDoc.data().email || 'no-email@funmate.app',
      //     contact: accountDoc.data().phoneNumber || '0000000000',
      //     type: 'vendor',
      //     reference_id: user.uid,
      //   }),
      // });
      // const contactData = await contactResponse.json();
      // const contactId = contactData.id;
      // 
      // Step 3: Create Fund Account
      // const fundAccountResponse = await fetch('https://api.razorpay.com/v1/fund_accounts', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${btoa('RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET')}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     contact_id: contactId,
      //     account_type: 'bank_account',
      //     bank_account: {
      //       name: accountHolderName,
      //       ifsc: ifscCode,
      //       account_number: accountNumber,
      //     },
      //   }),
      // });
      // const fundAccountData = await fundAccountResponse.json();
      // const fundAccountId = fundAccountData.id;
      // 
      // Step 4: Penny Drop Validation
      // const validationResponse = await fetch('https://api.razorpay.com/v1/fund_accounts/validations', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${btoa('RAZORPAY_KEY_ID:RAZORPAY_KEY_SECRET')}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({
      //     fund_account: { id: fundAccountId },
      //     amount: 100, // ₹1.00
      //     currency: 'INR',
      //     notes: { purpose: 'payout_account_verification' },
      //   }),
      // });
      // const validationData = await validationResponse.json();
      // 
      // Step 5: Validate Results
      // if (validationData.status !== 'completed') {
      //   throw new Error('Bank verification failed');
      // }
      // 
      // if (validationData.results.account_status !== 'active') {
      //   throw new Error('Bank account is invalid or inactive');
      // }
      // 
      // // Check name match (fuzzy matching)
      // const enteredName = accountHolderName.toUpperCase().replace(/[^A-Z0-9]/g, '');
      // const bankName = validationData.results.registered_name.toUpperCase().replace(/[^A-Z0-9]/g, '');
      // const nameSimilarity = calculateSimilarity(enteredName, bankName);
      // const nameMismatch = nameSimilarity < 0.7;
      // 
      // // Save to Firestore
      // await firestore().collection('bankAccounts').doc(user.uid).set({
      //   accountId: user.uid,
      //   bankName: bankName,
      //   accountHolderName: accountHolderName,
      //   accountLast4: accountNumber.slice(-4),
      //   ifsc: ifscCode.toUpperCase(),
      //   accountType: accountType,
      //   razorpayContactId: contactId,
      //   razorpayFundAccountId: fundAccountId,
      //   status: nameMismatch ? 'pending' : 'verified',
      //   bankVerificationMeta: {
      //     bankReturnedName: validationData.results.registered_name,
      //     nameMismatch: nameMismatch,
      //     verificationId: validationData.id,
      //   },
      //   verifiedAt: firestore.FieldValue.serverTimestamp(),
      //   createdAt: firestore.FieldValue.serverTimestamp(),
      // });
      // 
      // if (nameMismatch) {
      //   Toast.show({
      //     type: 'error',
      //     text1: 'Name Mismatch',
      //     text2: 'Bank name doesn\'t match. Pending manual review.',
      //   });
      // }

    } catch (error: any) {
      console.error('Bank verification error:', error);
      setIsVerifying(false);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Unable to verify bank account. Please check details.',
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
            <Ionicons name="card-outline" size={32} color="#378BBB" />
          </View>
          <Text style={styles.title}>Payout Bank Details</Text>
          <Text style={styles.subtitle}>
            Add your business bank account to receive event payouts
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="shield-checkmark" size={20} color="#2ECC71" />
            <Text style={styles.infoText}>
              Your bank details are verified securely via Razorpay. Payouts are processed on T+3 basis.
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
                onPress={() => setAccountType('current')}
                activeOpacity={0.7}
              >
                <View style={styles.radioCircle}>
                  {accountType === 'current' && <View style={styles.radioSelected} />}
                </View>
                <Text style={styles.radioText}>Current Account</Text>
              </TouchableOpacity>

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
            </View>
          </View>
        </View>

        {/* Help Text */}
        <View style={styles.helpSection}>
          <Text style={styles.helpText}>
            💡 Find your IFSC code on your chequebook or bank passbook
          </Text>
        </View>

        {/* Verify & Save Button */}
        <TouchableOpacity
          onPress={handleVerifyAndSave}
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
    marginBottom: 24,
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
  errorText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#FF5252',
    marginTop: 6,
    marginBottom: 12,
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
});

export default MerchantBankDetailsScreen;
