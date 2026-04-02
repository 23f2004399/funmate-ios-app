import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {
  sendPushNotification,
  isNotificationEnabled,
} from "../utils/sendPush";

/**
 * Triggered when a new swipe (like/superlike) is created
 * Sends anonymous "Someone liked you" notification
 */
export const onNewLike = onDocumentCreated(
  {
    document: "swipes/{swipeId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.error("No data in swipe document");
      return;
    }

    const swipeData = snapshot.data();
    const {toUserId, action} = swipeData;

    // Only send notification for likes and superlikes
    if (action !== "like" && action !== "superlike") {
      logger.info("Swipe action is pass, skipping notification");
      return;
    }

    // Check if user has likes notifications enabled
    const isEnabled = await isNotificationEnabled(toUserId, "likes");
    if (!isEnabled) {
      logger.info(`User ${toUserId} has likes notifications disabled`);
      return;
    }

    // Determine notification text based on action
    const isSuperLike = action === "superlike";
    const title = isSuperLike ? "⭐ Super Like!" : "❤️ New Like!";
    const body = isSuperLike
      ? "Someone super liked you! Check who it is."
      : "Someone liked you! Check who it is.";

    await sendPushNotification({
      userId: toUserId,
      type: "new_like",
      title,
      body,
      data: {
        screen: "WhoLikedYou",
        swipeId: snapshot.id,
      },
    });

    logger.info(`Sent like notification to user ${toUserId}`);
  }
);
