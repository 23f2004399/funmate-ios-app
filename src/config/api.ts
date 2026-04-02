/**
 * API Configuration
 * 
 * Centralized API URL management that handles:
 * - Android Emulator (10.0.2.2)
 * - Physical Device (WiFi IP)
 * - Production (Deployed backend)
 * 
 * HOW TO USE:
 * 1. Development on Emulator: Automatically uses 10.0.2.2:5000
 * 2. Development on Physical Device: Update LOCAL_WIFI_IP below when WiFi changes
 * 3. Production: Update PRODUCTION_API_URL when backend is deployed
 */

import { Platform } from 'react-native';

// ═══════════════════════════════════════════════════════════════════════
// 🔧 CONFIGURATION - Update these as needed
// ═══════════════════════════════════════════════════════════════════════

/**
 * Your computer's WiFi IP address (for physical device testing)
 * Update this when you change WiFi networks
 */
const LOCAL_WIFI_IP = '10.42.242.114';

/**
 * Production backend URL (update when deployed)
 */
const PRODUCTION_API_URL = 'https://funmate-backend-production.up.railway.app';

/**
 * Set this to true if you're testing on Android Emulator
 * Emulator needs 10.0.2.2 instead of WiFi IP
 */
const IS_ANDROID_EMULATOR = false; // Change to true when using emulator

// ═══════════════════════════════════════════════════════════════════════
// 🚀 AUTO-DETECTION LOGIC (Don't modify below)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Get the appropriate base URL based on environment and device
 */
const getBaseURL = (): string => {
  // Production build
  if (!__DEV__) {
    return PRODUCTION_API_URL;
  }

  // Development build
  if (Platform.OS === 'android') {
    // Android emulator must use 10.0.2.2 (maps to host machine's localhost)
    // Physical device uses WiFi IP
    return IS_ANDROID_EMULATOR 
      ? 'http://10.0.2.2:5000'
      : `http://${LOCAL_WIFI_IP}:5000`;
  }

  // iOS simulator can use localhost
  if (Platform.OS === 'ios') {
    return 'http://localhost:5000';
  }

  // Fallback
  return `http://${LOCAL_WIFI_IP}:5000`;
};

// ═══════════════════════════════════════════════════════════════════════
// 📡 EXPORTED API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════

const BASE_URL = getBaseURL();

export const API_ENDPOINTS = {
  // Face detection & liveness
  DETECT_FACE: `${BASE_URL}/detect-face`,
  CREATE_TEMPLATE: `${BASE_URL}/create-template`,
  VERIFY_LIVENESS: `${BASE_URL}/verify-liveness`,
  
  // Add more endpoints here as needed
  // UPLOAD_EVENT: `${BASE_URL}/events/upload`,
  // GET_MATCHES: `${BASE_URL}/matches`,
};

/**
 * Get current environment info for debugging
 */
export const getEnvironmentInfo = () => {
  return {
    isDevelopment: __DEV__,
    platform: Platform.OS,
    isEmulator: IS_ANDROID_EMULATOR,
    baseURL: BASE_URL,
    localIP: LOCAL_WIFI_IP,
  };
};

// Log on app start
if (__DEV__) {
  const info = getEnvironmentInfo();
  console.log('🌐 API Environment:', {
    mode: info.isDevelopment ? 'Development' : 'Production',
    platform: info.platform,
    emulator: info.isEmulator,
    baseURL: info.baseURL,
  });
}
