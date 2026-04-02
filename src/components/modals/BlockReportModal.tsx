/**
 * BLOCK & REPORT MODAL
 * 
 * Displays options to block or report a user from ChatScreen
 * Handles both actions with appropriate confirmations
 */

import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import { ReportReason } from '../../types/database';

type ConfirmationType = 'block' | 'unblock' | 'success' | 'error' | 'warning' | null;

interface ConfirmationState {
  type: ConfirmationType;
  title: string;
  message: string;
  onConfirm?: () => void;
}

interface BlockReportModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string; // The user to block/report
  userName: string; // For display
  isBlocked?: boolean; // Whether user is already blocked
  onBlock: () => Promise<void>;
  onUnblock?: () => Promise<void>; // Unblock handler
  onReport: (reason: ReportReason, description: string, screenshots: string[]) => Promise<void>;
}

export const BlockReportModal: React.FC<BlockReportModalProps> = ({
  visible,
  onClose,
  userId,
  userName,
  isBlocked = false,
  onBlock,
  onUnblock,
  onReport,
}) => {
  const [view, setView] = useState<'main' | 'report'>('main');
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationState>({ type: null, title: '', message: '' });

  // Reset form when modal closes
  useEffect(() => {
    if (!visible) {
      setView('main');
      setSelectedReason(null);
      setDescription('');
      setScreenshots([]);
      setIsSubmitting(false);
      setConfirmation({ type: null, title: '', message: '' });
    }
  }, [visible]);

  const reportReasons: { value: ReportReason; label: string }[] = [
    { value: 'harassment', label: 'Harassment or bullying' },
    { value: 'fake_profile', label: 'Fake profile or impersonation' },
    { value: 'inappropriate_content', label: 'Inappropriate content' },
    { value: 'scam', label: 'Scam or fraud' },
    { value: 'other', label: 'Other' },
  ];

  const showConfirmation = (type: ConfirmationType, title: string, message: string, onConfirm?: () => void) => {
    setConfirmation({ type, title, message, onConfirm });
  };

  const hideConfirmation = () => {
    setConfirmation({ type: null, title: '', message: '' });
  };

  const handleBlock = () => {
    showConfirmation(
      'block',
      'Block User',
      `Are you sure you want to block ${userName}? You won't see each other's profiles or be able to message.`,
      async () => {
        hideConfirmation();
        setIsSubmitting(true);
        try {
          await onBlock();
          showConfirmation('success', 'Blocked', `${userName} has been blocked.`);
        } catch (error) {
          console.error('Error blocking user:', error);
          showConfirmation('error', 'Error', 'Failed to block user. Please try again.');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  const handleUnblockUser = () => {
    showConfirmation(
      'unblock',
      'Unblock User',
      `Are you sure you want to unblock ${userName}?`,
      async () => {
        hideConfirmation();
        setIsSubmitting(true);
        try {
          await onUnblock?.();
          showConfirmation('success', 'Unblocked', `${userName} has been unblocked.`);
        } catch (error) {
          console.error('Error unblocking user:', error);
          showConfirmation('error', 'Error', 'Failed to unblock user. Please try again.');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  const handlePickScreenshot = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        selectionLimit: 3 - screenshots.length, // Max 3 total
      });

      if (result.assets && result.assets.length > 0) {
        const newScreenshots = result.assets
          .map(asset => asset.uri)
          .filter((uri): uri is string => uri !== undefined);
        setScreenshots(prev => [...prev, ...newScreenshots]);
      }
    } catch (error) {
      console.error('Error picking screenshot:', error);
      showConfirmation('error', 'Error', 'Failed to pick image. Please try again.');
    }
  };

  const handleRemoveScreenshot = (index: number) => {
    setScreenshots(prev => prev.filter((_, i) => i !== index));
  };

  const handleReportSubmit = async () => {
    if (!selectedReason) {
      showConfirmation('warning', 'Select Reason', 'Please select a reason for reporting.');
      return;
    }

    if (!description.trim()) {
      showConfirmation('warning', 'Add Description', 'Please describe what happened.');
      return;
    }

    setIsSubmitting(true);
    try {
      // Pass screenshots to report handler for upload
      await onReport(selectedReason, description.trim(), screenshots);
      
      // Reset form first
      setSelectedReason(null);
      setDescription('');
      setScreenshots([]);
      setView('main');
      
      showConfirmation(
        'success',
        'Report Submitted',
        'Thank you for your report. Our team will review it shortly.'
      );
    } catch (error) {
      console.error('Error submitting report:', error);
      showConfirmation('error', 'Error', 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderMainView = () => (
    <View style={styles.container}>
      <Text style={styles.title}>Report or Block {userName}</Text>
      
      <TouchableOpacity
        style={styles.option}
        onPress={() => setView('report')}
        disabled={isSubmitting}
      >
        <View style={styles.optionHeader}>
          <Ionicons name="flag-outline" size={20} color="#F4B400" style={styles.optionIcon} />
          <Text style={styles.optionText}>Report User</Text>
        </View>
        <Text style={styles.optionDescription}>
          Report inappropriate behavior
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.option, isBlocked ? styles.warningOption : styles.dangerOption]}
        onPress={isBlocked ? handleUnblockUser : handleBlock}
        disabled={isSubmitting}
      >
        <View style={styles.optionHeader}>
          <Ionicons 
            name={isBlocked ? "checkmark-circle-outline" : "ban-outline"} 
            size={20} 
            color={isBlocked ? "#2ECC71" : "#FF4D6D"} 
            style={styles.optionIcon} 
          />
          <Text style={[styles.optionText, !isBlocked && styles.dangerText]}>
            {isBlocked ? 'Unblock User' : 'Block User'}
          </Text>
        </View>
        <Text style={styles.optionDescription}>
          {isBlocked 
            ? 'Restore visibility and messaging'
            : "You won't see each other's profiles"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={onClose}
        disabled={isSubmitting}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>

      {isSubmitting && (
        <ActivityIndicator size="large" color="#378BBB" style={styles.loader} />
      )}
    </View>
  );

  const renderReportView = () => (
    <ScrollView 
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Report {userName}</Text>
      <Text style={styles.subtitle}>
        Help us understand what happened. Your report is confidential.
      </Text>

      <Text style={styles.label}>Reason *</Text>
      {reportReasons.map((reason) => (
        <TouchableOpacity
          key={reason.value}
          style={[
            styles.reasonOption,
            selectedReason === reason.value && styles.reasonOptionSelected,
          ]}
          onPress={() => setSelectedReason(reason.value)}
          disabled={isSubmitting}
        >
          <Text
            style={[
              styles.reasonText,
              selectedReason === reason.value && styles.reasonTextSelected,
            ]}
          >
            {reason.label}
          </Text>
        </TouchableOpacity>
      ))}

      <Text style={[styles.label, styles.descriptionLabel]}>
        What happened? *
      </Text>
      <TextInput
        style={styles.descriptionInput}
        placeholder="Please describe the issue..."
        placeholderTextColor="#7F93AA"
        multiline
        numberOfLines={4}
        value={description}
        onChangeText={setDescription}
        editable={!isSubmitting}
        textAlignVertical="top"
      />

      <Text style={[styles.label, styles.descriptionLabel]}>
        Screenshots (Optional)
      </Text>
      <Text style={styles.evidenceNote}>
        Upload up to 3 screenshots as evidence
      </Text>

      {screenshots.length > 0 && (
        <View style={styles.screenshotsContainer}>
          {screenshots.map((uri, index) => (
            <View key={index} style={styles.screenshotItem}>
              <Image source={{ uri }} style={styles.screenshotImage} />
              <TouchableOpacity
                style={styles.removeScreenshotButton}
                onPress={() => handleRemoveScreenshot(index)}
              >
                <Ionicons name="close-circle" size={24} color="#FF4D6D" />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {screenshots.length < 3 && (
        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handlePickScreenshot}
          disabled={isSubmitting}
        >
          <Ionicons name="camera-outline" size={20} color="#378BBB" />
          <Text style={styles.uploadButtonText}>
            {screenshots.length === 0 ? 'Add Screenshots' : `Add More (${3 - screenshots.length} left)`}
          </Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity
        style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
        onPress={handleReportSubmit}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Submit Report</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.backButton}
        onPress={() => setView('main')}
        disabled={isSubmitting}
      >
        <Text style={styles.cancelText}>← Back</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          {view === 'main' ? renderMainView() : renderReportView()}
        </View>
      </View>

      {/* Inline Confirmation Modal */}
      <Modal
        visible={confirmation.type !== null}
        transparent
        animationType="fade"
        onRequestClose={hideConfirmation}
      >
        <View style={styles.confirmationOverlay}>
          <View style={styles.confirmationContainer}>
            <View style={[
              styles.confirmationIconContainer,
              confirmation.type === 'success' && styles.successIconBg,
              confirmation.type === 'error' && styles.errorIconBg,
              confirmation.type === 'warning' && styles.warningIconBg,
              (confirmation.type === 'block' || confirmation.type === 'unblock') && styles.infoIconBg,
            ]}>
              <Ionicons 
                name={
                  confirmation.type === 'success' ? 'checkmark-circle' :
                  confirmation.type === 'error' ? 'close-circle' :
                  confirmation.type === 'warning' ? 'warning' :
                  confirmation.type === 'block' ? 'ban' :
                  confirmation.type === 'unblock' ? 'person-remove' :
                  'information-circle'
                }
                size={32}
                color={
                  confirmation.type === 'success' ? '#2ECC71' :
                  confirmation.type === 'error' ? '#FF4D6D' :
                  confirmation.type === 'warning' ? '#F4B400' :
                  '#378BBB'
                }
              />
            </View>
            <Text style={styles.confirmationTitle}>{confirmation.title}</Text>
            <Text style={styles.confirmationMessage}>{confirmation.message}</Text>
            
            <View style={styles.confirmationButtons}>
              {confirmation.onConfirm ? (
                <>
                  <TouchableOpacity
                    style={styles.confirmationCancelBtn}
                    onPress={hideConfirmation}
                  >
                    <Text style={styles.confirmationCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.confirmationActionBtn,
                      confirmation.type === 'block' && styles.destructiveBtn,
                    ]}
                    onPress={confirmation.onConfirm}
                  >
                    <Text style={styles.confirmationActionText}>
                      {confirmation.type === 'block' ? 'Block' : 
                       confirmation.type === 'unblock' ? 'Unblock' : 'Confirm'}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.confirmationOkBtn}
                  onPress={() => {
                    hideConfirmation();
                    if (confirmation.type === 'success') {
                      onClose();
                    }
                  }}
                >
                  <Text style={styles.confirmationActionText}>OK</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#16283D',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  container: {
    padding: 24,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#B8C7D9',
    marginBottom: 24,
    lineHeight: 20,
  },
  option: {
    backgroundColor: '#1B2F48',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionIcon: {
    marginRight: 8,
  },
  dangerOption: {
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
  },
  warningOption: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  optionText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dangerText: {
    color: '#FF4D6D',
  },
  optionDescription: {
    fontSize: 13,
    color: '#7F93AA',
    marginLeft: 28,
  },
  cancelButton: {
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  cancelText: {
    fontSize: 16,
    color: '#7F93AA',
    fontWeight: '500',
  },
  loader: {
    marginTop: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  descriptionLabel: {
    marginTop: 16,
  },
  reasonOption: {
    backgroundColor: '#1B2F48',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonOptionSelected: {
    backgroundColor: 'rgba(55, 139, 187, 0.2)',
    borderColor: '#378BBB',
  },
  reasonText: {
    fontSize: 15,
    color: '#B8C7D9',
  },
  reasonTextSelected: {
    color: '#378BBB',
    fontWeight: '600',
  },
  descriptionInput: {
    backgroundColor: '#1B2F48',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: '#FFFFFF',
    minHeight: 100,
  },
  evidenceNote: {
    fontSize: 12,
    color: '#7F93AA',
    marginBottom: 12,
  },
  screenshotsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  screenshotItem: {
    position: 'relative',
    width: 100,
    height: 100,
  },
  screenshotImage: {
    width: 100,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#1B2F48',
  },
  removeScreenshotButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#16283D',
    borderRadius: 12,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(55, 139, 187, 0.15)',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#378BBB',
    borderStyle: 'dashed',
    marginBottom: 20,
    gap: 8,
  },
  uploadButtonText: {
    color: '#378BBB',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: '#378BBB',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  backButton: {
    padding: 12,
    alignItems: 'center',
  },
  // Confirmation modal styles
  confirmationOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  confirmationContainer: {
    backgroundColor: '#16283D',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#378BBB',
  },
  confirmationIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIconBg: {
    backgroundColor: 'rgba(46, 204, 113, 0.15)',
  },
  errorIconBg: {
    backgroundColor: 'rgba(255, 77, 109, 0.15)',
  },
  warningIconBg: {
    backgroundColor: 'rgba(244, 180, 0, 0.15)',
  },
  infoIconBg: {
    backgroundColor: 'rgba(55, 139, 187, 0.15)',
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationMessage: {
    fontSize: 15,
    color: '#B8C7D9',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  confirmationButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  confirmationCancelBtn: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#378BBB',
    alignItems: 'center',
  },
  confirmationCancelText: {
    color: '#378BBB',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationActionBtn: {
    flex: 1,
    backgroundColor: '#378BBB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  confirmationActionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  confirmationOkBtn: {
    paddingHorizontal: 48,
    backgroundColor: '#378BBB',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  destructiveBtn: {
    backgroundColor: '#FF4D6D',
  },
});
