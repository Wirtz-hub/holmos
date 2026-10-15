const LOCALE = "en-GB";

export function formatMoney(amount: number | null | undefined, currency = "DKK", opts: { compact?: boolean } = {}) {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "–";
  try {
    return new Intl.NumberFormat(LOCALE, {
      style: "currency",
      currency,
      notation: opts.compact ? "compact" : "standard",
      maximumFractionDigits: opts.compact || Math.abs(amount) >= 1000 ? 0 : 2,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${formatNumber(amount)} ${currency}`;
  }
}

export function formatNumber(value: number | null | undefined, opts: { compact?: boolean; decimals?: number } = {}) {
  if (value === null || value === undefined || Number.isNaN(value)) return "–";
  return new Intl.NumberFormat(LOCALE, {
    notation: opts.compact ? "compact" : "standard",
    maximumFractionDigits: opts.decimals ?? (Number.isInteger(value) ? 0 : 1),
  }).format(value);
}

export function formatPercent(ratio: number | null | undefined) {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "–";
  return new Intl.NumberFormat(LOCALE, { style: "percent", maximumFractionDigits: 2 }).format(ratio);
}

export function formatDateTime(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}

export function formatDate(iso: string) {
  return new Intl.DateTimeFormat(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Copenhagen",
  }).format(new Date(iso));
}
