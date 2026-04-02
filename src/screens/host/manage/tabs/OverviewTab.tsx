import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Modal,
  StatusBar,
  Animated,
  ActivityIndicator,
  Alert,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Video from 'react-native-video';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import firestore from '@react-native-firebase/firestore';

const SCREEN_W = Dimensions.get('window').width;
const CAROUSEL_H = 240;

// ─── Types ───────────────────────────────────────────────────────────────────

type EventStatus = 'draft' | 'live' | 'ended' | 'cancelled';

type EventDoc = {
  title: string;
  description: string;
  location: string;
  startTime: any;
  endTime: any;
  price: number;
  capacity: { total: number | null; booked: number };
  media: { type: 'image' | 'video'; url: string }[];
  status: EventStatus;
  checkinsCount?: number;
  category?: string;
  tags?: string[];
  ageRestrictions?: { min: number; max?: number | null } | null;
  genderRestrictions?: string[] | null;
};

type Props = {
  eventId: string;
  eventStatus: EventStatus;
  onStatusChange: (status: EventStatus) => void;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatEventDate = (ts: any): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
      timeZone: 'Asia/Kolkata',
    });
  } catch { return '—'; }
};

const formatRevenue = (n: number) => `₹${n.toLocaleString('en-IN')}`;

const getVenue = (location: string) =>
  location?.split(',')[0]?.trim() ?? location ?? '—';

const getAddress = (location: string) => {
  const idx = location?.indexOf(',');
  if (!location || idx === -1 || idx === location.length - 1) return null;
  return location.slice(idx + 1).trim();
};

// ─── Media Carousel ─────────────────────────────────────────────────────────

type MediaItem = { type: 'image' | 'video'; url: string };

/** Full-screen video modal — Video is ONLY mounted while the modal is open */
const VideoModal = React.memo(({ url, onClose }: { url: string; onClose: () => void }) => (
  <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <StatusBar backgroundColor="#000" barStyle="light-content" />
    <View style={videoModalStyles.container}>
      <Video
        source={{ uri: url }}
        style={videoModalStyles.video}
        resizeMode="contain"
        controls
        paused={false}
        onEnd={onClose}
      />
      <TouchableOpacity style={videoModalStyles.closeBtn} onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Ionicons name="close" size={26} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  </Modal>
));

const videoModalStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000', justifyContent: 'center' },
  video:     { width: '100%', height: '100%' },
  closeBtn:  {
    position: 'absolute', top: 48, right: 20,
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
  },
});

/** Single image slide — shows a dark shimmer until the image fully loads */
const ImageSlide = React.memo(({ url }: { url: string }) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={slideStyles.container}>
      <Image
        source={{ uri: url }}
        style={[slideStyles.image, { opacity: loaded ? 1 : 0 }]}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
      />
      {!loaded && (
        <View style={carouselStyles.shimmer}>
          <Ionicons name="image-outline" size={36} color="#1E3347" />
        </View>
      )}
    </View>
  );
});

const slideStyles = StyleSheet.create({
  container: { width: SCREEN_W, height: CAROUSEL_H, backgroundColor: '#132232' },
  image:     { width: SCREEN_W, height: CAROUSEL_H },
});

/** Animated dot — opacity driven entirely on native thread, no re-renders */
const AnimatedDot = React.memo(({
  index, scrollX, total, isVideo, onPress,
}: {
  index: number; scrollX: Animated.Value; total: number; isVideo: boolean;
  onPress: () => void;
}) => {
  // Dot at cloned position = index + 1 (offset for left clone)
  const clonePos = index + 1;
  const inputRange = [(clonePos - 1) * SCREEN_W, clonePos * SCREEN_W, (clonePos + 1) * SCREEN_W];

  const width = scrollX.interpolate({
    inputRange,
    outputRange: [6, 18, 6],
    extrapolate: 'clamp',
  });
  const bgColor = scrollX.interpolate({
    inputRange,
    outputRange: [
      isVideo ? 'rgba(255,159,10,0.25)' : 'rgba(55,139,187,0.25)',
      isVideo ? '#FF9F0A' : '#378BBB',
      isVideo ? 'rgba(255,159,10,0.25)' : 'rgba(55,139,187,0.25)',
    ],
    extrapolate: 'clamp',
  });

  return (
    <TouchableOpacity onPress={onPress} hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}>
      <Animated.View style={{ width, height: 6, borderRadius: 3, backgroundColor: bgColor }} />
    </TouchableOpacity>
  );
});

const MediaCarousel = ({ media }: { media: MediaItem[] }) => {
  const items = media ?? [];

  // Clone trick: [clone-of-last, ...realItems, clone-of-first]
  const cloned = useMemo(() =>
    items.length > 1
      ? [items[items.length - 1], ...items, items[0]]
      : items
  , [items]);

  const scrollRef = useRef<ScrollView>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laidOut   = useRef(false);

  // Native-animated scroll offset — drives dots without JS re-renders
  const scrollX = useRef(new Animated.Value(items.length > 1 ? SCREEN_W : 0)).current;

  // activeRef tracks current real index without triggering renders
  const activeRef = useRef(0);

  // Only state: video modal url (rare interaction, fine to re-render)
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // Prefetch images on mount
  useEffect(() => {
    items.forEach(item => {
      if (item.type === 'image') Image.prefetch(item.url).catch(() => {});
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Initial scroll after layout
  const handleLayout = useCallback(() => {
    if (!laidOut.current && items.length > 1) {
      laidOut.current = true;
      scrollRef.current?.scrollTo({ x: SCREEN_W, animated: false });
    }
  }, [items.length]);

  // Schedule auto-advance (no state, just timer + native scrollTo)
  const scheduleAdvance = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (items.length <= 1) return;
    const curr = items[activeRef.current];
    if (curr?.type === 'image') {
      timerRef.current = setTimeout(() => {
        const nextReal  = (activeRef.current + 1) % items.length;
        const nextClone = nextReal + 1;
        activeRef.current = nextReal;
        scrollRef.current?.scrollTo({ x: nextClone * SCREEN_W, animated: true });
        scheduleAdvance();
      }, 3000);
    }
  }, [items]);

  useEffect(() => {
    scheduleAdvance();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scheduleAdvance]);

  // goTo from dot press
  const goTo = useCallback((originalIdx: number) => {
    if (items.length === 0) return;
    const target = items.length > 1 ? originalIdx + 1 : originalIdx;
    activeRef.current = originalIdx;
    scrollRef.current?.scrollTo({ x: target * SCREEN_W, animated: true });
    // restart auto-advance
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleAdvance();
  }, [items.length, scheduleAdvance]);

  // Handle manual swipe end + clone jumps
  const handleScrollEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const pos = Math.round(e.nativeEvent.contentOffset.x / SCREEN_W);
    if (items.length <= 1) return;

    if (pos === 0) {
      // Left clone → jump to real last
      scrollRef.current?.scrollTo({ x: items.length * SCREEN_W, animated: false });
      activeRef.current = items.length - 1;
    } else if (pos === cloned.length - 1) {
      // Right clone → jump to real first
      scrollRef.current?.scrollTo({ x: SCREEN_W, animated: false });
      activeRef.current = 0;
    } else {
      activeRef.current = pos - 1;
    }

    // Restart auto-advance after manual interaction
    if (timerRef.current) clearTimeout(timerRef.current);
    scheduleAdvance();
  }, [items.length, cloned.length, scheduleAdvance]);

  if (items.length === 0) {
    return (
      <View style={carouselStyles.placeholder}>
        <Ionicons name="image-outline" size={44} color="#2E4A63" />
        <Text style={carouselStyles.placeholderText}>No media uploaded</Text>
      </View>
    );
  }

  return (
    <View>
      {videoUrl && <VideoModal url={videoUrl} onClose={() => setVideoUrl(null)} />}

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        decelerationRate="fast"
        onLayout={handleLayout}
        onMomentumScrollEnd={handleScrollEnd}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { useNativeDriver: false },
        )}
        contentContainerStyle={{ width: SCREEN_W * cloned.length }}
      >
        {cloned.map((item, index) => (
          <View key={index} style={carouselStyles.slide}>
            {item.type === 'image' ? (
              <ImageSlide url={item.url} />
            ) : (
              <TouchableOpacity
                activeOpacity={0.85}
                style={carouselStyles.videoPoster}
                onPress={() => setVideoUrl(item.url)}
              >
                <View style={carouselStyles.playCircle}>
                  <Ionicons name="play" size={30} color="#FFFFFF" />
                </View>
                <Text style={carouselStyles.videoLabel}>Tap to play video</Text>
              </TouchableOpacity>
            )}
          </View>
        ))}
      </Animated.ScrollView>

      {/* Animated dot indicators — driven by native scrollX, no JS re-renders */}
      {items.length > 1 && (
        <View style={carouselStyles.dots}>
          {items.map((item, i) => (
            <AnimatedDot
              key={i}
              index={i}
              scrollX={scrollX}
              total={items.length}
              isVideo={item.type === 'video'}
              onPress={() => goTo(i)}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const carouselStyles = StyleSheet.create({
  placeholder: {
    width: '100%', height: CAROUSEL_H,
    backgroundColor: '#132232',
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  placeholderText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#2E4A63' },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  slide: { width: SCREEN_W, height: CAROUSEL_H },
  videoPoster: {
    width: SCREEN_W, height: CAROUSEL_H,
    backgroundColor: '#08111C',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  playCircle: {
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: 'rgba(55,139,187,0.75)',
    alignItems: 'center', justifyContent: 'center',
    // nudge play icon visually centred
    paddingLeft: 4,
  },
  videoLabel: {
    fontSize: 13, fontFamily: 'Inter-SemiBold',
    color: 'rgba(184,199,217,0.7)', letterSpacing: 0.3,
  },
  dots: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 6,
    paddingVertical: 10, backgroundColor: '#0E1621',
  },
});

// ─── Component ───────────────────────────────────────────────────────────────

const OverviewTab = ({ eventId, eventStatus, onStatusChange }: Props) => {
  const navigation = useNavigation<any>();
  const [event,    setEvent]    = useState<EventDoc | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsub = firestore()
      .collection('events')
      .doc(eventId)
      .onSnapshot(snap => {
        if (snap.data()) setEvent(snap.data() as EventDoc);
        setLoading(false);
      }, err => {
        console.error('OverviewTab fetch error:', err);
        setLoading(false);
      });
    return unsub;
  }, [eventId]);

  // ── Status actions ────────────────────────────────────────────────────────
  const updateStatus = async (newStatus: EventStatus, confirmMsg: string) => {
    Alert.alert(
      newStatus === 'live' ? 'Make Event Live?' : 'End Event?',
      confirmMsg,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: newStatus === 'live' ? 'Yes, Go Live' : 'Yes, End It',
          style: newStatus === 'live' ? 'default' : 'destructive',
          onPress: async () => {
            setUpdating(true);
            try {
              await firestore().collection('events').doc(eventId).update({ status: newStatus });
              onStatusChange(newStatus);
            } catch (e) {
              Alert.alert('Error', 'Could not update event status. Try again.');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#378BBB" />
      </View>
    );
  }

  if (!event) {
    return (
      <View style={styles.centered}>
        <Ionicons name="alert-circle-outline" size={40} color="#506A85" />
        <Text style={styles.errorText}>Could not load event.</Text>
      </View>
    );
  }

  const booked     = event.capacity?.booked ?? 0;
  const total      = event.capacity?.total ?? null;
  const isFree     = !event.price || event.price === 0;
  const revenue    = isFree ? 0 : event.price * booked;
  const checkins   = event.checkinsCount ?? 0;
  const spotsLeft  = total !== null ? Math.max(0, total - booked) : null;
  const venue      = getVenue(event.location);
  const address    = getAddress(event.location);
  const status     = event.status;
  const isEnded    = status === 'ended' || status === 'cancelled';
  const tags       = event.tags ?? [];
  const ageLabel   = event.ageRestrictions
    ? event.ageRestrictions.max
      ? `${event.ageRestrictions.min}–${event.ageRestrictions.max} yrs`
      : `${event.ageRestrictions.min}+ yrs`
    : null;
  const genderLabel = event.genderRestrictions?.length
    ? event.genderRestrictions.join(', ')
    : null;

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Media Carousel ── */}
      <MediaCarousel media={event.media} />

      <View style={styles.body}>

        {/* ── Title & Description ── */}
        <Text style={styles.title}>{event.title}</Text>
        {!!event.description && (
          <Text style={styles.description}>{event.description}</Text>
        )}

        <View style={styles.divider} />

        {/* ── Date & Venue ── */}
        <View style={styles.infoSection}>

          {/* Start */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="play-circle-outline" size={16} color="#34C759" />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Starts</Text>
              <Text style={styles.infoValue}>{formatEventDate(event.startTime)}</Text>
            </View>
          </View>

          {/* End */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="stop-circle-outline" size={16} color="#FF3B30" />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Ends</Text>
              <Text style={styles.infoValue}>{formatEventDate(event.endTime)}</Text>
            </View>
          </View>

          {/* Venue */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="location-outline" size={16} color="#378BBB" />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Venue</Text>
              <Text style={styles.infoValue}>{venue}</Text>
              {!!address && <Text style={styles.infoSubValue}>{address}</Text>}
            </View>
          </View>

          {/* Price */}
          <View style={styles.infoRow}>
            <View style={styles.infoIconWrap}>
              <Ionicons name="pricetag-outline" size={16} color="#FF9F0A" />
            </View>
            <View style={styles.infoTextWrap}>
              <Text style={styles.infoLabel}>Ticket Price</Text>
              <Text style={styles.infoValue}>
                {isFree ? 'Free Entry' : `₹${event.price} per person`}
              </Text>
            </View>
          </View>

          {/* Capacity / Spots left */}
          {total !== null && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="people-outline" size={16} color="#378BBB" />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>Capacity</Text>
                <Text style={styles.infoValue}>
                  {booked} / {total} booked
                  {'  '}
                  <Text style={{ color: spotsLeft === 0 ? '#FF3B30' : '#34C759', fontSize: 12 }}>
                    ({spotsLeft === 0 ? 'Sold out' : `${spotsLeft} left`})
                  </Text>
                </Text>
              </View>
            </View>
          )}

          {/* Age restriction */}
          {!!ageLabel && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#506A85" />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>Age Restriction</Text>
                <Text style={styles.infoValue}>{ageLabel}</Text>
              </View>
            </View>
          )}

          {/* Gender restriction */}
          {!!genderLabel && (
            <View style={styles.infoRow}>
              <View style={styles.infoIconWrap}>
                <Ionicons name="person-outline" size={16} color="#506A85" />
              </View>
              <View style={styles.infoTextWrap}>
                <Text style={styles.infoLabel}>Entry For</Text>
                <Text style={styles.infoValue}>{genderLabel}</Text>
              </View>
            </View>
          )}

        </View>

        {/* ── Category & Tags ── */}
        {(!!event.category || tags.length > 0) && (
          <>
            <View style={styles.divider} />
            <View style={styles.tagsSection}>
              {!!event.category && (
                <View style={styles.categoryChip}>
                  <Ionicons name="grid-outline" size={12} color="#378BBB" />
                  <Text style={styles.categoryChipText}>{event.category}</Text>
                </View>
              )}
              {tags.map((tag, i) => (
                <View key={i} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        <View style={styles.divider} />

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Ionicons name="ticket-outline" size={20} color="#378BBB" />
            <Text style={styles.statValue}>
              {total ? `${booked} / ${total}` : `${booked}`}
            </Text>
            <Text style={styles.statLabel}>Tickets Sold</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="trending-up-outline" size={20} color="#34C759" />
            <Text style={[styles.statValue, { color: '#34C759' }]}>
              {isFree ? 'Free' : formatRevenue(revenue)}
            </Text>
            <Text style={styles.statLabel}>Revenue</Text>
          </View>

          <View style={styles.statCard}>
            <Ionicons name="checkmark-circle-outline" size={20} color="#FF9F0A" />
            <Text style={[styles.statValue, { color: '#FF9F0A' }]}>{checkins}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
          </View>
        </View>

        {/* ── Action Buttons ── */}
        {!isEnded && (
          <>
            <View style={styles.divider} />
            <View style={styles.actions}>

              {/* Edit — always shown for draft & live */}
              <TouchableOpacity
                style={styles.btnOutline}
                activeOpacity={0.8}
                onPress={() => navigation.navigate('EditEvent', {
                  eventId,
                  eventStatus: eventStatus === 'draft' ? 'draft' : 'live',
                })}
              >
                <Ionicons name="create-outline" size={17} color="#378BBB" />
                <Text style={styles.btnOutlineText}>Edit Event</Text>
              </TouchableOpacity>

              {/* Draft → Make Live */}
              {status === 'draft' && (
                <TouchableOpacity
                  style={[styles.btnFilled, { backgroundColor: '#34C759' }]}
                  activeOpacity={0.8}
                  disabled={updating}
                  onPress={() =>
                    updateStatus('live', 'This will publish your event and make it visible to attendees.')
                  }
                >
                  {updating
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="radio-button-on" size={17} color="#FFFFFF" />
                  }
                  <Text style={styles.btnFilledText}>Make Live</Text>
                </TouchableOpacity>
              )}

              {/* Live → End Event */}
              {status === 'live' && (
                <TouchableOpacity
                  style={[styles.btnFilled, { backgroundColor: '#FF3B30' }]}
                  activeOpacity={0.8}
                  disabled={updating}
                  onPress={() =>
                    updateStatus('ended', 'This will mark the event as ended. This cannot be undone.')
                  }
                >
                  {updating
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name="stop-circle-outline" size={17} color="#FFFFFF" />
                  }
                  <Text style={styles.btnFilledText}>End Event</Text>
                </TouchableOpacity>
              )}

            </View>
          </>
        )}

      </View>
    </ScrollView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#0E1621' },
  scrollContent: { paddingBottom: 40 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    gap: 12, backgroundColor: '#0E1621',
  },
  errorText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#506A85' },

  // body
  body: { padding: 20, gap: 0 },
  title: {
    fontSize: 22, fontFamily: 'Inter-Bold', color: '#FFFFFF',
    lineHeight: 30, marginBottom: 8,
  },
  description: {
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#B8C7D9',
    lineHeight: 22, marginBottom: 4,
  },

  divider: {
    height: 1, backgroundColor: 'rgba(55,139,187,0.15)',
    marginVertical: 20,
  },

  // info rows
  infoSection: { gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(55,139,187,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoTextWrap: { flex: 1, gap: 2 },
  infoLabel: { fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#506A85', textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  infoSubValue: {
    fontSize: 12, fontFamily: 'Inter-Regular', color: '#506A85', marginTop: 1,
  },

  // category & tags
  tagsSection: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  categoryChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(55,139,187,0.12)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.25)',
  },
  categoryChipText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#378BBB' },
  tagChip: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  tagChipText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#7F93AA' },

  // stats
  statsGrid: { flexDirection: 'row', gap: 10 },
  statCard: {
    flex: 1, backgroundColor: '#1B2F48',
    borderRadius: 14, padding: 14,
    alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
  },
  statValue: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  statLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85', textAlign: 'center' },

  // buttons
  actions: { gap: 12 },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#378BBB', borderRadius: 12,
    paddingVertical: 14,
  },
  btnOutlineText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#378BBB' },
  btnFilled: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 14,
  },
  btnFilledText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
});

export default OverviewTab;
