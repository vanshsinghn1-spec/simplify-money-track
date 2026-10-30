import { normalizeTransaction } from './normalize';
import { TransactionStore } from './storage';
import { NormalizedTransaction, Account, SyncState } from './types';

export interface SyncProgress {
  status: 'idle' | 'syncing' | 'error' | 'success';
  phase: 'accounts' | 'full_sync' | 'incremental_sync' | 'idle';
  loadedCount: number;
  totalEstimate?: number;
  message?: string;
  error?: string;
}

export interface SyncEngineOptions {
  baseUrl?: string;
  pageSize?: number;
  maxRetries?: number;
  onProgress?: (progress: SyncProgress) => void;
}

export function getDefaultApiBaseUrl(): string {
  // Jest test or Node headless environment
  if (
    typeof process !== 'undefined' &&
    process.env &&
    (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined)
  ) {
    return 'http://localhost:4010';
  }

  // Web browser environment
  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const host = window.location.hostname || 'localhost';
    if (host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:4010`;
    }
  }

  // Native mobile environment: detect dev server host from Metro scriptURL
  try {
    const { NativeModules } = require('react-native');
    const scriptURL: string = NativeModules?.SourceCode?.scriptURL || '';
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1] && match[1] !== 'localhost' && match[1] !== '127.0.0.1' && match[1] !== '10.0.2.2') {
      return `http://${match[1]}:4010`;
    }
  } catch {}

  // Default LAN IP for physical mobile phone on same hotspot / Wi-Fi network
  return 'http://172.21.199.108:4010';
}

export class SyncEngine {
  private baseUrl: string;
  private pageSize: number;
  private maxRetries: number;
  private onProgress?: (progress: SyncProgress) => void;
  private isSyncing = false;

  constructor(options: SyncEngineOptions = {}) {
    this.baseUrl = (options.baseUrl || getDefaultApiBaseUrl()).replace(/\/+$/, '');
    this.pageSize = options.pageSize || 100; // Efficient maximum allowed by server
    this.maxRetries = options.maxRetries || 4;
    this.onProgress = options.onProgress;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '');
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  private notify(progress: SyncProgress) {
    if (this.onProgress) {
      this.onProgress(progress);
    }
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Resilient HTTP GET fetcher with automatic retry for 429, 500, 503,
   * exponential backoff, and Retry-After header parsing.
   */
  private async fetchWithRetry(url: string, retryCount = 0): Promise<any> {
    try {
      const res = await fetch(url);

      if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get('Retry-After') || '3', 10);
        console.warn(`[SyncEngine] Rate limited (429). Retrying after ${retryAfterSec}s...`);
        this.notify({
          status: 'syncing',
          phase: 'full_sync',
          loadedCount: 0,
          message: `Rate limited. Pausing for ${retryAfterSec}s...`,
        });
        await this.sleep((retryAfterSec + 0.5) * 1000);
        return this.fetchWithRetry(url, retryCount + 1);
      }

      if (res.status === 503 || res.status === 500) {
        if (retryCount < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 6000);
          console.warn(`[SyncEngine] Server error (${res.status}). Retrying in ${delay}ms...`);
          await this.sleep(delay);
          return this.fetchWithRetry(url, retryCount + 1);
        }
        throw new Error(`Server returned error ${res.status} after ${retryCount} retries.`);
      }

      if (res.status === 410) {
        // Sync token expired
        return { status: 410, error: 'sync_token_expired' };
      }

      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      if (retryCount < this.maxRetries) {
        const delay = Math.min(1000 * Math.pow(2, retryCount), 5000);
        console.warn(`[SyncEngine] Network request failed (${err.message}). Retrying in ${delay}ms...`);
        await this.sleep(delay);
        return this.fetchWithRetry(url, retryCount + 1);
      }
      throw err;
    }
  }

  /**
   * Sync accounts metadata
   */
  public async syncAccounts(): Promise<Account[]> {
    try {
      const data = await this.fetchWithRetry(`${this.baseUrl}/v1/accounts`);
      if (data && Array.isArray(data.items)) {
        await TransactionStore.saveAccounts(data.items);
        return data.items;
      }
      return [];
    } catch (err) {
      console.warn('[SyncEngine] Failed to sync accounts, using cached accounts:', err);
      return TransactionStore.getAccounts();
    }
  }

  /**
   * Executes full or incremental sync based on current local sync token.
   * Concurrency-guarded to prevent racing syncs (Task 4).
   */
  public async sync(): Promise<{ count: number; syncToken: string | null }> {
    if (this.isSyncing) {
      console.warn('[SyncEngine] Sync already in progress. Ignoring concurrent trigger.');
      const current = await TransactionStore.getTransactions();
      const state = await TransactionStore.getSyncState();
      return { count: current.length, syncToken: state.syncToken };
    }

    this.isSyncing = true;
    try {
      await this.syncAccounts();
      const syncState = await TransactionStore.getSyncState();

      if (!syncState.syncToken) {
        return await this.performFullSync();
      } else {
        return await this.performIncrementalSync(syncState.syncToken);
      }
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Performs complete paginated initial sync via /v1/transactions
   */
  public async performFullSync(): Promise<{ count: number; syncToken: string | null }> {
    this.notify({ status: 'syncing', phase: 'full_sync', loadedCount: 0 });
    const txnMap = await TransactionStore.getTransactionMap();

    let cursor: string | null = null;
    let nextSyncToken: string | null = null;
    let hasMore = true;
    let totalLoaded = Object.keys(txnMap).length;

    while (hasMore) {
      const q = new URLSearchParams({ limit: String(this.pageSize) });
      if (cursor) q.set('cursor', cursor);

      const url = `${this.baseUrl}/v1/transactions?${q.toString()}`;
      const data = await this.fetchWithRetry(url);

      if (!data || !Array.isArray(data.items)) {
        throw new Error('Invalid response structure received from /v1/transactions');
      }

      if (data.sync_token) {
        nextSyncToken = data.sync_token;
      }

      // Deduplicate each item into the map
      for (const item of data.items) {
        const normalized = normalizeTransaction(item);
        txnMap[normalized.id] = normalized;
      }

      totalLoaded = Object.keys(txnMap).length;
      this.notify({
        status: 'syncing',
        phase: 'full_sync',
        loadedCount: totalLoaded,
        message: `Fetched ${totalLoaded} transactions...`,
      });

      // Persist checkpoint after each page (survives mid-sync process kill)
      await TransactionStore.saveTransactionMap(txnMap);

      cursor = data.next_cursor;
      if (!cursor) {
        hasMore = false;
      }
    }

    const finalState: SyncState = {
      syncToken: nextSyncToken,
      lastSyncTime: Date.now(),
      isInitialSyncComplete: true,
    };
    await TransactionStore.saveSyncState(finalState);

    this.notify({
      status: 'success',
      phase: 'idle',
      loadedCount: totalLoaded,
      message: 'Sync complete.',
    });

    return { count: totalLoaded, syncToken: nextSyncToken };
  }

  /**
   * Performs incremental sync via /v1/transactions/changes?since=<token>
   * Implements Non-negotiable #6 ("The latest truth wins").
   */
  public async performIncrementalSync(
    syncToken: string
  ): Promise<{ count: number; syncToken: string | null }> {
    this.notify({ status: 'syncing', phase: 'incremental_sync', loadedCount: 0 });
    const txnMap = await TransactionStore.getTransactionMap();

    let cursor: string | null = null;
    let currentToken = syncToken;
    let hasMore = true;

    while (hasMore) {
      const q = new URLSearchParams({ since: currentToken, limit: String(this.pageSize) });
      if (cursor) q.set('cursor', cursor);

      const url = `${this.baseUrl}/v1/transactions/changes?${q.toString()}`;
      const data = await this.fetchWithRetry(url);

      // Handle token expiration (HTTP 410)
      if (data.status === 410 || data.error === 'sync_token_expired') {
        console.warn('[SyncEngine] Sync token expired. Falling back to full sync...');
        await TransactionStore.saveSyncState({
          syncToken: null,
          lastSyncTime: 0,
          isInitialSyncComplete: false,
        });
        return this.performFullSync();
      }

      if (!data || !Array.isArray(data.items)) {
        throw new Error('Invalid response structure received from /v1/transactions/changes');
      }

      if (data.sync_token) {
        currentToken = data.sync_token;
      }

      for (const change of data.items) {
        const id = String(change.id);
        const existing = txnMap[id];
        const changeUpdatedAt = change.updated_at || new Date().toISOString();

        if (change.deleted) {
          // If transaction is deleted, verify timestamp before removing
          if (existing) {
            const existingTime = new Date(existing.updatedAt).getTime();
            const changeTime = new Date(changeUpdatedAt).getTime();
            if (changeTime >= existingTime) {
              delete txnMap[id];
            }
          }
        } else {
          // Normal update: latest truth wins
          if (existing) {
            const existingTime = new Date(existing.updatedAt).getTime();
            const changeTime = new Date(changeUpdatedAt).getTime();
            if (changeTime >= existingTime) {
              txnMap[id] = normalizeTransaction(change);
            }
          } else {
            txnMap[id] = normalizeTransaction(change);
          }
        }
      }

      // Persist incrementally
      await TransactionStore.saveTransactionMap(txnMap);

      cursor = data.next_cursor;
      if (!cursor) {
        hasMore = false;
      }
    }

    const count = Object.keys(txnMap).length;
    await TransactionStore.saveSyncState({
      syncToken: currentToken,
      lastSyncTime: Date.now(),
      isInitialSyncComplete: true,
    });

    this.notify({
      status: 'success',
      phase: 'idle',
      loadedCount: count,
      message: 'Incremental sync complete.',
    });

    return { count, syncToken: currentToken };
  }
}
