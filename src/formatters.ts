/**
 * Currency & Locale formatting utilities compliant with Indian financial standards (en-IN).
 * Non-negotiables #2 & #3: Money is exact, and reads the way Indian users read it (Lakhs & Crores).
 */

export function formatINR(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

export function formatIndianNumber(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/**
 * Returns human-readable month string, e.g. "October 2026"
 */
export function formatMonthHeader(monthKey: string): string {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const date = new Date(Date.UTC(year, month, 1));
  return date.toLocaleString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Formats full transaction timestamp into user-friendly IST format
 */
export function formatISTDateTime(isoString: string): string {
  try {
    const date = new Date(isoString);
    return date.toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return isoString;
  }
}

/**
 * Returns IST Day grouping key (YYYY-MM-DD)
 */
export function formatISTDateKey(isoString: string): string {
  try {
    const date = new Date(isoString);
    const istTime = date.getTime() + 5.5 * 60 * 60 * 1000;
    const istDate = new Date(istTime);
    const y = istDate.getUTCFullYear();
    const m = String(istDate.getUTCMonth() + 1).padStart(2, '0');
    const d = String(istDate.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return isoString.slice(0, 10);
  }
}

/**
 * Returns human-readable date section header, e.g. "YESTERDAY · 29 OCT" or "28 OCT 2026"
 */
export function formatISTDayHeader(dateKey: string): string {
  try {
    const [y, m, d] = dateKey.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    const now = new Date();
    const todayKey = formatISTDateKey(now.toISOString());
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const yesterdayKey = formatISTDateKey(yesterday.toISOString());

    const monthShort = date.toLocaleString('en-IN', { month: 'short', timeZone: 'UTC' }).toUpperCase();

    if (dateKey === todayKey) {
      return `TODAY · ${d} ${monthShort}`;
    }
    if (dateKey === yesterdayKey) {
      return `YESTERDAY · ${d} ${monthShort}`;
    }
    return `${d} ${monthShort} ${y}`;
  } catch {
    return dateKey;
  }
}


