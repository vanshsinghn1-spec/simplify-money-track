# What's Unfinished & Production Roadmap

In keeping with engineering integrity (*"Ran out of time is fine. Pretending it works is not"*), the following items are intentionally documented as deferred scope and would be tackled next:

---

### 1. Two-Leg Transfer Pairing in UI
* **Current State:**  
  Self-transfers are accurately identified (`isSelfTransfer: true`), tagged in the row, and completely excluded from spend and income calculations.
* **What's Unfinished:**  
  The two sides of an internal transfer (e.g. debit of ₹25,000 from HDFC Savings and credit of ₹25,000 into ICICI Savings) currently render as two separate rows in their respective account views. In a complete production experience, these two records would be linked visually into a single consolidated "Transferred between HDFC and ICICI" card when viewing the unified "All Accounts" timeline.

---

### 2. Full Background Job Sync via OS Scheduler
* **Current State:**  
  Sync runs on app launch, on pull-to-refresh, and automatically recovers when network reconnects.
* **What's Unfinished:**  
  True background sync when the application is completely killed via `expo-background-fetch` or Android `WorkManager` was not implemented to keep native setup lightweight and avoid OS battery optimization quirks during evaluation.

---

### 3. Date Range Custom Picker
* **Current State:**  
  Users can instantly filter by merchant name, notes, category chips (Food & Dining, Groceries, Daily Commute, Shopping, Travel, Bills, Transfers), and account chips (All Accounts, HDFC Savings, ICICI Savings, HDFC Millennia).
* **What's Unfinished:**  
  A custom calendar date range selector (e.g. arbitrary date ranges such as "15 Jan 2026 to 12 Feb 2026") was deferred in favor of calendar month grouping aligned to Indian Standard Time (IST).

---

### 4. Automated UI Screenshot Testing
* **Current State:**  
  Comprehensive unit and end-to-end integration tests verify checkpoint totals, deduplication, timezone handling, storage chunking, and sync resilience across 100% of test suites. Standalone APK was also built and hosted via EAS Build for Option A.
* **What's Unfinished:**  
  Pixel-level snapshot regression testing (e.g. Maestro or Detox) across various device screen sizes and dark/light system themes.



