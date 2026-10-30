import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
} from 'react-native';
import { NormalizedTransaction, Account } from '../types';
import { formatINR, formatISTDateTime } from '../formatters';

interface TransactionDetailModalProps {
  transaction: NormalizedTransaction | null;
  accounts: Account[];
  onClose: () => void;
}

export const TransactionDetailModal: React.FC<TransactionDetailModalProps> = ({
  transaction,
  accounts,
  onClose,
}) => {
  const [showRaw, setShowRaw] = useState(false);

  if (!transaction) return null;

  const account = accounts.find((a) => a.id === transaction.accountId);
  const counterpartyAccount = transaction.counterpartyAccountId
    ? accounts.find((a) => a.id === transaction.counterpartyAccountId)
    : undefined;

  const isDebit = transaction.direction === 'debit';
  const isSelf = transaction.isSelfTransfer;

  return (
    <Modal visible={!!transaction} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.container}>
              {/* Handle Bar */}
              <View style={styles.handleBar} />

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.merchantTitle}>{transaction.merchant}</Text>
                  <Text
                    style={[
                      styles.amountTitle,
                      isSelf
                        ? styles.amountSelf
                        : isDebit
                        ? styles.amountDebit
                        : styles.amountCredit,
                    ]}
                  >
                    {isSelf ? '' : isDebit ? '-' : '+'}
                    {formatINR(transaction.amountMinorInr)}
                  </Text>
                  {transaction.originalCurrency !== 'INR' && (
                    <Text style={styles.fxSubtext}>
                      Original: {transaction.originalCurrency}{' '}
                      {(transaction.originalAmount / 100).toFixed(2)}
                    </Text>
                  )}
                </View>

                {/* Self transfer alert */}
                {isSelf && (
                  <View style={styles.transferAlert}>
                    <Text style={styles.transferAlertTitle}>⇄ Internal Account Transfer</Text>
                    <Text style={styles.transferAlertText}>
                      Moving money between your own accounts is neither spending nor earning, so it is
                      excluded from your monthly spend and income totals.
                    </Text>
                  </View>
                )}

                {/* Core Attributes Table */}
                <View style={styles.table}>
                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Status</Text>
                    <View
                      style={[
                        styles.badge,
                        transaction.status === 'POSTED' ? styles.badgePosted : styles.badgePending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.badgeText,
                          transaction.status === 'POSTED'
                            ? styles.badgeTextPosted
                            : styles.badgeTextPending,
                        ]}
                      >
                        {transaction.status}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Category</Text>
                    <Text style={styles.rowValue}>{transaction.category}</Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Account</Text>
                    <Text style={styles.rowValue}>
                      {account
                        ? `${account.bank} (${account.nickname || account.type}) ••${account.last4}`
                        : transaction.accountId}
                    </Text>
                  </View>

                  {counterpartyAccount && (
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Linked Account</Text>
                      <Text style={styles.rowValue}>
                        {counterpartyAccount.bank} ••{counterpartyAccount.last4}
                      </Text>
                    </View>
                  )}

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Time (IST)</Text>
                    <Text style={styles.rowValue}>
                      {formatISTDateTime(transaction.occurredAt)}
                    </Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Time (UTC)</Text>
                    <Text style={styles.rowValue}>{transaction.occurredAt}</Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Transaction ID</Text>
                    <Text style={[styles.rowValue, styles.monoText]}>{transaction.id}</Text>
                  </View>

                  <View style={styles.row}>
                    <Text style={styles.rowLabel}>Last Updated</Text>
                    <Text style={styles.rowValue}>{transaction.updatedAt}</Text>
                  </View>
                </View>

                {/* Raw JSON Inspector */}
                <TouchableOpacity
                  style={styles.rawToggle}
                  onPress={() => setShowRaw(!showRaw)}
                >
                  <Text style={styles.rawToggleText}>
                    {showRaw ? '▼ Hide Raw JSON Payload' : '▶ View Raw JSON Payload'}
                  </Text>
                </TouchableOpacity>

                {showRaw && (
                  <View style={styles.rawJsonBox}>
                    <Text style={styles.rawJsonText}>
                      {JSON.stringify(transaction.rawPayload, null, 2)}
                    </Text>
                  </View>
                )}

                <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                  <Text style={styles.closeButtonText}>Done</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#18181D',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: '85%',
    borderTopWidth: 1,
    borderTopColor: '#2B2B33',
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#3E3E48',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  merchantTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F4F4F5',
    textAlign: 'center',
    marginBottom: 6,
  },
  amountTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  amountDebit: {
    color: '#F87171',
  },
  amountCredit: {
    color: '#34D399',
  },
  amountSelf: {
    color: '#A1A1AA',
  },
  fxSubtext: {
    fontSize: 13,
    color: '#71717A',
    marginTop: 4,
  },
  transferAlert: {
    backgroundColor: 'rgba(229, 169, 59, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(229, 169, 59, 0.3)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  transferAlertTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E5A93B',
    marginBottom: 4,
  },
  transferAlertText: {
    fontSize: 12,
    color: '#D4D4D8',
    lineHeight: 16,
  },
  table: {
    backgroundColor: '#121215',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#24242C',
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A22',
  },
  rowLabel: {
    fontSize: 13,
    color: '#8E8E96',
  },
  rowValue: {
    fontSize: 13,
    color: '#F4F4F5',
    fontWeight: '500',
    maxWidth: '65%',
    textAlign: 'right',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#A1A1AA',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  badgePosted: {
    backgroundColor: 'rgba(52, 211, 153, 0.15)',
  },
  badgePending: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextPosted: {
    color: '#34D399',
  },
  badgeTextPending: {
    color: '#EAB308',
  },
  rawToggle: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  rawToggleText: {
    fontSize: 13,
    color: '#E5A93B',
    fontWeight: '600',
  },
  rawJsonBox: {
    backgroundColor: '#0D0D10',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#24242C',
    marginBottom: 16,
  },
  rawJsonText: {
    color: '#A1A1AA',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  closeButton: {
    backgroundColor: '#272730',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  closeButtonText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '700',
  },
});

