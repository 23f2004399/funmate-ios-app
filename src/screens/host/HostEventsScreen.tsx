import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  TextInput,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

type EventStatus = 'draft' | 'live' | 'ended' | 'cancelled';

type FilterChip = 'all' | EventStatus;

type EventItem = {
  id: string;
  title: string;
  category: string;
  startTime: any;          // Firestore Timestamp
  endTime: any;
  status: EventStatus;
  price: number;
  capacity: { total: number | null; booked: number };
  media: { type: 'image' | 'video'; url: string }[];
  location: string;        // "venue, address"
};

// ─── Constants ───────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<EventStatus, { label: string; color: string; bg: string; icon: string }> = {
  draft:     { label: 'Draft',     color: '#B8C7D9', bg: 'rgba(184,199,217,0.18)', icon: 'document-outline' },
  live:      { label: 'Live',      color: '#34C759', bg: 'rgba(52,199,89,0.18)',   icon: 'radio-button-on' },
  ended:     { label: 'Ended',     color: '#7F93AA', bg: 'rgba(127,147,170,0.18)', icon: 'checkmark-circle-outline' },
  cancelled: { label: 'Cancelled', color: '#FF5252', bg: 'rgba(255,82,82,0.18)',   icon: 'close-circle-outline' },
};

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'all',       label: 'All' },
  { id: 'draft',     label: 'Draft' },
  { id: 'live',      label: 'Live' },
  { id: 'ended',     label: 'Ended' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatEventDate = (timestamp: any): string => {
  if (!timestamp) return '';
  try {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const day  = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' });
    const time = date.toLocaleTimeString('en-IN', { hour: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' });
    return `${day} · ${time}`;
  } catch { return ''; }
};

const formatRevenue = (n: number): string =>
  `₹${n.toLocaleString('en-IN')}`;

const getBanner = (media: EventItem['media']): string | null =>
  (media ?? []).find(m => m.type === 'image')?.url ?? null;

// ─── Screen ──────────────────────────────────────────────────────────────────

const HostEventsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [allEvents, setAllEvents]       = useState<EventItem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [searchText, setSearchText]     = useState('');
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');

  // ── Derived filtered list ──────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = allEvents;
    // chip filter — "ended" chip also catches cancelled
    if (activeFilter !== 'all') {
      if (activeFilter === 'ended') {
        list = list.filter(e => e.status === 'ended' || e.status === 'cancelled');
      } else {
        list = list.filter(e => e.status === activeFilter);
      }
    }
    // search filter
    const q = searchText.trim().toLowerCase();
    if (q) list = list.filter(e => e.title.toLowerCase().includes(q));
    return list;
  }, [allEvents, activeFilter, searchText]);

  // ── Firestore ─────────────────────────────────────────────────────────────
  const loadEvents = async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) return;
      const snap = await firestore()
        .collection('events')
        .where('hostAccountId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      const data: EventItem[] = snap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<EventItem, 'id'>),
      }));
      setAllEvents(data);
    } catch (err) {
      console.error('loadEvents error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(useCallback(() => { loadEvents(); }, []));

  const onRefresh = () => { setRefreshing(true); loadEvents(false); };

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderEvent = ({ item }: { item: EventItem }) => {
    const cfg     = STATUS_CONFIG[item.status] ?? STATUS_CONFIG.draft;
    const booked  = item.capacity?.booked ?? 0;
    const total   = item.capacity?.total;
    const isFree  = !item.price || item.price === 0;
    const revenue = isFree ? 0 : item.price * booked;
    const ticketsText = total ? `${booked} / ${total} tickets` : `${booked} tickets sold`;
    const bannerUri   = getBanner(item.media);

    return (
      <View style={styles.card}>
        {/* ── Banner ── */}
        <View style={styles.bannerContainer}>
          {bannerUri ? (
            <Image source={{ uri: bannerUri }} style={styles.bannerImage} resizeMode="cover" />
          ) : (
            <View style={styles.bannerPlaceholder}>
              <Ionicons name="image-outline" size={36} color="#2E4A63" />
            </View>
          )}
          {/* status badge over banner */}
          <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
            <Ionicons name={cfg.icon as any} size={11} color={cfg.color} />
            <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        </View>

        {/* ── Card Body ── */}
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>

          {/* date */}
          {!!item.startTime && (
            <View style={styles.infoRow}>
              <Ionicons name="calendar-outline" size={14} color="#506A85" />
              <Text style={styles.infoText}>{formatEventDate(item.startTime)}</Text>
            </View>
          )}

          {/* location */}
          {!!item.location && (
            <View style={styles.infoRow}>
              <Ionicons name="location-outline" size={14} color="#506A85" />
              <Text style={styles.infoText} numberOfLines={1}>{item.location}</Text>
            </View>
          )}

          {/* tickets + revenue row */}
          <View style={styles.statsRow}>
            <View style={styles.statChip}>
              <Ionicons name="ticket-outline" size={13} color="#378BBB" />
              <Text style={styles.statText}>{ticketsText}</Text>
            </View>
            {!isFree && (
              <View style={styles.statChip}>
                <Ionicons name="trending-up-outline" size={13} color="#34C759" />
                <Text style={[styles.statText, { color: '#34C759' }]}>{formatRevenue(revenue)}</Text>
              </View>
            )}
            {isFree && (
              <View style={styles.statChip}>
                <Ionicons name="gift-outline" size={13} color="#378BBB" />
                <Text style={styles.statText}>Free Event</Text>
              </View>
            )}
          </View>

          {/* Manage button */}
          <TouchableOpacity
            style={styles.manageButton}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('ManageEvent', {
              eventId: item.id,
              eventTitle: item.title,
              eventStatus: item.status,
            })}
          >
            <Text style={styles.manageButtonText}>Manage</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <Ionicons name="calendar-outline" size={48} color="#378BBB" />
      </View>
      <Text style={styles.emptyTitle}>No Events Found</Text>
      <Text style={styles.emptySubtitle}>
        {searchText || activeFilter !== 'all'
          ? 'Try a different search or filter.'
          : 'Create your first event and start selling tickets.'}
      </Text>
      {!searchText && activeFilter === 'all' && (
        <TouchableOpacity
          style={styles.emptyCreateBtn}
          onPress={() => navigation.navigate('CreateEventStep1')}
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color="#FFFFFF" />
          <Text style={styles.emptyCreateText}>Create First Event</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.headerTitle}>Events</Text>
        <TouchableOpacity
          style={styles.createButton}
          onPress={() => navigation.navigate('CreateEventStep1')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.createButtonText}>Create</Text>
        </TouchableOpacity>
      </View>

      {/* ── Search Bar ── */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color="#506A85" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search events…"
          placeholderTextColor="#506A85"
          value={searchText}
          onChangeText={setSearchText}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => setSearchText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color="#506A85" />
          </TouchableOpacity>
        )}
      </View>

      {/* ── Filter Chips ── */}
      <View style={styles.chipRow}>
        {FILTER_CHIPS.map(chip => {
          const active = activeFilter === chip.id;
          return (
            <TouchableOpacity
              key={chip.id}
              style={[styles.chip, active && styles.chipActive]}
              onPress={() => setActiveFilter(chip.id)}
              activeOpacity={0.75}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#378BBB" />
          <Text style={styles.loadingText}>Loading events…</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          renderItem={renderEvent}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
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
        />
      )}
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 14, backgroundColor: '#0E1621',
  },
  headerTitle: { fontSize: 28, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  createButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#FF4D6D', borderRadius: 22,
    paddingHorizontal: 14, paddingVertical: 8,
  },
  createButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  // search
  searchContainer: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginBottom: 12,
    backgroundColor: '#1B2F48',
    borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#FFFFFF', padding: 0,
  },

  // chips
  chipRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 16, marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.25)',
    backgroundColor: 'transparent',
  },
  chipActive: {
    backgroundColor: '#FF4D6D', borderColor: '#FF4D6D',
  },
  chipText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#506A85' },
  chipTextActive: { color: '#FFFFFF' },

  // loading / list
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#506A85' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24, gap: 16 },
  listContentEmpty: { flexGrow: 1 },

  // card
  card: {
    backgroundColor: '#1B2F48', borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
  },
  bannerContainer: { position: 'relative', height: 160, backgroundColor: '#132232' },
  bannerImage: { width: '100%', height: '100%' },
  bannerPlaceholder: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#132232',
  },
  statusBadge: {
    position: 'absolute', top: 10, right: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontFamily: 'Inter-SemiBold' },
  cardBody: { padding: 16, gap: 8 },
  cardTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#FFFFFF', lineHeight: 23 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#B8C7D9', flex: 1 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  statChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(55,139,187,0.1)',
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  statText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  manageButton: {
    marginTop: 4,
    borderWidth: 1.5, borderColor: '#378BBB',
    borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  manageButtonText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#378BBB' },

  // empty
  emptyState: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 16 },
  emptyIconWrap: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(55,139,187,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'rgba(55,139,187,0.2)',
  },
  emptyTitle: { fontSize: 22, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  emptySubtitle: {
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#B8C7D9',
    textAlign: 'center', lineHeight: 22,
  },
  emptyCreateBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FF4D6D', borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 28, marginTop: 8,
  },
  emptyCreateText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
});

export default HostEventsScreen;
