/**
 * CREATE EVENT — STEP 3: PRICING & CAPACITY
 * Price, Capacity, Age Restrictions, Gender Restrictions, Entry Code Length
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { Step1Data } from './CreateEventStep1Screen';
import { Step2Data } from './CreateEventStep2Screen';

export type Step3Data = {
  price: number;
  isFree: boolean;
  capacityType: 'limited' | 'unlimited';
  capacityTotal: number | null;
  hasAgeRestriction: boolean;
  ageMin: number | null;
  ageMax: number | null;
  hasGenderRestriction: boolean;
  genderRestrictions: string[] | null;
  entryCodeLength: number;
  allowedBookingTypes: ('solo' | 'duo' | 'group')[];
  maxGroupSize: number | null;
};

const GENDERS = ['Male', 'Female', 'Trans', 'Non-Binary'];

const CreateEventStep3Screen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { step1, step2 } = route.params as { step1: Step1Data; step2: Step2Data };

  const [isFree, setIsFree] = useState(false);
  const [price, setPrice] = useState('');
  const [capacityType, setCapacityType] = useState<'limited' | 'unlimited'>('limited');
  const [capacityTotal, setCapacityTotal] = useState('');
  const [hasAgeRestriction, setHasAgeRestriction] = useState(false);
  const [ageMin, setAgeMin] = useState('18');
  const [ageMax, setAgeMax] = useState('');
  const [hasGenderRestriction, setHasGenderRestriction] = useState(false);
  const [selectedGenders, setSelectedGenders] = useState<string[]>([]);
  const [entryCodeLength, setEntryCodeLength] = useState(6);
  const [bookingDuo,       setBookingDuo]       = useState(false);
  const [bookingGroup,     setBookingGroup]     = useState(false);
  const [maxGroupSize,     setMaxGroupSize]     = useState('6');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const toggleGender = (gender: string) => {
    setSelectedGenders(prev =>
      prev.includes(gender) ? prev.filter(g => g !== gender) : [...prev, gender]
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!isFree) {
      const p = parseFloat(price);
      if (!price || isNaN(p) || p < 0) newErrors.price = 'Enter a valid price';
    }
    if (capacityType === 'limited') {
      const c = parseInt(capacityTotal);
      if (!capacityTotal || isNaN(c) || c < 1) newErrors.capacity = 'Enter a valid capacity (min 1)';
    }
    if (hasAgeRestriction) {
      const min = parseInt(ageMin);
      const max = ageMax ? parseInt(ageMax) : null;
      if (isNaN(min) || min < 1 || min > 100) newErrors.ageMin = 'Enter a valid minimum age';
      if (max !== null && (isNaN(max) || max <= min)) newErrors.ageMax = 'Max age must be greater than min age';
    }
    if (hasGenderRestriction && selectedGenders.length === 0) {
      newErrors.gender = 'Select at least one gender';
    }
    if (bookingGroup) {
      const mg = parseInt(maxGroupSize);
      if (!maxGroupSize || isNaN(mg) || mg < 3 || mg > 20)
        newErrors.maxGroupSize = 'Enter a valid max group size (3–20)';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    const step3: Step3Data = {
      price: isFree ? 0 : parseFloat(price) || 0,
      isFree,
      capacityType,
      capacityTotal: capacityType === 'limited' ? parseInt(capacityTotal) || null : null,
      hasAgeRestriction,
      ageMin: hasAgeRestriction ? parseInt(ageMin) || null : null,
      ageMax: hasAgeRestriction && ageMax ? parseInt(ageMax) : null,
      hasGenderRestriction,
      genderRestrictions: hasGenderRestriction ? selectedGenders.map(g => g.toLowerCase()) : null,
      entryCodeLength,
      allowedBookingTypes: ['solo', ...(bookingDuo ? ['duo'] : []), ...(bookingGroup ? ['group'] : [])] as ('solo' | 'duo' | 'group')[],
      maxGroupSize: bookingGroup ? parseInt(maxGroupSize) || 6 : null,
    };
    navigation.navigate('CreateEventStep4', { step1, step2, step3 });
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={styles.backButton} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepContainer}>
        {[1, 2, 3, 4].map(step => (
          <View key={step} style={styles.stepWrapper}>
            <View style={[styles.stepBar, step <= 3 && styles.stepBarActive]} />
            <Text style={[styles.stepText, step === 3 && styles.stepTextActive]}>{step}</Text>
          </View>
        ))}
      </View>

      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        enableOnAndroid
        extraScrollHeight={220}
        enableAutomaticScroll
      >
        <Text style={styles.stepTitle}>Pricing & Capacity</Text>
        <Text style={styles.stepSubtitle}>Set ticket price and attendee limits</Text>

        {/* Free Event Toggle */}
        <View style={styles.toggleRow}>
          <View>
            <Text style={styles.toggleLabel}>Free Event</Text>
            <Text style={styles.toggleSubLabel}>No ticket price charged</Text>
          </View>
          <Switch
            value={isFree}
            onValueChange={v => { setIsFree(v); if (v) setErrors(e => ({ ...e, price: '' })); }}
            trackColor={{ false: 'rgba(55, 139, 187, 0.3)', true: '#FF4D6D' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Price */}
        {!isFree && (
          <View style={styles.field}>
            <Text style={styles.label}>Price per Head <Text style={styles.required}>*</Text></Text>
            <View style={styles.priceRow}>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyText}>₹</Text>
              </View>
              <TextInput
                style={[styles.priceInput, errors.price && styles.inputError]}
                placeholder="0"
                placeholderTextColor="#506A85"
                value={price}
                onChangeText={v => { setPrice(v); if (errors.price) setErrors(e => ({ ...e, price: '' })); }}
                keyboardType="decimal-pad"
              />
            </View>
            {errors.price ? <Text style={styles.errorText}>{errors.price}</Text> : null}
          </View>
        )}

        {/* Capacity */}
        <View style={styles.field}>
          <Text style={styles.label}>Capacity</Text>
          <View style={styles.capacityRow}>
            <TouchableOpacity
              style={[styles.capacityOption, capacityType === 'limited' && styles.capacityOptionActive]}
              onPress={() => setCapacityType('limited')}
              activeOpacity={0.8}
            >
              <View style={styles.radioCircle}>
                {capacityType === 'limited' && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.capacityLabel, capacityType === 'limited' && styles.capacityLabelActive]}>
                Limited
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.capacityOption, capacityType === 'unlimited' && styles.capacityOptionActive]}
              onPress={() => setCapacityType('unlimited')}
              activeOpacity={0.8}
            >
              <View style={styles.radioCircle}>
                {capacityType === 'unlimited' && <View style={styles.radioDot} />}
              </View>
              <Text style={[styles.capacityLabel, capacityType === 'unlimited' && styles.capacityLabelActive]}>
                Unlimited
              </Text>
            </TouchableOpacity>
          </View>
          {capacityType === 'limited' && (
            <TextInput
              style={[styles.input, { marginTop: 12 }, errors.capacity && styles.inputError]}
              placeholder="Max number of attendees"
              placeholderTextColor="#506A85"
              value={capacityTotal}
              onChangeText={v => { setCapacityTotal(v); if (errors.capacity) setErrors(e => ({ ...e, capacity: '' })); }}
              keyboardType="number-pad"
            />
          )}
          {errors.capacity ? <Text style={styles.errorText}>{errors.capacity}</Text> : null}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Age Restriction */}
        <View style={styles.restrictionBlock}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Age Restriction</Text>
              <Text style={styles.toggleSubLabel}>Limit event to age range</Text>
            </View>
            <Switch
              value={hasAgeRestriction}
              onValueChange={setHasAgeRestriction}
              trackColor={{ false: 'rgba(55, 139, 187, 0.3)', true: '#378BBB' }}
              thumbColor="#FFFFFF"
            />
          </View>
          {hasAgeRestriction && (
            <View style={styles.ageRow}>
              <View style={styles.ageField}>
                <Text style={styles.ageLabel}>Min Age <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.ageInput, errors.ageMin && styles.inputError]}
                  value={ageMin}
                  onChangeText={v => { setAgeMin(v); if (errors.ageMin) setErrors(e => ({ ...e, ageMin: '' })); }}
                  keyboardType="number-pad"
                  placeholder="18"
                  placeholderTextColor="#506A85"
                />
                {errors.ageMin ? <Text style={styles.errorText}>{errors.ageMin}</Text> : null}
              </View>
              <View style={styles.ageDash}>
                <Text style={styles.ageDashText}>–</Text>
              </View>
              <View style={styles.ageField}>
                <Text style={styles.ageLabel}>Max Age</Text>
                <TextInput
                  style={[styles.ageInput, errors.ageMax && styles.inputError]}
                  value={ageMax}
                  onChangeText={v => { setAgeMax(v); if (errors.ageMax) setErrors(e => ({ ...e, ageMax: '' })); }}
                  keyboardType="number-pad"
                  placeholder="No limit"
                  placeholderTextColor="#506A85"
                />
                {errors.ageMax ? <Text style={styles.errorText}>{errors.ageMax}</Text> : null}
              </View>
            </View>
          )}
        </View>

        {/* Gender Restriction */}
        <View style={styles.restrictionBlock}>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>Gender Restriction</Text>
              <Text style={styles.toggleSubLabel}>Limit to specific genders</Text>
            </View>
            <Switch
              value={hasGenderRestriction}
              onValueChange={v => { setHasGenderRestriction(v); if (!v) setSelectedGenders([]); }}
              trackColor={{ false: 'rgba(55, 139, 187, 0.3)', true: '#378BBB' }}
              thumbColor="#FFFFFF"
            />
          </View>
          {hasGenderRestriction && (
            <>
              <View style={styles.genderRow}>
                {GENDERS.map(gender => (
                  <TouchableOpacity
                    key={gender}
                    style={[styles.genderChip, selectedGenders.includes(gender) && styles.genderChipActive]}
                    onPress={() => { toggleGender(gender); if (errors.gender) setErrors(e => ({ ...e, gender: '' })); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.genderChipText, selectedGenders.includes(gender) && styles.genderChipTextActive]}>
                      {gender}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.gender ? <Text style={styles.errorText}>{errors.gender}</Text> : null}
            </>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Entry Code Length */}
        <View style={styles.field}>
          <Text style={styles.label}>Entry Code Length</Text>
          <Text style={styles.fieldHint}>Attendees will receive a code of this length to enter</Text>
          <View style={styles.codeLengthRow}>
            {[4, 6, 8].map(len => (
              <TouchableOpacity
                key={len}
                style={[styles.codeOption, entryCodeLength === len && styles.codeOptionActive]}
                onPress={() => setEntryCodeLength(len)}
                activeOpacity={0.8}
              >
                <Text style={[styles.codeOptionText, entryCodeLength === len && styles.codeOptionTextActive]}>
                  {len} digits
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Booking Types */}
        <View style={styles.field}>
          <Text style={styles.label}>Allowed Booking Types</Text>
          <Text style={styles.fieldHint}>Who can attend — solo only, or also pairs and groups?</Text>

          <View style={[styles.bookingTypeRow, styles.bookingTypeRowLocked]}>
            <View style={styles.bookingTypeLeft}>
              <Ionicons name="person-outline" size={18} color="#506A85" />
              <View>
                <Text style={styles.bookingTypeLabel}>Solo</Text>
                <Text style={styles.bookingTypeSub}>Always enabled</Text>
              </View>
            </View>
            <Ionicons name="checkmark-circle" size={22} color="#378BBB" />
          </View>

          <TouchableOpacity
            style={[styles.bookingTypeRow, bookingDuo && styles.bookingTypeRowActive]}
            onPress={() => setBookingDuo(v => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.bookingTypeLeft}>
              <Ionicons name="people-outline" size={18} color={bookingDuo ? '#378BBB' : '#506A85'} />
              <View>
                <Text style={[styles.bookingTypeLabel, bookingDuo && { color: '#FFFFFF' }]}>Duo</Text>
                <Text style={styles.bookingTypeSub}>Two people, one shared code</Text>
              </View>
            </View>
            <Ionicons name={bookingDuo ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={bookingDuo ? '#378BBB' : '#506A85'} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.bookingTypeRow, bookingGroup && styles.bookingTypeRowGroupActive]}
            onPress={() => setBookingGroup(v => !v)}
            activeOpacity={0.8}
          >
            <View style={styles.bookingTypeLeft}>
              <Ionicons name="people-circle-outline" size={18} color={bookingGroup ? '#AF52DE' : '#506A85'} />
              <View>
                <Text style={[styles.bookingTypeLabel, bookingGroup && { color: '#FFFFFF' }]}>Group</Text>
                <Text style={styles.bookingTypeSub}>3 or more people, one code</Text>
              </View>
            </View>
            <Ionicons name={bookingGroup ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={bookingGroup ? '#AF52DE' : '#506A85'} />
          </TouchableOpacity>

          {bookingGroup && (
            <View style={{ marginTop: 4 }}>
              <Text style={styles.ageLabel}>Max Group Size <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={[styles.input, errors.maxGroupSize && styles.inputError]}
                placeholder="e.g. 6  (min 3, max 20)"
                placeholderTextColor="#506A85"
                value={maxGroupSize}
                onChangeText={v => { setMaxGroupSize(v); if (errors.maxGroupSize) setErrors(e => ({ ...e, maxGroupSize: '' })); }}
                keyboardType="number-pad"
              />
              {errors.maxGroupSize ? <Text style={styles.errorText}>{errors.maxGroupSize}</Text> : null}
            </View>
          )}
        </View>
      </KeyboardAwareScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={styles.nextButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextButtonText}>Next</Text>
          <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  stepContainer: { flexDirection: 'row', paddingHorizontal: 20, gap: 8, marginBottom: 8 },
  stepWrapper: { flex: 1, alignItems: 'center', gap: 4 },
  stepBar: { height: 4, width: '100%', borderRadius: 2, backgroundColor: '#1B2F48' },
  stepBarActive: { backgroundColor: '#FF4D6D' },
  stepText: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85' },
  stepTextActive: { color: '#FF4D6D', fontFamily: 'Inter-SemiBold' },
  scrollView: { flex: 1 },
  content: { padding: 20, paddingBottom: 16 },
  stepTitle: { fontSize: 24, fontFamily: 'Inter-Bold', color: '#FFFFFF', marginBottom: 6 },
  stepSubtitle: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#B8C7D9', marginBottom: 24 },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF', marginBottom: 8 },
  fieldHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#506A85', marginBottom: 10 },
  required: { color: '#FF4D6D' },
  input: {
    backgroundColor: '#1B2F48', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 15, fontFamily: 'Inter-Regular', color: '#FFFFFF',
  },
  inputError: { borderColor: '#FF5252' },
  errorText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#FF5252', marginTop: 4 },
  toggleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, marginBottom: 8,
  },
  toggleLabel: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  toggleSubLabel: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#B8C7D9', marginTop: 2 },
  priceRow: { flexDirection: 'row', gap: 0 },
  currencyBadge: {
    backgroundColor: 'rgba(55, 139, 187, 0.2)', borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', borderRightWidth: 0,
    borderTopLeftRadius: 12, borderBottomLeftRadius: 12,
    paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center',
  },
  currencyText: { fontSize: 18, fontFamily: 'Inter-Bold', color: '#378BBB' },
  priceInput: {
    flex: 1, backgroundColor: '#1B2F48', borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', borderLeftWidth: 0,
    borderTopRightRadius: 12, borderBottomRightRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14,
    fontSize: 18, fontFamily: 'Inter-SemiBold', color: '#FFFFFF',
  },
  capacityRow: { flexDirection: 'row', gap: 12 },
  capacityOption: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#1B2F48', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', paddingHorizontal: 16, paddingVertical: 14,
  },
  capacityOptionActive: { borderColor: '#378BBB', backgroundColor: 'rgba(55, 139, 187, 0.1)' },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: '#378BBB', alignItems: 'center', justifyContent: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#378BBB' },
  capacityLabel: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#B8C7D9' },
  capacityLabelActive: { color: '#FFFFFF', fontFamily: 'Inter-SemiBold' },
  divider: { height: 1, backgroundColor: 'rgba(55, 139, 187, 0.1)', marginVertical: 4, marginBottom: 12 },
  restrictionBlock: { marginBottom: 8 },
  ageRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  ageField: { flex: 1 },
  ageLabel: { fontSize: 13, fontFamily: 'Inter-SemiBold', color: '#B8C7D9', marginBottom: 6 },
  ageInput: {
    backgroundColor: '#1B2F48', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF', textAlign: 'center',
  },
  ageDash: { paddingTop: 24, alignItems: 'center' },
  ageDashText: { fontSize: 20, color: '#506A85', fontFamily: 'Inter-Bold' },
  genderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  genderChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(55, 139, 187, 0.3)', backgroundColor: '#1B2F48',
  },
  genderChipActive: { backgroundColor: 'rgba(55, 139, 187, 0.2)', borderColor: '#378BBB' },
  genderChipText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#B8C7D9' },
  genderChipTextActive: { color: '#378BBB', fontFamily: 'Inter-SemiBold' },
  codeLengthRow: { flexDirection: 'row', gap: 12 },
  codeOption: {
    flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', backgroundColor: '#1B2F48', alignItems: 'center',
  },
  codeOptionActive: { backgroundColor: '#378BBB', borderColor: '#378BBB' },
  codeOptionText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  codeOptionTextActive: { color: '#FFFFFF' },
  bookingTypeRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#1B2F48', borderRadius: 12,
    borderWidth: 1, borderColor: 'rgba(55,139,187,0.2)',
    padding: 14, marginBottom: 8,
  },
  bookingTypeRowLocked:     { opacity: 0.55 },
  bookingTypeRowActive:     { borderColor: '#378BBB', backgroundColor: 'rgba(55,139,187,0.08)' },
  bookingTypeRowGroupActive:{ borderColor: '#AF52DE', backgroundColor: 'rgba(175,82,222,0.08)' },
  bookingTypeLeft:  { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bookingTypeLabel: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#B8C7D9' },
  bookingTypeSub:   { fontSize: 12, fontFamily: 'Inter-Regular',  color: '#506A85', marginTop: 1 },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#0E1621' },
  nextButton: {
    backgroundColor: '#FF4D6D', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  nextButtonText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
});

export default CreateEventStep3Screen;
