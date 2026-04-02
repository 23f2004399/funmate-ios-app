/**
 * FUNMATE Cloud Functions for Push Notifications
 *
 * These functions trigger on Firestore events and send
 * push notifications via Firebase Cloud Messaging (FCM)
 */

import * as admin from "firebase-admin";
import {setGlobalOptions} from "firebase-functions";

// Initialize Firebase Admin
admin.initializeApp();

// Set global options for all functions
// Limit concurrent instances to control costs
setGlobalOptions({
  maxInstances: 10,
  region: "asia-south1", // Mumbai region for faster response in India
});

// ==========================================
// NOTIFICATION TRIGGERS
// ==========================================

// New Like/SuperLike notification
export {onNewLike} from "./notifications/onNewLike";

// New Match notification (sent to both users)
export {onNewMatch} from "./notifications/onNewMatch";

// New Message notification
export {onNewMessage} from "./notifications/onNewMessage";

