import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { SyncEngine } from '../src/syncEngine';
import { TransactionStore } from '../src/storage';
import { computeMonthSummaries } from '../src/aggregations';

describe('Live Mock Server End-to-End Integration Test', () => {
  const PORT = 4016;
  const fixturesDir = path.join(__dirname, '../track-api-mock/fixtures');
  const checkpoint = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'checkpoint.json'), 'utf8')
  );

  let serverProc: ChildProcess;

  beforeAll(async () => {
    await TransactionStore.clearAll();

    serverProc = spawn('node', ['track-api-mock/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: {
        ...process.env,
        PORT: String(PORT),
        SM_CALM: '1', // fast responses for test
      },
      stdio: 'ignore',
    });

    // Wait for server to listen
    await new Promise((resolve) => setTimeout(resolve, 600));
  });

  afterAll(async () => {
    if (serverProc) {
      serverProc.kill();
    }
  });

  test(
    'Full sync + incremental sync against live HTTP server matches checkpoint 100%',
    async () => {
      const engine = new SyncEngine({
        baseUrl: `http://127.0.0.1:${PORT}`,
        pageSize: 100,
      });

      // 1. Initial Sync
      const fullResult = await engine.sync();
      expect(fullResult.count).toBe(4675);
      expect(fullResult.syncToken).toBeDefined();

      // 2. Incremental Sync (changes)
      const incResult = await engine.sync();
      expect(incResult.count).toBe(4686);

      // 3. Verify Local Storage has all 4,686 transactions
      const allStored = await TransactionStore.getTransactions();
      expect(allStored.length).toBe(4686);

      // 4. Verify monthly spend and income match checkpoint
      const summaries = computeMonthSummaries(allStored);
      for (const [month, expected] of Object.entries(checkpoint.months as Record<string, any>)) {
        const summary = summaries[month];
        expect(summary).toBeDefined();
        expect((summary.spendMinor / 100).toFixed(2)).toBe(expected.spend);
        expect((summary.incomeMinor / 100).toFixed(2)).toBe(expected.income);
      }
    },
    45000
  );
});
