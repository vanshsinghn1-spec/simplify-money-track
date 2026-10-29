import AsyncStorage from '@react-native-async-storage/async-storage';
import { NormalizedTransaction, Account, SyncState } from './types';

const STORAGE_KEYS = {
  TRANSACTIONS: '@sm_track:transactions_map_v1',
  SYNC_STATE: '@sm_track:sync_state_v1',
  ACCOUNTS: '@sm_track:accounts_v1',
};

// Fallback in-memory storage for headless node/jest environments
class MemoryStorage {
  private store: Map<string, string> = new Map();

  async getItem(key: string): Promise<string | null> {
    return this.store.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
  }
}

const memoryFallback = new MemoryStorage();

function isRunningInNode(): boolean {
  return (
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined)
  );
}

async function getStorage() {
  if (isRunningInNode()) {
    return memoryFallback;
  }
  if (AsyncStorage && typeof AsyncStorage.getItem === 'function') {
    return AsyncStorage;
  }
  return memoryFallback;
}

export class TransactionStore {
  /**
   * Retrieves all cached transactions from local storage.
   */
  static async getTransactions(): Promise<NormalizedTransaction[]> {
    try {
      const storage = await getStorage();
      const raw = await storage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!raw) return [];
      const map: Record<string, NormalizedTransaction> = JSON.parse(raw);
      return Object.values(map);
    } catch (err) {
      console.warn('[TransactionStore] Failed to read transactions:', err);
      return [];
    }
  }

  /**
   * Retrieves transactions as an ID-indexed map for O(1) deduplication and merges.
   */
  static async getTransactionMap(): Promise<Record<string, NormalizedTransaction>> {
    try {
      const storage = await getStorage();
      const raw = await storage.getItem(STORAGE_KEYS.TRANSACTIONS);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch (err) {
      console.warn('[TransactionStore] Failed to read transaction map:', err);
      return {};
    }
  }

  /**
   * Atomically persists the complete transactions map.
   */
  static async saveTransactionMap(
    map: Record<string, NormalizedTransaction>
  ): Promise<void> {
    try {
      const storage = await getStorage();
      await storage.setItem(STORAGE_KEYS.TRANSACTIONS, JSON.stringify(map));
    } catch (err) {
      console.error('[TransactionStore] Failed to save transaction map:', err);
      throw err;
    }
  }

  /**
   * Sync State management (sync_token, timestamps)
   */
  static async getSyncState(): Promise<SyncState> {
    try {
      const storage = await getStorage();
      const raw = await storage.getItem(STORAGE_KEYS.SYNC_STATE);
      if (!raw) {
        return { syncToken: null, lastSyncTime: 0, isInitialSyncComplete: false };
      }
      return JSON.parse(raw);
    } catch {
      return { syncToken: null, lastSyncTime: 0, isInitialSyncComplete: false };
    }
  }

  static async saveSyncState(state: SyncState): Promise<void> {
    try {
      const storage = await getStorage();
      await storage.setItem(STORAGE_KEYS.SYNC_STATE, JSON.stringify(state));
    } catch (err) {
      console.error('[TransactionStore] Failed to save sync state:', err);
    }
  }

  /**
   * Cached accounts management
   */
  static async getAccounts(): Promise<Account[]> {
    try {
      const storage = await getStorage();
      const raw = await storage.getItem(STORAGE_KEYS.ACCOUNTS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  static async saveAccounts(accounts: Account[]): Promise<void> {
    try {
      const storage = await getStorage();
      await storage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts));
    } catch (err) {
      console.error('[TransactionStore] Failed to save accounts:', err);
    }
  }

  /**
   * Reset store (used for test teardowns or full re-sync)
   */
  static async clearAll(): Promise<void> {
    try {
      const storage = await getStorage();
      await storage.removeItem(STORAGE_KEYS.TRANSACTIONS);
      await storage.removeItem(STORAGE_KEYS.SYNC_STATE);
      await storage.removeItem(STORAGE_KEYS.ACCOUNTS);
    } catch (err) {
      console.error('[TransactionStore] Failed to clear storage:', err);
    }
  }
}
