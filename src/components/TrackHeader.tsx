import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SyncProgress } from '../syncEngine';

interface TrackHeaderProps {
  progress: SyncProgress;
  isOnline: boolean;
  totalTransactions: number;
  onOpenConfig: () => void;
  onRefresh: () => void;
}

export const TrackHeader: React.FC<TrackHeaderProps> = ({
  progress,
  isOnline,
  totalTransactions,
  onOpenConfig,
  onRefresh,
}) => {
  const getStatusBadge = () => {
    if (!isOnline) {
      return (
        <View style={[styles.badge, styles.badgeOffline]}>
          <View style={[styles.dot, styles.dotOffline]} />
          <Text style={styles.badgeText}>Offline</Text>
        </View>
      );
    }

    if (progress.status === 'syncing') {
      return (
        <View style={[styles.badge, styles.badgeSyncing]}>
          <ActivityIndicator size={10} color="#E5A93B" style={{ marginRight: 4 }} />
          <Text style={styles.badgeText}>
            {progress.phase === 'full_sync'
              ? `Syncing ${progress.loadedCount}`
              : 'Updating...'}
          </Text>
        </View>
      );
    }

    if (progress.status === 'error') {
      return (
        <TouchableOpacity style={[styles.badge, styles.badgeError]} onPress={onRefresh}>
          <Text style={styles.badgeText}>Sync Interrupted · Tap to retry</Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={[styles.badge, styles.badgeLive]}>
        <View style={[styles.dot, styles.dotLive]} />
        <Text style={styles.badgeText}>{totalTransactions} txns</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.brandRow}>
        <View>
          <View style={styles.logoRow}>
            <Text style={styles.brandName}>SIMPLIFY</Text>
            <Text style={styles.brandAccent}>MONEY</Text>
          </View>
          <Text style={styles.screenTitle}>Track</Text>
        </View>

        <View style={styles.actionsRow}>
          {getStatusBadge()}
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={onOpenConfig}
            accessibilityLabel="Mock server settings"
            accessibilityRole="button"
          >
            <Text style={styles.settingsIcon}>⚙</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121214',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222228',
  },
  brandRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  brandName: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#E4E4E7',
  },
  brandAccent: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#E5A93B',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 2,
    letterSpacing: -0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  badgeLive: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  badgeSyncing: {
    backgroundColor: 'rgba(229, 169, 59, 0.12)',
    borderColor: 'rgba(229, 169, 59, 0.4)',
  },
  badgeOffline: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  badgeError: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderColor: '#EF4444',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D4D4D8',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  dotLive: {
    backgroundColor: '#22C55E',
  },
  dotOffline: {
    backgroundColor: '#EF4444',
  },
  settingsButton: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#1E1E24',
    borderWidth: 1,
    borderColor: '#2F303B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  settingsIcon: {
    color: '#A1A1AA',
    fontSize: 16,
  },
});
