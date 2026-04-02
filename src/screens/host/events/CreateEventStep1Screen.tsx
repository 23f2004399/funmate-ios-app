/**
 * CREATE EVENT — STEP 1: BASIC DETAILS
 * Title, Description, Category, Tags, Visibility
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  Modal,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

const EVENT_CATEGORIES = [
  { label: 'Music', icon: 'musical-notes-outline' },
  { label: 'Sports', icon: 'football-outline' },
  { label: 'Food & Drinks', icon: 'restaurant-outline' },
  { label: 'Nightlife', icon: 'moon-outline' },
  { label: 'Art & Culture', icon: 'color-palette-outline' },
  { label: 'Comedy', icon: 'happy-outline' },
  { label: 'Tech', icon: 'code-slash-outline' },
  { label: 'Fitness', icon: 'barbell-outline' },
  { label: 'Fashion', icon: 'shirt-outline' },
  { label: 'Gaming', icon: 'game-controller-outline' },
  { label: 'Travel', icon: 'airplane-outline' },
  { label: 'Business', icon: 'briefcase-outline' },
  { label: 'Social', icon: 'people-outline' },
  { label: 'Other', icon: 'ellipsis-horizontal-circle-outline' },
];

export type Step1Data = {
  title: string;
  description: string;
  category: string;
  tags: string[];
};

const CreateEventStep1Screen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [categoryModal, setCategoryModal] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed) && tags.length < 10) {
      setTags([...tags, trimmed]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!title.trim()) newErrors.title = 'Event title is required';
    if (title.trim().length < 3) newErrors.title = 'Title must be at least 3 characters';
    if (!description.trim()) newErrors.description = 'Description is required';
    if (!category) newErrors.category = 'Please select a category';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validate()) return;
    const step1: Step1Data = {
      title: title.trim(),
      description: description.trim(),
      category,
      tags,
    };
    navigation.navigate('CreateEventStep2', { step1 });
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
            <View style={[styles.stepBar, step === 1 && styles.stepBarActive]} />
            <Text style={[styles.stepText, step === 1 && styles.stepTextActive]}>
              {step}
            </Text>
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
        <Text style={styles.stepTitle}>Basic Details</Text>
        <Text style={styles.stepSubtitle}>Tell people what your event is about</Text>

        {/* Title */}
        <View style={styles.field}>
          <Text style={styles.label}>Event Title <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.input, errors.title && styles.inputError]}
            placeholder="e.g. Summer Music Festival 2026"
            placeholderTextColor="#506A85"
            value={title}
            onChangeText={t => { setTitle(t); if (errors.title) setErrors(e => ({ ...e, title: '' })); }}
            maxLength={80}
          />
          {errors.title ? <Text style={styles.errorText}>{errors.title}</Text> : null}
          <Text style={styles.charCount}>{title.length}/80</Text>
        </View>

        {/* Description */}
        <View style={styles.field}>
          <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
          <TextInput
            style={[styles.textarea, errors.description && styles.inputError]}
            placeholder="Describe your event, what to expect, dress code, etc."
            placeholderTextColor="#506A85"
            value={description}
            onChangeText={d => { setDescription(d); if (errors.description) setErrors(e => ({ ...e, description: '' })); }}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            maxLength={1000}
          />
          {errors.description ? <Text style={styles.errorText}>{errors.description}</Text> : null}
          <Text style={styles.charCount}>{description.length}/1000</Text>
        </View>

        {/* Category */}
        <View style={styles.field}>
          <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
          <TouchableOpacity
            style={[styles.selector, errors.category && styles.inputError]}
            onPress={() => setCategoryModal(true)}
            activeOpacity={0.8}
          >
            {category ? (
              <View style={styles.selectorRow}>
                <Ionicons
                  name={EVENT_CATEGORIES.find(c => c.label === category)?.icon || 'help-outline'}
                  size={18}
                  color="#378BBB"
                />
                <Text style={styles.selectorValue}>{category}</Text>
              </View>
            ) : (
              <Text style={styles.selectorPlaceholder}>Select a category</Text>
            )}
            <Ionicons name="chevron-down" size={18} color="#506A85" />
          </TouchableOpacity>
          {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
        </View>

        {/* Tags */}
        <View style={styles.field}>
          <Text style={styles.label}>Tags <Text style={styles.optional}>(optional)</Text></Text>
          <View style={styles.tagInputRow}>
            <TextInput
              style={styles.tagInput}
              placeholder="e.g. outdoor, 18+"
              placeholderTextColor="#506A85"
              value={tagInput}
              onChangeText={setTagInput}
              onSubmitEditing={addTag}
              returnKeyType="done"
              maxLength={20}
            />
            <TouchableOpacity style={styles.addTagButton} onPress={addTag}>
              <Ionicons name="add" size={20} color="#378BBB" />
            </TouchableOpacity>
          </View>
          {tags.length > 0 && (
            <View style={styles.tagChips}>
              {tags.map(tag => (
                <View key={tag} style={styles.tagChip}>
                  <Text style={styles.tagChipText}>#{tag}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons name="close" size={14} color="#B8C7D9" />
                  </TouchableOpacity>
                </View>
              ))}
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

      {/* Category Modal */}
      <Modal visible={categoryModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Select Category</Text>
            <FlatList
              data={EVENT_CATEGORIES}
              keyExtractor={item => item.label}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.categoryItem, category === item.label && styles.categoryItemActive]}
                  onPress={() => { setCategory(item.label); setCategoryModal(false); if (errors.category) setErrors(e => ({ ...e, category: '' })); }}
                >
                  <View style={styles.categoryIcon}>
                    <Ionicons name={item.icon} size={22} color={category === item.label ? '#FFFFFF' : '#378BBB'} />
                  </View>
                  <Text style={[styles.categoryLabel, category === item.label && styles.categoryLabelActive]}>
                    {item.label}
                  </Text>
                  {category === item.label && (
                    <Ionicons name="checkmark" size={20} color="#FF4D6D" />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setCategoryModal(false)}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0E1621' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: '#0E1621',
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  stepContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 8,
  },
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
  required: { color: '#FF4D6D' },
  optional: { color: '#506A85', fontFamily: 'Inter-Regular' },
  input: {
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  textarea: {
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
    minHeight: 120,
  },
  inputError: { borderColor: '#FF5252' },
  errorText: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#FF5252', marginTop: 4 },
  charCount: { fontSize: 11, fontFamily: 'Inter-Regular', color: '#506A85', textAlign: 'right', marginTop: 4 },
  selector: {
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  selectorValue: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  selectorPlaceholder: { fontSize: 15, fontFamily: 'Inter-Regular', color: '#506A85' },
  tagInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: '#FFFFFF',
  },
  addTagButton: {
    width: 48,
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tagChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(55, 139, 187, 0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
  },
  tagChipText: { fontSize: 13, fontFamily: 'Inter-Regular', color: '#378BBB' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#0E1621' },
  nextButton: {
    backgroundColor: '#FF4D6D',
    borderRadius: 14,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  nextButtonText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#16283D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%',
    paddingBottom: 8,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#378BBB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
    opacity: 0.5,
  },
  modalTitle: { fontSize: 18, fontFamily: 'Inter-SemiBold', color: '#FFFFFF', textAlign: 'center', marginBottom: 12, paddingHorizontal: 20 },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(55, 139, 187, 0.1)',
  },
  categoryItemActive: { backgroundColor: 'rgba(55, 139, 187, 0.1)' },
  categoryIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(55, 139, 187, 0.1)', alignItems: 'center', justifyContent: 'center' },
  categoryLabel: { flex: 1, fontSize: 15, fontFamily: 'Inter-Regular', color: '#FFFFFF' },
  categoryLabelActive: { fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  modalClose: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  modalCloseText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#FF5252' },
});

export default CreateEventStep1Screen;
