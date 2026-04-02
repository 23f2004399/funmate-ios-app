import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Image,
  ImageBackground,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface GoogleProfileSetupScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'GoogleProfileSetup'>;
  route: any;
}

const GoogleProfileSetupScreen = ({ navigation, route }: GoogleProfileSetupScreenProps) => {
  const insets = useSafeAreaInsets();
  const [isLoadingUserData, setIsLoadingUserData] = useState(true);
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);

  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  // 🔥 FIX: Load Google user data with proper null checks and loading state
  useEffect(() => {
    const loadGoogleUserData = async () => {
      try {
        // First check route params
        if (route.params?.googleUser) {
          setGoogleUser(route.params.googleUser);
          setFullName(route.params.googleUser.displayName || '');
          setIsLoadingUserData(false);
          return;
        }

        // Wait for Firebase Auth to initialize
        const currentUser = auth().currentUser;
        if (!currentUser) {
          console.error('No authenticated user found');
          setIsLoadingUserData(false);
          return;
        }

        // Find Google provider in providerData
        const googleProvider = currentUser.providerData?.find(
          provider => provider?.providerId === 'google.com'
        );

        if (googleProvider) {
          const userData = {
            uid: currentUser.uid,
            email: googleProvider.email || currentUser.email || '',
            displayName: googleProvider.displayName || currentUser.displayName || '',
            photoURL: googleProvider.photoURL || currentUser.photoURL || null,
          };
          setGoogleUser(userData);
          setFullName(userData.displayName);
        } else {
          // No Google provider found - shouldn't happen, but handle gracefully
          console.warn('No Google provider found in providerData');
          const fallbackData = {
            uid: currentUser.uid,
            email: currentUser.email || '',
            displayName: currentUser.displayName || '',
            photoURL: currentUser.photoURL || null,
          };
          setGoogleUser(fallbackData);
          setFullName(fallbackData.displayName);
        }
      } catch (error) {
        console.error('Error loading Google user data:', error);
      } finally {
        setIsLoadingUserData(false);
      }
    };

    loadGoogleUserData();
  }, [route.params]);

  // Check username availability with debounce
  useEffect(() => {
    const checkUsername = async () => {
      if (!username || username.length < 3) {
        setUsernameAvailable(null);
        return;
      }

      setCheckingUsername(true);
      try {
        const snapshot = await firestore()
          .collection('users')
          .where('username', '==', username.toLowerCase())
          .limit(1)
          .get();
        
        setUsernameAvailable(snapshot.empty);
      } catch (error) {
        console.error('Username check error:', error);
      } finally {
        setCheckingUsername(false);
      }
    };

    const timeoutId = setTimeout(checkUsername, 500);
    return () => clearTimeout(timeoutId);
  }, [username]);

  const validateForm = () => {
    if (!fullName.trim()) {
      Toast.show({
        type: 'error',
        text1: 'Name Required',
        text2: 'Please enter your name',
        visibilityTime: 3000,
      });
      return false;
    }
    if (!username.trim() || username.length < 3) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Username',
        text2: 'Username must be at least 3 characters',
        visibilityTime: 3000,
      });
      return false;
    }
    if (usernameAvailable === false) {
      Toast.show({
        type: 'error',
        text1: 'Username Taken',
        text2: 'This username is already in use',
        visibilityTime: 3000,
      });
      return false;
    }
    return true;
  };

  const handleLogout = async () => {
    try {
      await auth().signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'AccountType' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Please try again',
        visibilityTime: 3000,
      });
    }
  };

  const handleContinue = () => {
    if (!validateForm()) return;
    navigation.navigate('GoogleProfileDOBSelection', { fullName, username });
  };

  // Show loading screen while fetching user data
  if (isLoadingUserData || !googleUser) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg_splash.webp')}
        style={styles.bg}
        blurRadius={6}
      >
        <View style={styles.overlay} />
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#A855F7" />
          <Text style={styles.loadingText}>Loading your profile...</Text>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.bg}
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Funmate Logo Header */}
      <View style={[styles.topHeader, { paddingTop: insets.top + 8 }]}>
        {navigation.canGoBack() ? (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        )}
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      <TouchableWithoutFeedback 
        onPress={() => {
          Keyboard.dismiss();
          setFocusedInput(null);
        }}
      >
        <View style={{ flex: 1 }}>
          <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Page title + Google account info */}
        <View style={styles.pageHeader}>
          <Text style={styles.title}>Complete Your Profile</Text>
          <Text style={styles.subtitle}>Just a few more details</Text>

          {/* Google Account Info */}
          <View style={styles.googleInfoContainer}>
            {googleUser.photoURL && (
              <Image
                source={{ uri: googleUser.photoURL }}
                style={styles.googleAvatar}
              />
            )}
            <View style={styles.googleTextContainer}>
              <Text style={styles.googleLabel}>Signing in with Google</Text>
              <Text style={styles.googleEmail}>{googleUser.email}</Text>
            </View>
          </View>
        </View>

        {/* Form Fields */}
        <View style={styles.form}>
          <View>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={[styles.input, focusedInput === 'fullName' && styles.inputFocused]}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your Name"
              placeholderTextColor="#7F93AA"
              autoCapitalize="words"
              onFocus={() => setFocusedInput('fullName')}
              onBlur={() => setFocusedInput(null)}
            />
          </View>

          <View>
            <Text style={styles.label}>Username</Text>
            <View style={styles.usernameContainer}>
              <TextInput
                style={[styles.input, focusedInput === 'username' && styles.inputFocused]}
                value={username}
                onChangeText={setUsername}
                placeholder="@username"
                placeholderTextColor="#7F93AA"
                autoCapitalize="none"
                onFocus={() => setFocusedInput('username')}
                onBlur={() => setFocusedInput(null)}
              />
              {username.length >= 3 && (
                <View style={styles.usernameStatus}>
                  {checkingUsername ? (
                    <ActivityIndicator size="small" color="#A855F7" />
                  ) : usernameAvailable === true ? (
                    <Text style={styles.availableText}>✓ Available</Text>
                  ) : usernameAvailable === false ? (
                    <Text style={styles.unavailableText}>✗ Taken</Text>
                  ) : null}
                </View>
              )}
            </View>
          </View>


        </View>

        {/* Continue Button */}
        <TouchableOpacity
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={['#8B2BE2', '#06B6D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.continueButton, { marginBottom: Math.max(32, insets.bottom + 16) }]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
        </View>
      </TouchableWithoutFeedback>


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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.60)',
    fontFamily: 'Inter-Regular',
  },
  topHeader: {
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
  pageHeader: {
    paddingHorizontal: 32,
    paddingTop: 58,
    paddingBottom: 24,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 20,
    fontFamily: 'Inter-Regular',
  },
  googleInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,28,45,0.88)',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  googleAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    marginRight: 12,
  },
  googleTextContainer: {
    flex: 1,
  },
  googleLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 2,
    fontFamily: 'Inter-Regular',
  },
  googleEmail: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  form: {
    paddingHorizontal: 32,
    gap: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(45,43,58,0.85)',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 16,
    color: '#FFFFFF',
    height: 54,
    justifyContent: 'center',
    fontFamily: 'Inter-Regular',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  inputFocused: {
    borderColor: 'rgba(139,92,246,0.80)',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 4,
  },
  inputText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  placeholderText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
  },
  usernameContainer: {
    position: 'relative',
  },
  usernameStatus: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  availableText: {
    color: '#2ECC71',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  unavailableText: {
    color: '#FF4D6D',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 32,
    marginTop: 32,
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
  bottomSpacer: {
    height: 40,
  },
});

export default GoogleProfileSetupScreen;
