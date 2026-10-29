# AI Disclosure & Engineering Oversight

### Tools Used
* **AI Coding Assistants:** Used for rapid scaffolding of component boilerplates, generating initial TypeScript interface skeletons, and formulating test assertions.
* **Human Engineering Role:** System architecture, identifying server pagination boundary traps, discovering legacy/modern dual schemas in raw data, resolving out-of-order mutations, proving precision arithmetic against `checkpoint.json`, and performance profiling.

---

### Concrete Case Where AI Output Was Wrong / Worse

#### 1. Context
During the initial design of the transaction update pipeline, the AI tool generated a standard array merge pattern for applying updates from the `/v1/transactions/changes` endpoint.

#### 2. The AI's Output
```typescript
// AI-generated mutation handler
function applyChanges(currentTxns: Txn[], changes: Change[]): Txn[] {
  const map = new Map(currentTxns.map((t) => [t.id, t]));

  for (const change of changes) {
    if (change.deleted) {
      map.delete(change.id);
    } else {
      map.set(change.id, { ...map.get(change.id), ...change });
    }
  }

  return Array.from(map.values());
}
```

#### 3. Why It Was Wrong & Failed
* **Stale Out-of-Order Overwrites:** The AI assumed that `changes` array elements arrive in chronological sequence. In reality, the server fixtures include out-of-order changes (specifically change #49 for `txn_DAFC2853FA16EBD510BC`, which carries an older timestamp `19:23:33Z` than change #5 at `19:53:33Z`). The AI code blindly overwrote the newer ₹89.00 POSTED transaction with an older ₹39.00 PENDING transaction, corrupting the October 2026 totals and causing test failures against `checkpoint.json`.
* **Shallow Merge Contamination:** Doing `{ ...map.get(change.id), ...change }` merged mismatched keys across Schema A and Schema B (e.g. keeping both `amount` and `amount_minor`), causing dual-field pollution.
* **Unversioned Deletions:** It deleted records unconditionally without checking whether an existing record had a newer timestamp than the deletion event.

#### 4. The Human-Engineered Solution
```typescript
// Production-grade implementation with causal timestamp ordering
for (const change of changes) {
  const id = String(change.id);
  const existing = txnMap[id];
  const changeUpdatedAt = change.updated_at || new Date().toISOString();

  if (change.deleted) {
    // Only delete if the deletion is at least as recent as our current state
    if (existing) {
      const existingTime = new Date(existing.updatedAt).getTime();
      const changeTime = new Date(changeUpdatedAt).getTime();
      if (changeTime >= existingTime) {
        delete txnMap[id];
      }
    }
  } else {
    // Latest truth wins: verify causality before mutating
    if (existing) {
      const existingTime = new Date(existing.updatedAt).getTime();
      const changeTime = new Date(changeUpdatedAt).getTime();
      if (changeTime >= existingTime) {
        txnMap[id] = normalizeTransaction(change);
      }
    } else {
      txnMap[id] = normalizeTransaction(change);
    }
  }
}
```

#### 5. Result
This human intervention enforced causal consistency, prevented data corruption, and produced a **100.00% exact match across all 13 months** against `checkpoint.json`.
