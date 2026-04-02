/**
 * MERCHANT PROFILE SCREEN (Business Profile Setup)
 * 
 * Final step for merchant signup - set up how their business appears on event pages.
 * 
 * Collects:
 * - Business Name (pre-filled from GST if available)
 * - Business Logo (square image, required)
 * - Business Description/About
 * - Business Address (full address)
 * - Social Links (Instagram, LinkedIn, Website)
 * - Contact Email (optional)
 * 
 * Database Updates:
 * - Updates users/{userId}.creatorDetails
 * - Updates accounts/{accountId}.signupStep to 'merchant_complete'
 */

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
  Image,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp, CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { launchImageLibrary } from 'react-native-image-picker';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import Toast from 'react-native-toast-message';

type RootStackParamList = {
  MerchantProfile: undefined;
  HostTabs: undefined;
};

type MerchantProfileScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'MerchantProfile'
>;

type MerchantProfileScreenRouteProp = RouteProp<
  RootStackParamList,
  'MerchantProfile'
>;

interface Props {
  navigation: MerchantProfileScreenNavigationProp;
  route: MerchantProfileScreenRouteProp;
}

interface GlowInputProps {
  iconName: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  keyboardType?: 'default' | 'email-address';
  multiline?: boolean;
  numberOfLines?: number;
  maxLength?: number;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}

const GlowInput: React.FC<GlowInputProps> = ({
  iconName,
  multiline,
  numberOfLines,
  ...inputProps
}) => {
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
    <Animated.View
      style={[
        multiline ? styles.textAreaContainer : styles.inputContainer,
        { borderColor },
      ]}
    >
      <Ionicons
        name={iconName as any}
        size={20}
        color="#7F93AA"
        style={multiline ? styles.textAreaIcon : styles.inputIcon}
      />
      <TextInput
        {...inputProps}
        multiline={multiline}
        numberOfLines={numberOfLines}
        style={multiline ? styles.textArea : styles.input}
        placeholderTextColor="#7F93AA"
        onFocus={handleFocus}
        onBlur={handleBlur}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </Animated.View>
  );
};

const MerchantProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  // Form state
  const [businessName, setBusinessName] = useState('');
  const [logoUri, setLogoUri] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('India');
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [website, setWebsite] = useState('');
  const [contactEmail, setContactEmail] = useState('');

  // Loading states
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const canGoBack = useRef(navigation.canGoBack()).current;

  // Load pre-filled data from GST verification
  useEffect(() => {
    loadPrefilledData();
  }, []);

  const loadPrefilledData = async () => {
    try {
      const user = auth().currentUser;
      if (!user) return;

      // Try to get business name from GST verification
      const merchantVerificationDoc = await firestore()
        .collection('merchantVerification')
        .doc(user.uid)
        .get();

      if (merchantVerificationDoc.exists()) {
        const data = merchantVerificationDoc.data();
        
        // Pre-fill business name from GST (trade name preferred over legal name)
        const gstTradeName = data?.gstDetails?.trade_name;
        const gstLegalName = data?.gstDetails?.legal_name;
        
        if (gstTradeName) {
          setBusinessName(gstTradeName);
        } else if (gstLegalName) {
          setBusinessName(gstLegalName);
        }
      }

      // Try to get existing data if user is editing
      const userDoc = await firestore()
        .collection('users')
        .doc(user.uid)
        .get();

      if (userDoc.exists()) {
        const userData = userDoc.data();
        const creatorDetails = userData?.creatorDetails;

        if (creatorDetails) {
          if (creatorDetails.organizationName) setBusinessName(creatorDetails.organizationName);
          if (creatorDetails.logoUrl) setLogoUri(creatorDetails.logoUrl);
          if (creatorDetails.bio) setDescription(creatorDetails.bio);
          if (creatorDetails.website) setWebsite(creatorDetails.website);
          if (creatorDetails.contactEmail) setContactEmail(creatorDetails.contactEmail);
          
          if (creatorDetails.businessAddress) {
            setAddressLine(creatorDetails.businessAddress.addressLine || '');
            setCity(creatorDetails.businessAddress.city || '');
            setState(creatorDetails.businessAddress.state || '');
            setCountry(creatorDetails.businessAddress.country || 'India');
          }

          // Parse social links array
          if (creatorDetails.socialLinks && Array.isArray(creatorDetails.socialLinks)) {
            creatorDetails.socialLinks.forEach((link: string) => {
              if (link.includes('instagram.com')) setInstagram(link);
              if (link.includes('linkedin.com')) setLinkedin(link);
            });
          }
        }
      }
    } catch (error) {
      console.error('Error loading prefilled data:', error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handlePickLogo = () => {
    launchImageLibrary(
      {
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1024,
        maxHeight: 1024,
        includeBase64: false,
      },
      (response) => {
        if (response.didCancel) {
          return;
        }

        if (response.errorCode) {
          Toast.show({
            type: 'error',
            text1: 'Image Selection Error',
            text2: response.errorMessage || 'Failed to select image',
          });
          return;
        }

        if (response.assets && response.assets[0]) {
          setLogoUri(response.assets[0].uri || null);
        }
      }
    );
  };

  const uploadLogo = async (uri: string): Promise<string> => {
    const user = auth().currentUser;
    if (!user) throw new Error('User not authenticated');

    setIsUploadingLogo(true);

    try {
      const filename = `logo_${Date.now()}.jpg`;
      const reference = storage().ref(`business-logos/${user.uid}/${filename}`);

      await reference.putFile(uri);
      const downloadURL = await reference.getDownloadURL();

      setIsUploadingLogo(false);
      return downloadURL;
    } catch (error) {
      setIsUploadingLogo(false);
      throw error;
    }
  };

  const validateForm = (): boolean => {
    if (!businessName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Business Name Required',
        text2: 'Please enter your business name',
      });
      return false;
    }

    if (!logoUri) {
      Toast.show({
        type: 'error',
        text1: 'Business Logo Required',
        text2: 'Please upload your business logo',
      });
      return false;
    }

    if (!description.trim() || description.trim().length < 20) {
      Toast.show({
        type: 'error',
        text1: 'Description Too Short',
        text2: 'Please write at least 20 characters about your business',
      });
      return false;
    }

    if (!addressLine.trim() || !city.trim() || !state.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Address Incomplete',
        text2: 'Please fill in complete business address',
      });
      return false;
    }

    return true;
  };

  const isFormComplete = (): boolean => {
    return (
      businessName.trim().length > 0 &&
      logoUri !== null &&
      description.trim().length >= 20 &&
      addressLine.trim().length > 0 &&
      city.trim().length > 0 &&
      state.trim().length > 0 &&
      country.trim().length > 0
    );
  };

  const handleSaveProfile = async () => {
    if (!validateForm()) {
      return;
    }

    setIsSaving(true);

    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Upload logo to Firebase Storage
      let logoUrl = logoUri;
      if (logoUri && !logoUri.startsWith('http')) {
        // Local file URI - needs upload
        logoUrl = await uploadLogo(logoUri);
      }

      // Build social links array
      const socialLinks: string[] = [];
      if (instagram.trim()) socialLinks.push(instagram.trim());
      if (linkedin.trim()) socialLinks.push(linkedin.trim());

      // Update users collection with creator details
      await firestore()
        .collection('users')
        .doc(user.uid)
        .set(
          {
            creatorDetails: {
              organizationName: businessName.trim(),
              logoUrl: logoUrl,
              bio: description.trim(),
              businessAddress: {
                addressLine: addressLine.trim(),
                city: city.trim(),
                state: state.trim(),
                country: country.trim(),
              },
              website: website.trim() || null,
              contactEmail: contactEmail.trim() || null,
              socialLinks: socialLinks.length > 0 ? socialLinks : null,
              experienceYears: null, // Can be added later
            },
          },
          { merge: true }
        );

      // Update signup step to merchant_complete
      await firestore()
        .collection('accounts')
        .doc(user.uid)
        .update({
          signupStep: 'merchant_complete',
          status: 'active',
        });

      setIsSaving(false);

      Toast.show({
        type: 'success',
        text1: 'Business Profile Complete! 🎉',
        text2: 'Your merchant account is now active',
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
      console.error('Save profile error:', error);
      setIsSaving(false);

      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: 'Unable to save profile. Please try again.',
        visibilityTime: 4000,
      });
    }
  };

  if (isLoadingData) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#378BBB" />
        <Text style={styles.loadingText}>Loading your details...</Text>
      </View>
    );
  }

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
            <Ionicons name="storefront-outline" size={32} color="#378BBB" />
          </View>
          <Text style={styles.title}>Your Business Profile</Text>
          <Text style={styles.subtitle}>
            This is how your brand will appear on event pages
          </Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          {/* Business Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Business Name <Text style={styles.required}>*</Text>
            </Text>
            <GlowInput
              iconName="business-outline"
              placeholder="e.g., Aurora Events Pvt Ltd"
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
            />
          </View>

          {/* Description */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Business Description <Text style={styles.required}>*</Text>
            </Text>
            <GlowInput
              iconName=""
              placeholder="Tell people about your business... (min 20 characters)"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              maxLength={500}
            />
            <Text style={styles.charCount}>
              {description.length}/500 characters
            </Text>
          </View>

          {/* Logo Upload Section */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Business Logo <Text style={styles.required}>*</Text>
            </Text>
            {logoUri ? (
              <View style={styles.logoRow}>
                {/* Logo Preview Box */}
                <View style={styles.logoBoxWrapper}>
                  <View style={styles.logoBox}>
                    <Image source={{ uri: logoUri }} style={styles.logoImage} />
                    {isUploadingLogo && (
                      <View style={styles.uploadingOverlay}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      </View>
                    )}
                  </View>
                </View>

                {/* Logo Actions */}
                <View style={styles.logoInfoContainer}>
                  <View style={styles.logoActionsColumn}>
                    <TouchableOpacity
                      style={styles.changeLogoButton}
                      onPress={handlePickLogo}
                      disabled={isUploadingLogo}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="camera-outline" size={18} color="#378BBB" />
                      <Text style={styles.changeButtonText}>Change Logo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.removeLogoButton}
                      onPress={() => setLogoUri(null)}
                      disabled={isUploadingLogo}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="trash-outline" size={18} color="#FF5252" />
                      <Text style={styles.removeButtonText}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.uploadPrompt}>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handlePickLogo}
                  activeOpacity={0.7}
                >
                  <Ionicons name="cloud-upload-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.uploadButtonText}>Upload Logo</Text>
                </TouchableOpacity>
                <Text style={styles.uploadHint}>
                  Square image (512x512) • PNG or JPG, max 5MB
                </Text>
              </View>
            )}
          </View>

          {/* Business Address */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              Business Address <Text style={styles.required}>*</Text>
            </Text>
            <GlowInput
              iconName="location-outline"
              placeholder="Address Line (Street, Building)"
              value={addressLine}
              onChangeText={setAddressLine}
              autoCapitalize="words"
            />
            <View style={styles.addressRow}>
              <View style={styles.addressHalf}>
                <GlowInput
                  iconName="location-outline"
                  placeholder="City"
                  value={city}
                  onChangeText={setCity}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.addressHalf}>
                <GlowInput
                  iconName="location-outline"
                  placeholder="State"
                  value={state}
                  onChangeText={setState}
                  autoCapitalize="words"
                />
              </View>
            </View>
            <GlowInput
              iconName="globe-outline"
              placeholder="Country"
              value={country}
              onChangeText={setCountry}
              autoCapitalize="words"
            />
          </View>

          {/* Social Links (Optional) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Social Links (Optional)</Text>
            <GlowInput
              iconName="logo-instagram"
              placeholder="Instagram URL (e.g., https://instagram.com/yourpage)"
              value={instagram}
              onChangeText={setInstagram}
              autoCapitalize="none"
            />
            <GlowInput
              iconName="logo-linkedin"
              placeholder="LinkedIn URL"
              value={linkedin}
              onChangeText={setLinkedin}
              autoCapitalize="none"
            />
            <GlowInput
              iconName="globe-outline"
              placeholder="Website URL"
              value={website}
              onChangeText={setWebsite}
              autoCapitalize="none"
            />
          </View>

          {/* Contact Email (Optional) */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Contact Email (Optional)</Text>
            <GlowInput
              iconName="mail-outline"
              placeholder="customer@yourbusiness.com"
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Text style={styles.helperText}>
              For customer inquiries (can be same as your account email)
            </Text>
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          onPress={handleSaveProfile}
          disabled={!isFormComplete() || isSaving || isUploadingLogo}
          activeOpacity={0.8}
          style={styles.saveButtonContainer}
        >
          <LinearGradient
            colors={
              isFormComplete() && !isSaving && !isUploadingLogo
                ? ['#378BBB', '#4FC3F7']
                : ['#1B2F48', '#1B2F48']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveButton}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <Text style={styles.saveButtonText}>Complete Setup</Text>
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
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0E1621',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#B8C7D9',
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
  required: {
    color: '#FF5252',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 20,
  },
  logoBoxWrapper: {
    alignItems: 'center',
  },
  logoBox: {
    width: 110,
    height: 110,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#378BBB',
    borderStyle: 'dashed',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(55, 139, 187, 0.05)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  logoPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInfoContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  logoActionsColumn: {
    gap: 10,
  },
  changeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(55, 139, 187, 0.1)',
    borderWidth: 1,
    borderColor: '#378BBB',
  },
  changeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#378BBB',
  },
  removeLogoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 82, 82, 0.1)',
    borderWidth: 1,
    borderColor: '#FF5252',
  },
  removeButtonText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FF5252',
  },
  uploadPrompt: {
    gap: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: '#378BBB',
    shadowColor: '#378BBB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  uploadButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  uploadHint: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    lineHeight: 18,
  },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(14, 22, 33, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    textAlign: 'center',
  },
  formSection: {
    marginBottom: 24,
  },
  fieldGroup: {
    marginBottom: 24,
  },
  fieldLabel: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    marginBottom: 12,
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
  textAreaContainer: {
    flexDirection: 'row',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    minHeight: 120,
  },
  textAreaIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  textArea: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
    minHeight: 100,
  },
  charCount: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#7F93AA',
    textAlign: 'right',
    marginTop: -8,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 12,
  },
  addressHalf: {
    flex: 1,
  },
  saveButtonContainer: {
    marginBottom: 40,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    paddingVertical: 18,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});

export default MerchantProfileScreen;
