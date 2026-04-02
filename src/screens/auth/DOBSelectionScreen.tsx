import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ImageBackground,
  Image,
  FlatList,
  Animated,
} from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../../navigation/AppNavigator';
import Toast from 'react-native-toast-message';
import Ionicons from 'react-native-vector-icons/Ionicons';

// Picker layout constants
const ITEM_HEIGHT = 56;
const VISIBLE_ITEMS = 5;
const PICKER_HEIGHT = ITEM_HEIGHT * VISIBLE_ITEMS; // 280

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'));
const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];
const MAX_YEAR = new Date().getFullYear() - 18;
const YEARS = Array.from({ length: MAX_YEAR - 1950 + 1 }, (_, i) => String(1950 + i));

interface DOBSelectionScreenProps {
  navigation: NativeStackNavigationProp<RootStackParamList, 'DOBSelection'>;
  route: RouteProp<RootStackParamList, 'DOBSelection'>;
}

const DOBSelectionScreen = ({ navigation, route }: DOBSelectionScreenProps) => {
  const insets = useSafeAreaInsets();
  const { fullName, email, username, password } = route.params;

  const DEFAULT_YEAR_INDEX = YEARS.indexOf('2000') >= 0 ? YEARS.indexOf('2000') : 50;

  const [selectedDay, setSelectedDay] = useState(0);       // index into DAYS
  const [selectedMonth, setSelectedMonth] = useState(0);   // index into MONTHS
  const [selectedYear, setSelectedYear] = useState(DEFAULT_YEAR_INDEX);

  // Cast to any so Animated.FlatList's ref is assignable
  const dayRef = useRef<any>(null);
  const monthRef = useRef<any>(null);
  const yearRef = useRef<any>(null);

  // One Animated.Value per column — drives scale+opacity via native driver
  // so animation runs entirely on the UI thread (no JS thread bottleneck)
  const dayScroll = useRef(new Animated.Value(0)).current;
  const monthScroll = useRef(new Animated.Value(0)).current;
  const yearScroll = useRef(new Animated.Value(DEFAULT_YEAR_INDEX * ITEM_HEIGHT)).current;

  // Scroll pickers to initial positions after mount
  useEffect(() => {
    const timer = setTimeout(() => {
      dayRef.current?.scrollToOffset({ offset: 0, animated: false });
      monthRef.current?.scrollToOffset({ offset: 0, animated: false });
      yearRef.current?.scrollToOffset({
        offset: DEFAULT_YEAR_INDEX * ITEM_HEIGHT,
        animated: false,
      });
    }, 150);
    return () => clearTimeout(timer);
  }, []);

  const calculateAge = (dayIdx: number, monthIdx: number, yearIdx: number): number => {
    const today = new Date();
    const day = dayIdx + 1;
    const month = monthIdx; // 0-indexed for Date constructor
    const year = parseInt(YEARS[yearIdx], 10);
    const birthDate = new Date(year, month, day);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  const age = calculateAge(selectedDay, selectedMonth, selectedYear);

  const formatDOB = (): string => {
    const day = String(selectedDay + 1).padStart(2, '0');
    const month = String(selectedMonth + 1).padStart(2, '0');
    const year = YEARS[selectedYear];
    return `${day}/${month}/${year}`;
  };

  const handleContinue = () => {
    // Validate the date is real (e.g. Feb 31 would roll over to March)
    const day = selectedDay + 1;
    const month = selectedMonth;
    const year = parseInt(YEARS[selectedYear], 10);
    const testDate = new Date(year, month, day);
    if (testDate.getMonth() !== month) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Date',
        text2: `${MONTHS[month]} doesn't have ${day} days`,
        visibilityTime: 3000,
      });
      return;
    }
    if (age < 18) {
      Toast.show({
        type: 'error',
        text1: 'Age Requirement',
        text2: 'You must be at least 18 years old to use Funmate',
        visibilityTime: 3000,
      });
      return;
    }
    navigation.navigate('GenderSelection', {
      fullName,
      email,
      username,
      password,
      dob: formatDOB(),
    });
  };

  /**
   * Uses Animated.FlatList + scale/opacity so the animation runs on the native
   * UI thread (useNativeDriver: true) — eliminates JS-thread lag on large lists.
   * Scale replaces fontSize to avoid layout recalculation on every frame.
   * Per-column selection indicators are inset inside each column's own view.
   */
  const renderPicker = (
    data: string[],
    ref: React.RefObject<any>,
    scrollAnim: Animated.Value,
    onIndexChange: (index: number) => void,
  ) => (
    <View style={styles.pickerColumn}>
      {/* Per-column highlight — rounded rect only, no lines */}
      <View style={styles.colSelectionBand} pointerEvents="none" />

      <Animated.FlatList<string>
        ref={ref}
        data={data}
        keyExtractor={(item, idx) => `${item}-${idx}`}
        renderItem={({ item, index }: { item: string; index: number }) => {
          const center = index * ITEM_HEIGHT;
          const inputRange = [
            center - ITEM_HEIGHT * 2,
            center - ITEM_HEIGHT,
            center,
            center + ITEM_HEIGHT,
            center + ITEM_HEIGHT * 2,
          ];
          // scale replaces fontSize — no layout recalc, native-driver compatible
          const scale = scrollAnim.interpolate({
            inputRange,
            outputRange: [0.54, 0.72, 1.0, 0.72, 0.54],
            extrapolate: 'clamp',
          });
          const opacity = scrollAnim.interpolate({
            inputRange,
            outputRange: [0.12, 0.45, 1, 0.45, 0.12],
            extrapolate: 'clamp',
          });
          return (
            <View style={styles.pickerItem}>
              <Animated.Text style={[styles.pickerText, { opacity, transform: [{ scale }] }]}>
                {item}
              </Animated.Text>
            </View>
          );
        }}
        snapToInterval={ITEM_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: (PICKER_HEIGHT - ITEM_HEIGHT) / 2 }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollAnim } } }],
          { useNativeDriver: true },
        )}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.y / ITEM_HEIGHT);
          onIndexChange(Math.max(0, Math.min(index, data.length - 1)));
        }}
        style={{ height: PICKER_HEIGHT }}
        getItemLayout={(_: any, index: number) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
      />
    </View>
  );

  return (
    <ImageBackground
      source={require('../../assets/images/bg_party.webp')}
      style={styles.bg}
      blurRadius={6}
    >
      <View style={styles.overlay} />
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={styles.logoRow}>
          <Image source={require('../../assets/logo.png')} style={styles.logoImage} />
          <Text style={styles.appName}>Funmate</Text>
        </View>
        <View style={styles.headerBtn} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>When were you born?</Text>
        <Text style={styles.subtitle}>Scroll to select your date of birth</Text>

        {/* Column labels */}
        <View style={styles.columnLabels}>
          <Text style={styles.columnLabel}>Day</Text>
          <Text style={styles.columnLabel}>Month</Text>
          <Text style={styles.columnLabel}>Year</Text>
        </View>

        {/* Free-floating pickers — selection highlight is per-column */}
        <View style={styles.pickersWrapper}>
          <View style={styles.pickersRow}>
            {renderPicker(DAYS, dayRef, dayScroll, setSelectedDay)}
            <View style={styles.pickerDivider} />
            {renderPicker(MONTHS, monthRef, monthScroll, setSelectedMonth)}
            <View style={styles.pickerDivider} />
            {renderPicker(YEARS, yearRef, yearScroll, setSelectedYear)}
          </View>
        </View>

        {/* Age display */}
        <View style={styles.ageBadge}>
          <Text style={styles.ageBadgeText}>
            {age >= 0 && age < 150
              ? `Your age is ${age} year${age !== 1 ? 's' : ''}`
              : 'Select your date of birth'}
          </Text>
        </View>

        {/* Spacer pushes button down */}
        <View style={{ flex: 1 }} />

        {/* Continue button */}
        <TouchableOpacity onPress={handleContinue} activeOpacity={0.85}>
          <LinearGradient
            colors={['#8B2BE2', '#06B6D4']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[
              styles.continueButton,
              { marginBottom: Math.max(32, insets.bottom + 16) },
            ]}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
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
    backgroundColor: 'rgba(13,11,30,0.62)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 42,
    height: 42,
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
    fontSize: 18,
    fontFamily: 'Inter-Bold',
    letterSpacing: 0.3,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 64,
  },
  title: {
    fontSize: 32,
    fontFamily: 'Inter-Bold',
    color: '#FFFFFF',
    lineHeight: 40,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 15,
    fontFamily: 'Inter-Regular',
    color: 'rgba(255,255,255,0.50)',
    marginBottom: 32,
  },

  columnLabels: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  columnLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 13,
    fontFamily: 'Inter-SemiBold',
    color: 'rgba(255,255,255,0.90)',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  // Wrapper for the free-floating pickers row
  pickersWrapper: {
    height: PICKER_HEIGHT,
  },
  pickersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: PICKER_HEIGHT,
  },
  pickerColumn: {
    flex: 1,
    position: 'relative',
  },
  // Per-column selection highlight (rounded rect + two lines)
  colSelectionBand: {
    position: 'absolute',
    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    left: 6,
    right: 6,
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderRadius: 10,
    zIndex: 0,
  },
  colSelectionTopLine: {
    position: 'absolute',
    top: (PICKER_HEIGHT - ITEM_HEIGHT) / 2,
    left: 6,
    right: 6,
    height: 1.5,
    backgroundColor: 'rgba(139,92,246,0.60)',
    borderRadius: 1,
    zIndex: 2,
  },
  colSelectionBottomLine: {
    position: 'absolute',
    top: (PICKER_HEIGHT + ITEM_HEIGHT) / 2,
    left: 6,
    right: 6,
    height: 1.5,
    backgroundColor: 'rgba(139,92,246,0.60)',
    borderRadius: 1,
    zIndex: 2,
  },
  pickerDivider: {
    width: 2,
    height: PICKER_HEIGHT * 0.65,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  pickerItem: {
    height: ITEM_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerText: {
    fontSize: 22,
    color: '#FFFFFF',
    fontFamily: 'Inter-Regular',
  },

  // Age badge
  ageBadge: {
    marginTop: 20,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(139,92,246,0.35)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  ageBadgeText: {
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
    color: '#FFFFFF',
  },

  // Continue button
  continueButton: {
    height: 54,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontFamily: 'Inter-SemiBold',
  },
});

export default DOBSelectionScreen;
