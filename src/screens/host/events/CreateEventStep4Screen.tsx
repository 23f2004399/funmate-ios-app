/**
 * CREATE EVENT — STEP 4: MEDIA & PUBLISH
 * Banner image, additional photos, video (optional)
 * Save as Draft | Publish Event
 * Creates: event doc + group doc + chat doc
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Image,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute, CommonActions } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import Toast from 'react-native-toast-message';
import { Step1Data } from './CreateEventStep1Screen';
import { Step2Data } from './CreateEventStep2Screen';
import { Step3Data } from './CreateEventStep3Screen';

type MediaItem = {
  localUri: string;
  type: 'image' | 'video';
  isUploading?: boolean;
};

const CreateEventStep4Screen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { step1, step2, step3 } = route.params as {
    step1: Step1Data;
    step2: Step2Data;
    step3: Step3Data;
  };

  const [banner, setBanner] = useState<string | null>(null);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [video, setVideo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const pickBanner = async () => {
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
    if (result.assets && result.assets[0]?.uri) {
      setBanner(result.assets[0].uri);
    }
  };

  const pickPhotos = async () => {
    if (photos.length >= 5) {
      Alert.alert('Limit Reached', 'You can add up to 5 additional photos');
      return;
    }
    const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 5 - photos.length });
    if (result.assets) {
      const newPhotos: MediaItem[] = result.assets
        .filter(a => a.uri)
        .map(a => ({ localUri: a.uri!, type: 'image' }));
      setPhotos(prev => [...prev, ...newPhotos].slice(0, 5));
    }
  };

  const pickVideo = async () => {
    const result = await launchImageLibrary({ mediaType: 'video' });
    if (result.assets && result.assets[0]?.uri) {
      setVideo(result.assets[0].uri);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFile = async (localUri: string, remotePath: string): Promise<string> => {
    const ref = storage().ref(remotePath);
    await ref.putFile(localUri);
    return await ref.getDownloadURL();
  };

  const handleSubmit = async (status: 'draft' | 'live') => {
    if (status === 'live' && !banner) {
      Alert.alert('Banner Required', 'Please upload a banner image before publishing your event.');
      return;
    }

    setSubmitting(true);
    try {
      const userId = auth().currentUser?.uid;
      if (!userId) throw new Error('Not authenticated');

      // Pre-generate event ID so we can use it in storage paths
      const eventRef = firestore().collection('events').doc();
      const eventId = eventRef.id;

      // Upload media files
      const mediaItems: { type: 'image' | 'video'; url: string }[] = [];

      if (banner) {
        const bannerUrl = await uploadFile(banner, `event-media/${eventId}/banner`);
        mediaItems.push({ type: 'image', url: bannerUrl });
      }

      for (let i = 0; i < photos.length; i++) {
        const url = await uploadFile(photos[i].localUri, `event-media/${eventId}/photo-${i}`);
        mediaItems.push({ type: 'image', url });
      }

      if (video) {
        const videoUrl = await uploadFile(video, `event-media/${eventId}/video`);
        mediaItems.push({ type: 'video', url: videoUrl });
      }

      // Determine combined venue/location string
      const locationString = `${step2.venue}, ${step2.address}`;

      // Build event document
      const eventData: any = {
        hostAccountId: userId,
        title: step1.title,
        description: step1.description,
        category: step1.category,
        tags: step1.tags,
        media: mediaItems,
        location: locationString,
        geoLocation: step2.lat
          ? { lat: step2.lat, lng: step2.lng, geoHash: step2.geoHash }
          : null,
        startTime: firestore.Timestamp.fromDate(new Date(step2.startTime)),
        endTime: firestore.Timestamp.fromDate(new Date(step2.endTime)),
        price: step3.price,
        capacity: {
          total: step3.capacityTotal,
          booked: 0,
        },
        entryPolicy: {
          type: 'code',
          codeLength: step3.entryCodeLength,
        },
        allowedBookingTypes: step3.allowedBookingTypes,
        maxGroupSize: step3.maxGroupSize,
        verifierIds: [],
        ageRestrictions: step3.hasAgeRestriction
          ? { min: step3.ageMin, max: step3.ageMax }
          : null,
        genderRestrictions: step3.hasGenderRestriction ? step3.genderRestrictions : null,
        status,
        createdAt: firestore.FieldValue.serverTimestamp(),
      };

      // Run all writes in a batch
      const batch = firestore().batch();

      // 1. Create event document
      batch.set(eventRef, eventData);

      // 2. Create event group
      const groupRef = firestore().collection('groups').doc();
      const chatRef = firestore().collection('chats').doc();

      batch.set(groupRef, {
        type: 'event',
        ownerId: userId,
        name: step1.title,
        description: step1.description,
        groupPhoto: mediaItems.length > 0 ? mediaItems[0].url : null,
        members: [userId],
        admins: [userId],
        relatedEventId: eventId,
        relatedChatId: chatRef.id,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      // 3. Create event chat
      batch.set(chatRef, {
        type: 'event',
        participants: [userId],
        relatedMatchId: null,
        isMutual: false,
        lastMessage: null,
        relatedEventId: eventId,
        lastReadBy: {},
        deletionPolicy: { type: 'none', days: null },
        allowDeleteForEveryone: true,
        deleteForEveryoneWindowDays: 3,
        createdAt: firestore.FieldValue.serverTimestamp(),
        lastMessageAt: firestore.FieldValue.serverTimestamp(),
        deletedAt: null,
        deletedBy: null,
        permanentlyDeleteAt: null,
      });

      await batch.commit();

      Toast.show({
        type: 'success',
        text1: status === 'live' ? 'Event Published! 🎉' : 'Draft Saved!',
        text2: status === 'live'
          ? `"${step1.title}" is now live`
          : `"${step1.title}" saved as draft`,
        visibilityTime: 3000,
      });

      // Navigate to Events tab
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'HostTabs', params: { screen: 'Events' } }],
        })
      );
    } catch (error: any) {
      console.error('Error creating event:', error);
      Alert.alert('Error', 'Failed to create event. Please try again.\n' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0E1621" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} disabled={submitting}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Event</Text>
        <View style={styles.backButton} />
      </View>

      {/* Step Indicator */}
      <View style={styles.stepContainer}>
        {[1, 2, 3, 4].map(step => (
          <View key={step} style={styles.stepWrapper}>
            <View style={[styles.stepBar, styles.stepBarActive]} />
            <Text style={[styles.stepText, step === 4 && styles.stepTextActive]}>{step}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.stepTitle}>Media</Text>
        <Text style={styles.stepSubtitle}>Add photos and videos to attract attendees</Text>

        {/* Banner */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Banner Image <Text style={styles.required}>*</Text>
            <Text style={styles.optional}> (required to publish)</Text>
          </Text>
          <TouchableOpacity
            style={[styles.bannerPicker, banner && styles.bannerPickerFilled]}
            onPress={pickBanner}
            activeOpacity={0.8}
            disabled={submitting}
          >
            {banner ? (
              <>
                <Image source={{ uri: banner }} style={styles.bannerImage} />
                <View style={styles.bannerOverlay}>
                  <Ionicons name="camera-outline" size={24} color="#FFFFFF" />
                  <Text style={styles.bannerChangeText}>Change Banner</Text>
                </View>
              </>
            ) : (
              <View style={styles.bannerEmpty}>
                <Ionicons name="image-outline" size={40} color="#378BBB" />
                <Text style={styles.bannerEmptyText}>Upload Banner Image</Text>
                <Text style={styles.bannerEmptyHint}>Recommended: 16:9 ratio, min 1280×720</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Additional Photos */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Additional Photos <Text style={styles.optional}>(optional, up to 5)</Text>
          </Text>
          <View style={styles.photosGrid}>
            {photos.map((photo, index) => (
              <View key={index} style={styles.photoThumb}>
                <Image source={{ uri: photo.localUri }} style={styles.photoImage} />
                <TouchableOpacity
                  style={styles.removePhotoButton}
                  onPress={() => removePhoto(index)}
                  disabled={submitting}
                >
                  <Ionicons name="close-circle" size={22} color="#FF5252" />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 5 && (
              <TouchableOpacity
                style={styles.addPhotoButton}
                onPress={pickPhotos}
                disabled={submitting}
                activeOpacity={0.8}
              >
                <Ionicons name="add" size={28} color="#378BBB" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Video */}
        <View style={styles.field}>
          <Text style={styles.label}>
            Video <Text style={styles.optional}>(optional)</Text>
          </Text>
          <TouchableOpacity
            style={[styles.videoPicker, video && styles.videoPickerFilled]}
            onPress={pickVideo}
            disabled={submitting}
            activeOpacity={0.8}
          >
            {video ? (
              <View style={styles.videoSelected}>
                <Ionicons name="videocam" size={24} color="#34C759" />
                <Text style={styles.videoSelectedText}>Video selected</Text>
                <TouchableOpacity
                  onPress={() => setVideo(null)}
                  disabled={submitting}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color="#FF5252" />
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.videoEmpty}>
                <Ionicons name="videocam-outline" size={24} color="#378BBB" />
                <Text style={styles.videoEmptyText}>+ Add Video Clip</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Event Summary Card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Event Summary</Text>
          <View style={styles.summaryRow}>
            <Ionicons name="text-outline" size={16} color="#378BBB" />
            <Text style={styles.summaryValue} numberOfLines={1}>{step1.title}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="calendar-outline" size={16} color="#378BBB" />
            <Text style={styles.summaryValue}>
              {new Date(step2.startTime).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="location-outline" size={16} color="#378BBB" />
            <Text style={styles.summaryValue} numberOfLines={1}>{step2.venue}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Ionicons name="ticket-outline" size={16} color="#378BBB" />
            <Text style={styles.summaryValue}>
              {step3.isFree ? 'Free Entry' : `₹${step3.price} per head`}
              {step3.capacityType === 'limited' ? ` · ${step3.capacityTotal} seats` : ' · Unlimited seats'}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      {submitting ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.uploadingContainer}>
            <ActivityIndicator color="#378BBB" size="small" />
            <Text style={styles.uploadingText}>  Uploading &amp; creating event…</Text>
          </View>
        </View>
      ) : (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.draftButton}
            onPress={() => handleSubmit('draft')}
            activeOpacity={0.85}
          >
            <Ionicons name="save-outline" size={18} color="#378BBB" />
            <Text style={styles.draftButtonText}>Save as Draft</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.publishButton}
            onPress={() => handleSubmit('live')}
            activeOpacity={0.85}
          >
            <Ionicons name="rocket-outline" size={18} color="#FFFFFF" />
            <Text style={styles.publishButtonText}>Publish Event</Text>
          </TouchableOpacity>
        </View>
      )}
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
  field: { marginBottom: 24 },
  label: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF', marginBottom: 10 },
  required: { color: '#FF4D6D' },
  optional: { color: '#506A85', fontFamily: 'Inter-Regular', fontSize: 12 },
  bannerPicker: {
    height: 180,
    backgroundColor: '#1B2F48',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)',
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  bannerPickerFilled: { borderStyle: 'solid', borderColor: 'rgba(55, 139, 187, 0.5)' },
  bannerImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  bannerOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  bannerChangeText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  bannerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  bannerEmptyText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#378BBB' },
  bannerEmptyHint: { fontSize: 12, fontFamily: 'Inter-Regular', color: '#506A85' },
  photosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  photoThumb: { width: 88, height: 88, borderRadius: 10, overflow: 'hidden' },
  photoImage: { width: '100%', height: '100%', resizeMode: 'cover' },
  removePhotoButton: { position: 'absolute', top: 4, right: 4 },
  addPhotoButton: {
    width: 88, height: 88, borderRadius: 10,
    backgroundColor: '#1B2F48', borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
  },
  videoPicker: {
    backgroundColor: '#1B2F48', borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(55, 139, 187, 0.3)', borderStyle: 'dashed',
    paddingVertical: 16, paddingHorizontal: 20,
  },
  videoPickerFilled: { borderStyle: 'solid', borderColor: '#34C759', backgroundColor: 'rgba(52, 199, 89, 0.05)' },
  videoEmpty: { flexDirection: 'row', alignItems: 'center', gap: 10, justifyContent: 'center' },
  videoEmptyText: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#378BBB' },
  videoSelected: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  videoSelectedText: { flex: 1, fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#34C759' },
  summaryCard: {
    backgroundColor: '#1B2F48', borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: 'rgba(55, 139, 187, 0.2)', gap: 10,
  },
  summaryTitle: { fontSize: 14, fontFamily: 'Inter-SemiBold', color: '#378BBB', marginBottom: 4 },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryValue: { flex: 1, fontSize: 14, fontFamily: 'Inter-Regular', color: '#B8C7D9' },
  footer: { paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#0E1621', gap: 10 },
  draftButton: {
    backgroundColor: '#1B2F48', borderRadius: 14, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1, borderColor: 'rgba(55, 139, 187, 0.4)',
  },
  draftButtonText: { fontSize: 15, fontFamily: 'Inter-SemiBold', color: '#378BBB' },
  publishButton: {
    backgroundColor: '#FF4D6D', borderRadius: 14, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  publishButtonText: { fontSize: 16, fontFamily: 'Inter-SemiBold', color: '#FFFFFF' },
  uploadingContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16,
  },
  uploadingText: { fontSize: 14, fontFamily: 'Inter-Regular', color: '#B8C7D9' },
});

export default CreateEventStep4Screen;
