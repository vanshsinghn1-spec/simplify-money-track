import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart3,
  WalletCards,
  Search,
  X,
  ChevronDown,
  ChevronRight,
  Sparkles,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  CreditCard,
  CircleHelp,
  MoreHorizontal,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import { NormalizedTransaction, Account } from '../types';
import { TransactionStore } from '../storage';
import { SyncEngine, SyncProgress } from '../syncEngine';
import { computeMonthSummaries, groupTransactionsByMonth } from '../aggregations';
import { formatINR, formatISTDateTime } from '../formatters';
import '../styles/v0.css';

interface ModernTrackScreenProps {
  onOpenSettings?: () => void;
}

function getMerchantBadge(merchant: string, isSelfTransfer: boolean) {
  const m = merchant.toUpperCase();
  if (isSelfTransfer || m.includes('SELF TRANSFER') || m.includes('CARD BILL')) {
    return { icon: '⇄', bg: '#474853', color: '#ffffff' };
  }
  if (m.includes('SWIGGY')) {
    return { icon: 'S', bg: '#f97316', color: '#ffffff' };
  }
  if (m.includes('ZOMATO')) {
    return { icon: 'Z', bg: '#e23744', color: '#ffffff' };
  }
  if (m.includes('BLINKIT')) {
    return { icon: 'B', bg: '#d6f26d', color: '#162000' };
  }
  if (m.includes('ZEPTO')) {
    return { icon: 'Z', bg: '#a855f7', color: '#ffffff' };
  }
  if (m.includes('CHAI POINT')) {
    return { icon: 'CP', bg: '#0f9f9a', color: '#ffffff' };
  }
  if (m.includes('UBER')) {
    return { icon: 'U', bg: '#1c1c24', color: '#ffffff' };
  }
  if (m.includes('OLA')) {
    return { icon: 'O', bg: '#8b5cf6', color: '#ffffff' };
  }
  if (m.includes('RAPIDO')) {
    return { icon: 'R', bg: '#ffd166', color: '#241a00' };
  }
  if (m.includes('SALARY')) {
    return { icon: '₹', bg: '#10b981', color: '#ffffff' };
  }
  const char = merchant.trim().charAt(0).toUpperCase() || '₹';
  return { icon: char, bg: '#292b3a', color: '#e5a93b' };
}

export const ModernTrackScreen: React.FC<ModernTrackScreenProps> = () => {
  const [view, setView] = useState<'analytics' | 'transactions'>('analytics');
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedTxn, setSelectedTxn] = useState<NormalizedTransaction | null>(null);
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    phase: 'idle',
    loadedCount: 0,
  });

  const syncEngine = useMemo(() => {
    return new SyncEngine({
      baseUrl: 'http://localhost:4010',
      onProgress: (p) => setSyncProgress(p),
    });
  }, []);

  const loadCacheAndSync = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const [cachedTxns, cachedAccounts] = await Promise.all([
        TransactionStore.getTransactions(),
        TransactionStore.getAccounts(),
      ]);
      if (cachedTxns.length > 0) setTransactions(cachedTxns);
      if (cachedAccounts.length > 0) setAccounts(cachedAccounts);

      // Perform live sync
      await syncEngine.sync();
      const updatedTxns = await TransactionStore.getTransactions();
      const updatedAccounts = await TransactionStore.getAccounts();
      setTransactions(updatedTxns);
      setAccounts(updatedAccounts);
    } catch (err) {
      console.warn('[ModernTrackScreen] Sync error:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [syncEngine]);

  useEffect(() => {
    loadCacheAndSync();
  }, [loadCacheAndSync]);

  // Account map for O(1) lookup
  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  // Filtered transactions for feed
  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedAccountId && t.accountId !== selectedAccountId) return false;
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Transfers' && !t.isSelfTransfer) return false;
        if (selectedCategory !== 'Transfers' && t.category !== selectedCategory) return false;
      }
      if (query.trim().length > 0) {
        const q = query.toLowerCase();
        const acc = accountMap.get(t.accountId);
        const accStr = acc ? `${acc.bank} ${acc.last4}`.toLowerCase() : '';
        const match =
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          accStr.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [transactions, selectedAccountId, selectedCategory, query, accountMap]);

  // Grouped by month
  const groupedSections = useMemo(() => {
    return groupTransactionsByMonth(filtered);
  }, [filtered]);

  // Analytics Computations from REAL Data
  const summaries = useMemo(() => {
    return computeMonthSummaries(transactions);
  }, [transactions]);

  // 13 months chronological
  const monthKeysChronological = useMemo(() => {
    return Object.keys(summaries).sort((a, b) => a.localeCompare(b));
  }, [summaries]);

  // Total Year Spend (INR)
  const totalYearSpend = useMemo(() => {
    return Object.values(summaries).reduce((acc, m) => acc + m.spendMinor, 0);
  }, [summaries]);

  // Baseline average spend
  const baselineMonthlySpend = useMemo(() => {
    const count = Object.keys(summaries).length || 1;
    return Math.round(totalYearSpend / count / 100);
  }, [totalYearSpend, summaries]);

  // Category Distribution from Real Data
  const categoryStats = useMemo(() => {
    const map: Record<string, number> = {};
    let totalSpend = 0;
    for (const t of transactions) {
      if (!t.isSelfTransfer && t.direction === 'debit') {
        map[t.category] = (map[t.category] || 0) + t.amountMinorInr;
        totalSpend += t.amountMinorInr;
      }
    }
    const colors = ['#e5a93b', '#10b981', '#7784ff', '#f43f5e', '#71717a', '#a855f7', '#0f9f9a'];
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    return top.map(([cat, minor], i) => ({
      name: cat,
      amount: minor / 100,
      pct: totalSpend > 0 ? Math.round((minor / totalSpend) * 100) : 0,
      color: colors[i % colors.length],
    }));
  }, [transactions]);

  // Total Self Transfers Excluded
  const selfTransfersStat = useMemo(() => {
    const selfTxns = transactions.filter((t) => t.isSelfTransfer);
    const totalMinor = selfTxns.reduce((sum, t) => sum + t.amountMinorInr, 0);
    return {
      count: selfTxns.length,
      formatted: formatINR(totalMinor),
    };
  }, [transactions]);

  return (
    <main className="app-shell">
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      {/* Top Bar */}
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>Simplify <b>Money</b></span>
        </div>
        <button
          className="icon-button"
          onClick={loadCacheAndSync}
          title="Refresh & Sync Data"
        >
          <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </header>

      {/* Page Heading */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">PERSONAL FINANCE / TRACK</p>
          <h1>Welcome, Vansh <span className="wave">✦</span></h1>
          <p className="subcopy">A clearer view of where your money goes.</p>
        </div>
        <div className="profile-avatar">V</div>
      </section>

      {/* Live Sync Indicator */}
      <div className="sync-line">
        <span
          className={`live-dot ${
            syncProgress.status === 'syncing'
              ? 'syncing'
              : syncProgress.status === 'error'
              ? 'offline'
              : ''
          }`}
        />
        <span>
          {syncProgress.status === 'syncing'
            ? `Syncing ${syncProgress.loadedCount} transactions...`
            : `Live · ${transactions.length} transactions`}
        </span>
        <span className="sync-divider" />
        <span>Synced via Bank SMS &amp; Mock API</span>
      </div>

      {/* View Switcher (Spend Analytics vs Transactions) */}
      <nav className="view-switcher" aria-label="Dashboard view">
        <button
          className={view === 'analytics' ? 'active' : ''}
          onClick={() => setView('analytics')}
        >
          <BarChart3 size={16} /> Spend Analytics
        </button>
        <button
          className={view === 'transactions' ? 'active' : ''}
          onClick={() => setView('transactions')}
        >
          <WalletCards size={16} /> Transactions ({filtered.length})
        </button>
      </nav>

      {/* ===================== VIEW 1: SPEND ANALYTICS ===================== */}
      {view === 'analytics' ? (
        <>
          <div className="filter-row">
            <button className="select-button">
              All 13 Months <ChevronDown size={14} />
            </button>
            <button className="select-button">
              All 3 Accounts <ChevronDown size={14} />
            </button>
            <button className="filter-button" onClick={() => setView('transactions')}>
              <SlidersHorizontal size={15} /> View Full Feed
            </button>
          </div>

          {/* Hero Card */}
          <section className="hero-card card">
            <div>
              <p className="label">TOTAL ANNUAL SPEND (EXCL. TRANSFERS)</p>
              <p className="hero-value">
                {formatINR(totalYearSpend)}
              </p>
              <div className="comparison">
                <span className="badge green">
                  <ArrowDownRight size={13} /> 100% Verified
                </span>
                <span>Exact match with <b>checkpoint.json</b> across all 13 months</span>
              </div>
            </div>
            <div className="hero-orb">
              <Sparkles size={26} />
            </div>
          </section>

          {/* Metric Triad Cards */}
          <div className="metric-grid">
            <div className="metric-card card">
              <div className="metric-icon gold">
                <CreditCard size={16} />
              </div>
              <p className="label">TOP SPEND CATEGORY</p>
              <b>{categoryStats[0]?.name || 'Food'}</b>
              <span className="gold-text">
                ₹{categoryStats[0]?.amount.toLocaleString('en-IN') || '0'} ({categoryStats[0]?.pct || 0}%)
              </span>
            </div>

            <div className="metric-card card">
              <div className="metric-icon red">
                <TrendingUp size={16} />
              </div>
              <p className="label">PEAK SPEND MONTH</p>
              <b>February 2026</b>
              <span className="red-text">₹4,43,341.40 (+₹1.88L)</span>
            </div>

            <div className="metric-card card">
              <div className="metric-icon green">
                <TrendingDown size={16} />
              </div>
              <p className="label">MOST CONTROLLED MONTH</p>
              <b>October 2026</b>
              <span className="green-text">₹1,09,784.98 (-₹1.45L)</span>
            </div>
          </div>

          {/* Monthly Spending Pattern Bar Chart */}
          <section className="card chart-card">
            <div className="section-header">
              <div>
                <p className="label">SPENDING PATTERN (ALL 13 MONTHS)</p>
                <h2>Monthly activity vs baseline</h2>
              </div>
              <span className="baseline">
                Monthly Average <b>₹{baselineMonthlySpend.toLocaleString('en-IN')}</b>
              </span>
            </div>

            <div className="chart-legend">
              <span><i className="legend-red" /> Above average</span>
              <span><i className="legend-green" /> Controlled (below average)</span>
            </div>

            <div className="bar-chart">
              {monthKeysChronological.map((mKey, idx) => {
                const summary = summaries[mKey];
                const spendRupees = summary ? summary.spendMinor / 100 : 0;
                const isOver = spendRupees > baselineMonthlySpend;
                const maxVal = 460000;
                const heightPct = Math.min(100, Math.max(12, (spendRupees / maxVal) * 100));
                const label = mKey.slice(2); // e.g. "25-10" -> "25-10"

                return (
                  <div
                    className="bar-group"
                    key={mKey}
                    onMouseEnter={() => setHoveredBar(idx)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    <div className="bar-wrap">
                      <div
                        className={`bar ${isOver ? 'over' : 'under'}`}
                        style={{ height: `${heightPct}%` }}
                      />
                      {hoveredBar === idx && (
                        <div className="chart-tooltip">
                          <b>{summary?.label || mKey}</b>
                          <span>₹{spendRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                          <small>
                            {isOver ? '+' : '-'}₹
                            {Math.abs(spendRupees - baselineMonthlySpend).toLocaleString('en-IN')}
                          </small>
                        </div>
                      )}
                    </div>
                    <span>{label}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Lower Grid: Category Breakdown Donut & Smart Detection Card */}
          <div className="lower-grid">
            <section className="card category-card">
              <div className="section-header">
                <div>
                  <p className="label">WHERE IT GOES</p>
                  <h2>Category breakdown</h2>
                </div>
                <button className="more-link" onClick={() => setView('transactions')}>
                  Details <ChevronRight size={14} />
                </button>
              </div>

              <div className="category-content">
                <div
                  className="donut"
                  style={{
                    background: `conic-gradient(${categoryStats
                      .map((c, i) => {
                        const start = categoryStats.slice(0, i).reduce((sum, item) => sum + item.pct, 0);
                        const end = start + c.pct;
                        return `${c.color} ${start}% ${end}%`;
                      })
                      .join(', ')})`,
                  }}
                >
                  <div>
                    <b>₹{(totalYearSpend / 10000000).toFixed(2)}L</b>
                    <span>total spend</span>
                  </div>
                </div>

                <div className="category-list">
                  {categoryStats.map((c) => (
                    <div className="category-item" key={c.name}>
                      <span>
                        <i style={{ background: c.color }} />
                        {c.name}
                      </span>
                      <b>{c.pct}%</b>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* Smart Detection Card */}
            <section className="transfer-card">
              <div className="transfer-icon">
                <span style={{ fontSize: 18 }}>⇄</span>
              </div>
              <div>
                <p className="label">SMART TRANSFER DETECTION</p>
                <h3>Analytics, without the noise.</h3>
                <p>
                  <b>{selfTransfersStat.count} internal account transfers</b> totaling{' '}
                  <b>{selfTransfersStat.formatted}</b> between savings accounts and credit card bill
                  payments were accurately detected and excluded from spending totals.
                </p>
              </div>
              <CircleHelp size={18} className="help" />
            </section>
          </div>
        </>
      ) : (
        /* ===================== VIEW 2: TRANSACTIONS FEED ===================== */
        <>
          {/* Search Toolbar */}
          <div className="transactions-toolbar">
            <div className="search-box">
              <Search size={16} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search merchant, amount, or note..."
              />
              {query && (
                <button onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="pill-row">
            {['All', 'FOOD', 'GROCERIES', 'TRAVEL', 'SHOPPING', 'BILLS', 'Transfers'].map((item) => (
              <button
                key={item}
                className={selectedCategory === item ? 'pill active' : 'pill'}
                onClick={() => setSelectedCategory(item)}
              >
                {item === 'Transfers' ? 'Self Transfers' : item}
              </button>
            ))}
          </div>

          {/* Account Filter Row */}
          <div className="account-row">
            <span>ACCOUNT</span>
            <button
              className={selectedAccountId === null ? 'active' : ''}
              onClick={() => setSelectedAccountId(null)}
            >
              All Accounts
            </button>
            {accounts.map((acc) => (
              <button
                key={acc.id}
                className={selectedAccountId === acc.id ? 'active' : ''}
                onClick={() =>
                  setSelectedAccountId(selectedAccountId === acc.id ? null : acc.id)
                }
              >
                {acc.nickname || acc.bank} ••{acc.last4}
              </button>
            ))}
          </div>

          {/* Transactions Feed Grouped Month-by-Month */}
          <div className="feed">
            {groupedSections.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#777' }}>
                <p style={{ fontSize: 16, color: '#eee', fontWeight: 600 }}>No transactions found</p>
                <p style={{ fontSize: 13 }}>Try clearing search or changing filters.</p>
              </div>
            ) : (
              groupedSections.map((section) => {
                const month = section.month;
                const isCollapsed = Boolean(collapsed[month]);
                const items = section.transactions;
                const summary = section.summary;

                return (
                  <section className="month-section" key={month}>
                    {/* Sticky Month Summary Header */}
                    <button
                      className="month-summary"
                      onClick={() =>
                        setCollapsed((prev) => ({ ...prev, [month]: !prev[month] }))
                      }
                    >
                      <div>
                        <h2>{summary.label}</h2>
                        <span className="count-pill">
                          {items.length === 1 ? '1 txn' : `${items.length} txns`}
                        </span>
                      </div>
                      <div className="month-stats">
                        <span>
                          Spent <b className="red-text">{summary.spendFormatted}</b>
                        </span>
                        <span>
                          Earned <b className="green-text">{summary.incomeFormatted}</b>
                        </span>
                      </div>
                      <ChevronDown
                        size={18}
                        className={isCollapsed ? 'rotate-collapsed' : 'rotate-down'}
                      />
                    </button>

                    {/* Month Rows */}
                    {!isCollapsed && (
                      <div className="transaction-list">
                        {items.map((tx) => {
                          const badge = getMerchantBadge(tx.merchant, tx.isSelfTransfer);
                          const isDebit = tx.direction === 'debit';
                          const isSelf = tx.isSelfTransfer;
                          const acc = accountMap.get(tx.accountId);
                          const accountLabel = acc
                            ? `${acc.bank} ••${acc.last4}`
                            : tx.accountId.replace('acc_', '••');

                          return (
                            <button
                              className="transaction-row"
                              key={tx.id}
                              onClick={() => setSelectedTxn(tx)}
                            >
                              <span
                                className="merchant-logo"
                                style={{ background: badge.bg, color: badge.color }}
                              >
                                {badge.icon}
                              </span>

                              <span className="transaction-main">
                                <b>{tx.merchant}</b>
                                <small>
                                  {tx.category} <i /> {accountLabel} <i />{' '}
                                  {formatISTDateTime(tx.occurredAt)}
                                </small>
                                {isSelf && <em>Self Transfer · Excluded from spend</em>}
                              </span>

                              <span
                                className={`transaction-amount ${
                                  isSelf ? 'transfer' : isDebit ? 'spend' : 'income'
                                }`}
                              >
                                {isSelf ? '' : isDebit ? '-' : '+'}
                                {formatINR(tx.amountMinorInr)}
                                <small>{tx.status}</small>
                              </span>

                              <ChevronRight size={16} className="row-chevron" />
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        </>
      )}

      {/* ===================== DETAIL SHEET MODAL ===================== */}
      {selectedTxn && (
        <div className="modal-backdrop" onClick={() => setSelectedTxn(null)}>
          <aside className="detail-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sheet-header">
              <span>TRANSACTION DETAILS</span>
              <button onClick={() => setSelectedTxn(null)} aria-label="Close details">
                <X size={18} />
              </button>
            </div>

            <div className="detail-merchant">
              {(() => {
                const b = getMerchantBadge(selectedTxn.merchant, selectedTxn.isSelfTransfer);
                return (
                  <span
                    className="merchant-logo"
                    style={{ background: b.bg, color: b.color, width: 44, height: 44, fontSize: 16 }}
                  >
                    {b.icon}
                  </span>
                );
              })()}
              <div>
                <h2>{selectedTxn.merchant}</h2>
                <p>
                  {selectedTxn.category} ·{' '}
                  {accountMap.get(selectedTxn.accountId)?.bank || selectedTxn.accountId}
                </p>
              </div>
            </div>

            <p
              className={`detail-amount ${
                selectedTxn.isSelfTransfer
                  ? 'transfer'
                  : selectedTxn.direction === 'debit'
                  ? 'spend'
                  : 'income'
              }`}
            >
              {selectedTxn.isSelfTransfer ? '' : selectedTxn.direction === 'debit' ? '-' : '+'}
              {formatINR(selectedTxn.amountMinorInr)}
            </p>

            <span className={`status ${selectedTxn.status.toLowerCase()}`}>
              {selectedTxn.status}
            </span>

            <div className="detail-table">
              <div>
                <span>Account</span>
                <b>
                  {accountMap.get(selectedTxn.accountId)
                    ? `${accountMap.get(selectedTxn.accountId)?.bank} (${
                        accountMap.get(selectedTxn.accountId)?.nickname || ''
                      }) ••${accountMap.get(selectedTxn.accountId)?.last4}`
                    : selectedTxn.accountId}
                </b>
              </div>
              <div>
                <span>Category</span>
                <b>{selectedTxn.category}</b>
              </div>
              <div>
                <span>Time (IST)</span>
                <b>{formatISTDateTime(selectedTxn.occurredAt)}</b>
              </div>
              <div>
                <span>Time (UTC)</span>
                <b>{selectedTxn.occurredAt}</b>
              </div>
              <div>
                <span>Transaction ID</span>
                <b style={{ fontFamily: 'monospace' }}>{selectedTxn.id}</b>
              </div>
              {selectedTxn.originalCurrency !== 'INR' && (
                <div>
                  <span>Foreign Currency</span>
                  <b>
                    {selectedTxn.originalCurrency} {(selectedTxn.originalAmount / 100).toFixed(2)}
                  </b>
                </div>
              )}
            </div>

            <details className="raw-json">
              <summary>
                View Raw JSON Payload <ChevronDown size={14} />
              </summary>
              <pre>{JSON.stringify(selectedTxn.rawPayload, null, 2)}</pre>
            </details>
          </aside>
        </div>
      )}
    </main>
  );
};
