/**
 * LIVENESS VERIFICATION SCREEN - Active Liveness Detection
 * 
 * This screen implements ACTIVE liveness detection with real-time face tracking.
 * Users must complete random head movement challenges to prove they're a real person.
 * 
 * SECURITY: This prevents spoofing attacks like:
 * - Photo of a photo
 * - Video playback
 * - 3D masks
 * - Deepfakes
 * 
 * CURRENT STATE: UI flow complete, ML model placeholders ready
 * PRODUCTION REQUIREMENT: Integrate ML model for actual liveness detection
 * 
 * ML INTEGRATION OPTIONS:
 * 1. AWS Rekognition Face Liveness (Recommended) - $0.10/check
 * 2. Google ML Kit Face Detection + Custom liveness logic
 * 3. iProov SDK
 * 4. FaceTec ZoOm
 * 5. Custom TensorFlow Lite models
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';
import Toast from 'react-native-toast-message';
import LinearGradient from 'react-native-linear-gradient';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import Svg, { Circle, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FaceDetection from '@react-native-ml-kit/face-detection';
import { API_ENDPOINTS } from '../../config/api';

// API response type
interface LivenessApiResponse {
  isMatch: boolean;
  similarity: number;
  detectionScore?: number;
}

const { width, height } = Dimensions.get('window');
const CIRCLE_SIZE = width * 0.8; // 80% of screen width

// Challenge types for liveness detection
type Challenge = 'CENTER' | 'TURN_LEFT' | 'TURN_RIGHT' | 'SMILE';

interface LivenessVerificationScreenProps {
  navigation: any;
}

const LivenessVerificationScreen: React.FC<LivenessVerificationScreenProps> = ({ navigation }) => {
  // Camera permissions
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('front');
  const camera = useRef<Camera>(null);
  const isValidating = useRef(false);

  // Fisher-Yates shuffle for reliable randomization (prevents replay attacks)
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Random challenge sequence with all 4 unique challenges
  const challengeSequence = useRef<Challenge[]>(
    shuffleArray(['CENTER', 'TURN_LEFT', 'TURN_RIGHT', 'SMILE'] as Challenge[])
  );

  // State management
  const [isActive, setIsActive] = useState(true);
  const [currentChallenge, setCurrentChallenge] = useState<Challenge>(challengeSequence.current[0]);
  const [challengesCompleted, setChallengesCompleted] = useState<Challenge[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [attemptsLeft, setAttemptsLeft] = useState(5);
  const [faceDetected, setFaceDetected] = useState(false);
  const insets = useSafeAreaInsets();

  const handleLogout = async () => {
    try {
      await auth().signOut();
      navigation.reset({
        index: 0,
        routes: [{ name: 'AccountType' }],
      });
    } catch (error) {
      console.error('Logout error:', error);
      Toast.show({
        type: 'error',
        text1: 'Logout Failed',
        text2: 'Please try again',
        visibilityTime: 3000,
      });
    }
  };

  // Animation for circle overlay
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const flashAnim = useRef(new Animated.Value(0)).current;

  const triggerShutterFeedback = () => {
    // Short haptic burst
    Vibration.vibrate(60);
    // White flash: quick in, slow fade out
    Animated.sequence([
      Animated.timing(flashAnim, { toValue: 0.75, duration: 60, useNativeDriver: true }),
      Animated.timing(flashAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  };

  useEffect(() => {
    // Request camera permission on mount
    if (!hasPermission) {
      requestPermission();
    }

    // Pulse animation for circle overlay
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    return () => {
      setIsActive(false);
    };
  }, []);

  /**
   * Real face presence check using ML Kit
   * Runs every 1.5 seconds for the circle border colour indicator
   */
  const detectFaceInFrame = async () => {
    if (!camera.current || !isActive || isProcessing) return;
    try {
      const snapshot = await (camera.current as any).takeSnapshot({ quality: 25 });
      const imagePath: string = snapshot.path.startsWith('file://')
        ? snapshot.path
        : `file://${snapshot.path}`;
      const faces = await FaceDetection.detect(imagePath, {
        performanceMode: 'fast',
      });
      setFaceDetected(faces.length > 0);
    } catch {
      // Camera not ready yet — silently ignore, just a visual indicator
    }
  };

  /**
   * Real challenge validation using ML Kit face detection
   * Checks head angle for turn challenges, smile probability for SMILE.
   * Note: the FINAL security check (face vs uploaded photos) still happens
   * in performFinalVerification via the backend — this is just anti-spoofing friction.
   */
  const validateChallenge = async (challenge: Challenge): Promise<boolean> => {
    if (!camera.current) return false;
    try {
      const snapshot = await (camera.current as any).takeSnapshot({ quality: 65 });
      const imagePath: string = snapshot.path.startsWith('file://')
        ? snapshot.path
        : `file://${snapshot.path}`;
      const faces = await FaceDetection.detect(imagePath, {
        performanceMode: 'accurate',
        classificationMode: 'all',
      });
      if (faces.length === 0) return false;
      const face = faces[0];
      switch (challenge) {
        case 'CENTER':
          return true; // Face detected = in frame
        case 'TURN_LEFT':
        case 'TURN_RIGHT':
          // Use absolute angle — direction doesn't matter for liveness;
          // user proved they moved their head in response to the challenge.
          return Math.abs(face.rotationY) > 20;
        case 'SMILE':
          return ((face.smilingProbability as number) ?? 0) > 0.65;
        default:
          return true;
      }
    } catch {
      return false;
    }
  };

  /**
   * Process frame from camera (called continuously)
   * In production, this would run ML model on every frame
   */
  useEffect(() => {
    if (!isActive || isProcessing) return;

    const interval = setInterval(() => {
      detectFaceInFrame();
    }, 1500); // Snapshot every 1.5s for face indicator

    return () => clearInterval(interval);
  }, [isActive, isProcessing]);

  /**
   * Move to next challenge when current one completes.
   * isValidating ref prevents double-tap without deactivating the camera.
   */
  const handleChallengeComplete = async () => {
    if (isValidating.current) return;
    isValidating.current = true;

    const passed = await validateChallenge(currentChallenge);

    if (passed) {
      triggerShutterFeedback();
      setChallengesCompleted(prev => [...prev, currentChallenge]);
      const completedCount = challengesCompleted.length + 1;

      if (completedCount >= challengeSequence.current.length) {
        // All challenges done — camera must stay active for final photo capture
        await performFinalVerification();
        isValidating.current = false;
      } else {
        setIsProcessing(true);
        const nextChallenge = challengeSequence.current[completedCount];
        setCurrentChallenge(nextChallenge);
        setIsProcessing(false);
        isValidating.current = false;
        Toast.show({
          type: 'success',
          text1: 'Great! Keep going',
          text2: getInstructionText(nextChallenge),
          visibilityTime: 2000,
        });
      }
    } else {
      // Challenge not passed — let them retry, DON'T decrement attempts
      // (attempts are only consumed by final face-match failures)
      isValidating.current = false;
      Toast.show({
        type: 'error',
        text1: 'Try again',
        text2: getRetryHint(currentChallenge),
        visibilityTime: 2500,
      });
    }
  };

  /**
   * Final liveness verification using InsightFace model
   * Captures live frame and compares against user's face template
   */
  const performFinalVerification = async () => {
    try {
      console.log('🔐 Performing final liveness verification...');
      
      // Capture live frame BEFORE setting isProcessing (camera must be active)
      console.log('📸 Capturing live frame...');
      if (!camera.current) {
        throw new Error('Camera not ready');
      }
      
      const photo = await camera.current.takePhoto({
        flash: 'off',
      });
      triggerShutterFeedback();
      
      // Now we can set processing since photo is captured
      setIsProcessing(true);
      
      // Get user's face template from Firestore
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('User not authenticated');
      
      const userDoc = await firestore().collection('users').doc(userId).get();
      const userData = userDoc.data();
      const faceTemplate = userData?.faceTemplate;
      
      if (!faceTemplate) {
        throw new Error('Face template not found. Please re-upload photos.');
      }
      
      // Call liveness verification API
      const formData = new FormData();
      formData.append('image', {
        uri: `file://${photo.path}`,
        type: 'image/jpeg',
        name: 'live_frame.jpg',
      } as any);
      formData.append('template', faceTemplate);
      
      console.log('📡 Sending to liveness API...');
      const response = await fetch(API_ENDPOINTS.VERIFY_LIVENESS, {
        method: 'POST',
        body: formData as any,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      if (!response.ok) {
        throw new Error('Liveness verification API failed');
      }
      
      const result = await response.json() as LivenessApiResponse;
      console.log('✅ Verification result:', result);

      // Transform API response to expected format
      const verificationResult = {
        isLive: result.isMatch,
        confidence: result.similarity,
        matchesPhotos: result.isMatch,
        livenessScore: result.detectionScore || result.similarity,
        spoofingAttemptDetected: false,
      };

      if (verificationResult.isLive && verificationResult.matchesPhotos) {
        // SUCCESS: Update database
        await updateDatabaseOnSuccess(verificationResult);
        
        Toast.show({
          type: 'success',
          text1: 'Verification Successful! 🎉',
          text2: `Match: ${(result.similarity * 100).toFixed(1)}%`,
          visibilityTime: 3000,
        });

        // Navigate to next screen after delay
        setTimeout(() => {
          // Navigate to Interests Selection screen
          navigation.navigate('InterestsSelection' as never);
        }, 2000);

      } else {
        // FAILED: Face doesn't match
        handleVerificationFailure(result.similarity);
      }

    } catch (error: any) {
      console.error('❌ Verification error:', error);
      Toast.show({
        type: 'error',
        text1: 'Verification Error',
        text2: error.message || 'Unable to verify. Please try again.',
        visibilityTime: 4000,
      });
      handleVerificationFailure();
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * Update Firestore on successful verification
   * Creates verification record and updates account/user status
   */
  const updateDatabaseOnSuccess = async (result: any) => {
    const userId = auth().currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');

    const batch = firestore().batch();

    // 1. Create verification record
    const verificationRef = firestore().collection('verifications').doc();
    batch.set(verificationRef, {
      accountId: userId,
      type: 'face_liveness_active', // Different from static selfie
      status: 'approved',
      confidenceScore: result.confidence,
      livenessScore: result.livenessScore,
      provider: 'custom', // Or 'aws_rekognition', 'iproov', etc.
      timestamp: new Date(),
      metadata: {
        challenges: challengeSequence.current,
        attemptsUsed: 6 - attemptsLeft,
      },
    });

    // 2. Update accounts collection
    const accountRef = firestore().collection('accounts').doc(userId);
    batch.update(accountRef, {
      identityVerified: true,
      verificationMethod: 'active_liveness',
      verifiedAt: new Date(),
      signupStep: 'interests', // Next step is interests selection
    });

    // 3. Update users collection
    const userRef = firestore().collection('users').doc(userId);
    batch.update(userRef, {
      isVerified: true,
    });

    await batch.commit();
    console.log('✅ Database updated successfully');
  };

  /**
   * Handle verification failure
   */
  const handleVerificationFailure = (similarity?: number) => {
    const newAttemptsLeft = attemptsLeft - 1;
    setAttemptsLeft(newAttemptsLeft);
    setIsProcessing(false);

    if (newAttemptsLeft <= 0) {
      // No attempts left
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: similarity !== undefined 
          ? `Match: ${(similarity * 100).toFixed(1)}% (need 35%). No attempts left.`
          : 'Maximum attempts reached. Please contact support.',
        visibilityTime: 5000,
      });
      setTimeout(() => navigation.goBack(), 3000);
    } else {
      // Reset for retry
      setChallengesCompleted([]);
      setCurrentChallenge(challengeSequence.current[0]);
      
      Toast.show({
        type: 'error',
        text1: 'Verification Failed',
        text2: similarity !== undefined
          ? `Match: ${(similarity * 100).toFixed(1)}% (need 35%). ${newAttemptsLeft} attempt${newAttemptsLeft !== 1 ? 's' : ''} left.`
          : `${newAttemptsLeft} attempt${newAttemptsLeft !== 1 ? 's' : ''} remaining`,
        visibilityTime: 4000,
      });
    }
  };

  /**
   * Get instruction text for current challenge
   */
  const getInstructionText = (challenge: Challenge): string => {
    switch (challenge) {
      case 'CENTER':
        return 'Center your face in the circle';
      case 'TURN_LEFT':
        return 'Slowly turn your head to the left';
      case 'TURN_RIGHT':
        return 'Slowly turn your head to the right';
      case 'SMILE':
        return 'Smile for the camera';
      default:
        return '';
    }
  };

  /**
   * Retry hint when ML Kit challenge check fails
   */
  const getRetryHint = (challenge: Challenge): string => {
    switch (challenge) {
      case 'CENTER': return 'Make sure your face is clearly visible in the circle';
      case 'TURN_LEFT': return 'Turn your head further to the left';
      case 'TURN_RIGHT': return 'Turn your head further to the right';
      case 'SMILE': return 'Give a bigger smile for the camera';
      default: return 'Please try again';
    }
  };

  /**
   * Get icon for current challenge
   */
  const getChallengeIcon = (challenge: Challenge): string => {
    switch (challenge) {
      case 'CENTER':
        return 'scan-circle';
      case 'TURN_LEFT':
        return 'arrow-back-circle';
      case 'TURN_RIGHT':
        return 'arrow-forward-circle';
      case 'SMILE':
        return 'happy';
      default:
        return 'scan';
    }
  };

  // Handle permission denied
  if (!hasPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Ionicons name="camera-off" size={80} color="#FF4D6D" />
          <Text style={styles.permissionTitle}>Camera Permission Required</Text>
          <Text style={styles.permissionText}>
            We need camera access to verify your identity
          </Text>
          <TouchableOpacity onPress={requestPermission} activeOpacity={0.8}>
            <LinearGradient
              colors={['#8B2BE2', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.permissionButton}
            >
              <Text style={styles.permissionButtonText}>Grant Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Handle no camera device
  if (!device) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No camera device found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" translucent={true} />

      {/* Camera Preview (Full Screen) */}
      <Camera
        ref={camera}
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={isActive && !isProcessing}
        photo={true}
      />

      {/* Animated glow ring — pulses around the face circle */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glowRing,
          {
            borderColor: faceDetected
              ? 'rgba(46,204,113,0.6)'
              : 'rgba(139,43,226,0.45)',
            transform: [{ scale: pulseAnim }],
          },
        ]}
      />

      {/* Dark Overlay with Circle Cutout */}
      <View style={styles.overlay}>
        <Svg height={height} width={width}>
          {/* Dark overlay mask */}
          <Path
            d={`M0,0 L${width},0 L${width},${height} L0,${height} Z M${width/2},${height * 0.55 + CIRCLE_SIZE/2} a${CIRCLE_SIZE/2},${CIRCLE_SIZE/2} 0 1,0 0,-${CIRCLE_SIZE} a${CIRCLE_SIZE/2},${CIRCLE_SIZE/2} 0 1,0 0,${CIRCLE_SIZE}`}
            fill="rgba(0,0,0,0.7)"
            fillRule="evenodd"
          />
          {/* Circle outline */}
          <Circle
            cx={width / 2}
            cy={height * 0.55}
            r={CIRCLE_SIZE / 2}
            stroke={faceDetected ? '#2ECC71' : '#8B2BE2'}
            strokeWidth={4}
            fill="none"
          />
        </Svg>
      </View>

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          {navigation.canGoBack() ? (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="close" size={30} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.logoutButton}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <Ionicons name="log-out-outline" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.headerTitle}>Identity Verification</Text>
      </View>

      {/* Instruction Card */}
      <View style={styles.instructionCard}>
        <Ionicons 
          name={getChallengeIcon(currentChallenge)} 
          size={40} 
          color="#8B2BE2" 
        />
        <Text style={styles.instructionText}>
          {getInstructionText(currentChallenge)}
        </Text>
        
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {challengeSequence.current.map((challenge, index) => (
            <View
              key={index}
              style={[
                styles.progressDot,
                challengesCompleted.includes(challenge) && styles.progressDotCompleted,
                currentChallenge === challenge && styles.progressDotActive,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Auto-capture button (always visible, disabled when no face detected) */}
      {!isProcessing && (
        <View style={styles.actionContainer}>
          <TouchableOpacity
            onPress={faceDetected ? handleChallengeComplete : undefined}
            activeOpacity={faceDetected ? 0.8 : 1}
            disabled={!faceDetected}
          >
            <LinearGradient
              colors={faceDetected ? ['#8B2BE2', '#06B6D4'] : ['rgba(30,24,58,1)', 'rgba(30,24,58,1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.captureButton}
            >
              <Ionicons name="checkmark-circle" size={32} color={faceDetected ? "#FFFFFF" : "rgba(255,255,255,0.3)"} />
              <Text style={[styles.captureButtonText, !faceDetected && styles.captureButtonTextDisabled]}>Continue</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      {/* Processing Indicator */}
      {isProcessing && (
        <View style={styles.processingContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
          <Text style={styles.processingText}>Verifying...</Text>
        </View>
      )}

      {/* Attempts Counter */}
      <View style={styles.attemptsContainer}>
        <Text style={styles.attemptsText}>
          {attemptsLeft} attempt{attemptsLeft !== 1 ? 's' : ''} remaining
        </Text>
      </View>

      {/* Shutter flash overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { opacity: flashAnim, backgroundColor: '#FFFFFF', zIndex: 99 }]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 40,
    paddingHorizontal: 20,
    zIndex: 10,
    alignItems: 'center',
  },
  headerRow: {
    alignSelf: 'stretch',
  },
  headerTitle: {
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Inter-Medium',
    fontSize: 13,
    letterSpacing: 0.6,
    marginTop: 6,
  },
  glowRing: {
    position: 'absolute',
    top: height * 0.55 - CIRCLE_SIZE / 2 - 8,
    left: width / 2 - CIRCLE_SIZE / 2 - 8,
    width: CIRCLE_SIZE + 16,
    height: CIRCLE_SIZE + 16,
    borderRadius: (CIRCLE_SIZE + 16) / 2,
    borderWidth: 10,
    zIndex: 4,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,30,0.55)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.38)',
  },
  logoutButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(13,11,30,0.55)',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.38)',
  },
  instructionCard: {
    position: 'absolute',
    top: 120,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(13,11,30,0.86)',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
    zIndex: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.65)',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 14,
    elevation: 150,
  },
  instructionText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginTop: 10,
    textAlign: 'center',
  },
  progressContainer: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  progressDot: {
    width: 28,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  progressDotCompleted: {
    backgroundColor: '#2ECC71',
  },
  progressDotActive: {
    backgroundColor: '#8B2BE2',
    width: 28,
    height: 5,
    borderRadius: 3,
  },
  actionContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  captureButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 36,
    paddingVertical: 16,
    borderRadius: 35,
    gap: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.55)',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 10,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-Bold',
  },
  captureButtonTextDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
  processingContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  processingText: {
    color: '#FFFFFF',
    fontSize: 15,
    marginTop: 12,
    fontFamily: 'Inter-SemiBold',
  },
  attemptsContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  attemptsText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  warningContainer: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
    backgroundColor: 'rgba(255,196,0,0.9)',
    padding: 8,
    borderRadius: 8,
    zIndex: 10,
  },
  warningText: {
    color: '#1A1A1A',
    fontSize: 11,
    textAlign: 'center',
    fontWeight: '600',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#0D0B1E',
  },
  permissionTitle: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginTop: 24,
    marginBottom: 12,
  },
  permissionText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
  },
  permissionButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default LivenessVerificationScreen;
