import { NormalizedTransaction, RawTransaction, Direction } from './types';

/**
 * Calculates YYYY-MM key in Indian Standard Time (UTC+5:30).
 * Required for Non-negotiable #3 (Our users are in India).
 */
export function getISTMonthKey(dateInput: string | Date | number): string {
  const date = typeof dateInput === 'string' || typeof dateInput === 'number'
    ? new Date(dateInput)
    : dateInput;

  // Offset UTC time by 5 hours and 30 minutes
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  const year = istDate.getUTCFullYear();
  const month = String(istDate.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Parses rupee amount string or minor integer into exact paise integer.
 * Avoids floating-point math inaccuracies (Non-negotiable #2).
 */
export function parseToPaise(amount: string | number): number {
  if (typeof amount === 'number') {
    // If it's an integer in minor units (e.g. 47039 paise)
    return Math.round(amount);
  }

  const clean = String(amount).trim();
  if (!clean.includes('.')) {
    return (parseInt(clean, 10) || 0) * 100;
  }

  const [rupeesStr, paiseStr = ''] = clean.split('.');
  const isNegative = clean.startsWith('-');
  const absRupees = Math.abs(parseInt(rupeesStr, 10) || 0);
  const paddedPaise = (paiseStr + '00').slice(0, 2);
  const paise = parseInt(paddedPaise, 10) || 0;
  const total = absRupees * 100 + paise;
  return isNegative ? -total : total;
}

/**
 * Unifies Schema A, Schema B, and partial changes into NormalizedTransaction.
 */
export function normalizeTransaction(raw: any): NormalizedTransaction {
  const isSchemaA = 'amount_minor' in raw || 'account_id' in raw || 'occurred_at' in raw;

  if (isSchemaA) {
    const isUSD = raw.currency === 'USD';
    const amountMinorInr = isUSD && raw.fx?.inr_minor ? raw.fx.inr_minor : raw.amount_minor;
    const direction: Direction = raw.direction === 'credit' ? 'credit' : 'debit';
    const isSelfTransfer = Boolean(raw.counterparty?.type === 'OWN_ACCOUNT');
    const occurredAt = raw.occurred_at || new Date().toISOString();
    const updatedAt = raw.updated_at || occurredAt;

    return {
      id: String(raw.id),
      accountId: String(raw.account_id || 'acc_unknown'),
      occurredAt,
      monthKey: getISTMonthKey(occurredAt),
      direction,
      amountMinorInr: Math.round(amountMinorInr),
      originalAmount: raw.amount_minor,
      originalCurrency: raw.currency || 'INR',
      merchant: raw.merchant || 'Unknown Merchant',
      category: raw.category || 'GENERAL',
      status: raw.status === 'PENDING' ? 'PENDING' : 'POSTED',
      isSelfTransfer,
      updatedAt,
      counterpartyAccountId: raw.counterparty?.account_id,
      rawPayload: raw,
    };
  }

  // Schema B (Legacy scraper / Core Banking format)
  const isSelfTransfer = Boolean(
    raw.linked_account != null && (raw.category === 'TRANSFER' || raw.category === 'SELF_TRANSFER')
  );
  const direction: Direction = raw.type === 'CR' ? 'credit' : 'debit';
  const amountMinorInr = parseToPaise(raw.amount);
  
  // txn_time is in epoch seconds
  const timestampMs = typeof raw.txn_time === 'number'
    ? (raw.txn_time > 1e11 ? raw.txn_time : raw.txn_time * 1000)
    : Date.now();
  const occurredAt = new Date(timestampMs).toISOString();
  const updatedAt = raw.updated_at || occurredAt;

  const rawAcc = raw.account ? String(raw.account) : 'unknown';
  const accountId = rawAcc.startsWith('acc_') ? rawAcc : `acc_${rawAcc}`;

  return {
    id: String(raw.id),
    accountId,
    occurredAt,
    monthKey: getISTMonthKey(occurredAt),
    direction,
    amountMinorInr,
    originalAmount: typeof raw.amount === 'number' ? raw.amount : amountMinorInr,
    originalCurrency: 'INR',
    merchant: raw.merchant_name || raw.merchant || 'Unknown Merchant',
    category: raw.category || 'GENERAL',
    status: raw.status === 'PENDING' ? 'PENDING' : 'POSTED',
    isSelfTransfer,
    updatedAt,
    counterpartyAccountId: raw.linked_account ? `acc_${raw.linked_account}` : undefined,
    rawPayload: raw,
  };
}
