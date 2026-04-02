import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ImageBackground,
  Image,
  ActivityIndicator,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface GenderSelectionScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GenderSelection'>;
  route: RouteProp<RootStackParamList, 'GenderSelection'>;
}

const GENDER_OPTIONS = [
  { id: 'Male', label: 'Male', icon: 'male' },
  { id: 'Female', label: 'Female', icon: 'female' },
  { id: 'Non-Binary', label: 'Non-Binary', icon: 'male-female' },
  { id: 'Trans', label: 'Trans', icon: 'transgender-outline' },
  { id: 'Prefer not to say', label: 'Prefer not to say', icon: 'help-circle-outline' },
];

const GenderSelectionScreen = ({ navigation, route }: GenderSelectionScreenProps) => {
  const insets = useSafeAreaInsets();
  const { fullName, email, username, password, dob } = route.params;

  const [selectedGender, setSelectedGender] = useState('');
  const [loading, setLoading] = useState(false);

  const handleContinue = async () => {
    if (!selectedGender) {
      Toast.show({
        type: 'error',
        text1: 'Gender Required',
        text2: 'Please select your gender to continue',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);
    try {
      const user = auth().currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Link email/password credential to the phone-authenticated account
      const credential = auth.EmailAuthProvider.credential(email, password);
      await user.linkWithCredential(credential);

      // Send email verification
      await user.sendEmailVerification();

      // Update account document — signupStep 'photos' so app resumes at PhotoUpload
      await firestore().collection('accounts').doc(user.uid).set({
        authUid: user.uid,
        role: 'user',
        creatorType: null,
        status: 'active',
        phoneVerified: true,
        emailVerified: false,
        identityVerified: false,
        bankVerified: false,
        signupStep: 'photos',
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      const phoneNumber = user.phoneNumber || '';

      setLoading(false);
      Toast.show({
        type: 'success',
        text1: 'Verification Email Sent',
        text2: `Check ${email} and click the verification link`,
        visibilityTime: 4000,
      });

      setTimeout(() => {
        navigation.navigate('EmailVerification', {
          phoneNumber,
          fullName,
          email,
          username,
          dob,
          gender: selectedGender,
          password,
        });
      }, 1000);
    } catch (error: any) {
      setLoading(false);
      console.error('Gender selection error:', error);

      if (error.code === 'auth/email-already-in-use') {
        Toast.show({
          type: 'error',
          text1: 'Email Already in Use',
          text2: 'This email is already registered. Please go back and use a different email.',
          visibilityTime: 4000,
        });
      } else if (error.code === 'auth/invalid-email') {
        Toast.show({
          type: 'error',
          text1: 'Invalid Email',
          text2: 'Please go back and check your email address',
          visibilityTime: 3000,
        });
      } else if (error.code === 'auth/weak-password') {
        Toast.show({
          type: 'error',
          text1: 'Weak Password',
          text2: 'Please go back and use a stronger password',
          visibilityTime: 3000,
        });
      } else if (error.code === 'auth/provider-already-linked') {
        // Email already linked — proceed to EmailVerification anyway
        const phoneNumber = auth().currentUser?.phoneNumber || '';
        setLoading(false);
        setTimeout(() => {
          navigation.navigate('EmailVerification', {
            phoneNumber,
            fullName,
            email,
            username,
            dob,
            gender: selectedGender,
            password,
          });
        }, 500);
      } else {
        Toast.show({
          type: 'error',
          text1: 'Setup Failed',
          text2: error.message || 'Failed to complete setup. Please try again.',
          visibilityTime: 4000,
        });
      }
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

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>What's your gender?</Text>
        <Text style={styles.subtitle}>Helps us personalise your experience</Text>

        {/* Gender option cards */}
        <View style={styles.optionsContainer}>
          {GENDER_OPTIONS.map((option) => {
            const isSelected = selectedGender === option.id;
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setSelectedGender(option.id)}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={option.icon as any}
                  size={26}
                  color={isSelected ? '#A855F7' : 'rgba(255,255,255,0.40)'}
                />
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {option.label}
                </Text>
                {isSelected && (
                  <View style={styles.checkDot}>
                    <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Spacer pushes button to bottom */}
        <View style={{ flex: 1 }} />

        {/* Continue button */}
        <TouchableOpacity onPress={handleContinue} disabled={loading} activeOpacity={0.85}>
          <LinearGradient
            colors={
              !selectedGender || loading
                ? ['rgba(139,43,226,0.25)', 'rgba(6,182,212,0.25)']
                : ['#8B2BE2', '#06B6D4']
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.continueButton,
              { marginBottom: Math.max(32, insets.bottom + 16) },
            ]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    lineHeight: 40,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 36,
  },
  optionsContainer: {
    gap: 14,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: 'rgba(30,28,45,0.88)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.10)',
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  optionCardSelected: {
    backgroundColor: 'rgba(139,92,246,0.22)',
    borderColor: 'rgba(139,92,246,0.90)',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 18,
    elevation: 29,
  },
  optionLabel: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255,255,255,0.60)',
  },
  optionLabelSelected: {
    color: '#FFFFFF',
  },
  checkDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B2BE2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
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
});

export default GenderSelectionScreen;
