/**
 * Interests Selection Screen
 * 
 * Users select 5-15 interests from various categories.
 * Selected interests appear as chips at the top and can be removed.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  ImageBackground,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import CategoryIcon from '../../components/icons/CategoryIcons';
import Toast from 'react-native-toast-message';
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';

interface InterestsSelectionScreenProps {
  navigation: any;
}

// Interest categories with tags (similar to Bumble, Hinge, Tinder)
const INTEREST_CATEGORIES = [
  {
    id: 'movies_tv',
    name: 'Movies & TV',
    icon: 'film-outline',
    tags: [
      'Action Movies', 'Comedy', 'Drama', 'Sci-Fi', 'Horror',
      'Romantic Comedies', 'Documentaries', 'Anime', 'Thriller',
      'Marvel', 'DC', 'Netflix', 'Stand-up Comedy', 'Reality TV',
    ],
  },
  {
    id: 'music',
    name: 'Music',
    icon: 'musical-notes-outline',
    tags: [
      'Pop', 'Rock', 'Hip Hop', 'EDM', 'Jazz', 'Classical',
      'Country', 'R&B', 'Indie', 'K-Pop', 'Metal', 'Live Music',
      'Concerts', 'Music Festivals', 'Playing Instruments',
    ],
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    icon: 'football-outline',
    tags: [
      'Football', 'Cricket', 'Basketball', 'Tennis', 'Badminton',
      'Swimming', 'Yoga', 'Gym', 'Running', 'Cycling', 'Hiking',
      'Boxing', 'Dancing', 'Rock Climbing', 'Martial Arts',
    ],
  },
  {
    id: 'food',
    name: 'Food & Drink',
    icon: 'restaurant-outline',
    tags: [
      'Cooking', 'Baking', 'Coffee', 'Wine', 'Craft Beer',
      'Street Food', 'Fine Dining', 'Vegan', 'Italian Food',
      'Asian Cuisine', 'Pizza', 'Desserts', 'Food Trucks', 'BBQ',
    ],
  },
  {
    id: 'travel',
    name: 'Travel & Adventure',
    icon: 'airplane-outline',
    tags: [
      'Beach Vacations', 'Mountain Trips', 'Road Trips', 'Backpacking',
      'Luxury Travel', 'Solo Travel', 'City Breaks', 'Camping',
      'Photography', 'Adventure Sports', 'Cultural Tours', 'Cruises',
    ],
  },
  {
    id: 'hobbies',
    name: 'Hobbies & Interests',
    icon: 'color-palette-outline',
    tags: [
      'Photography', 'Painting', 'Drawing', 'Writing', 'Reading',
      'Gaming', 'Board Games', 'Puzzles', 'Collecting', 'DIY',
      'Gardening', 'Astronomy', 'Chess', 'Magic Tricks',
    ],
  },
  {
    id: 'arts',
    name: 'Arts & Culture',
    icon: 'brush-outline',
    tags: [
      'Museums', 'Art Galleries', 'Theater', 'Opera', 'Ballet',
      'Poetry', 'Literature', 'History', 'Philosophy', 'Design',
      'Architecture', 'Fashion', 'Vintage Shopping',
    ],
  },
  {
    id: 'lifestyle',
    name: 'Lifestyle',
    icon: 'heart-outline',
    tags: [
      'Meditation', 'Mindfulness', 'Sustainability', 'Volunteering',
      'Animal Lover', 'Dogs', 'Cats', 'Plant Parent', 'Minimalism',
      'Festivals', 'Spirituality', 'Self-improvement', 'Podcasts',
    ],
  },
  {
    id: 'social',
    name: 'Social & Nightlife',
    icon: 'people-outline',
    tags: [
      'Clubbing', 'Karaoke', 'Pub Quiz', 'Game Nights', 'Brunch',
      'House Parties', 'Rooftop Bars', 'Comedy Shows', 'Trivia',
      'Socializing', 'Networking', 'Making Friends',
    ],
  },
  {
    id: 'tech',
    name: 'Tech & Innovation',
    icon: 'laptop-outline',
    tags: [
      'Coding', 'AI', 'Startups', 'Crypto', 'Tech Gadgets',
      'Video Editing', 'Content Creation', 'Social Media',
      'Blogging', 'YouTube', 'E-sports', 'VR/AR',
    ],
  },
];

const InterestsSelectionScreen: React.FC<InterestsSelectionScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [expandedCategory, setExpandedCategory] = useState<string | null>('movies_tv');
  const [saving, setSaving] = useState(false);

  const handleToggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      // Remove interest
      setSelectedInterests(prev => prev.filter(i => i !== interest));
    } else {
      // Add interest (max 15)
      if (selectedInterests.length >= 15) {
        Toast.show({
          type: 'info',
          text1: 'Maximum Reached',
          text2: 'You can select up to 15 interests',
          visibilityTime: 2000,
        });
        return;
      }
      setSelectedInterests(prev => [...prev, interest]);
    }
  };

  /**
   * Skip interests selection - creates empty interests array
   */
  const handleSkip = async () => {
    setSaving(true);

    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Save empty interests array (for profile completion tracking)
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          interests: [],
        });

      // Update signupStep to preferences
      await firestore()
        .collection('accounts')
        .doc(userId)
        .update({
          signupStep: 'preferences',
        });

      console.log('✅ Interests skipped - empty array saved');
      
      // Navigate to Looking For screen
      navigation.navigate('LookingFor' as never);

    } catch (error: any) {
      console.error('❌ Error skipping interests:', error);
      Toast.show({
        type: 'error',
        text1: 'Skip Failed',
        text2: error.message || 'Could not skip. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleContinue = async () => {
    if (selectedInterests.length < 5) {
      Toast.show({
        type: 'error',
        text1: 'Select More Interests',
        text2: `Please select at least 5 interests (${selectedInterests.length}/5)`,
        visibilityTime: 3000,
      });
      return;
    }

    setSaving(true);

    try {
      const userId = auth().currentUser?.uid;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Save interests to users collection (following database schema)
      await firestore()
        .collection('users')
        .doc(userId)
        .update({
          interests: selectedInterests,
        });

      // Update signupStep to preferences
      await firestore()
        .collection('accounts')
        .doc(userId)
        .update({
          signupStep: 'preferences',
        });

      console.log('✅ Interests saved:', selectedInterests);
      
      Toast.show({
        type: 'success',
        text1: 'Interests Saved!',
        text2: `${selectedInterests.length} interests selected`,
        visibilityTime: 2000,
      });

      // Navigate to Looking For screen
      setTimeout(() => {
        navigation.navigate('LookingFor' as never);
      }, 1500);

    } catch (error: any) {
      console.error('❌ Error saving interests:', error);
      Toast.show({
        type: 'error',
        text1: 'Save Failed',
        text2: error.message || 'Could not save interests. Please try again.',
        visibilityTime: 3000,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.bg}
      blurRadius={3}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Header — Funmate logo + Skip */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerSide}>
          {navigation.canGoBack() && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => navigation.goBack()}
              activeOpacity={0.7}
            >
              <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
            </TouchableOpacity>
          )}
        </View>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
        <View style={styles.headerSide}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            disabled={saving}
            activeOpacity={0.7}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Count badge — floats below header */}
      <View style={styles.countRow}>
        <Text style={styles.countText}>{selectedInterests.length} / 15 selected</Text>
        <Text style={[
          styles.minText,
          selectedInterests.length >= 5 && styles.minTextSuccess,
        ]}>
          {selectedInterests.length >= 5 ? '✓ Minimum met' : 'Minimum: 5'}
        </Text>
      </View>

      {/* Main scroll */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>

        {/* Page title inside scroll */}
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Your Interests</Text>
          <Text style={styles.subtitle}>Pick 5–15 interests to help us find your match</Text>
        </View>

        {/* Category icon row */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesScrollContent}
          style={styles.categoriesScroll}
        >
          {INTEREST_CATEGORIES.map((category) => {
            const selectedCount = category.tags.filter(tag => selectedInterests.includes(tag)).length;
            const isExpanded = expandedCategory === category.id;
            return (
              <View key={category.id} style={styles.categoryWrapper}>
                <TouchableOpacity
                  style={[styles.categoryIconButton, isExpanded && styles.categoryIconButtonActive]}
                  onPress={() => setExpandedCategory(isExpanded ? null : category.id)}
                  activeOpacity={0.7}
                >
                  <CategoryIcon categoryId={category.id} size={76} />
                  {selectedCount > 0 && (
                    <View style={styles.iconBadge}>
                      <Text style={styles.iconBadgeText}>{selectedCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <Text style={styles.categoryLabel} numberOfLines={1}>{category.name.split(' ')[0]}</Text>
              </View>
            );
          })}
        </ScrollView>

        {/* Selected chips — shown between category icons and expanded tags */}
        {selectedInterests.length > 0 && (
          <View style={styles.selectedContainer}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.selectedChipsContainer}
            >
              {selectedInterests.map((interest) => (
                <TouchableOpacity
                  key={interest}
                  onPress={() => handleToggleInterest(interest)}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={['#8B2BE2', '#06B6D4']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.selectedChip}
                  >
                    <Text style={styles.selectedChipText}>{interest}</Text>
                    <Ionicons name="close-circle" size={16} color="#FFFFFF" />
                  </LinearGradient>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Expanded category tags */}
        {expandedCategory && (
          <View style={styles.expandedSection}>
            {(() => {
              const category = INTEREST_CATEGORIES.find(c => c.id === expandedCategory);
              if (!category) return null;
              return (
                <>
                  <View style={styles.expandedHeader}>
                    <Text style={styles.expandedTitle}>{category.name}</Text>
                    <TouchableOpacity
                      onPress={() => setExpandedCategory(null)}
                      activeOpacity={0.7}
                      style={styles.closeButton}
                    >
                      <Ionicons name="close" size={22} color="rgba(255,255,255,0.5)" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tagsContainer}>
                    {category.tags.map((tag) => {
                      const isSelected = selectedInterests.includes(tag);
                      return (
                        <TouchableOpacity
                          key={tag}
                          onPress={() => handleToggleInterest(tag)}
                          activeOpacity={0.7}
                        >
                          {isSelected ? (
                            <LinearGradient
                              colors={['#8B2BE2', '#06B6D4']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={styles.tag}
                            >
                              <Text style={styles.tagTextSelected}>{tag}</Text>
                              <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                            </LinearGradient>
                          ) : (
                            <View style={styles.tagUnselected}>
                              <Text style={styles.tagText}>{tag}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              );
            })()}
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {/* Continue button — no footer band */}
      <View style={[styles.footer, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
        <TouchableOpacity
          onPress={handleContinue}
          disabled={saving}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={selectedInterests.length >= 5 ? ['#8B2BE2', '#06B6D4'] : ['rgba(30,24,58,0.9)', 'rgba(30,24,58,0.9)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.continueButton}
          >
            <Text style={[styles.continueButtonText, selectedInterests.length < 5 && styles.continueButtonTextDisabled]}>
              {saving ? 'Saving...' : `Continue${selectedInterests.length > 0 ? ` (${selectedInterests.length})` : ''}`}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  bg: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(13,11,30,0.72)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerSide: {
    width: 60,
    alignItems: 'flex-start',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  logoImage: {
    width: 30,
    height: 30,
    resizeMode: 'contain',
  },
  appName: {
    color: '#FFFFFF',
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  skipButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  skipButtonText: {
    fontSize: 15,
    fontFamily: 'Inter-SemiBold',
    color: '#22D3EE',
  },
  countRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginTop: 14,
  },
  countText: {
    fontSize: 14,
    fontFamily: 'Inter-SemiBold',
    color: '#A855F7',
  },
  minText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: 'rgba(255,255,255,0.45)',
  },
  minTextSuccess: {
    color: '#2ECC71',
  },
  selectedContainer: {
    paddingVertical: 10,
  },
  selectedChipsContainer: {
    paddingHorizontal: 20,
    gap: 8,
  },
  selectedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    gap: 6,
  },
  selectedChipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
  },
  scrollView: {
    flex: 1,
  },
  titleBlock: {
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 20,
  },
  categoriesScroll: {
    paddingVertical: 16,
  },
  categoriesScrollContent: {
    paddingHorizontal: 16,
    gap: 12,
  },
  categoryWrapper: {
    width: 100,
    alignItems: 'center',
    gap: 6,
  },
  categoryIconButton: {
    width: 100,
    height: 110,
    backgroundColor: 'rgba(26,21,48,0.88)',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.35)',
    overflow: 'hidden',
  },
  categoryIconButtonActive: {
    borderColor: '#A855F7',
    borderWidth: 2.5,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 12,
  },
  categoryLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    fontFamily: 'Inter-Medium',
    textAlign: 'center',
  },
  iconBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#06B6D4',
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontFamily: 'Inter-Bold',
  },
  expandedSection: {
    backgroundColor: 'rgba(13,11,30,0.9)',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.45)',
  },
  expandedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  expandedTitle: {
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 5,
  },
  tagUnselected: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    paddingHorizontal: 13,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    gap: 5,
  },
  tagText: {
    fontSize: 13,
    fontFamily: 'Inter-Medium',
    color: '#FFFFFF',
  },
  tagTextSelected: {
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 20,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
  continueButtonTextDisabled: {
    color: 'rgba(255,255,255,0.35)',
  },
});

export default InterestsSelectionScreen;
