import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

interface LoginScreenProps {
  navigation: any;
}

const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const insets = useSafeAreaInsets();

  const handlePhoneLogin = () => {
    console.log('Phone login pressed');
    // Navigate to phone number screen with isLogin flag
    navigation.navigate('PhoneNumber', { isLogin: true });
  };

  const handleEmailLogin = () => {
    console.log('Email login pressed');
    navigation.navigate('EmailLogin');
  };

  const handleCreateAccount = () => {
    navigation.navigate('AccountType');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Logo — top centre */}
      <View style={[styles.logoSection, { paddingTop: insets.top + 16 }]}>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage as any} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
      </View>

      {/* Hero Text */}
      <View style={styles.heroSection}>
        <Text style={styles.heroTitle}>Don't Just{'\n'}Match. Meet.</Text>
        <Text style={styles.heroSubtitle}>Discover events near you.{'\n'}Join. Vibe. Connect in real life.</Text>
      </View>

      {/* Login Options */}
      <View style={styles.loginSection}>
        <TouchableOpacity
          onPress={handlePhoneLogin}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8B2BE2', '#06B6D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Login with Phone</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={handleEmailLogin}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Login with Email</Text>
        </TouchableOpacity>

        {/* Create Account */}
        <View style={styles.signupSection}>
          <Text style={styles.signupText}>New to Funmate? </Text>
          <TouchableOpacity onPress={handleCreateAccount} activeOpacity={0.7}>
            <Text style={styles.signupLink}>Create Account</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: Math.max(32, insets.bottom + 16) }]}>
        <Text style={styles.footerText}>
          By continuing, you agree to our{' '}
          <Text style={styles.footerLink}>Terms</Text> &{' '}
          <Text style={styles.footerLink}>Privacy Policy</Text>
        </Text>
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
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.60)',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 13,
  },
  logoImage: {
    width: 44,
    height: 44,
    resizeMode: 'contain',
    position: 'absolute',
    left: -52,
  },
  appName: {
    fontSize: 38,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  heroSection: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingBottom: 40,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 44,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    lineHeight: 52,
    marginBottom: 14,
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: 18,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.99)',
    lineHeight: 24,
    textAlign: 'center',
  },
  loginSection: {
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
    paddingBottom: 32,
  },
  primaryButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.60)',
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
  signupSection: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  signupText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  signupLink: {
    fontSize: 15,
    color: '#22D3EE',
    fontFamily: 'Inter-SemiBold',
  },
  footer: {
    flex: 0.5,
    justifyContent: 'flex-end',
    paddingHorizontal: 32,
  },
  footerText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Inter-Regular',
  },
  footerLink: {
    color: '#22D3EE',
    fontFamily: 'Inter-Medium',
  },
});

export default LoginScreen;
