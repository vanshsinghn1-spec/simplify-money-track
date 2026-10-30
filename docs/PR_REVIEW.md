# Pull Request Review: PR #412
**Title:** Track: load transactions from the new API  
**Author:** Teammate  
**Status:** CHANGES REQUESTED (BLOCKING MERGE)

---

### Overview & Summary
While PR #412 gets transactions rendering on screen for a basic happy path on an Android emulator, it suffers from several critical architectural flaws, data corruption risks, financial inaccuracies, and performance regressions that violate our non-negotiables. It must not be merged in its current state.

Below are the 10 prioritized review comments, ordered from most critical to least critical.

---

### Comment 1: Catastrophic Data Loss on Network Failure (Non-negotiable #5)
* **File:** `useTransactions.ts:36-37`
* **Code:**
  ```typescript
  catch (e) {
    setError('Something went wrong');
    setTransactions([]);
  }
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** A temporary network glitch, timeout, or transient 500 error from the server completely clears `transactions` from state, wiping whatever transactions the user was already viewing. Our core contract states: *"A failure never costs the user what they could already see."* We should retain existing cached data, display an unobtrusive offline/error banner, and allow a retry without destroying local state.

---

### Comment 2: Missing Boundary Deduplication (Non-negotiable #1)
* **File:** `useTransactions.ts:32`
* **Code:**
  ```typescript
  setTransactions(reset ? body.items : [...transactions, ...body.items]);
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** The mock backend server uses position-based cursor pagination where `next_cursor` offset is `offset + limit - 1`. The server intentionally re-sends the boundary transaction on subsequent pages. Appending arrays directly results in duplicate transaction rows appearing in the UI. Ingestion must deduplicate by transaction `id` (e.g. via an ID map/set). Additionally, referencing `transactions` directly inside an async closure introduces stale closure bugs; a functional state update (`prev => ...`) or normalized store is required.

---

### Comment 3: Self-Transfers Included in Monthly Spend (Non-negotiable #4)
* **File:** `useTransactions.ts:63-67`
* **Code:**
  ```typescript
  export function monthTotal(txns: Txn[]) {
    return txns
      .filter((t) => t.direction === 'debit')
      .reduce((sum, t) => sum + t.amount_minor / 100, 0);
  }
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** Moving money between a user's own accounts (such as transfers between savings accounts or paying a credit card bill from a bank account) has `direction: 'debit'`, but is neither spending nor earning. Including these transactions inflates the user's monthly spend and produces incorrect totals that contradict `checkpoint.json`. Self-transfers (`counterparty.type === 'OWN_ACCOUNT'` or `linked_account != null`) must be filtered out.

---

### Comment 4: Floating Point Math for Currency (Non-negotiable #2)
* **File:** `useTransactions.ts:66`
* **Code:**
  ```typescript
  .reduce((sum, t) => sum + t.amount_minor / 100, 0);
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** Performing IEEE-754 floating-point arithmetic on currency amounts in JavaScript leads to precision errors (e.g., `0.1 + 0.2 === 0.30000000000000004`). All aggregations must be maintained strictly in integer minor units (paise/cents) throughout the domain and only converted to major units at the point of presentation.

---

### Comment 5: Hardcoded Android-Only Host URL
* **File:** `useTransactions.ts:6`
* **Code:**
  ```typescript
  const API = 'http://10.0.2.2:4010';
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** `10.0.2.2` only works in the standard Android emulator. This fails immediately on physical Android devices, iOS simulators (`localhost`), and web environments. The base URL must be configurable via environment variables or runtime settings, defaulting gracefully based on `Platform.OS`.

---

### Comment 6: Missing HTTP Status Verification & Error Handling
* **File:** `useTransactions.ts:30-31`
* **Code:**
  ```typescript
  const res = await fetch(`${API}/v1/transactions${q}`);
  const body = await res.json();
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** `fetch` does not reject on HTTP 4xx or 5xx status codes. When the server injects a 500 internal error or 429 rate limit, it returns `{ error: "internal_error" }`. Calling `body.items` immediately throws a `TypeError: body.items is not iterable`, crashing the load flow. We must check `res.ok`, handle `429` with `Retry-After` header backoff, and retry transient `500`/`503` errors.

---

### Comment 7: US Number Formatting with Rupee Symbol (Non-negotiable #3)
* **File:** `TrackScreen.tsx:7-8`
* **Code:**
  ```typescript
  const formatAmount = (minor: number) =>
    '₹' + (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2 });
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** Our users are in India. Formatting Indian currency with the `en-US` locale formats ₹1,00,000 as `₹100,000.00` (thousands/millions instead of Lakhs/Crores). We must format amounts using the `en-IN` locale (`new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`).

---

### Comment 8: Array Index as `keyExtractor` in Virtualized List (Non-negotiable #8)
* **File:** `TrackScreen.tsx:36`
* **Code:**
  ```typescript
  keyExtractor={(_, index) => String(index)}
  ```
* **Verdict:** [BLOCKING]
* **Rationale:** Using array indices as keys in a dynamically paginated list causes React Native's reconciliation engine to misidentify components, resulting in render thrashing, state bugs, and major scroll stuttering when rendering thousands of items. We should use stable unique keys: `keyExtractor={(item) => item.t.id}`.

---

### Comment 9: Unmemoized Header & Data Flattening on Every Render
* **File:** `TrackScreen.tsx:24-29`
* **Code:**
  ```typescript
  const groups = groupByMonth(transactions);
  const data = Object.keys(groups).flatMap(...);
  ```
* **Verdict:** [NON-BLOCKING (PERFORMANCE)]
* **Rationale:** `groupByMonth` and the subsequent `flatMap` are executed on every single render of `TrackScreen`. With over 4,600 transactions, this creates noticeable UI freezes whenever state updates (e.g., `loading` toggling). These heavy calculations should be wrapped in `useMemo`.

---

### Comment 10: Inaccurate Month Grouping Across Timezones
* **File:** `useTransactions.ts:57`
* **Code:**
  ```typescript
  const key = t.occurred_at.slice(0, 7);
  ```
* **Verdict:** [NON-BLOCKING (EDGE CASE)]
* **Rationale:** String-slicing `occurred_at.slice(0, 7)` uses UTC calendar months. For an Indian user (IST is UTC+5:30), a transaction that occurred at `2026-03-31 19:00:00Z` actually occurred on `2026-04-01 00:30:00 IST`. Slicing UTC assigns transactions near midnight to the wrong month. Timestamps should be adjusted to Indian Standard Time before month grouping.
