import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

const HostDashboardScreen = () => {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState('Host');
  const [greeting, setGreeting] = useState('Good Morning');
  
  // Stats state
  const [stats, setStats] = useState({
    upcomingEvents: 0,
    totalEvents: 0,
    ticketsSold: 0,
    grossRevenue: 0,
    pendingPayout: 0,
    completedPayouts: 0,
  });

  // Recent activity state
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    loadUserData();
    loadStats();
    loadRecentActivity();
    updateGreeting();
  }, []);

  const loadUserData = async () => {
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;

      const userDoc = await firestore().collection('users').doc(userId).get();
      if (userDoc.exists()) {
        const userData = userDoc.data();
        // Get first name only
        const fullName = userData?.name || 'Host';
        const firstName = fullName.split(' ')[0];
        setUserName(firstName);
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    setLoadingStats(true);
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.log('No user ID, skipping stats load');
        setLoadingStats(false);
        return;
      }

      // Initialize stats with safe defaults
      let upcomingEvents = 0;
      let totalEvents = 0;
      let ticketsSold = 0;
      let grossRevenue = 0;
      let pendingPayout = 0;
      let completedPayouts = 0;

      // 1. Upcoming Events & Total Events
      try {
        const eventsSnapshot = await firestore()
          .collection('events')
          .where('hostAccountId', '==', userId)
          .where('status', '!=', 'draft')
          .get();

        totalEvents = eventsSnapshot.size || 0;

        if (totalEvents > 0) {
          const now = new Date();
          upcomingEvents = eventsSnapshot.docs.filter(doc => {
            const data = doc.data();
            if (!data.startTime || data.status !== 'live') return false;
            const startTime = data.startTime.toDate();
            return startTime > now;
          }).length;
        }
      } catch (error) {
        console.error('Error loading events stats:', error);
        // Continue with other stats even if this fails
      }

      // 2. Tickets Sold & Gross Revenue
      try {
        // Re-fetch events to get IDs (in case previous query failed)
        const eventsSnapshot = await firestore()
          .collection('events')
          .where('hostAccountId', '==', userId)
          .get();

        if (eventsSnapshot.docs.length > 0) {
          try {
            // Query all confirmed bookings for this host directly
            const bookingsSnapshot = await firestore()
              .collection('eventBookings')
              .where('hostAccountId', '==', userId)
              .where('status', '==', 'confirmed')
              .get();

            // Count tickets and sum revenue
            bookingsSnapshot.docs.forEach(doc => {
              const data = doc.data();
              const quantity = data.quantity;
              ticketsSold += (typeof quantity === 'number' && quantity > 0) ? quantity : 1;
            });

            // Get payments for this host directly
            try {
              const paymentsSnapshot = await firestore()
                .collection('payments')
                .where('hostAccountId', '==', userId)
                .where('status', '==', 'paid')
                .get();

              paymentsSnapshot.docs.forEach(doc => {
                const amount = doc.data().amount;
                grossRevenue += (typeof amount === 'number' && amount >= 0) ? amount : 0;
              });
            } catch (paymentError) {
              console.error('Error loading payments:', paymentError);
            }
          } catch (bookingError) {
            console.error('Error loading bookings:', bookingError);
          }
        }
      } catch (error) {
        console.error('Error loading tickets/revenue stats:', error);
      }

      // 3. Pending Payout
      try {
        const pendingSettlementsSnapshot = await firestore()
          .collection('settlements')
          .where('accountId', '==', userId)
          .where('status', '==', 'pending')
          .get();

        pendingPayout = pendingSettlementsSnapshot.docs.reduce((sum, doc) => {
          const netAmount = doc.data().netAmount;
          return sum + ((typeof netAmount === 'number' && netAmount >= 0) ? netAmount : 0);
        }, 0);
      } catch (error) {
        console.error('Error loading pending payouts:', error);
      }

      // 4. Completed Payouts
      try {
        const completedSettlementsSnapshot = await firestore()
          .collection('settlements')
          .where('accountId', '==', userId)
          .where('status', '==', 'completed')
          .get();

        completedPayouts = completedSettlementsSnapshot.docs.reduce((sum, doc) => {
          const netAmount = doc.data().netAmount;
          return sum + ((typeof netAmount === 'number' && netAmount >= 0) ? netAmount : 0);
        }, 0);
      } catch (error) {
        console.error('Error loading completed payouts:', error);
      }

      // Update state with all stats
      setStats({
        upcomingEvents,
        totalEvents,
        ticketsSold,
        grossRevenue,
        pendingPayout,
        completedPayouts,
      });

      console.log('Stats loaded successfully:', {
        upcomingEvents,
        totalEvents,
        ticketsSold,
        grossRevenue,
        pendingPayout,
        completedPayouts,
      });
    } catch (error) {
      console.error('Critical error loading stats:', error);
      // Stats remain at 0 (safe defaults)
    } finally {
      setLoadingStats(false);
    }
  };

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      setGreeting('Good Morning');
    } else if (hour >= 12 && hour < 17) {
      setGreeting('Good Afternoon');
    } else {
      setGreeting('Good Evening');
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadUserData(), loadStats(), loadRecentActivity()]);
    setRefreshing(false);
  };

  const loadRecentActivity = async () => {
    setLoadingActivity(true);
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        console.log('No user ID, skipping activity load');
        setLoadingActivity(false);
        return;
      }

      // Query last 5 ledger entries for this account
      const ledgerSnapshot = await firestore()
        .collection('ledger')
        .where('accountId', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      const activities = ledgerSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: data.type, // "credit" | "debit"
          source: data.source, // "booking" | "refund" | "settlement"
          amount: data.amount || 0,
          description: data.meta?.description || data.meta?.eventTitle || 'Transaction',
          createdAt: data.createdAt,
        };
      });

      setRecentActivity(activities);
      console.log('Recent activity loaded:', activities.length);
    } catch (error) {
      console.error('Error loading recent activity:', error);
      // Keep empty array on error
    } finally {
      setLoadingActivity(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#378BBB" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />
      
      {/* Header with Gradient */}
      <LinearGradient
        colors={['#1B2F48', '#0E1621']}
        style={[styles.header, { paddingTop: insets.top + 20 }]}
      >
        <View style={styles.greetingContainer}>
          <View style={styles.greetingTextContainer}>
            <Text style={styles.greetingText}>{greeting},</Text>
            <Text style={styles.nameText}>{userName} 👋</Text>
          </View>
          <View style={styles.iconCircle}>
            <Ionicons name="storefront" size={28} color="#378BBB" />
          </View>
        </View>
      </LinearGradient>

      {/* Content */}
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#378BBB']}
            tintColor="#378BBB"
            progressBackgroundColor="#1B2F48"
          />
        }
      >
        <View style={styles.welcomeCard}>
          <View style={styles.welcomeIconCircle}>
            <Ionicons name="rocket-outline" size={40} color="#378BBB" />
          </View>
          <Text style={styles.welcomeTitle}>Welcome to Your Dashboard!</Text>
          <Text style={styles.welcomeSubtitle}>
            Manage your events, track earnings, and grow your business all in one place.
          </Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Quick Stats</Text>
          
          <View style={styles.statsGrid}>
            {loadingStats ? (
              // Loading skeleton
              <>
                {[1, 2, 3, 4, 5, 6].map((index) => (
                  <View key={index} style={[styles.statCard, styles.statCardLoading]}>
                    <View style={styles.loadingIconCircle} />
                    <View style={styles.loadingValueLine} />
                    <View style={styles.loadingLabelLine} />
                  </View>
                ))}
              </>
            ) : (
              <>
                {/* Row 1 */}
                <View style={styles.statCard}>
                  <View style={styles.statIconCircle}>
                    <Ionicons name="calendar-outline" size={24} color="#378BBB" />
                  </View>
                  <Text style={styles.statValue}>{stats.upcomingEvents}</Text>
                  <Text style={styles.statLabel}>Upcoming Events</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statIconCircle}>
                    <Ionicons name="calendar" size={24} color="#378BBB" />
                  </View>
                  <Text style={styles.statValue}>{stats.totalEvents}</Text>
                  <Text style={styles.statLabel}>Total Events</Text>
                </View>
                
                {/* Row 2 */}
                <View style={styles.statCard}>
                  <View style={styles.statIconCircle}>
                    <Ionicons name="ticket-outline" size={24} color="#378BBB" />
                  </View>
                  <Text style={styles.statValue}>{stats.ticketsSold}</Text>
                  <Text style={styles.statLabel}>Tickets Sold</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statIconCircle}>
                    <Ionicons name="trending-up" size={24} color="#378BBB" />
                  </View>
                  <Text style={styles.statValue}>₹{stats.grossRevenue.toLocaleString('en-IN')}</Text>
                  <Text style={styles.statLabel}>Gross Revenue</Text>
                </View>
                
                {/* Row 3 */}
                <View style={styles.statCard}>
                  <View style={styles.statIconCircle}>
                    <Ionicons name="time-outline" size={24} color="#FF9500" />
                  </View>
                  <Text style={styles.statValue}>₹{stats.pendingPayout.toLocaleString('en-IN')}</Text>
                  <Text style={styles.statLabel}>Pending Payout</Text>
                </View>
                
                <View style={styles.statCard}>
                  <View style={styles.statIconCircle}>
                    <Ionicons name="checkmark-circle" size={24} color="#34C759" />
                  </View>
                  <Text style={styles.statValue}>₹{stats.completedPayouts.toLocaleString('en-IN')}</Text>
                  <Text style={styles.statLabel}>Completed Payouts</Text>
                </View>
              </>
            )}
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.activityContainer}>
          <Text style={styles.sectionTitle}>Recent Activity</Text>
          
          {loadingActivity ? (
            // Loading skeleton
            <>
              {[1, 2, 3].map((index) => (
                <View key={index} style={[styles.activityRow, styles.activityRowLoading]}>
                  <View style={styles.activityIconLoading} />
                  <View style={styles.activityContentLoading}>
                    <View style={styles.activityTitleLoading} />
                    <View style={styles.activityTimeLoading} />
                  </View>
                  <View style={styles.activityAmountLoading} />
                </View>
              ))}
            </>
          ) : recentActivity.length === 0 ? (
            // Empty state
            <View style={styles.emptyActivity}>
              <View style={{ opacity: 0.3 }}>
                <Ionicons name="receipt-outline" size={40} color="#378BBB" />
              </View>
              <Text style={styles.emptyActivityText}>No recent activity yet</Text>
              <Text style={styles.emptyActivitySubtext}>Your financial activity will appear here</Text>
            </View>
          ) : (
            // Activity list
            recentActivity.map((activity) => {
              const isCredit = activity.type === 'credit';
              const icon = activity.source === 'booking' 
                ? 'ticket-outline' 
                : activity.source === 'settlement' 
                ? 'wallet-outline' 
                : 'arrow-undo-outline';
              const iconColor = activity.source === 'settlement' 
                ? '#34C759' 
                : activity.source === 'refund' 
                ? '#FF9500' 
                : '#378BBB';

              return (
                <View key={activity.id} style={styles.activityRow}>
                  <View style={[styles.activityIcon, { backgroundColor: `${iconColor}20` }]}>
                    <Ionicons name={icon} size={20} color={iconColor} />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{activity.description}</Text>
                    <Text style={styles.activityTime}>
                      {activity.createdAt?.toDate().toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <Text style={[
                    styles.activityAmount,
                    { color: isCredit ? '#34C759' : '#FF5252' }
                  ]}>
                    {isCredit ? '+' : '-'}₹{activity.amount.toLocaleString('en-IN')}
                  </Text>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0E1621',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0E1621',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  greetingContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greetingTextContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(55, 139, 187, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(55, 139, 187, 0.3)',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
  },
  welcomeCard: {
    backgroundColor: '#1B2F48',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.2)',
  },
  welcomeIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(55, 139, 187, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  welcomeSubtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    textAlign: 'center',
    lineHeight: 22,
  },
  statsContainer: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  statCard: {
    width: '48%',
    backgroundColor: '#1B2F48',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.2)',
  },
  statIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(55, 139, 187, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    textAlign: 'center',
  },
  statCardLoading: {
    opacity: 0.5,
  },
  loadingIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
    marginBottom: 12,
  },
  loadingValueLine: {
    width: 60,
    height: 24,
    borderRadius: 4,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
    marginBottom: 4,
  },
  loadingLabelLine: {
    width: 80,
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
  },
  activityContainer: {
    marginBottom: 24,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.2)',
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
  },
  activityAmount: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
  },
  activityRowLoading: {
    opacity: 0.5,
  },
  activityIconLoading: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
    marginRight: 12,
  },
  activityContentLoading: {
    flex: 1,
  },
  activityTitleLoading: {
    width: '70%',
    height: 14,
    borderRadius: 4,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
    marginBottom: 6,
  },
  activityTimeLoading: {
    width: '40%',
    height: 12,
    borderRadius: 4,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
  },
  activityAmountLoading: {
    width: 60,
    height: 16,
    borderRadius: 4,
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
  },
  emptyActivity: {
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.2)',
  },
  emptyActivityText: {
    fontSize: 16,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 4,
  },
  emptyActivitySubtext: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
    textAlign: 'center',
  },
});

export default HostDashboardScreen;
