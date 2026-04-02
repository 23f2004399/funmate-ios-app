/**
 * SUSPENSION BANNER
 * 
 * Shows a banner to suspended users explaining their account status
 * Prevents them from swiping, messaging, or taking actions
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

interface SuspensionBannerProps {
  onSuspensionStatusChange?: (isSuspended: boolean) => void;
}

export const SuspensionBanner: React.FC<SuspensionBannerProps> = ({
  onSuspensionStatusChange,
}) => {
  const [isSuspended, setIsSuspended] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [suspensionReason, setSuspensionReason] = useState<string>('');

  const currentUserId = auth().currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) {
      setIsLoading(false);
      return;
    }

    // Listen to account status changes
    const unsubscribeAccount = firestore()
      .collection('accounts')
      .where('authUid', '==', currentUserId)
      .limit(1)
      .onSnapshot((snapshot) => {
        if (snapshot.empty) {
          setIsSuspended(false);
          setIsLoading(false);
          onSuspensionStatusChange?.(false);
          return;
        }

        const accountData = snapshot.docs[0].data();
        const suspended = accountData.status === 'suspended';
        setIsSuspended(suspended);
        setIsLoading(false);
        onSuspensionStatusChange?.(suspended);

        if (suspended) {
          // Fetch suspension details
          fetchSuspensionDetails();
        }
      });

    return () => unsubscribeAccount();
  }, [currentUserId]);

  const fetchSuspensionDetails = async () => {
    if (!currentUserId) return;

    try {
      const suspensionSnapshot = await firestore()
        .collection('accountSuspensions')
        .where('userId', '==', currentUserId)
        .where('status', '==', 'active')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      if (!suspensionSnapshot.empty) {
        const suspension = suspensionSnapshot.docs[0].data();
        
        if (suspension.reason === 'auto_suspend_reports') {
          setSuspensionReason(
            `Your account has been temporarily suspended due to multiple reports (${suspension.reportCount} reports). Our team is reviewing your account.`
          );
        } else {
          setSuspensionReason(
            'Your account has been suspended. Please contact support for more information.'
          );
        }
      }
    } catch (error) {
      console.error('Error fetching suspension details:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#E94057" />
      </View>
    );
  }

  if (!isSuspended) {
    return null;
  }

  return (
    <View style={styles.banner}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>⚠️</Text>
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.title}>Account Temporarily Suspended</Text>
        <Text style={styles.message}>
          {suspensionReason ||
            'Your account is under review. You cannot perform actions until this is resolved.'}
        </Text>
        <Text style={styles.contact}>
          Contact support: support@funmate.app
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    padding: 8,
    alignItems: 'center',
  },
  banner: {
    backgroundColor: '#FFF3CD',
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    margin: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    marginRight: 12,
  },
  icon: {
    fontSize: 28,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#856404',
    marginBottom: 6,
  },
  message: {
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
    marginBottom: 8,
  },
  contact: {
    fontSize: 13,
    color: '#856404',
    fontWeight: '600',
  },
});

/**
 * USAGE IN APP
 * 
 * Add to your main app screens (SwipeScreen, MyHub, etc.):
 */

/*
import { SuspensionBanner } from '../components/banners/SuspensionBanner';

const SwipeScreen = () => {
  const [isSuspended, setIsSuspended] = useState(false);

  return (
    <View style={{ flex: 1 }}>
      <SuspensionBanner onSuspensionStatusChange={setIsSuspended} />
      
      {isSuspended ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text>Your account is suspended.</Text>
        </View>
      ) : (
        // Normal swipe UI
        <SwipeCards />
      )}
    </View>
  );
};
*/
