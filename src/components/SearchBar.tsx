import React from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Account } from '../types';

interface SearchBarProps {
  query: string;
  onChangeQuery: (text: string) => void;
  selectedAccountId: string | null;
  onSelectAccount: (accountId: string | null) => void;
  accounts: Account[];
  matchCount?: number;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  query,
  onChangeQuery,
  selectedAccountId,
  onSelectAccount,
  accounts,
  matchCount,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.inputContainer}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.input}
          placeholder="Search by merchant, category..."
          placeholderTextColor="#71717A"
          value={query}
          onChangeText={onChangeQuery}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => onChangeQuery('')}
            accessibilityLabel="Clear search"
          >
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Account Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.accountFilterRow}
      >
        <TouchableOpacity
          style={[styles.accountPill, selectedAccountId === null && styles.accountPillActive]}
          onPress={() => onSelectAccount(null)}
        >
          <Text
            style={[
              styles.accountPillText,
              selectedAccountId === null && styles.accountPillTextActive,
            ]}
          >
            All Accounts
          </Text>
        </TouchableOpacity>

        {accounts.map((acc) => {
          const isSelected = selectedAccountId === acc.id;
          return (
            <TouchableOpacity
              key={acc.id}
              style={[styles.accountPill, isSelected && styles.accountPillActive]}
              onPress={() => onSelectAccount(isSelected ? null : acc.id)}
            >
              <Text
                style={[
                  styles.accountPillText,
                  isSelected && styles.accountPillTextActive,
                ]}
              >
                {acc.nickname || acc.bank} ••{acc.last4}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {query.trim().length > 0 && matchCount !== undefined && (
        <View style={styles.resultsInfoRow}>
          <Text style={styles.resultsInfoText}>
            Found {matchCount} transaction{matchCount === 1 ? '' : 's'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#121214',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222228',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1A1A1F',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A33',
    paddingHorizontal: 12,
    height: 40,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    color: '#FFF',
    fontSize: 14,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 6,
  },
  clearIcon: {
    color: '#A1A1AA',
    fontSize: 14,
  },
  accountFilterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
    paddingRight: 16,
  },
  accountPill: {
    backgroundColor: '#1A1A20',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D2D38',
  },
  accountPillActive: {
    backgroundColor: 'rgba(229, 169, 59, 0.15)',
    borderColor: '#E5A93B',
  },
  accountPillText: {
    color: '#A1A1AA',
    fontSize: 12,
    fontWeight: '500',
  },
  accountPillTextActive: {
    color: '#E5A93B',
    fontWeight: '700',
  },
  resultsInfoRow: {
    marginTop: 8,
  },
  resultsInfoText: {
    fontSize: 12,
    color: '#71717A',
    fontWeight: '500',
  },
});

