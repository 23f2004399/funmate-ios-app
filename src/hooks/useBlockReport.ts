/**
 * USE BLOCK REPORT HOOK
 * 
 * Custom hook to easily integrate Block & Report functionality
 * Provides all necessary states and handlers
 * 
 * Note: This hook throws errors instead of showing alerts.
 * The calling component should catch errors and show appropriate UI.
 */

import { useState, useCallback } from 'react';
import auth from '@react-native-firebase/auth';
import { blockUser, unblockUser, isUserBlocked } from '../services/blockService';
import { reportUser } from '../services/reportService';
import { ReportReason } from '../types/database';

interface UseBlockReportOptions {
  targetUserId: string;
  targetUserName: string;
  onBlockSuccess?: () => void;
  onUnblockSuccess?: () => void;
  onReportSuccess?: () => void;
}

export const useBlockReport = ({
  targetUserId,
  targetUserName,
  onBlockSuccess,
  onUnblockSuccess,
  onReportSuccess,
}: UseBlockReportOptions) => {
  const [isBlocked, setIsBlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);

  const currentUserId = auth().currentUser?.uid;

  /**
   * Check if user is already blocked
   */
  const checkBlockStatus = useCallback(async () => {
    if (!currentUserId || !targetUserId) return;

    try {
      const blocked = await isUserBlocked(currentUserId, targetUserId);
      setIsBlocked(blocked);
      return blocked;
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  }, [currentUserId, targetUserId]);

  /**
   * Block the target user
   * Throws on error - caller should handle UI feedback
   */
  const handleBlock = useCallback(async () => {
    if (!currentUserId || !targetUserId) {
      throw new Error('Unable to block user. Please try again.');
    }

    setIsLoading(true);
    try {
      await blockUser(currentUserId, targetUserId, null);
      setIsBlocked(true);
      setShowModal(false);
      onBlockSuccess?.();
    } catch (error) {
      console.error('Error blocking user:', error);
      throw new Error('Failed to block user. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, targetUserId, targetUserName, onBlockSuccess]);

  /**
   * Unblock the target user (no confirmation - caller should handle UI)
   */
  const handleUnblock = useCallback(async () => {
    if (!currentUserId || !targetUserId) {
      throw new Error('Unable to unblock user');
    }

    setIsLoading(true);
    try {
      await unblockUser(currentUserId, targetUserId);
      setIsBlocked(false);
      onUnblockSuccess?.();
    } catch (error) {
      console.error('Error unblocking user:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, targetUserId, onUnblockSuccess]);

  /**
   * Report the target user (no UI alerts - caller handles them)
   */
  const handleReport = useCallback(
    async (reason: ReportReason, description: string, screenshots: string[] = []) => {
      if (!currentUserId || !targetUserId) {
        throw new Error('Unable to submit report');
      }

      setIsLoading(true);
      try {
        await reportUser(currentUserId, targetUserId, reason, description, screenshots);
        setShowModal(false);
        onReportSuccess?.();
      } catch (error) {
        console.error('Error submitting report:', error);
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [currentUserId, targetUserId, onReportSuccess]
  );

  /**
   * Open the Block/Report modal
   */
  const openModal = useCallback(async () => {
    await checkBlockStatus(); // Check block status before opening
    setShowModal(true);
  }, [checkBlockStatus]);

  /**
   * Close the Block/Report modal
   */
  const closeModal = useCallback(() => {
    setShowModal(false);
  }, []);

  return {
    // States
    isBlocked,
    isLoading,
    showModal,
    
    // Handlers
    handleBlock,
    handleUnblock,
    handleReport,
    checkBlockStatus,
    
    // Modal controls
    openModal,
    closeModal,
  };
};

/**
 * USAGE EXAMPLE
 * 
 * In your ChatScreen.tsx:
 */

/*
import { useBlockReport } from '../hooks/useBlockReport';
import { BlockReportModal } from '../components/modals/BlockReportModal';

const ChatScreen = ({ route, navigation }) => {
  const { otherUser } = route.params;
  
  const {
    isBlocked,
    showModal,
    handleBlock,
    handleReport,
    openModal,
    closeModal,
  } = useBlockReport({
    targetUserId: otherUser.id,
    targetUserName: otherUser.name,
    onBlockSuccess: () => {
      // Navigate back after blocking
      navigation.goBack();
    },
    onReportSuccess: () => {
      // Optional: track analytics
      console.log('Report submitted');
    },
  });

  // Check block status on mount
  useEffect(() => {
    checkBlockStatus();
  }, []);

  // Show unblock banner if blocked
  if (isBlocked) {
    return (
      <View>
        <Text>This user is blocked.</Text>
        <Button title="Unblock" onPress={handleUnblock} />
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity onPress={openModal}>
        <Text>⋮</Text>
      </TouchableOpacity>

      <BlockReportModal
        visible={showModal}
        onClose={closeModal}
        userId={otherUser.id}
        userName={otherUser.name}
        onBlock={handleBlock}
        onReport={handleReport}
      />
    </View>
  );
};
*/
