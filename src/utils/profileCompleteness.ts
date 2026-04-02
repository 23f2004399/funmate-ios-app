/**
 * PROFILE COMPLETENESS CALCULATOR
 * 
 * Calculates profile completion percentage based on:
 * - Mandatory Section: 25% (phone, email, name, age, gender, photos, selfie)
 * - Bio: 10%
 * - Interests: 12%
 * - Dating Preferences: 18% (intent + gender preference, 9% each)
 * - Location: 20%
 * - Height: 5% (NEW)
 * - Occupation: 5% (NEW)
 * - Social Handles: 5% (NEW - any 1+ handle)
 */

import { SocialHandles, UserHeight } from '../types/database';

interface UserData {
  name?: string;
  age?: number;
  gender?: string;
  photos?: any[];
  isVerified?: boolean;
  bio?: string;
  interests?: string[];
  relationshipIntent?: string | null;
  interestedIn?: string[];
  location?: {
    latitude: number;
    longitude: number;
  } | null;
  height?: UserHeight | null;
  occupation?: string | null;
  socialHandles?: SocialHandles | null;
}

export const calculateProfileCompleteness = (userData: UserData): number => {
  let completeness = 0;

  // Mandatory Section: 25%
  // If user has name, age, gender, and photos, assume they completed signup
  // (phone verification and selfie check are required during signup)
  const hasMandatory = 
    userData.name &&
    userData.age &&
    userData.gender &&
    userData.photos && userData.photos.length >= 4;
  
  if (hasMandatory) {
    completeness += 25;
  }

  // Bio: 10%
  if (userData.bio && userData.bio.trim().length >= 20) {
    completeness += 10;
  }

  // Interests: 12%
  if (userData.interests && userData.interests.length > 0) {
    completeness += 12;
  }

  // Dating Preferences: 18% (9% each for intent and gender)
  if (userData.relationshipIntent) {
    completeness += 9;
  }
  if (userData.interestedIn && userData.interestedIn.length > 0) {
    completeness += 9;
  }

  // Location: 20%
  if (userData.location && userData.location.latitude && userData.location.longitude) {
    completeness += 20;
  }

  // Height: 5% (NEW)
  if (userData.height && userData.height.value > 0) {
    completeness += 5;
  }

  // Occupation: 5% (NEW)
  if (userData.occupation && userData.occupation.trim().length > 0) {
    completeness += 5;
  }

  // Social Handles: 5% (NEW - any 1+ handle)
  if (userData.socialHandles) {
    const hasAnySocial = 
      userData.socialHandles.instagram ||
      userData.socialHandles.linkedin ||
      userData.socialHandles.facebook ||
      userData.socialHandles.twitter;
    if (hasAnySocial) {
      completeness += 5;
    }
  }

  return Math.round(completeness);
};

export const getMissingFields = (userData: UserData): string[] => {
  const missing: string[] = [];

  if (!userData.bio || userData.bio.trim().length < 20) {
    missing.push('Bio');
  }
  if (!userData.interests || userData.interests.length === 0) {
    missing.push('Interests');
  }
  if (!userData.relationshipIntent) {
    missing.push('Relationship Intent');
  }
  if (!userData.interestedIn || userData.interestedIn.length === 0) {
    missing.push('Gender Preference');
  }
  if (!userData.location) {
    missing.push('Location');
  }
  if (!userData.height) {
    missing.push('Height');
  }
  if (!userData.occupation) {
    missing.push('Occupation');
  }
  
  // Check social handles
  const hasAnySocial = userData.socialHandles && (
    userData.socialHandles.instagram ||
    userData.socialHandles.linkedin ||
    userData.socialHandles.facebook ||
    userData.socialHandles.twitter
  );
  if (!hasAnySocial) {
    missing.push('Social Handles');
  }

  return missing;
};
