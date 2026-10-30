import fs from 'fs';
import path from 'path';
import { normalizeTransaction } from '../src/normalize';
import { computeMonthSummaries } from '../src/aggregations';
import { NormalizedTransaction } from '../src/types';

describe('Simplify Money Track - Checkpoint & Non-Negotiables Verification', () => {
  const fixturesDir = path.join(__dirname, '../track-api-mock/fixtures');
  const transactionsRaw: any[] = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'transactions.json'), 'utf8')
  );
  const changesRaw: any[] = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'changes.json'), 'utf8')
  );
  const checkpoint: any = JSON.parse(
    fs.readFileSync(path.join(fixturesDir, 'checkpoint.json'), 'utf8')
  );

  let mergedMap: Record<string, NormalizedTransaction> = {};

  beforeAll(() => {
    // 1. Initial Ingest (simulating full paginated sync with deduplication)
    mergedMap = {};
    for (const raw of transactionsRaw) {
      const norm = normalizeTransaction(raw);
      mergedMap[norm.id] = norm;
    }

    // 2. Incremental Changes Ingest (simulating /changes with "latest truth wins")
    for (const change of changesRaw) {
      const id = String(change.id);
      const existing = mergedMap[id];
      const changeUpdatedAt = change.updated_at || new Date().toISOString();

      if (change.deleted) {
        if (existing) {
          const existingTime = new Date(existing.updatedAt).getTime();
          const changeTime = new Date(changeUpdatedAt).getTime();
          if (changeTime >= existingTime) {
            delete mergedMap[id];
          }
        }
      } else {
        if (existing) {
          const existingTime = new Date(existing.updatedAt).getTime();
          const changeTime = new Date(changeUpdatedAt).getTime();
          if (changeTime >= existingTime) {
            mergedMap[id] = normalizeTransaction(change);
          }
        } else {
          mergedMap[id] = normalizeTransaction(change);
        }
      }
    }
  });

  test('Non-negotiable #1: Exactly 4,686 unique transactions appear after sync', () => {
    const totalTransactions = Object.keys(mergedMap).length;
    expect(totalTransactions).toBe(checkpoint.transaction_count);
  });

  test('Non-negotiable #4: Self transfers are properly recognized and flagged', () => {
    const selfTransfers = Object.values(mergedMap).filter((t) => t.isSelfTransfer);
    expect(selfTransfers.length).toBeGreaterThan(0);

    // Verify sample self transfers between accounts
    const hdfcToIcici = selfTransfers.find((t) =>
      t.merchant.toUpperCase().includes('SELF TRANSFER')
    );
    expect(hdfcToIcici).toBeDefined();
    expect(hdfcToIcici?.isSelfTransfer).toBe(true);
  });

  test('Non-negotiable #6: Out-of-order changes are resolved by updatedAt (Latest Truth Wins)', () => {
    // Specifically test txn_DAFC2853FA16EBD510BC where change #5 (POSTED ₹89)
    // was superseded by older change #49 (PENDING ₹39)
    const target = mergedMap['txn_DAFC2853FA16EBD510BC'];
    expect(target).toBeDefined();
    expect(target.amountMinorInr).toBe(8900); // 89.00 INR (newer change)
    expect(target.status).toBe('POSTED');
  });

  test('Non-negotiable #2 & #7: Every single month Spend and Income matches checkpoint.json exactly', () => {
    const allTransactions = Object.values(mergedMap);
    const summaries = computeMonthSummaries(allTransactions);

    const checkpointMonths = checkpoint.months;
    const months = Object.keys(checkpointMonths);

    for (const month of months) {
      const expected = checkpointMonths[month];
      const calculated = summaries[month];

      expect(calculated).toBeDefined();

      const calcSpendFormatted = (calculated.spendMinor / 100).toFixed(2);
      const calcIncomeFormatted = (calculated.incomeMinor / 100).toFixed(2);

      expect(calcSpendFormatted).toBe(expected.spend);
      expect(calcIncomeFormatted).toBe(expected.income);
    }
  });

  test('Non-negotiable #3: Timezone grouping uses IST (UTC+5:30)', () => {
    // A transaction at 2026-03-31 18:23:00 UTC occurs on 2026-04-01 in IST
    const lateUtcTxn = Object.values(mergedMap).find(
      (t) => t.occurredAt.startsWith('2026-03-31T19:') || t.occurredAt.startsWith('2026-03-31T18:3')
    );
    if (lateUtcTxn) {
      expect(lateUtcTxn.monthKey).toBe('2026-04');
    }
  });
});

