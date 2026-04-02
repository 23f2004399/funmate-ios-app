/**
 * CUSTOM ALERT MODAL
 * 
 * A beautifully styled alert modal matching the app's dark theme
 * Replaces the boring default Alert.alert()
 * 
 * Usage:
 * - Import { useAlert } from '../../contexts/AlertContext'
 * - const { showAlert } = useAlert()
 * - showAlert({ title: 'Title', message: 'Message', type: 'success' })
 */

import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

export type AlertType = 'success' | 'error' | 'warning' | 'info' | 'confirm';

export interface AlertButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertConfig {
  title: string;
  message: string;
  type?: AlertType;
  buttons?: AlertButton[];
  icon?: string; // Ionicons name
}

interface CustomAlertProps {
  visible: boolean;
  config: AlertConfig | null;
  onClose: () => void;
  isLoading?: boolean;
}

const getIconConfig = (type: AlertType): { name: string; color: string; bgColor: string } => {
  switch (type) {
    case 'success':
      return { name: 'checkmark-circle', color: '#2ECC71', bgColor: 'rgba(46, 204, 113, 0.15)' };
    case 'error':
      return { name: 'close-circle', color: '#FF4D6D', bgColor: 'rgba(255, 77, 109, 0.15)' };
    case 'warning':
      return { name: 'warning', color: '#F4B400', bgColor: 'rgba(244, 180, 0, 0.15)' };
    case 'info':
      return { name: 'information-circle', color: '#378BBB', bgColor: 'rgba(55, 139, 187, 0.15)' };
    case 'confirm':
      return { name: 'help-circle', color: '#378BBB', bgColor: 'rgba(55, 139, 187, 0.15)' };
    default:
      return { name: 'information-circle', color: '#378BBB', bgColor: 'rgba(55, 139, 187, 0.15)' };
  }
};

export const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  config,
  onClose,
  isLoading = false,
}) => {
  if (!config) return null;

  const { title, message, type = 'info', buttons = [{ text: 'OK' }], icon } = config;
  const iconConfig = getIconConfig(type);
  const iconName = icon || iconConfig.name;

  const handleButtonPress = async (button: AlertButton) => {
    if (button.onPress) {
      await button.onPress();
    }
    onClose();
  };

  // Determine button styles based on type and button style
  const getButtonStyle = (button: AlertButton, index: number, totalButtons: number) => {
    if (button.style === 'cancel') {
      return styles.cancelButton;
    }
    if (button.style === 'destructive') {
      return styles.destructiveButton;
    }
    // If only one button, make it primary
    if (totalButtons === 1) {
      return styles.primaryButton;
    }
    // Last button is usually the action button
    if (index === totalButtons - 1) {
      return styles.primaryButton;
    }
    return styles.cancelButton;
  };

  const getButtonTextStyle = (button: AlertButton, index: number, totalButtons: number) => {
    if (button.style === 'cancel') {
      return styles.cancelButtonText;
    }
    if (button.style === 'destructive') {
      return styles.destructiveButtonText;
    }
    if (totalButtons === 1 || index === totalButtons - 1) {
      return styles.primaryButtonText;
    }
    return styles.cancelButtonText;
  };

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.bgColor }]}>
            <Ionicons name={iconName} size={32} color={iconConfig.color} />
          </View>

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Message */}
          <Text style={styles.message}>{message}</Text>

          {/* Buttons */}
          <View style={[
            styles.buttonsContainer,
            buttons.length === 1 && styles.singleButtonContainer,
          ]}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(button, index, buttons.length),
                  buttons.length === 1 && styles.singleButton,
                ]}
                onPress={() => handleButtonPress(button)}
                disabled={isLoading}
              >
                {isLoading && index === buttons.length - 1 ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={getButtonTextStyle(button, index, buttons.length)}>
                    {button.text}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#16283D',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#378BBB',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#B8C7D9',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonsContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  singleButtonContainer: {
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  singleButton: {
    flex: 0,
    paddingHorizontal: 48,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#378BBB',
  },
  cancelButtonText: {
    color: '#378BBB',
    fontSize: 16,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#378BBB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  destructiveButton: {
    backgroundColor: '#FF4D6D',
  },
  destructiveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CustomAlert;
