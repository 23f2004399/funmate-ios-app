import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import auth, { getAuth, signInWithPhoneNumber } from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import CountryPicker, { Country, CountryCode } from 'react-native-country-picker-modal';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface PhoneNumberScreenProps {
  navigation: any;
  route: any;
}

const PhoneNumberScreen = ({ navigation, route }: PhoneNumberScreenProps) => {
  const insets = useSafeAreaInsets();
  const { accountType = 'user', isLogin = false } = route.params || {};
  const [countryCode, setCountryCode] = useState<CountryCode>('IN');
  const [callingCode, setCallingCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const onSelectCountry = (country: Country) => {
    setCountryCode(country.cca2);
    setCallingCode(`+${country.callingCode[0]}`);
  };

  const handleContinue = async () => {
    if (phoneNumber.length < 10) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Phone Number',
        text2: 'Please enter a valid phone number',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    
    try {
      const fullPhoneNumber = callingCode + phoneNumber;
      console.log('Sending OTP to:', fullPhoneNumber);
      
      // Send OTP directly (Firebase Auth handles phone internally, no DB storage)
      const authInstance = getAuth();
      const confirmation = await signInWithPhoneNumber(
        authInstance,
        fullPhoneNumber
      );
      
      console.log('OTP sent successfully');
      setLoading(false);
      
      // Pass only verificationId to avoid navigation serialization warnings
      navigation.navigate('OTPVerification', {
        phoneNumber: fullPhoneNumber,
        verificationId: confirmation.verificationId,
        accountType,
        isLogin,
      });
    } catch (error: any) {
      setLoading(false);
      console.error('Phone auth error:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: error.message || 'Failed to send verification code',
        visibilityTime: 4000,
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
        <Text style={styles.title}>Enter Your Phone Number</Text>
        <Text style={styles.subtitle}>
          We'll send you OTP for verification
        </Text>

        {/* Phone Input — single unified box */}
        <View style={styles.phoneInputContainer}>
          <TouchableOpacity
            style={styles.countryCodeContainer}
            onPress={() => setShowCountryPicker(true)}
            activeOpacity={0.7}
          >
            <CountryPicker
              countryCode={countryCode}
              withFilter
              withFlag
              withCallingCode
              withEmoji
              onSelect={onSelectCountry}
              visible={showCountryPicker}
              onClose={() => setShowCountryPicker(false)}
              theme={{
                backgroundColor: 'rgba(40, 38, 50, 1.00)',
                primaryColor: 'rgba(180, 180, 195, 0.18)',
                primaryColorVariant: 'rgba(180, 180, 195, 0.08)',
                onBackgroundTextColor: '#FFFFFF',
                fontSize: 15,
                fontFamily: 'Inter-Regular',
                filterPlaceholderTextColor: 'rgba(255, 255, 255, 0.40)',
                activeOpacity: 0.55,
                itemHeight: 52,
                flagSize: 24,
              }}
              modalProps={{
                animationType: 'slide',
                transparent: true,
                statusBarTranslucent: false,
              }}
              containerButtonStyle={{
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
            <Text style={styles.countryCodeText}>{callingCode}</Text>
          </TouchableOpacity>

          {/* Vertical divider */}
          <View style={styles.divider} />

          <TextInput
            style={styles.phoneNumberInput}
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            placeholder="Phone Number"
            placeholderTextColor="rgba(255,255,255,0.35)"
            keyboardType="phone-pad"
            maxLength={10}
            autoFocus
          />
        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          disabled={phoneNumber.length < 10 || loading}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={phoneNumber.length < 10 || loading ? ['rgba(139,43,226,0.25)', 'rgba(6,182,212,0.25)'] : ['#8B2BE2', '#06B6D4']}
            start={{x: 0, y: 0}}
            end={{x: 1, y: 0}}
            style={[styles.continueButton, { marginBottom: Math.max(32, insets.bottom + 16) }]}
          >
            {loading ? (
              <ActivityIndicator color="rgba(255,255,255,0.60)" />
            ) : (
              <Text style={styles.continueButtonText}>Get OTP</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
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
    fontFamily: 'Inter_24pt-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: '#B8C7D9',
    marginBottom: 40,
    fontFamily: 'Inter_24pt-Regular',
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(60, 58, 75, 0.72)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    marginBottom: 32,
    height: 56,
    overflow: 'hidden',
  },
  countryCodeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    gap: 4,
    height: '100%',
  },
  countryCodeText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  phoneNumberInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
    height: '100%',
  },
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },

});

export default PhoneNumberScreen;
