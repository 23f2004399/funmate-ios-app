/**
 * DATABASE TYPES
 * 
 * TypeScript interfaces matching Firestore schema
 */

// ==========================================
// SIGNUP STEP TYPE
// ==========================================
export type SignupStep = 
  | 'account_type'             // Just verified phone, need to select account type
  | 'basic_info'               // Explorer: Need to fill basic info (name, email, etc.)
  | 'creator_basic_info'       // Creator: Need to fill basic info (name, email, etc.)
  | 'creator_google_profile'   // Creator: Linked Google, need to complete profile
  | 'creator_type_selection'   // Creator: Need to choose Individual or Merchant
  | 'individual_host_verification' // Individual Host: Identity verification (Aadhaar/PAN)
  | 'individual_bank_details'  // Individual Host: Bank account details for payouts
  | 'individual_host_profile'  // Individual Host: Bio, experience, category, social links
  | 'individual_host_complete' // Individual Host: Signup complete, route to host dashboard
  | 'merchant_verification'    // Merchant: Business verification (GST/PAN/License)
  | 'merchant_bank_details'    // Merchant: Bank account details for business payouts
  | 'merchant_profile'         // Merchant: Business profile, description, categories
  | 'merchant_complete'        // Merchant: Signup complete, route to merchant dashboard
  | 'photos'                   // Need to upload photos
  | 'liveness'                 // Need to complete liveness verification
  | 'preferences'              // Need to fill dating preferences (skippable)
  | 'interests'                // Need to select interests (skippable)
  | 'complete';                // Explorer: Signup complete, can access app

// ==========================================
// ACCOUNTS COLLECTION
// ==========================================
export interface Account {
  id?: string;
  authUid: string;
  role: 'user' | 'event_creator';
  creatorType: 'individual' | 'merchant' | null;
  status: 'active' | 'pending_verification' | 'suspended';
  phoneVerified: boolean;
  emailVerified: boolean;
  identityVerified: boolean;
  bankVerified: boolean;
  signupStep: SignupStep;
  createdAt: any;
}

// ==========================================
// SWIPES COLLECTION
// ==========================================
export interface Swipe {
  id?: string;
  fromUserId: string;
  toUserId: string;
  action: 'like' | 'pass' | 'superlike';
  actedOnByTarget: boolean;
  createdAt: any; // Firestore Timestamp
}

// ==========================================
// USERS COLLECTION
// ==========================================
export interface UserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  geoHash?: string;
}

export interface UserPhoto {
  url: string;
  isPrimary: boolean;
  moderationStatus?: string;
  order?: number;
  uploadedAt?: string;
}

export interface PremiumFeatures {
  unlimitedSwipes: boolean;
  seeWhoLikedYou: boolean;
  audioVideoCalls: boolean;
  priorityListing: boolean;
}

// ==========================================
// HEIGHT & SOCIAL HANDLES
// ==========================================
export interface UserHeight {
  value: number;           // stored in cm
  displayUnit: 'cm' | 'ft'; // user's preferred display unit
}

export interface SocialHandles {
  instagram: string | null;  // @username only
  linkedin: string | null;   // profile URL or username
  facebook: string | null;   // profile URL or username
  twitter: string | null;    // @username only (X)
}

// ==========================================
// CREATOR DETAILS (FOR EVENT CREATORS)
// ==========================================
export interface BusinessAddress {
  addressLine: string;
  city: string;
  state: string;
  country: string;
}

export interface CreatorDetails {
  organizationName: string | null;    // Business/Organization name (merchant only)
  logoUrl: string | null;             // Business logo URL
  businessAddress: BusinessAddress | null;  // Official business address
  website: string | null;             // Business website
  contactEmail: string | null;        // Customer contact email
  experienceYears: number | null;     // Years of experience
  bio: string | null;                 // Business/creator description
  socialLinks: string[] | null;       // Array of social media URLs (Instagram, LinkedIn, etc.)
}

export interface User {
  id?: string;
  accountId: string;
  username: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  height: UserHeight | null;           // NEW
  occupation: string | null;           // NEW
  socialHandles: SocialHandles | null; // NEW
  relationshipIntent: 'casual' | 'long_term' | 'hookups' | 'friendship' | 'unsure' | null;
  interestedIn: string[];
  matchRadiusKm: number;
  interests: string[];
  location: UserLocation | null;
  photos: UserPhoto[];
  isVerified: boolean;
  signupComplete: boolean;             // NEW - prevents incomplete profiles from appearing in swipe feed
  premiumStatus: 'free' | 'premium';
  premiumExpiresAt: any | null;
  premiumFeatures: PremiumFeatures;
  creatorDetails: CreatorDetails | null;  // Only filled when role = event_creator
  createdAt: any;
  lastActiveAt: any;
}

// ==========================================
// MATCHES COLLECTION
// ==========================================
export interface Match {
  id?: string;
  userA: string;
  userB: string;
  isActive: boolean;
  blockedBy: string | null; // userId who has active block (null = no block)
  createdAt: any;
}

// ==========================================
// CHATS COLLECTION
// ==========================================
export interface LastMessage {
  text: string;
  senderId: string;
  timestamp: any;
}

export interface DeletionPolicy {
  type: 'rolling' | 'on_unmatch' | 'none';
  days: number | null;
}

export interface Chat {
  id?: string;
  type: 'dating' | 'event' | 'custom';
  participants: string[];
  relatedMatchId: string | null;
  isMutual: boolean;
  lastMessage: LastMessage | null;
  lastReadBy?: Record<string, any>; // userId -> timestamp when they last read the chat
  relatedEventId: string | null;
  deletionPolicy: DeletionPolicy;
  allowDeleteForEveryone: boolean;
  deleteForEveryoneWindowDays: number | null;
  deletedAt: any | null; // When chat was deleted (soft delete)
  deletedBy: string | null; // User who triggered deletion
  permanentlyDeleteAt: any | null; // When to permanently delete (deletedAt + 30 days)
  createdAt: any;
  lastMessageAt: any;
}

// ==========================================
// MESSAGES COLLECTION
// ==========================================
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'gif' | 'sticker' | 'shadow_chip';

export interface Message {
  id?: string;
  chatId: string;
  senderId: string;
  type: MessageType;
  content: string;
  reactions: Record<string, string>; // userId -> emoji
  deletedForEveryone: boolean;
  deletedForEveryoneAt: any | null;
  deletedForEveryoneBy: string | null;
  deletedForUsers: string[]; // Temporary deletion (can be restored)
  hiddenForUsers: string[]; // Permanent hiding (messages sent while blocked - never shown again)
  createdAt: any;
}

// ==========================================
// LIKER TYPE (for useLikers hook)
// ==========================================
export interface Liker {
  id: string;
  swipeId: string;
  name: string;
  age: number;
  gender: string;
  bio: string;
  interests: string[];
  relationshipIntent: string | null;
  interestedIn: string[];
  photos: UserPhoto[];
  location: UserLocation | null;
  isVerified: boolean;
  matchScore: number;
  distance: number | null;
  lastActiveAt: any;
  likedAt: any; // When they liked the current user
  height: UserHeight | null;
  occupation: string | null;
  socialHandles: SocialHandles | null;
  completeness: number; // Profile completeness percentage (0-100)
}

// ==========================================
// BLOCKED USERS COLLECTION
// ==========================================
export interface BlockedUser {
  id?: string;
  userId: string; // who blocked
  blockedUserId: string; // who got blocked
  reason: string | null;
  createdAt: any;
}

// ==========================================
// REPORTS COLLECTION
// ==========================================
export type ReportReason = 'harassment' | 'fake_profile' | 'inappropriate_content' | 'scam' | 'other';
export type ReportStatus = 'pending' | 'reviewed' | 'actioned' | 'dismissed';

export interface Report {
  id?: string;
  reporterId: string;
  reportedId: string;
  reportedType: 'user' | 'event';
  reason: ReportReason;
  description: string;
  evidence: string[] | null; // optional screenshot URLs
  status: ReportStatus;
  reviewedBy: string | null;
  reviewedAt: any | null;
  createdAt: any;
}

// ==========================================
// ACCOUNT SUSPENSIONS COLLECTION
// ==========================================
export type SuspensionReason = 'auto_suspend_reports' | 'admin_action';
export type SuspensionStatus = 'active' | 'lifted';

export interface AccountSuspension {
  id?: string;
  userId: string;
  reason: SuspensionReason;
  reportCount: number;
  status: SuspensionStatus;
  suspendedAt: any;
  liftedAt: any | null;
  liftedBy: string | null; // admin accountId
  createdAt: any;
}

// ==========================================
// MERCHANT VERIFICATION COLLECTION
// ==========================================
export interface GSTDetails {
  legal_name: string;
  trade_name: string;
  state: string;
  gstin_status: string;
  date_of_registration: string;
}

export interface PANDetails {
  full_name: string;
  category: string;
  pan_status: string;
}

export interface LicenseDetails {
  licenseLast4: string;
  business_name: string;
  issue_date: string;
  expiry_date: string;
  issuing_authority: string;
  license_type: string;
}

export interface MerchantVerification {
  gstLast4: string | null;           // Only last 4 digits
  panLast4: string | null;           // Only last 4 digits
  licenseLast4: string | null;       // Only last 4 digits
  gstVerified: boolean;
  panVerified: boolean;
  licenseVerified: boolean;
  verifiedAt: any;
  licenseDocumentURL: string | null;     // Secure Firebase Storage URL
  licenseVerificationId: string | null;  // Digio verification ID
  gstDetails: GSTDetails | null;         // From Digio GST API
  panDetails: PANDetails | null;         // From Digio PAN API
  licenseDetails: LicenseDetails | null; // From Digio OCR
}
