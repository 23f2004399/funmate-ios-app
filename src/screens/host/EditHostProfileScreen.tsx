import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';
import Toast from 'react-native-toast-message';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOST_CATEGORIES = [
  'Music & Concerts',
  'Sports & Fitness',
  'Food & Dining',
  'Nightlife & Parties',
  'Arts & Culture',
  'Workshops & Classes',
  'Networking & Business',
  'Adventure & Outdoors',
  'Other',
];

// ─── Field components ─────────────────────────────────────────────────────────

const FieldLabel = ({ text, optional }: { text: string; optional?: boolean }) => (
  <Text style={fieldStyles.label}>
    {text}
    {optional ? <Text style={fieldStyles.optional}> (Optional)</Text> : null}
  </Text>
);

const fieldStyles = StyleSheet.create({
  label: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#B8C7D9',
    marginBottom: 8,
  },
  optional: {
    fontSize: 12,
    fontFamily: 'Inter-Regular',
    color: '#506A85',
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const EditHostProfileScreen = () => {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const uid        = auth().currentUser?.uid ?? '';

  // ── Shared state ──
  const [creatorType, setCreatorType] = useState<'individual' | 'merchant'>('individual');
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);

  // ── Individual fields ──
  const [bio,        setBio]        = useState('');
  const [experience, setExperience] = useState('');
  const [category,   setCategory]   = useState('');
  const [instagram,  setInstagram]  = useState('');
  const [twitter,    setTwitter]    = useState('');
  const [linkedin,   setLinkedin]   = useState('');
  const [facebook,   setFacebook]   = useState('');

  // ── Merchant fields ──
  const [orgName,       setOrgName]       = useState('');
  const [description,   setDescription]   = useState('');
  const [addressLine,   setAddressLine]   = useState('');
  const [city,          setCity]          = useState('');
  const [stateVal,      setStateVal]      = useState('');
  const [country,       setCountry]       = useState('India');
  const [website,       setWebsite]       = useState('');
  const [contactEmail,  setContactEmail]  = useState('');
  const [igUrl,         setIgUrl]         = useState('');
  const [liUrl,         setLiUrl]         = useState('');

  // ── Category picker modal ──
  const [catModal, setCatModal] = useState(false);

  // ── Load current data ──────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!uid) return;
    const [userSnap, accountSnap] = await Promise.all([
      firestore().collection('users').doc(uid).get(),
      firestore().collection('accounts').doc(uid).get(),
    ]);
    const u  = userSnap.data() ?? {};
    const ac = accountSnap.data() ?? {};
    const ct: 'individual' | 'merchant' = ac.creatorType === 'merchant' ? 'merchant' : 'individual';
    setCreatorType(ct);
    const cd = u.creatorDetails ?? {};

    if (ct === 'individual') {
      setBio(cd.bio ?? '');
      setExperience(cd.experienceYears != null ? String(cd.experienceYears) : '');
      setCategory(cd.category ?? '');
      const sh = u.socialHandles ?? {};
      setInstagram(sh.instagram ?? '');
      setTwitter(sh.twitter ?? '');
      setLinkedin(sh.linkedin ?? '');
      setFacebook(sh.facebook ?? '');
    } else {
      setOrgName(cd.organizationName ?? '');
      setDescription(cd.bio ?? '');
      setAddressLine(cd.businessAddress?.addressLine ?? '');
      setCity(cd.businessAddress?.city ?? '');
      setStateVal(cd.businessAddress?.state ?? '');
      setCountry(cd.businessAddress?.country ?? 'India');
      setWebsite(cd.website ?? '');
      setContactEmail(cd.contactEmail ?? '');
      const links: string[] = cd.socialLinks ?? [];
      setIgUrl(links.find((l: string) => l.includes('instagram')) ?? '');
      setLiUrl(links.find((l: string) => l.includes('linkedin')) ?? '');
    }
  }, [uid]);

  useEffect(() => {
    setLoading(true);
    loadData().finally(() => setLoading(false));
  }, [loadData]);

  // ── Save ──────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (creatorType === 'individual' && bio.trim().length < 50) {
      Toast.show({ type: 'error', text1: 'Bio too short', text2: 'Please write at least 50 characters.' });
      return;
    }
    if (creatorType === 'merchant' && !orgName.trim()) {
      Toast.show({ type: 'error', text1: 'Business name required' });
      return;
    }

    setSaving(true);
    try {
      if (creatorType === 'individual') {
        const socialHandles: Record<string, string> = {};
        if (instagram.trim()) socialHandles.instagram = instagram.trim().replace('@', '');
        if (twitter.trim())   socialHandles.twitter   = twitter.trim().replace('@', '');
        if (linkedin.trim())  socialHandles.linkedin  = linkedin.trim();
        if (facebook.trim())  socialHandles.facebook  = facebook.trim();

        await firestore().collection('users').doc(uid).update({
          'creatorDetails.bio':             bio.trim(),
          'creatorDetails.experienceYears': experience ? parseInt(experience, 10) : null,
          'creatorDetails.category':        category || null,
          socialHandles: Object.keys(socialHandles).length > 0 ? socialHandles : null,
        });
      } else {
        const socialLinks: string[] = [];
        if (igUrl.trim()) socialLinks.push(igUrl.trim());
        if (liUrl.trim()) socialLinks.push(liUrl.trim());

        await firestore().collection('users').doc(uid).update({
          'creatorDetails.organizationName':              orgName.trim(),
          'creatorDetails.bio':                           description.trim(),
          'creatorDetails.businessAddress.addressLine':   addressLine.trim(),
          'creatorDetails.businessAddress.city':          city.trim(),
          'creatorDetails.businessAddress.state':         stateVal.trim(),
          'creatorDetails.businessAddress.country':       country.trim() || 'India',
          'creatorDetails.website':                       website.trim() || null,
          'creatorDetails.contactEmail':                  contactEmail.trim() || null,
          'creatorDetails.socialLinks':                   socialLinks.length > 0 ? socialLinks : null,
        });
      }

      Toast.show({ type: 'success', text1: 'Profile updated!' });
      navigation.goBack();
    } catch (e) {
      Toast.show({ type: 'error', text1: 'Failed to save', text2: 'Please try again.' });
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* Nav bar */}
      <View style={[styles.navBar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Edit Profile</Text>
        <TouchableOpacity
          onPress={handleSave}
          disabled={saving}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {saving
            ? <ActivityIndicator size="small" color="#378BBB" />
            : <Text style={styles.saveBtn}>Save</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {creatorType === 'individual'
          ? renderIndividual()
          : renderMerchant()
        }
      </ScrollView>

      {/* Category picker modal */}
      <Modal visible={catModal} transparent animationType="slide" onRequestClose={() => setCatModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setCatModal(false)} />
        <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 16 }]}>
          <Text style={styles.modalTitle}>Select Category</Text>
          {HOST_CATEGORIES.map(cat => (
            <TouchableOpacity
              key={cat}
              style={styles.modalOption}
              onPress={() => { setCategory(cat); setCatModal(false); }}
            >
              <Text style={[styles.modalOptionText, category === cat && styles.modalOptionActive]}>
                {cat}
              </Text>
              {category === cat
                ? <Ionicons name="checkmark" size={18} color="#378BBB" />
                : null
              }
            </TouchableOpacity>
          ))}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );

  // ── Individual form ────────────────────────────────────────────────────────

  function renderIndividual() {
    return (
      <>
        {/* Bio */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Bio" />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people about yourself as a host (min 50 characters)"
            placeholderTextColor="#3A5068"
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{bio.length}/500</Text>
        </View>

        {/* Experience */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Years of Experience" optional />
          <TextInput
            style={styles.input}
            value={experience}
            onChangeText={t => setExperience(t.replace(/\D/g, ''))}
            placeholder="e.g. 3"
            placeholderTextColor="#3A5068"
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>

        {/* Category */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Host Category" optional />
          <TouchableOpacity
            style={styles.picker}
            onPress={() => setCatModal(true)}
            activeOpacity={0.8}
          >
            <Text style={category ? styles.pickerValue : styles.pickerPlaceholder}>
              {category || 'Select a category'}
            </Text>
            <Ionicons name="chevron-down" size={16} color="#506A85" />
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Social Links</Text>

        {/* Instagram */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Instagram" optional />
          <View style={styles.socialInput}>
            <Ionicons name="logo-instagram" size={18} color="#E1306C" style={styles.socialIcon} />
            <TextInput
              style={styles.socialTextInput}
              value={instagram}
              onChangeText={setInstagram}
              placeholder="username"
              placeholderTextColor="#3A5068"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* X / Twitter */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="X" optional />
          <View style={styles.socialInput}>
            <Ionicons name="logo-twitter" size={18} color="#1DA1F2" style={styles.socialIcon} />
            <TextInput
              style={styles.socialTextInput}
              value={twitter}
              onChangeText={setTwitter}
              placeholder="username"
              placeholderTextColor="#3A5068"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* LinkedIn */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="LinkedIn" optional />
          <View style={styles.socialInput}>
            <Ionicons name="logo-linkedin" size={18} color="#0A66C2" style={styles.socialIcon} />
            <TextInput
              style={styles.socialTextInput}
              value={linkedin}
              onChangeText={setLinkedin}
              placeholder="username or profile URL"
              placeholderTextColor="#3A5068"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* Facebook */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Facebook" optional />
          <View style={styles.socialInput}>
            <Ionicons name="logo-facebook" size={18} color="#1877F2" style={styles.socialIcon} />
            <TextInput
              style={styles.socialTextInput}
              value={facebook}
              onChangeText={setFacebook}
              placeholder="username"
              placeholderTextColor="#3A5068"
              autoCapitalize="none"
            />
          </View>
        </View>
      </>
    );
  }

  // ── Merchant form ──────────────────────────────────────────────────────────

  function renderMerchant() {
    return (
      <>
        {/* Organisation name */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Business / Organisation Name" />
          <TextInput
            style={styles.input}
            value={orgName}
            onChangeText={setOrgName}
            placeholder="Your business name"
            placeholderTextColor="#3A5068"
          />
        </View>

        {/* About */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="About" optional />
          <TextInput
            style={[styles.input, styles.multiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe your business or events"
            placeholderTextColor="#3A5068"
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{description.length}/500</Text>
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Business Address</Text>

        <View style={styles.fieldGroup}>
          <FieldLabel text="Address Line" optional />
          <TextInput
            style={styles.input}
            value={addressLine}
            onChangeText={setAddressLine}
            placeholder="Street / building / area"
            placeholderTextColor="#3A5068"
          />
        </View>

        <View style={styles.row2}>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <FieldLabel text="City" optional />
            <TextInput
              style={styles.input}
              value={city}
              onChangeText={setCity}
              placeholder="City"
              placeholderTextColor="#3A5068"
            />
          </View>
          <View style={[styles.fieldGroup, { flex: 1 }]}>
            <FieldLabel text="State" optional />
            <TextInput
              style={styles.input}
              value={stateVal}
              onChangeText={setStateVal}
              placeholder="State"
              placeholderTextColor="#3A5068"
            />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <FieldLabel text="Country" optional />
          <TextInput
            style={styles.input}
            value={country}
            onChangeText={setCountry}
            placeholder="Country"
            placeholderTextColor="#3A5068"
          />
        </View>

        <View style={styles.divider} />
        <Text style={styles.sectionTitle}>Contact & Links</Text>

        <View style={styles.fieldGroup}>
          <FieldLabel text="Contact Email" optional />
          <TextInput
            style={styles.input}
            value={contactEmail}
            onChangeText={setContactEmail}
            placeholder="business@example.com"
            placeholderTextColor="#3A5068"
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.fieldGroup}>
          <FieldLabel text="Website" optional />
          <TextInput
            style={styles.input}
            value={website}
            onChangeText={setWebsite}
            placeholder="https://yourbusiness.com"
            placeholderTextColor="#3A5068"
            keyboardType="url"
            autoCapitalize="none"
          />
        </View>

        {/* Instagram */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="Instagram" optional />
          <View style={styles.socialInput}>
            <Ionicons name="logo-instagram" size={18} color="#E1306C" style={styles.socialIcon} />
            <TextInput
              style={styles.socialTextInput}
              value={igUrl}
              onChangeText={setIgUrl}
              placeholder="https://instagram.com/yourpage"
              placeholderTextColor="#3A5068"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </View>

        {/* LinkedIn */}
        <View style={styles.fieldGroup}>
          <FieldLabel text="LinkedIn" optional />
          <View style={styles.socialInput}>
            <Ionicons name="logo-linkedin" size={18} color="#0A66C2" style={styles.socialIcon} />
            <TextInput
              style={styles.socialTextInput}
              value={liUrl}
              onChangeText={setLiUrl}
              placeholder="https://linkedin.com/company/yourco"
              placeholderTextColor="#3A5068"
              keyboardType="url"
              autoCapitalize="none"
            />
          </View>
        </View>
      </>
    );
  }
};

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#0E1621',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55,139,187,0.12)',
  },
  navTitle: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  saveBtn: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#378BBB',
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  fieldGroup: {
    marginBottom: 18,
  },
  input: {
    backgroundColor: '#16283D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  multiline: {
    minHeight: 110,
    paddingTop: 12,
  },
  charCount: {
    fontSize: 11,
    fontFamily: 'Inter-Regular',
    color: '#3A5068',
    textAlign: 'right',
    marginTop: 4,
  },
  picker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#16283D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 13,
  },
  pickerValue: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  pickerPlaceholder: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#3A5068',
  },
  socialInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16283D',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(55,139,187,0.2)',
    paddingHorizontal: 14,
  },
  socialIcon: {
    marginRight: 10,
  },
  socialTextInput: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    paddingVertical: Platform.OS === 'ios' ? 14 : 11,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(55,139,187,0.12)',
    marginBottom: 20,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#506A85',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  row2: {
    flexDirection: 'row',
    gap: 12,
  },
  // ── Category modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: '#16283D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 20,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55,139,187,0.1)',
  },
  modalOptionText: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#B8C7D9',
  },
  modalOptionActive: {
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
});

export default EditHostProfileScreen;
