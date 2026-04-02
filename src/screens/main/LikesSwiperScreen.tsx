/**
 * LIKES SWIPER SCREEN
 * 
 * Full-screen swiping interface for "Who Liked You" profiles.
 * - Clicked user appears at top of stack
 * - Remaining likers sorted by match score descending
 * - Reuses CardSwiper component from SwipeHub
 * - Real-time refill from useLikers hook
 * - Radiant Pulse animation on mutual match
 */

import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  Image,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  ActivityIndicator,
  ImageBackground,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Toast from 'react-native-toast-message';
import CardSwiper from '../../components/CardSwiper';
import MatchAnimation from '../../components/MatchAnimation';
import WhoLikedYouFilterModal from '../../components/WhoLikedYouFilterModal';
import { Liker } from '../../types/database';
import { calculateProfileCompleteness } from '../../utils/profileCompleteness';
import { getIntentCompatibilityType, getCommonInterests, formatIntent } from '../../utils/RecomendationEngine';
import { useLikers } from '../../hooks/useLikers';
import { WhoLikedYouFilters, DEFAULT_FILTERS } from '../../types/filters';

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.9;
const CARD_HEIGHT = height * 0.65;

type LikesSwiperRouteParams = {
  LikesSwiper: {
    clickedUserId: string;
  };
};

// Match data for animation
interface MatchData {
  matchId: string;
  chatId: string;
  matchedUser: Liker;
}

const LikesSwiperScreen = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const route = useRoute<RouteProp<LikesSwiperRouteParams, 'LikesSwiper'>>();
  const { clickedUserId } = route.params;

  const userId = auth().currentUser?.uid;
  const scrollViewRef = useRef<ScrollView>(null);
  const cardSwiperKey = useRef(0);

  // Filter state
  const [filters, setFilters] = useState<WhoLikedYouFilters>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Use the likers hook for real-time updates
  const {
    likers,
    loading,
    hasMore,
    refillQueue,
    markAsActedOn,
    availableOccupations,
  } = useLikers(filters);

  // State
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [swipedIds, setSwipedIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedSocial, setExpandedSocial] = useState<string | null>(null);
  const [currentUserInterests, setCurrentUserInterests] = useState<string[]>([]);
  const [currentUserIntent, setCurrentUserIntent] = useState<string | null>(null);
  
  // Match animation state
  const [showMatchAnimation, setShowMatchAnimation] = useState(false);
  const showMatchAnimationRef = useRef(false); // Ref for synchronous access in callbacks
  const [matchData, setMatchData] = useState<MatchData | null>(null);
  const [currentUserPhoto, setCurrentUserPhoto] = useState<string>('');

  /**
   * Load saved filters from AsyncStorage
   */
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const saved = await AsyncStorage.getItem('whoLikedYouFilters');
        if (saved) {
          setFilters(JSON.parse(saved));
        }
      } catch (error) {
        console.error('Error loading filters:', error);
      }
    };
    loadFilters();
  }, []);

  /**
   * Count active filters
   */
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.ageRange) count++;
    if (filters.heightRange) count++;
    if (filters.relationshipIntent && filters.relationshipIntent.length > 0) count++;
    if (filters.maxDistance !== null) count++;
    if (filters.occupations && filters.occupations.length > 0) count++;
    if (filters.trustScoreRange) count++;
    if (filters.matchScoreRange) count++;
    return count;
  }, [filters]);

  /**
   * Handle filter changes
   */
  const handleApplyFilters = async (newFilters: WhoLikedYouFilters) => {
    setFilters(newFilters);
    // Save to AsyncStorage
    try {
      await AsyncStorage.setItem('whoLikedYouFilters', JSON.stringify(newFilters));
    } catch (error) {
      console.error('Error saving filters:', error);
    }
  };

  /**
   * Fetch current user's photo for the animation
   */
  useEffect(() => {
    const fetchCurrentUserPhoto = async () => {
      if (!userId) return;
      
      try {
        const userDoc = await firestore().collection('users').doc(userId).get();
        if (userDoc.exists()) {
          const userData = userDoc.data();
          const photos = userData?.photos || [];
          const primaryPhoto = photos.find((p: any) => p.isPrimary) || photos[0];
          if (primaryPhoto?.url) {
            setCurrentUserPhoto(primaryPhoto.url);
          }
        }
      } catch (error) {
        console.error('Error fetching user photo:', error);
      }
    };

    fetchCurrentUserPhoto();
  }, [userId]);

  /**
   * Re-order likers: clicked user at top, rest sorted by match score
   * Filter out already swiped cards
   */
  const orderedLikers = useMemo(() => {
    // Filter out swiped likers
    const availableLikers = likers.filter(l => !swipedIds.has(l.swipeId));
    
    // Find the clicked user
    const clickedUser = availableLikers.find(l => l.id === clickedUserId);
    
    // Get remaining users sorted by match score
    const remaining = availableLikers
      .filter(l => l.id !== clickedUserId)
      .sort((a, b) => b.matchScore - a.matchScore);

    // Clicked user at top (if not already swiped)
    if (clickedUser) {
      return [clickedUser, ...remaining];
    }
    return remaining;
  }, [likers, clickedUserId, swipedIds]);

  // Get current liker for detail view
  const currentLiker = currentCardIndex < orderedLikers.length 
    ? orderedLikers[currentCardIndex] 
    : undefined;

  /**
   * Trigger refill when running low on cards
   */
  useEffect(() => {
    const remainingCards = orderedLikers.length - currentCardIndex;
    if (remainingCards <= 5 && hasMore && !loading) {
      refillQueue();
    }
  }, [currentCardIndex, orderedLikers.length, hasMore, loading, refillQueue]);

  /**
   * Handle back navigation
   */
  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  /**
   * Handle card tap for photo navigation
   */
  const handleCardTap = useCallback((side: 'left' | 'right') => {
    if (!currentLiker || !currentLiker.photos.length) return;

    if (side === 'right') {
      setCurrentPhotoIndex((prev) =>
        prev < currentLiker.photos.length - 1 ? prev + 1 : 0
      );
    } else {
      setCurrentPhotoIndex((prev) =>
        prev > 0 ? prev - 1 : currentLiker.photos.length - 1
      );
    }
  }, [currentLiker]);

  /**
   * Handle swipe right (like) - Creates mutual match!
   */
  const handleSwipeRight = useCallback(async (cardIndex: number) => {
    const liker = orderedLikers[cardIndex];
    if (!liker || !userId || isProcessing) return;

    // Set ref IMMEDIATELY before any async work - this tells handleSwipedAll not to navigate
    // Every swipe right in "Who Liked You" creates a match, so animation will show
    showMatchAnimationRef.current = true;

    setIsProcessing(true);

    try {
      // Mark as swiped locally first for immediate UI update
      setSwipedIds(prev => new Set(prev).add(liker.swipeId));

      // Mark the swipe as acted on in Firestore
      await firestore()
        .collection('swipes')
        .doc(liker.swipeId)
        .update({ actedOnByTarget: true });

      // Create a swipe record (current user liking back)
      await firestore().collection('swipes').add({
        fromUserId: userId,
        toUserId: liker.id,
        action: 'like',
        actedOnByTarget: true, // Already acted on since they liked us first
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Create a match document (mutual match!)
      const matchRef = await firestore().collection('matches').add({
        userA: userId,
        userB: liker.id,
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
        return data.participants.includes(liker.id);
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
        // Create a new chat for the match with isMutual: true
        const newChatRef = await firestore().collection('chats').add({
          type: 'dating',
          participants: [userId, liker.id],
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

      // Mark as acted on in the hook for proper tracking
      markAsActedOn(liker.swipeId);

      console.log(`💕 It's a Match with ${liker.name}!`);
      
      // Store match data and show the Radiant Pulse animation
      setMatchData({
        matchId: matchRef.id,
        chatId: chatRef.id,
        matchedUser: liker,
      });
      // Ref already set at start of function
      setShowMatchAnimation(true);

      // Force re-render of CardSwiper with new key
      cardSwiperKey.current += 1;
      
      // Reset for next card
      setCurrentCardIndex(0);
      setCurrentPhotoIndex(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

    } catch (error) {
      console.error('Error creating match:', error);
      // Reset ref on error - no animation will show
      showMatchAnimationRef.current = false;
      // Rollback local state on error
      setSwipedIds(prev => {
        const next = new Set(prev);
        next.delete(liker.swipeId);
        return next;
      });
      Toast.show({
        type: 'error',
        text1: 'Error',
        text2: 'Failed to create match. Please try again.',
        visibilityTime: 2000,
      });
    } finally {
      setIsProcessing(false);
    }
  }, [orderedLikers, userId, isProcessing, markAsActedOn]);

  /**
   * Handle swipe left (pass)
   */
  const handleSwipeLeft = useCallback(async (cardIndex: number) => {
    const liker = orderedLikers[cardIndex];
    if (!liker || !userId || isProcessing) return;

    setIsProcessing(true);

    try {
      // Mark as swiped locally first for immediate UI update
      setSwipedIds(prev => new Set(prev).add(liker.swipeId));

      // Mark the swipe as acted on (passed)
      await firestore()
        .collection('swipes')
        .doc(liker.swipeId)
        .update({ actedOnByTarget: true });

      // Create a pass swipe record
      await firestore().collection('swipes').add({
        fromUserId: userId,
        toUserId: liker.id,
        action: 'pass',
        actedOnByTarget: true,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Mark as acted on in the hook for proper tracking
      markAsActedOn(liker.swipeId);

      console.log(`❌ Passed: ${liker.name}`);

      // Force re-render of CardSwiper with new key
      cardSwiperKey.current += 1;
      
      // Reset for next card
      setCurrentCardIndex(0);
      setCurrentPhotoIndex(0);
      scrollViewRef.current?.scrollTo({ y: 0, animated: false });

    } catch (error) {
      console.error('Error recording pass:', error);
      // Rollback local state on error
      setSwipedIds(prev => {
        const next = new Set(prev);
        next.delete(liker.swipeId);
        return next;
      });
    } finally {
      setIsProcessing(false);
    }
  }, [orderedLikers, userId, isProcessing, markAsActedOn]);

  /**
   * Handle all cards swiped
   * Don't navigate away if match animation is showing
   */
  const handleSwipedAll = useCallback(() => {
    // If match animation is about to show, don't navigate away yet
    // The animation handlers will take care of navigation
    // Use ref for synchronous check (state may not be updated yet)
    if (showMatchAnimationRef.current) return;
    
    // Small delay to let the last swipe's match animation trigger if needed
    setTimeout(() => {
      // Re-check after delay in case animation was triggered
      if (!showMatchAnimationRef.current) {
        Toast.show({
          type: 'info',
          text1: 'All Done!',
          text2: "You've gone through all your likes",
          visibilityTime: 2000,
        });
        navigation.goBack();
      }
    }, 100);
  }, [navigation]);

  /**
   * Handle "Send Message" from match animation
   */
  const handleSendMessage = useCallback(() => {
    if (!matchData) return;
    
    showMatchAnimationRef.current = false; // Reset ref
    setShowMatchAnimation(false);
    
    // Navigate to chat with the matched user
    navigation.navigate('Chat', {
      chatId: matchData.chatId || null,
      recipientId: matchData.matchedUser.id,
      recipientName: matchData.matchedUser.name,
      recipientPhoto: matchData.matchedUser.photos?.[0]?.url,
    });
    
    setMatchData(null);
  }, [matchData, navigation]);

  /**
   * Handle "Keep Swiping" from match animation
   */
  const handleKeepSwiping = useCallback(() => {
    showMatchAnimationRef.current = false; // Reset ref
    setShowMatchAnimation(false);
    setMatchData(null);
    
    // Check if there are more cards to swipe, if not go back
    if (orderedLikers.length === 0) {
      Toast.show({
        type: 'info',
        text1: 'All Done!',
        text2: "You've gone through all your likes",
        visibilityTime: 2000,
      });
      navigation.goBack();
    }
  }, [orderedLikers.length, navigation]);

  /**
   * Render individual card
   */
  const renderCard = useCallback((liker: Liker, index: number, swipeProgress?: { direction: 'left' | 'right' | 'none', progress: number }) => {
    const photos = liker.photos || [];
    const photoIndex = index === currentCardIndex ? currentPhotoIndex : 0;
    const currentPhoto = photos[photoIndex]?.url || 'https://via.placeholder.com/400';
    const matchPercentage = Math.round(liker.matchScore);
    const distanceText = liker.distance !== null ? `${Math.round(liker.distance)} km away` : 'Location unknown';

    // Calculate border color based on swipe progress
    const getBorderColor = () => {
      if (!swipeProgress || swipeProgress.progress === 0) return '#378BBB'; // Blue default
      
      if (swipeProgress.direction === 'right') {
        // Interpolate from blue to red
        const blueAmount = Math.round(55 * (1 - swipeProgress.progress));
        const redAmount = Math.round(255 * swipeProgress.progress + 55 * (1 - swipeProgress.progress));
        const greenAmount = Math.round(139 * (1 - swipeProgress.progress) + 77 * swipeProgress.progress);
        const blueComponent = Math.round(187 * (1 - swipeProgress.progress) + 109 * swipeProgress.progress);
        return `rgb(${redAmount}, ${greenAmount}, ${blueComponent})`;
      } else if (swipeProgress.direction === 'left') {
        // Interpolate from blue to grey for pass
        const greyValue = Math.round(55 + (140 - 55) * swipeProgress.progress);
        return `rgb(${greyValue}, ${greyValue}, ${greyValue})`;
      }
      
      return '#378BBB';
    };
    
    // Calculate shadow color (follows border)
    const getShadowColor = () => {
      if (!swipeProgress || swipeProgress.progress === 0) return '#378BBB';
      if (swipeProgress.direction === 'right') return getBorderColor();
      if (swipeProgress.direction === 'left') return getBorderColor();
      return '#378BBB';
    };

    return (
      <View style={[styles.card, {
        borderColor: getBorderColor(),
        shadowColor: getShadowColor(),
      }]}>
        {/* Photo */}
        <Image
          source={{ uri: currentPhoto, cache: 'force-cache' }}
          style={styles.cardImage}
          resizeMode="cover"
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
        {photos.length > 1 && (
          <View style={styles.photoIndicators}>
            {photos.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.indicator,
                  i === (index === currentCardIndex ? currentPhotoIndex : 0) && styles.indicatorActive,
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
            <Text style={styles.trustedText}>{calculateProfileCompleteness(liker)}% Trusted</Text>
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
              <View style={styles.nameRow}>
                <Text style={styles.cardName}>
                  {liker.name}, {liker.age}
                </Text>
              </View>
              <View style={styles.cardMeta}>
                <Ionicons name="location-outline" size={14} color="#000000" />
                <Text style={styles.cardDistance}>{distanceText}</Text>
              </View>
            </View>
          </View>

          {/* Bio preview */}
          {liker.bio && (
            <Text style={styles.cardBio} numberOfLines={2}>
              {liker.bio}
            </Text>
          )}

          {/* Interests preview */}
          {liker.interests && liker.interests.length > 0 && (
            <View style={styles.interestsTags}>
              {liker.interests.slice(0, 3).map((interest, i) => (
                <View key={i} style={styles.interestTag}>
                  <Text style={styles.interestText}>{interest}</Text>
                </View>
              ))}
              {liker.interests.length > 3 && (
                <View style={styles.interestTag}>
                  <Text style={styles.interestText}>+{liker.interests.length - 3}</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  }, [currentCardIndex, currentPhotoIndex, handleCardTap]);

  // Loading state
  if (loading && orderedLikers.length === 0) {
  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Ionicons name="heart" size={24} color="#8B2BE2" />
            <Text style={styles.title}>Who Liked You</Text>
          </View>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B2BE2" />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    </ImageBackground>
  );
  }

  // Empty state - only show if NO animation is pending or showing
  // When animation is active, we skip this and render the main view (which includes MatchAnimation)
  if (orderedLikers.length === 0 && !showMatchAnimation) {
    // Double-check ref - if ref says animation should show, skip empty state
    // This handles the timing gap between ref update and state update
    if (!showMatchAnimationRef.current) {
      return (
        <ImageBackground
          source={require('../../assets/images/bg_splash.webp')}
          style={styles.container}
          resizeMode="cover"
        >
          <View style={styles.overlay}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
            <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
              <TouchableOpacity onPress={handleBack} style={styles.backButton}>
                <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
              </TouchableOpacity>
              <View style={styles.headerTitleContainer}>
                <Ionicons name="heart" size={24} color="#8B2BE2" />
                <Text style={styles.title}>Who Liked You</Text>
              </View>
              <View style={styles.headerRight} />
            </View>

            <View style={styles.emptyContainer}>
              <Ionicons name="heart-outline" size={80} color="rgba(255,255,255,0.55)" />
              <Text style={styles.emptyTitle}>All Caught Up!</Text>
              <Text style={styles.emptyText}>You've responded to all your likes</Text>

              <TouchableOpacity onPress={handleBack} activeOpacity={0.85}>
                <LinearGradient
                  colors={['#8B2BE2', '#06B6D4']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.backToHubButton}
                >
                  <Text style={styles.backToHubText}>Back to My Hub</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>
      );
    }
  }

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <TouchableOpacity onPress={handleBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Ionicons name="heart" size={24} color="#8B2BE2" />
          <Text style={styles.title}>Who Liked You</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.counter}>
            {orderedLikers.length} remaining
          </Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowFilterModal(true)}
          >
            <Ionicons name="options-outline" size={20} color="#A855F7" />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Processing indicator */}
      {isProcessing && (
        <View style={styles.processingOverlay}>
          <ActivityIndicator size="small" color="#8B2BE2" />
        </View>
      )}

      {/* Main Scrollable Content */}
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
        showsVerticalScrollIndicator={false}
        bounces={true}
      >
        {/* Card Swiper */}
        <View style={styles.swiperContainer}>
          <CardSwiper
            key={`swiper-${cardSwiperKey.current}`}
            data={orderedLikers}
            renderCard={renderCard}
            onSwipeRight={handleSwipeRight}
            onSwipeLeft={handleSwipeLeft}
            onSwipedAll={handleSwipedAll}
            stackSize={3}
          />
        </View>

        {/* Scroll indicator */}
        {currentLiker && (
          <View style={styles.scrollIndicator}>
            <Ionicons name="chevron-down" size={24} color="#999999" />
            <Text style={styles.scrollHintText}>Scroll for more details</Text>
          </View>
        )}

        {/* Profile Details Section */}
        {currentLiker && (
          <View style={styles.profileDetailsContainer}>
            {/* Basic Info Header */}
            <View style={styles.detailHeader}>
              <Text style={styles.detailName}>{currentLiker.name}, {currentLiker.age}</Text>
            </View>

            {/* Bio Section */}
            <View style={styles.detailSection}>
              <Text style={styles.detailSectionTitle}>Bio</Text>
              <View style={styles.bioBox}>
                <Text style={styles.bioBoxText}>
                  {currentLiker.bio || 'No bio added yet'}
                </Text>
              </View>
            </View>

            {/* Match Score Section */}
            {(() => {
              const commonInterests = getCommonInterests(currentUserInterests, currentLiker.interests || []);
              const intentType = getIntentCompatibilityType(currentUserIntent, currentLiker.relationshipIntent);
              const hasLocation = currentLiker.distance !== null && currentLiker.distance >= 0;
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
                        You both have same relationship Intent too: <Text style={styles.matchScoreHighlight}>{formatIntent(currentLiker.relationshipIntent)}</Text>
                      </Text>
                    )}
                    {intentType === 'compatible' && (
                      <Text style={styles.matchScoreText}>
                        You guys have compatible Intents: <Text style={styles.matchScoreHighlight}>{formatIntent(currentUserIntent)} ↔ {formatIntent(currentLiker.relationshipIntent)}</Text>
                      </Text>
                    )}

                    {/* Distance line */}
                    {hasLocation && currentLiker.distance !== null && (
                      <Text style={styles.matchScoreText}>
                        {hasPreviousLines ? 'And guess what?' : 'Guess what?'} They live only <Text style={styles.matchScoreHighlight}>{Math.round(currentLiker.distance)} kms</Text> away.
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
                {currentLiker.interests && currentLiker.interests.length > 0 ? (
                  <View style={styles.interestsContainer}>
                    {currentLiker.interests.map((interest, index) => (
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
                    {formatIntent(currentLiker.relationshipIntent) || 'Not specified'}
                  </Text>
                </View>

                {/* Interested In - Right */}
                <View style={styles.profileRowItemHalf}>
                  <Text style={styles.profileDetailTitle}>Interested In</Text>
                  {currentLiker.interestedIn && currentLiker.interestedIn.length > 0 ? (
                    <View style={styles.interestsContainer}>
                      {currentLiker.interestedIn.map((gender, index) => (
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
                    {currentLiker.height ? `${currentLiker.height.value} cm` : 'Not specified'}
                  </Text>
                </View>

                {/* Gender - Right */}
                <View style={styles.profileRowItemHalf}>
                  <Text style={styles.profileDetailTitle}>Gender</Text>
                  <Text style={styles.profileRowItemText}>
                    {currentLiker.gender ? 
                      currentLiker.gender.charAt(0).toUpperCase() + currentLiker.gender.slice(1) 
                      : 'Not specified'}
                  </Text>
                </View>
              </View>

              {/* Row 4: Occupation - Full Width */}
              <View style={styles.profileDetailSection}>
                <Text style={styles.profileDetailTitle}>Occupation</Text>
                <Text style={styles.profileRowItemText}>
                  {currentLiker.occupation || 'Not specified'}
                </Text>
              </View>

              {/* Row 5: Social Handles Section */}
              {currentLiker.socialHandles && (
                currentLiker.socialHandles.instagram || 
                currentLiker.socialHandles.linkedin || 
                currentLiker.socialHandles.facebook || 
                currentLiker.socialHandles.twitter
              ) && (
                <View style={styles.profileDetailSection}>
                  <Text style={styles.profileDetailTitle}>Socials</Text>
                  <View style={styles.socialIconsContainer}>
                    {currentLiker.socialHandles.instagram && (
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
                              @{currentLiker.socialHandles.instagram.replace('@', '')}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {currentLiker.socialHandles.linkedin && (
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
                              {currentLiker.socialHandles.linkedin}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {currentLiker.socialHandles.facebook && (
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
                              {currentLiker.socialHandles.facebook}
                            </Text>
                          </View>
                        )}
                      </View>
                    )}
                    {currentLiker.socialHandles.twitter && (
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
                              @{currentLiker.socialHandles.twitter.replace('@', '')}
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
                        { width: `${calculateProfileCompleteness(currentLiker)}%` }
                      ]} 
                    />
                  </View>
                  <Text style={styles.trustScorePercentage}>
                    {calculateProfileCompleteness(currentLiker)}%
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

      {/* Match Animation Overlay */}
      <MatchAnimation
        visible={showMatchAnimation}
        currentUserPhoto={currentUserPhoto}
        matchedUserPhoto={matchData?.matchedUser.photos.find(p => p.isPrimary)?.url || matchData?.matchedUser.photos[0]?.url}
        matchedUserName={matchData?.matchedUser.name}
        onSendMessage={handleSendMessage}
        onKeepSwiping={handleKeepSwiping}
      />

      {/* Filter Modal */}
      <WhoLikedYouFilterModal
        visible={showFilterModal}
        onClose={() => setShowFilterModal(false)}
        filters={filters}
        onApplyFilters={handleApplyFilters}
        availableOccupations={availableOccupations}
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  backButton: {
    padding: 4,
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 24,
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(26, 21, 48, 0.88)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    position: 'relative',
  },
  filterBadge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: '#8B2BE2',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    fontFamily: 'Inter-Bold',
  },
  counter: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Medium',
  },
  scrollContent: {
    flexGrow: 1,
  },
  swiperContainer: {
    height: CARD_HEIGHT + 40,
    paddingTop: 10,
  },
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
  indicator: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderRadius: 2,
  },
  indicatorActive: {
    backgroundColor: '#FFFFFF',
  },
  badgesContainer: {
    position: 'absolute',
    top: 16,
    right: 12,
    gap: 6,
    alignItems: 'flex-end',
  },
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
  matchText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  matchLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#FF4D6D',
    fontFamily: 'Inter-Medium',
  },
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
  trustedText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
  trustLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#2ECC71',
    fontFamily: 'Inter-Medium',
  },
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
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
  cardDistance: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'Inter-Regular',
  },
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
    fontFamily: 'Inter-SemiBold',
  },
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
  detailEmptyText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.35)',
    fontFamily: 'Inter-Regular',
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
  socialIconsContainer: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 8,
  },
  socialIconWrapper: {
    alignItems: 'center',
  },
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
  bottomPadding: {
    height: 40,
  },
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
  profileSection: {
    marginBottom: 24,
    backgroundColor: '#16112B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  processingOverlay: {
    position: 'absolute',
    top: 100,
    right: 20,
    zIndex: 100,
    backgroundColor: 'rgba(13, 11, 30, 0.95)',
    borderRadius: 20,
    padding: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 28,
    color: '#FFFFFF',
    marginTop: 20,
    marginBottom: 10,
    fontFamily: 'Inter-Bold',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  backToHubButton: {
    height: 54,
    paddingHorizontal: 24,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
  },
  backToHubText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
});

export default LikesSwiperScreen;
