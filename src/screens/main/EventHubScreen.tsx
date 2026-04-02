/**
 * EVENT HUB SCREEN — Phase E1
 *
 * Browse, search and filter published events.
 * Tapping a card navigates to EventDetailScreen.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore, {
  FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import LinearGradient from 'react-native-linear-gradient';

// ─── Types ────────────────────────────────────────────────────────────────────

type EventDoc = {
  id: string;
  title: string;
  description: string;
  category: string;
  tags: string[];
  media: { type: 'image' | 'video'; url: string }[];
  location: string;
  startTime: FirebaseFirestoreTypes.Timestamp;
  endTime: FirebaseFirestoreTypes.Timestamp;
  price: number;
  capacity: { total: number | null; booked: number };
  hostAccountId: string;
  status: string;
  visibility: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Music',
  'Sports',
  'Food & Drinks',
  'Nightlife',
  'Art & Culture',
  'Comedy',
  'Tech',
  'Fitness',
  'Fashion',
  'Gaming',
  'Travel',
  'Business',
  'Social',
  'Other',
];

type PriceFilter = 'Any' | 'Free' | 'Paid';
type DateFilter  = 'Any' | 'Today' | 'This Week' | 'This Month';

const PAGE_SIZE = 20;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (ts: FirebaseFirestoreTypes.Timestamp): string => {
  try {
    const d = ts.toDate();
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined,
    });
  } catch {
    return '';
  }
};

const fmtTime = (ts: FirebaseFirestoreTypes.Timestamp): string => {
  try {
    return ts.toDate().toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
};

const startOfDay    = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek   = (d: Date) => { const r = startOfDay(d); r.setDate(r.getDate() - r.getDay()); return r; };
const startOfMonth  = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

const passesDateFilter = (ts: FirebaseFirestoreTypes.Timestamp, filter: DateFilter): boolean => {
  if (filter === 'Any') return true;
  const d = ts.toDate();
  const now = new Date();
  if (filter === 'Today')     return d >= startOfDay(now) && d < new Date(startOfDay(now).getTime() + 86400000);
  if (filter === 'This Week') return d >= startOfWeek(now);
  if (filter === 'This Month')return d >= startOfMonth(now);
  return true;
};

// ─── Event Card ───────────────────────────────────────────────────────────────

const EventCard = React.memo(({ event, onPress }: { event: EventDoc; onPress: () => void }) => {
  const coverUrl = event.media?.find(m => m.type === 'image')?.url ?? null;
  const isFree   = !event.price || event.price === 0;
  const isFull   = event.capacity.total != null && event.capacity.booked >= event.capacity.total;

  return (
    <TouchableOpacity style={cardStyles.card} onPress={onPress} activeOpacity={0.88}>
      {/* Cover image */}
      <View style={cardStyles.imageWrap}>
        {coverUrl ? (
          <Image source={{ uri: coverUrl }} style={cardStyles.image} resizeMode="cover" />
        ) : (
          <View style={cardStyles.imagePlaceholder}>
            <Ionicons name="calendar-outline" size={36} color="#3A5068" />
          </View>
        )}
        {/* Price chip */}
        <View style={[cardStyles.priceChip, isFree && cardStyles.priceChipFree]}>
          <Text style={[cardStyles.priceChipText, isFree && cardStyles.priceChipTextFree]}>
            {isFree ? 'Free' : `₹${event.price}`}
          </Text>
        </View>
        {/* Sold out overlay */}
        {isFull && (
          <View style={cardStyles.soldOutOverlay}>
            <Text style={cardStyles.soldOutText}>SOLD OUT</Text>
          </View>
        )}
      </View>

      {/* Details */}
      <View style={cardStyles.details}>
        {/* Category chip */}
        {event.category ? (
          <View style={cardStyles.categoryChip}>
            <Text style={cardStyles.categoryChipText}>{event.category}</Text>
          </View>
        ) : null}

        <Text style={cardStyles.title} numberOfLines={2}>{event.title}</Text>

        <View style={cardStyles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color="#506A85" />
          <Text style={cardStyles.metaText}>
            {fmtDate(event.startTime)}  ·  {fmtTime(event.startTime)}
          </Text>
        </View>

        <View style={cardStyles.metaRow}>
          <Ionicons name="location-outline" size={13} color="#506A85" />
          <Text style={cardStyles.metaText} numberOfLines={1}>{event.location || '—'}</Text>
        </View>

        {/* Capacity bar */}
        {event.capacity.total != null && (
          <View style={cardStyles.capacityRow}>
            <View style={cardStyles.capacityBarBg}>
              <View
                style={[
                  cardStyles.capacityBarFill,
                  {
                    width: `${Math.min(100, (event.capacity.booked / event.capacity.total) * 100)}%` as any,
                    backgroundColor: isFull ? '#FF5252' : '#8B2BE2',
                  },
                ]}
              />
            </View>
            <Text style={cardStyles.capacityLabel}>
              {event.capacity.booked}/{event.capacity.total} spots
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: '#1A1530',
    borderRadius: 20,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  imageWrap: {
    height: 180,
    backgroundColor: '#0E1F30',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  priceChip: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(13,11,30,0.78)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  priceChipFree: {
    borderColor: 'rgba(139,92,246,0.25)',
    backgroundColor: 'rgba(13,11,30,0.78)',
  },
  priceChipText: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  priceChipTextFree: {
    color: '#FFFFFF',
  },
  soldOutOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  soldOutText: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FF5252',
    letterSpacing: 2,
  },
  details: {
    padding: 14,
  },
  categoryChip: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  categoryChipText: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    flex: 1,
  },
  capacityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  capacityBarBg: {
    flex: 1,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  capacityBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  capacityLabel: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    minWidth: 64,
    textAlign: 'right',
  },
});

// ─── Modal Chip ───────────────────────────────────────────────────────────────

const ModalChip = React.memo(({ label, active, onPress }: {
  label: string; active: boolean; onPress: () => void;
}) => (
  <TouchableOpacity
    style={[chipStyles.chip, active && chipStyles.chipActive]}
    onPress={onPress}
    activeOpacity={0.75}
  >
    <Text style={[chipStyles.text, active && chipStyles.textActive]}>{label}</Text>
  </TouchableOpacity>
));

const chipStyles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderColor: '#8B2BE2',
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255,255,255,0.55)',
  },
  textActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const EventHubScreen = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // ── Raw fetched data + pagination ──
  const [events,      setEvents]      = useState<EventDoc[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore,     setHasMore]     = useState(true);
  const lastDocRef = useRef<FirebaseFirestoreTypes.QueryDocumentSnapshot | null>(null);

  // ── Committed filters (applied to the list) ──
  const [search,    setSearch]    = useState('');
  const [category,  setCategory]  = useState('All');
  const [price,     setPrice]     = useState<PriceFilter>('Any');
  const [priceMax,  setPriceMax]  = useState<number>(0);
  const [dateF,     setDateF]     = useState<DateFilter>('Any');

  // ── Draft filters inside modal (pending until Apply) ──
  const [modalVisible,      setModalVisible]      = useState(false);
  const [draftCategory,     setDraftCategory]     = useState('All');
  const [draftPrice,        setDraftPrice]        = useState<PriceFilter>('Any');
  const [draftPriceMax,     setDraftPriceMax]     = useState<number>(0);
  const [draftDate,         setDraftDate]         = useState<DateFilter>('Any');

  // ── Dynamic max price derived from fetched events ──
  const maxEventPrice = useMemo(
    () => Math.max(0, ...events.map(e => e.price ?? 0)),
    [events],
  );

  // Seed price state once on first load; never silently reset user's committed filter
  const priceInitialized = useRef(false);
  useEffect(() => {
    if (!priceInitialized.current && maxEventPrice > 0) {
      setPriceMax(maxEventPrice);
      setDraftPriceMax(maxEventPrice);
      priceInitialized.current = true;
    } else if (priceInitialized.current) {
      // Only keep draft ceiling in sync; leave committed priceMax alone
      setDraftPriceMax(prev => Math.max(prev, maxEventPrice));
    }
  }, [maxEventPrice]);

  // ── Active filter count (for badge) ──
  const activeFilterCount = [
    category !== 'All',
    price !== 'Any',
    dateF !== 'Any',
  ].filter(Boolean).length;

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const buildQuery = useCallback(() => {
    const now = firestore.Timestamp.now();
    return firestore()
      .collection('events')
      .where('status', '==', 'live')
      .where('startTime', '>', now)
      .orderBy('startTime', 'asc')
      .limit(PAGE_SIZE);
  }, []);

  const fetchEvents = useCallback(async (cursor: FirebaseFirestoreTypes.QueryDocumentSnapshot | null = null) => {
    let q = buildQuery();
    if (cursor) q = (q as any).startAfter(cursor);
    const snap = await q.get();
    const docs = snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<EventDoc, 'id'>) }));
    lastDocRef.current = snap.docs[snap.docs.length - 1] ?? null;
    setHasMore(snap.docs.length === PAGE_SIZE);
    return docs;
  }, [buildQuery]);

  const load = useCallback(async () => {
    setLoading(true);
    lastDocRef.current = null;
    try {
      const docs = await fetchEvents(null);
      setEvents(docs);
    } finally {
      setLoading(false);
    }
  }, [fetchEvents]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    lastDocRef.current = null;
    try {
      const docs = await fetchEvents(null);
      setEvents(docs);
    } finally {
      setRefreshing(false);
    }
  }, [fetchEvents]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || !lastDocRef.current) return;
    setLoadingMore(true);
    try {
      const docs = await fetchEvents(lastDocRef.current);
      setEvents(prev => {
        const ids = new Set(prev.map(e => e.id));
        return [...prev, ...docs.filter(d => !ids.has(d.id))];
      });
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, hasMore, fetchEvents]);

  // ── Modal helpers ──────────────────────────────────────────────────────────

  const openModal = useCallback(() => {
    // Seed drafts from current committed values
    setDraftCategory(category);
    setDraftPrice(price);
    setDraftPriceMax(priceMax);
    setDraftDate(dateF);
    setModalVisible(true);
  }, [category, price, priceMax, dateF]);

  const applyFilters = useCallback(() => {
    setCategory(draftCategory);
    setPrice(draftPrice);
    setPriceMax(draftPriceMax);
    setDateF(draftDate);
    setModalVisible(false);
  }, [draftCategory, draftPrice, draftPriceMax, draftDate]);

  const resetFilters = useCallback(() => {
    setDraftCategory('All');
    setDraftPrice('Any');
    setDraftPriceMax(maxEventPrice);
    setDraftDate('Any');
  }, [maxEventPrice]);

  // ── Client-side filter + search ───────────────────────────────────────────

  const filtered = useMemo(() => events.filter(ev => {
    if (search.trim()) {
      if (!ev.title.toLowerCase().includes(search.trim().toLowerCase())) return false;
    }
    if (category !== 'All') {
      if ((ev.category ?? '').toLowerCase() !== category.toLowerCase()) return false;
    }
    if (price === 'Free' && ev.price > 0) return false;
    if (price === 'Paid') {
      if (ev.price === 0) return false;
      if (ev.price > priceMax) return false;
    }
    if (!passesDateFilter(ev.startTime, dateF)) return false;
    return true;
  }), [events, search, category, price, priceMax, dateF]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.headerTitle}>Events</Text>
        <Text style={styles.headerSubtitle}>Discover what's happening near you</Text>

        {/* Search bar + Filter button row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color="rgba(255,255,255,0.55)" />
            <TextInput
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Search events..."
              placeholderTextColor="rgba(255,255,255,0.35)"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={17} color="rgba(255,255,255,0.55)" />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter icon button */}
          <TouchableOpacity style={styles.filterBtn} onPress={openModal} activeOpacity={0.8}>
            <Ionicons name="options-outline" size={20} color={activeFilterCount > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.55)'} />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Active filter summary pills ── */}
      {activeFilterCount > 0 && (
        <View style={styles.activePillsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.activePillsRow}
        >
          {category !== 'All' && (
            <TouchableOpacity style={styles.activePill} onPress={() => setCategory('All')}>
              <Text style={styles.activePillText}>{category}</Text>
              <Ionicons name="close" size={10} color="#22D3EE" />
            </TouchableOpacity>
          )}
          {price !== 'Any' && (
            <TouchableOpacity style={styles.activePill} onPress={() => { setPrice('Any'); setPriceMax(maxEventPrice); }}>
              <Text style={styles.activePillText}>
                {price === 'Paid' ? `Paid · max ₹${Math.round(priceMax)}` : 'Free'}
              </Text>
              <Ionicons name="close" size={10} color="#22D3EE" />
            </TouchableOpacity>
          )}
          {dateF !== 'Any' && (
            <TouchableOpacity style={styles.activePill} onPress={() => setDateF('Any')}>
              <Text style={styles.activePillText}>{dateF}</Text>
              <Ionicons name="close" size={10} color="#22D3EE" />
            </TouchableOpacity>
          )}
        </ScrollView>
        </View>
      )}

      {/* ── List ── */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8B2BE2" />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#8B2BE2"
              colors={['#8B2BE2']}
            />
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.3}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={52} color="rgba(255,255,255,0.35)" />
              <Text style={styles.emptyTitle}>No events found</Text>
              <Text style={styles.emptySubtitle}>
                {search || activeFilterCount > 0
                  ? 'Try adjusting your search or filters'
                  : 'Check back soon for upcoming events'}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreSpinner}>
                <ActivityIndicator size="small" color="#8B2BE2" />
              </View>
            ) : null
          }
          renderItem={({ item }) => (
            <EventCard
              event={item}
              onPress={() => navigation.navigate('EventDetail', { eventId: item.id })}
            />
          )}
        />
      )}

      {/* ── Filter Modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
        statusBarTranslucent
      >
        <Pressable style={modal.backdrop} onPress={() => setModalVisible(false)} />

        <View style={[modal.sheet, { paddingBottom: insets.bottom + 16 }]}>
          {/* Handle */}
          <View style={modal.handle} />

          {/* Top row */}
          <View style={modal.topRow}>
            <Text style={modal.sheetTitle}>Filters</Text>
            <TouchableOpacity onPress={resetFilters} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={modal.resetText}>Reset all</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={modal.closeBtn}>
              <Ionicons name="close" size={20} color="rgba(255,255,255,0.75)" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={modal.scrollContent}>

            {/* ── Section: Category ── */}
            <Text style={modal.sectionLabel}>Category</Text>
            <View style={modal.chipsWrap}>
              {CATEGORIES.map(c => (
                <ModalChip
                  key={c}
                  label={c}
                  active={draftCategory === c}
                  onPress={() => setDraftCategory(c)}
                />
              ))}
            </View>

            {/* ── Section: Price ── */}
            <Text style={modal.sectionLabel}>Price</Text>
            <View style={modal.chipsRowFlat}>
              {(['Any', 'Free', 'Paid'] as PriceFilter[]).map(f => (
                <ModalChip
                  key={f}
                  label={f}
                  active={draftPrice === f}
                  onPress={() => setDraftPrice(f)}
                />
              ))}
            </View>

            {/* Price range slider — shown only when Paid is selected */}
            {draftPrice === 'Paid' && maxEventPrice > 0 && (
              <View style={modal.sliderSection}>
                <View style={modal.sliderLabels}>
                  <Text style={modal.sliderLabel}>₹0</Text>
                  <Text style={modal.sliderValue}>up to ₹{Math.round(draftPriceMax)}</Text>
                  <Text style={modal.sliderLabel}>₹{maxEventPrice}</Text>
                </View>
                <Slider
                  style={modal.slider}
                  minimumValue={0}
                  maximumValue={maxEventPrice}
                  value={draftPriceMax}
                  onValueChange={setDraftPriceMax}
                  step={Math.max(1, Math.floor(maxEventPrice / 100))}
                  minimumTrackTintColor="#8B2BE2"
                  maximumTrackTintColor="rgba(255,255,255,0.12)"
                  thumbTintColor="#06B6D4"
                />
              </View>
            )}

            {draftPrice === 'Paid' && maxEventPrice === 0 && (
              <Text style={modal.sliderNone}>No paid events available right now</Text>
            )}

            {/* ── Section: When ── */}
            <Text style={modal.sectionLabel}>When</Text>
            <View style={modal.chipsRowFlat}>
              {(['Any', 'Today', 'This Week', 'This Month'] as DateFilter[]).map(f => (
                <ModalChip
                  key={f}
                  label={f}
                  active={draftDate === f}
                  onPress={() => setDraftDate(f)}
                />
              ))}
            </View>

          </ScrollView>

          {/* Apply button */}
          <TouchableOpacity onPress={applyFilters} activeOpacity={0.85}>
            <LinearGradient
              colors={['#8B2BE2', '#06B6D4']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={modal.applyBtn}
            >
              <Text style={modal.applyText}>Apply Filters</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
    </ImageBackground>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B1E',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.60)',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 14,
    backgroundColor: 'transparent',
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 14,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#16112B',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    padding: 0,
  },
  filterBtn: {
    width: 54,
    height: 54,
    borderRadius: 14,
    backgroundColor: '#16112B',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8B2BE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  activePillsWrap: {
    height: 32,
    justifyContent: 'center',
  },
  activePillsRow: {
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    height: 32,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 24,
    marginRight: 8,
  },
  activePillText: {
    fontSize: 11,
    lineHeight: 22,
    fontFamily: 'Inter-Medium',
    color: '#22D3EE',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
    lineHeight: 22,
  },
  loadMoreSpinner: {
    paddingVertical: 20,
    alignItems: 'center',
  },
});

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(13,11,30,0.60)',
  },
  sheet: {
    backgroundColor: '#1A1530',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center',
    marginBottom: 16,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    flex: 1,
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  resetText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#22D3EE',
    marginRight: 16,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255,255,255,0.55)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginTop: 8,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  chipsRowFlat: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 8,
  },
  sliderSection: {
    marginTop: 8,
    marginBottom: 16,
    backgroundColor: '#16112B',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.30)',
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
  },
  sliderValue: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#22D3EE',
  },
  slider: {
    width: '100%',
    height: 36,
  },
  sliderNone: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    marginBottom: 16,
    marginTop: 4,
  },
  applyBtn: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  applyText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
});

export default EventHubScreen;
