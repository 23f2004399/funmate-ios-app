/**
 * MATCH SCORING UTILITY
 * 
 * Calculates match compatibility score based on:
 * - Distance (0-30 points) - 0 if outside radius or missing location
 * - Relationship intent (0-30 points) - incompatible = HARD FILTER
 * - Shared interests (0-30 points)
 * - Activity recency (0-10 points)
 * 
 * Total: 0-100 points (capped, never exceeds 100)
 * 
 * HARD FILTERS (exclude from feed):
 * - Gender mismatch (based on interestedIn)
 * - Incompatible relationship intent (hookups ↔ long_term, hookups ↔ friendship)
 * 
 * Distance > radius gets 0 points BUT still shows in feed
 */

interface UserProfile {
  location?: {
    latitude: number;
    longitude: number;
  };
  matchRadiusKm: number;
  relationshipIntent: string | null;
  interests: string[];
  lastActiveAt?: any;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/**
 * Calculate distance score (0-30 points)
 * - If outside radius: 0 points (but still show card)
 * - If no location: 0 points (no redistribution)
 * - Closer = higher score
 */
const calculateDistanceScore = (
  distance: number | null,
  maxRadius: number
): number => {
  if (distance === null || distance > maxRadius) return 0;
  return Math.round(30 * (1 - distance / maxRadius));
};

/**
 * Calculate relationship intent compatibility (0-30 points)
 * 
 * EXACT MATCH (30 points):
 * - Same intent
 * 
 * COMPATIBLE OVERLAP (20 points):
 * - long_term ↔ unsure
 * - casual ↔ unsure
 * - hookups ↔ unsure
 * - hookups ↔ casual
 * - friendship ↔ unsure
 * 
 * WEAK OVERLAP (10 points):
 * - long_term ↔ casual
 * - long_term ↔ friendship
 * - casual ↔ friendship
 * 
 * INCOMPATIBLE (0 points + HARD FILTER in passesFilters):
 * - long_term ↔ hookups
 * - friendship ↔ hookups
 */
const calculateIntentScore = (
  userIntent: string | null,
  matchIntent: string | null
): number => {
  if (!userIntent || !matchIntent) return 0;
  
  // Exact match (30 points)
  if (userIntent === matchIntent) return 30;
  
  // Compatible overlaps (20 points)
  const compatiblePairs = [
    ['long_term', 'unsure'],
    ['casual', 'unsure'],
    ['hookups', 'unsure'],
    ['hookups', 'casual'],
    ['friendship', 'unsure'],
  ];
  
  const isCompatible = compatiblePairs.some(
    ([a, b]) =>
      (userIntent === a && matchIntent === b) ||
      (userIntent === b && matchIntent === a)
  );
  
  if (isCompatible) return 20;
  
  // Weak overlaps (10 points)
  const weakPairs = [
    ['long_term', 'casual'],
    ['long_term', 'friendship'],
    ['casual', 'friendship'],
  ];
  
  const isWeak = weakPairs.some(
    ([a, b]) =>
      (userIntent === a && matchIntent === b) ||
      (userIntent === b && matchIntent === a)
  );
  
  if (isWeak) return 10;
  
  // Incompatible (should be filtered out, but return 0 if somehow reached)
  return 0;
};

/**
 * Calculate shared interests score (0-30 points)
 * Common interests = min(userInterests, matchInterests)
 */
const calculateInterestsScore = (
  userInterests: string[],
  matchInterests: string[]
): number => {
  if (!userInterests.length || !matchInterests.length) return 0;
  
  const common = userInterests.filter((interest) =>
    matchInterests.includes(interest)
  );
  
  // Normalize by the smaller set (max possible common)
  const minInterests = Math.min(userInterests.length, matchInterests.length);
  return Math.round((common.length / minInterests) * 30);
};

/**
 * Calculate activity recency score (0-10 points)
 */
const calculateActivityScore = (lastActiveAt: any): number => {
  if (!lastActiveAt) return 0;
  
  const now = Date.now();
  const lastActive = lastActiveAt.toDate ? lastActiveAt.toDate().getTime() : lastActiveAt;
  const hoursSinceActive = (now - lastActive) / (1000 * 60 * 60);
  
  if (hoursSinceActive < 1) return 10;
  if (hoursSinceActive < 24) return 6;
  if (hoursSinceActive < 72) return 3;
  return 0;
};

/**
 * Calculate total match score (0-100)
 * 
 * ALWAYS USES FULL SCORING:
 * - Distance: 30 points (0 if outside radius or no location)
 * - Intent: 30 points
 * - Interests: 30 points
 * - Activity: 10 points
 * 
 * NO REDISTRIBUTION when location is missing
 */
export const calculateMatchScore = (
  currentUser: UserProfile,
  potentialMatch: UserProfile,
  distance: number | null
): number => {
  // Distance score (0 if missing location or outside radius)
  const distanceScore = calculateDistanceScore(distance, currentUser.matchRadiusKm);
  
  // Intent score (0-30)
  const intentScore = calculateIntentScore(
    currentUser.relationshipIntent,
    potentialMatch.relationshipIntent
  );
  
  // Interests score (0-30)
  const interestsScore = calculateInterestsScore(
    currentUser.interests,
    potentialMatch.interests
  );
  
  // Activity score (0-10)
  const activityScore = calculateActivityScore(potentialMatch.lastActiveAt);
  
  // Total (capped at 100)
  const total = distanceScore + intentScore + interestsScore + activityScore;
  return Math.min(total, 100);
};

/**
 * Check if two users pass hard filters
 * 
 * HARD FILTERS (exclude from feed):
 * 1. Gender mismatch (user's interestedIn doesn't include match's gender)
 * 2. Incompatible relationship intent:
 *    - long_term ↔ hookups
 *    - friendship ↔ hookups
 * 
 * Distance > radius is NOT a hard filter (shows with 0 distance points)
 */
export const passesFilters = (
  currentUser: {
    interestedIn: string[];
    relationshipIntent: string | null;
  },
  potentialMatch: {
    gender: string;
    relationshipIntent: string | null;
  }
): boolean => {
  // Gender preference filter
  // If interestedIn is empty, it means no gender preference is set - show all genders
  if (currentUser.interestedIn.length > 0 && !currentUser.interestedIn.includes(potentialMatch.gender)) {
    return false;
  }
  
  // Relationship intent incompatibility filter
  if (currentUser.relationshipIntent && potentialMatch.relationshipIntent) {
    const incompatiblePairs = [
      ['hookups', 'long_term'],
      ['hookups', 'friendship'],
    ];
    
    const isIncompatible = incompatiblePairs.some(
      ([a, b]) =>
        (currentUser.relationshipIntent === a && potentialMatch.relationshipIntent === b) ||
        (currentUser.relationshipIntent === b && potentialMatch.relationshipIntent === a)
    );
    
    if (isIncompatible) return false;
  }
  
  return true;
};

/**
 * Get intent compatibility type
 * Returns: 'exact' | 'compatible' | 'weak' | 'none'
 */
export const getIntentCompatibilityType = (
  userIntent: string | null,
  matchIntent: string | null
): 'exact' | 'compatible' | 'weak' | 'none' => {
  if (!userIntent || !matchIntent) return 'none';
  
  // Exact match
  if (userIntent === matchIntent) return 'exact';
  
  // Compatible overlaps (20 points)
  const compatiblePairs = [
    ['long_term', 'unsure'],
    ['casual', 'unsure'],
    ['hookups', 'unsure'],
    ['hookups', 'casual'],
    ['friendship', 'unsure'],
  ];
  
  const isCompatible = compatiblePairs.some(
    ([a, b]) =>
      (userIntent === a && matchIntent === b) ||
      (userIntent === b && matchIntent === a)
  );
  
  if (isCompatible) return 'compatible';
  
  // Weak overlaps (10 points)
  const weakPairs = [
    ['long_term', 'casual'],
    ['long_term', 'friendship'],
    ['casual', 'friendship'],
  ];
  
  const isWeak = weakPairs.some(
    ([a, b]) =>
      (userIntent === a && matchIntent === b) ||
      (userIntent === b && matchIntent === a)
  );
  
  if (isWeak) return 'weak';
  
  return 'none';
};

/**
 * Get common interests between two users
 * Returns array of shared interests
 */
export const getCommonInterests = (
  userInterests: string[],
  matchInterests: string[]
): string[] => {
  if (!userInterests.length || !matchInterests.length) return [];
  return userInterests.filter((interest) => matchInterests.includes(interest));
};

/**
 * Format relationship intent for display
 */
export const formatIntent = (intent: string | null): string => {
  if (!intent) return '';
  
  const intentMap: { [key: string]: string } = {
    'long_term': 'Long Term',
    'casual': 'Casual',
    'hookups': 'Hookups',
    'friendship': 'Friendship',
    'unsure': 'Not sure yet',
  };
  
  return intentMap[intent] || intent;
};
