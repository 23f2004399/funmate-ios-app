/**
 * CHAT SCREEN
 * 
 * Dual-state chat interface:
 * - Restricted (isMutual: false): Shadow message chips only
 * - Mutual (isMutual: true): Full text input with photo sharing
 * 
 * Features:
 * - Photo sharing via image picker (mutual only)
 * - Message reactions with long-press
 * - Seen status and relative timestamps
 * 
 * Entry points:
 * - "Send Message" button in Match Animation overlay
 * - Tapping existing conversation in My Hub
 * - Tapping user from Global Search (future)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  FlatList,
  Image,
  Platform,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  Modal,
  Pressable,
  Dimensions,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import firestore, { FirebaseFirestoreTypes } from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import auth from '@react-native-firebase/auth';
import { launchImageLibrary } from 'react-native-image-picker';
import { Chat, Message, User } from '../../types/database';
import { BlockReportModal } from '../../components/modals/BlockReportModal';
import { useBlockReport } from '../../hooks/useBlockReport';
import { ReportReason } from '../../types/database';
import { isBlockedBy, isUserBlocked } from '../../services/blockService';
import { useAlert } from '../../contexts/AlertContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Reaction emojis
const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '😡', '👍'];

// Extended emoji list for the "more" modal
const EXTENDED_EMOJIS = [
  '❤️', '😂', '😮', '😢', '😡', '👍',
  '🔥', '💯', '🙌', '👏', '🎉', '💪',
  '😍', '🥰', '😘', '😊', '🤗', '😎',
  '🤔', '😏', '🙄', '😴', '🤮', '💀',
  '👀', '🙏', '✨', '💕', '💔', '🤝',
];

// Shadow message chips for restricted chat
const SHADOW_CHIPS = [
  { id: '1', text: "Hey! Love your bio! 👋" },
  { id: '2', text: "Your photos are amazing! 📸" },
  { id: '3', text: "Wanna catch an event sometime? 🎉" },
  { id: '4', text: "We have so much in common! ✨" },
  { id: '5', text: "Would love to get to know you! 💬" },
  { id: '6', text: "Your vibe is awesome! 🔥" },
];

type ChatRouteParams = {
  Chat: {
    chatId: string | null; // null for new chats (global search)
    recipientId: string;
    recipientName?: string;
    recipientPhoto?: string;
  };
};

interface MessageWithId extends Message {
  id: string;
}

const ChatScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<RouteProp<ChatRouteParams, 'Chat'>>();
  const insets = useSafeAreaInsets();
  const { showSuccess, showError, showConfirm } = useAlert();
  const { chatId: initialChatId, recipientId, recipientName, recipientPhoto } = route.params;

  const userId = auth().currentUser?.uid;
  const flatListRef = useRef<FlatList>(null);

  // State
  const [chatId, setChatId] = useState<string | null>(initialChatId);
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<MessageWithId[]>([]);
  const [recipient, setRecipient] = useState<Partial<User> | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isMutual, setIsMutual] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [recipientLastRead, setRecipientLastRead] = useState<any>(null); // When recipient last read the chat
  const [hasBlockedRecipient, setHasBlockedRecipient] = useState(false); // If current user blocked the recipient
  
  // Reaction overlay state
  const [reactionMessageId, setReactionMessageId] = useState<string | null>(null);
  const [reactionPosition, setReactionPosition] = useState({ x: 0, y: 0, isOwnMessage: false });
  const [showExtendedEmojis, setShowExtendedEmojis] = useState(false);

  // Block & Report integration
  const {
    isBlocked,
    showModal: showBlockReportModal,
    handleBlock,
    handleUnblock,
    handleReport,
    openModal: openBlockReportModal,
    closeModal: closeBlockReportModal,
  } = useBlockReport({
    targetUserId: recipientId,
    targetUserName: recipient?.name || recipientName || 'User',
    onBlockSuccess: () => {
      navigation.goBack();
    },
    onUnblockSuccess: () => {
      setHasBlockedRecipient(false);
    },
  });

  // Track keyboard height for proper bottom positioning
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      // Add buffer only for phones with navbar (insets.bottom > 0)
      const navbarBuffer = insets.bottom > 0 ? 30 : 0;
      setKeyboardHeight(e.endCoordinates.height + navbarBuffer);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [insets.bottom]);

  /**
   * Fetch recipient profile
   */
  useEffect(() => {
    const fetchRecipient = async () => {
      if (!recipientId) return;

      try {
        const userDoc = await firestore().collection('users').doc(recipientId).get();
        if (userDoc.exists()) {
          setRecipient({ id: userDoc.id, ...userDoc.data() } as User);
        }
      } catch (error) {
        console.error('Error fetching recipient:', error);
      }
    };

    // Use passed props first, fetch if not available
    if (recipientName && recipientPhoto) {
      setRecipient({
        id: recipientId,
        name: recipientName,
        photos: [{ url: recipientPhoto, isPrimary: true }],
      } as Partial<User>);
    }
    
    fetchRecipient();
  }, [recipientId, recipientName, recipientPhoto]);

  /**
   * Fetch or create chat document
   */
  useEffect(() => {
    const initializeChat = async () => {
      if (!userId || !recipientId) {
        setLoading(false);
        return;
      }

      try {
        if (chatId) {
          // Existing chat - fetch it
          const chatDoc = await firestore().collection('chats').doc(chatId).get();
          if (chatDoc.exists()) {
            const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
            setChat(chatData);
            setIsMutual(chatData.isMutual);
          } else {
            // Chat was deleted - go back
            console.warn('Chat not found, may have been deleted');
            navigation.goBack();
            return;
          }
        } else {
          // No chatId - check if chat exists between these users
          const existingChat = await firestore()
            .collection('chats')
            .where('participants', 'array-contains', userId)
            .get();

          const foundChat = existingChat.docs.find((doc) => {
            const data = doc.data();
            // Only use chat if it includes both participants AND is not deleted
            return data.participants.includes(recipientId) && !data.deletedAt;
          });

          if (foundChat) {
            // Chat already exists and not deleted
            const chatData = { id: foundChat.id, ...foundChat.data() } as Chat;
            setChatId(foundChat.id);
            setChat(chatData);
            setIsMutual(chatData.isMutual);
          } else {
            // Chat doesn't exist or was deleted - check if there's an active match
            // Query all matches where current user is a participant, then filter
            let existingMatch = null;
            console.log('🔍 Checking for existing match between', userId, 'and', recipientId);
            
            try {
              // Get all matches where current user is userA
              const matchQueryA = await firestore()
                .collection('matches')
                .where('userA', '==', userId)
                .get();
              
              console.log('📊 Match query A (userA=me) results:', matchQueryA.docs.length);
              
              // Find if any of these matches is with the recipient
              for (const doc of matchQueryA.docs) {
                const matchData = doc.data();
                if (matchData.userB === recipientId && matchData.isActive !== false) {
                  existingMatch = { id: doc.id, ...matchData };
                  console.log('✅ Found active match (A):', doc.id);
                  break;
                }
              }
            } catch (e) {
              console.log('❌ Match query A failed:', e);
            }

            // If not found, check matches where current user is userB
            if (!existingMatch) {
              try {
                const matchQueryB = await firestore()
                  .collection('matches')
                  .where('userB', '==', userId)
                  .get();
                
                console.log('📊 Match query B (userB=me) results:', matchQueryB.docs.length);
                
                // Find if any of these matches is with the recipient
                for (const doc of matchQueryB.docs) {
                  const matchData = doc.data();
                  if (matchData.userA === recipientId && matchData.isActive !== false) {
                    existingMatch = { id: doc.id, ...matchData };
                    console.log('✅ Found active match (B):', doc.id);
                    break;
                  }
                }
              } catch (e) {
                console.log('❌ Match query B also failed:', e);
              }
            }

            const isMutualMatch = !!existingMatch;
            const matchId = existingMatch ? existingMatch.id : null;
            console.log('🎯 Final decision - isMutual:', isMutualMatch, 'matchId:', matchId);

            // Create new chat - respects match status
            const newChatRef = await firestore().collection('chats').add({
              type: 'dating',
              participants: [userId, recipientId],
              relatedMatchId: matchId,
              isMutual: isMutualMatch, // True if match exists!
              lastMessage: null,
              relatedEventId: null,
              deletionPolicy: {
                type: isMutualMatch ? 'on_unmatch' : 'none',
                days: null,
              },
              allowDeleteForEveryone: false,
              deleteForEveryoneWindowDays: null,
              deletedAt: null,
              deletedBy: null,
              permanentlyDeleteAt: null,
              createdAt: firestore.FieldValue.serverTimestamp(),
              lastMessageAt: firestore.FieldValue.serverTimestamp(),
            });

            setChatId(newChatRef.id);
            setChat({
              id: newChatRef.id,
              type: 'dating',
              participants: [userId, recipientId],
              relatedMatchId: matchId,
              isMutual: isMutualMatch,
              lastMessage: null,
              relatedEventId: null,
              deletionPolicy: { type: isMutualMatch ? 'on_unmatch' : 'none', days: null },
              allowDeleteForEveryone: false,
              deleteForEveryoneWindowDays: null,
              deletedAt: null,
              deletedBy: null,
              permanentlyDeleteAt: null,
              createdAt: new Date(),
              lastMessageAt: new Date(),
            });
            setIsMutual(isMutualMatch);
          }
        }
      } catch (error: any) {
        console.error('Error initializing chat:', error);
        // Permission denied means chat was deleted or user removed
        if (error.code === 'permission-denied') {
          navigation.goBack();
          return;
        }
      } finally {
        setLoading(false);
      }
    };

    initializeChat();
  }, [userId, recipientId, chatId, navigation]);

  /**
   * Check if current user has blocked the recipient
   */
  useEffect(() => {
    const checkIfBlocked = async () => {
      if (!userId || !recipientId) return;
      const blocked = await isUserBlocked(userId, recipientId);
      setHasBlockedRecipient(blocked);
    };
    checkIfBlocked();
  }, [userId, recipientId]);

  /**
   * Real-time messages listener
   */
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = firestore()
      .collection('messages')
      .where('chatId', '==', chatId)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .onSnapshot(
        (snapshot) => {
          const msgs: MessageWithId[] = [];
          snapshot.forEach((doc) => {
            const msgData = doc.data() as Message;
            // Filter out messages hidden from current user (sent while blocked)
            if (!msgData.hiddenForUsers?.includes(userId!)) {
              msgs.push({ id: doc.id, ...msgData } as MessageWithId);
            }
          });
          setMessages(msgs);
        },
        (error) => {
          console.error('Messages listener error:', error);
        }
      );

    return () => unsubscribe();
  }, [chatId]);

  /**
   * Real-time chat listener (for isMutual updates and seen status)
   */
  useEffect(() => {
    if (!chatId) return;

    const unsubscribe = firestore()
      .collection('chats')
      .doc(chatId)
      .onSnapshot(
        (doc) => {
          if (doc.exists()) {
            const chatData = { id: doc.id, ...doc.data() } as Chat;
            setChat(chatData);
            setIsMutual(chatData.isMutual);
            
            // Track when recipient last read the chat
            if (chatData.lastReadBy && recipientId) {
              setRecipientLastRead(chatData.lastReadBy[recipientId] || null);
            }
          } else {
            // Chat was deleted - navigate back
            console.warn('Chat document no longer exists');
            navigation.goBack();
          }
        },
        (error: any) => {
          console.error('Chat listener error:', error);
          // Permission denied usually means chat was deleted or user removed
          if (error.code === 'permission-denied') {
            navigation.goBack();
          }
        }
      );

    return () => unsubscribe();
  }, [chatId, recipientId]);

  /**
   * Mark chat as read when user views it
   */
  useEffect(() => {
    if (!chatId || !userId) return;

    // Update lastReadBy for current user
    const markAsRead = async () => {
      try {
        await firestore()
          .collection('chats')
          .doc(chatId)
          .update({
            [`lastReadBy.${userId}`]: firestore.FieldValue.serverTimestamp(),
          });
      } catch (error) {
        // Ignore errors - chat might not exist yet or user doesn't have permission
        console.log('Could not mark chat as read:', error);
      }
    };

    markAsRead();
  }, [chatId, userId, messages.length]); // Re-run when new messages arrive

  /**
   * Send a text message (mutual chat only)
   */
  const sendTextMessage = async () => {
    if (!inputText.trim() || !chatId || !userId || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);
    // Keep keyboard open - user can dismiss manually

    try {
      // Check if recipient has blocked sender (shadow blocking)
      const blockedByRecipient = await isBlockedBy(userId, recipientId);
      const hiddenForUsers = blockedByRecipient ? [recipientId] : [];

      // Create message document
      await firestore().collection('messages').add({
        chatId,
        senderId: userId,
        type: 'text',
        content: messageText,
        reactions: {},
        deletedForEveryone: false,
        deletedForEveryoneAt: null,
        deletedForEveryoneBy: null,
        deletedForUsers: [],
        hiddenForUsers, // Hide from recipient if they blocked sender
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update chat's lastMessage ONLY if message is not hidden
      if (!blockedByRecipient) {
        await firestore().collection('chats').doc(chatId).update({
          lastMessage: {
            text: messageText,
            senderId: userId,
            timestamp: firestore.FieldValue.serverTimestamp(),
          },
          lastMessageAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setInputText(messageText); // Restore input on error
    } finally {
      setSending(false);
    }
  };

  /**
   * Send a shadow chip message (restricted chat)
   */
  const sendShadowChip = async (chipText: string) => {
    if (!chatId || !userId || sending) return;

    setSending(true);

    try {
      // Check if recipient has blocked sender (shadow blocking)
      const blockedByRecipient = await isBlockedBy(userId, recipientId);
      const hiddenForUsers = blockedByRecipient ? [recipientId] : [];

      // Create shadow chip message
      await firestore().collection('messages').add({
        chatId,
        senderId: userId,
        type: 'shadow_chip',
        content: chipText,
        reactions: {},
        deletedForEveryone: false,
        deletedForEveryoneAt: null,
        deletedForEveryoneBy: null,
        deletedForUsers: [],
        hiddenForUsers, // Hide from recipient if they blocked sender
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update chat's lastMessage ONLY if message is not hidden
      if (!blockedByRecipient) {
        await firestore().collection('chats').doc(chatId).update({
          lastMessage: {
            text: chipText,
            senderId: userId,
            timestamp: firestore.FieldValue.serverTimestamp(),
          },
          lastMessageAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error sending shadow chip:', error);
    } finally {
      setSending(false);
    }
  };

  /**
   * Pick and send a photo (mutual chats only)
   */
  const handlePickPhoto = async () => {
    if (!chatId || !userId || uploadingPhoto) return;

    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        maxWidth: 1200,
        maxHeight: 1200,
      });

      if (result.didCancel || !result.assets?.[0]?.uri) return;

      const photo = result.assets[0];
      const photoUri = photo.uri!;
      setUploadingPhoto(true);

      // Upload to Firebase Storage
      const filename = `chat_images/${chatId}/${Date.now()}_${userId}.jpg`;
      const reference = storage().ref(filename);
      
      await reference.putFile(photoUri);
      const downloadUrl = await reference.getDownloadURL();

      // Check if recipient has blocked sender (shadow blocking)
      const blockedByRecipient = await isBlockedBy(userId, recipientId);
      const hiddenForUsers = blockedByRecipient ? [recipientId] : [];

      // Create image message
      await firestore().collection('messages').add({
        chatId,
        senderId: userId,
        type: 'image',
        content: downloadUrl,
        reactions: {},
        deletedForEveryone: false,
        deletedForEveryoneAt: null,
        deletedForEveryoneBy: null,
        deletedForUsers: [],
        hiddenForUsers, // Hide from recipient if they blocked sender
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // Update chat's lastMessage ONLY if message is not hidden
      if (!blockedByRecipient) {
        await firestore().collection('chats').doc(chatId).update({
          lastMessage: {
            text: '📷 Photo',
            senderId: userId,
            timestamp: firestore.FieldValue.serverTimestamp(),
          },
          lastMessageAt: firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (error) {
      console.error('Error sending photo:', error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  /**
   * Handle long press on a message to show reaction picker
   */
  const handleMessageLongPress = (messageId: string, event: any, isOwnMessage: boolean) => {
    const { pageY } = event.nativeEvent;
    setReactionPosition({ x: 0, y: pageY, isOwnMessage });
    setReactionMessageId(messageId);
    setShowExtendedEmojis(false);
  };

  /**
   * Add a reaction to a message
   */
  const handleAddReaction = async (emoji: string) => {
    if (!reactionMessageId || !userId) return;

    try {
      const messageRef = firestore().collection('messages').doc(reactionMessageId);
      const messageDoc = await messageRef.get();
      
      if (messageDoc.exists()) {
        const currentReactions = messageDoc.data()?.reactions || {};
        
        // Toggle reaction: if user already reacted with this emoji, remove it
        if (currentReactions[userId] === emoji) {
          await messageRef.update({
            [`reactions.${userId}`]: firestore.FieldValue.delete(),
          });
        } else {
          await messageRef.update({
            [`reactions.${userId}`]: emoji,
          });
        }
      }
    } catch (error) {
      console.error('Error adding reaction:', error);
    } finally {
      setReactionMessageId(null);
      setShowExtendedEmojis(false);
    }
  };

  /**
   * Format relative timestamp
   */
  const formatRelativeTime = (timestamp: any): string => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  /**
   * Navigate back
   */
  const handleBack = () => {
    navigation.goBack();
  };

  /**
   * Render a single message
   */
  const renderMessage = useCallback(
    ({ item, index }: { item: MessageWithId; index: number }) => {
      const isOwnMessage = item.senderId === userId;
      const isShadowChip = item.type === 'shadow_chip';
      const isImage = item.type === 'image';
      const reactions = item.reactions || {};
      const reactionEntries = Object.entries(reactions);
      const hasReactions = reactionEntries.length > 0;

      // Group reactions by emoji
      const reactionCounts: { [emoji: string]: number } = {};
      reactionEntries.forEach(([_, emoji]) => {
        reactionCounts[emoji as string] = (reactionCounts[emoji as string] || 0) + 1;
      });

      return (
        <Pressable
          onLongPress={(e) => handleMessageLongPress(item.id, e, isOwnMessage)}
          delayLongPress={300}
          style={[styles.messageContainer, isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer]}
        >
          <View style={styles.messageBubbleWrapper}>
            <View
              style={[
                styles.messageBubble,
                isOwnMessage ? styles.ownMessage : styles.otherMessage,
                isShadowChip && styles.shadowChipMessage,
                isImage && styles.imageMessage,
              ]}
            >
            {/* Image message */}
            {isImage ? (
              <Image
                source={{ uri: item.content }}
                style={styles.messageImage}
                resizeMode="cover"
              />
            ) : (
              /* Text/Shadow chip message */
              <Text
                style={[
                  styles.messageText,
                  isOwnMessage ? styles.ownMessageText : styles.otherMessageText,
                ]}
              >
                {item.content}
              </Text>
            )}

            {isShadowChip && (
              <View style={styles.shadowChipBadge}>
                <Text style={styles.shadowChipBadgeText}>Quick Message</Text>
              </View>
            )}

            {/* Timestamp */}
            <Text
              style={[
                styles.messageTimestamp,
                isOwnMessage ? styles.ownMessageTimestamp : styles.otherMessageTimestamp,
              ]}
            >
              {formatRelativeTime(item.createdAt)}
              {/* Seen status for own messages (only show for most recent) */}
              {isOwnMessage && index === 0 && (() => {
                // Check if recipient has read this message
                if (recipientLastRead && item.createdAt) {
                  const messageTime = item.createdAt.toDate ? item.createdAt.toDate() : new Date(item.createdAt);
                  const readTime = recipientLastRead.toDate ? recipientLastRead.toDate() : new Date(recipientLastRead);
                  if (readTime >= messageTime) {
                    return ' • Seen';
                  }
                }
                return ' • Sent';
              })()}
            </Text>
            </View>

            {/* Reactions display - positioned at bottom corner of bubble */}
            {hasReactions && (
              <View style={[
                styles.reactionsContainer,
                isOwnMessage ? styles.ownReactionsContainer : styles.otherReactionsContainer,
                isImage ? styles.imageReactionsPosition : styles.textReactionsPosition,
              ]}>
                {Object.entries(reactionCounts).map(([emoji, count]) => (
                  <View key={emoji} style={styles.reactionBubble}>
                    <Text style={styles.reactionEmoji}>{emoji}</Text>
                    {count > 1 && <Text style={styles.reactionCount}>{count}</Text>}
                  </View>
                ))}
              </View>
            )}
          </View>
        </Pressable>
      );
    },
    [userId, recipientLastRead]
  );

  /**
   * Render shadow chip
   */
  const renderShadowChip = ({ item }: { item: typeof SHADOW_CHIPS[0] }) => (
    <TouchableOpacity
      style={styles.shadowChip}
      onPress={() => sendShadowChip(item.text)}
      disabled={sending}
    >
      <Text style={styles.shadowChipText}>{item.text}</Text>
    </TouchableOpacity>
  );

  /**
   * Render reaction picker overlay
   */
  const renderReactionPicker = () => {
    if (!reactionMessageId) return null;

    // Calculate position - center horizontally, position above the message
    const pickerTop = Math.max(100, reactionPosition.y - 80);

    return (
      <Modal
        visible={true}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setReactionMessageId(null);
          setShowExtendedEmojis(false);
        }}
      >
        <TouchableWithoutFeedback 
          onPress={() => {
            setReactionMessageId(null);
            setShowExtendedEmojis(false);
          }}
        >
          <View style={styles.reactionOverlay}>
            {/* Quick reaction picker - centered above message */}
            {!showExtendedEmojis && (
              <TouchableWithoutFeedback onPress={() => {}}>
                <View
                  style={[
                    styles.reactionPicker,
                    { top: pickerTop },
                  ]}
                >
                  {REACTION_EMOJIS.map((emoji) => (
                    <TouchableOpacity
                      key={emoji}
                      style={styles.reactionOption}
                      onPress={() => handleAddReaction(emoji)}
                    >
                      <Text style={styles.reactionOptionEmoji}>{emoji}</Text>
                    </TouchableOpacity>
                  ))}
                  {/* Plus button for more emojis */}
                  <TouchableOpacity
                    style={styles.reactionOptionMore}
                    onPress={() => setShowExtendedEmojis(true)}
                  >
                    <Ionicons name="add" size={24} color="rgba(255,255,255,0.82)" />
                  </TouchableOpacity>
                </View>
              </TouchableWithoutFeedback>
            )}

            {/* Extended emoji picker modal */}
            {showExtendedEmojis && (
              <TouchableWithoutFeedback onPress={() => {}}>
                <View style={styles.extendedEmojiPicker}>
                  <View style={styles.extendedEmojiHeader}>
                    <Text style={styles.extendedEmojiTitle}>Choose Reaction</Text>
                    <TouchableOpacity 
                      onPress={() => setShowExtendedEmojis(false)}
                      style={styles.extendedEmojiClose}
                    >
                      <Ionicons name="close" size={24} color="rgba(255,255,255,0.82)" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.extendedEmojiGrid}>
                    {EXTENDED_EMOJIS.map((emoji) => (
                      <TouchableOpacity
                        key={emoji}
                        style={styles.extendedEmojiOption}
                        onPress={() => handleAddReaction(emoji)}
                      >
                        <Text style={styles.extendedEmojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </TouchableWithoutFeedback>
            )}
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  // Get recipient display info
  const displayName = recipient?.name || recipientName || 'User';
  const displayPhoto =
    recipient?.photos?.find((p) => p.isPrimary)?.url ||
    recipient?.photos?.[0]?.url ||
    recipientPhoto ||
    'https://via.placeholder.com/100';

  // Loading state
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
            <Text style={styles.loadingText}>Loading chat...</Text>
          </View>
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
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.headerProfile}>
            <Image source={{ uri: displayPhoto }} style={styles.headerAvatar} />
            <View style={styles.headerInfo}>
              <Text style={styles.headerName} numberOfLines={1}>
                {displayName}
              </Text>
              {!isMutual && (
                <Text style={styles.restrictedBadge}>Restricted Chat</Text>
              )}
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerAction}
            onPress={openBlockReportModal}
          >
            <Ionicons name="ellipsis-vertical" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Restricted Chat Notice */}
        {!isMutual && !hasBlockedRecipient && (
          <View style={styles.restrictedNotice}>
            <Ionicons name="lock-closed" size={16} color="#A855F7" />
            <Text style={styles.restrictedNoticeText}>
              This is a restricted chat. Send a quick message to break the ice!
            </Text>
          </View>
        )}

        {/* Blocked User Notice */}
        {hasBlockedRecipient && (
          <View style={styles.blockedNotice}>
            <Ionicons name="ban" size={16} color="#FF4D6D" />
            <Text style={styles.blockedNoticeText}>
              You've blocked this user. Unblock to send messages.
            </Text>
            <TouchableOpacity
              onPress={() => {
                showConfirm(
                  'Unblock User',
                  `Are you sure you want to unblock ${recipient?.name || recipientName || 'this user'}?`,
                  async () => {
                    try {
                      await handleUnblock();
                      showSuccess('Unblocked', `${recipient?.name || recipientName || 'User'} has been unblocked.`);
                    } catch (error) {
                      showError('Error', 'Failed to unblock user. Please try again.');
                    }
                  },
                  { confirmText: 'Unblock', icon: 'person-remove' }
                );
              }}
              style={styles.unblockButton}
            >
              <Text style={styles.unblockButtonText}>Unblock</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Messages List */}
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          inverted
          style={styles.messageListContainer}
          contentContainerStyle={styles.messagesList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.emptyMessages}>
              <Ionicons name="chatbubbles-outline" size={60} color="rgba(255,255,255,0.55)" />
              <Text style={styles.emptyMessagesText}>
                {isMutual
                  ? 'Start the conversation!'
                  : 'Send a quick message to connect!'}
              </Text>
            </View>
          }
        />

        {/* Input Area */}
        {!hasBlockedRecipient && isMutual ? (
          <View
            style={[
              styles.inputContainer,
              {
                marginBottom: keyboardHeight,
                paddingBottom: keyboardHeight > 0 ? 12 : Math.max(12, insets.bottom + 8),
              },
            ]}
          >
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePickPhoto}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? (
                <ActivityIndicator size="small" color="#8B2BE2" />
              ) : (
                <Ionicons name="image-outline" size={22} color="#8B2BE2" />
              )}
            </TouchableOpacity>

            <TextInput
              style={styles.textInput}
              placeholder="Type a message..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={1000}
            />

            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputText.trim() || sending) && styles.sendButtonDisabled,
              ]}
              onPress={sendTextMessage}
              disabled={!inputText.trim() || sending}
            >
              <LinearGradient
                colors={
                  !inputText.trim() || sending
                    ? ['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.12)']
                    : ['#8B2BE2', '#06B6D4']
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.sendButtonGradient}
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : !hasBlockedRecipient && !isMutual ? (
          <View
            style={[
              styles.shadowChipsContainer,
              {
                marginBottom: keyboardHeight,
                paddingBottom: keyboardHeight > 0 ? 16 : Math.max(16, insets.bottom + 10),
              },
            ]}
          >
            <Text style={styles.shadowChipsLabel}>Quick Messages</Text>
            <FlatList
              data={SHADOW_CHIPS}
              renderItem={renderShadowChip}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.shadowChipsList}
            />
          </View>
        ) : null}

        {/* Reaction Picker Modal */}
        {renderReactionPicker()}

        {/* Block & Report Modal */}
        <BlockReportModal
          visible={showBlockReportModal}
          onClose={closeBlockReportModal}
          userId={recipientId}
          userName={recipient?.name || displayName}
          isBlocked={isBlocked}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onReport={handleReport}
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
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: 'rgba(26, 21, 48, 0.88)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.20)',
  },
  backButton: {
    padding: 4,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#16112B',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  headerInfo: {
    marginLeft: 12,
    flex: 1,
  },
  headerName: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  restrictedBadge: {
    fontSize: 12,
    color: '#22D3EE',
    fontFamily: 'Inter-Medium',
  },
  headerAction: {
    padding: 8,
  },
  restrictedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 21, 48, 0.88)',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  restrictedNoticeText: {
    flex: 1,
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    fontFamily: 'Inter-Regular',
  },
  blockedNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(26, 21, 48, 0.92)',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 77, 109, 0.35)',
  },
  blockedNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#FF4D6D',
    fontFamily: 'Inter-Medium',
  },
  unblockButton: {
    backgroundColor: '#FF4D6D',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  unblockButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  messageListContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexGrow: 1,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyMessagesText: {
    marginTop: 16,
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },
  messageBubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  ownMessage: {
    backgroundColor: '#8B2BE2',
    borderBottomRightRadius: 4,
  },
  otherMessage: {
    backgroundColor: '#1A1530',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  shadowChipMessage: {
    borderWidth: 1.5,
    borderColor: '#8B2BE2',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  messageContainer: {
    marginVertical: 2,
    marginBottom: 20, // Extra space for reactions below bubble
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubbleWrapper: {
    position: 'relative',
    maxWidth: '80%',
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'Inter-Regular',
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  otherMessageText: {
    color: '#FFFFFF',
  },
  imageMessage: {
    padding: 4,
    backgroundColor: 'transparent',
  },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 16,
  },
  messageTimestamp: {
    fontSize: 10,
    marginTop: 6,
    fontFamily: 'Inter-Regular',
  },
  ownMessageTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  otherMessageTimestamp: {
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'left',
  },
  reactionsContainer: {
    position: 'absolute',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
  },
  ownReactionsContainer: {
    right: 8,
  },
  otherReactionsContainer: {
    left: 8,
  },
  textReactionsPosition: {
    bottom: -18,
  },
  imageReactionsPosition: {
    bottom: -4,
  },
  reactionBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1530',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  reactionEmoji: {
    fontSize: 14,
  },
  reactionCount: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.82)',
    marginLeft: 2,
    fontFamily: 'Inter-Medium',
  },
  shadowChipBadge: {
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  shadowChipBadgeText: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 12,
    backgroundColor: 'rgba(26, 21, 48, 0.94)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.20)',
    gap: 8,
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#16112B',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    minHeight: 54,
    maxHeight: 120,
    backgroundColor: '#16112B',
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 16,
    color: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    fontFamily: 'Inter-Regular',
  },
  sendButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.75,
  },
  sendButtonGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Reaction picker styles
  reactionOverlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.70)',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  reactionPicker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1530',
    borderRadius: 28,
    paddingHorizontal: 8,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  reactionOption: {
    padding: 8,
  },
  reactionOptionEmoji: {
    fontSize: 26,
  },
  reactionOptionMore: {
    padding: 8,
    marginLeft: 4,
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(139, 92, 246, 0.20)',
  },
  // Extended emoji picker styles
  extendedEmojiPicker: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    backgroundColor: '#1A1530',
    borderRadius: 20,
    padding: 16,
    width: SCREEN_WIDTH - 40,
    maxWidth: 360,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  extendedEmojiHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  extendedEmojiTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  extendedEmojiClose: {
    padding: 4,
  },
  extendedEmojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  extendedEmojiOption: {
    width: '16.66%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  extendedEmojiText: {
    fontSize: 28,
  },
  shadowChipsContainer: {
    backgroundColor: 'rgba(26, 21, 48, 0.94)',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(139, 92, 246, 0.20)',
  },
  shadowChipsLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    marginLeft: 16,
    marginBottom: 10,
    textTransform: 'uppercase',
    fontFamily: 'Inter-SemiBold',
  },
  shadowChipsList: {
    paddingHorizontal: 12,
    gap: 8,
  },
  shadowChip: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  shadowChipText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontFamily: 'Inter-Medium',
  },
});

export default ChatScreen;
