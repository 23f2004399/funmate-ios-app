/**
 * SWIPE HUB SCREEN (Main Homepage)
 * 
 * Where users see and swipe on potential matches
 * - Card-based interface with Tinder-style swipes
 * - Match scoring algorithm
 * - Photo slideshow on each card
 * - Swipe actions: like (right), pass (left)
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  PermissionsAndroid,
  Platform,
  Linking,
  AppState,
  ImageBackground,
} from 'react-native';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CardSwiper from '../../components/CardSwiper';
import MatchAnimation from '../../components/MatchAnimation';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import Geolocation from '@react-native-community/geolocation';
import { getBlockedUserIds } from '../../utils/blockCache';
import { calculateMatchScore, calculateDistance, passesFilters, getIntentCompatibilityType, getCommonInterests, formatIntent } from '../../utils/RecomendationEngine';
import { calculateProfileCompleteness } from '../../utils/profileCompleteness';
import notificationService from '../../services/NotificationService';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.65;

interface Match {
  id: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  interests: string[];
  relationshipIntent: string | null;
  interestedIn?: string[];
  isVerified?: boolean;
  photos: Array<{
    url: string;
    isPrimary: boolean;
    moderationStatus: string;
    order: number;
    uploadedAt: string;
  }>;
  location?: {
    latitude: number;
    longitude: number;
  };
  distance: number;
  matchScore: number;
  lastActiveAt?: any;
  height?: {
    value: number;
    displayUnit: 'cm' | 'ft';
  } | null;
  occupation?: string | null;
  socialHandles?: {
    instagram: string | null;
    linkedin: string | null;
    facebook: string | null;
    twitter: string | null;
  } | null;
}

// Match data for animation (mutual match)
interface MatchAnimationData {
  matchId: string;
  chatId: string;
  matchedUser: Match;
}

const SwipeHubScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [showLocationBanner, setShowLocationBanner] = useState(false);
  
  // Match animation state (for mutual matches)
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const [matchAnimationData, setMatchAnimationData] = useState<MatchAnimationData | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string>('');
  const [expandedSocial, setExpandedSocial] = useState<string | null>(null);
  const [currentUserInterests, setCurrentUserInterests] = useState<string[]>([]);
  const [currentUserIntent, setCurrentUserIntent] = useState<string | null>(null);
  const showMatchAnimationRef = useRef(false); // Ref for synchronous access to prevent empty state flicker
  
  const userId = auth().currentUser?.uid;
  const isFocused = useIsFocused();
  const hasRequestedPermission = useRef(false);
  const appState = useRef(AppState.currentState);
  const scrollViewRef = useRef<ScrollView>(null);

  // Get current match for detail view (always first since we filter out swiped cards)
  const currentMatch = matches[0];

  /**
   * Update location in Firestore (only if permission granted)
   */
  const updateLocationIfAllowed = async () => {
    if (!userId) return;
    
    try {
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (!hasPermission) {
          console.log('📍 No permission, skipping location update');
          return;
        }
      }
      
      Geolocation.getCurrentPosition(
        async (position) => {
          try {
            await firestore().collection('users').doc(userId).update({
              location: {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              },
              lastActiveAt: firestore.FieldValue.serverTimestamp(),
            });
            console.log('📍 Location updated successfully');
          } catch (error) {
            console.error('Error saving location:', error);
          }
        },
        (error) => {
          console.error('Geolocation error:', error);
        },
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000,
        }
      );
    } catch (error) {
      console.error('Error updating location:', error);
    }
  };

  /**
   * Request location permission - ONLY called once on initial mount
   */
  const requestLocationPermission = async () => {
    if (!userId) return;
    if (hasRequestedPermission.current) return; // Already requested this session
    
    try {
      if (Platform.OS === 'android') {
        // First check if already granted
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (hasPermission) {
          console.log('📍 Permission already granted');
          await updateLocationIfAllowed();
          return;
        }
        
        // Mark as requested so we don't ask again this session
        hasRequestedPermission.current = true;
        
        // Request permission - this shows native dialog ONLY if user hasn't denied before
        console.log('📍 Requesting location permission');
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (granted === PermissionsAndroid.RESULTS.GRANTED) {
          console.log('📍 Permission granted by user');
          setShowLocationBanner(false);
          await updateLocationIfAllowed();
          
          Toast.show({
            type: 'success',
            text1: 'Location Enabled',
            text2: 'Finding better matches near you!',
            visibilityTime: 2000,
          });
        } else {
          // User denied - show banner
          console.log('📍 Permission denied by user');
          setShowLocationBanner(true);
        }
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
    }
  };

  /**
   * Handle Enable button press on banner - opens app permissions page
   */
  const handleEnableLocation = async () => {
    try {
      if (Platform.OS === 'android') {
        // Open the app's permissions page directly
        await Linking.sendIntent('android.settings.action.MANAGE_APP_PERMISSIONS', [
          { key: 'android.intent.extra.PACKAGE_NAME', value: 'com.funmateapp' }
        ]);
      } else {
        await Linking.openSettings();
      }
    } catch (error) {
      // Fallback to openSettings
      try {
        await Linking.openSettings();
      } catch (fallbackError) {
        console.error('Error opening settings:', fallbackError);
        Toast.show({
          type: 'error',
          text1: 'Error',
          text2: 'Could not open settings',
          visibilityTime: 2000,
        });
      }
    }
  };

  /**
   * Dismiss the location banner
   */
  const dismissLocationBanner = () => {
    setShowLocationBanner(false);
  };

  /**
   * Initial load - request permissions and fetch matches
   */
  useEffect(() => {
    const init = async () => {
      if (!userId) return;
      await requestLocationPermission();
      // Initialize notification service (requests permission if needed)
      await notificationService.initialize();
      await fetchMatches();
    };
    init();
  }, [userId]);

  /**
   * Re-fetch matches when screen gains focus (fixes swiped cards reappearing)
   * This ensures we always have fresh data when returning from other screens
   */
  useEffect(() => {
    if (isFocused && !loading && userId) {
      // Don't fetch if we're showing match animation
      if (!showMatchAnimationRef.current) {
        fetchMatches();
      }
    }
  }, [isFocused]);

  /**
   * Ensure ref is synced when matches becomes empty
   */
  useEffect(() => {
    if (matches.length === 0 && !showMatchAnimation) {
      showMatchAnimationRef.current = false;
      // Force component update when matches become empty
      console.log('📭 No more matches - showing empty state');
    }
  }, [matches.length, showMatchAnimation]);

  // Debug: Log when matches changes
  useEffect(() => {
    console.log(`🃏 Matches count: ${matches.length}`);
  }, [matches.length]);

  /**
   * Fetch current user's photo and profile data for match animation and scoring
   */
  useEffect(() => {
    const fetchCurrentUserData = async () => {
      if (!userId) return;
      
      try {
        const userDoc = await firestore().collection('users').doc(userId).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const primaryPhoto = userData?.photos?.find((p: any) => p.isPrimary)?.url;
          const firstPhoto = userData?.photos?.[0]?.url;
          setCurrentUserPhoto(primaryPhoto || firstPhoto || '');
          
          // Store current user's interests and intent for match score
          setCurrentUserInterests(userData?.interests || []);
          setCurrentUserIntent(userData?.relationshipIntent || null);
        }
      } catch (error) {
        console.error('Error fetching current user data:', error);
      }
    };
    
    fetchCurrentUserData();
  }, [userId, isFocused]); // Re-fetch when screen gains focus

  /**
   * On tab focus or loading complete - check permission status and show/hide banner accordingly
   */
  useEffect(() => {
    const checkPermissionAndUpdate = async () => {
      if (!isFocused || loading) return;
      
      if (Platform.OS === 'android') {
        const hasPermission = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
        
        if (hasPermission) {
          // Permission granted - hide banner and update location
          if (showLocationBanner) {
            setShowLocationBanner(false);
            Toast.show({
              type: 'success',
              text1: 'Location Enabled',
              text2: 'Finding better matches near you!',
              visibilityTime: 2000,
            });
          }
          await updateLocationIfAllowed();
        } else {
          // Permission not granted - show banner again
          setShowLocationBanner(true);
        }
      }
      
      fetchMatches();
    };
    
    checkPermissionAndUpdate();
  }, [isFocused, loading]);

  /**
   * Listen for app returning to foreground (from Settings)
   */
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        isFocused
      ) {
        // App came to foreground - check if permission was granted
        if (Platform.OS === 'android') {
          const hasPermission = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
          );
          
          if (hasPermission && showLocationBanner) {
            setShowLocationBanner(false);
            await updateLocationIfAllowed();
            fetchMatches();
            
            Toast.show({
              type: 'success',
              text1: 'Location Enabled',
              text2: 'Finding better matches near you!',
              visibilityTime: 2000,
            });
          }
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [isFocused, showLocationBanner]);

  /**
   * Fetch potential matches (extracted for reuse)
   */
  const fetchMatches = async () => {
    if (!userId) return;
    try {
      // Get current user data
      const currentUserDoc = await firestore().collection('users').doc(userId).get();
      const currentUserData = currentUserDoc.data();
      
      if (!currentUserData) {
        setLoading(false);
        return;
      }

        console.log('🔍 Current user data:', {
          uid: userId,
          accountType: currentUserData.accountType,
          hasInterests: currentUserData.interests?.length || 0,
          hasRelationshipIntent: !!currentUserData.relationshipIntent,
          hasInterestedIn: currentUserData.interestedIn?.length || 0,
        });

        // Get blocked user IDs (cached for 5 minutes)
        const blockedUserIds = await getBlockedUserIds(userId);

        console.log('🚫 Blocked users:', blockedUserIds.length);

        // Get already swiped user IDs
        const swipedDocs = await firestore()
          .collection('swipes')
          .where('fromUserId', '==', userId)
          .get();
        
        const swipedUserIds = swipedDocs.docs.map(doc => doc.data().toUserId);

        // Get users who liked us and we already acted on (from "Who Liked You")
        // These should NOT appear in SwipeHub since we already handled them
        const actedOnLikesQuery = await firestore()
          .collection('swipes')
          .where('toUserId', '==', userId)
          .where('action', '==', 'like')
          .where('actedOnByTarget', '==', true)
          .get();
        
        const actedOnLikerIds = actedOnLikesQuery.docs.map(doc => doc.data().fromUserId);

        // Check if user has filled ANY preferences
        const hasFilledPreferences = 
          (currentUserData.interests && currentUserData.interests.length > 0) ||
          currentUserData.relationshipIntent;

        // Check if user has selected gender preference
        const hasGenderPreference = 
          currentUserData.interestedIn && currentUserData.interestedIn.length > 0;

        // Fetch all users (we'll filter client-side for now)
        const usersSnapshot = await firestore()
          .collection('users')
          .limit(50)
          .get();

        console.log('📊 Query results:', {
          totalUsers: usersSnapshot.size,
          swipedCount: swipedUserIds.length,
          actedOnLikersCount: actedOnLikerIds.length,
        });

        const potentialMatches: Match[] = [];

        usersSnapshot.forEach((doc) => {
          const userData = doc.data();
          const matchUserId = doc.id;

          // Skip self, blocked users, already swiped users, and users we already acted on in "Who Liked You"
          // Also skip users who haven't completed signup (signupComplete !== true)
          if (
            matchUserId === userId || 
            blockedUserIds.includes(matchUserId) ||
            swipedUserIds.includes(matchUserId) ||
            actedOnLikerIds.includes(matchUserId) ||
            userData.signupComplete !== true
          ) {
            return;
          }

          // Calculate distance (null if either user has no location)
          let distance: number | null = null;
          if (currentUserData.location && userData.location) {
            distance = calculateDistance(
              currentUserData.location.latitude,
              currentUserData.location.longitude,
              userData.location.latitude,
              userData.location.longitude
            );
          }

          // ALWAYS calculate match score using RecommendationEngine
          const matchScore = calculateMatchScore(
            {
              location: currentUserData.location,
              matchRadiusKm: currentUserData.matchRadiusKm || 25,
              relationshipIntent: currentUserData.relationshipIntent,
              interests: currentUserData.interests || [],
              lastActiveAt: currentUserData.lastActiveAt,
            },
            {
              location: userData.location,
              matchRadiusKm: userData.matchRadiusKm,
              relationshipIntent: userData.relationshipIntent,
              interests: userData.interests || [],
              lastActiveAt: userData.lastActiveAt,
            },
            distance
          );

          // If user hasn't filled ANY preferences, show cards without filtering
          if (!hasFilledPreferences) {
            potentialMatches.push({
              id: matchUserId,
              name: userData.name || 'Unknown',
              age: userData.age || 25,
              gender: userData.gender,
              bio: userData.bio || '',
              interests: userData.interests || [],
              relationshipIntent: userData.relationshipIntent,
              photos: userData.photos || [],
              location: userData.location,
              distance: distance !== null ? Math.round(distance) : 0,
              matchScore, // Use calculated score
              lastActiveAt: userData.lastActiveAt,
              height: userData.height,
              occupation: userData.occupation,
              socialHandles: userData.socialHandles,
            });
            return;
          }

          // If user has preferences but NO gender preference, skip gender filtering
          // but still apply other filters (radius, intent)
          if (hasFilledPreferences && !hasGenderPreference) {
            // Apply filters WITHOUT gender check
            const passes = passesFilters(
              {
                interestedIn: [], // Empty array = show all genders
                relationshipIntent: currentUserData.relationshipIntent,
              },
              {
                gender: userData.gender,
                relationshipIntent: userData.relationshipIntent,
              }
            );

            if (!passes) return;

            potentialMatches.push({
              id: matchUserId,
              name: userData.name || 'Unknown',
              age: userData.age || 25,
              gender: userData.gender,
              bio: userData.bio || '',
              interests: userData.interests || [],
              relationshipIntent: userData.relationshipIntent,
              photos: userData.photos || [],
              location: userData.location,
              distance: distance !== null ? Math.round(distance) : 0,
              matchScore,
              lastActiveAt: userData.lastActiveAt,
              height: userData.height,
              occupation: userData.occupation,
              socialHandles: userData.socialHandles,
            });
            return;
          }

          // If user has full preferences (including gender), apply all filters
          const passes = passesFilters(
            {
              interestedIn: currentUserData.interestedIn || [],
              relationshipIntent: currentUserData.relationshipIntent,
            },
            {
              gender: userData.gender,
              relationshipIntent: userData.relationshipIntent,
            }
          );

          if (!passes) return;

          potentialMatches.push({
            id: matchUserId,
            name: userData.name || 'Unknown',
            age: userData.age || 25,
            gender: userData.gender,
            bio: userData.bio || '',
            interests: userData.interests || [],
            relationshipIntent: userData.relationshipIntent,
            interestedIn: userData.interestedIn || [],
            isVerified: userData.isVerified || false,
            photos: userData.photos || [],
            location: userData.location,
            distance: distance !== null ? Math.round(distance) : 0,
            matchScore,
            lastActiveAt: userData.lastActiveAt,
            height: userData.height,
            occupation: userData.occupation,
            socialHandles: userData.socialHandles,
          });
        });
        console.log('✅ Potential matches found:', {
          total: potentialMatches.length,
          hasPreferences: hasFilledPreferences,
          hasGenderPref: hasGenderPreference,
        });
        // Sort by match score (highest first) if user has preferences
        // Otherwise shuffle randomly for users without preferences
        if (hasFilledPreferences) {
          potentialMatches.sort((a, b) => b.matchScore - a.matchScore);
        } else {
          // Shuffle array randomly (Fisher-Yates algorithm)
          for (let i = potentialMatches.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [potentialMatches[i], potentialMatches[j]] = [potentialMatches[j], potentialMatches[i]];
          }
        }

        setMatches(potentialMatches);
        setLoading(false);
        setRefreshing(false);
    } catch (error) {
      console.error('Error fetching matches:', error);
      setLoading(false);
      setRefreshing(false);
      Toast.show({
        type: 'error',
        text1: 'Failed to Load Matches',
        text2: 'Please try again',
        visibilityTime: 3000,
      });
    }
  };

  /**
   * Pull to refresh handler
   */
  const onRefresh = async () => {
    setRefreshing(true);
    setCurrentPhotoIndex(0);
    await fetchMatches();
    setRefreshing(false);
  };

  /**
   * Handle swipe right (like)
   * Checks if the other user already liked us - if so, it's a mutual match!
   */
  const handleSwipeRight = async (cardIndex: number) => {
    const match = matches[cardIndex];
    if (!match || !userId) return;

    try {
      // Check if this user has already liked us (mutual match!)
      const existingLikeQuery = await firestore()
        .collection('swipes')
        .where('fromUserId', '==', match.id)
        .where('toUserId', '==', userId)
        .where('action', '==', 'like')
        .where('actedOnByTarget', '==', false)
        .limit(1)
        .get();

      const isMutualMatch = !existingLikeQuery.empty;
      const existingLikeDoc = isMutualMatch ? existingLikeQuery.docs[0] : null;

      // Set ref BEFORE any async work to prevent empty state flicker
      if (isMutualMatch) {
        showMatchAnimationRef.current = true;
      }

      // Save our swipe to Firestore
      // If it's a mutual match, mark as already acted on (they already swiped on us)
      await firestore().collection('swipes').add({
        fromUserId: userId,
        toUserId: match.id,
        action: 'like',
        actedOnByTarget: isMutualMatch, // true if mutual, false otherwise
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      if (isMutualMatch && existingLikeDoc) {
        // 🎉 It's a mutual match! Create match and chat
        console.log(`💕 Mutual match with ${match.name}!`);

        // Create the match document (using userA/userB to match Firestore rules)
        const matchRef = await firestore().collection('matches').add({
          userA: userId,
          userB: match.id,
          isActive: true,
          createdAt: firestore.FieldValue.serverTimestamp(),
        });

        // Check if chat already exists between these users
        const existingChats = await firestore()
          .collection('chats')
          .where('participants', 'array-contains', userId)
          .get();
        
        const existingChat = existingChats.docs.find(doc => {
          const data = doc.data();
          return data.participants.includes(match.id);
        });

        let chatRef: { id: string };
        
        if (existingChat) {
          // Update existing chat to be mutual
          await existingChat.ref.update({
            isMutual: true,
            relatedMatchId: matchRef.id,
            lastMessageAt: firestore.FieldValue.serverTimestamp(),
          });
          chatRef = { id: existingChat.id };
        } else {
          // Create a new chat for the match
          const newChatRef = await firestore().collection('chats').add({
            type: 'dating',
            participants: [userId, match.id],
            relatedMatchId: matchRef.id,
            isMutual: true,
            lastMessage: null,
            relatedEventId: null,
            deletionPolicy: {
              type: 'on_unmatch',
              days: null,
            },
            allowDeleteForEveryone: false,
            deleteForEveryoneWindowDays: null,
            createdAt: firestore.FieldValue.serverTimestamp(),
            lastMessageAt: firestore.FieldValue.serverTimestamp(),
          });
          chatRef = newChatRef;
        }

        // Mark their original like as acted on (so it disappears from "Who Liked You")
        await existingLikeDoc.ref.update({ actedOnByTarget: true });

        // Store match data and show animation
        setMatchAnimationData({
          matchId: matchRef.id,
          chatId: chatRef.id,
          matchedUser: match,
        });
        setShowMatchAnimation(true);
      } else {
        console.log(`✅ Liked: ${match.name}`);
      }
      
      // Update state immediately (CardSwiper's useEffect will handle the animation reset)
      console.log(`🔄 Filtering out card ${cardIndex}, current count: ${matches.length}, will be: ${matches.length - 1}`);
      setMatches(prev => {
        const newMatches = prev.filter((_, idx) => idx !== cardIndex);
        console.log(`📊 New matches count: ${newMatches.length}`);
        return newMatches;
      });
      setCurrentPhotoIndex(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } catch (error) {
      console.error('Error saving like:', error);
    }
  };

  /**
   * Handle swipe left (pass)
   */
  const handleSwipeLeft = async (cardIndex: number) => {
    const match = matches[cardIndex];
    if (!match || !userId) return;

    try {
      // Save swipe to Firestore
      await firestore().collection('swipes').add({
        fromUserId: userId,
        toUserId: match.id,
        action: 'pass',
        actedOnByTarget: false,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      console.log(`❌ Passed: ${match.name}`);
      
      // Update state immediately (CardSwiper's useEffect will handle the animation reset)
      setMatches(prev => prev.filter((_, idx) => idx !== cardIndex));
      setCurrentPhotoIndex(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });
    } catch (error) {
      console.error('Error saving pass:', error);
    }
  };

  /**
   * Handle "Send Message" from match animation
   */
  const handleSendMessage = useCallback(() => {
    if (!matchAnimationData) return;
    
    showMatchAnimationRef.current = false; // Reset ref
    setShowMatchAnimation(false);
    
    // Navigate to chat with the matched user
    navigation.navigate('Chat', {
      chatId: matchAnimationData.chatId || null,
      recipientId: matchAnimationData.matchedUser.id,
      recipientName: matchAnimationData.matchedUser.name,
      recipientPhoto: matchAnimationData.matchedUser.photos?.[0]?.url,
    });
    
    setMatchAnimationData(null);
  }, [matchAnimationData, navigation]);

  /**
   * Handle "Keep Swiping" from match animation
   */
  const handleKeepSwiping = useCallback(() => {
    showMatchAnimationRef.current = false; // Reset ref
    setShowMatchAnimation(false);
    setMatchAnimationData(null);
  }, []);

  /**
   * Navigate photos in current card (optimized with useCallback)
   */
  const handleCardTap = useCallback((side: 'left' | 'right') => {
    const currentMatch = matches[0]; // Always first card since we filter out swiped
    if (!currentMatch || !currentMatch.photos.length) return;

    if (side === 'right') {
      setCurrentPhotoIndex((prev) =>
        prev < currentMatch.photos.length - 1 ? prev + 1 : 0
      );
    } else {
      setCurrentPhotoIndex((prev) =>
        prev > 0 ? prev - 1 : currentMatch.photos.length - 1
      );
    }
  }, [matches]);

  /**
   * Render individual card (memoized for performance)
   */
  const renderCard = useCallback((match: Match, index: number, swipeProgress?: { direction: 'left' | 'right' | 'none', progress: number }) => {
    const currentPhoto = match.photos[currentPhotoIndex]?.url || 'https://via.placeholder.com/400';
    const matchPercentage = Math.round(match.matchScore);
    
    // Show "unknown" if no location data
    const distanceText = match.location ? `${match.distance} km away` : 'Location unknown';
    
    // Calculate border color based on swipe progress
    const getBorderColor = () => {
      if (!swipeProgress || swipeProgress.progress === 0) return '#378BBB'; // Blue default
      // return 'rgba(139, 92, 246, 0.30)';      
      if (swipeProgress.direction === 'right') {
        // Interpolate from blue to red
        const blueAmount = Math.round(55 * (1 - swipeProgress.progress));
        const redAmount = Math.round(255 * swipeProgress.progress + 55 * (1 - swipeProgress.progress));
        const greenAmount = Math.round(139 * (1 - swipeProgress.progress) + 77 * swipeProgress.progress);
        const blueComponent = Math.round(187 * (1 - swipeProgress.progress) + 109 * swipeProgress.progress);
        return `rgb(${redAmount}, ${greenAmount}, ${blueComponent})`;
      } else if (swipeProgress.direction === 'left') {
        // Interpolate from blue to grey
        const greyValue = Math.round(55 + (140 - 55) * swipeProgress.progress);
        return `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
      }
      
      return '#378BBB';
    };
    // const getBorderColor = () => {
    //   return 'rgba(139, 92, 246, 0.30)';
    // };
    
    // Calculate shadow color (follows border)
    const getShadowColor = () => {
      if (!swipeProgress || swipeProgress.progress === 0) return '#378BBB';
      if (swipeProgress.direction === 'right') return getBorderColor();
      if (swipeProgress.direction === 'left') return getBorderColor();
      return '#378BBB';
    };
    // const getShadowColor = () => {
    //   return '#000000';
    // };

    return (
      <View style={[styles.card, {
        borderColor: getBorderColor(),
        shadowColor: getShadowColor(),
      }]}>
        {/* Photo with cache control for faster loading */}
        <Image 
          source={{ uri: currentPhoto, cache: 'force-cache' }} 
          style={styles.cardImage}
          resizeMode="cover"
          // Prefetch next photos in background
          onLoad={() => {
            // Preload next 2 photos for smoother transitions
            if (match.photos.length > 1) {
              const nextIndex = (currentPhotoIndex + 1) % match.photos.length;
              const nextNextIndex = (currentPhotoIndex + 2) % match.photos.length;
              if (match.photos[nextIndex]) {
                Image.prefetch(match.photos[nextIndex].url);
              }
              if (match.photos[nextNextIndex]) {
                Image.prefetch(match.photos[nextNextIndex].url);
              }
            }
          }}
        />

        {/* Photo navigation areas */}
        <TouchableOpacity
          style={styles.leftTapArea}
          onPress={() => handleCardTap('left')}
          activeOpacity={1}
        />
        <TouchableOpacity
          style={styles.rightTapArea}
          onPress={() => handleCardTap('right')}
          activeOpacity={1}
        />

        {/* Photo indicators */}
        {match.photos.length > 1 && (
          <View style={styles.photoIndicators}>
            {match.photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.indicator,
                  i === currentPhotoIndex && styles.indicatorActive,
                ]}
              />
            ))}
          </View>
        )}

        {/* Stacked Micro Pills (top-right) */}
        <View style={styles.badgesContainer}>
          {/* Trusted Badge */}
          <View style={styles.trustedBadge}>
            <Ionicons name="shield-checkmark" size={14} color="#2ECC71" />
            <Text style={styles.trustedText}>{calculateProfileCompleteness(match)}% Trusted</Text>
          </View>
          {/* Match Badge */}
          <View style={styles.matchBadge}>
            <Ionicons name="heart" size={14} color="#FF4D6D" />
            <Text style={styles.matchText}>{matchPercentage}% Match</Text>
          </View>
        </View>

        {/* Card info */}
        <View style={styles.cardInfo}>
          <View style={styles.cardHeader}>
            <View>
              <Text style={styles.cardName}>
                {match.name}, {match.age}
              </Text>
              <View style={styles.cardMeta}>
                <Ionicons name="location-outline" size={14} color="#000000" />
                <Text style={styles.cardDistance}>{distanceText}</Text>
              </View>
            </View>
          </View>

          {/* Bio preview */}
          {match.bio && (
            <Text style={styles.cardBio} numberOfLines={2}>
              {match.bio}
            </Text>
          )}

          {/* Interests preview */}
          {match.interests.length > 0 && (
            <View style={styles.interestsTags}>
              {match.interests.slice(0, 3).map((interest, i) => (
                <View key={i} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
              {match.interests.length > 3 && (
                <View style={styles.interestTag}>
                  <Text style={styles.interestText}>+{match.interests.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [currentPhotoIndex, handleCardTap]); // Include handleCardTap dependency

  if (loading) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg_party.webp')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#8B2BE2" />
            <Text style={styles.loadingText}>Finding matches...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  // DEBUG: Log render conditions
  console.log(`🎨 RENDER CHECK: matches.length=${matches.length}, showMatchAnimation=${showMatchAnimation}`);

  // Show empty state when no matches (unless showing match animation)
  if (matches.length === 0 && !showMatchAnimation) {
    return (
      <ImageBackground
        source={require('../../assets/images/bg_party.webp')}
        style={styles.container}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
          <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
          
          {/* Header */}
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Ionicons name="heart" size={28} color="#8B2BE2" />
            <Text style={styles.title}>Swipe Hub</Text>
          </View>

          {/* Location Banner */}
          {showLocationBanner && (
            <View style={styles.locationBanner}>
              <View style={styles.locationBannerContent}>
                <Ionicons name="location" size={18} color="#A855F7" />
                <Text style={styles.locationBannerText}>
                  Enable location for better matches nearby
                </Text>
              </View>
              <View style={styles.locationBannerActions}>
                <TouchableOpacity onPress={handleEnableLocation} activeOpacity={0.8}>
                  <LinearGradient
                    colors={['#8B2BE2', '#06B6D4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.enableButton}
                  >
                    <Text style={styles.enableButtonText}>Enable</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.closeBannerButton}
                  onPress={() => setShowLocationBanner(false)}
                >
                  <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* No matches content with pull-to-refresh */}
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              alignItems: 'center',
              paddingHorizontal: 40,
              paddingBottom: Math.max(24, insets.bottom + 12),
            }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#8B2BE2']}
                tintColor="#8B2BE2"
              />
            }
            showsVerticalScrollIndicator={false}
          >
            <Ionicons name="people-outline" size={80} color="rgba(255,255,255,0.55)" />
            <Text style={styles.emptyTitle}>No Matches Yet</Text>
            <Text style={styles.emptyText}>
              Check back later for new profiles!{'\n'}Try adjusting your preferences or radius.
            </Text>
            <Text style={styles.pullToRefreshHint}>Pull down to refresh</Text>
          </ScrollView>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.container}
      resizeMode="cover"
    >
    <View style={styles.overlay}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Ionicons name="heart" size={28} color="#8B2BE2" />
        <Text style={styles.title}>Swipe Hub</Text>
      </View>

      {/* Location Banner */}
      {showLocationBanner && (
        <View style={styles.locationBanner}>
          <View style={styles.locationBannerContent}>
            <Ionicons name="location" size={18} color="#A855F7" />
            <Text style={styles.locationBannerText}>
              Enable location for better matches nearby
            </Text>
          </View>
          <View style={styles.locationBannerActions}>
            <TouchableOpacity onPress={handleEnableLocation} activeOpacity={0.8}>
              <LinearGradient
                colors={['#8B2BE2', '#06B6D4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.enableButton}
              >
                <Text style={styles.enableButtonText}>Enable</Text>
              </LinearGradient>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.closeBannerButton}
              onPress={() => setShowLocationBanner(false)}
            >
              <Ionicons name="close" size={18} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Scrollable Content - Bumble Style */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#8B2BE2']}
            tintColor="#8B2BE2"
          />
        }
        showsVerticalScrollIndicator={false}
        bounces={true}
        removeClippedSubviews={true} // Optimize memory by removing off-screen views
        scrollEventThrottle={16} // Smooth scroll performance
      >
        {/* Card Swiper Section */}
        <View style={styles.swiperContainer}>
          <CardSwiper
            data={matches}
            renderCard={renderCard}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            stackSize={3}
          />
        </View>

        {/* Scroll indicator */}
        {currentMatch && (
          <View style={styles.scrollIndicator}>
            <Ionicons name="chevron-down" size={24} color="#999999" />
            <Text style={styles.scrollHintText}>Scroll for more details</Text>
          </View>
        )}

        {/* Profile Details Section */}
        {currentMatch && (
          <View style={styles.profileDetailsContainer}>
            {/* Basic Info Header */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{currentMatch.name}, {currentMatch.age}</Text>
            </View>

            {/* Bio Section */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Bio</Text>
              <View style={styles.bioBox}>
                <Text style={styles.bioBoxText}>
                  {currentMatch.bio || 'No bio added yet'}
                </Text>
              </View>
            </View>

            {/* Match Score Section */}
            {(() => {
              const commonInterests = getCommonInterests(currentUserInterests, currentMatch.interests || []);
              const intentType = getIntentCompatibilityType(currentUserIntent, currentMatch.relationshipIntent);
              const hasLocation = currentMatch.location && currentMatch.distance >= 0;
              const hasInterests = commonInterests.length > 0;
              const hasIntent = intentType === 'exact' || intentType === 'compatible';
              const hasPreviousLines = hasInterests || hasIntent;

              // Only show section if there's something to display
              if (!hasInterests && !hasIntent && !hasLocation) return null;

              return (
                <View style={styles.matchScoreSection}>
                  <Text style={styles.matchScoreSectionTitle}>Match Score</Text>
                  <View style={styles.matchScoreContent}>
                    {/* Interests line */}
                    {hasInterests && (
                      <View style={styles.matchScoreParagraph}>
                        <Text style={styles.matchScoreText}>
                          You guys have some similar Interests:{' '}
                        </Text>
                        <View style={styles.matchScoreChips}>
                          {commonInterests.map((interest, index) => (
                            <View key={index} style={styles.matchScoreChip}>
                              <Text style={styles.matchScoreChipText}>{interest}</Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    )}

                    {/* Intent line */}
                    {intentType === 'exact' && (
                      <Text style={styles.matchScoreText}>
                        You both have same relationship Intent too: <Text style={styles.matchScoreHighlight}>{formatIntent(currentMatch.relationshipIntent)}</Text>
                      </Text>
                    )}
                    {intentType === 'compatible' && (
                      <Text style={styles.matchScoreText}>
                        You guys have compatible Intents: <Text style={styles.matchScoreHighlight}>{formatIntent(currentUserIntent)} ↔ {formatIntent(currentMatch.relationshipIntent)}</Text>
                      </Text>
                    )}

                    {/* Distance line */}
                    {hasLocation && (
                      <Text style={styles.matchScoreText}>
                        {hasPreviousLines ? 'And guess what?' : 'Guess what?'} They live only <Text style={styles.matchScoreHighlight}>{currentMatch.distance} kms</Text> away.
                      </Text>
                    )}
                  </View>
                </View>
              );
            })()}

            {/* Profile Section - Contains all profile details */}
            <View style={styles.profileSection}>
              <Text style={styles.profileSectionTitle}>Profile</Text>
              
              {/* Row 1: Interests - Full Width */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.profileDetailTitle}>Interests</Text>
                {currentMatch.interests && currentMatch.interests.length > 0 ? (
                  <View style={styles.interestsContainer}>
                    {currentMatch.interests.map((interest, index) => (
                      <View key={index} style={styles.interestChip}>
                        <Text style={styles.interestChipText}>{interest}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.detailEmptyText}>No interests added yet</Text>
                )}
              </View>

              {/* Row 2: Looking For | Interested In */}
              <View style={styles.profileRow}>
                {/* Looking For - Left */}
                <View style={styles.profileRowItemHalf}>
                  <Text style={styles.profileDetailTitle}>Looking For</Text>
                  <Text style={styles.profileRowItemText}>
                    {formatIntent(currentMatch.relationshipIntent) || 'Not specified'}
                  </Text>
                </View>

                {/* Interested In - Right */}
                <View style={styles.profileRowItemHalf}>
                  <Text style={styles.profileDetailTitle}>Interested In</Text>
                  {currentMatch.interestedIn && currentMatch.interestedIn.length > 0 ? (
                    <View style={styles.interestsContainer}>
                      {currentMatch.interestedIn.map((gender, index) => (
                        <View key={index} style={styles.preferenceChipSmall}>
                          <Text style={styles.preferenceChipTextSmall}>
                            {gender.charAt(0).toUpperCase() + gender.slice(1)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.profileRowItemText}>Not specified</Text>
                  )}
                </View>
              </View>

              {/* Row 3: Height | Gender */}
              <View style={styles.profileRow}>
                {/* Height - Left */}
                <View style={styles.profileRowItemHalf}>
                  <Text style={styles.profileDetailTitle}>Height</Text>
                  <Text style={styles.profileRowItemText}>
                    {currentMatch.height ? `${currentMatch.height.value} cm` : 'Not specified'}
                  </Text>
                </View>

                {/* Gender - Right */}
                <View style={styles.profileRowItemHalf}>
                  <Text style={styles.profileDetailTitle}>Gender</Text>
                  <Text style={styles.profileRowItemText}>
                    {currentMatch.gender ? 
                      currentMatch.gender.charAt(0).toUpperCase() + currentMatch.gender.slice(1) 
                      : 'Not specified'}
                  </Text>
                </View>
              </View>

              {/* Row 4: Occupation - Full Width */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.profileDetailTitle}>Occupation</Text>
                <Text style={styles.profileRowItemText}>
                  {currentMatch.occupation || 'Not specified'}
                </Text>
              </View>

              {/* Row 5: Social Handles Section */}
              {currentMatch.socialHandles && (
                currentMatch.socialHandles.instagram || 
                currentMatch.socialHandles.linkedin || 
                currentMatch.socialHandles.facebook || 
                currentMatch.socialHandles.twitter
              ) && (
                <View style={styles.profileDetailSection}>
                  <Text style={styles.profileDetailTitle}>Socials</Text>
                  <View style={styles.socialIconsContainer}>
                    {currentMatch.socialHandles.instagram && (
                      <View style={styles.socialIconWrapper}>
                        <TouchableOpacity
                          style={styles.socialIconButton}
                          onPress={() => setExpandedSocial(expandedSocial === 'instagram' ? null : 'instagram')}
                        >
                          <Ionicons name="logo-instagram" size={28} color="#E4405F" />
                        </TouchableOpacity>
                        {expandedSocial === 'instagram' && (
                          <View style={styles.socialHandlePopup}>
                            <Text style={styles.socialHandlePopupText}>
                              @{currentMatch.socialHandles.instagram.replace('@', '')}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {currentMatch.socialHandles.linkedin && (
                      <View style={styles.socialIconWrapper}>
                        <TouchableOpacity
                          style={styles.socialIconButton}
                          onPress={() => setExpandedSocial(expandedSocial === 'linkedin' ? null : 'linkedin')}
                        >
                          <Ionicons name="logo-linkedin" size={28} color="#0A66C2" />
                        </TouchableOpacity>
                        {expandedSocial === 'linkedin' && (
                          <View style={styles.socialHandlePopup}>
                            <Text style={styles.socialHandlePopupText}>
                              {currentMatch.socialHandles.linkedin}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {currentMatch.socialHandles.facebook && (
                      <View style={styles.socialIconWrapper}>
                        <TouchableOpacity
                          style={styles.socialIconButton}
                          onPress={() => setExpandedSocial(expandedSocial === 'facebook' ? null : 'facebook')}
                        >
                          <Ionicons name="logo-facebook" size={28} color="#1877F2" />
                        </TouchableOpacity>
                        {expandedSocial === 'facebook' && (
                          <View style={styles.socialHandlePopup}>
                            <Text style={styles.socialHandlePopupText}>
                              {currentMatch.socialHandles.facebook}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {currentMatch.socialHandles.twitter && (
                      <View style={styles.socialIconWrapper}>
                        <TouchableOpacity
                          style={styles.socialIconButton}
                          onPress={() => setExpandedSocial(expandedSocial === 'twitter' ? null : 'twitter')}
                        >
                          <Text style={styles.xLogoLarge}>𝕏</Text>
                        </TouchableOpacity>
                        {expandedSocial === 'twitter' && (
                          <View style={styles.socialHandlePopup}>
                            <Text style={styles.socialHandlePopupText}>
                              @{currentMatch.socialHandles.twitter.replace('@', '')}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Trust Score Section */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.profileDetailTitle}>Trust Score</Text>
                <View style={styles.trustScoreContainer}>
                  <View style={styles.progressBarBackground}>
                    <View 
                      style={[
                        styles.progressBarFill, 
                        { width: `${calculateProfileCompleteness(currentMatch)}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.trustScorePercentage}>
                    {calculateProfileCompleteness(currentMatch)}%
                  </Text>
                </View>
                <View style={styles.trustScoreInfoContainer}>
                  <Ionicons name="star" size={12} color="#7F93AA" />
                  <Text style={styles.trustScoreInfoText}>
                    Trust score is based on profile completion
                  </Text>
                </View>
              </View>
            </View>

            {/* Bottom padding for scroll */}
            <View style={styles.bottomPadding} />
          </View>
        )}
      </ScrollView>

      {/* Match Animation Overlay - shown when mutual match detected */}
      <MatchAnimation
        visible={showMatchAnimation}
        currentUserPhoto={currentUserPhoto}
        matchedUserPhoto={matchAnimationData?.matchedUser.photos.find(p => p.isPrimary)?.url || matchAnimationData?.matchedUser.photos[0]?.url}
        matchedUserName={matchAnimationData?.matchedUser.name}
        onSendMessage={handleSendMessage}
        onKeepSwiping={handleKeepSwiping}
      />
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
    // backgroundColor: '#0E1621',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  // header: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   paddingHorizontal: 20,
  //   paddingTop: 50,
  //   paddingBottom: 20,
  //   backgroundColor: '#0E1621',
  //   borderBottomWidth: 2,
  //   borderBottomColor: '#0E1621',
  //   shadowColor: '#378BBB',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.8,
  //   shadowRadius: 8,
  //   elevation: 10,
  //   gap: 12,
  // },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'transparent',
    gap: 10,
  },
  title: {
    fontSize: 24,
    // fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  // locationBanner: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   justifyContent: 'space-between',
  //   backgroundColor: 'rgba(244, 180, 0, 0.15)',
  //   paddingHorizontal: 16,
  //   paddingVertical: 12,
  //   borderBottomWidth: 1,
  //   borderBottomColor: '#233B57',
  // },
  locationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(26, 21, 48, 0.88)',
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  locationBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  locationBannerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.85)',
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  locationBannerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  // enableButton: {
  //   backgroundColor: '#378BBB',
  //   paddingHorizontal: 16,
  //   paddingVertical: 8,
  //   borderRadius: 20,
  //   minWidth: 70,
  //   alignItems: 'center',
  // },
  enableButton: {
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 19,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
  },
  enableButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    // fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  closeBannerButton: {
    padding: 4,
  },
  scrollContent: {
    flexGrow: 1,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  swiperContainer: {
    height: CARD_HEIGHT + 40,
    paddingTop: 10,
  },
  pullToRefreshHint: {
    marginTop: 16,
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    // fontStyle: 'italic',
    fontFamily: 'Inter-Italic',
  },
  // card: {
  //   width: CARD_WIDTH,
  //   height: CARD_HEIGHT,
  //   borderRadius: 20,
  //   backgroundColor: '#16283D',
  //   borderWidth: 2,
  //   borderColor: '#378BBB',
  //   shadowColor: '#378BBB',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.8,
  //   shadowRadius: 12,
  //   elevation: 10,
  //   overflow: 'hidden',
  // },
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 24,
    backgroundColor: '#1A1530',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 10,
    overflow: 'hidden',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  leftTapArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '40%',
    height: '100%',
  },
  rightTapArea: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '40%',
    height: '100%',
  },
  photoIndicators: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  // indicator: {
  //   width: 30,
  //   height: 3,
  //   backgroundColor: 'rgba(255, 255, 255, 0.5)',
  //   borderRadius: 2,
  // },
  indicator: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: '#FFFFFF',
  },
  // matchBadge: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   backgroundColor: 'rgba(255, 77, 109, 0.15)',
  //   paddingHorizontal: 10,
  //   paddingVertical: 4,
  //   borderRadius: 999,
  //   gap: 5,
  // },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 11, 30, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  // matchText: {
  //   fontSize: 12,
  //   fontWeight: '500',
  //   color: '#FF4D6D',
  //   fontFamily: 'Inter-Medium',
  // },
  matchText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  badgesContainer: {
    position: 'absolute',
    top: 16,
    right: 12,
    gap: 6,
    alignItems: 'flex-end',
  },
  // trustedBadge: {
  //   flexDirection: 'row',
  //   alignItems: 'center',
  //   backgroundColor: 'rgba(46, 204, 113, 0.15)',
  //   paddingHorizontal: 10,
  //   paddingVertical: 4,
  //   borderRadius: 999,
  //   gap: 5,
  // },
  trustedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(13, 11, 30, 0.72)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    gap: 5,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.25)',
  },
  // trustedText: {
  //   fontSize: 12,
  //   fontWeight: '500',
  //   color: '#2ECC71',
  //   fontFamily: 'Inter-Medium',
  // },
  trustedText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  // cardInfo: {
  //   position: 'absolute',
  //   bottom: 0,
  //   left: 0,
  //   right: 0,
  //   padding: 16,
  //   paddingBottom: 20,
  //   backgroundColor: 'transparent',
  // },
  cardInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingBottom: 22,
    backgroundColor: 'rgba(13, 11, 30, 0.46)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
    fontFamily: 'Inter-Bold',
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  // cardDistance: {
  //   fontSize: 14,
  //   color: '#FFFFFF',
  //   fontWeight: 'bold',
  //   fontFamily: 'Inter-Bold',
  // },
  cardDistance: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'Inter-Regular',
  },
  // cardBio: {
  //   fontSize: 14,
  //   color: '#FFFFFF',
  //   fontWeight: 'bold',
  //   lineHeight: 20,
  //   marginTop: 8,
  //   fontFamily: 'Inter-Bold',
  // },
  cardBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.90)',
    lineHeight: 20,
    marginTop: 8,
    fontFamily: 'Inter-Regular',
  },
  interestsTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  // interestTag: {
  //   backgroundColor: '#1B2F48',
  //   paddingHorizontal: 10,
  //   paddingVertical: 4,
  //   borderRadius: 12,
  // },
  interestTag: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  interestText: {
    fontSize: 12,
    color: '#FFFFFF',
    // fontWeight: 'bold',
    fontFamily: 'Inter-SemiBold',
  },
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 20,
    gap: 60,
    backgroundColor: '#0E1621',
  },
  actionButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  passButton: {
    backgroundColor: '#16283D',
    borderWidth: 2,
    borderColor: '#FF4D6D',
  },
  likeButton: {
    backgroundColor: '#16283D',
    borderWidth: 2,
    borderColor: '#2ECC71',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  // emptyTitle: {
  //   fontSize: 22,
  //   fontWeight: 'bold',
  //   color: '#FFFFFF',
  //   marginTop: 20,
  //   marginBottom: 8,
  //   fontFamily: 'Inter-Bold',
  // },
  emptyTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
  },
  // emptyText: {
  //   fontSize: 16,
  //   color: '#B8C7D9',
  //   textAlign: 'center',
  //   lineHeight: 24,
  //   fontFamily: 'Inter-Regular',
  // },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  // Location Request Styles
  locationRequestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  locationIconContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(55, 139, 187, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  locationRequestTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
    textAlign: 'center',
    fontFamily: 'Inter-Bold',
  },
  locationRequestDescription: {
    fontSize: 16,
    color: '#B8C7D9',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    fontFamily: 'Inter-Regular',
  },
  enableLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#378BBB',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 30,
    gap: 8,
    minWidth: 200,
  },
  enableLocationButtonDisabled: {
    backgroundColor: 'rgba(55, 139, 187, 0.5)',
  },
  enableLocationButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  locationPrivacyText: {
    marginTop: 20,
    fontSize: 14,
    color: '#2ECC71',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  // Profile Details Styles (Bumble-style scroll)
  scrollIndicator: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  scrollHintText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 4,
    fontFamily: 'Inter-Regular',
  },
  // profileDetailsContainer: {
  //   backgroundColor: '#16283D',
  //   borderTopLeftRadius: 24,
  //   borderTopRightRadius: 24,
  //   paddingHorizontal: 20,
  //   paddingTop: 24,
  //   marginTop: -10,
  //   shadowColor: '#000',
  //   shadowOffset: { width: 0, height: -2 },
  //   shadowOpacity: 0.15,
  //   shadowRadius: 8,
  //   elevation: 3,
  // },
  profileDetailsContainer: {
    backgroundColor: '#1A1530',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 24,
    marginTop: -10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.20)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  detailHeader: {
    marginBottom: 24,
  },
  detailName: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  detailLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailLocationText: {
    fontSize: 15,
    color: '#B8C7D9',
    fontFamily: 'Inter-Regular',
  },
  detailSection: {
    marginBottom: 24,
  },
  detailSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 10,
    fontFamily: 'Inter-SemiBold',
  },
  detailSectionContent: {
    fontSize: 16,
    color: '#B8C7D9',
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  // bioBox: {
  //   backgroundColor: '#1B2F48',
  //   borderRadius: 14,
  //   padding: 16,
  //   minHeight: 100,
  //   borderWidth: 2,
  //   borderColor: '#378BBB',
  //   shadowColor: '#378BBB',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.6,
  //   shadowRadius: 12,
  //   elevation: 8,
  // },
  bioBox: {
    backgroundColor: '#16112B',
    borderRadius: 14,
    padding: 16,
    minHeight: 100,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  bioBoxText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  detailEmptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
  },
  // matchScoreSection: {
  //   marginBottom: 24,
  //   backgroundColor: '#1B2F48',
  //   borderRadius: 16,
  //   padding: 16,
  //   borderWidth: 1,
  //   borderColor: '#FF4D6D',
  //   shadowColor: '#FF4D6D',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.6,
  //   shadowRadius: 12,
  //   elevation: 8,
  // },
  matchScoreSection: {
    marginBottom: 24,
    backgroundColor: '#16112B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  matchScoreContent: {
    gap: 12,
  },
  // matchScoreSectionTitle: {
  //   fontSize: 20,
  //   fontWeight: '700',
  //   color: '#FFFFFF',
  //   marginBottom: 16,
  //   paddingBottom: 12,
  //   borderBottomWidth: 2,
  //   borderBottomColor: '#378BBB',
  //   fontFamily: 'Inter-Bold',
  //   alignSelf: 'flex-start',
  // },
  matchScoreSectionTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    fontFamily: 'Inter-Bold',
    alignSelf: 'flex-start',
  },
  // profileSection: {
  //   marginBottom: 24,
  //   backgroundColor: '#1B2F48',
  //   borderRadius: 16,
  //   padding: 16,
  //   borderWidth: 1,
  //   borderColor: '#378BBB',
  //   shadowColor: '#378BBB',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.6,
  //   shadowRadius: 12,
  //   elevation: 8,
  // },
  profileSection: {
    marginBottom: 24,
    backgroundColor: '#16112B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  // profileSectionTitle: {
  //   fontSize: 20,
  //   fontWeight: '700',
  //   color: '#FFFFFF',
  //   marginBottom: 16,
  //   paddingBottom: 12,
  //   borderBottomWidth: 2,
  //   borderBottomColor: '#378BBB',
  //   fontFamily: 'Inter-Bold',
  // },
  profileSectionTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    fontFamily: 'Inter-Bold',
  },
  profileDetailSection: {
    marginBottom: 33,
  },
  profileDetailTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  profileRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  profileRowItem: {
    flex: 1,
    alignItems: 'center',
  },
  profileRowItemHalf: {
    flex: 1,
  },
  profileDetailTitleCentered: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
    textAlign: 'center',
  },
  profileRowItemText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
  profileRowItemTextCentered: {
    fontSize: 14,
    color: '#B8C7D9',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  // preferenceChipSmall: {
  //   backgroundColor: 'rgba(55, 139, 187, 0.15)',
  //   paddingHorizontal: 10,
  //   paddingVertical: 4,
  //   borderRadius: 16,
  //   borderWidth: 1,
  //   borderColor: 'rgba(55, 139, 187, 0.3)',
  //   marginBottom: 4,
  // },
  preferenceChipSmall: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    marginBottom: 4,
  },
  preferenceChipTextSmall: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  matchScoreParagraph: {
    flexDirection: 'column',
    gap: 8,
  },
  matchScoreText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.82)',
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  matchScoreHighlight: {
    color: '#22D3EE',
    fontFamily: 'Inter-SemiBold',
  },
  matchScoreChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  matchScoreChip: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#8B2BE2',
  },
  matchScoreChipText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  interestChip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  interestChipText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  preferenceChip: {
    backgroundColor: 'rgba(55, 139, 187, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
  },
  preferenceChipText: {
    fontSize: 14,
    color: '#378BBB',
    fontWeight: '500',
    fontFamily: 'Inter-Medium',
  },
  verificationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  verificationText: {
    fontSize: 15,
    fontWeight: '500',
  },
  matchScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  matchScoreBar: {
    flex: 1,
    height: 8,
    backgroundColor: '#1B2F48',
    borderRadius: 4,
    overflow: 'hidden',
  },
  matchScoreFill: {
    height: '100%',
    backgroundColor: '#FF4D6D',
    borderRadius: 4,
  },
  matchScoreBarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FF4D6D',
    width: 45,
    textAlign: 'right',
    fontFamily: 'Inter-Bold',
  },
  socialIconsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  socialIconWrapper: {
    alignItems: 'center',
  },
  // socialIconButton: {
  //   width: 48,
  //   height: 48,
  //   borderRadius: 24,
  //   backgroundColor: '#1B2F48',
  //   justifyContent: 'center',
  //   alignItems: 'center',
  //   borderWidth: 2,
  //   borderColor: 'rgba(255, 255, 255, 0.5)',
  // },
  socialIconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1A1530',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  // socialHandlePopup: {
  //   marginTop: 8,
  //   backgroundColor: '#16283D',
  //   paddingHorizontal: 12,
  //   paddingVertical: 6,
  //   borderRadius: 8,
  //   maxWidth: 150,
  //   borderWidth: 1,
  //   borderColor: '#378BBB',
  // },
  socialHandlePopup: {
    marginTop: 8,
    backgroundColor: '#16112B',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    maxWidth: 150,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  socialHandlePopupText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
    fontFamily: 'Inter-Medium',
  },
  xLogoLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  bottomPadding: {
    height: 40,
  },
  trustScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  // progressBarFill: {
  //   height: '100%',
  //   backgroundColor: '#378BBB',
  //   borderRadius: 999,
  //   shadowColor: '#378BBB',
  //   shadowOffset: { width: 0, height: 0 },
  //   shadowOpacity: 0.8,
  //   shadowRadius: 8,
  //   elevation: 8,
  // },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#8B2BE2',
    borderRadius: 999,
  },
  trustScorePercentage: {
    fontSize: 16,
    color: '#22D3EE',
    fontFamily: 'Inter-Bold',
    minWidth: 45,
    textAlign: 'right',
  },
  trustScoreInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  trustScoreInfoText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
});

export default SwipeHubScreen;
