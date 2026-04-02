/**
 * CREATOR TYPE SELECTION SCREEN
 * 
 * After email verification, creators choose their type:
 * - Individual Host (personal events, freelance organizers)
 * - Merchant Organizer (businesses, venues, brands)
 * 
 * Database Update:
 * - Updates accounts/{accountId}.creatorType to "individual" or "merchant"
 * 
 * Next Steps:
 * - Individual → IndividualVerificationScreen (Aadhaar/PAN)
 * - Merchant → MerchantVerificationScreen (GST/PAN/License)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface CreatorTypeSelectionScreenProps {
  navigation: any;
}

type CreatorType = 'individual' | 'merchant';

const CreatorTypeSelectionScreen: React.FC<CreatorTypeSelectionScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selectedType, setSelectedType] = useState<CreatorType | null>(null);
  const [loading, setLoading] = useState(false);

  /**
   * Update creator type in accounts collection
   */
  const updateCreatorType = async (type: CreatorType) => {
    const user = auth().currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }

    // Set signupStep based on creator type
    const signupStep = type === 'individual' 
      ? 'individual_host_verification' 
      : 'merchant_verification'; // TODO: Add merchant_verification to SignupStep type

    await firestore()
      .collection('accounts')
      .doc(user.uid)
      .update({
        creatorType: type,
        signupStep: signupStep,
      });

    console.log(`✅ Creator type set to: ${type}, signupStep: ${signupStep}`);
  };

  /**
   * Handle selection and navigation
   */
  const handleContinue = async () => {
    if (!selectedType) {
      Toast.show({
        type: 'error',
        text1: 'Selection Required',
        text2: 'Please choose your creator type',
        visibilityTime: 3000,
      });
      return;
    }

    setLoading(true);

    try {
      // Update creator type in database
      await updateCreatorType(selectedType);

      setLoading(false);

      Toast.show({
        type: 'success',
        text1: 'Type Selected',
        text2: `You're registered as ${selectedType === 'individual' ? 'Individual Host' : 'Merchant Organizer'}`,
        visibilityTime: 3000,
      });

      // Navigate to respective verification flow
      setTimeout(() => {
        if (selectedType === 'individual') {
          // TODO: Navigate to IndividualVerificationScreen
          navigation.navigate('IndividualVerification');
        } else {
          // TODO: Navigate to MerchantVerificationScreen
          navigation.navigate('MerchantVerification');
        }
      }, 1000);

    } catch (error: any) {
      setLoading(false);
      console.error('Error setting creator type:', error);
      Toast.show({
        type: 'error',
        text1: 'Update Failed',
        text2: error.message || 'Failed to update creator type',
        visibilityTime: 4000,
      });
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" translucent={true} />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Content */}
        <View style={styles.content}>
          <Text style={styles.title}>Choose Your Creator Type</Text>
          <Text style={styles.subtitle}>
            Select how you'll be hosting events on Funmate
          </Text>

          {/* Individual Host Card */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'individual' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedType('individual')}
            activeOpacity={0.8}
          >
            <View style={styles.optionHeader}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name="person" 
                  size={32} 
                  color={selectedType === 'individual' ? '#378BBB' : '#7F93AA'} 
                />
              </View>
              <View style={[
                styles.radioButton,
                selectedType === 'individual' && styles.radioButtonSelected,
              ]}>
                {selectedType === 'individual' && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </View>

            <Text style={[
              styles.optionTitle,
              selectedType === 'individual' && styles.optionTitleSelected,
            ]}>
              Individual Host
            </Text>

            <Text style={styles.optionDescription}>
              Perfect for freelance event organizers, DJs, performers, and independent hosts
            </Text>

          </TouchableOpacity>

          {/* Merchant Organizer Card */}
          <TouchableOpacity
            style={[
              styles.optionCard,
              selectedType === 'merchant' && styles.optionCardSelected,
            ]}
            onPress={() => setSelectedType('merchant')}
            activeOpacity={0.8}
          >
            <View style={styles.optionHeader}>
              <View style={styles.iconContainer}>
                <Ionicons 
                  name="business" 
                  size={32} 
                  color={selectedType === 'merchant' ? '#378BBB' : '#7F93AA'} 
                />
              </View>
              <View style={[
                styles.radioButton,
                selectedType === 'merchant' && styles.radioButtonSelected,
              ]}>
                {selectedType === 'merchant' && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
            </View>

            <Text style={[
              styles.optionTitle,
              selectedType === 'merchant' && styles.optionTitleSelected,
            ]}>
              Merchant Organizer
            </Text>

            <Text style={styles.optionDescription}>
              For businesses, venues, brands, and registered organizations
            </Text>
          </TouchableOpacity>

          {/* Continue Button */}
          <TouchableOpacity
            onPress={handleContinue}
            disabled={!selectedType || loading}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={selectedType ? ['#378BBB', '#4FC3F7'] : ['transparent', 'transparent']}
              start={{x: 0, y: 0}}
              end={{x: 1, y: 0}}
              style={[
                styles.continueButton,
                !selectedType && styles.continueButtonDisabled,
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
      </ScrollView>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
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
    marginBottom: 32,
    lineHeight: 24,
    fontFamily: 'Inter_24pt-Regular',
  },
  optionCard: {
    backgroundColor: '#16283D',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    borderColor: '#233B57',
    elevation: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  optionCardSelected: {
    borderColor: '#378BBB',
    backgroundColor: '#1B2F48',
    elevation: 4,
    shadowColor: '#378BBB',
    shadowOpacity: 0.3,
  },
  optionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#233B57',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#7F93AA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#378BBB',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#378BBB',
  },
  optionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter_24pt-Bold',
  },
  optionTitleSelected: {
    color: '#378BBB',
  },
  optionDescription: {
    fontSize: 15,
    color: '#B8C7D9',
    lineHeight: 22,
    marginBottom: 16,
    fontFamily: 'Inter_24pt-Regular',
  },
  featuresList: {
    gap: 8,
  },
  featureItem: {
    fontSize: 14,
    color: '#7F93AA',
    lineHeight: 20,
    fontFamily: 'Inter_24pt-Regular',
  },
  continueButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#378BBB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  continueButtonDisabled: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#233B57',
    elevation: 0,
    shadowOpacity: 0,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_24pt-Bold',
  },
});

export default CreatorTypeSelectionScreen;
