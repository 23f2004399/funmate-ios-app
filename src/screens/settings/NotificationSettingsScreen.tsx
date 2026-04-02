/**
 * Notification Settings Screen
 *
 * Allows users to toggle different notification types:
 * - Likes
 * - Matches
 * - Messages
 * - Events
 */

import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import notificationService from '../../services/NotificationService';
import { useAlert } from '../../contexts/AlertContext';

interface NotificationSettings {
  likes: boolean;
  matches: boolean;
  messages: boolean;
  events: boolean;
}

interface NotificationSettingsScreenProps {
  navigation: any;
}

const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
  navigation,
}) => {
  const { showError } = useAlert();
  const [settings, setSettings] = useState<NotificationSettings>({
    likes: true,
    matches: true,
    messages: true,
    events: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const savedSettings = await notificationService.getSettings();
      setSettings(savedSettings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
      showError('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (
    key: keyof NotificationSettings,
    value: boolean,
  ) => {
    const newSettings = {...settings, [key]: value};
    setSettings(newSettings);

    try {
      setSaving(true);
      await notificationService.updateSettings({[key]: value});
    } catch (error) {
      // Revert on error
      setSettings(settings);
      showError('Error', 'Failed to update setting. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const SettingRow: React.FC<{
    title: string;
    description: string;
    value: boolean;
    settingKey: keyof NotificationSettings;
    iconName: string;
    iconColor: string;
  }> = ({title, description, value, settingKey, iconName, iconColor}) => (
    <View style={styles.settingRow}>
      <View style={styles.settingIcon}>
        <Ionicons name={iconName as any} size={24} color={iconColor} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={styles.settingTitle}>{title}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(newValue) => handleToggle(settingKey, newValue)}
        trackColor={{false: '#1B2F48', true: '#378BBB'}}
        thumbColor={value ? '#FFFFFF' : '#f4f3f4'}
        ios_backgroundColor="#1B2F48"
        disabled={saving}
      />
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#378BBB" />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={28} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerRight} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Section Header */}
        <Text style={styles.sectionHeader}>Manage Preferences</Text>
        <Text style={styles.sectionSubheader}>
          Choose which notifications you want to receive
        </Text>

        {/* Settings */}
        <View style={styles.settingsCard}>
          <SettingRow
            title="Likes"
            description="When someone likes your profile"
            value={settings.likes}
            settingKey="likes"
            iconName="heart"
            iconColor="#FF4D6D"
          />

          <View style={styles.divider} />

          <SettingRow
            title="Matches"
            description="When you match with someone"
            value={settings.matches}
            settingKey="matches"
            iconName="heart-circle"
            iconColor="#FF4D6D"
          />

          <View style={styles.divider} />

          <SettingRow
            title="Messages"
            description="When you receive a new message"
            value={settings.messages}
            settingKey="messages"
            iconName="chatbubbles"
            iconColor="#378BBB"
          />

          <View style={styles.divider} />

          <SettingRow
            title="Events"
            description="Event reminders and updates"
            value={settings.events}
            settingKey="events"
            iconName="calendar"
            iconColor="#378BBB"
          />
        </View>

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Ionicons name="information-circle" size={20} color="#378BBB" style={styles.infoIconStyle} />
          <Text style={styles.infoText}>
            You can also manage notification settings in your device's system
            settings. Some notifications like security alerts cannot be
            disabled.
          </Text>
        </View>

        {/* Saving Indicator */}
        {saving && (
          <View style={styles.savingIndicator}>
            <ActivityIndicator size="small" color="#FF4458" />
            <Text style={styles.savingText}>Saving...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0F15',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#FFFFFF',
    marginTop: 12,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 50,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#378BBB',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRight: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionHeader: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionSubheader: {
    color: '#B8C7D9',
    fontSize: 14,
    marginBottom: 20,
  },
  settingsCard: {
    backgroundColor: '#0F1A26',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#378BBB',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  settingIcon: {
    width: 44,
    height: 44,
    backgroundColor: '#131F2E',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  settingDescription: {
    color: '#B8C7D9',
    fontSize: 13,
  },
  divider: {
    height: 1,
    backgroundColor: '#233B57',
    marginLeft: 72,
  },
  infoSection: {
    flexDirection: 'row',
    backgroundColor: '#0F1A26',
    borderRadius: 12,
    padding: 16,
    alignItems: 'flex-start',
    borderWidth: 2,
    borderColor: '#378BBB',
  },
  infoIconStyle: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    color: '#B8C7D9',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  savingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  savingText: {
    color: '#7F93AA',
    fontSize: 14,
    marginLeft: 8,
  },
});

export default NotificationSettingsScreen;
