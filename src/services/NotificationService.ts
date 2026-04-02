/**
 * Push Notification Service
 *
 * Handles FCM token management, permission requests,
 * and notification handling for the Funmate app.
 */

import messaging, {
  FirebaseMessagingTypes,
} from '@react-native-firebase/messaging';
import {Platform, PermissionsAndroid} from 'react-native';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';

// Types for notification data
export interface NotificationData {
  type:
    | 'new_like'
    | 'new_match'
    | 'new_message'
    | 'event_reminder'
    | 'booking_confirmed';
  screen?: string;
  chatId?: string;
  matchId?: string;
  matchedUserId?: string;
  matchedUserName?: string;
  matchedUserPhoto?: string;
  swipeId?: string;
  senderId?: string;
  senderName?: string;
  senderPhoto?: string;
  chatType?: string;
  eventId?: string;
}

export type NavigationHandler = (screen: string, params?: object) => void;

class NotificationService {
  private navigationHandler: NavigationHandler | null = null;
  private isInitialized = false;
  private handlersSetup = false;

  /**
   * Setup message handlers only (no permission request)
   * Call this early to handle notification taps, even before permission is granted
   */
  setupHandlersOnly(onNavigate: NavigationHandler): void {
    if (this.handlersSetup) {
      console.log('[NotificationService] Handlers already setup');
      return;
    }

    this.navigationHandler = onNavigate;
    this.setupMessageHandlers();
    this.handlersSetup = true;
    console.log('[NotificationService] Handlers setup (no permission yet)');
  }

  /**
   * Initialize the notification service with permission request
   * Should be called after user profile is created (DatingPreferencesScreen)
   */
  async initialize(onNavigate?: NavigationHandler): Promise<void> {
    if (this.isInitialized) {
      console.log('[NotificationService] Already initialized');
      return;
    }

    if (onNavigate) {
      this.navigationHandler = onNavigate;
    }

    try {
      // Request permission
      const hasPermission = await this.requestPermission();

      if (!hasPermission) {
        console.log('[NotificationService] Permission denied');
        return;
      }

      // Get and save FCM token
      await this.getAndSaveToken();

      // Listen for token refresh
      this.setupTokenRefreshListener();

      // Setup message handlers (if not already done)
      if (!this.handlersSetup) {
        this.setupMessageHandlers();
        this.handlersSetup = true;
      }

      this.isInitialized = true;
      console.log('[NotificationService] Initialized successfully');
    } catch (error) {
      console.error('[NotificationService] Initialization error:', error);
    }
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        console.log('[NotificationService] iOS permission:', enabled);
        return enabled;
      }

      if (Platform.OS === 'android') {
        // Android 13+ requires POST_NOTIFICATIONS permission
        if (Platform.Version >= 33) {
          const result = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          );
          const granted = result === PermissionsAndroid.RESULTS.GRANTED;
          console.log('[NotificationService] Android 13+ permission:', granted);
          return granted;
        }
        return true; // Android < 13 doesn't need runtime permission
      }

      return false;
    } catch (error) {
      console.error('[NotificationService] Permission error:', error);
      return false;
    }
  }

  /**
   * Get FCM token and save to Firestore
   */
  async getAndSaveToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      console.log('[NotificationService] FCM Token:', token.substring(0, 20) + '...');

      // Save token to user's document in Firestore
      const userId = auth().currentUser?.uid;
      if (userId && token) {
        // Check if user document exists first
        const userDoc = await firestore().collection('users').doc(userId).get();
        
        // Note: exists is a getter property in RN Firebase, but types say it's a method
        if ((userDoc.exists as unknown as boolean)) {
          // User document exists - update with arrayUnion
          await firestore()
            .collection('users')
            .doc(userId)
            .update({
              fcmTokens: firestore.FieldValue.arrayUnion(token),
            });
          console.log('[NotificationService] Token saved to Firestore');
        } else {
          // User document doesn't exist yet - create with set + merge
          await firestore()
            .collection('users')
            .doc(userId)
            .set({
              fcmTokens: [token],
            }, { merge: true });
          console.log('[NotificationService] Token saved (new document created)');
        }
      }

      return token;
    } catch (error) {
      console.error('[NotificationService] Error getting/saving token:', error);
      return null;
    }
  }

  /**
   * Remove FCM token (call on logout)
   */
  async removeToken(): Promise<void> {
    try {
      const token = await messaging().getToken();
      const userId = auth().currentUser?.uid;

      if (userId && token) {
        await firestore()
          .collection('users')
          .doc(userId)
          .update({
            fcmTokens: firestore.FieldValue.arrayRemove(token),
          });
        console.log('[NotificationService] Token removed from Firestore');
      }

      // Delete the token from FCM
      await messaging().deleteToken();
      console.log('[NotificationService] Token deleted from FCM');
    } catch (error) {
      console.error('[NotificationService] Error removing token:', error);
    }
  }

  /**
   * Setup token refresh listener
   */
  private setupTokenRefreshListener(): void {
    messaging().onTokenRefresh(async (newToken) => {
      console.log('[NotificationService] Token refreshed');
      const userId = auth().currentUser?.uid;

      if (userId) {
        await firestore()
          .collection('users')
          .doc(userId)
          .update({
            fcmTokens: firestore.FieldValue.arrayUnion(newToken),
          });
      }
    });
  }

  /**
   * Setup message handlers for different app states
   */
  private setupMessageHandlers(): void {
    // Foreground messages (app is open)
    messaging().onMessage(async (remoteMessage) => {
      console.log('[NotificationService] Foreground message:', remoteMessage);
      this.handleForegroundMessage(remoteMessage);
    });

    // Background/Killed - when user taps notification
    messaging().onNotificationOpenedApp((remoteMessage) => {
      console.log('[NotificationService] Notification opened app:', remoteMessage);
      this.handleNotificationPress(remoteMessage);
    });

    // App was killed and opened via notification
    messaging()
      .getInitialNotification()
      .then((remoteMessage) => {
        if (remoteMessage) {
          console.log('[NotificationService] Initial notification:', remoteMessage);
          // Delay navigation to ensure nav is ready
          setTimeout(() => {
            this.handleNotificationPress(remoteMessage);
          }, 1000);
        }
      });
  }

  /**
   * Handle foreground message (show toast notification)
   */
  private handleForegroundMessage(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): void {
    const {notification, data} = remoteMessage;
    const notifData = data as unknown as NotificationData;

    if (!notification) return;

    // Skip showing match notification in foreground - user already sees match animation
    if (notifData?.type === 'new_match') {
      console.log('[NotificationService] Skipping match notification in foreground (animation shown)');
      return;
    }

    // Use Toast for better UX in foreground
    Toast.show({
      type: 'info',
      text1: notification.title || 'New Notification',
      text2: notification.body || '',
      visibilityTime: 4000,
      position: 'top',
    });
  }

  /**
   * Handle notification press - navigate to appropriate screen
   */
  private handleNotificationPress(
    remoteMessage: FirebaseMessagingTypes.RemoteMessage,
  ): void {
    const data = remoteMessage.data as unknown as NotificationData;

    if (!data || !this.navigationHandler) {
      console.log('[NotificationService] No data or navigation handler');
      return;
    }

    switch (data.type) {
      case 'new_like':
        // Navigate to Who Liked You screen
        this.navigationHandler('WhoLikedYou');
        break;

      case 'new_match':
        // Navigate to chat with the matched user
        // The chat might not exist yet, so we pass recipientId to create it
        this.navigationHandler('Chat', {
          chatId: null, // Will be created or found
          recipientId: data.matchedUserId,
          recipientName: data.matchedUserName,
          recipientPhoto: data.matchedUserPhoto,
        });
        break;

      case 'new_message':
        // Navigate to chat screen
        this.navigationHandler('Chat', {
          chatId: data.chatId,
          recipientId: data.senderId,
          recipientName: data.senderName,
          recipientPhoto: data.senderPhoto,
          chatType: data.chatType,
        });
        break;

      case 'event_reminder':
      case 'booking_confirmed':
        // Navigate to event details
        if (data.eventId) {
          this.navigationHandler('EventDetail', {
            eventId: data.eventId,
          });
        }
        break;

      default:
        // Navigate to home or notifications tab
        this.navigationHandler('Home');
        break;
    }
  }

  /**
   * Get current badge count from Firestore
   */
  async getBadgeCount(): Promise<number> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return 0;

      const snapshot = await firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .count()
        .get();

      return snapshot.data().count;
    } catch (error) {
      console.error('[NotificationService] Error getting badge count:', error);
      return 0;
    }
  }

  /**
   * Mark all notifications as read (clears badge)
   */
  async markAllAsRead(): Promise<void> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;

      const snapshot = await firestore()
        .collection('notifications')
        .where('userId', '==', userId)
        .where('read', '==', false)
        .get();

      const batch = firestore().batch();
      snapshot.docs.forEach((doc) => {
        batch.update(doc.ref, {read: true});
      });

      await batch.commit();
      console.log('[NotificationService] All notifications marked as read');
    } catch (error) {
      console.error('[NotificationService] Error marking as read:', error);
    }
  }

  /**
   * Mark specific notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      await firestore()
        .collection('notifications')
        .doc(notificationId)
        .update({read: true});
    } catch (error) {
      console.error('[NotificationService] Error marking notification as read:', error);
    }
  }

  /**
   * Update notification settings in Firestore
   */
  async updateSettings(settings: {
    likes?: boolean;
    matches?: boolean;
    messages?: boolean;
    events?: boolean;
  }): Promise<void> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;

      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          notificationSettings: settings,
        });

      console.log('[NotificationService] Settings updated:', settings);
    } catch (error) {
      console.error('[NotificationService] Error updating settings:', error);
    }
  }

  /**
   * Get notification settings from Firestore
   */
  async getSettings(): Promise<{
    likes: boolean;
    matches: boolean;
    messages: boolean;
    events: boolean;
  }> {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        return {likes: true, matches: true, messages: true, events: true};
      }

      const userDoc = await firestore().collection('users').doc(userId).get();
      const settings = userDoc.data()?.notificationSettings;

      return {
        likes: settings?.likes ?? true,
        matches: settings?.matches ?? true,
        messages: settings?.messages ?? true,
        events: settings?.events ?? true,
      };
    } catch (error) {
      console.error('[NotificationService] Error getting settings:', error);
      return {likes: true, matches: true, messages: true, events: true};
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;
