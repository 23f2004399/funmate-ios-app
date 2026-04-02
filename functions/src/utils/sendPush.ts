import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

// Lazy initialization - get instances when needed, not at module load time
const getDb = () => admin.firestore();
const getMessaging = () => admin.messaging();

export interface NotificationPayload {
  userId: string;
  type:
    | "new_like"
    | "new_match"
    | "new_message"
    | "event_reminder"
    | "booking_confirmed"
    | "payment_received"
    | "settlement_processed"
    | "event_cancelled";
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Check if user has enabled notifications for a specific type
 */
export async function isNotificationEnabled(
  userId: string,
  notificationType: "likes" | "matches" | "messages" | "events"
): Promise<boolean> {
  try {
    const userDoc = await getDb().collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return false;
    }

    const userData = userDoc.data();
    const settings = userData?.notificationSettings;

    // If settings don't exist, default to enabled
    if (!settings) {
      return true;
    }

    return settings[notificationType] !== false;
  } catch (error) {
    logger.error("Error checking notification settings:", error);
    return true; // Default to enabled if error
  }
}

/**
 * Get user's FCM tokens
 */
export async function getUserTokens(userId: string): Promise<string[]> {
  try {
    const userDoc = await getDb().collection("users").doc(userId).get();

    if (!userDoc.exists) {
      return [];
    }

    const userData = userDoc.data();
    return userData?.fcmTokens || [];
  } catch (error) {
    logger.error("Error getting user tokens:", error);
    return [];
  }
}

/**
 * Save notification to Firestore for in-app history
 */
async function saveNotificationToFirestore(
  payload: NotificationPayload
): Promise<void> {
  try {
    await getDb().collection("notifications").add({
      userId: payload.userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,
      data: payload.data || {},
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    logger.error("Error saving notification:", error);
  }
}

/**
 * Update badge count for a user
 */
export async function updateBadgeCount(userId: string): Promise<number> {
  try {
    // Count unread notifications
    const unreadSnapshot = await getDb()
      .collection("notifications")
      .where("userId", "==", userId)
      .where("read", "==", false)
      .count()
      .get();

    return unreadSnapshot.data().count;
  } catch (error) {
    logger.error("Error getting badge count:", error);
    return 0;
  }
}

/**
 * Remove invalid FCM tokens from user document
 */
async function removeInvalidToken(
  userId: string,
  invalidToken: string
): Promise<void> {
  try {
    await getDb().collection("users").doc(userId).update({
      fcmTokens: admin.firestore.FieldValue.arrayRemove(invalidToken),
    });
    logger.info(`Removed invalid token for user ${userId}`);
  } catch (error) {
    logger.error("Error removing invalid token:", error);
  }
}

/**
 * Send push notification to a user
 */
export async function sendPushNotification(
  payload: NotificationPayload
): Promise<void> {
  try {
    const tokens = await getUserTokens(payload.userId);

    if (tokens.length === 0) {
      logger.info(`No FCM tokens for user ${payload.userId}`);
      return;
    }

    // Save notification to Firestore first
    await saveNotificationToFirestore(payload);

    // Get updated badge count
    const badgeCount = await updateBadgeCount(payload.userId);

    // Prepare the message for each token
    const messages: admin.messaging.Message[] = tokens.map((token) => ({
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        ...payload.data,
        type: payload.type,
        click_action: "FLUTTER_NOTIFICATION_CLICK",
      },
      android: {
        priority: "high" as const,
        notification: {
          channelId: "funmate_notifications",
          priority: "high" as const,
          defaultVibrateTimings: true,
          icon: "ic_notification",
          color: "#FF4458",
        },
      },
      apns: {
        payload: {
          aps: {
            badge: badgeCount,
            sound: "default",
            "content-available": 1,
          },
        },
      },
    }));

    // Send to all devices
    const results = await Promise.allSettled(
      messages.map((msg) => getMessaging().send(msg))
    );

    // Handle invalid tokens
    results.forEach((result, index) => {
      if (result.status === "rejected") {
        const error = result.reason;
        if (
          error?.code === "messaging/invalid-registration-token" ||
          error?.code === "messaging/registration-token-not-registered"
        ) {
          removeInvalidToken(payload.userId, tokens[index]);
        } else {
          logger.error(`Failed to send to token ${index}:`, error);
        }
      }
    });

    const successCount = results.filter(
      (r) => r.status === "fulfilled"
    ).length;
    logger.info(
      `Sent ${successCount}/${tokens.length} notifications to user ${payload.userId}`
    );
  } catch (error) {
    logger.error("Error sending push notification:", error);
  }
}
