/**
 * PROFILE SCREEN
 * 
 * User's complete profile with:
 * - Profile photo with completion % ring
 * - Editable fields (username, bio, interests, preferences, radius)
 * - Non-editable fields (name, age, gender)
 * - Enable location button
 * - Logout functionality
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
  PermissionsAndroid,
  Platform,
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Modal,
  FlatList,
  ImageBackground,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Svg, { Circle } from 'react-native-svg';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import Geolocation from '@react-native-community/geolocation';
import Slider from '@react-native-community/slider';
import { CommonActions, useFocusEffect } from '@react-navigation/native';
import { calculateProfileCompleteness, getMissingFields } from '../../utils/profileCompleteness';
import { useAlert } from '../../contexts/AlertContext';

type RelationshipIntent = 'casual' | 'long_term' | 'hookups' | 'friendship' | 'unsure';
type Gender = 'male' | 'female' | 'trans' | 'non_binary';

const RELATIONSHIP_OPTIONS: { value: RelationshipIntent; label: string; icon: string }[] = [
  { value: 'long_term', label: 'Long-term', icon: 'heart' },
  { value: 'casual', label: 'Casual', icon: 'cafe' },
  { value: 'friendship', label: 'Friendship', icon: 'people' },
  { value: 'hookups', label: 'Hookups', icon: 'flame' },
  { value: 'unsure', label: 'Unsure', icon: 'help-circle' },
];

const GENDER_OPTIONS: { value: Gender; label: string }[] = [
  { value: 'male', label: 'Men' },
  { value: 'female', label: 'Women' },
  { value: 'trans', label: 'Trans' },
  { value: 'non_binary', label: 'Non-binary' },
];

// Height options in cm (4'8" to 7'0")
const HEIGHT_OPTIONS = [
  { cm: 142, label: "4'8\" (142 cm)" },
  { cm: 145, label: "4'9\" (145 cm)" },
  { cm: 147, label: "4'10\" (147 cm)" },
  { cm: 150, label: "4'11\" (150 cm)" },
  { cm: 152, label: "5'0\" (152 cm)" },
  { cm: 155, label: "5'1\" (155 cm)" },
  { cm: 157, label: "5'2\" (157 cm)" },
  { cm: 160, label: "5'3\" (160 cm)" },
  { cm: 163, label: "5'4\" (163 cm)" },
  { cm: 165, label: "5'5\" (165 cm)" },
  { cm: 168, label: "5'6\" (168 cm)" },
  { cm: 170, label: "5'7\" (170 cm)" },
  { cm: 173, label: "5'8\" (173 cm)" },
  { cm: 175, label: "5'9\" (175 cm)" },
  { cm: 178, label: "5'10\" (178 cm)" },
  { cm: 180, label: "5'11\" (180 cm)" },
  { cm: 183, label: "6'0\" (183 cm)" },
  { cm: 185, label: "6'1\" (185 cm)" },
  { cm: 188, label: "6'2\" (188 cm)" },
  { cm: 191, label: "6'3\" (191 cm)" },
  { cm: 193, label: "6'4\" (193 cm)" },
  { cm: 196, label: "6'5\" (196 cm)" },
  { cm: 198, label: "6'6\" (198 cm)" },
  { cm: 201, label: "6'7\" (201 cm)" },
  { cm: 203, label: "6'8\" (203 cm)" },
  { cm: 206, label: "6'9\" (206 cm)" },
  { cm: 208, label: "6'10\" (208 cm)" },
  { cm: 211, label: "6'11\" (211 cm)" },
  { cm: 213, label: "7'0\" (213 cm)" },
];

// Occupation suggestions for autocomplete
const OCCUPATION_SUGGESTIONS = [
  'Software Engineer', 'Doctor', 'Nurse', 'Teacher', 'Professor',
  'Lawyer', 'Accountant', 'Marketing Manager', 'Data Analyst', 'Designer',
  'Product Manager', 'Consultant', 'Entrepreneur', 'Student', 'Researcher',
  'Engineer', 'Architect', 'Photographer', 'Writer', 'Artist',
  'Chef', 'Pilot', 'Flight Attendant', 'HR Manager', 'Sales Manager',
  'Business Analyst', 'Financial Analyst', 'Investment Banker', 'Trader', 'Real Estate Agent',
  'Dentist', 'Pharmacist', 'Physiotherapist', 'Psychologist', 'Veterinarian',
  'Civil Engineer', 'Mechanical Engineer', 'Electrical Engineer', 'Chemical Engineer',
  'Content Creator', 'Influencer', 'Journalist', 'Editor', 'Filmmaker',
  'Fashion Designer', 'Interior Designer', 'Graphic Designer', 'UX Designer', 'UI Designer',
  'Personal Trainer', 'Yoga Instructor', 'Life Coach', 'Counselor',
  'Police Officer', 'Military', 'Firefighter', 'Government Employee',
  'Banker', 'Insurance Agent', 'Travel Agent', 'Event Planner',
  'CA', 'CS', 'MBA', 'PhD Student', 'Medical Student', 'Law Student',
];

/**
 * Convert cm to feet/inches string
 */
const cmToFeetInches = (cm: number): string => {
  const totalInches = cm / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}'${inches}"`;
};

// Interest categories (matching signup)
const INTEREST_CATEGORIES = [
  {
    id: 'movies_tv',
    name: 'Movies & TV',
    icon: 'film-outline',
    tags: [
      'Action Movies', 'Comedy', 'Drama', 'Sci-Fi', 'Horror',
      'Romantic Comedies', 'Documentaries', 'Anime', 'Thriller',
      'Marvel', 'DC', 'Netflix', 'Stand-up Comedy', 'Reality TV',
    ],
  },
  {
    id: 'music',
    name: 'Music',
    icon: 'musical-notes-outline',
    tags: [
      'Pop', 'Rock', 'Hip Hop', 'EDM', 'Jazz', 'Classical',
      'Country', 'R&B', 'Indie', 'K-Pop', 'Metal', 'Live Music',
      'Concerts', 'Music Festivals', 'Playing Instruments',
    ],
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    icon: 'football-outline',
    tags: [
      'Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton',
      'Swimming', 'Yoga', 'Gym', 'Running', 'Cycling', 'Hiking',
      'Boxing', 'Dancing', 'Rock Climbing', 'Martial Arts',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: 'restaurant-outline',
    tags: [
      'Cooking', 'Baking', 'Coffee', 'Wine', 'Craft Beer',
      'Street Food', 'Fine Dining', 'Vegan', 'Italian Food',
      'Asian Cuisine', 'Pizza', 'Desserts', 'Food Trucks', 'BBQ',
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Adventure',
    icon: 'airplane-outline',
    tags: [
      'Beach Vacations', 'Mountain Trips', 'Road Trips', 'Backpacking',
      'Luxury Travel', 'Solo Travel', 'City Breaks', 'Camping',
      'Photography', 'Adventure Sports', 'Cultural Tours', 'Cruises',
    ],
  },
  {
    id: 'hobbies',
    name: 'Hobbies & Interests',
    icon: 'color-palette-outline',
    tags: [
      'Photography', 'Painting', 'Drawing', 'Writing', 'Reading',
      'Gaming', 'Board Games', 'Puzzles', 'Collecting', 'DIY',
      'Gardening', 'Astronomy', 'Chess', 'Magic Tricks',
    ],
  },
  {
    id: 'arts',
    name: 'Arts & Culture',
    icon: 'brush-outline',
    tags: [
      'Museums', 'Art Galleries', 'Theater', 'Opera', 'Ballet',
      'Poetry', 'Literature', 'History', 'Philosophy', 'Design',
      'Architecture', 'Fashion', 'Vintage Shopping',
    ],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    icon: 'heart-outline',
    tags: [
      'Meditation', 'Mindfulness', 'Sustainability', 'Volunteering',
      'Animal Lover', 'Dogs', 'Cats', 'Plant Parent', 'Minimalism',
      'Festivals', 'Spirituality', 'Self-improvement', 'Podcasts',
    ],
  },
  {
    id: 'social',
    name: 'Social & Nightlife',
    icon: 'people-outline',
    tags: [
      'Clubbing', 'Karaoke', 'Pub Quiz', 'Game Nights', 'Brunch',
      'House Parties', 'Rooftop Bars', 'Comedy Shows', 'Trivia',
      'Socializing', 'Networking', 'Making Friends',
    ],
  },
  {
    id: 'tech',
    name: 'Tech & Innovation',
    icon: 'laptop-outline',
    tags: [
      'Coding', 'AI', 'Startups', 'Crypto', 'Tech Gadgets',
      'Video Editing', 'Content Creation', 'Social Media',
      'Blogging', 'YouTube', 'E-sports', 'VR/AR',
    ],
  },
];

const ProfileScreen = ({ navigation }: any) => {
  const { showConfirm, showWarning } = useAlert();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [completeness, setCompleteness] = useState(0);

  // Editable fields
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [relationshipIntent, setRelationshipIntent] = useState<RelationshipIntent | null>(null);
  const [interestedIn, setInterestedIn] = useState<Gender[]>([]);
  const [matchRadiusKm, setMatchRadiusKm] = useState(25);
  
  // New fields
  const [height, setHeight] = useState<number | null>(null);
  const [heightDisplayUnit, setHeightDisplayUnit] = useState<'cm' | 'ft'>('ft');
  const [showHeightPicker, setShowHeightPicker] = useState(false);
  const [occupation, setOccupation] = useState('');
  const [filteredOccupations, setFilteredOccupations] = useState<string[]>([]);
  const [showOccupationSuggestions, setShowOccupationSuggestions] = useState(false);
  const [instagram, setInstagram] = useState('');
  const [linkedin, setLinkedin] = useState('');
  const [facebook, setFacebook] = useState('');
  const [twitter, setTwitter] = useState('');

  const [editMode, setEditMode] = useState<string | null>(null); // 'bio', 'interests', etc.
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [tempInterests, setTempInterests] = useState<string[]>([]);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);

  const userId = auth().currentUser?.uid;

  /**
   * Fetch user data
   */
  useEffect(() => {
    if (!userId) return;

    const fetchUserData = async () => {
      try {
        const userDoc = await firestore().collection('users').doc(userId).get();
        const data = userDoc.data();

        if (data) {
          setUserData(data);
          setName(data.name || '');
          setUsername(data.username || '');
          setBio(data.bio || '');
          setInterests(data.interests || []);
          setRelationshipIntent(data.relationshipIntent || null);
          setInterestedIn(data.interestedIn || []);
          setMatchRadiusKm(data.matchRadiusKm || 25);
          
          // Load new fields
          setHeight(data.height?.value || null);
          setHeightDisplayUnit(data.height?.displayUnit || 'ft');
          setOccupation(data.occupation || '');
          setInstagram(data.socialHandles?.instagram || '');
          setLinkedin(data.socialHandles?.linkedin || '');
          setFacebook(data.socialHandles?.facebook || '');
          setTwitter(data.socialHandles?.twitter || '');

          // Calculate completeness
          const percent = calculateProfileCompleteness(data);
          setCompleteness(percent);
        }

        setLoading(false);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setLoading(false);
      }
    };

    fetchUserData();
  }, [userId]);

  /**
   * Refresh profile data and recalculate completeness
   */
  const refreshProfileData = useCallback(async () => {
    if (!userId) return;
    
    try {
      // Check current location permission
      const hasLocationPermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );

      // Fetch fresh user data from Firestore
      const userDoc = await firestore().collection('users').doc(userId).get();
      const data = userDoc.data();

      if (data) {
        // If permission was revoked, clear location from Firestore
        if (!hasLocationPermission && data.location) {
          await firestore()
            .collection('users')
            .doc(userId)
            .update({ location: null });
          data.location = null;
        }

        setUserData(data);
        setUsername(data.username || '');
        setBio(data.bio || '');
        setInterests(data.interests || []);
        setRelationshipIntent(data.relationshipIntent || null);
        setInterestedIn(data.interestedIn || []);
        setMatchRadiusKm(data.matchRadiusKm || 25);
        
        // Load new fields on refresh
        setHeight(data.height?.value || null);
        setHeightDisplayUnit(data.height?.displayUnit || 'ft');
        setOccupation(data.occupation || '');
        setInstagram(data.socialHandles?.instagram || '');
        setLinkedin(data.socialHandles?.linkedin || '');
        setFacebook(data.socialHandles?.facebook || '');
        setTwitter(data.socialHandles?.twitter || '');

        // Recalculate completeness with current data
        const percent = calculateProfileCompleteness(data);
        setCompleteness(percent);
      }
    } catch (error) {
      console.error('Error refreshing profile data:', error);
    }
  }, [userId]);

  /**
   * Refresh on screen focus (e.g., returning from Settings)
   */
  useFocusEffect(
    useCallback(() => {
      refreshProfileData();
    }, [refreshProfileData])
  );

  /**
   * Refresh when app returns from background (e.g., after changing permissions in Settings)
   */
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshProfileData();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [refreshProfileData]);

  /**
   * Save profile changes
   */
  const handleSave = async () => {
    // Validate name - cannot be empty
    if (editMode === 'name') {
      if (!name.trim()) {
        Toast.show({
          type: 'error',
          text1: 'Name Required',
          text2: 'Full name cannot be empty',
          visibilityTime: 3000,
        });
        return;
      }
    }

    // Validation for interests
    if (editMode === 'interests') {
      if (tempInterests.length > 0 && tempInterests.length < 5) {
        Toast.show({
          type: 'error',
          text1: 'Select More Interests',
          text2: `You must select at least 5 interests or none (${tempInterests.length}/5)`,
          visibilityTime: 3000,
        });
        return;
      }
    }

    setSaving(true);

    try {
      if (!userId) throw new Error('User not authenticated');

      const updateData: any = {};

      if (editMode === 'name') updateData.name = name.trim();
      if (editMode === 'username') updateData.username = username;
      if (editMode === 'bio') updateData.bio = bio;
      if (editMode === 'interests') updateData.interests = tempInterests;
      if (editMode === 'intent') updateData.relationshipIntent = relationshipIntent;
      if (editMode === 'gender') updateData.interestedIn = interestedIn;
      if (editMode === 'radius') updateData.matchRadiusKm = matchRadiusKm;
      if (editMode === 'height') updateData.height = height ? { value: height, displayUnit: heightDisplayUnit } : null;
      if (editMode === 'occupation') updateData.occupation = occupation.trim() || null;
      if (editMode === 'social') updateData.socialHandles = (instagram || linkedin || facebook || twitter) ? {
        instagram: instagram.trim() || null,
        linkedin: linkedin.trim() || null,
        facebook: facebook.trim() || null,
        twitter: twitter.trim() || null,
      } : null;

      await firestore()
        .collection('users')
        .doc(userId)
        .update(updateData);

      // Update local state
      if (editMode === 'interests') {
        setInterests(tempInterests);
      }

      // Recalculate completeness
      const updatedData = {
        ...userData,
        name: editMode === 'name' ? name.trim() : userData.name,
        username,
        bio,
        interests: editMode === 'interests' ? tempInterests : interests,
        relationshipIntent,
        interestedIn,
        matchRadiusKm,
      };
      const percent = calculateProfileCompleteness(updatedData);
      setCompleteness(percent);
      setUserData(updatedData);

      Toast.show({
        type: 'success',
        text1: 'Profile Updated',
        text2: 'Your changes have been saved',
        visibilityTime: 2000,
      });

      setEditMode(null);
      setExpandedCategory(null);
    } catch (error: any) {
      console.error('Error saving profile:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Could not save changes',
        visibilityTime: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * Request location permission
   */
  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        // First check if permission is already granted
        const checkResult = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (checkResult) {
          console.log('Location permission already granted');
          return true;
        }

        // Request permission
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          {
            title: 'Location Permission',
            message: 'Funmate needs access to your location to find matches nearby',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );

        console.log('Permission request result:', granted);
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          return true;
        } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          showWarning(
            'Permission Required',
            'Location permission was denied. Please enable it in Settings > Apps > Funmate > Permissions > Location'
          );
          return false;
        } else {
          return false;
        }
      } catch (err) {
        console.warn('Permission error:', err);
        return false;
      }
    }
    return true;
  };

  /**
   * Get current location coordinates
   */
  const getCurrentLocation = (): Promise<{ latitude: number; longitude: number } | null> => {
    return new Promise((resolve) => {
      // Try network-based location first (WiFi/cell towers) - works indoors
      console.log('Attempting to get location (network-based)...');
      
      Geolocation.getCurrentPosition(
        (position) => {
          console.log('✅ Location obtained:', position.coords);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('❌ Location error:', error);
          // If network location fails, show user-friendly error
          resolve(null);
        },
        { 
          enableHighAccuracy: false,  // Use network location (WiFi/cell) - faster, works indoors
          timeout: 15000,              // 15 seconds timeout
          maximumAge: 300000           // Accept location up to 5 minutes old
        }
      );
    });
  };

  /**
   * Enable location
   */
  const handleEnableLocation = async () => {
    try {
      console.log('🔍 Starting location enable flow...');
      
      const hasPermission = await requestLocationPermission();
      
      console.log('Permission result:', hasPermission);
      
      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission Denied',
          text2: 'Location access is required for better matches',
          visibilityTime: 3000,
        });
        return;
      }

      console.log('✅ Permission granted, getting location...');

      Toast.show({
        type: 'info',
        text1: 'Getting Location...',
        text2: 'Using WiFi and cell towers',
        visibilityTime: 3000,
      });

      const coords = await getCurrentLocation();
      
      if (!coords) {
        showWarning(
          'Location Unavailable',
          'Could not get your location. Please ensure Location/GPS is enabled in your device settings.\n\nGo to: Settings > Location > Turn ON'
        );
        return;
      }

      console.log('✅ Location obtained, saving to Firestore...');

      // Save location to Firestore
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          location: {
            latitude: coords.latitude,
            longitude: coords.longitude,
          },
        });

      console.log('✅ Location saved successfully');

      // Update local state
      const updatedData = {
        ...userData,
        location: coords,
      };
      setUserData(updatedData);
      const percent = calculateProfileCompleteness(updatedData);
      setCompleteness(percent);

      Toast.show({
        type: 'success',
        text1: 'Location Enabled! 📍',
        text2: 'You\'ll now see matches nearby',
        visibilityTime: 2000,
      });

    } catch (error: any) {
      console.error('❌ Error enabling location:', error);
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: error.message || 'Could not enable location',
        visibilityTime: 3000,
      });
    }
  };

  /**
   * Logout
   */
  const handleLogout = () => {
    showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      async () => {
        try {
          await auth().signOut();
          
          // Reset navigation stack to Login
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Login' }],
            })
          );
          
          Toast.show({
            type: 'success',
            text1: 'Logged Out',
            text2: 'See you soon!',
            visibilityTime: 2000,
          });
        } catch (error) {
          console.error('Logout error:', error);
        }
      },
      { confirmText: 'Logout', destructive: true, icon: 'log-out-outline' }
    );
  };

  /**
   * Toggle interest
   */
  const toggleInterest = (interest: string) => {
    if (tempInterests.includes(interest)) {
      setTempInterests(prev => prev.filter(i => i !== interest));
    } else {
      if (tempInterests.length >= 15) {
        Toast.show({
          type: 'error',
          text1: 'Maximum Reached',
          text2: 'You can select up to 15 interests',
          visibilityTime: 2000,
        });
        return;
      }
      setTempInterests(prev => [...prev, interest]);
    }
  };

  /**
   * Toggle gender preference
   */
  const toggleGenderPreference = (gender: Gender) => {
    if (interestedIn.includes(gender)) {
      setInterestedIn(prev => prev.filter(g => g !== gender));
    } else {
      setInterestedIn(prev => [...prev, gender]);
    }
  };

  // if (loading) {
  //   return (
  //     <View style={styles.loadingContainer}>
  //       <StatusBar barStyle="light-content" backgroundColor="#0D0B1E" />
  //       <ActivityIndicator size="large" color="#8B2BE2" />
  //     </View>
  //   );
  // }

  if (loading) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg_splash.webp')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
          <View style={[styles.loadingContainer, { paddingTop: insets.top, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
            <ActivityIndicator size="large" color="#8B2BE2" />
          </View>
        </View>
      </ImageBackground>
    );
  }

  // if (!userData) {
  //   return (
  //     <View style={styles.loadingContainer}>
  //       <Text style={styles.errorText}>No profile data found</Text>
  //     </View>
  //   );
  // }

  if (!userData) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg_splash.webp')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
          <View style={[styles.loadingContainer, { paddingTop: insets.top, paddingBottom: Math.max(24, insets.bottom + 12) }]}>
            <Text style={styles.errorText}>No profile data found</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const primaryPhoto = userData.photos?.find((p: any) => p.isPrimary)?.url || 
                       userData.photos?.[0]?.url || 
                       'https://via.placeholder.com/150';

  const missingFields = getMissingFields(userData);

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        {/* Sticky Header */}
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <Text style={styles.headerTitle}>Profile</Text>
          <View style={styles.headerActions}>
            <View style={styles.settingsIconContainer}>
              <TouchableOpacity 
                style={styles.gearIcon}
                onPress={() => setShowSettingsDropdown(!showSettingsDropdown)}
              >
                <Ionicons name="settings-outline" size={24} color="#8B2BE2" />
              </TouchableOpacity>
              
              {showSettingsDropdown && (
                <View style={styles.settingsDropdown}>
                  <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowSettingsDropdown(false);
                      (navigation as any).navigate('NotificationSettings');
                    }}
                  >
                    <Ionicons name="notifications-outline" size={20} color="#8B2BE2" />
                    <Text style={styles.dropdownItemText}>Notification Settings</Text>
                  </TouchableOpacity>
                  <View style={styles.dropdownDivider} />
                  <TouchableOpacity 
                    style={styles.dropdownItem}
                    onPress={() => {
                      setShowSettingsDropdown(false);
                      (navigation as any).navigate('BlockedUsers');
                    }}
                  >
                    <Ionicons name="ban-outline" size={20} color="#A855F7" />
                    <Text style={styles.dropdownItemText}>Blocked Users</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
              <Ionicons name="log-out-outline" size={24} color="#FF4D6D" />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAwareScrollView
          style={styles.scrollView}
          contentContainerStyle={{
            paddingTop: 8,
            paddingBottom: Math.max(100, insets.bottom + 32),
          }}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={120}
          extraHeight={180}
          keyboardOpeningTime={0}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

        {/* Profile Photo with Completion Ring */}
        <View style={styles.photoSection}>
          <View style={styles.photoContainer}>
            <Svg width={140} height={140} style={styles.progressRing}>
              <Circle
                cx="70"
                cy="70"
                r="65"
                stroke="rgba(255,255,255,0.12)"
                strokeWidth="6"
                fill="none"
              />
              <Circle
                cx="70"
                cy="70"
                r="65"
                stroke="#8B2BE2"
                strokeWidth="6"
                fill="none"
                strokeDasharray={`${2 * Math.PI * 65}`}
                strokeDashoffset={`${2 * Math.PI * 65 * (1 - completeness / 100)}`}
                strokeLinecap="round"
                rotation="-90"
                origin="70, 70"
              />
            </Svg>
            <Image source={{ uri: primaryPhoto }} style={styles.profilePhoto} />
          </View>
          <View style={styles.completenessChip}>
            <Text style={styles.completenessText}>{completeness}% Complete</Text>
          </View>
          <View style={styles.usernameContainer}>
            <View style={styles.usernameWrapper}>
              {editMode === 'username' ? (
                <TextInput
                  style={styles.usernameInput}
                  value={username}
                  onChangeText={setUsername}
                  placeholder="Enter username"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoFocus
                />
              ) : (
                <Text style={styles.usernameText}>@{username || 'Not set'}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.usernameEditButton}
              onPress={() => editMode === 'username' ? handleSave() : setEditMode('username')}
            >
              {editMode === 'username' ? (
                <Text style={styles.usernameSaveText}>Save</Text>
              ) : (
                // <Ionicons name="pencil" size={22} color="#8B2BE2" />
                <Ionicons name="pencil" size={22} color="#A855F7" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* About Me Section */}
        <View style={styles.section}>
          <Text style={styles.aboutMeHeader}>About Me</Text>

          {/* Bio */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Ionicons name="document-text" size={20} color="#8B2BE2" style={styles.fieldIcon} />
              <Text style={styles.fieldLabel}>Bio</Text>
              {!bio && <Ionicons name="alert-circle" size={16} color="#F4B400" style={styles.fieldWarningIcon} />}
            </View>
            {editMode === 'bio' ? (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditMode('bio')}>
                {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                <Ionicons name="pencil" size={22} color="#A855F7" />
              </TouchableOpacity>
            )}
          </View>
          {editMode === 'bio' ? (
            <TextInput
              style={[styles.fieldInput, styles.bioFieldInput]}
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself (min 20 characters)"
              placeholderTextColor="rgba(255,255,255,0.35)"
              multiline
              maxLength={500}
              autoFocus
            />
          ) : (
            <View style={styles.bioDisplayBox}>
              <Text style={styles.bioDisplayText}>{bio || 'No bio yet'}</Text>
            </View>
          )}

          <View style={styles.fieldDivider} />

          {/* Full Name and Age Row */}
          <View style={styles.twoColumnRow}>
            {/* Full Name - Left */}
            <View style={styles.columnLeft}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  <Ionicons name="person" size={20} color="#8B2BE2" style={styles.fieldIcon} />
                  <Text style={styles.fieldLabel}>Full Name</Text>
                </View>
                {editMode === 'name' ? (
                  <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveButton}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode('name')}>
                    {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                    <Ionicons name="pencil" size={22} color="#A855F7" />
                  </TouchableOpacity>
                )}
              </View>
              {editMode === 'name' ? (
                <TextInput
                  style={styles.fieldInput}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter your full name"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  autoFocus
                />
              ) : (
                <View style={styles.fieldValueBox}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={styles.fieldValueBoxText}>{userData.name}</Text>
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Age - Right */}
            <View style={styles.columnRight}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  <Ionicons name="calendar" size={20} color="#8B2BE2" style={styles.fieldIcon} />
                  <Text style={styles.fieldLabel}>Age</Text>
                </View>
              </View>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueBoxText}>{userData.age} years old</Text>
              </View>
            </View>
          </View>

          <View style={styles.fieldDivider} />

          {/* Gender and Height Row */}
          <View style={styles.twoColumnRow}>
            {/* Gender - Left */}
            <View style={styles.columnLeft}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  <Ionicons name={userData.gender === 'male' ? 'male' : 'female'} size={20} color="#8B2BE2" style={styles.fieldIcon} />
                  <Text style={styles.fieldLabel}>Gender</Text>
                </View>
              </View>
              <View style={styles.fieldValueBox}>
                <Text style={styles.fieldValueBoxText}>{userData.gender}</Text>
              </View>
            </View>

            {/* Height - Right */}
            <View style={styles.columnRight}>
              <View style={styles.fieldRow}>
                <View style={styles.fieldLeft}>
                  <Ionicons name="body" size={20} color="#8B2BE2" style={styles.fieldIcon} />
                  <Text style={styles.fieldLabel}>Height</Text>
                  {!height && <Ionicons name="alert-circle" size={16} color="#F4B400" style={styles.fieldWarningIcon} />}
                </View>
                {editMode === 'height' ? (
                  <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveButton}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode('height')}>
                    {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                    <Ionicons name="pencil" size={22} color="#A855F7" />
                  </TouchableOpacity>
                )}
              </View>
              {editMode === 'height' ? (
                <TextInput
                  style={styles.fieldInput}
                  placeholder="Enter height in cm"
                  placeholderTextColor="rgba(255,255,255,0.35)"
                  value={height ? height.toString() : ''}
                  onChangeText={(text) => {
                    const numValue = parseInt(text);
                    if (text === '') {
                      setHeight(null);
                    } else if (!isNaN(numValue) && numValue > 0 && numValue <= 300) {
                      setHeight(numValue);
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                  autoFocus
                />
              ) : (
                <View style={styles.fieldValueBox}>
                  <Text style={styles.fieldValueBoxText}>{height ? `${height} cm` : 'Not set'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={styles.fieldDivider} />

          {/* Occupation */}
          <View style={styles.fieldRow}>
            <View style={styles.fieldLeft}>
              <Ionicons name="briefcase" size={20} color="#8B2BE2" style={styles.fieldIcon} />
              <Text style={styles.fieldLabel}>Occupation</Text>
              {!occupation && <Ionicons name="alert-circle" size={16} color="#F4B400" style={styles.fieldWarningIcon} />}
            </View>
            {editMode === 'occupation' ? (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditMode('occupation')}>
                {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                <Ionicons name="pencil" size={22} color="#A855F7" />
              </TouchableOpacity>
            )}
          </View>
          {editMode === 'occupation' ? (
            <View>
              <TextInput
                style={styles.fieldInput}
                value={occupation}
                onChangeText={(text) => {
                  setOccupation(text);
                  if (text.length >= 2) {
                    const filtered = OCCUPATION_SUGGESTIONS.filter(occ =>
                      occ.toLowerCase().includes(text.toLowerCase())
                    ).slice(0, 5);
                    setFilteredOccupations(filtered);
                  } else {
                    setFilteredOccupations([]);
                  }
                }}
                placeholder="e.g., Software Engineer, Doctor, Student..."
                placeholderTextColor="rgba(255,255,255,0.35)"
                maxLength={50}
                autoFocus
              />
              {filteredOccupations.length > 0 && occupation.length >= 2 && (
                <View style={styles.suggestionsList}>
                  {filteredOccupations.map((occ, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.suggestionItemInline}
                      onPress={() => {
                        setOccupation(occ);
                        setFilteredOccupations([]);
                      }}
                    >
                      <Text style={styles.suggestionTextInline}>{occ}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.fieldValueBox}>
              <Text style={styles.fieldValueBoxText}>{occupation || 'Not set'}</Text>
            </View>
          )}
        </View>

        {/* My Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.aboutMeHeader}>My Preferences</Text>

        {/* Interests (Editable - Full Section Like Signup) */}
        <View style={styles.preferenceSubSection}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithIcon}>
              {interests.length === 0 && <Ionicons name="alert-circle" size={18} color="#F4B400" style={styles.warningIcon} />}
              <Text style={styles.sectionTitle}>Interests</Text>
            </View>
            {editMode === 'interests' ? (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                onPress={() => {
                  setTempInterests(interests);
                  setEditMode('interests');
                }}
              >
                {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                <Ionicons name="pencil" size={22} color="#A855F7" />
              </TouchableOpacity>
            )}
          </View>
          
          {editMode === 'interests' ? (
            <>
              {/* Interest Count */}
              <View style={styles.interestCount}>
                <Text style={styles.countText}>
                  {tempInterests.length} / 15 selected
                </Text>
                <Text style={[
                  styles.minText,
                  tempInterests.length >= 5 && styles.minTextSuccess
                ]}>
                  {tempInterests.length >= 5 ? '✓ Minimum met' : tempInterests.length === 0 ? 'Min: 5 or none' : `Min: 5 (${tempInterests.length}/5)`}
                </Text>
              </View>

              {/* Selected Chips */}
              {tempInterests.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectedChipsScroll}
                  contentContainerStyle={styles.selectedChipsContainer}
                >
                  {tempInterests.map((interest) => (
                    <TouchableOpacity
                      key={interest}
                      style={styles.selectedChip}
                      onPress={() => toggleInterest(interest)}
                    >
                      <Text style={styles.selectedChipText}>{interest}</Text>
                      <Ionicons name="close-circle" size={18} color="#FFFFFF" />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* Categories - Horizontal Icon Scroll (matching signup screen) */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesScrollContent}
                style={styles.categoriesScroll}
              >
                {INTEREST_CATEGORIES.map((category) => {
                  const selectedCount = category.tags.filter(tag => tempInterests.includes(tag)).length;
                  const isExpanded = expandedCategory === category.id;
                  
                  return (
                    <View key={category.id} style={styles.categoryWrapper}>
                      <TouchableOpacity
                        style={[styles.categoryIconButton, isExpanded && styles.categoryIconButtonActive]}
                        onPress={() => setExpandedCategory(isExpanded ? null : category.id)}
                        activeOpacity={0.7}
                      >
                        <Ionicons name={category.icon as any} size={32} color={isExpanded ? "#FFFFFF" : "#A855F7"} />
                        {selectedCount > 0 && (
                          <View style={styles.iconBadge}>
                            <Text style={styles.iconBadgeText}>{selectedCount}</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Expanded Category Content */}
              {expandedCategory && (
                <View style={styles.expandedSection}>
                  {(() => {
                    const category = INTEREST_CATEGORIES.find(c => c.id === expandedCategory);
                    if (!category) return null;
                    
                    return (
                      <>
                        <View style={styles.expandedHeader}>
                          <Text style={styles.expandedTitle}>{category.name}</Text>
                          <TouchableOpacity
                            onPress={() => setExpandedCategory(null)}
                            activeOpacity={0.7}
                            style={styles.closeButton}
                          >
                            <Ionicons name="close" size={24} color="rgba(255,255,255,0.55)" />
                          </TouchableOpacity>
                        </View>
                        
                        <View style={styles.tagsContainer}>
                          {category.tags.map((tag) => {
                            const isSelected = tempInterests.includes(tag);
                            return (
                              <TouchableOpacity
                                key={tag}
                                style={[
                                  styles.interestTag,
                                  isSelected && styles.interestTagSelected,
                                ]}
                                onPress={() => toggleInterest(tag)}
                                activeOpacity={0.7}
                              >
                                <Text
                                  style={[
                                    styles.interestTagText,
                                    isSelected && styles.interestTagTextSelected,
                                  ]}
                                >
                                  {tag}
                                </Text>
                                {isSelected && (
                                  <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
                                )}
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    );
                  })()}
                </View>
              )}
            </>
          ) : (
            <View style={styles.interestsDisplay}>
              {interests.length > 0 ? (
                interests.map((interest, i) => (
                  <View key={i} style={styles.interestDisplayTag}>
                    <Text style={styles.interestDisplayTagText}>{interest}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.displayValue}>No interests selected</Text>
              )}
            </View>
          )}
        </View>

        <View style={styles.preferenceDivider} />

        {/* Looking For and Interested In Row */}
        <View style={styles.twoColumnRow}>
          {/* Interested In - Left */}
          <View style={styles.columnLeft}>
            <View style={styles.preferenceSubSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWithIcon}>
                  {interestedIn.length === 0 && <Ionicons name="alert-circle" size={18} color="#F4B400" style={styles.warningIcon} />}
                  <Text style={styles.sectionTitle}>Interested In</Text>
                </View>
                {editMode === 'gender' ? (
                  <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveButton}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode('gender')}>
                    {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                    <Ionicons name="pencil" size={22} color="#A855F7" />
                  </TouchableOpacity>
                )}
              </View>
              
              {editMode === 'gender' ? (
                <View style={styles.optionsGrid}>
                  {GENDER_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        interestedIn.includes(option.value) && styles.optionButtonSelected,
                      ]}
                      onPress={() => toggleGenderPreference(option.value)}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          interestedIn.includes(option.value) && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.displayValue}>
                  {interestedIn.length > 0 ? GENDER_OPTIONS.filter(o => interestedIn.includes(o.value)).map(o => o.label).join(', ') : 'Not set'}
                </Text>
              )}
            </View>
          </View>

          {/* Looking For - Right */}
          <View style={styles.columnRight}>
            <View style={styles.preferenceSubSection}>
              <View style={styles.sectionHeader}>
                <View style={styles.titleWithIcon}>
                  {!relationshipIntent && <Ionicons name="alert-circle" size={18} color="#F4B400" style={styles.warningIcon} />}
                  <Text style={styles.sectionTitle}>Looking For</Text>
                </View>
                {editMode === 'intent' ? (
                  <TouchableOpacity onPress={handleSave} disabled={saving}>
                    <Text style={styles.saveButton}>Save</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => setEditMode('intent')}>
                    {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                    <Ionicons name="pencil" size={22} color="#A855F7" />
                  </TouchableOpacity>
                )}
              </View>
              
              {editMode === 'intent' ? (
                <View style={styles.optionsGrid}>
                  {RELATIONSHIP_OPTIONS.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionButton,
                        relationshipIntent === option.value && styles.optionButtonSelected,
                      ]}
                      onPress={() => setRelationshipIntent(option.value)}
                    >
                      <Ionicons
                        name={option.icon as any}
                        size={20}
                        color={relationshipIntent === option.value ? '#FFFFFF' : 'rgba(255,255,255,0.55)'}
                      />
                      <Text
                        style={[
                          styles.optionText,
                          relationshipIntent === option.value && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.displayValue}>
                  {RELATIONSHIP_OPTIONS.find(o => o.value === relationshipIntent)?.label || 'Not set'}
                </Text>
              )}
            </View>
          </View>
        </View>

        <View style={styles.preferenceDivider} />

        {/* Match Radius (Editable) */}
        <View style={styles.preferenceSubSectionLast}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Match Radius: {matchRadiusKm} km</Text>
            {editMode === 'radius' ? (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditMode('radius')}>
                {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                <Ionicons name="pencil" size={22} color="#A855F7" />
              </TouchableOpacity>
            )}
          </View>
          
          {editMode === 'radius' && (
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={100}
              step={1}
              value={matchRadiusKm}
              onValueChange={setMatchRadiusKm}
              minimumTrackTintColor="#8B2BE2"
              maximumTrackTintColor="rgba(255,255,255,0.12)"
              thumbTintColor="#06B6D4"
            />
          )}
        </View>
        </View>

        {/* Social Handles (Editable) */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.titleWithIcon}>
              {!instagram && !linkedin && !facebook && !twitter && <Ionicons name="alert-circle" size={18} color="#F4B400" style={styles.warningIcon} />}
              <Text style={styles.sectionTitle}>Social Handles</Text>
            </View>
            {editMode === 'social' ? (
              <TouchableOpacity onPress={handleSave} disabled={saving}>
                <Text style={styles.saveButton}>Save</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={() => setEditMode('social')}>
                {/* <Ionicons name="pencil" size={22} color="#8B2BE2" /> */}
                <Ionicons name="pencil" size={22} color="#A855F7" />
              </TouchableOpacity>
            )}
          </View>
          
          {editMode === 'social' ? (
            <View style={styles.socialEditContainer}>
              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  <View style={styles.socialInputRow}>
                    <Ionicons name="logo-instagram" size={22} color="#E4405F" />
                    <TextInput
                      style={styles.socialInput}
                      value={instagram}
                      onChangeText={setInstagram}
                      placeholder="@username"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCapitalize="none"
                      maxLength={30}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  <View style={styles.socialInputRow}>
                    <Ionicons name="logo-facebook" size={22} color="#1877F2" />
                    <TextInput
                      style={styles.socialInput}
                      value={facebook}
                      onChangeText={setFacebook}
                      placeholder="username"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCapitalize="none"
                      maxLength={100}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  <View style={styles.socialInputRow}>
                    <Ionicons name="logo-linkedin" size={22} color="#0A66C2" />
                    <TextInput
                      style={styles.socialInput}
                      value={linkedin}
                      onChangeText={setLinkedin}
                      placeholder="username"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCapitalize="none"
                      maxLength={100}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  <View style={styles.socialInputRow}>
                    <Text style={styles.xLogoSmall}>𝕏</Text>
                    <TextInput
                      style={styles.socialInput}
                      value={twitter}
                      onChangeText={setTwitter}
                      placeholder="@username"
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      autoCapitalize="none"
                      maxLength={30}
                    />
                  </View>
                </View>
              </View>
            </View>
          ) : (
            <View style={styles.socialDisplayContainer}>
              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  {instagram ? (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Ionicons name="logo-instagram" size={18} color="#E4405F" />
                        <Text style={styles.socialDisplayText}>@{instagram.replace('@', '')}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Ionicons name="logo-instagram" size={18} color="rgba(255,255,255,0.55)" />
                        <Text style={styles.socialDisplayTextEmpty}>Not set</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  {facebook ? (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Ionicons name="logo-facebook" size={18} color="#1877F2" />
                        <Text style={styles.socialDisplayText}>{facebook}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Ionicons name="logo-facebook" size={18} color="rgba(255,255,255,0.55)" />
                        <Text style={styles.socialDisplayTextEmpty}>Not set</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  {linkedin ? (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Ionicons name="logo-linkedin" size={18} color="#0A66C2" />
                        <Text style={styles.socialDisplayText}>{linkedin}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Ionicons name="logo-linkedin" size={18} color="rgba(255,255,255,0.55)" />
                        <Text style={styles.socialDisplayTextEmpty}>Not set</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>

              <View style={styles.socialSingleRow}>
                <View style={styles.socialSingleItem}>
                  {twitter ? (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Text style={styles.xLogoDisplay}>𝕏</Text>
                        <Text style={styles.socialDisplayText}>@{twitter.replace('@', '')}</Text>
                      </View>
                    </View>
                  ) : (
                    <View style={styles.socialDisplayBox}>
                      <View style={styles.socialDisplayRow}>
                        <Text style={styles.xLogoDisplayGray}>𝕏</Text>
                        <Text style={styles.socialDisplayTextEmpty}>Not set</Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            </View>
          )}
        </View>

        <View style={{ height: 24 }} />
      </KeyboardAwareScrollView>

    </View>
    </ImageBackground>
  );
};


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B1E',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.60)',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: '#0D0B1E',
  },
  errorText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  scrollView: {
    flex: 1,
  },
  // header: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  //   alignItems: 'center',
  //   paddingHorizontal: 20,
  //   paddingTop: 50,
  //   paddingBottom: 20,
  //   backgroundColor: '#0D0B1E',
  //   borderBottomWidth: 2,
  //   borderBottomColor: '#0D0B1E',
  //   shadowColor: '#8B2BE2',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.8,
  //   shadowRadius: 8,
  //   elevation: 10,
  //   zIndex: 1000,
  // },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: 'rgba(13, 11, 30, 0.72)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    position: 'relative',
    zIndex: 2000,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoutButton: {
    padding: 8,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    marginHorizontal: 16,
    marginTop: 16,
  },
  photoContainer: {
    position: 'relative',
    width: 140,
    height: 140,
    marginBottom: 12,
  },
  progressRing: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    position: 'absolute',
    top: 10,
    left: 10,
  },
  completenessChip: {
    backgroundColor: 'rgba(139, 92, 246, 0.16)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  completenessText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  usernameContainer: {
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    position: 'relative',
  },
  usernameWrapper: {
    alignItems: 'center',
  },
  usernameText: {
    fontSize: 20,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  usernameInput: {
    fontSize: 18,
    color: '#FFFFFF',
    backgroundColor: '#16112B',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.80)',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 18,
    minWidth: 160,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  usernameEditButton: {
    position: 'absolute',
    right: 80,
    top: 0,
    paddingVertical: 4,
  },
  usernameSaveText: {
    fontSize: 14,
    color: '#22D3EE',
    fontFamily: 'Inter-SemiBold',
  },
  missingText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  fieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fieldIcon: {
    marginTop: 1,
  },
  fieldWarningIcon: {
    marginTop: 2,
  },
  fieldLabel: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  fieldValue: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 12,
    marginLeft: 20,
  },
  fieldValueBox: {
    backgroundColor: '#16112B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    marginLeft: 20,
  },
  fieldValueBoxText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  fieldInput: {
    height: 54,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#16112B',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.80)',
    borderRadius: 14,
    paddingHorizontal: 18,
    marginBottom: 12,
    marginLeft: 20,
    fontFamily: 'Inter-Regular',
  },
  bioDisplayBox: {
    backgroundColor: '#16112B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    marginLeft: 20,
    minHeight: 100,
  },
  bioDisplayText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  bioFieldInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
    paddingBottom: 14,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 12,
  },
  settingsIconContainer: {
    position: 'relative',
    zIndex: 2100,
  },
  gearIcon: {
    padding: 8,
  },
  // settingsDropdown: {
  //   position: 'absolute',
  //   top: 40,
  //   right: 0,
  //   backgroundColor: '#1A1530',
  //   borderRadius: 12,
  //   borderWidth: 2,
  //   borderColor: '#8B2BE2',
  //   minWidth: 200,
  //   shadowColor: '#8B2BE2',
  //   shadowOffset: { width: 0, height: 4 },
  //   shadowOpacity: 0.3,
  //   shadowRadius: 8,
  //   elevation: 20,
  //   zIndex: 1002,
  // },
  settingsDropdown: {
    position: 'absolute',
    top: 40,
    right: 0,
    backgroundColor: '#1A1530',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    minWidth: 220,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 20,
    zIndex: 2200,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  dropdownItemText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  section: {
    backgroundColor: '#1A1530',
    marginTop: 12,
    marginHorizontal: 16,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.18)',
  },
  preferenceSubSection: {
    marginBottom: 20,
  },
  preferenceSubSectionLast: {
    marginBottom: 0,
  },
  preferenceDivider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.10)',
    marginVertical: 20,
  },
  aboutMeHeader: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.10)',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warningIcon: {
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  saveButton: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#22D3EE',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 2,
  },
  infoValue: {
    fontSize: 16,
    color: '#FFFFFF',
    textTransform: 'capitalize',
  },
  input: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#16112B',
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  displayValue: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 24,
  },
  // Interests Section - Matching Signup Design
  interestCount: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#16112B',
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  countText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  minText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: '#8B2BE2',
    minHeight: 40,
  },
  selectedChipText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  selectedChipsScroll: {
    marginBottom: 14,
  },
  selectedChipsContainer: {
    paddingRight: 8,
    gap: 10,
  },
  categoriesScroll: {
    paddingVertical: 16,
    marginBottom: 12,
  },
  categoriesScrollContent: {
    gap: 16,
  },
  categoryWrapper: {
    width: 100,
    height: 100,
  },
  categoryIconButton: {
    width: '100%',
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    position: 'relative',
  },
  categoryIconButtonActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: '#8B2BE2',
  },
  iconBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#FF4D6D',
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
  },
  expandedSection: {
    backgroundColor: '#1A1530',
    marginTop: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  expandedTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  categoryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  categoryBadge: {
    backgroundColor: '#8B2BE2',
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 12,
  },
  interestTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    minHeight: 38,
  },
  interestTagSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: '#8B2BE2',
  },
  interestTagText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  interestTagTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  interestsDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  interestDisplayTag: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  interestDisplayTagText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  interestsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  interestChipSelected: {
    backgroundColor: '#FF4458',
    borderColor: '#FF4458',
  },
  interestChipText: {
    fontSize: 14,
    color: '#666666',
  },
  interestChipTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#16112B',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  optionButtonSelected: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: '#8B2BE2',
  },
  optionText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  optionTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  slider: {
    width: '100%',
    height: 40,
    marginTop: 8,
  },
  // Location Section - Improved Layout
  locationHeader: {
    marginBottom: 12,
  },
  locationInfoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  locationTextContainer: {
    flex: 1,
  },
  locationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  locationStatus: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
  },
  locationDescription: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#FF4458',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
  },
  enableLocationButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Height Edit Styles
  heightInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16112B',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 14,
  },
  heightIcon: {
    marginRight: 12,
  },
  heightInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 14,
  },
  heightUnit: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontWeight: '500',
    marginLeft: 8,
  },
  // Social Edit Styles
  socialEditContainer: {
    marginTop: 8,
    gap: 12,
  },
  socialInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  socialIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  socialInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 16,
    backgroundColor: '#16112B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
  socialGridRow: {
    flexDirection: 'row',
    gap: 12,
  },

  socialGridItem: {
    flex: 1,
  },
  socialSingleRow: {
    width: '100%',
  },

  socialSingleItem: {
    width: '100%',
  },
  xLogoSmall: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    width: 22,
    textAlign: 'center',
  },
  socialDisplayContainer: {
    marginTop: 4,
    gap: 12,
  },
  socialDisplayBox: {
    backgroundColor: '#16112B',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 54,
    justifyContent: 'center',
    width: '100%',
  },
  socialDisplayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
  },
  socialDisplayText: {
    fontSize: 15,
    color: '#FFFFFF',
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  socialDisplayTextEmpty: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  xLogoDisplay: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    width: 18,
    textAlign: 'center',
  },
  xLogoDisplayGray: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.55)',
    width: 18,
    textAlign: 'center',
  },
  // Occupation autocomplete styles - inline list (not absolute positioned)
  suggestionsList: {
    marginTop: 8,
    backgroundColor: '#1A1530',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    overflow: 'hidden',
  },
  suggestionItemInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
    backgroundColor: '#1A1530',
  },
  suggestionTextInline: {
    fontSize: 15,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },
});

export default ProfileScreen;
