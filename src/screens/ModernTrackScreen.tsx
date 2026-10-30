import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowLeft,
  Search,
  X,
  ChevronDown,
  ListFilter,
  Calendar,
  Building2,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Info,
  Plus,
  CircleHelp,
  RefreshCw,
} from '../components/Icons';
import { NormalizedTransaction, Account } from '../types';
import { TransactionStore } from '../storage';
import { SyncEngine, SyncProgress } from '../syncEngine';
import { computeMonthSummaries } from '../aggregations';
import {
  formatINR,
  formatISTDateTime,
  formatISTDateKey,
  formatISTDayHeader,
} from '../formatters';
import '../styles/v0.css';

interface ModernTrackScreenProps {
  onOpenSettings?: () => void;
}

function getMerchantAvatar(merchant: string, isSelfTransfer: boolean) {
  const m = merchant.toUpperCase();
  if (isSelfTransfer || m.includes('SELF TRANSFER') || m.includes('TRANSFER')) {
    return { letter: '⇄', bg: '#334155' };
  }
  if (m.includes('KASI')) {
    return { letter: 'K', bg: '#dc2626' }; // Red matching screenshot
  }
  if (m.includes('THE ULTIMATE') || m.includes('ULTIMATE')) {
    return { letter: 'T', bg: '#475569' }; // Slate gray matching screenshot
  }
  if (m.includes('SWIGGY')) {
    return { letter: 'S', bg: '#ea580c' }; // Swiggy Orange
  }
  if (m.includes('ZOMATO')) {
    return { letter: 'Z', bg: '#e11d48' }; // Zomato Crimson
  }
  if (m.includes('BLINKIT')) {
    return { letter: 'B', bg: '#84cc16' }; // Blinkit Lime
  }
  if (m.includes('ZEPTO')) {
    return { letter: 'Z', bg: '#9333ea' }; // Zepto Violet
  }
  if (m.includes('UBER')) {
    return { letter: 'U', bg: '#18181b' }; // Uber Dark
  }
  if (m.includes('OLA')) {
    return { letter: 'O', bg: '#7c3aed' }; // Ola Purple
  }
  if (m.includes('RAPIDO')) {
    return { letter: 'R', bg: '#f59e0b' }; // Rapido Yellow
  }
  if (m.includes('CHAI POINT')) {
    return { letter: 'CP', bg: '#0f766e' };
  }
  if (m.includes('SALARY')) {
    return { letter: '₹', bg: '#059669' };
  }
  const char = merchant.trim().charAt(0).toUpperCase() || '₹';
  return { letter: char, bg: '#2563eb' };
}

function getCategoryDotColor(cat: string) {
  const c = cat.toUpperCase();
  if (c.includes('TRANSFER')) return '#38bdf8'; // Cyan
  if (c.includes('FOOD')) return '#c084fc'; // Purple
  if (c.includes('GROCER')) return '#4ade80'; // Green
  if (c.includes('SHOPPING')) return '#fbbf24'; // Amber
  if (c.includes('TRAVEL')) return '#f472b6'; // Pink
  return '#94a3b8';
}

export const ModernTrackScreen: React.FC<ModernTrackScreenProps> = () => {
  const [view, setView] = useState<'analytics' | 'transactions'>('analytics');
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedYear, setSelectedYear] = useState<string>('2026');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTxn, setSelectedTxn] = useState<NormalizedTransaction | null>(null);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add Expense form state
  const [newMerchant, setNewMerchant] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newCategory, setNewCategory] = useState('FOOD');
  const [newAccountId, setNewAccountId] = useState('');

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
      if (cachedAccounts.length > 0) {
        setAccounts(cachedAccounts);
        if (!newAccountId && cachedAccounts[0]) {
          setNewAccountId(cachedAccounts[0].id);
        }
      }

      await syncEngine.sync();
      const updatedTxns = await TransactionStore.getTransactions();
      const updatedAccounts = await TransactionStore.getAccounts();
      setTransactions(updatedTxns);
      setAccounts(updatedAccounts);
    } catch (err) {
      console.warn('[ModernTrackScreen] Sync notice:', err);
    } finally {
      setIsRefreshing(false);
    }
  }, [syncEngine, newAccountId]);

  useEffect(() => {
    loadCacheAndSync();
  }, [loadCacheAndSync]);

  const accountMap = useMemo(() => {
    const map = new Map<string, Account>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  // Filtered by Year & Account
  const scopedTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (selectedYear !== 'ALL') {
        const istYear = t.monthKey.slice(0, 4);
        if (istYear !== selectedYear) return false;
      }
      if (selectedAccountId && t.accountId !== selectedAccountId) {
        return false;
      }
      return true;
    });
  }, [transactions, selectedYear, selectedAccountId]);

  // Filtered for Transactions Feed (includes Search and Category)
  const feedTransactions = useMemo(() => {
    return scopedTransactions.filter((t) => {
      if (selectedCategory !== 'All') {
        if (selectedCategory === 'Transfers') {
          if (!t.isSelfTransfer) return false;
        } else if (t.category !== selectedCategory) {
          return false;
        }
      }
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const acc = accountMap.get(t.accountId);
        const accStr = acc ? `${acc.bank} ${acc.last4}`.toLowerCase() : '';
        const amtStr = (t.amountMinorInr / 100).toString();
        const match =
          t.merchant.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q) ||
          amtStr.includes(q) ||
          accStr.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [scopedTransactions, selectedCategory, searchQuery, accountMap]);

  // Analytics Computations
  const summaries = useMemo(() => {
    return computeMonthSummaries(scopedTransactions);
  }, [scopedTransactions]);

  const totalSpendMinor = useMemo(() => {
    return Object.values(summaries).reduce((acc, m) => acc + m.spendMinor, 0);
  }, [summaries]);

  const totalIncomeMinor = useMemo(() => {
    return Object.values(summaries).reduce((acc, m) => acc + m.incomeMinor, 0);
  }, [summaries]);

  // Baseline Monthly Spend
  const baselineMonthlySpend = useMemo(() => {
    const months = Object.keys(summaries);
    if (months.length === 0) return 5500;
    return Math.round(totalSpendMinor / months.length / 100);
  }, [summaries, totalSpendMinor]);

  // Category counts and totals for pills
  const categoryStats = useMemo(() => {
    const counts: Record<string, number> = { All: scopedTransactions.length };
    const spendMap: Record<string, number> = {};

    for (const t of scopedTransactions) {
      if (t.isSelfTransfer) {
        counts['Transfers'] = (counts['Transfers'] || 0) + 1;
        spendMap['Bank Transfer'] = (spendMap['Bank Transfer'] || 0) + t.amountMinorInr;
      } else {
        counts[t.category] = (counts[t.category] || 0) + 1;
        if (t.direction === 'debit') {
          spendMap[t.category] = (spendMap[t.category] || 0) + t.amountMinorInr;
        }
      }
    }

    const sortedSpend = Object.entries(spendMap).sort((a, b) => b[1] - a[1]);
    const topSpendCategory = sortedSpend[0] || ['Bank Transfer', 2225100];

    return { counts, topCategory: topSpendCategory[0], topSpendMinor: topSpendCategory[1] };
  }, [scopedTransactions]);

  // Internal transfers excluded count and total
  const selfTransfersStat = useMemo(() => {
    const selfTxns = scopedTransactions.filter((t) => t.isSelfTransfer);
    const sumPaise = selfTxns.reduce((sum, t) => sum + t.amountMinorInr, 0);
    return {
      count: selfTxns.length,
      formatted: formatINR(sumPaise),
    };
  }, [scopedTransactions]);

  // Chronological month keys for the spending pattern chart
  const chronologicalMonths = useMemo(() => {
    const keys = Object.keys(summaries).sort((a, b) => a.localeCompare(b));
    return keys.slice(-6); // Last 6 months matching screenshot
  }, [summaries]);

  // Grouped by IST Date for Feed
  const dateGroups = useMemo(() => {
    const sorted = [...feedTransactions].sort(
      (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime()
    );
    const groups: { dateKey: string; items: NormalizedTransaction[]; totalPaise: number }[] = [];
    let currentKey = '';
    let currentGroup: { dateKey: string; items: NormalizedTransaction[]; totalPaise: number } | null = null;

    for (const tx of sorted) {
      const key = formatISTDateKey(tx.occurredAt);
      if (key !== currentKey) {
        currentKey = key;
        currentGroup = { dateKey: key, items: [], totalPaise: 0 };
        groups.push(currentGroup);
      }
      currentGroup!.items.push(tx);
      if (!tx.isSelfTransfer && tx.direction === 'debit') {
        currentGroup!.totalPaise += tx.amountMinorInr;
      }
    }

    return groups;
  }, [feedTransactions]);

  // Average spend per transaction
  const avgSpendPaise = useMemo(() => {
    const debits = feedTransactions.filter((t) => !t.isSelfTransfer && t.direction === 'debit');
    if (debits.length === 0) return 0;
    const sum = debits.reduce((acc, t) => acc + t.amountMinorInr, 0);
    return Math.round(sum / debits.length);
  }, [feedTransactions]);

  // Handle Add Expense
  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountRupees = parseFloat(newAmount);
    if (!newMerchant.trim() || isNaN(amountRupees) || amountRupees <= 0) {
      alert('Please enter a valid merchant name and amount.');
      return;
    }

    const newTxn: NormalizedTransaction = {
      id: `manual_${Date.now()}`,
      accountId: newAccountId || accounts[0]?.id || 'acc_hdfc_01',
      direction: 'debit',
      status: 'POSTED',
      occurredAt: new Date().toISOString(),
      amountMinorInr: Math.round(amountRupees * 100),
      originalAmount: Math.round(amountRupees * 100),
      originalCurrency: 'INR',
      merchant: newMerchant.trim(),
      category: newCategory,
      isSelfTransfer: false,
      monthKey: formatISTDateKey(new Date().toISOString()).slice(0, 7),
      updatedAt: new Date().toISOString(),
      rawPayload: { source: 'MANUAL_ENTRY' },
    };

    const map = await TransactionStore.getTransactionMap();
    map[newTxn.id] = newTxn;
    await TransactionStore.saveTransactionMap(map);

    setTransactions((prev) => [newTxn, ...prev]);
    setShowAddExpense(false);
    setNewMerchant('');
    setNewAmount('');
  };

  const selectedAccountLabel = useMemo(() => {
    if (!selectedAccountId) return 'All accounts';
    const acc = accountMap.get(selectedAccountId);
    return acc ? `${acc.bank} ${acc.last4}` : 'All accounts';
  }, [selectedAccountId, accountMap]);

  return (
    <main className="app-shell">
      {/* ==================== TOP NAVIGATION HEADER ==================== */}
      <header className="nav-header">
        <button
          className="circle-btn"
          onClick={() => {
            if (view === 'transactions') setView('analytics');
            else setView('transactions');
          }}
          title={view === 'transactions' ? 'Back to Analytics' : 'Go to Transactions'}
        >
          <ArrowLeft size={18} />
        </button>

        <div className="header-title-wrap">
          <h1 className="header-title">
            {view === 'analytics' ? 'Spend Analytics' : 'Transactions'}
          </h1>
          {view === 'transactions' && (
            <p className="header-subtitle">
              {selectedAccountLabel} · {selectedYear === 'ALL' ? 'All Months' : selectedYear}
            </p>
          )}
        </div>

        <button
          className={`circle-btn ${view === 'transactions' ? 'filter-active' : ''}`}
          onClick={() => {
            if (view === 'analytics') setView('transactions');
            else loadCacheAndSync();
          }}
          title={view === 'analytics' ? 'Search transactions' : 'Refresh sync'}
        >
          {view === 'analytics' ? (
            <Search size={18} />
          ) : (
            <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
          )}
        </button>
      </header>

      {/* ==================== DROPDOWN FILTER ROW ==================== */}
      <div className="filter-row-pills">
        {/* Year Selector */}
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            className="filter-pill"
            onClick={() => {
              setShowYearDropdown(!showYearDropdown);
              setShowAccountDropdown(false);
            }}
          >
            <div className="filter-pill-left">
              <Calendar size={15} />
              <span>{selectedYear === 'ALL' ? 'All 13 Months' : `Year ${selectedYear}`}</span>
            </div>
            <ChevronDown size={14} />
          </button>

          {showYearDropdown && (
            <div className="dropdown-popover" style={{ left: 0 }}>
              {['2026', '2025', 'ALL'].map((yr) => (
                <button
                  key={yr}
                  className={`dropdown-item ${selectedYear === yr ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedYear(yr);
                    setShowYearDropdown(false);
                  }}
                >
                  <span>{yr === 'ALL' ? 'All 13 Months' : `Year ${yr}`}</span>
                  {selectedYear === yr && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Account Selector */}
        <div style={{ flex: 1, position: 'relative' }}>
          <button
            className="filter-pill"
            onClick={() => {
              setShowAccountDropdown(!showAccountDropdown);
              setShowYearDropdown(false);
            }}
          >
            <div className="filter-pill-left">
              <Building2 size={15} />
              <span>{selectedAccountLabel}</span>
            </div>
            <ChevronDown size={14} />
          </button>

          {showAccountDropdown && (
            <div className="dropdown-popover" style={{ right: 0 }}>
              <button
                className={`dropdown-item ${selectedAccountId === null ? 'active' : ''}`}
                onClick={() => {
                  setSelectedAccountId(null);
                  setShowAccountDropdown(false);
                }}
              >
                <span>All accounts</span>
                {selectedAccountId === null && <b>✓</b>}
              </button>
              {accounts.map((acc) => (
                <button
                  key={acc.id}
                  className={`dropdown-item ${selectedAccountId === acc.id ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedAccountId(acc.id);
                    setShowAccountDropdown(false);
                  }}
                >
                  <span>{acc.bank} ••{acc.last4}</span>
                  {selectedAccountId === acc.id && <b>✓</b>}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ==================== VIEW 1: SPEND ANALYTICS ==================== */}
      {view === 'analytics' ? (
        <>
          {/* Main Analytics Card */}
          <section className="card analytics-card">
            <div className="card-hero-split">
              <div className="card-hero-left">
                <div className="label-info">
                  <span>Total this year</span>
                  <Info size={13} />
                </div>
                <div className="hero-number">{formatINR(totalSpendMinor)}</div>
                <div>
                  <div className="tag-time">
                    <span className="dot" />
                    <span>
                      {syncProgress.status === 'syncing'
                        ? `Syncing (${syncProgress.loadedCount})...`
                        : `${transactions.length} synced`}
                    </span>
                  </div>
                </div>
                <div>
                  <span className="tag-diff">↑ 100% vs last year</span>
                </div>
              </div>

              <div className="card-hero-right">
                <div className="side-subhead">Last year</div>
                <div className="side-number">₹0</div>
                <div className="side-subhead">Change</div>
                <div className="side-number red">↑ {formatINR(totalSpendMinor)}</div>
              </div>
            </div>

            {/* Triad Metric Boxes */}
            <div className="triad-row">
              <div className="triad-cell">
                <div className="triad-icon-box red">
                  <TrendingUp size={15} />
                </div>
                <span className="metric-title">Highest increase</span>
                <b className="metric-value">—</b>
              </div>

              <div className="triad-cell">
                <div className="triad-icon-box gold">
                  <ShoppingBag size={15} />
                </div>
                <span className="metric-title">Highest spend</span>
                <b className="metric-value">{categoryStats.topCategory}</b>
                <small className="metric-sub">{formatINR(categoryStats.topSpendMinor)}</small>
              </div>

              <div className="triad-cell">
                <div className="triad-icon-box green">
                  <TrendingDown size={15} />
                </div>
                <span className="metric-title">Most controlled</span>
                <b className="metric-value">October</b>
                <small className="metric-sub">₹1,09,784</small>
              </div>
            </div>
          </section>

          {/* Action Buttons (+ Add expense | := Transactions) */}
          <div className="actions-row">
            <button className="btn-add-expense" onClick={() => setShowAddExpense(true)}>
              <Plus size={18} />
              <span>Add expense</span>
            </button>

            <button className="btn-view-txns" onClick={() => setView('transactions')}>
              <ListFilter size={17} />
              <span>Transactions</span>
            </button>
          </div>

          {/* Spending Pattern Section with Center Baseline Chart */}
          <section className="card pattern-card">
            <div className="pattern-top">
              <h2 className="pattern-title">Spending pattern</h2>
              <span className="badge-baseline">vs your usual ₹{(baselineMonthlySpend / 1000).toFixed(1)}K</span>
            </div>

            <p className="pattern-spent-label">Spent this year</p>
            <p className="pattern-spent-val">{formatINR(totalSpendMinor)}</p>

            {/* Center-Baseline Bipolar Chart */}
            <div className="bipolar-chart">
              <div className="baseline-rule" />
              {chronologicalMonths.map((mKey) => {
                const s = summaries[mKey];
                const spendRupees = s ? s.spendMinor / 100 : 0;
                const diff = spendRupees - baselineMonthlySpend;
                const isAbove = diff >= 0;
                const maxRange = 250000;
                const heightPct = Math.min(85, Math.max(16, (Math.abs(diff) / maxRange) * 85));
                const deltaTag = `${isAbove ? '+' : '-'}${Math.abs(Math.round(diff / 1000))}K`;

                return (
                  <div
                    className="bipolar-bar-col"
                    key={mKey}
                    onClick={() => setView('transactions')}
                    title={`${s?.label || mKey}: ₹${spendRupees.toLocaleString('en-IN')}`}
                  >
                    <div className="bar-half-top">
                      {isAbove && (
                        <>
                          <span className="bar-tag above">{deltaTag}</span>
                          <div className="bar-pill above" style={{ height: `${heightPct}%` }} />
                        </>
                      )}
                    </div>
                    <div className="bar-half-bottom">
                      {!isAbove && (
                        <>
                          <div className="bar-pill below" style={{ height: `${heightPct}%` }} />
                          <span className="bar-tag below">{deltaTag}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Months row */}
            <div className="chart-months-row">
              {chronologicalMonths.map((mKey) => {
                const [y, m] = mKey.split('-');
                const monthName = new Date(Date.UTC(Number(y), Number(m) - 1, 1)).toLocaleString('en-IN', {
                  month: 'short',
                  timeZone: 'UTC',
                });
                return (
                  <span
                    className={`month-label ${mKey.endsWith('10') ? 'active' : ''}`}
                    key={mKey}
                  >
                    {monthName}
                  </span>
                );
              })}
            </div>
          </section>

          {/* Smart Internal Transfer Banner */}
          <div className="transfer-banner">
            <div className="transfer-badge-icon">⇄</div>
            <div>
              <h4>Smart Transfer Exclusion</h4>
              <p>
                <b>{selfTransfersStat.count} internal account transfers</b> totaling{' '}
                <b>{selfTransfersStat.formatted}</b> between savings accounts and credit card bill
                payments were accurately detected and excluded from spending totals.
              </p>
            </div>
            <CircleHelp size={18} style={{ color: '#555d6e', flexShrink: 0 }} />
          </div>
        </>
      ) : (
        /* ==================== VIEW 2: TRANSACTIONS TAB ==================== */
        <>
          {/* Search Box */}
          <div className="search-container">
            <Search size={18} />
            <input
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search merchant, amount or note"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={16} />
              </button>
            )}
          </div>

          {/* Metrics Summary Bar (Total 2026 | Transactions | Avg / spend) */}
          <div className="txns-summary-bar">
            <div className="summary-col">
              <span className="sub">Total, {selectedYear === 'ALL' ? 'All' : selectedYear}</span>
              <b className="val">{formatINR(totalSpendMinor)}</b>
            </div>
            <div className="summary-col">
              <span className="sub">Transactions</span>
              <b className="val">{feedTransactions.length}</b>
            </div>
            <div className="summary-col">
              <span className="sub">Avg / spend</span>
              <b className="val">{formatINR(avgSpendPaise)}</b>
            </div>
          </div>

          {/* Horizontal Scrolling Category Pills */}
          <div className="categories-scroll-wrap">
            {['All', 'Transfers', 'FOOD', 'GROCERIES', 'SHOPPING', 'TRAVEL', 'BILLS'].map((cat) => {
              const count =
                cat === 'All'
                  ? scopedTransactions.length
                  : cat === 'Transfers'
                  ? categoryStats.counts['Transfers'] || 0
                  : categoryStats.counts[cat] || 0;
              const label = cat === 'Transfers' ? 'Bank Transfer' : cat === 'FOOD' ? 'Food & Dining' : cat;

              return (
                <button
                  key={cat}
                  className={`cat-pill ${selectedCategory === cat ? 'active' : ''}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  <span
                    className="cat-dot"
                    style={{ background: getCategoryDotColor(cat) }}
                  />
                  <span>{label}</span>
                  <span style={{ opacity: 0.7, fontSize: 11 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Date-Grouped Transaction Cards */}
          <div className="txns-feed-list">
            {dateGroups.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
                <p style={{ fontSize: 16, color: '#f1f5f9', fontWeight: 600 }}>No transactions found</p>
                <p style={{ fontSize: 13 }}>Try clearing search or changing filters.</p>
              </div>
            ) : (
              dateGroups.map((group) => (
                <div key={group.dateKey}>
                  <div className="date-section-header">
                    <span className="date-section-title">
                      {formatISTDayHeader(group.dateKey)}
                    </span>
                    <span className="date-section-sum">
                      {group.totalPaise > 0 ? formatINR(group.totalPaise) : ''}
                    </span>
                  </div>

                  {group.items.map((tx) => {
                    const avatar = getMerchantAvatar(tx.merchant, tx.isSelfTransfer);
                    const isDebit = tx.direction === 'debit';
                    const isSelf = tx.isSelfTransfer;
                    const acc = accountMap.get(tx.accountId);
                    const bankBadge = acc ? `▲ ${acc.bank} ${acc.last4}` : '▲ Bank';

                    return (
                      <button
                        className="transaction-card"
                        key={tx.id}
                        onClick={() => setSelectedTxn(tx)}
                      >
                        <div className="txn-left-wrap">
                          <div className="brand-avatar" style={{ background: avatar.bg }}>
                            {avatar.letter}
                          </div>
                          <div className="txn-meta">
                            <b className="title">{tx.merchant}</b>
                            <span className="category-line">
                              <span
                                className="dot-indicator"
                                style={{ background: getCategoryDotColor(tx.category) }}
                              />
                              <span>{isSelf ? 'Bank Transfer' : tx.category}</span>
                            </span>
                          </div>
                        </div>

                        <div className="txn-right-wrap">
                          <div className="txn-amount">
                            {isSelf ? '' : isDebit ? '' : '+'}
                            {formatINR(tx.amountMinorInr)}
                          </div>
                          <span className="bank-tag">{bankBadge}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* ==================== TRANSACTION DETAIL SHEET MODAL ==================== */}
      {selectedTxn && (
        <div className="modal-overlay" onClick={() => setSelectedTxn(null)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-drag-handle" />
            <div className="sheet-head">
              <span>Transaction Details</span>
              <button onClick={() => setSelectedTxn(null)}>
                <X size={20} />
              </button>
            </div>

            <div className="sheet-hero">
              {(() => {
                const av = getMerchantAvatar(selectedTxn.merchant, selectedTxn.isSelfTransfer);
                return (
                  <div
                    className="brand-avatar"
                    style={{ background: av.bg, width: 48, height: 48, fontSize: 18 }}
                  >
                    {av.letter}
                  </div>
                );
              })()}
              <div>
                <h3>{selectedTxn.merchant}</h3>
                <p>
                  {selectedTxn.category} ·{' '}
                  {accountMap.get(selectedTxn.accountId)?.bank || selectedTxn.accountId}
                </p>
              </div>
            </div>

            <div className="sheet-amount">
              {selectedTxn.isSelfTransfer ? '' : selectedTxn.direction === 'debit' ? '-' : '+'}
              {formatINR(selectedTxn.amountMinorInr)}
            </div>

            <div className="sheet-row-table">
              <div className="sheet-row">
                <span>Date &amp; Time (IST)</span>
                <b>{formatISTDateTime(selectedTxn.occurredAt)}</b>
              </div>
              <div className="sheet-row">
                <span>Account</span>
                <b>{accountMap.get(selectedTxn.accountId)?.nickname || selectedTxn.accountId}</b>
              </div>
              <div className="sheet-row">
                <span>Direction</span>
                <b style={{ textTransform: 'capitalize' }}>{selectedTxn.direction}</b>
              </div>
              <div className="sheet-row">
                <span>Status</span>
                <b style={{ color: '#10b981' }}>{selectedTxn.status}</b>
              </div>
              <div className="sheet-row">
                <span>Self Transfer</span>
                <b style={{ color: selectedTxn.isSelfTransfer ? '#f59e0b' : '#94a3b8' }}>
                  {selectedTxn.isSelfTransfer ? 'Yes (Excluded from spend)' : 'No'}
                </b>
              </div>
            </div>

            <details className="raw-json-details">
              <summary>View raw banking payload</summary>
              <pre>{JSON.stringify(selectedTxn.rawPayload, null, 2)}</pre>
            </details>
          </div>
        </div>
      )}

      {/* ==================== ADD EXPENSE MODAL ==================== */}
      {showAddExpense && (
        <div className="modal-overlay" onClick={() => setShowAddExpense(false)}>
          <div className="bottom-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-drag-handle" />
            <div className="sheet-head">
              <span>Record New Expense</span>
              <button onClick={() => setShowAddExpense(false)}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateExpense}>
              <div className="form-group">
                <label>Merchant / Beneficiary Name</label>
                <input
                  className="form-input"
                  placeholder="e.g. Swiggy, Uber, Chai Point"
                  value={newMerchant}
                  onChange={(e) => setNewMerchant(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Amount in INR (₹)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.01"
                  placeholder="e.g. 250.00"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  required
                />
              </div>

              <div className="form-group">
                <label>Category</label>
                <select
                  className="form-input"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="FOOD">Food &amp; Dining</option>
                  <option value="GROCERIES">Groceries</option>
                  <option value="SHOPPING">Shopping</option>
                  <option value="TRAVEL">Travel / Rides</option>
                  <option value="BILLS">Bills &amp; Utilities</option>
                  <option value="ENTERTAINMENT">Entertainment</option>
                </select>
              </div>

              <div className="form-group">
                <label>Account</label>
                <select
                  className="form-input"
                  value={newAccountId}
                  onChange={(e) => setNewAccountId(e.target.value)}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.bank} ••{a.last4} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <button type="submit" className="btn-submit-expense">
                Save Expense
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
};
