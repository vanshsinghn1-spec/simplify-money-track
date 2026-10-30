# What the Data Made Us Decide

The mock dataset (`fixtures/`) and the mock server implementation (`server.js`) contain realistic, production-shaped anomalies that required specific engineering choices. This document details each anomaly discovered, what was chosen, and what would be implemented with more time.

---

### 1. Dual-Schema Inconsistency in Raw Transactions
* **What we saw:**  
  The 4,675 base transactions in `fixtures/transactions.json` are not homogeneous. Approximately half follow a modern API contract (`amount_minor`, `occurred_at` ISO string, `direction: 'debit'|'credit'`, `merchant`, `counterparty`), while the other half follow an older legacy format (`amount` as string decimal, `txn_time` as Unix epoch seconds, `type: 'DR'|'CR'`, `merchant_name`, `linked_account`).
* **What we chose:**  
  Created a polymorphic adapter in `src/normalize.ts` (`normalizeTransaction`) that detects schema signatures dynamically and normalizes both shapes into a single canonical internal representation (`NormalizedTransaction`).
* **With more time:**  
  Introduce schema contract validations with runtime guards (such as Zod) and push telemetry alerts to detect legacy payload regressions from upstream scrapers.

---

### 2. Overlapping Cursor Boundaries
* **What we saw:**  
  In `server.js`, cursor generation uses `offset + limit - 1`. The server intentionally re-sends the boundary transaction across subsequent pagination requests.
* **What we chose:**  
  Treated all ingestion operations as idempotent upserts using an ID-keyed map (`mergedMap[txn.id] = txn`). Deduplicating at ingest guarantees Non-negotiable #1 (*"Every transaction appears exactly once"*).
* **With more time:**  
  Implement keyset pagination (e.g. `(occurred_at, id)`) on the backend to avoid the overhead of re-transmitting boundary records.

---

### 3. Out-of-Order Changes & Stale Updates
* **What we saw:**  
  In `fixtures/changes.json`, change #49 (`txn_DAFC2853FA16EBD510BC`) arrives with an older `updated_at` (`19:23:33Z`, PENDING ₹39) after change #5 had already updated it with a newer timestamp (`19:53:33Z`, POSTED ₹89). Naively applying updates sequentially would overwrite newer data with stale data and create a ₹50 discrepancy against `checkpoint.json`.
* **What we chose:**  
  Implemented timestamp-based conflict resolution ("latest truth wins"). Incoming updates and deletions are only applied if `incoming.updated_at >= existing.updated_at`.
* **With more time:**  
  Implement Lamport timestamps or monotonically increasing sequence numbers on mutation events to avoid clock skew vulnerabilities.

---

### 4. Indian Standard Time (IST) Month Bucketing
* **What we saw:**  
  Transactions occurring late in the day in UTC (e.g., `2026-03-31T18:23:00Z`) cross into the subsequent month under Indian Standard Time (`2026-04-01T00:03:00+05:30`). Grouping by UTC produced substantial discrepancies across every single month when compared against `checkpoint.json`.
* **What we chose:**  
  All date grouping calculations in `getISTMonthKey()` explicitly apply the IST offset (`+05:30`), aligning transaction months with the user's local calendar experience in India.
* **With more time:**  
  Support dynamic timezone resolution based on user device configuration or transaction origin metadata, while defaulting to `Asia/Kolkata`.

---

### 5. Multi-Account Internal Transfers & Credit Card Payments
* **What we saw:**  
  There are 26 self-transfers between user savings accounts (`acc_4821` and `acc_9075`) and credit card bill payments (`acc_9075` debit paired with `acc_3310` credit). In Schema A, these carry `counterparty: { type: 'OWN_ACCOUNT' }`. In Schema B, they carry `category: 'TRANSFER'` and `linked_account: '...'`.
* **What we chose:**  
  Flagged these transactions with `isSelfTransfer = true` and strictly excluded them from monthly spend and income aggregations. Labeled them with distinct UI indicators so users see the transaction without having their spend totals inflated.
* **With more time:**  
  Implement a transaction pairing engine that visually correlates both legs of the transfer (debit from bank account and credit into credit card/savings account) as a single connected transfer card in the UI.

---

### 6. Foreign Currency Transactions (USD)
* **What we saw:**  
  15 transactions carry `currency: 'USD'` (such as Notion, GitHub, OpenAI subscriptions). They include an `fx` object: `{ inr_minor: ... }`.
* **What we chose:**  
  Converted foreign transactions to their INR equivalent using `fx.inr_minor` for all domestic spend totals, while displaying the original foreign currency amount (`$10.00 USD`) in the transaction row and details modal for full transparency.
* **With more time:**  
  Add an FX rate breakdown in the detail view showing the exact conversion rate and date applied by the card network.

---

### 7. Android SQLite 2MB CursorWindow Limit on Large Datasets
* **What we saw:**  
  When testing the application on physical Android hardware with the full 4,686 transaction dataset, initial storage writes appeared to succeed, but subsequent reads threw a fatal Android runtime exception:
  `Row too big to fit into CursorWindow requiredPos=0, totalRows=1`.
  Android's underlying SQLite implementation assigns a fixed 2048 KB window for cursor query buffers. Serializing 4,686 normalized records into a single JSON value produced a string of approximately 2.8 MB, crashing `AsyncStorage.getItem()`.
* **What we chose:**  
  Engineered a sharded persistence layer in `src/storage.ts`. The dataset is partitioned into 350-item chunks (~200 KB per chunk) managed by an index manifest (`@sm_track:chunks_manifest_v2`). Chunks are written and read concurrently using `AsyncStorage.multiSet()` and `AsyncStorage.multiGet()`, keeping every database query far below the 2 MB threshold.
* **With more time:**  
  Evaluate SQLite with custom C++ query extensions for paginated queries when scaling past 50,000 transactions.

---

### 8. Category Taxonomy Normalization & Fuzzy Filtering
* **What we saw:**  
  Raw transactions in the dataset use uppercase, single-token category codes (e.g., `FOOD`, `GROCERIES`, `SHOPPING`, `TRAVEL`, `BILLS`, `TRANSFER`), whereas the reference product UI utilizes consumer-friendly multi-word category labels (e.g., "Food & Dining", "Daily Commute"). Filtering naively on exact string equality caused the "Food & Dining" filter to return 0 records despite hundreds of food transactions being present.
* **What we chose:**  
  Implemented a fuzzy category matcher `matchesCategoryFilter` in `src/screens/V0TrackScreen.tsx` that normalizes punctuation, lowercases strings, and maps colloquial user labels back to the underlying financial schema tokens.
* **With more time:**  
  Centralize category taxonomy mapping in a shared classification domain service supporting user-customizable tag taxonomies.


