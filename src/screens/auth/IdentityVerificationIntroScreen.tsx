/**
 * Identity Verification Introduction Screen
 * 
 * This screen explains the liveness verification process before opening the camera.
 * Shows instructions and has a button to start the verification.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface IdentityVerificationIntroScreenProps {
  navigation: any;
}

const IdentityVerificationIntroScreen: React.FC<IdentityVerificationIntroScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const canGoBack = navigation.canGoBack();

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.bg}
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerBtn}>
          {canGoBack && (
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(40, insets.bottom + 16) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <Ionicons name="shield-checkmark" size={72} color="#8B2BE2" />
        </View>

        <Text style={styles.title}>Verify Yourself</Text>
        <Text style={styles.subtitle}>
          Complete identity verification to keep our community safe
        </Text>

        {/* Why Verification */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>Why do we need this?</Text>
          <View style={styles.reasonCard}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#8B2BE2" />
            <Text style={styles.reasonText}>Prevent fake profiles and catfishing</Text>
          </View>
          <View style={styles.reasonCard}>
            <Ionicons name="people-outline" size={22} color="#8B2BE2" />
            <Text style={styles.reasonText}>Build a trusted community</Text>
          </View>
          <View style={styles.reasonCard}>
            <Ionicons name="heart-outline" size={22} color="#8B2BE2" />
            <Text style={styles.reasonText}>Ensure authentic connections</Text>
          </View>
        </View>

        {/* How It Works */}
        <View style={styles.sectionContainer}>
          <Text style={styles.sectionTitle}>How it works:</Text>

          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>1</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Camera Opens</Text>
              <Text style={styles.stepDescription}>
                Your front camera will open with a circle overlay
              </Text>
            </View>
          </View>

          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>2</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Follow Instructions</Text>
              <Text style={styles.stepDescription}>
                Center your face, turn left, turn right, and smile
              </Text>
            </View>
          </View>

          <View style={styles.stepContainer}>
            <View style={styles.stepNumber}>
              <Text style={styles.stepNumberText}>3</Text>
            </View>
            <View style={styles.stepContent}>
              <Text style={styles.stepTitle}>Automatic Verification</Text>
              <Text style={styles.stepDescription}>
                We'll verify your identity and you're done!
              </Text>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={styles.tipsContainer}>
          <Text style={styles.tipsTitle}>💡 Tips for success:</Text>
          <Text style={styles.tipText}>• Find a well-lit area</Text>
          <Text style={styles.tipText}>• Remove glasses if possible</Text>
          <Text style={styles.tipText}>• Look directly at the camera</Text>
          <Text style={styles.tipText}>• Move your head slowly and smoothly</Text>
        </View>

        {/* Privacy Note */}
        <View style={styles.privacyContainer}>
          <Ionicons name="lock-closed" size={15} color="rgba(255,255,255,0.40)" />
          <Text style={styles.privacyText}>
            Your live selfie will not be saved. It's only used for verification.
          </Text>
        </View>

        {/* Start Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('LivenessVerification')}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={['#8B2BE2', '#06B6D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.startButton}
          >
            <Ionicons name="camera" size={22} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={styles.startButtonText}>Start Verification</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Attempts note */}
        <Text style={styles.skipNote}>
          You have 5 attempts to complete verification
        </Text>
      </ScrollView>
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
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    padding: 22,
    borderRadius: 60,
    borderWidth: 1.5,
    borderColor: 'rgba(200,200,215,0.28)',
    backgroundColor: 'rgba(55,53,70,0.88)',
    alignSelf: 'center',
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  sectionContainer: {
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  reasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(55,53,70,0.88)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(200,200,215,0.22)',
  },
  reasonText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    flex: 1,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 14,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#8B2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontFamily: 'Inter-Bold',
  },
  stepContent: {
    flex: 1,
    paddingTop: 4,
  },
  stepTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  tipsContainer: {
    backgroundColor: 'rgba(26,21,48,0.88)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  tipsTitle: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  tipText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 5,
    lineHeight: 20,
  },
  privacyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  privacyText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.40)',
    flex: 1,
    lineHeight: 18,
  },
  startButton: {
    flexDirection: 'row',
    height: 54,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
  skipNote: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.40)',
    textAlign: 'center',
  },
});

export default IdentityVerificationIntroScreen;
