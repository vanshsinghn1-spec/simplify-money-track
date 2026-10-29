import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  RefreshControl,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { NormalizedTransaction, Account, MonthSummary } from '../types';
import { TransactionStore } from '../storage';
import { SyncEngine, SyncProgress } from '../syncEngine';
import { groupTransactionsByMonth } from '../aggregations';
import { TrackHeader } from '../components/TrackHeader';
import { SearchBar } from '../components/SearchBar';
import { MonthSummaryCard } from '../components/MonthSummaryCard';
import { TransactionRow } from '../components/TransactionRow';
import { TransactionDetailModal } from '../components/TransactionDetailModal';
import { ServerConfigModal } from '../components/ServerConfigModal';

interface SectionData {
  month: string;
  summary: MonthSummary;
  data: NormalizedTransaction[];
}

export const TrackScreen: React.FC = () => {
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<NormalizedTransaction | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    phase: 'idle',
    loadedCount: 0,
  });

  // Default server endpoint according to runtime platform
  const defaultUrl = Platform.OS === 'android' ? 'http://10.0.2.2:4010' : 'http://localhost:4010';
  const [serverUrl, setServerUrl] = useState(defaultUrl);

  const syncEngine = useMemo(() => {
    return new SyncEngine({
      baseUrl: serverUrl,
      onProgress: (prog) => {
        setSyncProgress(prog);
        if (prog.status === 'success') {
          setIsOnline(true);
          // Reload from local storage
          TransactionStore.getTransactions().then((all) => setTransactions(all));
        }
      },
    });
  }, [serverUrl]);

  // Load cached transactions on startup
  const loadLocalCache = useCallback(async () => {
    try {
      const [cachedTxns, cachedAccounts] = await Promise.all([
        TransactionStore.getTransactions(),
        TransactionStore.getAccounts(),
      ]);
      if (cachedTxns.length > 0) {
        setTransactions(cachedTxns);
      }
      if (cachedAccounts.length > 0) {
        setAccounts(cachedAccounts);
      }
    } catch (err) {
      console.warn('[TrackScreen] Failed to read local cache:', err);
    } finally {
      setIsInitialLoading(false);
    }
  }, []);

  // Run initial sync
  const runSync = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await syncEngine.sync();
      const updatedTxns = await TransactionStore.getTransactions();
      const updatedAccounts = await TransactionStore.getAccounts();
      setTransactions(updatedTxns);
      setAccounts(updatedAccounts);
      setIsOnline(true);
    } catch (err: any) {
      console.warn('[TrackScreen] Sync error:', err);
      setIsOnline(false);
      setSyncProgress((prev) => ({
        ...prev,
        status: 'error',
        error: err.message || 'Network error',
      }));
    } finally {
      setIsRefreshing(false);
    }
  }, [syncEngine]);

  useEffect(() => {
    loadLocalCache().then(() => {
      runSync();
    });
  }, [loadLocalCache, runSync]);

  const handleSaveServerUrl = useCallback((newUrl: string) => {
    setServerUrl(newUrl);
    syncEngine.setBaseUrl(newUrl);
    runSync();
  }, [syncEngine, runSync]);

  // Account ID to Account object mapping for O(1) lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const acc of accounts) {
      map.set(acc.id, acc);
    }
    return map;
  }, [accounts]);

  // Filter transactions by Search Query & Selected Account
  const filteredTransactions = useMemo(() => {
    let result = transactions;

    if (selectedAccountId) {
      result = result.filter((t) => t.accountId === selectedAccountId);
    }

    if (searchQuery.trim().length > 0) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    return result;
  }, [transactions, selectedAccountId, searchQuery]);

  // Group filtered transactions into months
  const sections: SectionData[] = useMemo(() => {
    const groups = groupTransactionsByMonth(filteredTransactions);
    return groups.map((g) => ({
      month: g.month,
      summary: g.summary,
      data: g.transactions,
    }));
  }, [filteredTransactions]);

  const renderSectionHeader = useCallback(
    ({ section }: { section: SectionData }) => (
      <MonthSummaryCard summary={section.summary} />
    ),
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: NormalizedTransaction }) => (
      <TransactionRow
        transaction={item}
        account={accountMap.get(item.accountId)}
        onPress={setSelectedTxn}
      />
    ),
    [accountMap]
  );

  const keyExtractor = useCallback((item: NormalizedTransaction) => item.id, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        {/* Sticky Header with branding, status & settings */}
        <TrackHeader
          progress={syncProgress}
          isOnline={isOnline}
          totalTransactions={transactions.length}
          onOpenConfig={() => setIsConfigOpen(true)}
          onRefresh={runSync}
        />

        {/* Search & Account Filter Pills */}
        <SearchBar
          query={searchQuery}
          onChangeQuery={setSearchQuery}
          selectedAccountId={selectedAccountId}
          onSelectAccount={setSelectedAccountId}
          accounts={accounts}
          matchCount={searchQuery.trim().length > 0 ? filteredTransactions.length : undefined}
        />

        {/* Main Content Area */}
        {isInitialLoading && transactions.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#E5A93B" />
            <Text style={styles.loadingText}>Initializing Track...</Text>
          </View>
        ) : filteredTransactions.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyTitle}>No transactions found</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery.trim().length > 0
                ? `No transactions match "${searchQuery}"`
                : 'Pull down to refresh and sync with server'}
            </Text>
          </View>
        ) : (
          <SectionList
            sections={sections}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            renderSectionHeader={renderSectionHeader}
            stickySectionHeadersEnabled={false}
            initialNumToRender={20}
            maxToRenderPerBatch={30}
            windowSize={11}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={runSync}
                tintColor="#E5A93B"
                colors={['#E5A93B']}
              />
            }
            contentContainerStyle={styles.listContent}
          />
        )}

        {/* Transaction Detail Modal */}
        <TransactionDetailModal
          transaction={selectedTxn}
          accounts={accounts}
          onClose={() => setSelectedTxn(null)}
        />

        {/* Server Endpoint Configuration Modal */}
        <ServerConfigModal
          visible={isConfigOpen}
          currentUrl={serverUrl}
          onSave={handleSaveServerUrl}
          onClose={() => setIsConfigOpen(false)}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#121214',
  },
  container: {
    flex: 1,
    backgroundColor: '#0E0E11',
  },
  listContent: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F4F4F5',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#71717A',
    textAlign: 'center',
    lineHeight: 18,
  },
});
