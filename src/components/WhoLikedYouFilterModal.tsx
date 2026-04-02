/**
 * WHO LIKED YOU FILTER MODAL
 * 
 * Comprehensive filtering interface for "Who Liked You" section
 * Filters: Age, Height, Relationship Intent, Distance, Occupation, Trust Score, Match Score
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MultiSlider from '@ptomasroos/react-native-multi-slider';
import { WhoLikedYouFilters, DEFAULT_FILTERS, RELATIONSHIP_INTENT_OPTIONS } from '../types/filters';

const { width } = Dimensions.get('window');

interface Props {
  visible: boolean;
  onClose: () => void;
  filters: WhoLikedYouFilters;
  onApplyFilters: (filters: WhoLikedYouFilters) => void;
  availableOccupations: string[]; // List of unique occupations from likers
}

const WhoLikedYouFilterModal: React.FC<Props> = ({
  visible,
  onClose,
  filters,
  onApplyFilters,
  availableOccupations,
}) => {
  const insets = useSafeAreaInsets();

  // Local state for editing filters
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(60);
  const [heightMin, setHeightMin] = useState(100);
  const [heightMax, setHeightMax] = useState(300);
  const [selectedIntents, setSelectedIntents] = useState<string[]>([]);
  const [maxDistance, setMaxDistance] = useState(100);
  const [selectedOccupations, setSelectedOccupations] = useState<string[]>([]);
  const [occupationSearch, setOccupationSearch] = useState('');
  const [trustScoreMin, setTrustScoreMin] = useState(0);
  const [trustScoreMax, setTrustScoreMax] = useState(100);
  const [matchScoreMin, setMatchScoreMin] = useState(0);
  const [matchScoreMax, setMatchScoreMax] = useState(100);

  // Initialize from filters prop
  useEffect(() => {
    if (filters.ageRange) {
      setAgeMin(filters.ageRange.min);
      setAgeMax(filters.ageRange.max);
    } else {
      setAgeMin(18);
      setAgeMax(60);
    }

    if (filters.heightRange) {
      setHeightMin(filters.heightRange.min);
      setHeightMax(filters.heightRange.max);
    } else {
      setHeightMin(100);
      setHeightMax(300);
    }

    setSelectedIntents(filters.relationshipIntent || []);
    setMaxDistance(filters.maxDistance || 100);
    setSelectedOccupations(filters.occupations || []);

    if (filters.trustScoreRange) {
      setTrustScoreMin(filters.trustScoreRange.min);
      setTrustScoreMax(filters.trustScoreRange.max);
    } else {
      setTrustScoreMin(0);
      setTrustScoreMax(100);
    }

    if (filters.matchScoreRange) {
      setMatchScoreMin(filters.matchScoreRange.min);
      setMatchScoreMax(filters.matchScoreRange.max);
    } else {
      setMatchScoreMin(0);
      setMatchScoreMax(100);
    }
  }, [filters, visible]);

  const toggleIntent = (intent: string) => {
    setSelectedIntents(prev =>
      prev.includes(intent)
        ? prev.filter(i => i !== intent)
        : [...prev, intent]
    );
  };

  const toggleOccupation = (occupation: string) => {
    setSelectedOccupations(prev =>
      prev.includes(occupation)
        ? prev.filter(o => o !== occupation)
        : [...prev, occupation]
    );
  };

  const handleApply = () => {
    const newFilters: WhoLikedYouFilters = {
      ageRange: ageMin !== 18 || ageMax !== 60 ? { min: ageMin, max: ageMax } : null,
      heightRange: heightMin !== 100 || heightMax !== 300 ? { min: heightMin, max: heightMax } : null,
      relationshipIntent: selectedIntents.length > 0 ? selectedIntents : null,
      maxDistance: maxDistance !== 100 ? maxDistance : null,
      occupations: selectedOccupations.length > 0 ? selectedOccupations : null,
      trustScoreRange: trustScoreMin !== 0 || trustScoreMax !== 100 ? { min: trustScoreMin, max: trustScoreMax } : null,
      matchScoreRange: matchScoreMin !== 0 || matchScoreMax !== 100 ? { min: matchScoreMin, max: matchScoreMax } : null,
    };

    onApplyFilters(newFilters);
    onClose();
  };

  const handleClearAll = () => {
    setAgeMin(18);
    setAgeMax(60);
    setHeightMin(100);
    setHeightMax(300);
    setSelectedIntents([]);
    setMaxDistance(100);
    setSelectedOccupations([]);
    setOccupationSearch('');
    setTrustScoreMin(0);
    setTrustScoreMax(100);
    setMatchScoreMin(0);
    setMatchScoreMax(100);
    
    // Apply default filters immediately
    onApplyFilters(DEFAULT_FILTERS);
  };

  const filteredOccupations = availableOccupations.filter(occ =>
    occ.toLowerCase().includes(occupationSearch.toLowerCase())
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Filter Who Liked You</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Scrollable Filters */}
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Age Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Age Range</Text>
              <Text style={styles.rangeValue}>{ageMin} - {ageMax} years</Text>
              <View style={styles.sliderContainer}>
                <MultiSlider
                  values={[ageMin, ageMax]}
                  onValuesChange={(values) => {
                    setAgeMin(values[0]);
                    setAgeMax(values[1]);
                  }}
                  min={18}
                  max={60}
                  step={1}
                  sliderLength={width - 80}
                  selectedStyle={{
                    backgroundColor: '#378BBB',
                  }}
                  unselectedStyle={{
                    backgroundColor: '#1B2F48',
                  }}
                  markerStyle={{
                    backgroundColor: '#378BBB',
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                  }}
                  pressedMarkerStyle={{
                    backgroundColor: '#378BBB',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                  }}
                />
              </View>
            </View>

            {/* Height Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Height Range</Text>
              <Text style={styles.rangeValue}>{heightMin} - {heightMax} cm</Text>
              <View style={styles.sliderContainer}>
                <MultiSlider
                  values={[heightMin, heightMax]}
                  onValuesChange={(values) => {
                    setHeightMin(values[0]);
                    setHeightMax(values[1]);
                  }}
                  min={100}
                  max={300}
                  step={1}
                  sliderLength={width - 80}
                  selectedStyle={{
                    backgroundColor: '#378BBB',
                  }}
                  unselectedStyle={{
                    backgroundColor: '#1B2F48',
                  }}
                  markerStyle={{
                    backgroundColor: '#378BBB',
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                  }}
                  pressedMarkerStyle={{
                    backgroundColor: '#378BBB',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                  }}
                />
              </View>
            </View>

            {/* Relationship Intent */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Relationship Intent</Text>
              <View style={styles.chipsContainer}>
                {RELATIONSHIP_INTENT_OPTIONS.map(option => (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.chip,
                      selectedIntents.includes(option.value) && styles.chipSelected,
                    ]}
                    onPress={() => toggleIntent(option.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedIntents.includes(option.value) && styles.chipTextSelected,
                      ]}
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Distance */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Maximum Distance</Text>
              <Text style={styles.rangeValue}>Within {maxDistance} km</Text>
              <View style={styles.sliderContainer}>
                <MultiSlider
                  values={[maxDistance]}
                  onValuesChange={(values) => setMaxDistance(values[0])}
                  min={1}
                  max={100}
                  step={1}
                  sliderLength={width - 80}
                  selectedStyle={{
                    backgroundColor: '#378BBB',
                  }}
                  unselectedStyle={{
                    backgroundColor: '#1B2F48',
                  }}
                  markerStyle={{
                    backgroundColor: '#378BBB',
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                  }}
                  pressedMarkerStyle={{
                    backgroundColor: '#378BBB',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                  }}
                />
              </View>
            </View>

            {/* Occupation */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Occupation</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Search occupations..."
                value={occupationSearch}
                onChangeText={setOccupationSearch}
                placeholderTextColor="#7F93AA"
              />
              <ScrollView style={styles.occupationList} nestedScrollEnabled>
                {filteredOccupations.length > 0 ? (
                  filteredOccupations.map(occ => (
                    <TouchableOpacity
                      key={occ}
                      style={[
                        styles.occupationItem,
                        selectedOccupations.includes(occ) && styles.occupationItemSelected,
                      ]}
                      onPress={() => toggleOccupation(occ)}
                    >
                      <Text
                        style={[
                          styles.occupationText,
                          selectedOccupations.includes(occ) && styles.occupationTextSelected,
                        ]}
                      >
                        {occ}
                      </Text>
                      {selectedOccupations.includes(occ) && (
                        <Ionicons name="checkmark-circle" size={20} color="#378BBB" />
                      )}
                    </TouchableOpacity>
                  ))
                ) : (
                  <Text style={styles.emptyText}>No occupations available</Text>
                )}
              </ScrollView>
              {selectedOccupations.length > 0 && (
                <Text style={styles.selectedCount}>{selectedOccupations.length} selected</Text>
              )}
            </View>

            {/* Trust Score Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Trust Score (Profile Completeness)</Text>
              <Text style={styles.rangeValue}>{trustScoreMin}% - {trustScoreMax}%</Text>
              <View style={styles.sliderContainer}>
                <MultiSlider
                  values={[trustScoreMin, trustScoreMax]}
                  onValuesChange={(values) => {
                    setTrustScoreMin(values[0]);
                    setTrustScoreMax(values[1]);
                  }}
                  min={0}
                  max={100}
                  step={5}
                  sliderLength={width - 80}
                  selectedStyle={{
                    backgroundColor: '#378BBB',
                  }}
                  unselectedStyle={{
                    backgroundColor: '#1B2F48',
                  }}
                  markerStyle={{
                    backgroundColor: '#378BBB',
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                  }}
                  pressedMarkerStyle={{
                    backgroundColor: '#378BBB',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                  }}
                />
              </View>
            </View>

            {/* Match Score Range */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Match Score</Text>
              <Text style={styles.rangeValue}>{matchScoreMin}% - {matchScoreMax}%</Text>
              <View style={styles.sliderContainer}>
                <MultiSlider
                  values={[matchScoreMin, matchScoreMax]}
                  onValuesChange={(values) => {
                    setMatchScoreMin(values[0]);
                    setMatchScoreMax(values[1]);
                  }}
                  min={0}
                  max={100}
                  step={5}
                  sliderLength={width - 80}
                  selectedStyle={{
                    backgroundColor: '#378BBB',
                  }}
                  unselectedStyle={{
                    backgroundColor: '#1B2F48',
                  }}
                  markerStyle={{
                    backgroundColor: '#378BBB',
                    height: 24,
                    width: 24,
                    borderRadius: 12,
                  }}
                  pressedMarkerStyle={{
                    backgroundColor: '#378BBB',
                    height: 28,
                    width: 28,
                    borderRadius: 14,
                  }}
                />
              </View>
            </View>

            <View style={styles.bottomPadding} />
          </ScrollView>

          {/* Footer Actions */}
          <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <Text style={styles.clearButtonText}>Clear All</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0E1621',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2F48',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  filterSection: {
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1B2F48',
  },
  filterLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  rangeValue: {
    fontSize: 14,
    color: '#B8C7D9',
    marginBottom: 12,
  },
  sliderContainer: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  doubleSliderContainer: {
    marginBottom: 8,
  },
  sliderLabel: {
    fontSize: 13,
    color: '#7F93AA',
    marginBottom: 4,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#378BBB',
    backgroundColor: '#16283D',
  },
  chipSelected: {
    backgroundColor: '#378BBB',
    borderColor: '#378BBB',
  },
  chipText: {
    fontSize: 14,
    color: '#B8C7D9',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#FFFFFF',
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#1B2F48',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#FFFFFF',
    backgroundColor: '#16283D',
    marginBottom: 12,
  },
  occupationList: {
    maxHeight: 150,
  },
  occupationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
    backgroundColor: '#16283D',
  },
  occupationItemSelected: {
    backgroundColor: '#1B2F48',
  },
  occupationText: {
    fontSize: 14,
    color: '#FFFFFF',
  },
  occupationTextSelected: {
    color: '#378BBB',
    fontWeight: '500',
  },
  emptyText: {
    fontSize: 14,
    color: '#7F93AA',
    textAlign: 'center',
    paddingVertical: 20,
  },
  selectedCount: {
    fontSize: 12,
    color: '#378BBB',
    marginTop: 8,
    fontWeight: '500',
  },
  bottomPadding: {
    height: 20,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#1B2F48',
  },
  clearButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#378BBB',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#378BBB',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#378BBB',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default WhoLikedYouFilterModal;
