import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Animated,
  Pressable,
  ImageBackground,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';

interface AccountTypeScreenProps {
  navigation: any;
}

const AccountTypeScreen = ({ navigation }: AccountTypeScreenProps) => {
  const insets = useSafeAreaInsets();
  const [openCard, setOpenCard] = useState<string | null>(null);
  const explorerCardSlide = useRef(new Animated.Value(-400)).current;
  const hostCardSlide = useRef(new Animated.Value(400)).current;
  const explorerCircleScale = useRef(new Animated.Value(1)).current;
  const hostCircleScale = useRef(new Animated.Value(1)).current;

  const slideCard = (cardAnim: Animated.Value, open: boolean, direction: 'left' | 'right') => {
    Animated.spring(cardAnim, {
      toValue: open ? 0 : (direction === 'right' ? 400 : -400),
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  };

  const scaleCircle = (circleAnim: Animated.Value, shrink: boolean) => {
    Animated.spring(circleAnim, {
      toValue: shrink ? 0 : 1,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  };

  useEffect(() => {
    // Card slide animations
    if (openCard === 'explorer') {
      slideCard(explorerCardSlide, true, 'left');
      slideCard(hostCardSlide, false, 'right');
      scaleCircle(explorerCircleScale, true);
      scaleCircle(hostCircleScale, false);
    } else if (openCard === 'host') {
      slideCard(hostCardSlide, true, 'right');
      slideCard(explorerCardSlide, false, 'left');
      scaleCircle(hostCircleScale, true);
      scaleCircle(explorerCircleScale, false);
    } else {
      slideCard(explorerCardSlide, false, 'left');
      slideCard(hostCardSlide, false, 'right');
      scaleCircle(explorerCircleScale, false);
      scaleCircle(hostCircleScale, false);
    }
  }, [openCard]);

  const handleCirclePress = (type: string) => {
    setOpenCard(openCard === type ? null : type);
  };

  const handleCardPress = (type: string) => {
    if (openCard !== type) return; // Only navigate if this card is open
    console.log(`Navigating to ${type} account`);
    setOpenCard(null); // Close card immediately to prevent double-tap
    navigation.navigate('PhoneNumber', { accountType: type === 'explorer' ? 'user' : 'creator' });
  };

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.imageBackground}
      blurRadius={6}
    >
      <View style={styles.bgDarkOverlay} />
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

      {/* Background overlay to close cards when clicked */}
      {openCard && (
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={() => setOpenCard(null)}
        />
      )}

      {/* Invisible card tap zones - always on top */}
      {openCard === 'explorer' && (
        <Pressable
          style={styles.explorerCardTapZone}
          onPress={() => {
            console.log('Explorer tap zone pressed');
            navigation.navigate('PhoneNumber', { accountType: 'user' });
          }}
        />
      )}
      {openCard === 'host' && (
        <Pressable
          style={styles.hostCardTapZone}
          onPress={() => {
            console.log('Host tap zone pressed');
            navigation.navigate('PhoneNumber', { accountType: 'creator' });
          }}
        />
      )}

      {/* Header Section */}
      <View style={styles.headerSection}>
        <Text style={styles.title}>Join Funmate</Text>
        <Text style={styles.subtitle}>Choose your journey</Text>
      </View>

      {/* Circle and Card Container */}
      <View style={styles.contentArea}>
        {/* Explorer Section - Left Top */}
        <View style={styles.explorerContainer}>
          <TouchableOpacity
            onPress={() => handleCirclePress('explorer')}
            activeOpacity={0.8}
            disabled={openCard === 'explorer'}
          >
            <Animated.View style={[
              styles.circle,
              openCard === 'explorer' && styles.circleActive,
              { transform: [{ scale: explorerCircleScale }] }
            ]}>
              <Text style={styles.circleText}>Explorer</Text>
            </Animated.View>
          </TouchableOpacity>
          
          {/* Explorer Card - slides from left screen edge */}
          <Animated.View
            style={[
              styles.card,
              styles.explorerCard,
              { transform: [{ translateX: explorerCardSlide }] }
            ]}
          >
            <Pressable
              onPress={() => handleCardPress('explorer')}
              style={styles.cardTouchable}
            >
              <Text style={styles.cardTitle}>Join as Explorer</Text>
              <Text style={styles.cardDescription}>
                Swipe, match, and discover events with people who share your vibe
              </Text>
            </Pressable>
          </Animated.View>
        </View>

        {/* Host Section - Right Bottom */}
        <View style={styles.hostContainer}>
          {/* Host Card - slides from right screen edge */}
          <Animated.View
            style={[
              styles.card,
              styles.hostCard,
              { transform: [{ translateX: hostCardSlide }] }
            ]}
          >
            <Pressable
              onPress={() => handleCardPress('host')}
              style={styles.cardTouchable}
            >
              <Text style={styles.cardTitle}>Join as Event Host</Text>
              <Text style={styles.cardDescription}>
                Create experiences, manage events, and monetize your community
              </Text>
            </Pressable>
          </Animated.View>

          <TouchableOpacity
            onPress={() => handleCirclePress('host')}
            activeOpacity={0.8}
            disabled={openCard === 'host'}
          >
            <Animated.View style={[
              styles.circle,
              openCard === 'host' && styles.circleActive,
              { transform: [{ scale: hostCircleScale }] }
            ]}>
              <Text style={styles.circleText}>Host</Text>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        style={{ marginBottom: Math.max(24, insets.bottom) }}
      >
        <LinearGradient
          colors={['#8B2BE2', '#06B6D4']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.backButton}
        >
          <Text style={styles.backButtonText}>Back to Login</Text>
        </LinearGradient>
      </TouchableOpacity>
    </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  imageBackground: {
    flex: 1,
  },
  bgDarkOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(13, 11, 30, 0.62)',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 4,
  },
  headerSection: {
    marginTop: 60,
    marginBottom: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.55)',
    lineHeight: 24,
    fontFamily: 'Inter-Regular',
  },
  contentArea: {
    flex: 1,
    justifyContent: 'space-around',
    paddingVertical: 40,
  },
  explorerContainer: {
    position: 'relative',
    alignSelf: 'flex-start',
    marginLeft: -15,
    zIndex: 6,
  },
  hostContainer: {
    position: 'relative',
    alignSelf: 'flex-end',
    marginRight: -10,
    zIndex: 6,
  },
  circle: {
    width: 250,
    height: 250,
    borderRadius: 125,
    backgroundColor: 'rgba(30, 28, 45, 0.88)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  circleActive: {
    borderColor: 'rgba(139, 92, 246, 0.70)',
    borderWidth: 2,
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  circleText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#FFFFFF',
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  card: {
    position: 'absolute',
    width: 330,
    height: 210,
    backgroundColor: 'rgba(30, 28, 45, 0.88)',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.40)',
    zIndex: 20,
  },
  explorerCard: {
    top: 0,
    left: 8,
  },
  hostCard: {
    top: 39,
    left: -83,
  },
  cardTouchable: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    fontFamily: 'Inter-Bold',
    textAlign: 'center',
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.65)',
    lineHeight: 20,
    fontFamily: 'Inter-Regular',
    textAlign: 'center',
  },
  backButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  backButtonText: {
    fontSize: 17,
    color: '#FFFFFF',
    fontFamily: 'Inter-SemiBold',
  },
  explorerCardTapZone: {
    position: 'absolute',
    top: 200,
    left: 24,
    width: 330,
    height: 210,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
  hostCardTapZone: {
    position: 'absolute',
    top: 420,
    right: 24,
    width: 330,
    height: 210,
    zIndex: 100,
    backgroundColor: 'transparent',
  },
});

export default AccountTypeScreen;
