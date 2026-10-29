import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import { TrackScreen } from './src/screens/TrackScreen';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <TrackScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121214',
  },
});
