import { getApp } from '@react-native-firebase/app';
import { initializeAppCheck, getAppCheckToken } from '@react-native-firebase/app-check';

/**
 * Initialize Firebase App Check with Play Integrity
 * This eliminates reCAPTCHA browser redirects during phone auth
 */
export const initializeAppCheckService = async () => {
  try {
    const app = getApp();
    
    // Initialize with Play Integrity provider
    await initializeAppCheck(app, {
      provider: 'playIntegrity',
      isTokenAutoRefreshEnabled: true,
    });
    
    // Get a token to verify it's working
    const { token } = await getAppCheckToken();
    
    if (token) {
      console.log('✅ Firebase App Check initialized successfully');
    }
  } catch (error: any) {
    // App Check is optional - app will fallback to reCAPTCHA if it fails
    console.warn('⚠️ App Check initialization failed:', error.message);
    console.warn('📱 App will use reCAPTCHA for verification');
  }
};
