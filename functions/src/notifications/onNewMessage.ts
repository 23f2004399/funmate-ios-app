import {onDocumentCreated} from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import {
  sendPushNotification,
  isNotificationEnabled,
} from "../utils/sendPush";

// Lazy initialization - get Firestore when needed
const getDb = () => admin.firestore();

/**
 * Check if recipient has blocked the sender
 */
async function isSenderBlocked(
  recipientId: string,
  senderId: string
): Promise<boolean> {
  try {
    const blockSnapshot = await getDb()
      .collection("blockedUsers")
      .where("userId", "==", recipientId)
      .where("blockedUserId", "==", senderId)
      .limit(1)
      .get();

    return !blockSnapshot.empty;
  } catch (error) {
    logger.error("Error checking block status:", error);
    return false; // Default to not blocked if error
  }
}

/**
 * Triggered when a new message is created
 * Sends notification to the recipient (not the sender)
 */
export const onNewMessage = onDocumentCreated(
  {
    document: "messages/{messageId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.error("No data in message document");
      return;
    }

    const messageData = snapshot.data();
    const {chatId, senderId, type, content} = messageData;

    // Don't send notification for shadow chips or deleted messages
    if (type === "shadow_chip" || messageData.deletedForEveryone) {
      return;
    }

    // Get the chat to find the recipient
    const chatDoc = await getDb().collection("chats").doc(chatId).get();

    if (!chatDoc.exists) {
      logger.error(`Chat ${chatId} not found`);
      return;
    }

    const chatData = chatDoc.data();
    const participants: string[] = chatData?.participants || [];

    // Find the recipient (the other participant)
    const recipientId = participants.find((p) => p !== senderId);

    if (!recipientId) {
      logger.error("Could not find recipient in chat participants");
      return;
    }

    // Check if recipient has blocked the sender
    const blocked = await isSenderBlocked(recipientId, senderId);
    if (blocked) {
      logger.info(`Sender ${senderId} is blocked by ${recipientId}, skipping notification`);
      return;
    }

    // Check if recipient has messages notifications enabled
    const isEnabled = await isNotificationEnabled(recipientId, "messages");
    if (!isEnabled) {
      logger.info(`User ${recipientId} has message notifications disabled`);
      return;
    }

    // Get sender's name
    const senderDoc = await getDb().collection("users").doc(senderId).get();
    const senderData = senderDoc.data();
    const senderName = senderData?.name || "Someone";

    // Prepare message preview based on type
    let messagePreview: string;
    switch (type) {
    case "image":
      messagePreview = "📷 Sent a photo";
      break;
    case "video":
      messagePreview = "🎥 Sent a video";
      break;
    case "audio":
      messagePreview = "🎵 Sent a voice message";
      break;
    case "gif":
      messagePreview = "GIF";
      break;
    case "sticker":
      messagePreview = "Sent a sticker";
      break;
    case "text":
    default:
      // Truncate long messages
      messagePreview =
          content.length > 50 ? content.substring(0, 50) + "..." : content;
      break;
    }

    await sendPushNotification({
      userId: recipientId,
      type: "new_message",
      title: `💬 ${senderName}`,
      body: messagePreview,
      data: {
        screen: "Chat",
        chatId: chatId,
        senderId: senderId,
        senderName: senderName,
        senderPhoto: senderData?.photos?.[0]?.url || "",
        chatType: chatData?.type || "dating",
      },
    });

    logger.info(`Sent message notification to user ${recipientId}`);
  }
);
