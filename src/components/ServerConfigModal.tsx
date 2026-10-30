import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
} from 'react-native';

interface ServerConfigModalProps {
  visible: boolean;
  currentUrl: string;
  onSave: (newUrl: string) => void;
  onClose: () => void;
}

export const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  visible,
  currentUrl,
  onSave,
  onClose,
}) => {
  const [url, setUrl] = useState(currentUrl);

  const presets = [
    { label: 'Android Emulator', url: 'http://10.0.2.2:4010' },
    { label: 'Localhost (iOS/Web)', url: 'http://localhost:4010' },
    { label: '127.0.0.1', url: 'http://127.0.0.1:4010' },
  ];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.card}>
              <Text style={styles.title}>Mock Server Endpoint</Text>
              <Text style={styles.description}>
                Point the app to your running mock server instance:
              </Text>

              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="http://192.168.1.x:4010"
                placeholderTextColor="#777"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Text style={styles.presetHeading}>Quick Presets:</Text>
              <View style={styles.presetRow}>
                {presets.map((p) => (
                  <TouchableOpacity
                    key={p.label}
                    style={[styles.presetButton, url === p.url && styles.presetButtonActive]}
                    onPress={() => setUrl(p.url)}
                  >
                    <Text
                      style={[
                        styles.presetButtonText,
                        url === p.url && styles.presetButtonTextActive,
                      ]}
                    >
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.actions}>
                <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={() => {
                    onSave(url.trim());
                    onClose();
                  }}
                >
                  <Text style={styles.saveText}>Save & Reconnect</Text>
                </TouchableOpacity>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E1E24',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2F303B',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
    marginBottom: 6,
  },
  description: {
    fontSize: 13,
    color: '#9E9EA7',
    marginBottom: 16,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#131316',
    borderWidth: 1,
    borderColor: '#383842',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#FFF',
    fontSize: 15,
    marginBottom: 16,
  },
  presetHeading: {
    fontSize: 12,
    fontWeight: '600',
    color: '#71717A',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  presetButton: {
    backgroundColor: '#272730',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#383844',
  },
  presetButtonActive: {
    borderColor: '#E5A93B',
    backgroundColor: 'rgba(229, 169, 59, 0.15)',
  },
  presetButtonText: {
    color: '#D4D4D8',
    fontSize: 12,
  },
  presetButtonTextActive: {
    color: '#E5A93B',
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  cancelButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelText: {
    color: '#A1A1AA',
    fontSize: 14,
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#E5A93B',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  saveText: {
    color: '#121214',
    fontSize: 14,
    fontWeight: '700',
  },
});

