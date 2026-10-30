export type Direction = 'debit' | 'credit';

export interface Account {
  id: string;
  bank: string;
  type: string;
  last4: string;
  nickname: string;
}

export interface RawCounterparty {
  type: string;
  account_id?: string;
}

export interface RawFx {
  inr_minor: number;
}

export interface RawTransactionA {
  id: string;
  account_id: string;
  occurred_at: string;
  direction: Direction;
  amount_minor: number;
  currency: string;
  merchant: string;
  category?: string | null;
  status: string;
  updated_at?: string;
  counterparty?: RawCounterparty;
  fx?: RawFx;
}

export interface RawTransactionB {
  id: string;
  account: string | number;
  txn_time: number;
  amount: string | number;
  type: 'DR' | 'CR';
  merchant_name?: string;
  category?: string | null;
  status: string;
  linked_account?: string | number;
  updated_at?: string;
}

export interface RawTransactionChange {
  id: string;
  deleted?: boolean;
  updated_at?: string;
  [key: string]: any;
}

export type RawTransaction = RawTransactionA | RawTransactionB | RawTransactionChange;

export interface NormalizedTransaction {
  id: string;
  accountId: string;
  occurredAt: string; // ISO 8601 string
  monthKey: string; // YYYY-MM in Indian Standard Time (IST)
  direction: Direction;
  amountMinorInr: number; // Exact integer paise
  originalAmount: number; // Minor units or display
  originalCurrency: string;
  merchant: string;
  category: string;
  status: 'POSTED' | 'PENDING';
  isSelfTransfer: boolean;
  updatedAt: string;
  counterpartyAccountId?: string;
  rawPayload: any;
}

export interface MonthSummary {
  monthKey: string; // e.g. "2026-10"
  label: string; // e.g. "October 2026"
  spendMinor: number;
  incomeMinor: number;
  spendFormatted: string; // e.g. "₹2,85,256.89"
  incomeFormatted: string; // e.g. "₹2,44,805.00"
  transactionCount: number;
}

export interface SyncState {
  syncToken: string | null;
  lastSyncTime: number;
  isInitialSyncComplete: boolean;
}

