import AsyncStorage from '@react-native-async-storage/async-storage';
import { NormalizedTransaction, Account, SyncState } from './types';

const STORAGE_KEYS = {
  TRANSACTIONS_LEGACY: '@sm_track:transactions_map_v1',
  TRANSACTION_CHUNKS_MANIFEST: '@sm_track:chunks_manifest_v2',
  CHUNK_PREFIX: '@sm_track:chunk_v2_',
  SYNC_STATE: '@sm_track:sync_state_v1',
  ACCOUNTS: '@sm_track:accounts_v1',
};

const CHUNK_SIZE = 350; // Keep each SQLite row ~200KB, well below Android's 2MB CursorWindow limit

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
    const map = await TransactionStore.getTransactionMap();
    return Object.values(map);
  }

  /**
   * Retrieves transactions as an ID-indexed map for O(1) deduplication and merges.
   * Reads chunked keys to avoid Android SQLite 2MB CursorWindow limit.
   */
  static async getTransactionMap(): Promise<Record<string, NormalizedTransaction>> {
    try {
      const storage = await getStorage();

      // Check chunked manifest first (v2)
      const manifestRaw = await storage.getItem(STORAGE_KEYS.TRANSACTION_CHUNKS_MANIFEST);
      if (manifestRaw) {
        const chunkKeys: string[] = JSON.parse(manifestRaw);
        if (chunkKeys.length > 0) {
          const chunkJsonStrings = await Promise.all(chunkKeys.map((k) => storage.getItem(k)));
          const combined: Record<string, NormalizedTransaction> = {};
          for (const raw of chunkJsonStrings) {
            if (raw) {
              const chunkObj: Record<string, NormalizedTransaction> = JSON.parse(raw);
              Object.assign(combined, chunkObj);
            }
          }
          return combined;
        }
      }

      // Fallback: check legacy single-key storage (v1)
      const legacyRaw = await storage.getItem(STORAGE_KEYS.TRANSACTIONS_LEGACY);
      if (legacyRaw) {
        const map: Record<string, NormalizedTransaction> = JSON.parse(legacyRaw);
        // Automatically migrate legacy data to chunks
        TransactionStore.saveTransactionMap(map).catch((e) =>
          console.warn('[TransactionStore] Migration warning:', e)
        );
        return map;
      }

      return {};
    } catch (err) {
      console.warn('[TransactionStore] Failed to read transaction map:', err);
      return {};
    }
  }

  /**
   * Atomically persists the complete transactions map in chunked records
   * to guarantee Android SQLite 2MB CursorWindow safety.
   */
  static async saveTransactionMap(
    map: Record<string, NormalizedTransaction>
  ): Promise<void> {
    try {
      const storage = await getStorage();
      const entries = Object.entries(map);

      // Read current manifest to clean up any orphaned chunks
      const oldManifestRaw = await storage.getItem(STORAGE_KEYS.TRANSACTION_CHUNKS_MANIFEST);
      const oldKeys: string[] = oldManifestRaw ? JSON.parse(oldManifestRaw) : [];

      const newChunkKeys: string[] = [];
      const saveOperations: Promise<void>[] = [];

      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        const chunkIndex = Math.floor(i / CHUNK_SIZE);
        const chunkKey = `${STORAGE_KEYS.CHUNK_PREFIX}${chunkIndex}`;
        newChunkKeys.push(chunkKey);

        const chunkObj: Record<string, NormalizedTransaction> = {};
        const slice = entries.slice(i, i + CHUNK_SIZE);
        for (const [id, tx] of slice) {
          chunkObj[id] = tx;
        }

        saveOperations.push(storage.setItem(chunkKey, JSON.stringify(chunkObj)));
      }

      // Persist all chunks
      await Promise.all(saveOperations);

      // Update manifest
      await storage.setItem(
        STORAGE_KEYS.TRANSACTION_CHUNKS_MANIFEST,
        JSON.stringify(newChunkKeys)
      );

      // Clean up orphaned chunks from previous saves with more chunks
      const orphanedKeys = oldKeys.filter((k) => !newChunkKeys.includes(k));
      if (orphanedKeys.length > 0) {
        await Promise.all(orphanedKeys.map((k) => storage.removeItem(k)));
      }

      // Remove legacy monolithic key if it exists
      await storage.removeItem(STORAGE_KEYS.TRANSACTIONS_LEGACY);
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
      const manifestRaw = await storage.getItem(STORAGE_KEYS.TRANSACTION_CHUNKS_MANIFEST);
      if (manifestRaw) {
        const chunkKeys: string[] = JSON.parse(manifestRaw);
        await Promise.all(chunkKeys.map((k) => storage.removeItem(k)));
      }
      await storage.removeItem(STORAGE_KEYS.TRANSACTION_CHUNKS_MANIFEST);
      await storage.removeItem(STORAGE_KEYS.TRANSACTIONS_LEGACY);
      await storage.removeItem(STORAGE_KEYS.SYNC_STATE);
      await storage.removeItem(STORAGE_KEYS.ACCOUNTS);
    } catch (err) {
      console.error('[TransactionStore] Failed to clear storage:', err);
    }
  }
}
