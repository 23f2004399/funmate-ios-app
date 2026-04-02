import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

// ─── Types ────────────────────────────────────────────────────────────────────

type FilterKey = 'all' | 'completed' | 'pending' | 'failed';

type Settlement = {
  id: string;
  amount: number;
  gstDeducted: number;
  tdsDeducted: number;
  netAmount: number;
  utrNumber: string | null;
  period: string;
  periodStart: any;
  periodEnd: any;
  status: 'pending' | 'completed' | 'failed';
  processedAt: any | null;
  createdAt: any;
};

type BankAccount = {
  bankName: string;
  accountHolderName: string;
  accountLast4: string;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',       label: 'All'       },
  { key: 'completed', label: 'Completed' },
  { key: 'pending',   label: 'Pending'   },
  { key: 'failed',    label: 'Failed'    },
];

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  completed: { label: 'Completed', color: '#34C759', bg: 'rgba(52,199,89,0.15)',   icon: 'checkmark-circle'     },
  pending:   { label: 'Pending',   color: '#FF9F0A', bg: 'rgba(255,159,10,0.15)', icon: 'time-outline'         },
  failed:    { label: 'Failed',    color: '#FF5252', bg: 'rgba(255,82,82,0.15)',   icon: 'close-circle'         },
};



// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) => `₹${(n ?? 0).toLocaleString('en-IN')}`;

const fmtDate = (ts: any): string => {
  if (!ts) return '—';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

const fmtPeriod = (start: any, end: any): string => {
  if (!start || !end) return '—';
  try {
    const s = start.toDate ? start.toDate() : new Date(start);
    const e = end.toDate   ? end.toDate()   : new Date(end);
    const sameMonth = s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
    if (sameMonth) {
      return `${s.getDate()} – ${e.getDate()} ${e.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`;
    }
    return `${s.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${e.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
  } catch { return '—'; }
};

// ─── Settlement Card ──────────────────────────────────────────────────────────

const SettlementCard = React.memo(({ item }: { item: Settlement }) => {
  const cfg         = STATUS_CFG[item.status] ?? STATUS_CFG.pending;
  const isCompleted = item.status === 'completed';
  const isFailed    = item.status === 'failed';
  const isPending   = item.status === 'pending';

  return (
    <View style={cStyles.card}>

      {/* ── Period + status badge ── */}
      <View style={cStyles.header}>
        <View style={cStyles.headerLeft}>
          <Ionicons name="calendar-outline" size={14} color="#506A85" />
          <Text style={cStyles.period}>{fmtPeriod(item.periodStart, item.periodEnd)}</Text>
        </View>
        <View style={[cStyles.badge, { backgroundColor: cfg.bg }]}>
          <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
          <Text style={[cStyles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
      </View>

      {isFailed ? (
        <View style={cStyles.failNote}>
          <Ionicons name="warning-outline" size={14} color="#FF5252" />
          <Text style={cStyles.failText}>
            Payout failed. Please verify your bank account or contact support.
          </Text>
        </View>
      ) : (
        <>
          <View style={cStyles.divider} />

          {/* ── Gross ── */}
          <View style={cStyles.row}>
            <Text style={cStyles.rowLabel}>Gross Collected</Text>
            <Text style={cStyles.rowValue}>{fmt(item.amount)}</Text>
          </View>

          {/* ── GST ── */}
          {item.gstDeducted > 0 && (
            <View style={cStyles.row}>
              <Text style={cStyles.rowLabel}>GST Deducted</Text>
              <Text style={[cStyles.rowValue, cStyles.deduct]}>−{fmt(item.gstDeducted)}</Text>
            </View>
          )}

          {/* ── TDS ── */}
          {item.tdsDeducted > 0 && (
            <View style={cStyles.row}>
              <Text style={cStyles.rowLabel}>TDS Deducted</Text>
              <Text style={[cStyles.rowValue, cStyles.deduct]}>−{fmt(item.tdsDeducted)}</Text>
            </View>
          )}

          <View style={cStyles.divider} />

          {/* ── Net ── */}
          <View style={cStyles.row}>
            <Text style={cStyles.netLabel}>{isPending ? 'Est. Net Payout' : 'Net Paid'}</Text>
            <Text style={[cStyles.netValue, isPending && cStyles.netEst]}>
              {isPending ? '~ ' : ''}{fmt(item.netAmount)}
            </Text>
          </View>

          {/* ── UTR + paid date ── */}
          {isCompleted && (item.utrNumber || item.processedAt) ? (
            <View style={cStyles.footer}>
              {item.utrNumber ? (
                <View style={cStyles.utrChip}>
                  <Ionicons name="swap-horizontal-outline" size={11} color="#7F93AA" />
                  <Text style={cStyles.utrText}>UTR: {item.utrNumber}</Text>
                </View>
              ) : null}
              {item.processedAt ? (
                <Text style={cStyles.paidDate}>Paid {fmtDate(item.processedAt)}</Text>
              ) : null}
            </View>
          ) : null}

          {isPending && (
            <Text style={cStyles.etaText}>Expected within T+3 business days</Text>
          )}
        </>
      )}
    </View>
  );
});

const cStyles = StyleSheet.create({
  card: {
    backgroundColor: '#132232',
    borderRadius: 16, padding: 18, marginBottom: 12,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.12)',
  },
  header:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  period:     { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  badgeText: { fontSize: 12, fontFamily: 'Inter-SemiBold' },
  divider:   { height: 1, backgroundColor: 'rgba(55,139,187,0.1)', marginVertical: 14 },
  row:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  rowLabel:  { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7F93AA' },
  rowValue:  { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  deduct:    { color: '#FF7878' },
  netLabel:  { fontSize: 15, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  netValue:  { fontSize: 18, fontFamily: 'Inter-Bold', color: '#34C759' },
  netEst:    { color: '#FF9F0A' },
  footer:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  utrChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#0E1621', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  utrText:  { fontSize: 11, fontFamily: 'Inter-Medium', color: '#7F93AA' },
  paidDate: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85' },
  etaText:  { marginTop: 10, fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85', fontStyle: 'italic' },
  failNote: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 8,
    marginTop: 12, padding: 12,
    backgroundColor: 'rgba(255,82,82,0.06)', borderRadius: 10,
  },
  failText: { flex: 1, fontSize: 13, fontFamily: 'Inter-Regular', color: '#FF7878', lineHeight: 19 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const HostPayoutsScreen = () => {
  const insets = useSafeAreaInsets();
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [bankAccount, setBankAccount] = useState<BankAccount | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [filter,      setFilter]      = useState<FilterKey>('all');

  const uid = auth().currentUser?.uid;

  const fetchData = useCallback(async () => {
    if (!uid) { setLoading(false); return; }
    try {
      const [settSnap, bankSnap] = await Promise.all([
        firestore()
          .collection('settlements')
          .where('accountId', '==', uid)
          .orderBy('createdAt', 'desc')
          .get(),
        firestore().collection('bankAccounts').doc(uid).get(),
      ]);
      setSettlements(settSnap.docs.map(d => ({ id: d.id, ...d.data() } as Settlement)));
      setBankAccount(bankSnap.exists() ? (bankSnap.data() as BankAccount) : null);
    } catch {
      // network error — leave existing state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = useCallback(() => { setRefreshing(true); fetchData(); }, [fetchData]);

  const summary = useMemo(() => ({
    totalPaid: settlements
      .filter(s => s.status === 'completed')
      .reduce((acc, s) => acc + (s.netAmount ?? 0), 0),
    pending: settlements
      .filter(s => s.status === 'pending')
      .reduce((acc, s) => acc + (s.netAmount ?? 0), 0),
    count: settlements.length,
  }), [settlements]);

  const filtered = useMemo(
    () => filter === 'all' ? settlements : settlements.filter(s => s.status === filter),
    [settlements, filter],
  );

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <StatusBar barStyle="light-content" backgroundColor="#0E1621" />
        <ActivityIndicator size="large" color="#378BBB" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* ── Header ── */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Payouts</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#378BBB"
            colors={['#378BBB']}
          />
        }
      >
        {/* ── Total paid out (main card) ── */}
        <View style={styles.summaryMain}>
          <Text style={styles.summaryMainLabel}>Total Paid Out</Text>
          <Text style={styles.summaryMainValue}>{fmt(summary.totalPaid)}</Text>
        </View>

        {/* ── Pending + count (sub row) ── */}
        <View style={styles.summaryRow}>
          <View style={styles.summarySub}>
            <Text style={styles.summarySubLabel}>Pending</Text>
            <Text style={[styles.summarySubValue, summary.pending > 0 && styles.summaryPending]}>
              {fmt(summary.pending)}
            </Text>
          </View>
          <View style={styles.summarySub}>
            <Text style={styles.summarySubLabel}>Settlements</Text>
            <Text style={styles.summarySubValue}>{summary.count}</Text>
          </View>
        </View>

        {/* ── Payout destination chip ── */}
        {bankAccount && (
          <View style={styles.bankChip}>
            <View style={styles.bankIconWrap}>
              <Ionicons name="business-outline" size={18} color="#378BBB" />
            </View>
            <View style={styles.bankInfo}>
              <Text style={styles.bankLabel}>Payouts sent to</Text>
              <Text style={styles.bankName}>
                {bankAccount.bankName} ••••{bankAccount.accountLast4}
              </Text>
            </View>
          </View>
        )}

        {/* ── Section title ── */}
        <Text style={styles.sectionTitle}>Settlement History</Text>

        {/* ── Filter chips ── */}
        <View style={styles.filterRow}>
          {FILTERS.map(f => (
            <TouchableOpacity
              key={f.key}
              style={[styles.filterChip, filter === f.key && styles.filterChipOn]}
              onPress={() => setFilter(f.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterText, filter === f.key && styles.filterTextOn]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Settlement list ── */}
        {filtered.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="receipt-outline" size={48} color="#1B3A52" />
            <Text style={styles.emptyTitle}>
              {filter === 'all' ? 'No settlements yet' : `No ${filter} settlements`}
            </Text>
            <Text style={styles.emptySub}>
              {filter === 'all'
                ? 'Your settlement history will appear here once your first event payout is processed.'
                : `You have no ${filter} settlements at the moment.`}
            </Text>
          </View>
        ) : (
          filtered.map(item => <SettlementCard key={item.id} item={item} />)
        )}
      </ScrollView>
    </View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },
  center:    { flex: 1, backgroundColor: '#0E1621', justifyContent: 'center', alignItems: 'center' },
  scroll:    { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 48 },

  // Header
  header: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: 'rgba(55,139,187,0.08)',
  },
  headerTitle: { fontSize: 26, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Summary — main total card
  summaryMain: {
    backgroundColor: '#16283D',
    borderRadius: 16, padding: 20, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.2)',
  },
  summaryMainLabel: {
    fontSize: 12, fontFamily: 'Inter-SemiBold', color: '#7F93AA',
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8,
  },
  summaryMainValue: { fontSize: 32, fontFamily: 'Inter-Bold', color: '#FFFFFF' },

  // Summary — sub row (pending + count)
  summaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  summarySub: {
    flex: 1, backgroundColor: '#132232',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.12)',
  },
  summarySubLabel: {
    fontSize: 11, fontFamily: 'Inter-SemiBold', color: '#506A85',
    textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 6,
  },
  summarySubValue: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#FFFFFF' },
  summaryPending:  { color: '#FF9F0A' },

  // Payout destination chip
  bankChip: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#132232', borderRadius: 14, padding: 14, marginBottom: 22,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.15)',
  },
  bankIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: 'rgba(55,139,187,0.1)',
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  bankInfo:  {},
  bankLabel: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85', marginBottom: 3 },
  bankName:  { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },

  // Section title
  sectionTitle: { fontSize: 17, fontFamily: 'Inter-Bold', color: '#FFFFFF', marginBottom: 12 },

  // Filter chips
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
  },
  filterChipOn:  { backgroundColor: '#378BBB', borderColor: '#378BBB' },
  filterText:    { fontSize: 13, fontFamily: 'Inter-Regular', color: '#7F93AA' },
  filterTextOn:  { color: '#FFFFFF', fontFamily: 'Inter-SemiBold' },

  // Empty state
  emptyBox:   { alignItems: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 17, fontFamily: 'Inter-SemiBold', color: '#B8C7D9', marginTop: 16, marginBottom: 8 },
  emptySub:   { fontSize: 13, fontFamily: 'Inter-Regular', color: '#506A85', textAlign: 'center', lineHeight: 20, paddingHorizontal: 20 },
});

export default HostPayoutsScreen;
