# Simplify Money · Track Screen (React Native)

Production-grade, offline-first implementation of the **Track** screen for the Simplify Money Frontend Engineer Intern assignment.

---

## ⚡ Quick Start (Under 5 Minutes)

### Prerequisites
* **Node.js** (v18 or newer)
* **npm** (or yarn)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run App & Mock Server Concurrently (One Documented Command)
```bash
npm run dev
```
> This starts the mock API server on `http://0.0.0.0:4010` and launches the Expo dev server concurrently.

### 3. Open on Your Device or Emulator
* **Android Emulator:** Press `a` in the terminal (automatically connects to `http://10.0.2.2:4010`).
* **Physical Device (Expo Go):** Scan the terminal QR code. Ensure your phone is connected to the same Wi-Fi network. Tap the ⚙ settings icon in the app header to set your computer's LAN IP (e.g. `http://192.168.1.x:4010`).
* **Web Preview:** Press `w` in the terminal to inspect instantly in your browser.

---

## 🧪 Run Automated Tests & Checkpoint Verification
Run the complete test suite verifying all non-negotiables and the exact 13-month checkpoint:

```bash
npm test
```

### Test Coverage Highlights:
* `__tests__/checkpoint.test.ts`: Asserts a **100.00% exact match** for all 13 months of Spend and Income against `checkpoint.json`.
* `__tests__/syncEngine.test.ts`: Verifies boundary record deduplication, out-of-order changes ("latest truth wins"), mutual exclusion of concurrent syncs, and mid-sync crash persistence.
* `__tests__/liveSync.test.ts`: Boots a live mock server process, runs full and incremental syncs over HTTP, and verifies all 4,686 transactions end-to-end.

---

## 🏗️ Architecture & Core Engineering Highlights

### 1. Dual-Schema Normalization Pipeline
* **Forensic Finding:** ~50% of raw data uses modern API contracts (`amount_minor`, `occurred_at` ISO string, `direction`), while ~50% uses legacy scraper contracts (`amount` string decimal, `txn_time` epoch seconds, `type: 'DR'|'CR'`).
* **Solution:** A polymorphic adapter in `src/normalize.ts` transforms heterogeneous records into a unified `NormalizedTransaction` structure at network boundaries.

### 2. Resilient Sync & Boundary Deduplication
* **Pagination Trap:** The mock server intentionally repeats boundary items across pages (`offset + limit - 1`). The sync client deduplicates by `id` on ingest.
* **Network Fault Resilience:** Automatically handles HTTP `429` with `Retry-After` header backoff, retries `500`/`503` server errors with exponential backoff, and handles expired tokens (`410 Gone`) by performing a clean full sync.
* **Crash Proofing:** Checkpoints transactions to local storage after every page. If the app or server dies mid-sync, all previously fetched transactions remain preserved (**Non-negotiable #5**).

### 3. Causal Consistency ("The Latest Truth Wins")
* In `changes.json`, change #49 has an older timestamp (`19:23:33Z`) than change #5 (`19:53:33Z`). Our sync engine enforces causal ordering by comparing `updated_at` before applying mutations or deletions (**Non-negotiable #6**).

### 4. Indian Financial Compliance (`en-IN` & IST)
* **Timezone:** Groups transactions into calendar months based on **Indian Standard Time (UTC+5:30)**.
* **Number Formatting:** Formats currency using Indian numbering (Lakhs and Crores, e.g. `₹2,85,256.89`).
* **Zero Floating-Point Drift:** Maintains all currency math strictly in integer paise.

### 5. Self-Transfers Excluded from Spend/Income
* Self-transfers (`counterparty.type === 'OWN_ACCOUNT'` or `linked_account != null`) are accurately identified, badged in the UI, and excluded from monthly aggregates (**Non-negotiable #4**).

---

## 📁 Assignment Deliverables Index

All written assignment documents are organized in the `docs/` directory:

| Document | Description |
|---|---|
| [**PR Review (Task 3)**](docs/PR_REVIEW.md) | 10 prioritized code review comments on PR #412 with merge-blocking rationales. |
| [**Decision Log**](docs/DECISION_LOG.md) | 10 authentic engineering decisions, rejected alternatives, and trade-offs. |
| [**What the Data Made Us Decide**](docs/DATA_DECISIONS.md) | Forensic documentation of schema discrepancies, overlaps, and timestamp quirks. |
| [**AI Disclosure**](docs/AI_DISCLOSURE.md) | Transparent disclosure of AI tools and a concrete human engineering override. |
| [**What's Unfinished**](docs/UNFINISHED.md) | Honest assessment of deferred features and production roadmap. |
| [**Task 1: Track Screen Teardown**](docs/TASK_1_TEARDOWN.md) | 2-page teardown of the live Simplify Money Track screen. |
| [**Task 0: Feedback & Referrals**](docs/TASK_0_FEEDBACK.md) | Profile onboarding, 3 peer referrals, and brutal feedback report. |

---

## 📱 Android Build & Walkthrough Video

* **Walkthrough Video (Max 5 Mins):** `[Your Unlisted YouTube or Loom Link Here]`
  * *Flow demonstrated:* First launch → full 4,686 transactions loaded → checkpoint totals checked → search & account filter → transaction detail modal → server killed mid-sync → airplane mode restart (offline persistence) → back online → all 9 tests passing.
* **Android APK / Expo Link:** `[Your EAS APK Link or Expo Link Here]`
