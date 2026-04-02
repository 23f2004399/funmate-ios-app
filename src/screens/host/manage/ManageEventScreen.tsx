import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import OverviewTab   from './tabs/OverviewTab';
import AttendeesTab  from './tabs/AttendeesTab';
import CheckInTab    from './tabs/CheckInTab';
import ChatTab       from './tabs/ChatTab';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventStatus = 'draft' | 'live' | 'ended' | 'cancelled';

type TabId = 'overview' | 'attendees' | 'checkin' | 'chat';

const TAB_LIST: { id: TabId; label: string }[] = [
  { id: 'overview',   label: 'Overview'  },
  { id: 'attendees',  label: 'Attendees' },
  { id: 'checkin',    label: 'Check-In'  },
  { id: 'chat',       label: 'Chat'      },
];

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string }> = {
  draft:     { label: 'Draft',     color: '#B8C7D9', bg: 'rgba(184,199,217,0.18)' },
  live:      { label: 'Live',      color: '#34C759', bg: 'rgba(52,199,89,0.18)'   },
  ended:     { label: 'Ended',     color: '#7F93AA', bg: 'rgba(127,147,170,0.18)' },
  cancelled: { label: 'Cancelled', color: '#FF5252', bg: 'rgba(255,82,82,0.18)'   },
};

// ─── Screen ──────────────────────────────────────────────────────────────────

const ManageEventScreen = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const {
    eventId,
    eventTitle,
    eventStatus: initialStatus,
  }: { eventId: string; eventTitle: string; eventStatus: EventStatus } = route.params;

  const [activeTab,     setActiveTab]     = useState<TabId>('overview');
  const [currentStatus, setCurrentStatus] = useState<EventStatus>(initialStatus);

  const cfg = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG.draft;

  // ── Tab content switch ────────────────────────────────────────────────────
  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':  return <OverviewTab  eventId={eventId} eventStatus={currentStatus} onStatusChange={setCurrentStatus} />;
      case 'attendees': return <AttendeesTab eventId={eventId} />;
      case 'checkin':   return <CheckInTab   eventId={eventId} />;
      case 'chat':      return <ChatTab      eventId={eventId} />;
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <Text style={styles.headerTitle} numberOfLines={1}>{eventTitle}</Text>

        {/* Status badge */}
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {/* ── Tab Bar ── */}
      <View style={styles.tabBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabBarContent}
        >
          {TAB_LIST.map(tab => {
            const active = activeTab === tab.id;
            return (
              <TouchableOpacity
                key={tab.id}
                style={[styles.tabItem, active && styles.tabItemActive]}
                onPress={() => setActiveTab(tab.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                  {tab.label}
                </Text>
                {active && <View style={styles.tabUnderline} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        <View style={styles.tabBarBorder} />
      </View>

      {/* ── Tab Content ── */}
      <View style={styles.tabContent}>
        {renderTabContent()}
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },

  // header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
    backgroundColor: '#0E1621',
  },
  backButton: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(55,139,187,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFFFFF',
  },
  statusBadge: {
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  statusText: { fontSize: 12, fontFamily: 'Inter-SemiBold' },

  // tab bar
  tabBarWrapper: { backgroundColor: '#0E1621' },
  tabBarContent: { paddingHorizontal: 16, gap: 4 },
  tabBarBorder: {
    height: 1,
    backgroundColor: 'rgba(55,139,187,0.15)',
    marginHorizontal: 0,
  },
  tabItem: {
    paddingHorizontal: 16, paddingVertical: 10,
    position: 'relative', alignItems: 'center',
  },
  tabItemActive: {},
  tabLabel: {
    fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#506A85',
  },
  tabLabelActive: { color: '#FFFFFF' },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 8, right: 8,
    height: 2, borderRadius: 2,
    backgroundColor: '#FF4D6D',
  },

  // content area
  tabContent: { flex: 1 },
});

export default ManageEventScreen;
