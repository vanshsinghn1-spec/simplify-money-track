import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MonthSummary } from '../types';

interface MonthSummaryCardProps {
  summary: MonthSummary;
}

export const MonthSummaryCard: React.FC<MonthSummaryCardProps> = React.memo(({ summary }) => {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.monthLabel}>{summary.label}</Text>
        <Text style={styles.countBadge}>
          {summary.transactionCount} txn{summary.transactionCount === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={styles.metricsRow}>
        <View style={styles.metricItem}>
          <Text style={styles.metricTitle}>Spent</Text>
          <Text style={styles.spendValue}>{summary.spendFormatted}</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricItem}>
          <Text style={styles.metricTitle}>Earned</Text>
          <Text style={styles.incomeValue}>{summary.incomeFormatted}</Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#18181C',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#26262E',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#23232A',
    paddingBottom: 8,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F4F4F5',
    letterSpacing: 0.2,
  },
  countBadge: {
    fontSize: 11,
    color: '#71717A',
    fontWeight: '500',
    backgroundColor: '#202026',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  metricItem: {
    flex: 1,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: '#2B2B33',
    marginHorizontal: 12,
  },
  metricTitle: {
    fontSize: 11,
    color: '#A1A1AA',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: 2,
  },
  spendValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F87171', // Soft Red
    letterSpacing: -0.2,
  },
  incomeValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#34D399', // Emerald Green
    letterSpacing: -0.2,
  },
});
