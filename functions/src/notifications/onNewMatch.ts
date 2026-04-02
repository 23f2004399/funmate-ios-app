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
 * Triggered when a new match is created
 * Sends notification to both matched users
 */
export const onNewMatch = onDocumentCreated(
  {
    document: "matches/{matchId}",
    region: "asia-south1",
  },
  async (event) => {
    const snapshot = event.data;

    if (!snapshot) {
      logger.error("No data in match document");
      return;
    }

    const matchData = snapshot.data();
    const {userA, userB} = matchData;

    // Get both users' details
    const [userADoc, userBDoc] = await Promise.all([
      getDb().collection("users").doc(userA).get(),
      getDb().collection("users").doc(userB).get(),
    ]);

    const userAData = userADoc.data();
    const userBData = userBDoc.data();

    // Check notification settings and send to User A
    const userAEnabled = await isNotificationEnabled(userA, "matches");
    if (userAEnabled && userBData) {
      await sendPushNotification({
        userId: userA,
        type: "new_match",
        title: "🎉 It's a Match!",
        body: `You and ${userBData.name} liked each other!`,
        data: {
          screen: "Chat",
          matchId: snapshot.id,
          matchedUserId: userB,
          matchedUserName: userBData.name,
          matchedUserPhoto: userBData.photos?.[0]?.url || "",
        },
      });
      logger.info(`Sent match notification to user ${userA}`);
    }

    // Check notification settings and send to User B
    const userBEnabled = await isNotificationEnabled(userB, "matches");
    if (userBEnabled && userAData) {
      await sendPushNotification({
        userId: userB,
        type: "new_match",
        title: "🎉 It's a Match!",
        body: `You and ${userAData.name} liked each other!`,
        data: {
          screen: "Chat",
          matchId: snapshot.id,
          matchedUserId: userA,
          matchedUserName: userAData.name,
          matchedUserPhoto: userAData.photos?.[0]?.url || "",
        },
      });
      logger.info(`Sent match notification to user ${userB}`);
    }
  }
);
