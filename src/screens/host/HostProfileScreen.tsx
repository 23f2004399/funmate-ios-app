import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
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
import { CommonActions, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import { useAlert } from '../../contexts/AlertContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type CreatorType = 'individual' | 'merchant';
type AccountStatus = 'active' | 'pending_verification' | 'suspended';

type HostUser = {
  fullName?: string;  // phone/email signup path
  name?: string;     // Google signup path (CreatorGoogleProfileSetupScreen)
  // Individual hosts only
  socialHandles?: {
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    facebook?: string;
  };
  location?: { city?: string };
  creatorDetails?: {
    bio?: string;
    category?: string;
    experienceYears?: number;
    contactEmail?: string;
    website?: string;
    logoUrl?: string;
    // Individual saves category; merchant saves organizationName + socialLinks
    organizationName?: string;
    socialLinks?: string[];       // Merchant: full URLs array
    businessAddress?: {
      addressLine?: string;       // Merchant uses addressLine (not street)
      city?: string;
      state?: string;
      country?: string;
    };
  };
};

type HostAccount = {
  identityVerified: boolean;
  bankVerified: boolean;
  status: AccountStatus;
  creatorType: CreatorType;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#5B6AF5', '#E0854A', '#44B39A', '#C25ED0',
  '#E06060', '#4A90D9', '#7BC67C',
];

const ACCOUNT_STATUS_CFG: Record<AccountStatus, { label: string; color: string; bg: string }> = {
  active:               { label: 'Active',       color: '#34C759', bg: 'rgba(52,199,89,0.15)'   },
  pending_verification: { label: 'Under Review', color: '#FF9F0A', bg: 'rgba(255,159,10,0.15)'  },
  suspended:            { label: 'Suspended',    color: '#FF5252', bg: 'rgba(255,82,82,0.15)'   },
};

// Individual socialHandles map
type SocialKey = 'instagram' | 'twitter' | 'linkedin' | 'facebook';

const SOCIAL_CONFIGS: {
  key: SocialKey;
  icon: string;
  color: string;
  prefix: string;
}[] = [
  { key: 'instagram', icon: 'logo-instagram', color: '#E1306C', prefix: 'https://instagram.com/' },
  { key: 'twitter',   icon: 'logo-twitter',   color: '#1DA1F2', prefix: 'https://twitter.com/'   },
  { key: 'linkedin',  icon: 'logo-linkedin',  color: '#0A66C2', prefix: 'https://linkedin.com/in/' },
  { key: 'facebook',  icon: 'logo-facebook',  color: '#1877F2', prefix: 'https://facebook.com/'  },
];

// Merchant stores social links as full URL strings — parse them to get platform info
const MERCHANT_SOCIAL_PATTERNS: {
  pattern: RegExp;
  icon: string;
  color: string;
  label: string;
}[] = [
  { pattern: /instagram\.com\/([^/?]+)/,  icon: 'logo-instagram', color: '#E1306C', label: 'Instagram' },
  { pattern: /twitter\.com\/([^/?]+)/,    icon: 'logo-twitter',   color: '#1DA1F2', label: 'Twitter'   },
  { pattern: /x\.com\/([^/?]+)/,          icon: 'logo-twitter',   color: '#1DA1F2', label: 'X'         },
  { pattern: /linkedin\.com\/in\/([^/?]+)/, icon: 'logo-linkedin', color: '#0A66C2', label: 'LinkedIn'  },
  { pattern: /facebook\.com\/([^/?]+)/,   icon: 'logo-facebook',  color: '#1877F2', label: 'Facebook'  },
];

type ParsedSocialLink = { url: string; icon: string; color: string; handle: string };

const parseMerchantSocialLinks = (links: string[]): ParsedSocialLink[] =>
  links.flatMap(url => {
    for (const cfg of MERCHANT_SOCIAL_PATTERNS) {
      const m = cfg.pattern.exec(url);
      if (m) return [{ url, icon: cfg.icon, color: cfg.color, handle: `@${m[1]}` }];
    }
    // Generic link — show domain as handle
    try {
      const host = new URL(url).hostname.replace('www.', '');
      return [{ url, icon: 'globe-outline', color: '#7F93AA', handle: host }];
    } catch { return []; }
  });

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getInitials = (name: string) =>
  name.split(' ').slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('');

const getAvatarColor = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
};

// ─── Verification Pill ────────────────────────────────────────────────────────

type PillProps =
  | { label: string; verified: boolean; isStatus?: false }
  | { label: string; isStatus: true; statusCfg: { label: string; color: string; bg: string } };

const VerificationPill = React.memo((props: PillProps) => {
  let color: string;
  let bg: string;
  let icon: string;
  let displayLabel: string;

  if (props.isStatus) {
    color = props.statusCfg.color;
    bg    = props.statusCfg.bg;
    displayLabel = props.statusCfg.label;
    icon = color === '#34C759' ? 'checkmark-circle'
         : color === '#FF5252' ? 'ban-outline'
         : 'time-outline';
  } else {
    color = props.verified ? '#34C759' : '#FF9F0A';
    bg    = props.verified ? 'rgba(52,199,89,0.15)' : 'rgba(255,159,10,0.15)';
    icon  = props.verified ? 'checkmark-circle' : 'time-outline';
    displayLabel = props.label;
  }

  return (
    <View style={[pillStyles.pill, { backgroundColor: bg, borderColor: color + '55' }]}>
      <Ionicons name={icon} size={11} color={color} />
      <Text style={[pillStyles.text, { color }]}>{displayLabel}</Text>
    </View>
  );
});

const pillStyles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    letterSpacing: 0.2,
  },
});

// ─── Info Row ─────────────────────────────────────────────────────────────────

const InfoRow = React.memo(({ icon, text, onPress }: {
  icon: string; text: string; onPress?: () => void;
}) => (
  <TouchableOpacity
    style={infoStyles.row}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <Ionicons name={icon} size={16} color="#506A85" style={{ marginTop: 2 }} />
    <Text style={[infoStyles.text, onPress && infoStyles.link]} numberOfLines={3}>{text}</Text>
    {onPress ? <Ionicons name="open-outline" size={13} color="#378BBB" /> : null}
  </TouchableOpacity>
));

const infoStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 6,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#C8D8E8',
    lineHeight: 20,
  },
  link: {
    color: '#378BBB',
    textDecorationLine: 'underline',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const HostProfileScreen = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const uid        = auth().currentUser?.uid ?? '';

  const { showConfirm } = useAlert();

  const handleLogout = () => {
    showConfirm(
      'Logout',
      'Are you sure you want to logout?',
      async () => {
        try {
          await auth().signOut();
          navigation.dispatch(
            CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] })
          );
          Toast.show({ type: 'success', text1: 'Logged Out', text2: 'See you soon!', visibilityTime: 2000 });
        } catch (e) {
          Toast.show({ type: 'error', text1: 'Logout failed', text2: 'Please try again.' });
        }
      },
      { confirmText: 'Logout', destructive: true, icon: 'log-out-outline' }
    );
  };

  const [hostUser,    setHostUser]    = useState<HostUser | null>(null);
  const [hostAccount, setHostAccount] = useState<HostAccount | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [logoError,   setLogoError]   = useState(false);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    if (!uid) return;
    const [userSnap, accountSnap] = await Promise.all([
      firestore().collection('users').doc(uid).get(),
      firestore().collection('accounts').doc(uid).get(),
    ]);
    setHostUser(userSnap.data() as HostUser ?? null);
    setHostAccount(accountSnap.data() as HostAccount ?? null);
  }, [uid]);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [fetchData]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const isIndividual = hostAccount?.creatorType !== 'merchant';
  // Phone/email signup saves 'fullName'; Google signup saves 'name'
  const fullName     = hostUser?.fullName || hostUser?.name || '';
  const cd           = hostUser?.creatorDetails;

  // Merchants show organisationName as headline; individuals show fullName
  const displayName = isIndividual
    ? fullName
    : (cd?.organizationName || fullName);

  const city = isIndividual
    ? (hostUser?.location?.city ?? '')
    : (cd?.businessAddress?.city ?? '');

  const initials = getInitials(displayName || 'H');
  const avatarBg = getAvatarColor(uid);

  // Individual: socialHandles map  |  Merchant: socialLinks URL array
  const individualSocials = useMemo(() => {
    if (!isIndividual) return [];
    const handles = hostUser?.socialHandles ?? {};
    return SOCIAL_CONFIGS.filter(cfg => !!handles[cfg.key as SocialKey]);
  }, [isIndividual, hostUser]);

  const merchantSocials = useMemo<ParsedSocialLink[]>(() => {
    if (isIndividual) return [];
    return parseMerchantSocialLinks(cd?.socialLinks ?? []);
  }, [isIndividual, cd]);

  const hasSocials = isIndividual ? individualSocials.length > 0 : merchantSocials.length > 0;

  const accountStatusCfg = useMemo(() => {
    const status = (hostAccount?.status ?? 'pending_verification') as AccountStatus;
    return ACCOUNT_STATUS_CFG[status] ?? ACCOUNT_STATUS_CFG.pending_verification;
  }, [hostAccount]);

  const logoUrl = !isIndividual && !logoError
    ? (cd?.logoUrl ?? null)
    : null;

  // ── Loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#0E1621" />
        <ActivityIndicator size="large" color="#378BBB" />
      </View>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const hasAbout = !!(
    cd?.bio ||
    (isIndividual && (cd?.category || typeof cd?.experienceYears === 'number')) ||
    (!isIndividual && (fullName || cd?.businessAddress?.addressLine)) ||
    cd?.contactEmail ||
    cd?.website
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
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
        {/* ── Page title + logout ── */}
        <View style={styles.titleRow}>
          <Text style={styles.pageTitle}>Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutIconBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="log-out-outline" size={24} color="#FF4D6D" />
          </TouchableOpacity>
        </View>

        {/* ── Avatar + identity ── */}
        <View style={styles.avatarSection}>
          {logoUrl ? (
            <Image
              source={{ uri: logoUrl }}
              style={styles.logoImg}
              onError={() => setLogoError(true)}
            />
          ) : (
            <View style={[styles.initialsCircle, { backgroundColor: avatarBg }]}>
              <Text style={styles.initialsText}>{initials}</Text>
            </View>
          )}

          <View style={styles.nameLine}>
            <Text style={styles.nameText} numberOfLines={1}>{displayName || '—'}</Text>
            {hostAccount?.identityVerified && (
              <Ionicons name="checkmark-circle" size={20} color="#3B9DDD" style={{ marginLeft: 6 }} />
            )}
          </View>

          <Text style={styles.subtitleText}>
            {isIndividual ? 'Individual Creator' : 'Merchant Creator'}
            {city ? `  ·  ${city}` : ''}
          </Text>
        </View>

        {/* ── Verification strip ── */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Verification</Text>
          <View style={styles.pillRow}>
            <VerificationPill label="Identity" verified={hostAccount?.identityVerified ?? false} />
            <VerificationPill label="Bank"     verified={hostAccount?.bankVerified     ?? false} />
            <VerificationPill label="Account" isStatus statusCfg={accountStatusCfg} />
          </View>
        </View>

        {/* ── About ── */}
        {hasAbout && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>About</Text>

            {cd?.bio ? (
              <Text style={styles.bioText}>{cd.bio}</Text>
            ) : null}

            {isIndividual && cd?.category ? (
              <InfoRow icon="pricetag-outline" text={cd.category} />
            ) : null}

            {isIndividual && typeof cd?.experienceYears === 'number' && (
              <InfoRow
                icon="briefcase-outline"
                text={`${cd.experienceYears} ${cd.experienceYears === 1 ? 'year' : 'years'} of experience`}
              />
            )}

            {/* Merchant: contact person name (fullName = contact person, displayName = org name) */}
            {!isIndividual && fullName && fullName !== displayName ? (
              <InfoRow icon="person-outline" text={fullName} />
            ) : null}

            {!isIndividual && cd?.businessAddress?.addressLine && (
              <InfoRow
                icon="location-outline"
                text={[
                  cd.businessAddress.addressLine,
                  cd.businessAddress.city,
                  cd.businessAddress.state,
                  cd.businessAddress.country,
                ].filter(Boolean).join(', ')}
              />
            )}

            {cd?.contactEmail ? (
              <InfoRow
                icon="mail-outline"
                text={cd.contactEmail}
                onPress={() => Linking.openURL(`mailto:${cd!.contactEmail}`).catch(() => {})}
              />
            ) : null}

            {cd?.website ? (
              <InfoRow
                icon="globe-outline"
                text={cd.website}
                onPress={() => {
                  const url = cd!.website!.startsWith('http')
                    ? cd!.website!
                    : `https://${cd!.website!}`;
                  Linking.openURL(url).catch(() => {});
                }}
              />
            ) : null}
          </View>
        )}

        {/* ── Social Links ── */}
        {hasSocials && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Social Links</Text>
            <View style={styles.socialsGrid}>
              {isIndividual
                ? individualSocials.map(cfg => {
                    const handle = hostUser!.socialHandles![cfg.key as SocialKey]!;
                    return (
                      <TouchableOpacity
                        key={cfg.key}
                        style={[styles.socialChip, { borderColor: cfg.color + '55' }]}
                        onPress={() => Linking.openURL(`${cfg.prefix}${handle}`).catch(() => {})}
                        activeOpacity={0.75}
                      >
                        <Ionicons name={cfg.icon} size={16} color={cfg.color} />
                        <Text style={[styles.socialHandle, { color: cfg.color }]}>@{handle}</Text>
                      </TouchableOpacity>
                    );
                  })
                : merchantSocials.map((item, i) => (
                    <TouchableOpacity
                      key={i}
                      style={[styles.socialChip, { borderColor: item.color + '55' }]}
                      onPress={() => Linking.openURL(item.url).catch(() => {})}
                      activeOpacity={0.75}
                    >
                      <Ionicons name={item.icon} size={16} color={item.color} />
                      <Text style={[styles.socialHandle, { color: item.color }]}>{item.handle}</Text>
                    </TouchableOpacity>
                  ))
              }
            </View>
          </View>
        )}

        {/* ── Action Buttons ── */}
        <View style={styles.actionsSection}>
          <TouchableOpacity
            style={[styles.btnSecondary, { flex: 1 }]}
            onPress={() => navigation.navigate('EditHostProfile')}
            activeOpacity={0.8}
          >
            <Ionicons name="create-outline" size={18} color="#378BBB" />
            <Text style={styles.btnSecondaryText}>Edit Profile</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnPrimary, { flex: 1 }]}
            onPress={() => navigation.navigate('HostBankAccount')}
            activeOpacity={0.8}
          >
            <Ionicons name="card-outline" size={18} color="#FFFFFF" />
            <Text style={styles.btnPrimaryText}>Bank Account</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  // ── Layout ──
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  pageTitle: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  logoutIconBtn: {
    padding: 4,
  },
  // ── Avatar section ──
  avatarSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logoImg: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 2,
    borderColor: 'rgba(55,139,187,0.4)',
    marginBottom: 14,
  },
  initialsCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  initialsText: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  nameText: {
    fontSize: 22,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    maxWidth: 260,
  },
  subtitleText: {
    fontSize: 13,
    fontFamily: 'Inter-Regular',
    color: '#506A85',
  },
  // ── Cards ──
  card: {
    backgroundColor: '#16283D',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.15)',
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: 'Inter-SemiBold',
    color: '#506A85',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  // ── Verification ──
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  // ── About ──
  bioText: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: '#C8D8E8',
    lineHeight: 22,
    marginBottom: 8,
  },
  // ── Socials ──
  socialsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  socialChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
  },
  socialHandle: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
  },
  // ── Action buttons ──
  actionsSection: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#378BBB',
    borderRadius: 12,
    paddingVertical: 14,
  },
  btnPrimaryText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: '#378BBB',
  },
  btnSecondaryText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#378BBB',
  },

});

export default HostProfileScreen;
