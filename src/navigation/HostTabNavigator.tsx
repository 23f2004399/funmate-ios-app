/**
 * HOST TAB NAVIGATOR
 * 
 * Bottom navigation for hosts (both Individual and Merchant)
 * 4 main sections: Dashboard, Events, Payouts, Profile
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from 'react-native-vector-icons/Ionicons';
import HostDashboardScreen from '../screens/host/HostDashboardScreen';
import HostEventsScreen from '../screens/host/HostEventsScreen';
import HostPayoutsScreen from '../screens/host/HostPayoutsScreen';
import HostProfileScreen from '../screens/host/HostProfileScreen';

export type HostTabParamList = {
  Dashboard: undefined;
  Events: undefined;
  Payouts: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<HostTabParamList>();

const HostTabNavigator = () => {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'grid' : 'grid-outline';
              break;
            case 'Events':
              iconName = focused ? 'calendar' : 'calendar-outline';
              break;
            case 'Payouts':
              iconName = focused ? 'wallet' : 'wallet-outline';
              break;
            case 'Profile':
              iconName = focused ? 'person' : 'person-outline';
              break;
            default:
              iconName = 'help-outline';
          }

          return (
            <View style={focused ? styles.activeIconContainer : undefined}>
              <Ionicons name={iconName} size={size} color={color} />
            </View>
          );
        },
        tabBarActiveTintColor: '#8B2BE2',
        tabBarInactiveTintColor: 'rgba(255, 255, 255, 0.55)',
        tabBarStyle: {
          backgroundColor: '#0D0B1E',
          borderTopWidth: 1,
          borderTopColor: 'rgba(255, 255, 255, 0.12)',
          height: 64 + insets.bottom,
          paddingBottom: Math.max(10, insets.bottom),
          paddingTop: 6,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: -6 },
          shadowOpacity: 0.22,
          shadowRadius: 16,
          elevation: 12,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Inter-SemiBold',
          marginBottom: 2,
        },
      })}
      initialRouteName="Dashboard"
    >
      <Tab.Screen 
        name="Dashboard" 
        component={HostDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
        }}
      />
      <Tab.Screen 
        name="Events" 
        component={HostEventsScreen}
        options={{
          tabBarLabel: 'Events',
        }}
      />
      <Tab.Screen 
        name="Payouts" 
        component={HostPayoutsScreen}
        options={{
          tabBarLabel: 'Payouts',
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={HostProfileScreen}
        options={{
          tabBarLabel: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  activeIconContainer: {
    shadowColor: '#8B2BE2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 8,
    elevation: 6,
  },
});

export default HostTabNavigator;
