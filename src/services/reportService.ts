/**
 * REPORT SERVICE
 * 
 * Handles user reporting with auto-suspension logic
 */

import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';
import { Report, ReportReason, AccountSuspension } from '../types/database';

const COLLECTIONS = {
  REPORTS: 'reports',
  ACCOUNTS: 'accounts',
  ACCOUNT_SUSPENSIONS: 'accountSuspensions',
};

// Auto-suspension thresholds
const SUSPENSION_THRESHOLDS = {
  REPORTS_24_HOURS: 30, // 30 different reports in 24 hours
  REPORTS_LIFETIME: 300, // 300 different reports lifetime
};

/**
 * Upload screenshots to Firebase Storage
 */
const uploadScreenshots = async (
  reporterId: string,
  reportedId: string,
  screenshotUris: string[]
): Promise<string[]> => {
  if (!screenshotUris || screenshotUris.length === 0) {
    console.log('📸 No screenshots to upload');
    return [];
  }

  console.log(`📸 Starting upload of ${screenshotUris.length} screenshots...`);

  const uploadPromises = screenshotUris.map(async (uri, index) => {
    try {
      console.log(`📤 Uploading screenshot ${index + 1}:`, uri);
      const timestamp = Date.now();
      const filename = `reports/${reporterId}/${reportedId}/${timestamp}_${index}.jpg`;
      const reference = storage().ref(filename);
      
      console.log(`📁 Storage path: ${filename}`);
      await reference.putFile(uri);
      const downloadUrl = await reference.getDownloadURL();
      
      console.log(`✅ Screenshot ${index + 1} uploaded:`, downloadUrl);
      return downloadUrl;
    } catch (error) {
      console.error(`❌ Error uploading screenshot ${index + 1}:`, error);
      return null;
    }
  });

  const results = await Promise.all(uploadPromises);
  const successfulUploads = results.filter((url): url is string => url !== null);
  console.log(`📊 Upload complete: ${successfulUploads.length}/${screenshotUris.length} successful`);
  
  return successfulUploads;
};

/**
 * Submit a report against a user
 * Automatically checks suspension thresholds and suspends if needed
 */
export const reportUser = async (
  reporterId: string,
  reportedId: string,
  reason: ReportReason,
  description: string,
  evidence: string[] = []
): Promise<void> => {
  try {
    // 1. Upload screenshots to Firebase Storage
    console.log(`📸 Uploading ${evidence.length} screenshots...`);
    const screenshotUrls = await uploadScreenshots(reporterId, reportedId, evidence);
    console.log(`✅ Uploaded ${screenshotUrls.length} screenshots`);

    // 2. Create report
    const reportData: Omit<Report, 'id'> = {
      reporterId,
      reportedId,
      reportedType: 'user',
      reason,
      description,
      evidence: screenshotUrls.length > 0 ? screenshotUrls : null,
      status: 'pending',
      reviewedBy: null,
      reviewedAt: null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };

    const reportRef = await firestore()
      .collection(COLLECTIONS.REPORTS)
      .add(reportData);

    console.log(`✅ Report submitted: ${reportRef.id}`);

    // 3. Check suspension thresholds
    await checkAndApplySuspension(reportedId);
  } catch (error) {
    console.error('❌ Error submitting report:', error);
    throw new Error('Failed to submit report');
  }
};

/**
 * Check if user should be auto-suspended based on report count
 * Triggers suspension if:
 * - 30 DIFFERENT reports in last 24 hours, OR
 * - 300 DIFFERENT reports lifetime
 */
const checkAndApplySuspension = async (userId: string): Promise<void> => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Get all reports against this user (group by reporter to count "different" reports)
    // Note: This requires Cloud Functions for proper access control
    // For now, we'll catch permission errors gracefully
    const allReportsSnapshot = await firestore()
      .collection(COLLECTIONS.REPORTS)
      .where('reportedId', '==', userId)
      .where('reportedType', '==', 'user')
      .get();

    // Count unique reporters (different reports)
    const uniqueReporters = new Set<string>();
    const recentUniqueReporters = new Set<string>();

    allReportsSnapshot.docs.forEach(doc => {
      const report = doc.data();
      const reporterId = report.reporterId;
      
      uniqueReporters.add(reporterId);

      // Check if report is within last 24 hours
      const reportCreatedAt = report.createdAt?.toDate();
      if (reportCreatedAt && reportCreatedAt >= twentyFourHoursAgo) {
        recentUniqueReporters.add(reporterId);
      }
    });

    const totalDifferentReports = uniqueReporters.size;
    const recentDifferentReports = recentUniqueReporters.size;

    console.log(`📊 User ${userId} report stats:`, {
      last24Hours: recentDifferentReports,
      lifetime: totalDifferentReports,
    });

    // Check thresholds
    const shouldSuspend =
      recentDifferentReports >= SUSPENSION_THRESHOLDS.REPORTS_24_HOURS ||
      totalDifferentReports >= SUSPENSION_THRESHOLDS.REPORTS_LIFETIME;

    if (shouldSuspend) {
      // Check if already suspended
      const existingSuspension = await firestore()
        .collection(COLLECTIONS.ACCOUNT_SUSPENSIONS)
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .limit(1)
        .get();

      if (existingSuspension.empty) {
        await autoSuspendUser(
          userId,
          totalDifferentReports,
          recentDifferentReports >= SUSPENSION_THRESHOLDS.REPORTS_24_HOURS
            ? '24_hour_threshold'
            : 'lifetime_threshold'
        );
      } else {
        console.log(`⚠️ User ${userId} already suspended`);
      }
    }
  } catch (error: any) {
    // Permission denied is expected for client-side - suspension should be handled by Cloud Functions
    if (error?.code === 'firestore/permission-denied') {
      console.log('⚠️ Suspension check skipped (requires Cloud Functions). Report submitted successfully.');
    } else {
      console.error('❌ Error checking suspension thresholds:', error);
    }
  }
};

/**
 * Auto-suspend a user account
 */
const autoSuspendUser = async (
  userId: string,
  reportCount: number,
  trigger: '24_hour_threshold' | 'lifetime_threshold'
): Promise<void> => {
  const batch = firestore().batch();

  try {
    // 1. Create suspension record
    const suspensionRef = firestore().collection(COLLECTIONS.ACCOUNT_SUSPENSIONS).doc();
    const suspensionData: Omit<AccountSuspension, 'id'> = {
      userId,
      reason: 'auto_suspend_reports',
      reportCount,
      status: 'active',
      suspendedAt: firestore.FieldValue.serverTimestamp(),
      liftedAt: null,
      liftedBy: null,
      createdAt: firestore.FieldValue.serverTimestamp(),
    };
    batch.set(suspensionRef, suspensionData);

    // 2. Update account status
    const accountSnapshot = await firestore()
      .collection(COLLECTIONS.ACCOUNTS)
      .where('authUid', '==', userId) // Assuming userId is authUid
      .limit(1)
      .get();

    if (!accountSnapshot.empty) {
      const accountRef = accountSnapshot.docs[0].ref;
      batch.update(accountRef, {
        status: 'suspended',
      });
    }

    await batch.commit();

    console.log(
      `🚨 AUTO-SUSPENDED: User ${userId} (${reportCount} reports, trigger: ${trigger})`
    );
  } catch (error) {
    console.error('❌ Error auto-suspending user:', error);
    throw error;
  }
};

/**
 * Admin: Lift suspension
 */
export const liftSuspension = async (
  userId: string,
  adminId: string
): Promise<void> => {
  const batch = firestore().batch();

  try {
    // 1. Update suspension record
    const suspensionSnapshot = await firestore()
      .collection(COLLECTIONS.ACCOUNT_SUSPENSIONS)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .get();

    suspensionSnapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'lifted',
        liftedAt: firestore.FieldValue.serverTimestamp(),
        liftedBy: adminId,
      });
    });

    // 2. Update account status
    const accountSnapshot = await firestore()
      .collection(COLLECTIONS.ACCOUNTS)
      .where('authUid', '==', userId)
      .limit(1)
      .get();

    if (!accountSnapshot.empty) {
      const accountRef = accountSnapshot.docs[0].ref;
      batch.update(accountRef, {
        status: 'active',
      });
    }

    await batch.commit();
    console.log(`✅ Suspension lifted for user ${userId} by admin ${adminId}`);
  } catch (error) {
    console.error('❌ Error lifting suspension:', error);
    throw new Error('Failed to lift suspension');
  }
};

/**
 * Check if user is currently suspended
 */
export const isUserSuspended = async (userId: string): Promise<boolean> => {
  try {
    const suspensionSnapshot = await firestore()
      .collection(COLLECTIONS.ACCOUNT_SUSPENSIONS)
      .where('userId', '==', userId)
      .where('status', '==', 'active')
      .limit(1)
      .get();

    return !suspensionSnapshot.empty;
  } catch (error) {
    console.error('❌ Error checking suspension status:', error);
    return false;
  }
};

/**
 * Get user's report count
 */
export const getUserReportStats = async (
  userId: string
): Promise<{ total: number; last24Hours: number }> => {
  try {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const allReportsSnapshot = await firestore()
      .collection(COLLECTIONS.REPORTS)
      .where('reportedId', '==', userId)
      .where('reportedType', '==', 'user')
      .get();

    const uniqueReporters = new Set<string>();
    const recentUniqueReporters = new Set<string>();

    allReportsSnapshot.docs.forEach(doc => {
      const report = doc.data();
      const reporterId = report.reporterId;
      
      uniqueReporters.add(reporterId);

      const reportCreatedAt = report.createdAt?.toDate();
      if (reportCreatedAt && reportCreatedAt >= twentyFourHoursAgo) {
        recentUniqueReporters.add(reporterId);
      }
    });

    return {
      total: uniqueReporters.size,
      last24Hours: recentUniqueReporters.size,
    };
  } catch (error) {
    console.error('❌ Error getting report stats:', error);
    return { total: 0, last24Hours: 0 };
  }
};
