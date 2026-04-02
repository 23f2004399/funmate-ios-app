/**
 * MY HUB SCREEN
 * 
 * Central hub for all communication:
 * - Dual-purpose search bar (local + global Algolia)
 * - Who Liked You (horizontal list - Top 20)
 * - Conversations list (ordered by lastMessageAt)
 */

import React, { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  ImageBackground,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLikers } from '../../hooks/useLikers';
import { Liker, Chat, User } from '../../types/database';
import { searchUsers, isAlgoliaConfigured, AlgoliaUserRecord } from '../../config/algolia';
import { isUserBlocked } from '../../services/blockService';
import { deleteChat } from '../../services/chatService';
import WhoLikedYouFilterModal from '../../components/WhoLikedYouFilterModal';
import { WhoLikedYouFilters, DEFAULT_FILTERS } from '../../types/filters';
import { useAlert } from '../../contexts/AlertContext';

const { width } = Dimensions.get('window');
const LIKER_CARD_SIZE = 120;

// Conversation item with user details
interface ConversationItem {
  chatId: string;
  recipientId: string;
  recipientName: string;
  recipientPhoto: string | null;
  lastMessage: string;
  lastMessageAt: any;
  isMutual: boolean;
  unreadCount: number;
}

// Algolia search result (compatible with both Algolia and Firestore fallback)
interface AlgoliaUser {
  objectID: string;
  name: string;
  age: number;
  bio: string;
  photos: Array<{ url: string; isPrimary: boolean }>;
  isVerified: boolean;
}

const MyHubScreen = ({ navigation }: any) => {
  const userId = auth().currentUser?.uid;
  const insets = useSafeAreaInsets();
  const { showConfirm, showError } = useAlert();
  
  // Tab navigation state
  const [activeTab, setActiveTab] = useState<'conversations' | 'likes'>('conversations');
  
  // Filter state
  const [filters, setFilters] = useState<WhoLikedYouFilters>(DEFAULT_FILTERS);
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  const {
    likers,
    loading,
    error,
    totalCount,
    refetch,
    hasMore,
    refillQueue,
    availableOccupations,
  } = useLikers(filters);

  // State for conversations
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [globalSearchResults, setGlobalSearchResults] = useState<AlgoliaUser[]>([]);
  const [globalSearchLoading, setGlobalSearchLoading] = useState(false);
  const [showGlobalResults, setShowGlobalResults] = useState(false);

  // Delete state
  const [selectedChatForDelete, setSelectedChatForDelete] = useState<string | null>(null);

  // Refresh trigger for when returning from blocking
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const isInitialMount = useRef(true);

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
   * Refresh conversations when screen comes into focus (after blocking)
   */
  useFocusEffect(
    useCallback(() => {
      if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
      }
      // Trigger refresh by incrementing counter
      setRefreshTrigger(prev => prev + 1);
    }, [])
  );

  /**
   * Fetch conversations from Firestore
   */
  useEffect(() => {
    if (!userId) return;

    const unsubscribe = firestore()
      .collection('chats')
      .where('participants', 'array-contains', userId)
      .orderBy('lastMessageAt', 'desc')
      .onSnapshot(
        async (snapshot) => {
          const convos: ConversationItem[] = [];

          for (const doc of snapshot.docs) {
            const chatData = doc.data() as Chat;
            
            // Skip deleted chats
            if (chatData.deletedAt) continue;
            
            // Get the other participant's ID
            const recipientId = chatData.participants.find(p => p !== userId);
            if (!recipientId) continue;

            // Skip chats where current user has blocked the recipient
            const hasBlockedRecipient = await isUserBlocked(userId, recipientId);
            if (hasBlockedRecipient) continue;

            // Fetch recipient user data
            try {
              const userDoc = await firestore()
                .collection('users')
                .doc(recipientId)
                .get();
              
              if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                const primaryPhoto = userData.photos?.find(p => p.isPrimary) || userData.photos?.[0];

                convos.push({
                  chatId: doc.id,
                  recipientId,
                  recipientName: userData.name || 'Unknown',
                  recipientPhoto: primaryPhoto?.url || null,
                  lastMessage: chatData.lastMessage?.text || 'Start a conversation',
                  lastMessageAt: chatData.lastMessageAt,
                  isMutual: chatData.isMutual,
                  unreadCount: 0, // TODO: Implement unread count
                });
              }
            } catch (err) {
              console.error('Error fetching recipient:', err);
            }
          }

          setConversations(convos);
          setConversationsLoading(false);
        },
        (err) => {
          console.error('Error fetching conversations:', err);
          setConversationsLoading(false);
        }
      );

    return () => unsubscribe();
  }, [userId, refreshTrigger]);

  /**
   * Filter conversations locally based on search query
   */
  const filteredConversations = useMemo(() => {
    if (!searchQuery.trim() || activeTab !== 'conversations') return conversations;
    
    const query = searchQuery.toLowerCase();
    return conversations.filter(conv => 
      conv.recipientName.toLowerCase().includes(query)
    );
  }, [conversations, searchQuery, activeTab]);

  /**
   * Filter likers locally based on search query (only in Who Liked You tab)
   */
  const filteredLikers = useMemo(() => {
    if (!searchQuery.trim() || activeTab !== 'likes') return likers;
    
    const query = searchQuery.toLowerCase();
    return likers.filter(liker => 
      liker.name.toLowerCase().includes(query)
    );
  }, [likers, searchQuery, activeTab]);

  /**
   * Check if we should show "Search Globally" button
   */
  const showSearchGloballyButton = useMemo(() => {
    return searchQuery.trim().length >= 2 && filteredConversations.length === 0;
  }, [searchQuery, filteredConversations]);

  /**
   * Perform global Algolia search (with Firestore fallback)
   */
  const handleGlobalSearch = useCallback(async () => {
    if (!searchQuery.trim()) return;

    setGlobalSearchLoading(true);
    setShowGlobalResults(true);

    try {
      let algoliaSuccess = false;

      // Try Algolia first if configured
      if (isAlgoliaConfigured()) {
        try {
          const algoliaResults = await searchUsers(searchQuery, {
            hitsPerPage: 30, // Fetch more to account for filtering
            filters: `NOT objectID:${userId}`, // Exclude self
          });

          if (algoliaResults && algoliaResults.length >= 0) {
            // Filter out event creators (users with creatorDetails populated)
            const datingUsers = (algoliaResults as any[]).filter(user => {
              // Exclude if creatorDetails exists and has organizationName
              const isEventCreator = user.creatorDetails?.organizationName || 
                                     user.creatorDetails?.experienceYears != null;
              return !isEventCreator;
            });
            setGlobalSearchResults(datingUsers as AlgoliaUser[]);
            algoliaSuccess = true;
          }
        } catch (algoliaError) {
          console.warn('Algolia search failed, falling back to Firestore:', algoliaError);
        }
      }

      // Fallback to Firestore search if Algolia failed or not configured
      if (!algoliaSuccess) {
        const usersSnapshot = await firestore()
          .collection('users')
          .orderBy('name')
          .startAt(searchQuery)
          .endAt(searchQuery + '\uf8ff')
          .limit(30)
          .get();

        const results: AlgoliaUser[] = usersSnapshot.docs
          .filter(doc => {
            if (doc.id === userId) return false; // Exclude self
            const data = doc.data() as User;
            // Exclude event creators
            const isEventCreator = (data as any).creatorDetails?.organizationName || 
                                   (data as any).creatorDetails?.experienceYears != null;
            return !isEventCreator;
          })
          .map(doc => {
            const data = doc.data() as User;
            return {
              objectID: doc.id,
              name: data.name || 'Unknown',
              age: data.age || 0,
              bio: data.bio || '',
              photos: data.photos || [],
              isVerified: data.isVerified || false,
            };
          });

        setGlobalSearchResults(results);
      }
    } catch (err) {
      console.error('Global search error:', err);
      setGlobalSearchResults([]);
    } finally {
      setGlobalSearchLoading(false);
    }
  }, [searchQuery, userId]);

  /**
   * Handle tapping a global search result
   */
  const handleGlobalResultPress = useCallback(async (user: AlgoliaUser) => {
    if (!userId) return;

    // Check if chat already exists
    const existingChat = conversations.find(c => c.recipientId === user.objectID);
    
    if (existingChat) {
      // Navigate to existing chat
      navigation.navigate('Chat', {
        chatId: existingChat.chatId,
        recipientId: user.objectID,
        recipientName: user.name,
        recipientPhoto: user.photos?.find(p => p.isPrimary)?.url || user.photos?.[0]?.url,
      });
    } else {
      // Navigate to new chat (shadow message state)
      navigation.navigate('Chat', {
        chatId: null, // Will create new chat
        recipientId: user.objectID,
        recipientName: user.name,
        recipientPhoto: user.photos?.find(p => p.isPrimary)?.url || user.photos?.[0]?.url,
      });
    }

    // Reset search
    setSearchQuery('');
    setShowGlobalResults(false);
    setGlobalSearchResults([]);
  }, [userId, conversations, navigation]);

  /**
   * Handle tapping a conversation
   */
  const handleConversationPress = useCallback((conv: ConversationItem) => {
    navigation.navigate('Chat', {
      chatId: conv.chatId,
      recipientId: conv.recipientId,
      recipientName: conv.recipientName,
      recipientPhoto: conv.recipientPhoto,
    });
  }, [navigation]);

  /**
   * Handle long-press on conversation (show delete bubble)
   */
  const handleConversationLongPress = useCallback((conv: ConversationItem, event: any) => {
    setSelectedChatForDelete(conv.chatId);
    // Position will be set by the item component
  }, []);

  /**
   * Handle delete chat action with confirmation
   */
  const handleDeleteChat = useCallback(async (chatId: string, recipientName: string) => {
    showConfirm(
      'Delete Chat',
      'Are you sure you want to delete?',
      async () => {
        try {
          if (!userId) return;
          await deleteChat(chatId, userId);
          setSelectedChatForDelete(null);
        } catch (error) {
          showError('Error', 'Failed to delete chat. Please try again.');
        }
      },
      { confirmText: 'Delete', destructive: true, icon: 'trash' }
    );
  }, [userId, showConfirm, showError]);

  /**
   * Deselect chat (tap elsewhere)
   */
  const handleDeselectChat = useCallback(() => {
    setSelectedChatForDelete(null);
  }, []);


  /**
   * Handle tap on a liker card - opens the sub-swiper
   */
  const handleLikerPress = useCallback((liker: Liker, index: number) => {
    navigation.navigate('LikesSwiper', {
      clickedUserId: liker.id,
    });
  }, [navigation]);

  /**
   * Load more likers when reaching end of list
   */
  const handleEndReached = useCallback(() => {
    if (hasMore && !loading) {
      refillQueue();
    }
  }, [hasMore, loading, refillQueue]);

  /**
   * Render a single liker card
   */
  const renderLikerCard = useCallback(({ item, index }: { item: Liker; index: number }) => {
    const primaryPhoto = item.photos.find(p => p.isPrimary) || item.photos[0];
    const matchPercentage = Math.round(item.matchScore);

    return (
      <TouchableOpacity
        style={styles.likerCard}
        onPress={() => handleLikerPress(item, index)}
        activeOpacity={0.9}
      >
        {/* Photo */}
        {primaryPhoto?.url ? (
          <Image
            source={{ uri: primaryPhoto.url }}
            style={styles.likerPhoto}
          />
        ) : (
          <View style={[styles.likerPhoto, styles.noPhotoPlaceholder]}>
            <Ionicons name="person" size={40} color="rgba(255,255,255,0.55)" />
          </View>
        )}

        {/* Gradient overlay */}
        <View style={styles.likerGradient} />

        {/* Match percentage badge */}
        <View style={styles.matchBadge}>
          <Text style={styles.matchBadgeText}>{matchPercentage}%</Text>
        </View>

        {/* Name at bottom */}
        <View style={styles.likerInfo}>
          <Text style={styles.likerName} numberOfLines={1}>
            {item.name}, {item.age}
          </Text>
        </View>
      </TouchableOpacity>
    );
  }, [handleLikerPress]);

  /**
   * Empty state for likers section - Compact design
   */
  const renderEmptyLikers = useCallback(() => (
    <View style={styles.emptyLikersContainer}>
      <Ionicons name="heart-outline" size={24} color="#CCCCCC" />
      <Text style={styles.emptyLikersText}>No likes yet</Text>
    </View>
  ), []);

  /**
   * Format relative time for conversations
   */
  const formatConversationTime = useCallback((timestamp: any) => {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }, []);

  /**
   * Render a conversation item
   */
  const renderConversationItem = useCallback((conv: ConversationItem, index: number) => {
    const handleLongPress = () => {
      setSelectedChatForDelete(conv.chatId);
    };

    return (
      <View key={conv.chatId} collapsable={false}>
        <TouchableOpacity
          style={styles.conversationItem}
          onPress={() => handleConversationPress(conv)}
          onLongPress={handleLongPress}
          delayLongPress={500}
          activeOpacity={0.7}
        >
          {/* Profile Photo */}
          {conv.recipientPhoto ? (
            <Image
              source={{ uri: conv.recipientPhoto }}
              style={styles.conversationPhoto}
            />
          ) : (
            <View style={[styles.conversationPhoto, styles.conversationPhotoPlaceholder]}>
              <Ionicons name="person" size={28} color="#CCCCCC" />
            </View>
          )}

          {/* Content */}
          <View style={styles.conversationContent}>
            <View style={styles.conversationHeader}>
              <Text style={styles.conversationName} numberOfLines={1}>
                {conv.recipientName}
              </Text>
              <Text style={styles.conversationTime}>
                {formatConversationTime(conv.lastMessageAt)}
              </Text>
            </View>
            <View style={styles.conversationPreviewRow}>
              <Text 
                style={[
                  styles.conversationPreview,
                  !conv.isMutual && styles.conversationPreviewMuted
                ]} 
                numberOfLines={1}
              >
                {conv.lastMessage}
              </Text>
              {!conv.isMutual && (
                <View style={styles.pendingBadge}>
                  <Ionicons name="time-outline" size={12} color="#FF9800" />
                </View>
              )}
            </View>
          </View>

          {/* Chevron */}
          <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />
        </TouchableOpacity>
      </View>
    );
  }, [handleConversationPress, formatConversationTime, selectedChatForDelete]);

  /**
   * Render global search result item
   */
  const renderGlobalSearchResult = useCallback((user: AlgoliaUser) => {
    const primaryPhoto = user.photos?.find(p => p.isPrimary) || user.photos?.[0];
    
    return (
      <TouchableOpacity
        key={user.objectID}
        style={styles.searchResultItem}
        onPress={() => handleGlobalResultPress(user)}
        activeOpacity={0.7}
      >
        {/* Photo */}
        {primaryPhoto?.url ? (
          <Image
            source={{ uri: primaryPhoto.url }}
            style={styles.searchResultPhoto}
          />
        ) : (
          <View style={[styles.searchResultPhoto, styles.searchResultPhotoPlaceholder]}>
            <Ionicons name="person" size={24} color="#CCCCCC" />
          </View>
        )}

        {/* Info */}
        <View style={styles.searchResultInfo}>
          <View style={styles.searchResultNameRow}>
            <Text style={styles.searchResultName}>{user.name}, {user.age}</Text>
            {user.isVerified && (
              <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
            )}
          </View>
          <Text style={styles.searchResultBio} numberOfLines={1}>
            {user.bio || 'No bio available'}
          </Text>
        </View>

        {/* Message Icon */}
        <View style={styles.searchResultAction}>
          <Ionicons name="chatbubble" size={18} color="#FF4458" />
        </View>
      </TouchableOpacity>
    );
  }, [handleGlobalResultPress]);

  /**
   * Empty state for conversations - Premium design
   */
  const renderEmptyConversations = useCallback(() => (
    <View style={styles.emptyConversationsContainer}>
      <Ionicons name="chatbubbles-outline" size={48} color="#E0E0E0" />
      <Text style={styles.emptyConversationsTitle}>No conversations yet</Text>
      <Text style={styles.emptyConversationsSubtext}>
        When you match with someone, your{'\n'}conversations will appear here
      </Text>
      <TouchableOpacity
        onPress={() => navigation.navigate('SwipeHub')}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={['#8B2BE2', '#06B6D4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.emptyConversationsButton}
        >
          <Ionicons name="flame" size={18} color="#FFFFFF" />
          <Text style={styles.emptyConversationsButtonText}>Start Swiping</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  ), [navigation]);

  /**
   * Loading state
   */
  if (loading && likers.length === 0) {
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
            <Text style={styles.loadingText}>Loading My Hub...</Text>
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
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Ionicons name="chatbubbles" size={28} color="#8B2BE2" />
        <Text style={styles.title}>My Hub</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNav}>
        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'conversations' && styles.tabButtonActive
          ]}
          onPress={() => {
            setActiveTab('conversations');
            setShowGlobalResults(false);
            setGlobalSearchResults([]);
          }}
        >
          <Ionicons 
            name={activeTab === 'conversations' ? "chatbubbles" : "chatbubbles-outline"} 
            size={22} 
            color={activeTab === 'conversations' ? "#8B2BE2" : "rgba(255,255,255,0.55)"}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'conversations' && styles.tabTextActive
          ]}>
            Conversations
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.tabButton,
            activeTab === 'likes' && styles.tabButtonActive
          ]}
          onPress={() => {
            setActiveTab('likes');
            setShowGlobalResults(false);
            setGlobalSearchResults([]);
            setSearchQuery('');
          }}
        >
          <Ionicons 
            name={activeTab === 'likes' ? "heart" : "heart-outline"} 
            size={22} 
            color={activeTab === 'likes' ? "#8B2BE2" : "rgba(255,255,255,0.55)"}
          />
          <Text style={[
            styles.tabText,
            activeTab === 'likes' && styles.tabTextActive
          ]}>
            Who Liked You
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={[
          styles.searchInputContainer,
          searchFocused && styles.searchInputContainerFocused
        ]}>
          <Ionicons name="search" size={20} color="rgba(255,255,255,0.55)" />
          <TextInput
            style={styles.searchInput}
            placeholder={activeTab === 'conversations' ? "Search conversations or people..." : "Search who liked you..."}
            placeholderTextColor="rgba(255,255,255,0.35)"
            value={searchQuery}
            onChangeText={(text) => {
              setSearchQuery(text);
              setShowGlobalResults(false);
            }}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            returnKeyType="search"
            onSubmitEditing={handleGlobalSearch}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setSearchQuery('');
                setShowGlobalResults(false);
                setGlobalSearchResults([]);
              }}
            >
              <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.55)" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Global Search Results */}
      {showGlobalResults && (
        <View style={styles.globalSearchResults}>
          <View style={styles.globalSearchHeader}>
            <Text style={styles.globalSearchTitle}>
              <Ionicons name="globe-outline" size={16} color="#A855F7" /> Global Search
            </Text>
            <TouchableOpacity onPress={() => setShowGlobalResults(false)}>
              <Text style={styles.globalSearchClose}>Close</Text>
            </TouchableOpacity>
          </View>
          
          {globalSearchLoading ? (
            <View style={styles.globalSearchLoading}>
              <ActivityIndicator size="small" color="#8B2BE2" />
              <Text style={styles.globalSearchLoadingText}>Searching...</Text>
            </View>
          ) : globalSearchResults.length > 0 ? (
            <ScrollView style={styles.globalSearchList}>
              {globalSearchResults.map(renderGlobalSearchResult)}
            </ScrollView>
          ) : (
            <View style={styles.globalSearchEmpty}>
              <Ionicons name="search-outline" size={40} color="#E0E0E0" />
              <Text style={styles.globalSearchEmptyText}>No users found</Text>
            </View>
          )}
        </View>
      )}

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(24, insets.bottom + 12) }]}
        refreshControl={
          <RefreshControl
            refreshing={loading && likers.length > 0}
            onRefresh={refetch}
            colors={['#8B2BE2']}
            tintColor="#8B2BE2"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Search Globally Button (when no local results) */}
        {showSearchGloballyButton && !showGlobalResults && activeTab === 'conversations' && (
          <TouchableOpacity
              onPress={handleGlobalSearch}
              activeOpacity={0.85}
            >
            <LinearGradient
              colors={['#8B2BE2', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.searchGloballyButton}
            >
              <Ionicons name="globe-outline" size={20} color="#FFFFFF" />
              <Text style={styles.searchGloballyText}>Search Globally for "{searchQuery}"</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* CONVERSATIONS TAB CONTENT */}
        {activeTab === 'conversations' && (
          <View style={styles.section}>
            {/* Conversations List */}
            <TouchableOpacity 
              style={styles.conversationsList}
              activeOpacity={1}
              onPress={handleDeselectChat}
            >
              {conversationsLoading ? (
                <View style={styles.conversationsLoading}>
                  <ActivityIndicator size="small" color="#8B2BE2" />
                </View>
              ) : filteredConversations.length > 0 ? (
                <>
                  {filteredConversations.map((conv, index) => renderConversationItem(conv, index))}
                </>
              ) : searchQuery ? (
                <View style={styles.noSearchResults}>
                  <Ionicons name="search-outline" size={40} color="rgba(255,255,255,0.55)" />
                  <Text style={styles.noSearchResultsText}>
                    No conversations match "{searchQuery}"
                  </Text>
                </View>
              ) : (
                renderEmptyConversations()
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* WHO LIKED YOU TAB CONTENT */}
        {activeTab === 'likes' && (
          <View style={styles.section}>
            {/* Filter Button - Only in Who Liked You */}
            <View style={styles.likesHeader}>
              <View style={styles.sectionTitleRow}>
                <Ionicons name="heart" size={22} color="#8B2BE2" />
                <Text style={styles.sectionTitle}>Who Liked You</Text>
                {totalCount > 0 && (
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {totalCount > 99 ? '99+' : totalCount}
                    </Text>
                  </View>
                )}
              </View>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowFilterModal(true)}
              >
                <Ionicons name="options-outline" size={20} color="#8B2BE2" />
                {activeFilterCount > 0 && (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Vertical Grid - 2 Cards Per Row */}
            {filteredLikers.length > 0 ? (
              <View style={styles.likersGrid}>
                {filteredLikers.map((liker, index) => (
                  <TouchableOpacity
                    key={liker.swipeId}
                    style={styles.likerGridCard}
                    onPress={() => handleLikerPress(liker, index)}
                    activeOpacity={0.8}
                  >
                    {liker.photos && liker.photos.length > 0 ? (
                      <Image 
                        source={{ uri: liker.photos[0].url }} 
                        style={styles.likerGridPhoto}
                      />
                    ) : (
                      <View style={[styles.likerGridPhoto, styles.noPhotoPlaceholder]}>
                        <Ionicons name="person" size={40} color="rgba(255,255,255,0.55)" />
                      </View>
                    )}
                    
                    {/* Match Badge */}
                    {liker.matchScore && (
                      <View style={styles.gridMatchBadge}>
                        <Text style={styles.matchBadgeText}>{Math.round(liker.matchScore)}%</Text>
                      </View>
                    )}
                    
                    {/* Name and Age */}
                    <View style={styles.likerGridInfo}>
                      <Text style={styles.likerGridName} numberOfLines={1}>
                        {liker.name}, {liker.age}
                      </Text>
                      {liker.isVerified && (
                        <Ionicons name="checkmark-circle" size={16} color="#22D3EE" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : searchQuery ? (
              <View style={styles.noSearchResults}>
                <Ionicons name="search-outline" size={40} color="rgba(255,255,255,0.55)" />
                <Text style={styles.noSearchResultsText}>
                  No one matches "{searchQuery}"
                </Text>
              </View>
            ) : (
              renderEmptyLikers()
            )}
          </View>
        )}
      </ScrollView>

      {/* Delete Bubble Popup */}
      {selectedChatForDelete && (
        <>
          {/* Transparent overlay to detect outside clicks */}
          <TouchableOpacity
            style={styles.bubbleBackdrop}
            activeOpacity={1}
            onPress={handleDeselectChat}
          />
          
          {/* Floating delete bubble - centered on screen */}
          <View style={styles.deleteBubble}>
            <TouchableOpacity
              style={styles.deleteBubbleButton}
              onPress={() => {
                const conv = conversations.find(c => c.chatId === selectedChatForDelete);
                if (conv) handleDeleteChat(conv.chatId, conv.recipientName);
              }}
              activeOpacity={0.7}
            >
              <Ionicons name="trash" size={20} color="#FFFFFF" />
              <Text style={styles.deleteBubbleText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

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
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
  },
  tabNav: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'transparent',
    gap: 12,
    marginTop: 4,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#1A1530',
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.18)',
  },
  tabButtonActive: {
    backgroundColor: 'rgba(139, 92, 246, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139, 92, 246, 0.80)',
  },
  tabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-SemiBold',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  section: {
    paddingVertical: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  likesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  filterButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
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
    fontFamily: 'Inter-Bold',
  },
  countBadge: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  countBadgeText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-Bold',
  },
  likersListContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  likerCard: {
    width: LIKER_CARD_SIZE,
    height: LIKER_CARD_SIZE * 1.3,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#16283D',
    shadowColor: '#378BBB',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  likerPhoto: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  noPhotoPlaceholder: {
    backgroundColor: '#16112B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  likerGradient: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'transparent',
    // Simulating gradient with semi-transparent overlay
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  matchBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(13, 11, 30, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  matchBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: 'Inter-Bold',
  },
  likerInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  likerName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  emptyLikersContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
    gap: 8,
    marginTop: 60,
  },
  emptyLikersText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Medium',
  },
  loadMoreContainer: {
    width: 60,
    height: LIKER_CARD_SIZE * 1.3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  likersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  likerGridCard: {
    width: (width - 44) / 2,
    backgroundColor: '#1A1530',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
  },
  likerGridPhoto: {
    width: '100%',
    height: (width - 44) / 2 * 1.3, // Same aspect ratio as before
    resizeMode: 'cover',
  },
  gridMatchBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(13, 11, 30, 0.72)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  likerGridInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: 'rgba(13, 11, 30, 0.46)',
  },
  likerGridName: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    flex: 1,
  },
  divider: {
    height: 8,
    backgroundColor: '#1B2F48',
    marginVertical: 8,
  },

  // Search styles
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 2,
    backgroundColor: 'transparent',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16112B',
    borderRadius: 14,
    paddingHorizontal: 18,
    height: 54,
    gap: 8,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
  },
  searchInputContainerFocused: {
    borderColor: 'rgba(139, 92, 246, 0.80)',
    backgroundColor: '#16112B',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    padding: 0,
    fontFamily: 'Inter-Regular',
  },
  searchGloballyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    height: 54,
    borderRadius: 30,
    gap: 8,
  },
  searchGloballyText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },

  // Global search results
  globalSearchResults: {
    position: 'absolute',
    top: 172,
    left: 12,
    right: 12,
    bottom: 12,
    backgroundColor: '#1A1530',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    overflow: 'hidden',
    zIndex: 100,
  },
  globalSearchHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  globalSearchTitle: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  globalSearchClose: {
    fontSize: 14,
    color: '#22D3EE',
    fontFamily: 'Inter-Medium',
  },
  globalSearchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    gap: 12,
  },
  globalSearchLoadingText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  globalSearchList: {
    flex: 1,
  },
  globalSearchEmpty: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 60,
  },
  globalSearchEmptyText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 12,
    fontFamily: 'Inter-Regular',
  },

  // Search result item
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    gap: 12,
  },
  searchResultPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  searchResultPhotoPlaceholder: {
    backgroundColor: '#16112B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchResultName: {
    fontSize: 16,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  searchResultBio: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
    fontFamily: 'Inter-Regular',
  },
  searchResultAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Conversation styles
  conversationCountBadge: {
    backgroundColor: '#1B2F48',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  conversationCountText: {
    fontSize: 12,
    color: '#7F93AA',
    fontWeight: '500',
  },
  conversationsLoading: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  conversationsList: {
    paddingHorizontal: 16,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1530',
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.20,
    shadowRadius: 18,
    elevation: 6,
    gap: 12,
  },
  // Delete bubble popup
  bubbleBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    zIndex: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBubble: {
    position: 'absolute',
    top: '45%',
    alignSelf: 'center',
    backgroundColor: '#1A1530',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.30)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 8,
    zIndex: 1000,
  },
  deleteBubbleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  deleteBubbleText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
  },
  conversationPhoto: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  conversationPhotoPlaceholder: {
    backgroundColor: '#16112B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  conversationName: {
    fontSize: 16,
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
    fontFamily: 'Inter-SemiBold',
  },
  conversationTime: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.55)',
    fontFamily: 'Inter-Regular',
  },
  conversationPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  conversationPreview: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.82)',
    flex: 1,
    fontFamily: 'Inter-Regular',
  },
  conversationPreviewMuted: {
    color: 'rgba(255,255,255,0.55)',
    fontStyle: 'italic',
  },
  pendingBadge: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    padding: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  noSearchResults: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  noSearchResultsText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 12,
    textAlign: 'center',
    fontFamily: 'Inter-Regular',
  },

  // Empty conversations state
  emptyConversationsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
    paddingHorizontal: 40,
  },
  emptyConversationsIcon: {
    position: 'relative',
    marginBottom: 16,
  },
  emptyConversationsHearts: {
    position: 'absolute',
    bottom: -8,
    right: -8,
  },
  emptyConversationsHeart: {
    fontSize: 24,
  },
  emptyConversationsTitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter-SemiBold',
  },
  emptyConversationsSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
    fontFamily: 'Inter-Regular',
  },
  emptyConversationsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 54,
    paddingHorizontal: 24,
    borderRadius: 30,
    gap: 8,
  },
  emptyConversationsButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },

  // Legacy placeholder styles (kept for compatibility)
  conversationsPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  placeholderTitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.82)',
    marginTop: 16,
    fontFamily: 'Inter-SemiBold',
  },
  placeholderSubtext: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
  },
});

export default MyHubScreen;
