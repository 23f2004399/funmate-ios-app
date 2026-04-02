/**
 * ALERT CONTEXT
 * 
 * Global context for showing custom styled alerts throughout the app
 * Provides showAlert function that replaces Alert.alert()
 * 
 * Usage:
 * 1. Wrap your app with <AlertProvider>
 * 2. In any component: const { showAlert } = useAlert()
 * 3. showAlert({ title: 'Title', message: 'Message', type: 'success' })
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CustomAlert, AlertConfig, AlertType, AlertButton } from '../components/modals/CustomAlert';

interface AlertContextType {
  showAlert: (config: AlertConfig) => void;
  showSuccess: (title: string, message: string, onOk?: () => void) => void;
  showError: (title: string, message: string, onOk?: () => void) => void;
  showWarning: (title: string, message: string, onOk?: () => void) => void;
  showInfo: (title: string, message: string, onOk?: () => void) => void;
  showConfirm: (
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      icon?: string;
    }
  ) => void;
  hideAlert: () => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({ children }) => {
  const [visible, setVisible] = useState(false);
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hideAlert = useCallback(() => {
    setVisible(false);
    setIsLoading(false);
    // Small delay before clearing config for smooth animation
    setTimeout(() => setConfig(null), 200);
  }, []);

  const showAlert = useCallback((alertConfig: AlertConfig) => {
    // Wrap button handlers to handle loading state for async operations
    const wrappedButtons = alertConfig.buttons?.map(button => ({
      ...button,
      onPress: async () => {
        if (button.onPress) {
          const result = button.onPress();
          if (result instanceof Promise) {
            setIsLoading(true);
            try {
              await result;
            } finally {
              setIsLoading(false);
            }
          }
        }
      },
    }));

    setConfig({
      ...alertConfig,
      buttons: wrappedButtons || [{ text: 'OK' }],
    });
    setVisible(true);
  }, []);

  const showSuccess = useCallback((title: string, message: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'success',
      buttons: [{ text: 'OK', onPress: onOk }],
    });
  }, [showAlert]);

  const showError = useCallback((title: string, message: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'error',
      buttons: [{ text: 'OK', onPress: onOk }],
    });
  }, [showAlert]);

  const showWarning = useCallback((title: string, message: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'warning',
      buttons: [{ text: 'OK', onPress: onOk }],
    });
  }, [showAlert]);

  const showInfo = useCallback((title: string, message: string, onOk?: () => void) => {
    showAlert({
      title,
      message,
      type: 'info',
      buttons: [{ text: 'OK', onPress: onOk }],
    });
  }, [showAlert]);

  const showConfirm = useCallback((
    title: string,
    message: string,
    onConfirm: () => void | Promise<void>,
    options?: {
      confirmText?: string;
      cancelText?: string;
      destructive?: boolean;
      icon?: string;
    }
  ) => {
    showAlert({
      title,
      message,
      type: 'confirm',
      icon: options?.icon,
      buttons: [
        { text: options?.cancelText || 'Cancel', style: 'cancel' },
        {
          text: options?.confirmText || 'Confirm',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: onConfirm,
        },
      ],
    });
  }, [showAlert]);

  return (
    <AlertContext.Provider
      value={{
        showAlert,
        showSuccess,
        showError,
        showWarning,
        showInfo,
        showConfirm,
        hideAlert,
      }}
    >
      {children}
      <CustomAlert
        visible={visible}
        config={config}
        onClose={hideAlert}
        isLoading={isLoading}
      />
    </AlertContext.Provider>
  );
};

export const useAlert = (): AlertContextType => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within an AlertProvider');
  }
  return context;
};

export default AlertProvider;
