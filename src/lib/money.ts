import { formatMoney } from "@/lib/format";

/** "DKK 120,000" — or "DKK 120,000 + €4,000" when deals use several currencies. */
export function sumByCurrency(items: { deal_value: number | null; currency: string }[], compact = false) {
  const totals = new Map<string, number>();
  for (const item of items) {
    if (item.deal_value === null || item.deal_value === undefined) continue;
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + Number(item.deal_value));
  }
  if (totals.size === 0) return null;
  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([currency, total]) => formatMoney(total, currency, { compact }))
    .join(" + ");
}
