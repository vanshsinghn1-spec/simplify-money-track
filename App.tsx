import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View, Platform, ScrollView } from 'react-native';
import { ModernTrackScreen } from './src/screens/ModernTrackScreen';

export default function App() {
  if (Platform.OS === 'web') {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          backgroundColor: '#090e15',
          overflowY: 'auto',
          overflowX: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <StatusBar style="light" />
        <ModernTrackScreen />
      </div>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <StatusBar style="light" />
      <ModernTrackScreen />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090e15',
  },
  content: {
    flexGrow: 1,
  },
});

