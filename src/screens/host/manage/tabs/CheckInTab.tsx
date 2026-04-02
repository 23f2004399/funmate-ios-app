import React, { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

type EntryStatus = 'pending' | 'checked_in' | 'rejected';

type BookingMember = {
  id: string;
  userId: string;
  bookingType: 'solo' | 'duo' | 'group';
  quantity: number;
  attendeeSnapshot: { name: string; age: number; gender: string };
  entryStatus: EntryStatus;
  status: 'confirmed' | 'cancelled';
  verifiedAt: any;
};

type LookupState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'not_found' }
  | { phase: 'exhausted' }    // all members already checked-in or rejected
  | { phase: 'cancelled' }    // booking was cancelled
  | { phase: 'found'; members: BookingMember[]; photos: Record<string, string | null> };

type Props = { eventId: string };

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#FF4D6D', '#FF9F0A', '#34C759', '#378BBB', '#AF52DE',
  '#FF6B35', '#00C896', '#5856D6', '#FF2D55', '#007AFF',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

const getAvatarColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

const fmtTime = (ts: any): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('en-IN', {
      hour: 'numeric', minute: '2-digit', hour12: true,
      day: 'numeric', month: 'short',
    });
  } catch { return '—'; }
};

const groupLabel = (members: BookingMember[]): string => {
  const type = members[0]?.bookingType;
  if (type === 'solo') return 'Solo Booking';
  if (type === 'duo')  return 'Duo Booking · 2 people';
  const qty = members[0]?.quantity ?? members.length;
  return `Group Booking · ${qty} people`;
};

// ─── Avatar w/ photo ─────────────────────────────────────────────────────────

const Avatar = React.memo(({ userId, name, photoUrl, size = 56 }: {
  userId: string; name: string; photoUrl?: string | null; size?: number;
}) => {
  const [loaded, setLoaded] = useState(false);
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden' }}>
      <View style={[avStyles.bg, { backgroundColor: getAvatarColor(userId) }]}>
        <Text style={[avStyles.initials, { fontSize: size * 0.32 }]}>{getInitials(name)}</Text>
      </View>
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={[avStyles.img, { opacity: loaded ? 1 : 0 }]}
          onLoad={() => setLoaded(true)}
        />
      ) : null}
    </View>
  );
});

const avStyles = StyleSheet.create({
  bg:       { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: 'Inter-Bold', color: '#FFF' },
  img:      { ...StyleSheet.absoluteFillObject },
});

// ─── Member Card ──────────────────────────────────────────────────────────────

const MemberCard = ({
  member,
  photoUrl,
  onConfirm,
  onReject,
  busy,
}: {
  member: BookingMember;
  photoUrl?: string | null;
  onConfirm: (id: string) => void;
  onReject:  (id: string) => void;
  busy: boolean;
}) => {
  const isCheckedIn = member.entryStatus === 'checked_in';
  const isRejected  = member.entryStatus === 'rejected';
  const isCancelled = member.status === 'cancelled';
  // Cancelled members must never be checked in — treat as done so buttons stay hidden
  const isDone      = isCheckedIn || isRejected || isCancelled;

  return (
    <View style={[
      mcStyles.card,
      isCheckedIn && mcStyles.cardCheckedIn,
      isRejected  && mcStyles.cardRejected,
      isCancelled && mcStyles.cardCancelled,
    ]}>
      {/* ── Top row: avatar + details ── */}
      <View style={mcStyles.topRow}>
        <Avatar userId={member.userId} name={member.attendeeSnapshot.name} photoUrl={photoUrl} />

        <View style={mcStyles.details}>
          <View style={mcStyles.nameRow}>
            <Text style={[mcStyles.name, isDone && mcStyles.nameDim]} numberOfLines={1}>
              {member.attendeeSnapshot.name}
            </Text>
            {isCancelled && (
              <View style={mcStyles.cancBadge}>
                <Text style={mcStyles.cancBadgeText}>Cancelled</Text>
              </View>
            )}
          </View>
          <Text style={mcStyles.meta}>
            {member.attendeeSnapshot.age} yrs · {member.attendeeSnapshot.gender}
          </Text>

          {isCheckedIn && (
            <View style={mcStyles.statusRow}>
              <Ionicons name="checkmark-circle" size={14} color="#34C759" />
              <Text style={mcStyles.checkedInText}>Checked in · {fmtTime(member.verifiedAt)}</Text>
            </View>
          )}
          {isRejected && (
            <View style={mcStyles.statusRow}>
              <Ionicons name="close-circle" size={14} color="#FF5252" />
              <Text style={mcStyles.rejectedText}>Entry Rejected</Text>
            </View>
          )}
        </View>
      </View>

      {/* ── Action buttons (only if still pending) ── */}
      {!isDone && (
        <View style={mcStyles.actions}>
          <TouchableOpacity
            style={mcStyles.rejectBtn}
            onPress={() => onReject(member.id)}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FF5252" />
            ) : (
              <>
                <Ionicons name="close" size={16} color="#FF5252" />
                <Text style={mcStyles.rejectBtnText}>Reject</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={mcStyles.confirmBtn}
            onPress={() => onConfirm(member.id)}
            disabled={busy}
            activeOpacity={0.8}
          >
            {busy ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={mcStyles.confirmBtnText}>Confirm Check-In</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

const mcStyles = StyleSheet.create({
  card: {
    backgroundColor: '#132232',
    borderRadius: 14, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
    gap: 14,
  },
  cardCheckedIn: { borderColor: 'rgba(52,199,89,0.3)',  backgroundColor: 'rgba(52,199,89,0.05)' },
  cardRejected:  { borderColor: 'rgba(255,82,82,0.25)', backgroundColor: 'rgba(255,82,82,0.04)' },
  cardCancelled: { borderColor: 'rgba(255,159,10,0.2)', backgroundColor: 'rgba(255,159,10,0.04)' },
  topRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  details:  { flex: 1 },
  nameRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  name:     { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF', flexShrink: 1 },
  nameDim:  { color: '#7F93AA' },
  meta:     { fontSize: 13, fontFamily: 'Inter-Regular', color: '#B8C7D9', marginTop: 3 },
  statusRow:{ flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  checkedInText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#34C759' },
  rejectedText:  { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FF5252' },
  cancBadge: {
    backgroundColor: 'rgba(255,159,10,0.15)', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  cancBadgeText: { fontSize: 10, fontFamily: 'Inter-SemiBold', color: '#FF9F0A' },
  actions: { flexDirection: 'row', gap: 10 },
  rejectBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 11,
    backgroundColor: 'rgba(255,82,82,0.1)',
    borderWidth: 1, borderColor: 'rgba(255,82,82,0.25)',
  },
  rejectBtnText:  { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FF5252' },
  confirmBtn: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    borderRadius: 10, paddingVertical: 11,
    backgroundColor: '#34C759',
  },
  confirmBtnText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
});

// ─── Main Tab ────────────────────────────────────────────────────────────────

const CheckInTab = ({ eventId }: Props) => {
  const [code,      setCode]      = useState('');
  const [lookup,    setLookup]    = useState<LookupState>({ phase: 'idle' });
  // Set instead of single id — prevents race when host taps two cards before first resolves
  const [busyIds,   setBusyIds]   = useState<Set<string>>(new Set());
  const inputRef = useRef<TextInput>(null);

  // ── Lookup ────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;

    setLookup({ phase: 'loading' });
    inputRef.current?.blur();

    try {
      const snap = await firestore()
        .collection('eventBookings')
        .where('eventId',   '==', eventId)
        .where('entryCode', '==', trimmed)
        .get();

      if (snap.empty) {
        setLookup({ phase: 'not_found' });
        return;
      }

      const members = snap.docs.map(d => ({ id: d.id, ...d.data() } as BookingMember));

      // If all members are cancelled
      if (members.every(m => m.status === 'cancelled')) {
        setLookup({ phase: 'cancelled' });
        return;
      }

      // If every non-cancelled member is already done (checked_in or rejected).
      // Guard: treat missing entryStatus field as 'pending' to avoid false exhausted state.
      const active = members.filter(m => m.status !== 'cancelled');
      if (active.length > 0 && active.every(m => (m.entryStatus ?? 'pending') !== 'pending')) {
        setLookup({ phase: 'exhausted' });
        return;
      }

      // Batch-fetch photos for all member userIds
      const userIds = [...new Set(members.map(m => m.userId))];
      const photos: Record<string, string | null> = {};
      await Promise.all(
        userIds.map(async uid => {
          try {
            const uSnap = await firestore().collection('users').doc(uid).get();
            const d = uSnap.data();
            const primary = (d?.photos ?? []).find((p: any) => p.isPrimary) ?? d?.photos?.[0] ?? null;
            photos[uid] = primary?.url ?? null;
          } catch {
            photos[uid] = null;
          }
        }),
      );

      setLookup({ phase: 'found', members, photos });
    } catch {
      setLookup({ phase: 'not_found' });
    }
  }, [code, eventId]);

  // ── Confirm check-in ──────────────────────────────────────────────────────
  const handleConfirm = useCallback(async (bookingId: string) => {
    setBusyIds(prev => new Set(prev).add(bookingId));
    try {
      const uid = auth().currentUser?.uid ?? '';
      await firestore().collection('eventBookings').doc(bookingId).update({
        entryStatus: 'checked_in',
        verifiedBy:  uid,
        verifiedAt:  firestore.FieldValue.serverTimestamp(),
      });
      // Update local state to reflect change immediately
      setLookup(prev => {
        if (prev.phase !== 'found') return prev;
        return {
          ...prev,
          members: prev.members.map(m =>
            m.id === bookingId
              ? { ...m, entryStatus: 'checked_in' as EntryStatus, verifiedAt: new Date() }
              : m,
          ),
        };
      });
    } catch {
      // silent — will retry naturally
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(bookingId); return s; });
    }
  }, []);

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = useCallback(async (bookingId: string) => {
    setBusyIds(prev => new Set(prev).add(bookingId));
    try {
      const uid = auth().currentUser?.uid ?? '';
      await firestore().collection('eventBookings').doc(bookingId).update({
        entryStatus: 'rejected',
        verifiedBy:  uid,
        verifiedAt:  firestore.FieldValue.serverTimestamp(),
      });
      setLookup(prev => {
        if (prev.phase !== 'found') return prev;
        return {
          ...prev,
          members: prev.members.map(m =>
            m.id === bookingId
              ? { ...m, entryStatus: 'rejected' as EntryStatus }
              : m,
          ),
        };
      });
    } catch {
      // silent
    } finally {
      setBusyIds(prev => { const s = new Set(prev); s.delete(bookingId); return s; });
    }
  }, []);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setCode('');
    setLookup({ phase: 'idle' });
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Render result ─────────────────────────────────────────────────────────
  const renderResult = () => {
    if (lookup.phase === 'loading') {
      return (
        <View style={styles.resultBox}>
          <ActivityIndicator size="large" color="#378BBB" />
        </View>
      );
    }

    if (lookup.phase === 'not_found') {
      return (
        <View style={[styles.resultBox, styles.resultError]}>
          <Ionicons name="close-circle" size={36} color="#FF5252" />
          <Text style={styles.resultErrorTitle}>Invalid Code</Text>
          <Text style={styles.resultErrorSub}>No booking found for this code at this event.</Text>
          <TouchableOpacity style={styles.tryAgainBtn} onPress={handleReset}>
            <Text style={styles.tryAgainText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (lookup.phase === 'exhausted') {
      return (
        <View style={[styles.resultBox, styles.resultWarning]}>
          <Ionicons name="checkmark-done-circle" size={36} color="#FF9F0A" />
          <Text style={styles.resultWarningTitle}>Already Fully Checked In</Text>
          <Text style={styles.resultWarningSub}>All members on this code have already been processed.</Text>
          <TouchableOpacity style={styles.tryAgainBtn} onPress={handleReset}>
            <Text style={styles.tryAgainText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (lookup.phase === 'cancelled') {
      return (
        <View style={[styles.resultBox, styles.resultWarning]}>
          <Ionicons name="ban" size={36} color="#FF9F0A" />
          <Text style={styles.resultWarningTitle}>Booking Cancelled</Text>
          <Text style={styles.resultWarningSub}>This booking was cancelled. Entry should be denied.</Text>
          <TouchableOpacity style={styles.tryAgainBtn} onPress={handleReset}>
            <Text style={styles.tryAgainText}>Scan Another</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (lookup.phase === 'found') {
      const { members, photos } = lookup;
      const pendingCount = members.filter(m => m.entryStatus === 'pending').length;

      return (
        <View style={styles.foundContainer}>
          {/* Group header */}
          <View style={styles.groupHeader}>
            <View style={styles.groupHeaderLeft}>
              <Ionicons
                name={members[0]?.bookingType === 'solo' ? 'person-circle-outline' : 'people-circle-outline'}
                size={20}
                color="#378BBB"
              />
              <Text style={styles.groupLabel}>{groupLabel(members)}</Text>
            </View>
            {pendingCount > 0 && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>{pendingCount} pending</Text>
              </View>
            )}
          </View>

          {/* Member cards */}
          {members.map(m => (
            <MemberCard
              key={m.id}
              member={m}
              photoUrl={photos[m.userId]}
              onConfirm={handleConfirm}
              onReject={handleReject}
              busy={busyIds.has(m.id)}
            />
          ))}

          {/* Scan another button */}
          <TouchableOpacity style={styles.scanAnotherBtn} onPress={handleReset}>
            <Ionicons name="refresh-outline" size={16} color="#378BBB" />
            <Text style={styles.scanAnotherText}>Scan Another Code</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header hint ── */}
      <View style={styles.hintRow}>
        <Ionicons name="information-circle-outline" size={15} color="#506A85" />
        <Text style={styles.hintText}>Enter the attendee's entry code to verify and check them in.</Text>
      </View>

      {/* ── Code input ── */}
      <View style={styles.inputCard}>
        <Text style={styles.inputLabel}>Entry Code</Text>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            value={code}
            onChangeText={v => {
              setCode(v.toUpperCase());
              if (lookup.phase !== 'idle') setLookup({ phase: 'idle' });
            }}
            placeholder="e.g. A3K7F2"
            placeholderTextColor="#506A85"
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleVerify}
            keyboardAppearance="dark"
            maxLength={10}
          />
          {code.length > 0 && (
            <TouchableOpacity
              onPress={() => { setCode(''); setLookup({ phase: 'idle' }); }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearBtn}
            >
              <Ionicons name="close-circle" size={18} color="#506A85" />
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, (!code.trim() || lookup.phase === 'loading') && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={!code.trim() || lookup.phase === 'loading'}
          activeOpacity={0.85}
        >
          {lookup.phase === 'loading' ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="search" size={18} color="#FFF" />
              <Text style={styles.verifyBtnText}>Verify Code</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* ── Result area ── */}
      {renderResult()}
    </ScrollView>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },
  content:   { padding: 16, paddingBottom: 40 },

  // hint
  hintRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 7,
    marginBottom: 14,
  },
  hintText: { flex: 1, fontSize: 12, fontFamily: 'Inter-Regular', color: '#506A85', lineHeight: 18 },

  // input card
  inputCard: {
    backgroundColor: '#132232',
    borderRadius: 16, padding: 18, marginBottom: 20,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
    gap: 12,
  },
  inputLabel: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#7F93AA', textTransform: 'uppercase', letterSpacing: 0.8 },
  inputRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#0E1621', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.3)',
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 22, fontFamily: 'Inter-Bold', color: '#FFFFFF',
    letterSpacing: 3, textAlign: 'center',
  },
  clearBtn: { padding: 4 },
  verifyBtn: {
    backgroundColor: '#378BBB', borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  verifyBtnDisabled: { backgroundColor: '#1B3A52', opacity: 0.6 },
  verifyBtnText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  // result boxes (error / warning)
  resultBox: {
    backgroundColor: '#132232', borderRadius: 16, padding: 28,
    alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.12)',
  },
  resultError:   { borderColor: 'rgba(255,82,82,0.2)',   backgroundColor: 'rgba(255,82,82,0.04)'   },
  resultWarning: { borderColor: 'rgba(255,159,10,0.2)',  backgroundColor: 'rgba(255,159,10,0.04)'  },
  resultErrorTitle:   { fontSize: 17, fontFamily: 'Inter-Bold',    color: '#FF5252',  marginTop: 4 },
  resultErrorSub:     { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7F93AA', textAlign: 'center' },
  resultWarningTitle: { fontSize: 17, fontFamily: 'Inter-Bold',    color: '#FF9F0A', marginTop: 4 },
  resultWarningSub:   { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7F93AA', textAlign: 'center' },
  tryAgainBtn: {
    marginTop: 8, paddingHorizontal: 24, paddingVertical: 10,
    backgroundColor: '#1B3A52', borderRadius: 20,
  },
  tryAgainText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },

  // found result
  foundContainer: { gap: 0 },
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  groupHeaderLeft:  { flexDirection: 'row', alignItems: 'center', gap: 7 },
  groupLabel:       { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  pendingBadge:     {
    backgroundColor: 'rgba(255,159,10,0.15)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  pendingBadgeText: { fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#FF9F0A' },

  scanAnotherBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 8, paddingVertical: 14,
    backgroundColor: 'rgba(55,139,187,0.08)', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
  },
  scanAnotherText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#378BBB' },
});

export default CheckInTab;
