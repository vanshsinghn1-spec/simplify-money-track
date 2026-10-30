import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { NormalizedTransaction, Account } from '../types';
import { formatINR, formatISTDateTime } from '../formatters';

interface TransactionRowProps {
  transaction: NormalizedTransaction;
  account?: Account;
  onPress: (transaction: NormalizedTransaction) => void;
}

export const TransactionRow: React.FC<TransactionRowProps> = React.memo(
  ({ transaction, account, onPress }) => {
    const isDebit = transaction.direction === 'debit';
    const isSelf = transaction.isSelfTransfer;
    const isPending = transaction.status === 'PENDING';

    const accountLabel = account
      ? `${account.bank} ••${account.last4}`
      : transaction.accountId.replace('acc_', '••');

    const formattedAmount = formatINR(transaction.amountMinorInr);

    return (
      <TouchableOpacity
        style={styles.container}
        onPress={() => onPress(transaction)}
        activeOpacity={0.65}
        accessibilityRole="button"
        accessibilityLabel={`${transaction.merchant}, ${isSelf ? 'Self transfer' : isDebit ? 'Debit' : 'Credit'} of ${formattedAmount}`}
      >
        {/* Category Initial Icon */}
        <View
          style={[
            styles.iconContainer,
            isSelf
              ? styles.iconSelf
              : isDebit
              ? styles.iconDebit
              : styles.iconCredit,
          ]}
        >
          <Text style={styles.iconText}>
            {isSelf ? '⇄' : isDebit ? '↓' : '↑'}
          </Text>
        </View>

        {/* Merchant & Metadata */}
        <View style={styles.contentCol}>
          <View style={styles.titleRow}>
            <Text style={styles.merchantText} numberOfLines={1}>
              {transaction.merchant}
            </Text>
            {isPending && (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingText}>Pending</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.dateText}>
              {formatISTDateTime(transaction.occurredAt)}
            </Text>
            <Text style={styles.bullet}>·</Text>
            <Text style={styles.accountText}>{accountLabel}</Text>
          </View>

          {isSelf && (
            <Text style={styles.selfTransferNote}>
              Self Transfer (Excluded from totals)
            </Text>
          )}
        </View>

        {/* Amount */}
        <View style={styles.amountCol}>
          <Text
            style={[
              styles.amountText,
              isSelf
                ? styles.amountSelf
                : isDebit
                ? styles.amountDebit
                : styles.amountCredit,
            ]}
          >
            {isSelf ? '' : isDebit ? '-' : '+'}
            {formattedAmount}
          </Text>
          {transaction.originalCurrency !== 'INR' && (
            <Text style={styles.foreignFxText}>
              {transaction.originalCurrency} {(transaction.originalAmount / 100).toFixed(2)}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
    backgroundColor: '#121214',
  },
  iconContainer: {
    width: 38,
    height: 38,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconDebit: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  iconCredit: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
  },
  iconSelf: {
    backgroundColor: 'rgba(161, 161, 170, 0.12)',
  },
  iconText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#E4E4E7',
  },
  contentCol: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  merchantText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F4F4F5',
    flexShrink: 1,
  },
  pendingBadge: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(234, 179, 8, 0.3)',
  },
  pendingText: {
    color: '#EAB308',
    fontSize: 10,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#71717A',
  },
  bullet: {
    fontSize: 12,
    color: '#52525B',
  },
  accountText: {
    fontSize: 12,
    color: '#A1A1AA',
    fontWeight: '500',
  },
  selfTransferNote: {
    fontSize: 10,
    color: '#E5A93B',
    fontWeight: '500',
    marginTop: 2,
  },
  amountCol: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  amountDebit: {
    color: '#F87171',
  },
  amountCredit: {
    color: '#34D399',
  },
  amountSelf: {
    color: '#9E9EA7',
  },
  foreignFxText: {
    fontSize: 11,
    color: '#71717A',
    marginTop: 2,
  },
});

