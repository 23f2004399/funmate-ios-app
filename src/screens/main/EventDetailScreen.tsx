/**
 * EVENT DETAIL SCREEN — Phase E2 (placeholder)
 *
 * Will display full event info, media carousel, host flip card,
 * and sticky Book Now CTA.
 * Built in Phase E2 — see _imp_.md for spec.
 */

import React from 'react';
import { View, Text, StyleSheet, StatusBar, TouchableOpacity, ImageBackground } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const EventDetailScreen = () => {
  const navigation = useNavigation();
  const insets     = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require('../../assets/images/bg_splash.webp')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

        <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={[styles.content, { paddingBottom: Math.max(24, insets.bottom + 12) }]}>
          <View style={styles.iconWrap}>
            <Ionicons name="calendar-outline" size={44} color="#A855F7" />
          </View>
          <Text style={styles.title}>Event Details</Text>
          <Text style={styles.subtitle}>Phase E2 — coming soon</Text>
        </View>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0D0B1E',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(13, 11, 30, 0.60)',
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'transparent',
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#1A1530',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 14,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: '#1A1530',
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.30)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.55)',
    textAlign: 'center',
  },
});

export default EventDetailScreen;
