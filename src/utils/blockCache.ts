/**
 * BLOCK CACHE UTILITY
 * 
 * Caches blocked user IDs to avoid redundant Firestore queries
 * Automatically refreshes cache when block/unblock actions occur
 */

import firestore from '@react-native-firebase/firestore';

interface BlockCache {
  blockedUserIds: Set<string>;
  lastFetched: number;
  isStale: boolean;
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const cache: Map<string, BlockCache> = new Map();

/**
 * Get blocked user IDs (both directions) with caching
 */
export const getBlockedUserIds = async (userId: string): Promise<string[]> => {
  const cached = cache.get(userId);
  const now = Date.now();

  // Return cached data if fresh (less than 5 minutes old)
  if (cached && !cached.isStale && now - cached.lastFetched < CACHE_TTL) {
    return Array.from(cached.blockedUserIds);
  }

  // Fetch fresh data
  const [blockedByMe, blockedMe] = await Promise.all([
    firestore()
      .collection('blockedUsers')
      .where('userId', '==', userId)
      .get(),
    firestore()
      .collection('blockedUsers')
      .where('blockedUserId', '==', userId)
      .get(),
  ]);

  const blockedUserIds = new Set([
    ...blockedByMe.docs.map(doc => doc.data().blockedUserId as string),
    ...blockedMe.docs.map(doc => doc.data().userId as string),
  ]);

  // Update cache
  cache.set(userId, {
    blockedUserIds,
    lastFetched: now,
    isStale: false,
  });

  return Array.from(blockedUserIds);
};

/**
 * Invalidate cache when user blocks/unblocks someone
 */
export const invalidateBlockCache = (userId: string) => {
  const cached = cache.get(userId);
  if (cached) {
    cached.isStale = true;
  }
};

/**
 * Clear all cache (logout)
 */
export const clearBlockCache = () => {
  cache.clear();
};
