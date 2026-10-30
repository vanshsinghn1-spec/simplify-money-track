import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { V0TrackScreen } from './src/screens/V0TrackScreen';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <V0TrackScreen />
    </SafeAreaProvider>
  );
}
