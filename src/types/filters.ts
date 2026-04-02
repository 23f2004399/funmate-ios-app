/**
 * FILTER TYPES
 * 
 * Type definitions for "Who Liked You" filtering system
 */

export interface WhoLikedYouFilters {
  ageRange: { min: number; max: number } | null;
  heightRange: { min: number; max: number } | null; // in cm
  relationshipIntent: string[] | null; // ["casual", "long_term", etc.]
  maxDistance: number | null; // in km
  occupations: string[] | null;
  trustScoreRange: { min: number; max: number } | null; // 0-100%
  matchScoreRange: { min: number; max: number } | null; // 0-100%
}

export const DEFAULT_FILTERS: WhoLikedYouFilters = {
  ageRange: null,
  heightRange: null,
  relationshipIntent: null,
  maxDistance: null,
  occupations: null,
  trustScoreRange: null,
  matchScoreRange: null,
};

export const RELATIONSHIP_INTENT_OPTIONS = [
  { value: 'casual', label: 'Casual' },
  { value: 'long_term', label: 'Long Term' },
  { value: 'hookups', label: 'Hookups' },
  { value: 'friendship', label: 'Friendship' },
  { value: 'unsure', label: 'Unsure' },
];
