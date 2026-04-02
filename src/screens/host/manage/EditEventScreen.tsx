/**
 * EDIT EVENT SCREEN
 *
 * Draft  → all fields editable
 * Live   → only title, description, category, tags, venue, address editable
 *          price / times / capacity / entry policy / restrictions are locked
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TextInput,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import DatePicker from 'react-native-date-picker';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_CATEGORIES = [
  { label: 'Music',        icon: 'musical-notes-outline' },
  { label: 'Sports',       icon: 'football-outline' },
  { label: 'Food & Drinks',icon: 'restaurant-outline' },
  { label: 'Nightlife',    icon: 'moon-outline' },
  { label: 'Art & Culture',icon: 'color-palette-outline' },
  { label: 'Comedy',       icon: 'happy-outline' },
  { label: 'Tech',         icon: 'code-slash-outline' },
  { label: 'Fitness',      icon: 'barbell-outline' },
  { label: 'Fashion',      icon: 'shirt-outline' },
  { label: 'Gaming',       icon: 'game-controller-outline' },
  { label: 'Travel',       icon: 'airplane-outline' },
  { label: 'Business',     icon: 'briefcase-outline' },
  { label: 'Social',       icon: 'people-outline' },
  { label: 'Other',        icon: 'ellipsis-horizontal-circle-outline' },
];

const GENDERS = ['Male', 'Female', 'Trans', 'Non-Binary'];

const CODE_LENGTHS = [4, 5, 6, 7, 8];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatDateTime = (date: Date): string =>
  date.toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true,
    timeZone: 'Asia/Kolkata',
  });

const splitLocation = (loc: string): { venue: string; address: string } => {
  if (!loc) return { venue: '', address: '' };
  const idx = loc.indexOf(',');
  if (idx === -1) return { venue: loc.trim(), address: '' };
  return { venue: loc.slice(0, idx).trim(), address: loc.slice(idx + 1).trim() };
};

// A media slot is either an already-uploaded remote URL or a freshly picked local URI.
type MediaSlot = { uri: string; isLocal: boolean };

const isLocalUri = (uri: string) => uri.startsWith('file://') || uri.startsWith('content://');

const uploadFile = async (localUri: string, remotePath: string): Promise<string> => {
  const ref = storage().ref(remotePath);
  await ref.putFile(localUri);
  return await ref.getDownloadURL();
};



/** Shows a lock notice + read-only value when the section is locked (live events) */
const LockedRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={lockedStyles.row}>
    <View style={lockedStyles.iconWrap}>
      <Ionicons name={icon as any} size={15} color="#506A85" />
    </View>
    <View style={lockedStyles.textWrap}>
      <Text style={lockedStyles.label}>{label}</Text>
      <Text style={lockedStyles.value}>{value}</Text>
    </View>
    <Ionicons name="lock-closed-outline" size={14} color="#506A85" />
  </View>
);

const lockedStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    gap: 10, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(55,139,187,0.08)',
  },
  iconWrap: {
    width: 32, height: 32, borderRadius: 8,
    backgroundColor: 'rgba(80,106,133,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  textWrap: { flex: 1 },
  label: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85', marginBottom: 2 },
  value: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#7F93AA' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

const EditEventScreen = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route      = useRoute<any>();

  const { eventId, eventStatus } = route.params as {
    eventId: string;
    eventStatus: 'draft' | 'live';
  };

  const isLive = eventStatus === 'live';

  // ── Loading state ──────────────────────────────────────────────────────────
  const [fetching, setFetching] = useState(true);
  const [saving,   setSaving]   = useState(false);

  // ── Media state ───────────────────────────────────────────────────────────
  // banner: single image slot (remote url or new local uri)
  const [banner, setBanner] = useState<MediaSlot | null>(null);
  // photos: up to 5 extra images
  const [photos, setPhotos] = useState<MediaSlot[]>([]);
  // video: single video slot
  const [video,  setVideo]  = useState<MediaSlot | null>(null);

  // ── Always-editable fields ─────────────────────────────────────────────────
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [category,    setCategory]    = useState('');
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [tags,        setTags]        = useState<string[]>([]);
  const [tagInput,    setTagInput]    = useState('');
  const [venue,       setVenue]       = useState('');
  const [address,     setAddress]     = useState('');

  // ── Draft-only fields ──────────────────────────────────────────────────────
  const [startTime,        setStartTime]        = useState(new Date());
  const [endTime,          setEndTime]          = useState(new Date());
  const [startPickerOpen,  setStartPickerOpen]  = useState(false);
  const [endPickerOpen,    setEndPickerOpen]    = useState(false);
  const [isFree,           setIsFree]           = useState(false);
  const [price,            setPrice]            = useState('');
  const [capacityType,     setCapacityType]     = useState<'limited' | 'unlimited'>('limited');
  const [capacityTotal,    setCapacityTotal]    = useState('');
  const [entryCodeLength,  setEntryCodeLength]  = useState(6);
  const [bookingDuo,       setBookingDuo]       = useState(false);
  const [bookingGroup,     setBookingGroup]     = useState(false);
  const [maxGroupSize,     setMaxGroupSize]     = useState('6');
  const [hasAge,           setHasAge]           = useState(false);
  const [ageMin,           setAgeMin]           = useState('18');
  const [ageMax,           setAgeMax]           = useState('');
  const [hasGender,        setHasGender]        = useState(false);
  const [selectedGenders,  setSelectedGenders]  = useState<string[]>([]);

  // ── Fetch event ────────────────────────────────────────────────────────────
  useEffect(() => {
    firestore().collection('events').doc(eventId).get().then(snap => {
      const d = snap.data();
      if (!d) { setFetching(false); return; }

      setTitle(d.title ?? '');
      setDescription(d.description ?? '');
      setCategory(d.category ?? '');
      setTags(d.tags ?? []);
      const { venue: v, address: a } = splitLocation(d.location ?? '');
      setVenue(v);
      setAddress(a);

      // Populate media slots from existing Firestore media array
      const mediaArr: { type: 'image' | 'video'; url: string }[] = d.media ?? [];
      const images = mediaArr.filter(m => m.type === 'image');
      const vid    = mediaArr.find(m => m.type === 'video');
      if (images[0]) setBanner({ uri: images[0].url, isLocal: false });
      if (images.length > 1) setPhotos(images.slice(1).map(m => ({ uri: m.url, isLocal: false })));
      if (vid)        setVideo({ uri: vid.url, isLocal: false });

      if (!isLive) {
        setStartTime(d.startTime?.toDate() ?? new Date());
        setEndTime(d.endTime?.toDate()     ?? new Date());
        setIsFree(d.price === 0);
        setPrice(d.price > 0 ? String(d.price) : '');
        setCapacityType(d.capacity?.total == null ? 'unlimited' : 'limited');
        setCapacityTotal(d.capacity?.total != null ? String(d.capacity.total) : '');
        setEntryCodeLength(d.entryPolicy?.codeLength ?? 6);
        const abt = d.allowedBookingTypes ?? ['solo'];
        setBookingDuo(abt.includes('duo'));
        setBookingGroup(abt.includes('group'));
        setMaxGroupSize(d.maxGroupSize != null ? String(d.maxGroupSize) : '6');
        setHasAge(!!d.ageRestrictions);
        setAgeMin(d.ageRestrictions?.min != null ? String(d.ageRestrictions.min) : '18');
        setAgeMax(d.ageRestrictions?.max != null ? String(d.ageRestrictions.max) : '');
        setHasGender(!!d.genderRestrictions && d.genderRestrictions.length > 0);
        setSelectedGenders(d.genderRestrictions ?? []);
      }
      setFetching(false);
    }).catch(err => {
      console.error('EditEvent fetch error:', err);
      setFetching(false);
    });
  }, [eventId]);

  // ── Media pickers ──────────────────────────────────────────────────────────
  const pickBanner = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets?.[0]?.uri) setBanner({ uri: result.assets[0].uri, isLocal: true });
  };

  const pickPhotos = async () => {
    if (photos.length >= 5) { Alert.alert('Limit Reached', 'Up to 5 extra photos allowed'); return; }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 5 - photos.length });
    if (result.assets) {
      const newSlots: MediaSlot[] = result.assets
        .filter(a => a.uri)
        .map(a => ({ uri: a.uri!, isLocal: true }));
      setPhotos(prev => [...prev, ...newSlots].slice(0, 5));
    }
  };

  const pickVideo = async () => {
    const result = await launchImageLibrary({ mediaType: 'video' });
    if (result.assets?.[0]?.uri) setVideo({ uri: result.assets[0].uri, isLocal: true });
  };

  const removePhoto = (idx: number) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  // ── Tag helpers ────────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t) && tags.length < 10) {
      setTags(prev => [...prev, t]);
    }
    setTagInput('');
  };
  const removeTag = (t: string) => setTags(prev => prev.filter(x => x !== t));
  const toggleGender = (g: string) =>
    setSelectedGenders(prev => prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]);

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!title.trim())   return 'Title is required';
    if (!category)       return 'Category is required';
    if (!venue.trim())   return 'Venue is required';
    if (!address.trim()) return 'Address is required';
    if (!isLive) {
      if (!isFree) {
        const p = parseFloat(price);
        if (!price || isNaN(p) || p < 0) return 'Enter a valid price';
      }
      if (capacityType === 'limited') {
        const c = parseInt(capacityTotal);
        if (!capacityTotal || isNaN(c) || c < 1) return 'Enter a valid capacity';
      }
      if (startTime >= endTime) return 'End time must be after start time';
    }
    return null;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const err = validate();
    if (err) { Alert.alert('Validation Error', err); return; }

    setSaving(true);
    try {
      // Upload any new local media and build final media array
      const mediaItems: { type: 'image' | 'video'; url: string }[] = [];

      if (banner) {
        const url = banner.isLocal
          ? await uploadFile(banner.uri, `event-media/${eventId}/banner`)
          : banner.uri;
        mediaItems.push({ type: 'image', url });
      }

      for (let i = 0; i < photos.length; i++) {
        const slot = photos[i];
        const url = slot.isLocal
          ? await uploadFile(slot.uri, `event-media/${eventId}/photo-${i}`)
          : slot.uri;
        mediaItems.push({ type: 'image', url });
      }

      if (video) {
        const url = video.isLocal
          ? await uploadFile(video.uri, `event-media/${eventId}/video`)
          : video.uri;
        mediaItems.push({ type: 'video', url });
      }

      const update: Record<string, any> = {
        title:       title.trim(),
        description: description.trim(),
        category,
        tags,
        location:    `${venue.trim()}, ${address.trim()}`,
        media:       mediaItems,
      };

      if (!isLive) {
        update.startTime    = firestore.Timestamp.fromDate(startTime);
        update.endTime      = firestore.Timestamp.fromDate(endTime);
        update.price        = isFree ? 0 : parseFloat(price);
        update['capacity.total'] = capacityType === 'unlimited' ? null : parseInt(capacityTotal);
        update['entryPolicy.codeLength'] = entryCodeLength;
        const bookingTypes = ['solo', ...(bookingDuo ? ['duo'] : []), ...(bookingGroup ? ['group'] : [])];
        update.allowedBookingTypes = bookingTypes;
        update.maxGroupSize = bookingGroup ? parseInt(maxGroupSize) || 6 : null;
        update.ageRestrictions = hasAge
          ? { min: parseInt(ageMin) || 0, max: ageMax ? parseInt(ageMax) : null }
          : null;
        update.genderRestrictions = hasGender && selectedGenders.length > 0
          ? selectedGenders
          : null;
      }

      await firestore().collection('events').doc(eventId).update(update);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (fetching) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#378BBB" />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* ── Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Event</Text>
        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.8}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFFFFF" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── Live lock notice ── */}
      {isLive && (
        <View style={styles.lockNotice}>
          <Ionicons name="lock-closed-outline" size={14} color="#FF9F0A" />
          <Text style={styles.lockNoticeText}>
            Some fields are locked because this event is live and has active bookings.
          </Text>
        </View>
      )}

      <KeyboardAwareScrollView
        enableOnAndroid
        extraScrollHeight={220}
        enableAutomaticScroll
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {/* ════════════════════════════════════════
            SECTION 1 — Basic Info (always editable)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Basic Info</Text>
        <View style={styles.card}>

          {/* Title */}
          <Text style={styles.fieldLabel}>Event Title *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Friday Night Meetup"
            placeholderTextColor="#506A85"
            maxLength={80}
          />

          {/* Description */}
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="What's this event about?"
            placeholderTextColor="#506A85"
            multiline
            maxLength={800}
          />

          {/* Category */}
          <Text style={styles.fieldLabel}>Category *</Text>
          <TouchableOpacity
            style={styles.selector}
            onPress={() => setCategoryModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons
              name={(EVENT_CATEGORIES.find(c => c.label === category)?.icon ?? 'apps-outline') as any}
              size={16} color="#378BBB"
            />
            <Text style={[styles.selectorText, !category && { color: '#506A85' }]}>
              {category || 'Select a category'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#506A85" />
          </TouchableOpacity>

          {/* Tags */}
          <Text style={styles.fieldLabel}>Tags</Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={[styles.input, { flex: 1, marginBottom: 0 }]}
              value={tagInput}
              onChangeText={setTagInput}
              placeholder="Add a tag…"
              placeholderTextColor="#506A85"
              onSubmitEditing={addTag}
              returnKeyType="done"
              maxLength={30}
            />
            <TouchableOpacity style={styles.tagAddBtn} onPress={addTag}>
              <Ionicons name="add" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagsWrap}>
              {tags.map(t => (
                <TouchableOpacity key={t} style={styles.tagChip} onPress={() => removeTag(t)}>
                  <Text style={styles.tagChipText}>{t}</Text>
                  <Ionicons name="close" size={11} color="#B8C7D9" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ════════════════════════════════════════
            SECTION 2 — Media (always editable)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Media</Text>
        <View style={styles.card}>

          {/* Banner */}
          <Text style={styles.fieldLabel}>Banner Image</Text>
          <TouchableOpacity style={styles.bannerPicker} onPress={pickBanner} activeOpacity={0.8}>
            {banner ? (
              <>
                <Image source={{ uri: banner.uri }} style={styles.bannerPreview} resizeMode="cover" />
                <View style={styles.bannerOverlay}>
                  <Ionicons name="camera-outline" size={22} color="#FFFFFF" />
                  <Text style={styles.bannerOverlayText}>Change Banner</Text>
                </View>
              </>
            ) : (
              <View style={styles.bannerEmpty}>
                <Ionicons name="image-outline" size={36} color="#2E4A63" />
                <Text style={styles.bannerEmptyText}>Tap to add banner</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Extra Photos */}
          <Text style={styles.fieldLabel}>Extra Photos ({photos.length}/5)</Text>
          <View style={styles.photosRow}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoThumb}>
                <Image source={{ uri: p.uri }} style={styles.photoThumbImg} resizeMode="cover" />
                <TouchableOpacity style={styles.photoRemoveBtn} onPress={() => removePhoto(i)}>
                  <Ionicons name="close-circle" size={18} color="#FF3B30" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity style={styles.photoAddBtn} onPress={pickPhotos} activeOpacity={0.8}>
                <Ionicons name="add" size={26} color="#378BBB" />
              </TouchableOpacity>
            )}
          </View>

          {/* Video */}
          <Text style={styles.fieldLabel}>Video (optional)</Text>
          {video ? (
            <View style={styles.videoRow}>
              <View style={styles.videoChip}>
                <Ionicons name="videocam-outline" size={16} color="#378BBB" />
                <Text style={styles.videoChipText} numberOfLines={1}>
                  {video.isLocal ? 'New video selected' : 'Existing video'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setVideo(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="trash-outline" size={18} color="#FF3B30" />
              </TouchableOpacity>
              <TouchableOpacity onPress={pickVideo} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="swap-horizontal-outline" size={18} color="#378BBB" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.selector} onPress={pickVideo} activeOpacity={0.8}>
              <Ionicons name="videocam-outline" size={16} color="#378BBB" />
              <Text style={[styles.selectorText, { color: '#506A85' }]}>Tap to add video</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ════════════════════════════════════════
            SECTION 3 — Date & Time
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Date & Time</Text>
        <View style={styles.card}>
          {isLive ? (
            <>
              <LockedRow icon="play-outline"   label="Start Time" value={formatDateTime(startTime)} />
              <LockedRow icon="stop-outline"   label="End Time"   value={formatDateTime(endTime)} />
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Start Date & Time *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setStartPickerOpen(true)}>
                <Ionicons name="calendar-outline" size={16} color="#378BBB" />
                <Text style={styles.selectorText}>{formatDateTime(startTime)}</Text>
              </TouchableOpacity>
              <DatePicker
                modal open={startPickerOpen} date={startTime} mode="datetime"
                onConfirm={d => { setStartPickerOpen(false); setStartTime(d); }}
                onCancel={() => setStartPickerOpen(false)}
              />

              <Text style={styles.fieldLabel}>End Date & Time *</Text>
              <TouchableOpacity style={styles.selector} onPress={() => setEndPickerOpen(true)}>
                <Ionicons name="calendar-outline" size={16} color="#378BBB" />
                <Text style={styles.selectorText}>{formatDateTime(endTime)}</Text>
              </TouchableOpacity>
              <DatePicker
                modal open={endPickerOpen} date={endTime} mode="datetime"
                onConfirm={d => { setEndPickerOpen(false); setEndTime(d); }}
                onCancel={() => setEndPickerOpen(false)}
                minimumDate={startTime}
              />
            </>
          )}
        </View>

        {/* ════════════════════════════════════════
            SECTION 3 — Location (always editable)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Location</Text>
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Venue Name *</Text>
          <TextInput
            style={styles.input}
            value={venue}
            onChangeText={setVenue}
            placeholder="e.g. The Grand Ballroom"
            placeholderTextColor="#506A85"
          />

          <Text style={styles.fieldLabel}>Address *</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={address}
            onChangeText={setAddress}
            placeholder="Full address"
            placeholderTextColor="#506A85"
            multiline
          />
        </View>

        {/* ════════════════════════════════════════
            SECTION 4 — Pricing  (draft: editable / live: locked)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Pricing</Text>
        <View style={styles.card}>
          {isLive ? (
            <LockedRow
              icon="pricetag-outline"
              label="Ticket Price"
              value={isFree ? 'Free' : `₹${price}`}
            />
          ) : (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Free Event</Text>
                <Switch
                  value={isFree}
                  onValueChange={setIsFree}
                  trackColor={{ false: '#2E4A63', true: '#34C759' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {!isFree && (
                <>
                  <Text style={styles.fieldLabel}>Ticket Price (₹) *</Text>
                  <TextInput
                    style={styles.input}
                    value={price}
                    onChangeText={setPrice}
                    placeholder="e.g. 499"
                    placeholderTextColor="#506A85"
                    keyboardType="numeric"
                  />
                </>
              )}
            </>
          )}
        </View>

        {/* ════════════════════════════════════════
            SECTION 5 — Capacity (draft: editable / live: locked)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Capacity</Text>
        <View style={styles.card}>
          {isLive ? (
            <LockedRow
              icon="people-outline"
              label="Max Capacity"
              value={capacityTotal ? `${capacityTotal} attendees` : 'Unlimited'}
            />
          ) : (
            <>
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Unlimited Capacity</Text>
                <Switch
                  value={capacityType === 'unlimited'}
                  onValueChange={v => setCapacityType(v ? 'unlimited' : 'limited')}
                  trackColor={{ false: '#2E4A63', true: '#378BBB' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {capacityType === 'limited' && (
                <>
                  <Text style={styles.fieldLabel}>Max Attendees *</Text>
                  <TextInput
                    style={styles.input}
                    value={capacityTotal}
                    onChangeText={setCapacityTotal}
                    placeholder="e.g. 100"
                    placeholderTextColor="#506A85"
                    keyboardType="numeric"
                  />
                </>
              )}
            </>
          )}
        </View>

        {/* ════════════════════════════════════════
            SECTION 6 — Entry Policy (draft: editable / live: locked)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Entry Policy</Text>
        <View style={styles.card}>
          {isLive ? (
            <>
              <LockedRow
                icon="key-outline"
                label="Entry Code Length"
                value={`${entryCodeLength}-digit code`}
              />
              <LockedRow
                icon="people-outline"
                label="Booking Types"
                value={['Solo', bookingDuo ? 'Duo' : null, bookingGroup ? 'Group' : null].filter(Boolean).join(', ')}
              />
              {bookingGroup && (
                <LockedRow
                  icon="people-circle-outline"
                  label="Max Group Size"
                  value={`${maxGroupSize} people max`}
                />
              )}
            </>
          ) : (
            <>
              <Text style={styles.fieldLabel}>Entry Code Length</Text>
              <View style={styles.codeRow}>
                {CODE_LENGTHS.map(len => (
                  <TouchableOpacity
                    key={len}
                    style={[styles.codeChip, entryCodeLength === len && styles.codeChipActive]}
                    onPress={() => setEntryCodeLength(len)}
                  >
                    <Text style={[styles.codeChipText, entryCodeLength === len && styles.codeChipTextActive]}>
                      {len}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[styles.fieldLabel, { marginTop: 12 }]}>Allowed Booking Types</Text>
              <View style={[styles.bookingTypeRow, styles.bookingTypeRowLocked]}>
                <View style={styles.bookingTypeLeft}>
                  <Ionicons name="person-outline" size={16} color="#506A85" />
                  <View>
                    <Text style={styles.bookingTypeLabel}>Solo</Text>
                    <Text style={styles.bookingTypeSub}>Always enabled</Text>
                  </View>
                </View>
                <Ionicons name="checkmark-circle" size={20} color="#378BBB" />
              </View>
              <TouchableOpacity
                style={[styles.bookingTypeRow, bookingDuo && styles.bookingTypeRowActive]}
                onPress={() => setBookingDuo(v => !v)}
              >
                <View style={styles.bookingTypeLeft}>
                  <Ionicons name="people-outline" size={16} color={bookingDuo ? '#378BBB' : '#506A85'} />
                  <View>
                    <Text style={[styles.bookingTypeLabel, bookingDuo && { color: '#FFFFFF' }]}>Duo</Text>
                    <Text style={styles.bookingTypeSub}>Two people, one code</Text>
                  </View>
                </View>
                <Ionicons name={bookingDuo ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={bookingDuo ? '#378BBB' : '#506A85'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.bookingTypeRow, bookingGroup && styles.bookingTypeRowGroupActive]}
                onPress={() => setBookingGroup(v => !v)}
              >
                <View style={styles.bookingTypeLeft}>
                  <Ionicons name="people-circle-outline" size={16} color={bookingGroup ? '#AF52DE' : '#506A85'} />
                  <View>
                    <Text style={[styles.bookingTypeLabel, bookingGroup && { color: '#FFFFFF' }]}>Group</Text>
                    <Text style={styles.bookingTypeSub}>3 or more, one code</Text>
                  </View>
                </View>
                <Ionicons name={bookingGroup ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={bookingGroup ? '#AF52DE' : '#506A85'} />
              </TouchableOpacity>
              {bookingGroup && (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.fieldLabel}>Max Group Size</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 6  (min 3, max 20)"
                    placeholderTextColor="#506A85"
                    value={maxGroupSize}
                    onChangeText={setMaxGroupSize}
                    keyboardType="number-pad"
                  />
                </View>
              )}
            </>
          )}
        </View>

        {/* ════════════════════════════════════════
            SECTION 7 — Restrictions (draft: editable / live: locked)
        ════════════════════════════════════════ */}
        <Text style={styles.sectionLabel}>Restrictions</Text>
        <View style={styles.card}>
          {isLive ? (
            <>
              <LockedRow
                icon="person-outline"
                label="Age Restriction"
                value={hasAge
                  ? `${ageMin}${ageMax ? `–${ageMax}` : '+'} years`
                  : 'None'}
              />
              <LockedRow
                icon="male-female-outline"
                label="Gender Restriction"
                value={hasGender && selectedGenders.length > 0
                  ? selectedGenders.join(', ')
                  : 'None'}
              />
            </>
          ) : (
            <>
              {/* Age */}
              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Age Restriction</Text>
                <Switch
                  value={hasAge}
                  onValueChange={setHasAge}
                  trackColor={{ false: '#2E4A63', true: '#378BBB' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {hasAge && (
                <View style={styles.row2Col}>
                  <View style={styles.col2}>
                    <Text style={styles.fieldLabel}>Min Age</Text>
                    <TextInput
                      style={styles.input}
                      value={ageMin}
                      onChangeText={setAgeMin}
                      keyboardType="numeric"
                      placeholder="18"
                      placeholderTextColor="#506A85"
                    />
                  </View>
                  <View style={styles.col2}>
                    <Text style={styles.fieldLabel}>Max Age (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={ageMax}
                      onChangeText={setAgeMax}
                      keyboardType="numeric"
                      placeholder="No limit"
                      placeholderTextColor="#506A85"
                    />
                  </View>
                </View>
              )}

              {/* Gender */}
              <View style={[styles.switchRow, { marginTop: 6 }]}>
                <Text style={styles.switchLabel}>Gender Restriction</Text>
                <Switch
                  value={hasGender}
                  onValueChange={setHasGender}
                  trackColor={{ false: '#2E4A63', true: '#378BBB' }}
                  thumbColor="#FFFFFF"
                />
              </View>
              {hasGender && (
                <View style={styles.genderRow}>
                  {GENDERS.map(g => {
                    const active = selectedGenders.includes(g);
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[styles.genderChip, active && styles.genderChipActive]}
                        onPress={() => toggleGender(g)}
                      >
                        <Text style={[styles.genderChipText, active && styles.genderChipTextActive]}>
                          {g}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </>
          )}
        </View>

        <View style={{ height: 40 }} />
      </KeyboardAwareScrollView>

      {/* ── Category Modal ── */}
      <Modal
        visible={categoryModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setCategoryModalVisible(false)}
        />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.modalHandle} />
          <Text style={styles.modalTitle}>Select Category</Text>
          <FlatList
            data={EVENT_CATEGORIES}
            keyExtractor={item => item.label}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const active = category === item.label;
              return (
                <TouchableOpacity
                  style={[styles.categoryItem, active && styles.categoryItemActive]}
                  onPress={() => { setCategory(item.label); setCategoryModalVisible(false); }}
                >
                  <Ionicons name={item.icon as any} size={20} color={active ? '#FF4D6D' : '#506A85'} />
                  <Text style={[styles.categoryItemText, active && { color: '#FF4D6D' }]}>
                    {item.label}
                  </Text>
                  {active && <Ionicons name="checkmark" size={18} color="#FF4D6D" />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },
  centered:  { alignItems: 'center', justifyContent: 'center' },

  // banner
  bannerPicker: {
    width: '100%', height: 160, borderRadius: 12,
    overflow: 'hidden', backgroundColor: '#132232',
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.2)',
    marginBottom: 4,
  },
  bannerPreview: { width: '100%', height: '100%' },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  bannerOverlayText: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bannerEmptyText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#2E4A63' },

  // extra photos
  photosRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
  photoThumb: { width: 72, height: 72, borderRadius: 10, overflow: 'hidden' },
  photoThumbImg: { width: '100%', height: '100%' },
  photoRemoveBtn: {
    position: 'absolute', top: 2, right: 2,
    backgroundColor: '#0E1621', borderRadius: 10,
  },
  photoAddBtn: {
    width: 72, height: 72, borderRadius: 10,
    backgroundColor: '#132232',
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // video
  videoRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#132232', borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.2)',
    marginBottom: 4,
  },
  videoChip: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  videoChipText: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#B8C7D9' },

  // header
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12, gap: 12,
    backgroundColor: '#0E1621',
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(55,139,187,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  saveBtn: {
    backgroundColor: '#FF4D6D', borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8, minWidth: 60, alignItems: 'center',
  },
  saveBtnText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  // lock notice
  lockNotice: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginHorizontal: 16, marginBottom: 8,
    backgroundColor: 'rgba(255,159,10,0.08)',
    borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: 'rgba(255,159,10,0.2)',
  },
  lockNoticeText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Regular', color: '#FF9F0A', lineHeight: 18 },

  // scroll
  scrollContent: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },

  // sections
  sectionLabel: {
    fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#506A85',
    textTransform: 'uppercase', letterSpacing: 0.8,
    marginTop: 16, marginBottom: 6, marginLeft: 2,
  },
  card: {
    backgroundColor: '#1B2F48', borderRadius: 14,
    padding: 16, gap: 4,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.12)',
  },

  // fields
  fieldLabel: {
    fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#7F93AA',
    marginTop: 8, marginBottom: 6,
  },
  input: {
    backgroundColor: '#132232', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
    paddingHorizontal: 14, paddingVertical: 11,
    fontSize: 14, fontFamily: 'Inter-Regular', color: '#FFFFFF',
    marginBottom: 4,
  },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },

  // selector (category / date)
  selector: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#132232', borderRadius: 10, borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
    paddingHorizontal: 14, paddingVertical: 12, marginBottom: 4,
  },
  selectorText: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#FFFFFF' },

  // tags
  tagInputRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  tagAddBtn: {
    width: 44, height: 44, borderRadius: 10,
    backgroundColor: '#FF4D6D', alignItems: 'center', justifyContent: 'center',
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(55,139,187,0.12)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  tagChipText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#B8C7D9' },

  // switch rows
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: 6,
  },
  switchLabel: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  // code length
  codeRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  codeChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: '#132232', borderWidth: 1, borderColor: 'rgba(55,139,187,0.2)',
  },
  codeChipActive:     { backgroundColor: '#FF4D6D', borderColor: '#FF4D6D' },
  codeChipText:       { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#506A85' },
  codeChipTextActive: { color: '#FFFFFF' },
  bookingTypeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#132232', borderRadius: 10,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
    padding: 12, marginBottom: 6, marginTop: 2,
  },
  bookingTypeRowLocked:      { opacity: 0.55 },
  bookingTypeRowActive:      { borderColor: '#378BBB', backgroundColor: 'rgba(55,139,187,0.08)' },
  bookingTypeRowGroupActive: { borderColor: '#AF52DE', backgroundColor: 'rgba(175,82,222,0.08)' },
  bookingTypeLeft:  { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bookingTypeLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  bookingTypeSub:   { fontSize: 11, fontFamily: 'Inter-Regular',  color: '#506A85', marginTop: 1 },

  // 2-col row
  row2Col: { flexDirection: 'row', gap: 12 },
  col2:    { flex: 1 },

  // gender chips
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  genderChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.25)',
  },
  genderChipActive:     { backgroundColor: '#FF4D6D', borderColor: '#FF4D6D' },
  genderChipText:       { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#506A85' },
  genderChipTextActive: { color: '#FFFFFF' },

  // category modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#1B2F48', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingTop: 12, paddingHorizontal: 16, maxHeight: '60%',
  },
  modalHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(184,199,217,0.3)', alignSelf: 'center', marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16, fontFamily: 'Inter-Bold', color: '#FFFFFF', marginBottom: 12,
  },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 13, borderRadius: 10, paddingHorizontal: 8,
  },
  categoryItemActive: { backgroundColor: 'rgba(255,77,109,0.08)' },
  categoryItemText: {
    flex: 1, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#B8C7D9',
  },
});

export default EditEventScreen;
