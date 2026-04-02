/**
 * ALGOLIA CONFIGURATION
 * 
 * Global search configuration for finding users across the platform.
 * 
 * Setup Instructions:
 * 1. Create an Algolia account at https://www.algolia.com
 * 2. Create a new application
 * 3. Create an index called 'users'
 * 4. Get your Application ID and Search-Only API Key
 * 5. Replace the placeholder values below
 * 
 * To sync users to Algolia:
 * - Use a Firebase Cloud Function triggered on user create/update
 * - Or manually sync using the Algolia Firebase extension
 */

import { algoliasearch } from 'algoliasearch';

// Replace these with your actual Algolia credentials
const ALGOLIA_APP_ID = 'GXGUREX4GQ';
const ALGOLIA_SEARCH_KEY = '1f00fd85ec05fa0f9330f2c005bfe1eb';

// Index name for users
export const USERS_INDEX_NAME = 'users';

// Create the Algolia client
export const algoliaClient = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_SEARCH_KEY);

// Algolia is configured with real credentials
export const isAlgoliaConfigured = () => true;

/**
 * Search users globally
 * @param query - Search query string
 * @param options - Optional search parameters
 */
export const searchUsers = async (query: string, options?: {
  hitsPerPage?: number;
  filters?: string;
}) => {
  if (!isAlgoliaConfigured()) {
    console.warn('Algolia is not configured. Using Firestore fallback.');
    return null;
  }

  try {
    // Using algoliasearch v5 API
    const results = await algoliaClient.searchSingleIndex({
      indexName: USERS_INDEX_NAME,
      searchParams: {
        query,
        hitsPerPage: options?.hitsPerPage || 20,
        filters: options?.filters,
        attributesToRetrieve: [
          'objectID',
          'name',
          'age',
          'bio',
          'photos',
          'isVerified',
          'gender',
          'interests',
          'creatorDetails', // To filter out event creators
        ],
      },
    });

    return results.hits;
  } catch (error) {
    console.error('Algolia search error:', error);
    throw error;
  }
};

/**
 * User object structure in Algolia index
 * 
 * When syncing users to Algolia, include these fields:
 * {
 *   objectID: string (same as Firestore document ID)
 *   name: string
 *   age: number
 *   bio: string
 *   photos: Array<{ url: string, isPrimary: boolean }>
 *   isVerified: boolean
 *   gender: string
 *   interests: string[]
 *   location: { city?: string }
 * }
 */
export interface AlgoliaUserRecord {
  objectID: string;
  name: string;
  age: number;
  bio: string;
  photos: Array<{ url: string; isPrimary: boolean }>;
  isVerified: boolean;
  gender?: string;
  interests?: string[];
  location?: { city?: string };
}
