import { NormalizedTransaction, MonthSummary } from './types';
import { formatINR, formatMonthHeader } from './formatters';

/**
 * Computes exact per-month spend and income totals.
 * Non-negotiables #4 & #7:
 * - Moving money between own accounts is neither spending nor earning (excluded).
 * - Exact integer math in paise (no floating point drift).
 */
export function computeMonthSummaries(
  transactions: NormalizedTransaction[]
): Record<string, MonthSummary> {
  const summaries: Record<string, MonthSummary> = {};

  for (const txn of transactions) {
    const month = txn.monthKey;
    if (!summaries[month]) {
      summaries[month] = {
        monthKey: month,
        label: formatMonthHeader(month),
        spendMinor: 0,
        incomeMinor: 0,
        spendFormatted: '₹0.00',
        incomeFormatted: '₹0.00',
        transactionCount: 0,
      };
    }

    const summary = summaries[month];
    summary.transactionCount += 1;

    // Self transfers are neither spend nor income
    if (txn.isSelfTransfer) {
      continue;
    }

    if (txn.direction === 'debit') {
      summary.spendMinor += txn.amountMinorInr;
    } else if (txn.direction === 'credit') {
      summary.incomeMinor += txn.amountMinorInr;
    }
  }

  // Format all totals cleanly using Indian currency rules
  for (const month of Object.keys(summaries)) {
    summaries[month].spendFormatted = formatINR(summaries[month].spendMinor);
    summaries[month].incomeFormatted = formatINR(summaries[month].incomeMinor);
  }

  return summaries;
}

/**
 * Groups transactions by IST month key, sorted newest to oldest.
 */
export function groupTransactionsByMonth(
  transactions: NormalizedTransaction[]
): { month: string; summary: MonthSummary; transactions: NormalizedTransaction[] }[] {
  const summaries = computeMonthSummaries(transactions);
  const groups: Record<string, NormalizedTransaction[]> = {};

  for (const txn of transactions) {
    if (!groups[txn.monthKey]) {
      groups[txn.monthKey] = [];
    }
    groups[txn.monthKey].push(txn);
  }

  // Sort months descending (e.g. 2026-10 -> 2025-10)
  const sortedMonths = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  return sortedMonths.map((month) => {
    // Sort transactions within each month descending by occurredAt
    const sortedTxns = [...groups[month]].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );

    return {
      month,
      summary: summaries[month] || {
        monthKey: month,
        label: formatMonthHeader(month),
        spendMinor: 0,
        incomeMinor: 0,
        spendFormatted: '₹0.00',
        incomeFormatted: '₹0.00',
        transactionCount: sortedTxns.length,
      },
      transactions: sortedTxns,
    };
  });
}
