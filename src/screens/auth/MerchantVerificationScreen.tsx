/**
 * MERCHANT VERIFICATION SCREEN (Business Verification)
 * 
 * For Merchant Organizers to verify their business credentials:
 * - GST Number verification
 * - PAN Number verification
 * - Business License upload and verification
 * 
 * All verifications use Digio API (https://www.digio.in/)
 * 
 * Database Updates:
 * - Creates/updates merchantVerification/{accountId}
 * - Updates accounts/{accountId}.signupStep to 'merchant_bank_details'
 * 
 * Next: MerchantBankDetailsScreen (bank account for business payouts)
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
  Platform,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { launchImageLibrary } from 'react-native-image-picker';
import Toast from 'react-native-toast-message';

type RootStackParamList = {
  MerchantVerification: undefined;
  MerchantBankDetails: undefined;
};

type MerchantVerificationScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'MerchantVerification'
>;

type MerchantVerificationScreenRouteProp = RouteProp<
  RootStackParamList,
  'MerchantVerification'
>;

interface Props {
  navigation: MerchantVerificationScreenNavigationProp;
  route: MerchantVerificationScreenRouteProp;
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

const MerchantVerificationScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Form state
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseFile, setLicenseFile] = useState<any>(null);
  
  // Verification states
  const [gstVerified, setGstVerified] = useState(false);
  const [panVerified, setPanVerified] = useState(false);
  const [licenseVerified, setLicenseVerified] = useState(false);
  
  // Loading states
  const [isVerifyingGST, setIsVerifyingGST] = useState(false);
  const [isVerifyingPAN, setIsVerifyingPAN] = useState(false);
  const [isVerifyingLicense, setIsVerifyingLicense] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canGoBack = useRef(navigation.canGoBack()).current;

  /**
   * ============================================================================
   * DIGIO API INTEGRATION GUIDE - GST VERIFICATION
   * ============================================================================
   * 
   * API Endpoint: POST https://api.digio.in/v2/client/kyc/gstin
   * 
   * Request Headers:
   * {
   *   "Authorization": "Basic <base64_encoded_credentials>",
   *   "Content-Type": "application/json"
   * }
   * 
   * Request Body:
   * {
   *   "gstin": "22AAAAA0000A1Z5" // 15-character GST number
   * }
   * 
   * Success Response (200):
   * {
   *   "id": "KID2212161234567890",
   *   "gstin": "22AAAAA0000A1Z5",
   *   "legal_name": "ABC PRIVATE LIMITED",
   *   "trade_name": "ABC Industries",
   *   "constitution_of_business": "Private Limited Company",
   *   "taxpayer_type": "Regular",
   *   "gstin_status": "Active",
   *   "date_of_registration": "01/07/2017",
   *   "principal_place_of_business": {
   *     "address": "123 Main Street",
   *     "city": "Mumbai",
   *     "state": "Maharashtra",
   *     "pincode": "400001"
   *   }
   * }
   * 
   * Error Response (400/404):
   * {
   *   "error": {
   *     "code": "INVALID_GSTIN",
   *     "message": "Invalid GST number provided"
   *   }
   * }
   * 
   * Implementation:
   * 1. Validate GST format: 2 digits (state code) + 10 chars (PAN) + 1 digit + 1 letter + 1 letter/digit
   * 2. Call Digio API with GST number
   * 3. Verify gstin_status === "Active"
   * 4. Store legal_name, trade_name, address in Firestore
   * 5. Set gstVerified = true
   * 
   * Error Handling:
   * - INVALID_GSTIN → Show "Invalid GST number"
   * - GSTIN_CANCELLED → Show "This GST number has been cancelled"
   * - Network errors → Show "Verification failed. Check your connection"
   * 
   * Pricing: Check Digio's KYC pricing page (typically ₹2-5 per verification)
   * ============================================================================
   */
  const verifyGST = async () => {
    if (!validateGST(gstNumber)) {
      Toast.show({ type: 'error', text1: 'Invalid GST', text2: 'Please enter a valid 15-character GST number' });
      return;
    }

    setIsVerifyingGST(true);

    try {
      // BYPASS MODE - Remove this block when implementing actual Digio API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockGSTData = {
        legal_name: 'SAMPLE BUSINESS PVT LTD',
        trade_name: 'Sample Business',
        gstin_status: 'Active',
        state: 'Maharashtra',
      };

      setGstVerified(true);
      setIsVerifyingGST(false);

      Toast.show({
        type: 'success',
        text1: 'GST Verified ✓',
        text2: `${mockGSTData.legal_name} (${mockGSTData.gstin_status})`,
        visibilityTime: 3000,
      });

      // TODO: Replace above bypass code with actual Digio API call:
      // const response = await fetch('https://api.digio.in/v2/client/kyc/gstin', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${base64Credentials}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ gstin: gstNumber }),
      // });
      // 
      // const data = await response.json();
      // 
      // if (!response.ok) {
      //   throw new Error(data.error?.message || 'GST verification failed');
      // }
      // 
      // if (data.gstin_status !== 'Active') {
      //   throw new Error('GST number is not active');
      // }
      // 
      // setGstVerified(true);
      // // Store data.legal_name, data.trade_name, data.principal_place_of_business
      
    } catch (error: any) {
      console.error('GST verification error:', error);
      setIsVerifyingGST(false);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Failed to verify GST number. Please try again.',
        visibilityTime: 4000,
      });
    }
  };

  /**
   * ============================================================================
   * DIGIO API INTEGRATION GUIDE - PAN VERIFICATION
   * ============================================================================
   * 
   * API Endpoint: POST https://api.digio.in/v2/client/kyc/pan
   * 
   * Request Headers:
   * {
   *   "Authorization": "Basic <base64_encoded_credentials>",
   *   "Content-Type": "application/json"
   * }
   * 
   * Request Body:
   * {
   *   "pan": "AAAAA9999A" // 10-character PAN
   * }
   * 
   * Success Response (200):
   * {
   *   "id": "KID2212161234567891",
   *   "pan": "AAAAA9999A",
   *   "full_name": "ABC PRIVATE LIMITED",
   *   "category": "Company",
   *   "pan_status": "Valid",
   *   "last_updated": "2023-12-15"
   * }
   * 
   * Error Response (400/404):
   * {
   *   "error": {
   *     "code": "INVALID_PAN",
   *     "message": "PAN not found in records"
   *   }
   * }
   * 
   * Implementation:
   * 1. Validate PAN format: 5 letters + 4 digits + 1 letter (4th char should be P for company)
   * 2. Call Digio API with PAN
   * 3. Verify pan_status === "Valid"
   * 4. Verify category === "Company" or relevant business type
   * 5. Cross-check full_name with GST legal_name (should match)
   * 6. Store PAN details in Firestore
   * 7. Set panVerified = true
   * 
   * Name Matching Logic:
   * - Compare PAN full_name with GST legal_name
   * - Allow minor variations (Pvt vs Private, Ltd vs Limited)
   * - If mismatch > 20%, show warning and ask for confirmation
   * 
   * Error Handling:
   * - INVALID_PAN → Show "PAN not found or invalid"
   * - PAN_INACTIVE → Show "This PAN is inactive"
   * - NAME_MISMATCH → Show warning dialog for manual review
   * 
   * Pricing: ₹2-5 per verification
   * ============================================================================
   */
  const verifyPAN = async () => {
    if (!validatePAN(panNumber)) {
      Toast.show({ type: 'error', text1: 'Invalid PAN', text2: 'Please enter a valid 10-character PAN' });
      return;
    }

    if (!gstVerified) {
      Toast.show({ type: 'error', text1: 'GST Required', text2: 'Please verify GST number first' });
      return;
    }

    setIsVerifyingPAN(true);

    try {
      // BYPASS MODE - Remove this block when implementing actual Digio API
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const mockPANData = {
        full_name: 'SAMPLE BUSINESS PVT LTD',
        category: 'Company',
        pan_status: 'Valid',
      };

      setPanVerified(true);
      setIsVerifyingPAN(false);

      Toast.show({
        type: 'success',
        text1: 'PAN Verified ✓',
        text2: `${mockPANData.full_name} (${mockPANData.category})`,
        visibilityTime: 3000,
      });

      // TODO: Replace above bypass code with actual Digio API call:
      // const response = await fetch('https://api.digio.in/v2/client/kyc/pan', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${base64Credentials}`,
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ pan: panNumber }),
      // });
      // 
      // const data = await response.json();
      // 
      // if (!response.ok) {
      //   throw new Error(data.error?.message || 'PAN verification failed');
      // }
      // 
      // if (data.pan_status !== 'Valid') {
      //   throw new Error('PAN is not valid or active');
      // }
      // 
      // if (data.category !== 'Company') {
      //   Alert.alert('Warning', 'PAN category is not Company. Please verify.');
      // }
      // 
      // // Cross-check name with GST legal_name
      // const nameSimilarity = calculateSimilarity(data.full_name, gstLegalName);
      // if (nameSimilarity < 0.8) {
      //   Alert.alert(
      //     'Name Mismatch',
      //     `PAN Name: ${data.full_name}\nGST Name: ${gstLegalName}\n\nPlease verify documents.`,
      //     [
      //       { text: 'Cancel', style: 'cancel' },
      //       { text: 'Proceed Anyway', onPress: () => setPanVerified(true) }
      //     ]
      //   );
      // } else {
      //   setPanVerified(true);
      // }
      
    } catch (error: any) {
      console.error('PAN verification error:', error);
      setIsVerifyingPAN(false);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Failed to verify PAN. Please try again.',
        visibilityTime: 4000,
      });
    }
  };

  /**
   * ============================================================================
   * DIGIO API INTEGRATION GUIDE - BUSINESS LICENSE VERIFICATION
   * ============================================================================
   * 
   * SECURITY STRATEGY: Secure Storage with Compliance (Option 1)
   * - Store in Firebase Storage with strict access rules (see storage.rules)
   * - Only merchant owner + admins can access documents
   * - 7-year retention for KYC/AML compliance (RBI guidelines)
   * - Automatic encryption at rest + signed URLs for access
   * - See MERCHANT_DOCUMENT_SECURITY.md for complete security guide
   * 
   * For Business License, use react-native-image-picker + Digio OCR:
   * 
   * Step 1: Capture/Select License Photo
   * - Use launchCamera() or launchImageLibrary() from react-native-image-picker
   * - Merchants can photograph their physical business license
   * - Or select an existing photo from gallery
   * 
   * Step 2: Upload to Firebase Storage (SECURE)
   * const user = auth().currentUser;
   * const fileName = `license_${Date.now()}.jpg`;
   * const filePath = `merchantDocuments/${user.uid}/${fileName}`;
   * const reference = storage().ref(filePath);
   * await reference.putFile(imageUri);
   * const downloadURL = await reference.getDownloadURL(); // Signed URL with token
   * 
   * IMPORTANT: downloadURL contains access token - DO NOT log or expose publicly
   * Storage Rules ensure only merchant owner + admins can access this file
   * 
   * Step 3: Send to Digio API for OCR Extraction
   * API Endpoint: POST https://api.digio.in/v2/client/kyc/document/upload
   * 
   * Request (multipart/form-data):
   * {
   *   "file": <Image File>, // JPG/PNG of business license
   *   "identifier": "business_license_<license_number>",
   *   "document_type": "business_license"
   * }
   * 
   * Response:
   * {
   *   "id": "DID2212161234567892",
   *   "file_url": "https://digio.in/documents/...",
   *   "status": "uploaded"
   * }
   * 
   * Step 4: Extract License Details (OCR)
   * API Endpoint: GET https://api.digio.in/v2/client/kyc/document/{id}/extract
   * 
   * Response:
   * {
   *   "license_number": "BL/2023/12345",
   *   "business_name": "ABC PRIVATE LIMITED",
   *   "issue_date": "2023-01-15",
   *   "expiry_date": "2028-01-14",
   *   "issuing_authority": "Municipal Corporation",
   *   "license_type": "Trade License",
   *   "status": "Valid"
   * }
   * 
   * Step 5: Validate Extracted Data
   * - Check expiry_date > current_date
   * - Verify business_name matches GST legal_name (allow 70%+ similarity)
   * - Check status === "Valid"
   * - Compare extracted license_number with user input (show mismatch alert if different)
   * - If validation fails, allow manual override with admin review flag
   * 
   * Step 6: Store Results
   * - Firebase Storage URL (downloadURL)
   * - Digio verification ID
   * - Extracted OCR data (license_number, business_name, dates, authority)
   * - Verification status and timestamp
   * 
   * Error Handling:
   * - IMAGE_TOO_BLURRY → Ask user to retake photo
   * - OCR_FAILED → Fall back to manual admin review
   * - LICENSE_EXPIRED → Show error, ask for valid license
   * - NAME_MISMATCH → Show warning, allow proceed with flagged review
   * 
   * Pricing: Image upload free, OCR ₹5-10 per document
   * ============================================================================
   */
  const pickLicenseDocument = async () => {
    // Directly open gallery (simpler UX, avoids camera permission issues)
    // Users can take photo with their default camera app, then select from gallery
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 2000,
        maxHeight: 2000,
        selectionLimit: 1,
      });

      if (result.didCancel) {
        return;
      }

      if (result.errorCode) {
        Toast.show({ type: 'error', text1: 'Gallery Error', text2: result.errorMessage || 'Failed to open gallery' });
        return;
      }

      if (result.assets && result.assets[0]) {
        await handleLicenseImage(result.assets[0]);
      }
    } catch (error: any) {
      console.error('Gallery error:', error);
      Toast.show({ type: 'error', text1: 'Gallery Error', text2: 'Failed to open gallery' });
    }
  };

  const handleLicenseImage = async (image: any) => {
    try {
      // Validate file size (max 10MB)
      const fileSize = image.fileSize || 0;
      if (fileSize > 10 * 1024 * 1024) {
        Toast.show({ type: 'error', text1: 'File Too Large', text2: 'Please select an image smaller than 10MB' });
        return;
      }

      // Set the file immediately for UI feedback
      const fileData = {
        uri: image.uri,
        name: image.fileName || `license_${Date.now()}.jpg`,
        type: image.type || 'image/jpeg',
        size: fileSize,
      };

      setLicenseFile(fileData);

      Toast.show({
        type: 'success',
        text1: 'Image Selected ✓',
        text2: `${fileData.name} (${(fileSize / 1024).toFixed(0)} KB)`,
        visibilityTime: 2000,
      });
    } catch (error: any) {
      console.error('Image handling error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: 'Failed to process image' });
    }
  };

  const verifyLicense = async () => {
    if (!licenseNumber.trim()) {
      Toast.show({ type: 'error', text1: 'License Number Required', text2: 'Please enter your business license number' });
      return;
    }

    if (!licenseFile) {
      Toast.show({ type: 'error', text1: 'Document Required', text2: 'Please upload your business license document' });
      return;
    }

    if (!gstVerified || !panVerified) {
      Toast.show({ type: 'error', text1: 'Complete Previous Steps', text2: 'Please verify GST and PAN first' });
      return;
    }

    setIsVerifyingLicense(true);

    try {
      // BYPASS MODE - Remove this block when implementing actual Digio API
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const mockLicenseData = {
        license_number: licenseNumber,
        business_name: 'SAMPLE BUSINESS PVT LTD',
        issue_date: '2023-01-15',
        expiry_date: '2028-01-14',
        status: 'Valid',
        document_url: 'https://example.com/license.pdf',
      };

      setLicenseVerified(true);
      setIsVerifyingLicense(false);

      Toast.show({
        type: 'success',
        text1: 'License Verified ✓',
        text2: `${mockLicenseData.business_name} (Valid until ${mockLicenseData.expiry_date})`,
        visibilityTime: 3000,
      });

      // TODO: When implementing Digio API, replace bypass code with:
      // 
      // Step 1: Upload image to Firebase Storage
      // const user = auth().currentUser;
      // const fileName = `business_license_${Date.now()}.jpg`;
      // const filePath = `merchantDocuments/${user.uid}/${fileName}`;
      // const reference = storage().ref(filePath);
      // 
      // // Upload the image file
      // await reference.putFile(licenseFile.uri);
      // const downloadURL = await reference.getDownloadURL();
      // console.log('License uploaded to Firebase:', downloadURL);
      // 
      // Step 2: Send image to Digio API for OCR extraction
      // const formData = new FormData();
      // formData.append('file', {
      //   uri: licenseFile.uri,
      //   type: licenseFile.type || 'image/jpeg',
      //   name: licenseFile.name,
      // });
      // formData.append('identifier', `business_license_${licenseNumber}`);
      // formData.append('document_type', 'business_license');
      // 
      // const digioResponse = await fetch('https://api.digio.in/v2/client/kyc/document/upload', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Basic ${btoa('client_id:client_secret')}`,
      //   },
      //   body: formData,
      // });
      // 
      // const digioData = await digioResponse.json();
      // 
      // if (!digioResponse.ok) {
      //   throw new Error(digioData.error?.message || 'Document upload failed');
      // }
      // 
      // Step 3: Extract license details via OCR
      // const ocrResponse = await fetch(`https://api.digio.in/v2/client/kyc/document/${digioData.id}/extract`, {
      //   method: 'GET',
      //   headers: {
      //     'Authorization': `Basic ${btoa('client_id:client_secret')}`,
      //     'Content-Type': 'application/json',
      //   },
      // });
      // 
      // const ocrData = await ocrResponse.json();
      // // Expected fields: license_number, business_name, issue_date, expiry_date, issuing_authority
      // 
      // Step 4: Validate extracted data
      // if (ocrData.expiry_date && new Date(ocrData.expiry_date) < new Date()) {
      //   throw new Error('Business license has expired');
      // }
      // 
      // // Verify license number matches (with tolerance for OCR errors)
      // if (ocrData.license_number && ocrData.license_number !== licenseNumber) {
      //   Alert.alert(
      //     'License Number Mismatch',
      //     `Entered: ${licenseNumber}\nExtracted from image: ${ocrData.license_number}\n\nPlease verify the license number.`,
      //     [
      //       { text: 'Cancel', style: 'cancel', onPress: () => setIsVerifyingLicense(false) },
      //       { text: 'Use Extracted Number', onPress: () => setLicenseNumber(ocrData.license_number) },
      //       { text: 'Keep My Entry', onPress: () => { /* continue with user's entry */ } }
      //     ]
      //   );
      //   return;
      // }
      // 
      // // Cross-check business name with GST legal_name
      // if (ocrData.business_name && mockGSTData.legal_name) {
      //   const nameSimilarity = calculateStringSimilarity(ocrData.business_name, mockGSTData.legal_name);
      //   if (nameSimilarity < 0.7) {
      //     Alert.alert(
      //       'Business Name Mismatch',
      //       `License: ${ocrData.business_name}\nGST: ${mockGSTData.legal_name}\n\nNames don't match. Please verify.`,
      //       [{ text: 'OK' }]
      //     );
      //   }
      // }
      // 
      // setLicenseVerified(true);
      // // Store: downloadURL, ocrData (license_number, business_name, issue_date, expiry_date, issuing_authority)
      
    } catch (error: any) {
      console.error('License verification error:', error);
      setIsVerifyingLicense(false);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: 'Failed to verify business license. Please try again.',
        visibilityTime: 4000,
      });
    }
  };

  const validateGST = (gst: string): boolean => {
    // GST format: 2 digits (state) + 10 chars (PAN) + 1 digit + 1 letter + 1 letter/digit
    const gstRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
    return gstRegex.test(gst.toUpperCase());
  };

  const validatePAN = (pan: string): boolean => {
    // PAN format: 5 letters + 4 digits + 1 letter
    // 4th character should be P for company, but accepting all for flexibility
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(pan.toUpperCase());
  };

  const isFormComplete = (): boolean => {
    return gstVerified && panVerified && licenseVerified;
  };

  const handleContinue = async () => {
    if (!isFormComplete()) {
      Toast.show({
        type: 'error',
        text1: 'Verification Incomplete',
        text2: 'Please complete all verifications before continuing',
      });
      return;
    }

    setIsSaving(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Save merchant verification data to Firestore
      // SECURITY: Store only last 4 digits for privacy compliance
      await firestore()
        .collection('merchantVerification')
        .doc(user.uid)
        .set({
          gstLast4: gstNumber.slice(-4),
          panLast4: panNumber.slice(-4),
          licenseLast4: licenseNumber.slice(-4),
          gstVerified: true,
          panVerified: true,
          licenseVerified: true,
          verifiedAt: firestore.FieldValue.serverTimestamp(),
          // TODO: Add actual verification data from Digio API:
          // licenseDocumentURL: downloadURL, // Signed Firebase Storage URL (secure, access-controlled)
          // licenseVerificationId: digioData.id, // Digio API verification ID for re-verification
          // gstDetails: { legal_name, trade_name, address, etc. },
          // panDetails: { full_name, category, etc. },
          // licenseDetails: { // OCR extracted data - safe to store, no PII
          //   license_number,
          //   business_name,
          //   issue_date,
          //   expiry_date,
          //   issuing_authority,
          //   license_type,
          // },
          // SECURITY NOTE:
          // - Only last 4 digits stored for GST/PAN/License (data minimization)
          // - licenseDocumentURL is protected by storage.rules (owner + admin access only)
          // - OCR data is business info, not personal data (safe to store)
          // - 7-year retention required for KYC/AML compliance
          // - See MERCHANT_DOCUMENT_SECURITY.md for complete security guide
        });

      // Update account signup step
      await firestore()
        .collection('accounts')
        .doc(user.uid)
        .update({
          signupStep: 'merchant_bank_details',
          businessVerified: true,
        });

      setIsSaving(false);

      Toast.show({
        type: 'success',
        text1: 'Business Verified! ✓',
        text2: 'Moving to bank details...',
        visibilityTime: 2000,
      });

      // Navigate to next screen after delay
      setTimeout(() => {
        navigation.navigate('MerchantBankDetails' as never);
      }, 1500);
    } catch (error: any) {
      console.error('Save error:', error);
      setIsSaving(false);
      
      // Show user-friendly error message (hide technical details)
      Toast.show({
        type: 'error',
        text1: 'Save Error',
        text2: 'Unable to save verification. Please check your connection.',
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
            <Ionicons name="shield-checkmark-outline" size={32} color="#378BBB" />
          </View>
          <Text style={styles.title}>Business Verification</Text>
          <Text style={styles.subtitle}>
            Verify your business credentials to start hosting events
          </Text>
        </View>

        {/* Info Card */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#378BBB" />
          <Text style={styles.infoText}>
            We use Digio API to verify your business documents securely. All data is encrypted.
          </Text>
        </View>

        {/* GST Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>GST Number</Text>
            {gstVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <GlowInput
            iconName="document-text-outline"
            placeholder="22AAAAA0000A1Z5"
            value={gstNumber}
            onChangeText={(text) => setGstNumber(text.toUpperCase())}
            maxLength={15}
            autoCapitalize="characters"
            editable={!gstVerified}
          />
          <TouchableOpacity
            onPress={verifyGST}
            disabled={gstVerified || isVerifyingGST || !gstNumber.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                gstVerified
                  ? ['#4CAF50', '#66BB6A']
                  : gstNumber.trim() && !isVerifyingGST
                  ? ['#378BBB', '#4FC3F7']
                  : ['#1B2F48', '#1B2F48']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifyButton}
            >
              {isVerifyingGST ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>
                  {gstVerified ? '✓ GST Verified' : 'Verify GST'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* PAN Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PAN Number</Text>
            {panVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <GlowInput
            iconName="card-outline"
            placeholder="AAAAA9999A"
            value={panNumber}
            onChangeText={(text) => setPanNumber(text.toUpperCase())}
            maxLength={10}
            autoCapitalize="characters"
            editable={!panVerified}
          />
          <TouchableOpacity
            onPress={verifyPAN}
            disabled={panVerified || isVerifyingPAN || !panNumber.trim() || !gstVerified}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                panVerified
                  ? ['#4CAF50', '#66BB6A']
                  : panNumber.trim() && gstVerified && !isVerifyingPAN
                  ? ['#378BBB', '#4FC3F7']
                  : ['#1B2F48', '#1B2F48']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifyButton}
            >
              {isVerifyingPAN ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>
                  {panVerified ? '✓ PAN Verified' : 'Verify PAN'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          {!gstVerified && (
            <Text style={styles.helperText}>Verify GST first</Text>
          )}
        </View>

        {/* Business License Verification */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Business License</Text>
            {licenseVerified && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={18} color="#4CAF50" />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>
          <GlowInput
            iconName="newspaper-outline"
            placeholder="License Number"
            value={licenseNumber}
            onChangeText={setLicenseNumber}
            maxLength={50}
            editable={!licenseVerified}
          />
          
          {/* File Upload */}
          <TouchableOpacity
            onPress={pickLicenseDocument}
            disabled={licenseVerified}
            activeOpacity={0.7}
            style={styles.uploadButton}
          >
            <Ionicons
              name={licenseFile ? 'document-attach' : 'cloud-upload-outline'}
              size={24}
              color={licenseFile ? '#4CAF50' : '#7F93AA'}
            />
            <View style={styles.uploadTextContainer}>
              <Text style={styles.uploadButtonText}>
                {licenseFile ? licenseFile.name : 'Upload License Photo'}
              </Text>
              {licenseFile && (
                <Text style={styles.uploadSizeText}>
                  {(licenseFile.size / 1024).toFixed(0)} KB
                </Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={verifyLicense}
            disabled={
              licenseVerified ||
              isVerifyingLicense ||
              !licenseNumber.trim() ||
              !licenseFile ||
              !gstVerified ||
              !panVerified
            }
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={
                licenseVerified
                  ? ['#4CAF50', '#66BB6A']
                  : licenseNumber.trim() &&
                    licenseFile &&
                    gstVerified &&
                    panVerified &&
                    !isVerifyingLicense
                  ? ['#378BBB', '#4FC3F7']
                  : ['#1B2F48', '#1B2F48']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.verifyButton}
            >
              {isVerifyingLicense ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.verifyButtonText}>
                  {licenseVerified ? '✓ License Verified' : 'Upload & Verify License'}
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
          {(!gstVerified || !panVerified) && (
            <Text style={styles.helperText}>Complete GST and PAN verification first</Text>
          )}
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={!isFormComplete() || isSaving}
          activeOpacity={0.8}
          style={styles.continueButtonContainer}
        >
          <LinearGradient
            colors={
              isFormComplete() && !isSaving
                ? ['#378BBB', '#4FC3F7']
                : ['#1B2F48', '#1B2F48']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
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
    flexDirection: 'row',
    backgroundColor: 'rgba(55, 139, 187, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.2)',
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    lineHeight: 19,
    marginLeft: 12,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  verifiedText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#4CAF50',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    marginBottom: 12,
    minHeight: 56,
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
  verifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 8,
  },
  verifyButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  helperText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    marginTop: 4,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#233B57',
    borderStyle: 'dashed',
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  uploadTextContainer: {
    flex: 1,
    marginLeft: 12,
  },
  uploadButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  uploadSizeText: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    marginTop: 2,
  },
  continueButtonContainer: {
    marginBottom: 40,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  continueButtonText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});

export default MerchantVerificationScreen;
