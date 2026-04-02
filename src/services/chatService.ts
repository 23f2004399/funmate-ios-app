/**
 * CHAT SERVICE
 * 
 * Handles chat operations including soft deletion
 */

import firestore from '@react-native-firebase/firestore';

/**
 * Soft delete a chat for BOTH users
 * Sets deletedAt timestamp and schedules permanent deletion after 30 days
 * Chat disappears from both users' chat lists immediately
 * 
 * @param chatId - The chat document ID to delete
 * @param userId - The user who is deleting the chat
 */
export const deleteChat = async (chatId: string, userId: string): Promise<void> => {
  try {
    const now = firestore.Timestamp.now();
    const thirtyDaysLater = firestore.Timestamp.fromMillis(
      now.toMillis() + (30 * 24 * 60 * 60 * 1000) // 30 days in milliseconds
    );

    await firestore()
      .collection('chats')
      .doc(chatId)
      .update({
        deletedAt: now,
        deletedBy: userId,
        permanentlyDeleteAt: thirtyDaysLater,
      });

    console.log(`✅ Chat ${chatId} soft deleted by ${userId}. Will permanently delete after 30 days.`);
  } catch (error) {
    console.error('❌ Error deleting chat:', error);
    throw new Error('Failed to delete chat');
  }
};

/**
 * Check if a chat is deleted
 */
export const isChatDeleted = (chat: any): boolean => {
  return chat?.deletedAt !== null && chat?.deletedAt !== undefined;
};
