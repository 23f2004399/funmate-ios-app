/**
 * USE LIKERS HOOK
 * 
 * Fetches and manages "Who Liked You" data for My Hub.
 * 
 * Features:
 * - Fetches users who liked the current user (action: 'like', actedOnByTarget: false)
 * - Calculates live match scores using RecommendationEngine
 * - Sorts by match score descending
 * - Provides refill mechanism to maintain Top 20 visibility
 * - Real-time updates via Firestore listener
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { Liker, Swipe, UserLocation } from '../types/database';
import { calculateMatchScore, calculateDistance } from '../utils/RecomendationEngine';
import { getBlockedUserIds } from '../utils/blockCache';
import { WhoLikedYouFilters } from '../types/filters';
import { calculateProfileCompleteness } from '../utils/profileCompleteness';

const BATCH_SIZE = 20;

interface UseLikersResult {
  likers: Liker[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  totalCount: number;
  refetch: () => Promise<void>;
  refillQueue: () => Promise<void>;
  markAsActedOn: (swipeId: string) => Promise<void>;
  availableOccupations: string[]; // Unique occupations for filter
}

interface CurrentUserProfile {
  location: UserLocation | null;
  matchRadiusKm: number;
  relationshipIntent: string | null;
  interests: string[];
  interestedIn: string[];
}

export const useLikers = (filters?: WhoLikedYouFilters): UseLikersResult => {
  const [likers, setLikers] = useState<Liker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [availableOccupations, setAvailableOccupations] = useState<string[]>([]);
  
  // Refs for mutable state that shouldn't cause re-renders
  const currentUserProfileRef = useRef<CurrentUserProfile | null>(null);
  const lastDocumentRef = useRef<any>(null);
  const allSwipeIdsRef = useRef<Set<string>>(new Set());
  const isFetchingRef = useRef(false);
  
  const userId = auth().currentUser?.uid;

  /**
   * Calculate distance between two locations
   */
  const getDistance = (
    userLocation: UserLocation | null,
    likerLocation: UserLocation | null
  ): number | null => {
    if (!userLocation || !likerLocation) {
      return null;
    }
    
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      likerLocation.latitude,
      likerLocation.longitude
    );
  };

  /**
   * Process a swipe document and fetch liker profile
   */
  const processSwipe = async (
    swipeDoc: any,
    userProfile: CurrentUserProfile | null
  ): Promise<Liker | null> => {
    try {
      const swipeData = swipeDoc.data() as Swipe;
      const swipeId = swipeDoc.id;
      
      // Skip if already processed
      if (allSwipeIdsRef.current.has(swipeId)) {
        return null;
      }
      
      // Fetch liker's profile
      const likerDoc = await firestore()
        .collection('users')
        .doc(swipeData.fromUserId)
        .get();
      
      if (!likerDoc.exists) {
        return null;
      }
      
      const likerData = likerDoc.data()!;
      
      // Calculate distance
      const likerLocation = likerData.location || null;
      const distance = getDistance(
        userProfile && userProfile.location ? userProfile.location : null,
        likerLocation
      );
      
      // Calculate match score using RecommendationEngine
      // Use actual user profile data - if no data, score will be 0
      const matchScore = calculateMatchScore(
        {
          location: userProfile?.location || undefined,
          matchRadiusKm: userProfile?.matchRadiusKm || 25,
          relationshipIntent: userProfile?.relationshipIntent || null,
          interests: userProfile?.interests || [],
          lastActiveAt: null,
        },
        {
          location: likerLocation || undefined,
          matchRadiusKm: likerData.matchRadiusKm || 25,
          relationshipIntent: likerData.relationshipIntent || null,
          interests: likerData.interests || [],
          lastActiveAt: likerData.lastActiveAt,
        },
        distance
      );
      
      allSwipeIdsRef.current.add(swipeId);
      
      // Calculate profile completeness
      const completeness = calculateProfileCompleteness(likerData);
      
      return {
        id: swipeData.fromUserId,
        swipeId: swipeId,
        name: likerData.name || 'Unknown',
        age: likerData.age || 0,
        gender: likerData.gender || '',
        bio: likerData.bio || '',
        interests: likerData.interests || [],
        relationshipIntent: likerData.relationshipIntent || null,
        interestedIn: likerData.interestedIn || [],
        photos: likerData.photos || [],
        location: likerLocation,
        isVerified: likerData.isVerified || false,
        matchScore,
        distance,
        lastActiveAt: likerData.lastActiveAt,
        likedAt: swipeData.createdAt,
        height: likerData.height || null,
        occupation: likerData.occupation || null,
        socialHandles: likerData.socialHandles || null,
        completeness,
      };
    } catch (err) {
      console.error('Error processing swipe:', err);
      return null;
    }
  };

  /**
   * Fetch current user's profile
   */
  const fetchCurrentUserProfile = async (uid: string): Promise<CurrentUserProfile | null> => {
    try {
      const userDoc = await firestore().collection('users').doc(uid).get();
      const data = userDoc.data();
      
      if (!data) return null;
      
      return {
        location: data.location || null,
        matchRadiusKm: data.matchRadiusKm || 25,
        relationshipIntent: data.relationshipIntent || null,
        interests: data.interests || [],
        interestedIn: data.interestedIn || [],
      };
    } catch (err) {
      console.error('Error fetching current user profile:', err);
      return null;
    }
  };

  /**
   * Fetch likers with pagination
   */
  const fetchLikers = useCallback(async (isRefill: boolean = false): Promise<void> => {
    if (!userId) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    // Prevent duplicate fetches
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (!isRefill) {
        setLoading(true);
        setError(null);
      }

      // ALWAYS fetch fresh user profile first (not from cache)
      const userProfile = await fetchCurrentUserProfile(userId);
      currentUserProfileRef.current = userProfile;

      // Get blocked user IDs (cached for 5 minutes)
      const blockedUserIds = new Set(await getBlockedUserIds(userId));

      // Build query for swipes where current user is the target
      let query = firestore()
        .collection('swipes')
        .where('toUserId', '==', userId)
        .where('action', '==', 'like')
        .where('actedOnByTarget', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(BATCH_SIZE);

      // If refilling, start after last document
      if (isRefill && lastDocumentRef.current) {
        query = query.startAfter(lastDocumentRef.current);
      }

      const snapshot = await query.get();
      
      if (snapshot.empty && !isRefill) {
        setLikers([]);
        setHasMore(false);
        setTotalCount(0);
        setLoading(false);
        isFetchingRef.current = false;
        return;
      }

      // Store last document for pagination
      if (!snapshot.empty) {
        lastDocumentRef.current = snapshot.docs[snapshot.docs.length - 1];
      }

      // Process each swipe - pass user profile directly
      const likerPromises = snapshot.docs.map(doc => processSwipe(doc, userProfile));
      const processedLikers = await Promise.all(likerPromises);
      
      // Filter out nulls, blocked users, and sort by match score descending
      const validLikers = processedLikers
        .filter((liker): liker is Liker => liker !== null && !blockedUserIds.has(liker.id))
        .sort((a, b) => b.matchScore - a.matchScore);

      if (isRefill) {
        setLikers(prev => {
          const combined = [...prev, ...validLikers];
          return combined.sort((a, b) => b.matchScore - a.matchScore);
        });
      } else {
        setLikers(validLikers);
      }

      // Check if there are more
      setHasMore(snapshot.docs.length === BATCH_SIZE);
      
      // Get total count
      const countSnapshot = await firestore()
        .collection('swipes')
        .where('toUserId', '==', userId)
        .where('action', '==', 'like')
        .where('actedOnByTarget', '==', false)
        .count()
        .get();
      
      setTotalCount(countSnapshot.data().count);

    } catch (err: any) {
      console.error('Error fetching likers:', err);
      setError(err.message || 'Failed to fetch likers');
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  }, [userId]);

  /**
   * Refetch all likers (reset pagination)
   */
  const refetch = useCallback(async (): Promise<void> => {
    lastDocumentRef.current = null;
    allSwipeIdsRef.current.clear();
    currentUserProfileRef.current = null;
    await fetchLikers(false);
  }, [fetchLikers]);

  /**
   * Refill the queue (fetch next batch)
   */
  const refillQueue = useCallback(async (): Promise<void> => {
    if (!hasMore || loading) return;
    await fetchLikers(true);
  }, [fetchLikers, hasMore, loading]);

  /**
   * Mark a swipe as acted on (after user swipes in My Hub)
   */
  const markAsActedOn = useCallback(async (swipeId: string): Promise<void> => {
    try {
      await firestore()
        .collection('swipes')
        .doc(swipeId)
        .update({ actedOnByTarget: true });

      // Remove from local state
      setLikers(prev => prev.filter(liker => liker.swipeId !== swipeId));
      setTotalCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Error marking swipe as acted on:', err);
    }
  }, []);

  /**
   * Initial fetch and reset on userId change
   */
  useEffect(() => {
    // Clear all cached data
    currentUserProfileRef.current = null;
    lastDocumentRef.current = null;
    allSwipeIdsRef.current.clear();
    isFetchingRef.current = false;
    
    // Reset state
    setLikers([]);
    setTotalCount(0);
    setHasMore(false);
    setError(null);
    setLoading(true);

    // Fetch if we have a user
    if (userId) {
      // Call fetchLikers directly - it's safe because it only depends on userId
      fetchLikers(false);
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Intentionally only depend on userId

  /**
   * Real-time listener for new likes
   */
  useEffect(() => {
    if (!userId) return;

    let unsubscribe: (() => void) | null = null;

    // Small delay to let initial fetch complete first
    const timeoutId = setTimeout(() => {
      unsubscribe = firestore()
        .collection('swipes')
        .where('toUserId', '==', userId)
        .where('action', '==', 'like')
        .where('actedOnByTarget', '==', false)
        .onSnapshot(
          async (snapshot) => {
            // Skip if initial fetch hasn't completed
            if (isFetchingRef.current) return;
            
            for (const change of snapshot.docChanges()) {
              if (change.type === 'added') {
                const swipeId = change.doc.id;
                if (!allSwipeIdsRef.current.has(swipeId)) {
                  const newLiker = await processSwipe(change.doc, currentUserProfileRef.current);
                  if (newLiker) {
                    setLikers(prev => {
                      const updated = [newLiker, ...prev];
                      return updated.sort((a, b) => b.matchScore - a.matchScore);
                    });
                    setTotalCount(prev => prev + 1);
                  }
                }
              } else if (change.type === 'removed') {
                const swipeId = change.doc.id;
                setLikers(prev => prev.filter(l => l.swipeId !== swipeId));
                allSwipeIdsRef.current.delete(swipeId);
                setTotalCount(prev => Math.max(0, prev - 1));
              }
            }
          },
          (err) => {
            // Only log error if we still have a user (not logged out)
            if (auth().currentUser) {
              console.error('Likers listener error:', err);
            }
          }
        );
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [userId]);

  // Apply filters and extract unique occupations
  const filteredLikers = filters ? likers.filter(liker => {
    // Age Range Filter
    if (filters.ageRange) {
      if (liker.age < filters.ageRange.min || liker.age > filters.ageRange.max) {
        return false;
      }
    }

    // Height Range Filter
    if (filters.heightRange && liker.height?.value) {
      if (liker.height.value < filters.heightRange.min || liker.height.value > filters.heightRange.max) {
        return false;
      }
    }

    // Relationship Intent Filter
    if (filters.relationshipIntent && filters.relationshipIntent.length > 0) {
      if (!liker.relationshipIntent || !filters.relationshipIntent.includes(liker.relationshipIntent)) {
        return false;
      }
    }

    // Distance Filter
    if (filters.maxDistance !== null && liker.distance !== null) {
      if (liker.distance > filters.maxDistance) {
        return false;
      }
    }

    // Occupation Filter
    if (filters.occupations && filters.occupations.length > 0) {
      if (!liker.occupation || !filters.occupations.includes(liker.occupation)) {
        return false;
      }
    }

    // Trust Score (Completeness) Filter
    if (filters.trustScoreRange) {
      if (liker.completeness < filters.trustScoreRange.min || liker.completeness > filters.trustScoreRange.max) {
        return false;
      }
    }

    // Match Score Filter
    if (filters.matchScoreRange) {
      if (liker.matchScore < filters.matchScoreRange.min || liker.matchScore > filters.matchScoreRange.max) {
        return false;
      }
    }

    return true;
  }) : likers;

  // Extract unique occupations from all likers (unfiltered)
  const uniqueOccupations = Array.from(
    new Set(
      likers
        .map(l => l.occupation)
        .filter((occ): occ is string => !!occ)
    )
  ).sort();

  return {
    likers: filteredLikers,
    loading,
    error,
    hasMore,
    totalCount,
    availableOccupations: uniqueOccupations,
    refetch,
    refillQueue,
    markAsActedOn,
  };
};

export default useLikers;
