/**
 * BLOCK SERVICE
 * 
 * Handles blocking and unblocking users with proper Firestore updates
 */

import firestore from '@react-native-firebase/firestore';
import { BlockedUser, Match } from '../types/database';
import { invalidateBlockCache } from '../utils/blockCache';

const COLLECTIONS = {
  BLOCKED_USERS: 'blockedUsers',
  MATCHES: 'matches',
};

/**
 * Block a user
 * - Creates blockedUsers entry
 * - Updates match.blockedBy field (two-way invisibility)
 * - Does NOT delete the match (preserves for unblock)
 */
export const blockUser = async (
  currentUserId: string,
  blockedUserId: string,
  reason: string | null = null
): Promise<void> => {
  const batch = firestore().batch();

  try {
    // Check if already blocked to prevent duplicates
    const existingBlock = await isUserBlocked(currentUserId, blockedUserId);
    if (existingBlock) {
      console.log('⚠️ User is already blocked');
      return; // Silently return if already blocked
    }

    // 1. Create blocked user entry
    const blockRef = firestore().collection(COLLECTIONS.BLOCKED_USERS).doc();
    const blockData: Omit<BlockedUser, 'id'> = {
      userId: currentUserId,
      blockedUserId: blockedUserId,
      reason,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(blockRef, blockData);

    // 2. Find and update the match (if exists) via chat's relatedMatchId
    // We can't query matches directly due to security rules, so we find it through chats
    const chatsQuery = await firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUserId)
      .get();

    const chat = chatsQuery.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(blockedUserId) && data.relatedMatchId;
    });

    if (chat) {
      const chatData = chat.data();
      const matchRef = firestore().collection(COLLECTIONS.MATCHES).doc(chatData.relatedMatchId);
      batch.update(matchRef, {
        blockedBy: currentUserId,
      });
    }

    await batch.commit();
    invalidateBlockCache(currentUserId); // Invalidate cache
    console.log(`✅ User ${blockedUserId} blocked successfully`);
  } catch (error) {
    console.error('❌ Error blocking user:', error);
    throw new Error('Failed to block user');
  }
};

/**
 * Unblock a user
 * - Deletes blockedUsers entry
 * - Removes match.blockedBy field (restores visibility)
 * - Match remains intact with full history
 */
export const unblockUser = async (
  currentUserId: string,
  blockedUserId: string
): Promise<void> => {
  const batch = firestore().batch();

  try {
    // 1. Delete blocked user entry
    const blockQuery = await firestore()
      .collection(COLLECTIONS.BLOCKED_USERS)
      .where('userId', '==', currentUserId)
      .where('blockedUserId', '==', blockedUserId)
      .get();

    blockQuery.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // 2. Remove blockedBy from match (via chat's relatedMatchId)
    const chatsQuery = await firestore()
      .collection('chats')
      .where('participants', 'array-contains', currentUserId)
      .get();

    const chat = chatsQuery.docs.find(doc => {
      const data = doc.data();
      return data.participants.includes(blockedUserId) && data.relatedMatchId;
    });

    if (chat) {
      const chatData = chat.data();
      const matchDoc = await firestore().collection(COLLECTIONS.MATCHES).doc(chatData.relatedMatchId).get();
      
      if (matchDoc.exists() && matchDoc.data()?.blockedBy === currentUserId) {
        const matchRef = firestore().collection(COLLECTIONS.MATCHES).doc(chatData.relatedMatchId);
        batch.update(matchRef, {
          blockedBy: null,
        });
      }
    }

    await batch.commit();
    invalidateBlockCache(currentUserId); // Invalidate cache
    console.log(`✅ User ${blockedUserId} unblocked successfully`);
  } catch (error) {
    console.error('❌ Error unblocking user:', error);
    throw new Error('Failed to unblock user');
  }
};

/**
 * Check if current user has blocked another user
 */
export const isUserBlocked = async (
  currentUserId: string,
  otherUserId: string
): Promise<boolean> => {
  try {
    const blockSnapshot = await firestore()
      .collection(COLLECTIONS.BLOCKED_USERS)
      .where('userId', '==', currentUserId)
      .where('blockedUserId', '==', otherUserId)
      .limit(1)
      .get();

    return !blockSnapshot.empty;
  } catch (error) {
    console.error('❌ Error checking block status:', error);
    return false;
  }
};

/**
 * Get all blocked users for current user
 */
export const getBlockedUsers = async (
  currentUserId: string
): Promise<BlockedUser[]> => {
  try {
    const snapshot = await firestore()
      .collection(COLLECTIONS.BLOCKED_USERS)
      .where('userId', '==', currentUserId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    } as BlockedUser));
  } catch (error) {
    console.error('❌ Error fetching blocked users:', error);
    return [];
  }
};

/**
 * Check if match is blocked (by either user)
 */
export const isMatchBlocked = async (matchId: string): Promise<boolean> => {
  try {
    const matchDoc = await firestore()
      .collection(COLLECTIONS.MATCHES)
      .doc(matchId)
      .get();

    if (!matchDoc.exists) return false;

    const match = matchDoc.data() as Match;
    return match.blockedBy !== null && match.blockedBy !== undefined;
  } catch (error) {
    console.error('❌ Error checking match block status:', error);
    return false;
  }
};
/**
 * Check if sender is blocked by recipient
 * Used for shadow blocking - message gets sent but hidden from blocker
 */
export const isBlockedBy = async (
  senderId: string,
  recipientId: string
): Promise<boolean> => {
  try {
    const blockSnapshot = await firestore()
      .collection(COLLECTIONS.BLOCKED_USERS)
      .where('userId', '==', recipientId)
      .where('blockedUserId', '==', senderId)
      .limit(1)
      .get();

    return !blockSnapshot.empty;
  } catch (error) {
    console.error('❌ Error checking if blocked by user:', error);
    return false;
  }
};