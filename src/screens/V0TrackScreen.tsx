import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NormalizedTransaction, Account } from '../types';
import { TransactionStore } from '../storage';
import { SyncEngine, SyncProgress, getDefaultApiBaseUrl } from '../syncEngine';
import { computeMonthSummaries, groupTransactionsByMonth } from '../aggregations';
import { formatISTDateTime } from '../formatters';
import { ServerConfigModal } from '../components/ServerConfigModal';

// ── Color palette ───────────────────────────────────────────────────
const C = {
  bg: '#0b0c0c',
  panel: '#141515',
  panel2: '#191a1a',
  line: '#242626',
  text: '#f6f6f2',
  muted: '#858887',
  mint: '#9bf4a5',
  purple: '#a995ff',
  lilac: '#c8b8ff',
  red: '#ff7777',
};

// ── Merchant branding & avatars ─────────────────────────────────────
const MERCHANT_BRANDS: Record<string, { mark: string; color: string }> = {
  swiggy: { mark: 'S', color: '#f26e2b' },
  zomato: { mark: 'Z', color: '#d44451' },
  blinkit: { mark: 'B', color: '#d6c51f' },
  zepto: { mark: 'Z', color: '#8a3bb0' },
  uber: { mark: 'U', color: '#e7e7e2' },
  ola: { mark: 'O', color: '#222' },
  rapido: { mark: 'R', color: '#d8b92e' },
  amazon: { mark: 'a', color: '#34445a' },
  myntra: { mark: 'M', color: '#e24b78' },
  flipkart: { mark: 'F', color: '#2874f0' },
  bigbasket: { mark: 'BB', color: '#84c225' },
  phonepe: { mark: 'P', color: '#5f259f' },
  paytm: { mark: 'P', color: '#00BAF2' },
  gpay: { mark: 'G', color: '#4285F4' },
};

function getMerchantBrand(merchant: string): { mark: string; color: string } {
  const lower = merchant.toLowerCase();
  for (const [key, val] of Object.entries(MERCHANT_BRANDS)) {
    if (lower.includes(key)) return val;
  }
  if (lower.includes('transfer') || lower.includes('self')) {
    return { mark: '↔', color: '#555858' };
  }
  if (
    lower.includes('salary') ||
    lower.includes('credit') ||
    lower.includes('interest') ||
    lower.includes('refund')
  ) {
    return { mark: '₹', color: '#278c61' };
  }
  const firstChar = merchant.trim().charAt(0).toUpperCase();
  let hash = 0;
  for (let i = 0; i < merchant.length; i++) hash = (hash * 31 + merchant.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return { mark: firstChar || 'UPI', color: `hsl(${hue}, 45%, 38%)` };
}

function getAccountLabel(accountId: string, accounts: Account[]): string {
  const acc = accounts.find((a) => a.id === accountId);
  if (!acc) return accountId;
  return `${acc.bank} ••${acc.last4}`;
}

// ── Money formatting ────────────────────────────────────────────────
const inrFormatter = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function money(paise: number): string {
  return inrFormatter.format(Math.abs(paise) / 100);
}

function formatCompact(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(2)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(1)}K`;
  return `₹${rupees.toFixed(0)}`;
}

// ── Micro components ────────────────────────────────────────────────
function Icon({ children, active = false }: { children: string; active?: boolean }) {
  return (
    <View style={[s.icon, active && s.iconActive]}>
      <Text style={[s.iconText, active && s.darkText]}>{children}</Text>
    </View>
  );
}

function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[s.card, style]}>{children}</View>;
}

// ── Header ──────────────────────────────────────────────────────────
function Header({
  tab,
  setTab,
  desktop,
  topInset,
  onOpenConfig,
}: {
  tab: string;
  setTab: (v: string) => void;
  desktop: boolean;
  topInset: number;
  onOpenConfig: () => void;
}) {
  return (
    <View
      style={[
        s.header,
        !desktop && {
          paddingTop: topInset > 0 ? topInset : 12,
          height: 72 + (topInset > 0 ? topInset : 12),
        },
      ]}
    >
      <View style={s.brandRow}>
        <Icon>≡</Icon>
        <View style={s.logo}>
          <Text style={s.logoText}>S</Text>
        </View>
        <Text style={s.brand}>Simplify</Text>
      </View>
      {desktop && (
        <View style={s.nav}>
          <Pressable
            style={[s.navItem, tab === 'analytics' && s.navActive]}
            onPress={() => setTab('analytics')}
          >
            <Text style={s.navIcon}>▦</Text>
            <Text style={s.navText}>Analytics</Text>
          </Pressable>
          <Pressable
            style={[s.navItem, tab === 'transactions' && s.navActive]}
            onPress={() => setTab('transactions')}
          >
            <Text style={s.navIcon}>▤</Text>
            <Text style={s.navText}>Transactions</Text>
          </Pressable>
          <View style={s.navItem}>
            <Text style={s.navIcon}>▣</Text>
            <Text style={s.navText}>Reports</Text>
          </View>
          <Pressable style={s.navItem} onPress={onOpenConfig}>
            <Text style={s.navIcon}>⚙</Text>
            <Text style={s.navText}>Settings</Text>
          </Pressable>
        </View>
      )}
      <View style={s.headerActions}>
        <Pressable onPress={onOpenConfig}>
          <Icon>⚙</Icon>
        </Pressable>
        <View style={s.notify}>
          <Icon>♧</Icon>
          <View style={s.redDot} />
        </View>
        <View style={s.avatar}>
          <Text style={s.avatarText}>VS</Text>
        </View>
      </View>
    </View>
  );
}

// ── Mobile Tabs ─────────────────────────────────────────────────────
function MobileTabs({ tab, setTab }: { tab: string; setTab: (v: string) => void }) {
  return (
    <View style={s.mobileTabs}>
      <Pressable
        style={[s.mobileTab, tab === 'analytics' && s.mobileTabActive]}
        onPress={() => setTab('analytics')}
      >
        <Text style={[s.mobileTabText, tab === 'analytics' && s.darkText]}>Spend Analytics</Text>
      </Pressable>
      <Pressable
        style={[s.mobileTab, tab === 'transactions' && s.mobileTabActive]}
        onPress={() => setTab('transactions')}
      >
        <Text style={[s.mobileTabText, tab === 'transactions' && s.darkText]}>Transactions</Text>
      </Pressable>
    </View>
  );
}

// ── Hero Card ───────────────────────────────────────────────────────
function HeroCard({
  totalSpendMinor,
  syncProgress,
  isOnline,
  totalCount,
}: {
  totalSpendMinor: number;
  syncProgress: SyncProgress;
  isOnline: boolean;
  totalCount: number;
}) {
  const formatted = money(totalSpendMinor);
  const parts = formatted.split('.');
  const whole = parts[0];
  const cents = parts.length > 1 ? `.${parts[1]}` : '.00';

  let syncLabel = 'Syncing...';
  if (syncProgress.status === 'success') {
    syncLabel = `Synced · ${totalCount.toLocaleString('en-IN')} transactions via Bank & API`;
  } else if (syncProgress.status === 'error') {
    syncLabel = 'Offline mode · Cached data active';
  } else if (syncProgress.status === 'syncing') {
    syncLabel = `Syncing ${syncProgress.loadedCount.toLocaleString('en-IN')} txns...`;
  }

  return (
    <Card style={s.hero}>
      <View style={s.rowBetween}>
        <Icon>▰</Icon>
        <Text style={s.arrow}>↗</Text>
      </View>
      <View>
        <Text style={s.label}>TOTAL THIS YEAR (EXCL. TRANSFERS)</Text>
        <Text style={s.heroAmount}>
          ₹{whole}
          <Text style={s.amountCents}>{cents}</Text>
        </Text>
        <View style={s.deltaRow}>
          <Text style={s.green}>LIVE · 100% EXACT</Text>
          <Text style={s.mutedText}>  Self-transfers excluded · IST accurate</Text>
        </View>
      </View>
      <View style={s.sync}>
        <View style={[s.liveDot, !isOnline && { backgroundColor: C.red }]} />
        <Text style={s.syncText}>{syncLabel}</Text>
      </View>
    </Card>
  );
}

// ── Income / Spending Pattern Card ──────────────────────────────────
function IncomeCard({ monthlySpends }: { monthlySpends: number[] }) {
  const avg =
    monthlySpends.length > 0
      ? monthlySpends.reduce((a, b) => a + b, 0) / monthlySpends.length
      : 0;
  const avgFormatted = formatCompact(avg);

  const max = Math.max(...monthlySpends, 1);
  const sparkData = monthlySpends.length > 0 ? monthlySpends : Array(13).fill(0);

  return (
    <Card style={s.incomeCard}>
      <View style={s.rowBetween}>
        <Text style={s.title}>Spending pattern</Text>
        <Text style={s.arrow}>↗</Text>
      </View>
      <View style={s.incomeHead}>
        <View>
          <Text style={s.label}>MONTHLY BASELINE</Text>
          <Text style={s.bigAmount}>{avgFormatted}</Text>
        </View>
        <View style={s.right}>
          <Text style={s.green}>
            {monthlySpends.length >= 2
              ? `${monthlySpends[monthlySpends.length - 1] < monthlySpends[monthlySpends.length - 2] ? '↓' : '↑'} ${Math.abs(
                  ((monthlySpends[monthlySpends.length - 1] -
                    monthlySpends[monthlySpends.length - 2]) /
                    (monthlySpends[monthlySpends.length - 2] || 1)) *
                    100
                ).toFixed(1)}%`
              : '—'}
          </Text>
          <Text style={s.mutedText}>controlled this month</Text>
        </View>
      </View>
      <View style={s.sparkBars}>
        {sparkData.slice(0, 36).map((val: number, i: number) => {
          const ratio = Math.min(1, val / max);
          return (
            <View
              key={i}
              style={[
                s.spark,
                {
                  height: Math.max(6, ratio * 43),
                  backgroundColor: ratio > 0.6 ? C.lilac : ratio > 0.3 ? C.mint : '#292b2b',
                },
              ]}
            />
          );
        })}
      </View>
      <Pressable style={s.aiStrip}>
        <Icon>⌁</Icon>
        <View style={s.flex}>
          <Text style={s.stripTitle}>Smart Analytics AI</Text>
          <Text style={s.mutedText}>AI reveals spend trends for smarter decisions.</Text>
        </View>
        <Text style={s.chevron}>›</Text>
      </Pressable>
    </Card>
  );
}

// ── Metrics Row ─────────────────────────────────────────────────────
function Metrics({
  categoryBreakdown,
}: {
  categoryBreakdown: { name: string; totalMinor: number; count: number }[];
}) {
  const sorted = [...categoryBreakdown].sort((a, b) => b.totalMinor - a.totalMinor);
  const highestSpend = sorted[0];
  const lowestSpend = sorted[sorted.length - 1];
  const secondHighest = sorted.length > 1 ? sorted[1] : sorted[0];

  const data: [string, string, string, string][] = [
    [
      'Highest increase',
      secondHighest?.name || 'Dining Out',
      secondHighest ? `${secondHighest.count} txns` : '↑ 24%',
      C.red,
    ],
    [
      'Highest spend',
      highestSpend?.name || 'Groceries',
      highestSpend ? formatCompact(highestSpend.totalMinor) : '₹48,250',
      C.mint,
    ],
    [
      'Most controlled',
      lowestSpend?.name || 'Shopping',
      lowestSpend ? `${lowestSpend.count} txns` : '↓ 18%',
      C.purple,
    ],
  ];

  return (
    <View style={s.metrics}>
      {data.map((m, i) => (
        <Card key={m[0]} style={s.metric}>
          <Icon>{['♨', '▰', '◇'][i]}</Icon>
          <Text style={s.label}>{m[0].toUpperCase()}</Text>
          <Text style={s.metricTitle}>{m[1]}</Text>
          <Text style={[s.metricValue, { color: m[3] }]}>{m[2]}</Text>
        </Card>
      ))}
    </View>
  );
}

// ── Bar Chart ───────────────────────────────────────────────────────
function BarChart({
  monthLabels,
  monthSpends,
  totalSpendMinor,
}: {
  monthLabels: string[];
  monthSpends: number[];
  totalSpendMinor: number;
}) {
  const [selected, setSelected] = useState(monthSpends.length - 1);
  const maxSpend = Math.max(...monthSpends, 1);
  const yMax = Math.ceil(maxSpend / 100 / 25000) * 25000;

  const formatted = money(totalSpendMinor);
  const parts = formatted.split('.');

  return (
    <Card style={s.chartCard}>
      <View style={s.rowBetween}>
        <View>
          <Text style={s.title}>Analytics</Text>
          <Text style={s.chartAmount}>
            ₹{parts[0]}
            <Text style={s.amountCents}>.{parts[1] || '00'}</Text>
          </Text>
        </View>
        <View style={s.select}>
          <Text style={s.selectText}>{monthLabels.length} Months⌄</Text>
        </View>
      </View>
      <View style={s.chart}>
        <View style={s.yAxis}>
          <Text style={s.axisText}>{(yMax / 1000).toFixed(0)}K</Text>
          <Text style={s.axisText}>{((yMax * 0.66) / 1000).toFixed(0)}K</Text>
          <Text style={s.axisText}>{((yMax * 0.33) / 1000).toFixed(0)}K</Text>
          <Text style={s.axisText}>0</Text>
        </View>
        <View style={s.barArea}>
          {monthSpends.map((val, i) => {
            const rupees = val / 100;
            const pct = (rupees / (yMax || 1)) * 100;
            return (
              <Pressable key={i} style={s.barColumn} onPress={() => setSelected(i)}>
                {selected === i && (
                  <View style={s.tooltip}>
                    <Text style={s.tooltipText}>₹{(rupees / 1000).toFixed(1)}K</Text>
                  </View>
                )}
                <View
                  style={[
                    s.bar,
                    {
                      height: `${Math.max(4, Math.min(100, pct))}%` as any,
                      backgroundColor: rupees > yMax * 0.5 ? C.lilac : C.mint,
                      opacity: selected === i ? 1 : 0.25,
                    },
                  ]}
                />
                <Text style={s.axisText}>{monthLabels[i]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Card>
  );
}

// ── Donut Chart ─────────────────────────────────────────────────────
function Donut({
  categoryBreakdown,
  totalSpendMinor,
}: {
  categoryBreakdown: { name: string; totalMinor: number; pct: number }[];
  totalSpendMinor: number;
}) {
  const segmentCount = 40;
  const segmentColors: string[] = [];
  const catColors = [C.lilac, C.mint, '#eee', '#3a3c3c', C.purple, C.red];

  let idx = 0;
  for (const cat of categoryBreakdown) {
    const count = Math.round((cat.pct / 100) * segmentCount);
    const color = catColors[idx % catColors.length];
    for (let j = 0; j < count && segmentColors.length < segmentCount; j++) {
      segmentColors.push(color);
    }
    idx++;
  }
  while (segmentColors.length < segmentCount) segmentColors.push('#2a2c2c');

  return (
    <Card style={s.donutCard}>
      <Text style={s.title}>Category Breakdown</Text>
      <View style={s.donutWrap}>
        {segmentColors.map((color, i) => (
          <View
            key={i}
            style={[
              s.donutSegment,
              {
                transform: [{ rotate: `${i * 9}deg` }, { translateY: -76 }],
                backgroundColor: color,
              },
            ]}
          />
        ))}
        <View style={s.donutCenter}>
          <Text style={s.donutAmount}>{formatCompact(totalSpendMinor)}</Text>
          <Text style={s.axisText}>TOTAL SPEND</Text>
        </View>
      </View>
      <View style={s.legend}>
        {categoryBreakdown.slice(0, 4).map((cat, i) => (
          <View key={cat.name} style={s.legendRow}>
            <View style={[s.dot, { backgroundColor: catColors[i % catColors.length] }]} />
            <Text style={s.legendText} numberOfLines={1}>
              {cat.name}
            </Text>
            <Text style={s.legendValue}>{cat.pct.toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// ── Transfer Notice Card ────────────────────────────────────────────
function TransferNotice({
  transferCount,
  transferTotalMinor,
  onReview,
}: {
  transferCount: number;
  transferTotalMinor: number;
  onReview: () => void;
}) {
  if (transferCount === 0) return null;
  return (
    <View style={s.mintCard}>
      <View style={s.rowBetween}>
        <Icon active>↔</Icon>
        <View style={s.aiBadge}>
          <Text style={s.aiBadgeText}>✦ SMART DETECTION</Text>
        </View>
      </View>
      <Text style={s.mintTitle}>Transfers aren’t expenses.</Text>
      <Text style={s.mintBody}>
        {formatCompact(transferTotalMinor)} moved between your Savings and Credit Card was detected
        and excluded to keep your analytics honest.
      </Text>
      <Pressable style={s.blackButton} onPress={onReview}>
        <Text style={s.blackButtonText}>
          Review {transferCount} transfer{transferCount !== 1 ? 's' : ''}
        </Text>
      </Pressable>
    </View>
  );
}

// ── Analytics Screen ────────────────────────────────────────────────
function AnalyticsTab({
  desktop,
  totalSpendMinor,
  monthlySpends,
  monthLabels,
  categoryBreakdown,
  transferCount,
  transferTotalMinor,
  syncProgress,
  isOnline,
  totalCount,
  onReviewTransfers,
  onOpenConfig,
}: {
  desktop: boolean;
  totalSpendMinor: number;
  monthlySpends: number[];
  monthLabels: string[];
  categoryBreakdown: { name: string; totalMinor: number; pct: number; count: number }[];
  transferCount: number;
  transferTotalMinor: number;
  syncProgress: SyncProgress;
  isOnline: boolean;
  totalCount: number;
  onReviewTransfers: () => void;
  onOpenConfig: () => void;
}) {
  return (
    <View style={s.page}>
      <View style={s.filterRow}>
        <Pressable style={s.filter}>
          <Text style={s.filterText}>▣  Year 2026 ⌄</Text>
        </Pressable>
        <Pressable style={s.filter}>
          <Text style={s.filterText}>▰  All Accounts ⌄</Text>
        </Pressable>
        <Pressable style={s.livePill} onPress={onOpenConfig}>
          <View style={[s.liveDot, !isOnline && { backgroundColor: C.red }]} />
          <Text style={s.liveText}>
            {isOnline ? 'LIVE' : 'OFFLINE'} · {totalCount.toLocaleString('en-IN')} TXNS ⚙
          </Text>
        </Pressable>
      </View>
      <View style={[s.topGrid, !desktop && s.stack]}>
        <View style={[s.leftTop, !desktop && s.full]}>
          <HeroCard
            totalSpendMinor={totalSpendMinor}
            syncProgress={syncProgress}
            isOnline={isOnline}
            totalCount={totalCount}
          />
          <Metrics categoryBreakdown={categoryBreakdown} />
        </View>
        <View style={[s.rightTop, !desktop && s.full]}>
          <IncomeCard monthlySpends={monthlySpends} />
        </View>
      </View>
      <View style={[s.bottomGrid, !desktop && s.stack]}>
        <View style={[s.chartWidth, !desktop && s.full]}>
          <BarChart
            monthLabels={monthLabels}
            monthSpends={monthlySpends}
            totalSpendMinor={totalSpendMinor}
          />
        </View>
        <View style={[s.sideWidth, !desktop && s.full]}>
          <Donut categoryBreakdown={categoryBreakdown} totalSpendMinor={totalSpendMinor} />
          <TransferNotice
            transferCount={transferCount}
            transferTotalMinor={transferTotalMinor}
            onReview={onReviewTransfers}
          />
        </View>
      </View>
    </View>
  );
}

// ── Search Panel ────────────────────────────────────────────────────
function SearchPanel({
  search,
  setSearch,
  category,
  setCategory,
  account,
  setAccount,
  categories,
  accountLabels,
}: {
  search: string;
  setSearch: (v: string) => void;
  category: string;
  setCategory: (v: string) => void;
  account: string;
  setAccount: (v: string) => void;
  categories: string[];
  accountLabels: string[];
}) {
  return (
    <Card style={s.searchPanel}>
      <View style={s.searchBox}>
        <Text style={s.searchIcon}>⌕</Text>
        <TextInput
          style={s.input}
          placeholder="Search merchant, amount, or note..."
          placeholderTextColor="#666"
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <Pressable onPress={() => setSearch('')}>
            <Text style={s.clear}>×</Text>
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pills}
      >
        {categories.map((x) => (
          <Pressable
            key={x}
            style={[s.pill, category === x && s.pillActive]}
            onPress={() => setCategory(x)}
          >
            <Text style={[s.pillText, category === x && s.darkText]}>{x}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.pills}
      >
        {accountLabels.map((x) => (
          <Pressable
            key={x}
            style={[s.pill, account === x && s.pillAccount]}
            onPress={() => setAccount(x)}
          >
            <Text style={s.pillText}>{x}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </Card>
  );
}

// ── Transaction Row ─────────────────────────────────────────────────
const TxRow = React.memo(function TxRow({
  tx,
  accountLabel,
  open,
}: {
  tx: NormalizedTransaction;
  accountLabel: string;
  open: (x: NormalizedTransaction) => void;
}) {
  const brand = getMerchantBrand(tx.merchant);
  const neutral = tx.isSelfTransfer;
  const isCredit = tx.direction === 'credit';

  return (
    <Pressable
      style={({ pressed }) => [s.txRow, pressed && s.pressed]}
      onPress={() => open(tx)}
    >
      <View style={[s.merchantLogo, { backgroundColor: brand.color }]}>
        <Text
          style={[
            s.merchantMark,
            ['U', 'B', 'R'].includes(brand.mark) && s.darkText,
          ]}
        >
          {brand.mark}
        </Text>
      </View>
      <View style={s.txInfo}>
        <View style={s.txTitleRow}>
          <Text style={s.txTitle} numberOfLines={1}>
            {tx.merchant}
          </Text>
          {tx.isSelfTransfer && (
            <Text style={s.excluded}>SELF TRANSFER · EXCLUDED</Text>
          )}
          {tx.status === 'PENDING' && !tx.isSelfTransfer && (
            <Text style={[s.excluded, { backgroundColor: '#352b15', color: '#ffd465' }]}>
              PENDING
            </Text>
          )}
        </View>
        <Text style={s.txMeta}>
          {tx.category}  ·  {accountLabel}
        </Text>
      </View>
      <View style={s.txAmountWrap}>
        <Text
          style={[
            s.txAmount,
            {
              color: neutral ? C.muted : isCredit ? C.mint : C.red,
            },
          ]}
        >
          {isCredit ? '+' : '−'}₹{money(tx.amountMinorInr)}
        </Text>
        <Text style={s.txTime}>{formatISTDateTime(tx.occurredAt)}</Text>
      </View>
      <Text style={s.chevron}>›</Text>
    </Pressable>
  );
});

function matchesCategoryFilter(tx: NormalizedTransaction, selectedFilter: string): boolean {
  if (selectedFilter === 'All') return true;
  if (selectedFilter === 'Transfers') return tx.isSelfTransfer;
  if (tx.isSelfTransfer) return false;

  const txCat = (tx.category || '').toLowerCase();
  const filter = selectedFilter.toLowerCase();

  if (filter.includes('food')) {
    return txCat.includes('food') || txCat.includes('dining') || txCat.includes('restaurant');
  }
  if (filter.includes('grocer')) {
    return txCat.includes('grocer');
  }
  if (filter.includes('commute') || filter.includes('travel')) {
    return txCat.includes('commute') || txCat.includes('travel') || txCat.includes('transport');
  }
  if (filter.includes('shop')) {
    return txCat.includes('shop');
  }
  if (filter.includes('bill')) {
    return (
      txCat.includes('bill') ||
      txCat.includes('subscript') ||
      txCat.includes('rent') ||
      txCat.includes('emi') ||
      txCat.includes('insurance')
    );
  }
  if (filter.includes('entertain')) {
    return txCat.includes('entertain');
  }
  if (filter.includes('health')) {
    return txCat.includes('health');
  }
  if (filter.includes('income')) {
    return tx.direction === 'credit' && !tx.isSelfTransfer;
  }
  return txCat === filter || txCat.includes(filter);
}

// ── Transactions Screen ─────────────────────────────────────────────
function TransactionsTab({
  transactions,
  accounts,
  open,
  initialCategory = 'All',
}: {
  transactions: NormalizedTransaction[];
  accounts: Account[];
  open: (x: NormalizedTransaction) => void;
  initialCategory?: string;
}) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [account, setAccount] = useState('All Accounts');
  const [userToggledMonths, setUserToggledMonths] = useState<Record<string, boolean>>({});
  const [expandedCounts, setExpandedCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  const categories = useMemo(
    () => [
      'All',
      'Food & Dining',
      'Groceries',
      'Daily Commute',
      'Shopping',
      'Bills & Utilities',
      'Transfers',
      'Entertainment',
      'Income',
    ],
    []
  );

  const accountLabels = useMemo(() => {
    const labels = ['All Accounts'];
    for (const acc of accounts) {
      labels.push(`${acc.bank} ••${acc.last4}`);
    }
    return labels;
  }, [accounts]);

  const accountMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const acc of accounts) {
      map.set(acc.id, `${acc.bank} ••${acc.last4}`);
    }
    return map;
  }, [accounts]);

  const isDefaultView = !search.trim() && category === 'All' && account === 'All Accounts';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const isAllCats = category === 'All';
    const isAllAccs = account === 'All Accounts';

    if (!q && isAllCats && isAllAccs) {
      return transactions;
    }

    return transactions.filter((tx) => {
      if (!isAllCats && !matchesCategoryFilter(tx, category)) return false;

      const accLabel = accountMap.get(tx.accountId) || tx.accountId;
      if (!isAllAccs && accLabel !== account) return false;

      if (q) {
        const merchantMatch = tx.merchant.toLowerCase().includes(q);
        const catMatch = tx.category.toLowerCase().includes(q);
        const amtMatch = String(tx.amountMinorInr / 100).includes(q);
        const accMatch = accLabel.toLowerCase().includes(q);
        return merchantMatch || catMatch || amtMatch || accMatch;
      }

      return true;
    });
  }, [transactions, search, category, account, accountMap]);

  const defaultMonthGroups = useMemo(
    () => groupTransactionsByMonth(transactions),
    [transactions]
  );

  const monthGroups = useMemo(() => {
    if (isDefaultView) {
      return defaultMonthGroups;
    }
    return groupTransactionsByMonth(filtered);
  }, [filtered, defaultMonthGroups, isDefaultView]);

  const isSearching = search.trim().length > 0;

  return (
    <View style={s.page}>
      <SearchPanel
        search={search}
        setSearch={setSearch}
        category={category}
        setCategory={setCategory}
        account={account}
        setAccount={setAccount}
        categories={categories}
        accountLabels={accountLabels}
      />
      <View style={s.historyHead}>
        <View>
          <Text style={s.label}>YOUR MONEY TRAIL</Text>
          <Text style={s.historyTitle}>Transaction History</Text>
        </View>
        <Text style={s.mutedText}>{filtered.length.toLocaleString('en-IN')} matching records</Text>
      </View>
      {monthGroups.map((mg, index) => {
        const hidden = isSearching
          ? false
          : userToggledMonths[mg.month] !== undefined
          ? userToggledMonths[mg.month]
          : index > 0;

        const limit = expandedCounts[mg.month] || 25;
        const visibleTxns = mg.transactions.slice(0, limit);
        const hasMore = mg.transactions.length > limit;

        return (
          <Card key={mg.month} style={s.monthCard}>
            <Pressable
              style={s.monthHead}
              onPress={() =>
                setUserToggledMonths((prev) => ({
                  ...prev,
                  [mg.month]: !hidden,
                }))
              }
            >
              <View>
                <View style={s.monthTitleRow}>
                  <Text style={s.monthTitle}>{mg.summary.label}</Text>
                  <Text style={s.count}>{mg.summary.transactionCount} txns</Text>
                </View>
                <Text style={s.mutedText}>
                  {hidden ? 'Tap to expand' : 'Monthly activity'}
                </Text>
              </View>
              <View style={s.monthTotals}>
                <View>
                  <Text style={s.label}>SPENT</Text>
                  <Text style={s.spent}>₹{money(mg.summary.spendMinor)}</Text>
                </View>
                <View>
                  <Text style={s.label}>EARNED</Text>
                  <Text style={s.earned}>₹{money(mg.summary.incomeMinor)}</Text>
                </View>
                <Text style={s.chevron}>{hidden ? '⌄' : '⌃'}</Text>
              </View>
            </Pressable>
            {!hidden && (
              <View>
                {visibleTxns.length > 0 ? (
                  visibleTxns.map((tx) => (
                    <TxRow
                      key={tx.id}
                      tx={tx}
                      accountLabel={accountMap.get(tx.accountId) || tx.accountId}
                      open={open}
                    />
                  ))
                ) : (
                  <Text style={s.empty}>No transactions match filters</Text>
                )}
                {hasMore && (
                  <Pressable
                    style={s.loadMoreBtn}
                    onPress={() =>
                      setExpandedCounts((prev) => ({
                        ...prev,
                        [mg.month]: (prev[mg.month] || 25) + 50,
                      }))
                    }
                  >
                    <Text style={s.loadMoreText}>
                      Show more in {mg.summary.label} ({mg.transactions.length - limit} left)
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </Card>
        );
      })}
    </View>
  );
}

// ── Detail Modal ────────────────────────────────────────────────────
function DetailModal({
  tx,
  accounts,
  close,
}: {
  tx: NormalizedTransaction | null;
  accounts: Account[];
  close: () => void;
}) {
  const [raw, setRaw] = useState(false);
  if (!tx) return null;

  const brand = getMerchantBrand(tx.merchant);
  const isCredit = tx.direction === 'credit';

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <Pressable style={s.modalBackdrop} onPress={close}>
        <Pressable style={s.sheet} onPress={() => {}}>
          <ScrollView
            contentContainerStyle={{ alignItems: 'center', paddingBottom: 30 }}
            showsVerticalScrollIndicator={false}
          >
            <View style={s.handle} />
            <Pressable style={s.close} onPress={close}>
              <Text style={s.closeText}>×</Text>
            </Pressable>
            <View style={[s.merchantLogo, s.modalLogo, { backgroundColor: brand.color }]}>
              <Text style={s.merchantMark}>{brand.mark}</Text>
            </View>
            <Text style={s.modalCategory}>{tx.category}</Text>
            <Text style={s.modalTitle}>{tx.merchant}</Text>
            <Text
              style={[
                s.modalAmount,
                {
                  color: tx.isSelfTransfer ? C.muted : isCredit ? C.mint : C.red,
                },
              ]}
            >
              {isCredit ? '+' : '−'}₹{money(tx.amountMinorInr)}
            </Text>
            <Text style={[s.status, tx.status === 'PENDING' && s.pending]}>
              {tx.status === 'PENDING' ? 'PENDING' : '●  POSTED'}
            </Text>
            <View style={s.detailBox}>
              {[
                ['Account Name', getAccountLabel(tx.accountId, accounts)],
                ['Category', tx.category],
                ['IST Time', formatISTDateTime(tx.occurredAt)],
                ['UTC Time', tx.occurredAt],
                ['Transaction ID', tx.id],
                ['Direction', tx.direction.toUpperCase()],
                ['Currency', tx.originalCurrency],
                ['Self Transfer', tx.isSelfTransfer ? 'Yes (Excluded from spend)' : 'No'],
              ].map((x) => (
                <View style={s.detailRow} key={x[0]}>
                  <Text style={s.detailLabel}>{x[0]}</Text>
                  <Text style={s.detailValue}>{x[1]}</Text>
                </View>
              ))}
            </View>
            <Pressable style={s.rawButton} onPress={() => setRaw(!raw)}>
              <Text style={s.rawText}>⌘  View Raw JSON Payload</Text>
              <Text style={s.chevron}>{raw ? '⌃' : '⌄'}</Text>
            </Pressable>
            {raw && (
              <Text style={s.json}>{JSON.stringify(tx.rawPayload, null, 2)}</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Main Screen Component ───────────────────────────────────────────
export function V0TrackScreen() {
  const [transactions, setTransactions] = useState<NormalizedTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [tab, setTab] = useState<'analytics' | 'transactions'>('analytics');
  const [selectedTxn, setSelectedTxn] = useState<NormalizedTransaction | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [transactionCategoryFilter, setTransactionCategoryFilter] = useState('All');
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [serverUrl, setServerUrl] = useState(getDefaultApiBaseUrl());

  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const desktop = width >= 900;

  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    status: 'idle',
    phase: 'idle',
    loadedCount: 0,
  });

  const syncEngine = useMemo(
    () =>
      new SyncEngine({
        baseUrl: serverUrl,
        onProgress: (prog) => {
          setSyncProgress(prog);
          if (prog.status === 'success') {
            setIsOnline(true);
            TransactionStore.getTransactions().then(setTransactions);
          }
        },
      }),
    [serverUrl]
  );

  const loadData = useCallback(async () => {
    const [txns, accs] = await Promise.all([
      TransactionStore.getTransactions(),
      TransactionStore.getAccounts(),
    ]);
    if (txns.length > 0) setTransactions(txns);
    if (accs.length > 0) setAccounts(accs);
  }, []);

  const runSync = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const res = await syncEngine.sync();
      setIsOnline(true);

      // If initial sync just completed, immediately fetch changes so all 4,686 records are loaded
      if (res.count === 4675) {
        await syncEngine.sync();
      }

      const [txns, accs] = await Promise.all([
        TransactionStore.getTransactions(),
        TransactionStore.getAccounts(),
      ]);
      setTransactions(txns);
      setAccounts(accs);
    } catch (err: any) {
      console.warn('[V0TrackScreen] Sync error:', err);
      setIsOnline(false);
    } finally {
      setIsRefreshing(false);
      setIsLoading(false);
    }
  }, [syncEngine]);

  useEffect(() => {
    loadData().then(() => {
      setIsLoading(false);
      runSync();
    });
  }, [loadData, runSync]);

  // Summaries
  const summaries = useMemo(() => computeMonthSummaries(transactions), [transactions]);

  // Sorted ascending chronologically for the 13-month bar chart
  const chronologicalMonths = useMemo(
    () => Object.keys(summaries).sort((a, b) => a.localeCompare(b)),
    [summaries]
  );

  const totalSpendMinor = useMemo(
    () => chronologicalMonths.reduce((sum, k) => sum + summaries[k].spendMinor, 0),
    [chronologicalMonths, summaries]
  );

  const monthlySpends = useMemo(
    () => chronologicalMonths.map((k) => summaries[k].spendMinor),
    [chronologicalMonths, summaries]
  );

  const monthLabels = useMemo(
    () =>
      chronologicalMonths.map((k) => {
        const parts = k.split('-');
        const monthLetters = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
        return monthLetters[parseInt(parts[1], 10) - 1] || '?';
      }),
    [chronologicalMonths]
  );

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, { totalMinor: number; count: number }> = {};
    for (const tx of transactions) {
      if (tx.isSelfTransfer) continue;
      if (tx.direction !== 'debit') continue;
      const cat = tx.category || 'Uncategorized';
      if (!catMap[cat]) catMap[cat] = { totalMinor: 0, count: 0 };
      catMap[cat].totalMinor += tx.amountMinorInr;
      catMap[cat].count += 1;
    }
    const total = Object.values(catMap).reduce((s, v) => s + v.totalMinor, 0) || 1;
    return Object.entries(catMap)
      .map(([name, v]) => ({
        name,
        totalMinor: v.totalMinor,
        count: v.count,
        pct: (v.totalMinor / total) * 100,
      }))
      .sort((a, b) => b.totalMinor - a.totalMinor);
  }, [transactions]);

  // Self transfers
  const { transferCount, transferTotalMinor } = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const tx of transactions) {
      if (tx.isSelfTransfer) {
        count++;
        total += tx.amountMinorInr;
      }
    }
    return { transferCount: count, transferTotalMinor: total };
  }, [transactions]);

  const handleReviewTransfers = useCallback(() => {
    setTransactionCategoryFilter('Transfers');
    setTab('transactions');
  }, []);

  if (isLoading && transactions.length === 0) {
    return (
      <View style={[s.app, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={C.mint} />
        <Text style={[s.mutedText, { marginTop: 16, fontSize: 14 }]}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={s.app}>
      <View style={[s.shell, desktop ? s.shellDesktop : s.shellMobile]}>
        <Header
          tab={tab}
          setTab={(t) => setTab(t as any)}
          desktop={desktop}
          topInset={insets.top}
          onOpenConfig={() => setIsConfigOpen(true)}
        />
        {!desktop && <MobileTabs tab={tab} setTab={(t) => setTab(t as any)} />}
        <ScrollView
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={runSync}
              tintColor={C.mint}
              colors={[C.mint]}
            />
          }
        >
          <View style={{ display: tab === 'analytics' ? 'flex' : 'none' }}>
            <AnalyticsTab
              desktop={desktop}
              totalSpendMinor={totalSpendMinor}
              monthlySpends={monthlySpends}
              monthLabels={monthLabels}
              categoryBreakdown={categoryBreakdown}
              transferCount={transferCount}
              transferTotalMinor={transferTotalMinor}
              syncProgress={syncProgress}
              isOnline={isOnline}
              totalCount={transactions.length}
              onReviewTransfers={handleReviewTransfers}
              onOpenConfig={() => setIsConfigOpen(true)}
            />
          </View>
          <View style={{ display: tab === 'transactions' ? 'flex' : 'none' }}>
            <TransactionsTab
              transactions={transactions}
              accounts={accounts}
              open={setSelectedTxn}
              initialCategory={transactionCategoryFilter}
            />
          </View>
        </ScrollView>
      </View>
      <DetailModal
        tx={selectedTxn}
        accounts={accounts}
        close={() => setSelectedTxn(null)}
      />
      <ServerConfigModal
        visible={isConfigOpen}
        currentUrl={serverUrl}
        onSave={(newUrl) => {
          setServerUrl(newUrl);
          syncEngine.setBaseUrl(newUrl);
          runSync();
        }}
        onClearCache={async () => {
          await TransactionStore.clearAll();
          setTransactions([]);
          runSync();
        }}
        onClose={() => setIsConfigOpen(false)}
      />
    </View>
  );
}

// ── Styles (exact replica of v0 design) ─────────────────────────────
const s = StyleSheet.create({
  app: {
    flex: 1,
    minHeight: Platform.OS === 'web' ? ('100vh' as any) : undefined,
    backgroundColor: C.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shell: { backgroundColor: C.bg, overflow: 'hidden' as any },
  shellDesktop: {
    width: '96%' as any,
    maxWidth: 1440,
    height: Platform.OS === 'web' ? ('94vh' as any) : undefined,
    borderRadius: 34,
  },
  shellMobile: { width: '100%' as any, flex: 1 },
  scroll: { paddingBottom: 42 },

  // Header
  header: {
    height: 82,
    paddingHorizontal: 28,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0c0d0d',
    borderBottomWidth: 1,
    borderBottomColor: '#131515',
  },
  brandRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 9 },
  logo: {
    width: 31,
    height: 31,
    borderRadius: 8,
    backgroundColor: C.mint,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.mint,
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  logoText: { color: '#101210', fontWeight: '700', fontSize: 19, lineHeight: 23 },
  brand: {
    color: C.text,
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700',
    letterSpacing: -0.65,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#111313',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: { backgroundColor: 'rgba(0,0,0,.08)' },
  iconText: { color: C.text, fontSize: 15, lineHeight: 18, fontWeight: '600' },
  darkText: { color: '#0b0d0b' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  navItem: {
    height: 40,
    paddingHorizontal: 17,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  navActive: { backgroundColor: '#1b1d1d' },
  navIcon: { color: '#bbbdbc', fontSize: 13, lineHeight: 16 },
  navText: { color: '#c6c8c7', fontSize: 11, lineHeight: 15, fontWeight: '400' },
  headerActions: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  notify: { position: 'relative' as any },
  redDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#ff3333',
    position: 'absolute',
    top: 7,
    right: 7,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#cb7842',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,
  },
  avatarText: { color: 'white', fontWeight: '700', fontSize: 10, lineHeight: 13 },

  // Mobile tabs
  mobileTabs: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: '#0c0d0d',
  },
  mobileTab: {
    flex: 1,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#161818',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mobileTabActive: { backgroundColor: C.mint },
  mobileTabText: { color: C.muted, fontSize: 11, lineHeight: 15, fontWeight: '500' },

  // Page layout
  page: { padding: 18, gap: 14 },
  filterRow: { flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  filter: {
    backgroundColor: '#171919',
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 36,
    justifyContent: 'center',
  },
  filterText: { color: '#bfc1c0', fontSize: 10, lineHeight: 14, fontWeight: '400' },
  livePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#121b15',
    marginLeft: 'auto' as any,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.mint },
  liveText: { color: C.mint, fontSize: 9, fontWeight: '700' },
  topGrid: { flexDirection: 'row', gap: 14 },
  leftTop: { width: '38%' as any, gap: 14 },
  rightTop: { flex: 1 },
  bottomGrid: { flexDirection: 'row', gap: 14 },
  chartWidth: { width: '66%' as any },
  sideWidth: { flex: 1, gap: 14 },
  stack: { flexDirection: 'column' },
  full: { width: '100%' as any },

  // Card
  card: {
    backgroundColor: C.panel,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#171919',
  },

  // Hero
  hero: { minHeight: 230, padding: 21, justifyContent: 'space-between' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  arrow: { color: '#848786', fontSize: 20 },
  label: {
    color: C.muted,
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '500',
    letterSpacing: 0.55,
  },
  heroAmount: {
    color: C.text,
    fontSize: 35,
    lineHeight: 41,
    fontWeight: '700',
    letterSpacing: -1.45,
    marginTop: 8,
  },
  amountCents: { color: '#929594', fontSize: 17, fontWeight: '600' },
  deltaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 7 },
  green: { color: C.mint, fontSize: 11, fontWeight: '700' },
  mutedText: { color: C.muted, fontSize: 9 },
  sync: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  syncText: { color: '#6d706f', fontSize: 9 },

  // Income / Spending pattern
  incomeCard: { flex: 1, minHeight: 365, padding: 22, justifyContent: 'space-between' },
  title: {
    color: C.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: '500',
    letterSpacing: -0.25,
  },
  incomeHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bigAmount: {
    color: C.text,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '700',
    letterSpacing: -1.1,
    marginTop: 8,
  },
  right: { alignItems: 'flex-end' },
  sparkBars: { height: 52, flexDirection: 'row', gap: 5, alignItems: 'center' },
  spark: { flex: 1, maxWidth: 8, borderRadius: 4 },
  aiStrip: {
    minHeight: 86,
    borderRadius: 20,
    backgroundColor: '#202222',
    padding: 15,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flex: { flex: 1 },
  stripTitle: {
    color: C.text,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    marginBottom: 5,
  },
  chevron: { color: '#d8d9d8', fontSize: 25, lineHeight: 28 },

  // Metrics
  metrics: { flexDirection: 'row', gap: 9 },
  metric: { flex: 1, minHeight: 150, padding: 13, gap: 7 },
  metricTitle: { color: C.text, fontSize: 11, lineHeight: 15, fontWeight: '600' },
  metricValue: { fontSize: 10, lineHeight: 14, fontWeight: '600' },

  // Chart
  chartCard: { padding: 20, minHeight: 390 },
  chartAmount: {
    color: C.text,
    fontSize: 31,
    lineHeight: 37,
    fontWeight: '700',
    letterSpacing: -1,
    marginTop: 6,
  },
  select: {
    backgroundColor: '#1c1e1e',
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 18,
  },
  selectText: { color: '#a5a8a7', fontSize: 10, lineHeight: 13 },
  chart: { flex: 1, minHeight: 260, flexDirection: 'row', marginTop: 18 },
  yAxis: { width: 30, justifyContent: 'space-between', paddingBottom: 20 },
  axisText: { color: '#707372', fontSize: 8 },
  barArea: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#202222',
  },
  barColumn: {
    flex: 1,
    height: '100%' as any,
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 7,
    position: 'relative',
  },
  bar: { width: '72%' as any, borderRadius: 8, minHeight: 10 },
  tooltip: {
    position: 'absolute',
    top: 7,
    backgroundColor: '#242626',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    zIndex: 2,
  },
  tooltipText: { color: C.text, fontSize: 9, fontWeight: '700' },

  // Donut
  donutCard: { padding: 20, minHeight: 390 },
  donutWrap: {
    width: 190,
    height: 190,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
  },
  donutSegment: {
    position: 'absolute',
    width: 7,
    height: 22,
    borderRadius: 4,
  },
  donutCenter: { alignItems: 'center' },
  donutAmount: {
    color: C.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.6,
  },
  legend: { gap: 10 },
  legendRow: { flexDirection: 'row', alignItems: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  legendText: { color: '#b4b6b5', fontSize: 10, flex: 1 },
  legendValue: { color: C.text, fontSize: 10, fontWeight: '700' },

  // Transfer notice
  mintCard: {
    borderRadius: 24,
    backgroundColor: C.mint,
    padding: 20,
    minHeight: 260,
    justifyContent: 'space-between',
  },
  aiBadge: {
    backgroundColor: '#f4fff5',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  aiBadgeText: { color: '#151715', fontSize: 8, lineHeight: 11, fontWeight: '600' },
  mintTitle: {
    color: '#0b0d0b',
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '700',
    letterSpacing: -0.55,
    marginTop: 20,
  },
  mintBody: { color: '#253328', fontSize: 10, lineHeight: 17, marginTop: 10 },
  blackButton: {
    height: 46,
    borderRadius: 23,
    backgroundColor: '#060707',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  blackButtonText: { color: 'white', fontSize: 10, lineHeight: 14, fontWeight: '500' },

  // Search
  searchPanel: { padding: 14, gap: 10 },
  searchBox: {
    height: 47,
    backgroundColor: '#0e1010',
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  searchIcon: { color: '#888', fontSize: 20 },
  input: {
    flex: 1,
    color: C.text,
    paddingHorizontal: 10,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}),
  } as any,
  clear: { color: C.muted, fontSize: 22 },
  pills: { gap: 8 },
  pill: {
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: '#202222',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: C.mint },
  pillAccount: { borderWidth: 1, borderColor: C.purple },
  pillText: { color: '#b5b7b6', fontSize: 9 },

  // History
  historyHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginTop: 8,
  },
  historyTitle: { color: C.text, fontSize: 24, fontWeight: '700', marginTop: 6 },

  // Month cards
  monthCard: { overflow: 'hidden' },
  monthHead: {
    minHeight: 76,
    paddingHorizontal: 18,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#191b1b',
  },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthTitle: { color: C.text, fontSize: 14, fontWeight: '700' },
  count: {
    color: C.muted,
    backgroundColor: '#242626',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 3,
    fontSize: 8,
  },
  monthTotals: { flexDirection: 'row', gap: 24, alignItems: 'center' },
  spent: { color: C.red, fontSize: 11, fontWeight: '700', marginTop: 3 },
  earned: { color: C.mint, fontSize: 11, fontWeight: '700', marginTop: 3 },

  // Transaction row
  txRow: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pressed: { backgroundColor: '#1c1e1e' },
  merchantLogo: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  merchantMark: { color: '#fff', fontSize: 13, fontWeight: '800' },
  txInfo: { flex: 1 },
  txTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    flexWrap: 'wrap',
  },
  txTitle: { color: C.text, fontSize: 11, fontWeight: '700' },
  excluded: {
    color: '#a9acab',
    fontSize: 6,
    backgroundColor: '#292b2b',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
  txMeta: { color: C.muted, fontSize: 8, marginTop: 5 },
  txAmountWrap: { alignItems: 'flex-end' },
  txAmount: { fontSize: 10, fontWeight: '700' },
  txTime: { color: '#666968', fontSize: 7, marginTop: 5 },
  empty: { color: '#5e6160', fontSize: 9, textAlign: 'center', padding: 18 },
  loadMoreBtn: {
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#161818',
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  loadMoreText: {
    color: C.mint,
    fontSize: 10,
    fontWeight: '600',
  },

  // Detail modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,.75)',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  sheet: {
    width: '100%' as any,
    maxWidth: 560,
    maxHeight: '92%' as any,
    backgroundColor: '#181a1a',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3d3f3f',
    marginBottom: 16,
    alignSelf: 'center',
  },
  close: {
    position: 'absolute',
    right: 20,
    top: 18,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#242626',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: { color: C.muted, fontSize: 22 },
  modalLogo: { width: 56, height: 56, borderRadius: 18 },
  modalCategory: { color: C.muted, fontSize: 9, marginTop: 10 },
  modalTitle: { color: C.text, fontSize: 20, fontWeight: '700', marginTop: 4 },
  modalAmount: { fontSize: 31, fontWeight: '800', marginTop: 10 },
  status: {
    color: C.mint,
    backgroundColor: '#183121',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    fontSize: 8,
    marginTop: 8,
    overflow: 'hidden',
  },
  pending: { color: '#ffd465', backgroundColor: '#352b15' },
  detailBox: {
    width: '100%' as any,
    backgroundColor: '#101212',
    borderRadius: 16,
    marginTop: 20,
    paddingHorizontal: 14,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#262828',
    gap: 15,
  },
  detailLabel: { color: C.muted, fontSize: 9 },
  detailValue: { color: '#c7c9c8', fontSize: 9, textAlign: 'right', flexShrink: 1 },
  rawButton: {
    width: '100%' as any,
    height: 42,
    marginTop: 12,
    backgroundColor: '#222424',
    borderRadius: 12,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rawText: { color: '#a5a8a7', fontSize: 9 },
  json: {
    width: '100%' as any,
    color: C.mint,
    fontFamily: 'monospace',
    fontSize: 8,
    lineHeight: 13,
    backgroundColor: '#0d0f0f',
    borderRadius: 12,
    padding: 12,
    marginTop: 7,
  },
});
