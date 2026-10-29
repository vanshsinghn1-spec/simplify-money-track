import { SyncEngine } from '../src/syncEngine';
import { TransactionStore } from '../src/storage';

describe('SyncEngine - Resilience & Edge Cases', () => {
  beforeEach(async () => {
    await TransactionStore.clearAll();
  });

  test('SyncEngine initializes with correct defaults and base URL', () => {
    const engine = new SyncEngine({ baseUrl: 'http://localhost:4010' });
    expect(engine.getBaseUrl()).toBe('http://localhost:4010');

    engine.setBaseUrl('http://192.168.1.10:4010/');
    expect(engine.getBaseUrl()).toBe('http://192.168.1.10:4010');
  });

  test('Concurrent sync calls are mutually excluded (Race condition test)', async () => {
    const engine = new SyncEngine({ baseUrl: 'http://localhost:4010' });

    // Mock fetchWithRetry internal behavior
    let callCount = 0;
    (engine as any).fetchWithRetry = jest.fn().mockImplementation(async () => {
      callCount++;
      await new Promise((r) => setTimeout(r, 50));
      return { items: [], next_cursor: null, sync_token: 'test_token' };
    });

    // Fire two syncs simultaneously
    const promise1 = engine.sync();
    const promise2 = engine.sync();

    await Promise.all([promise1, promise2]);

    // Only one sync flow should have run accounts + transactions
    // The second should have immediately recognized isSyncing = true and returned
    expect(callCount).toBeLessThan(3);
  });

  test('Mid-sync process kill: partial pages remain safely stored in local storage', async () => {
    const engine = new SyncEngine({ baseUrl: 'http://localhost:4010' });

    let pageNum = 0;
    (engine as any).fetchWithRetry = jest.fn().mockImplementation(async (url: string) => {
      if (url.includes('/v1/accounts')) return { items: [] };

      pageNum++;
      if (pageNum === 1) {
        return {
          items: [
            {
              id: 'txn_1',
              account_id: 'acc_1',
              occurred_at: '2026-10-01T10:00:00Z',
              direction: 'debit',
              amount_minor: 1500,
              currency: 'INR',
              merchant: 'Test 1',
              status: 'POSTED',
            },
          ],
          next_cursor: 'cursor_page_2',
        };
      }
      // Simulate crash/error on second page
      throw new Error('Connection abruptly terminated mid-sync');
    });

    await expect(engine.performFullSync()).rejects.toThrow('Connection abruptly terminated mid-sync');

    // Verify Non-negotiable #5: The first page was saved to disk and not lost
    const savedTxns = await TransactionStore.getTransactions();
    expect(savedTxns.length).toBe(1);
    expect(savedTxns[0].id).toBe('txn_1');
  });
});
