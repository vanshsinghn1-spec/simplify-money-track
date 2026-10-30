import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { ModernTrackScreen } from './src/screens/ModernTrackScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <ModernTrackScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090a0f',
  },
});
