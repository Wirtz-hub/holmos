import Link from "next/link";
import { DailyChart } from "@/components/dashboard/daily-chart";
import { Card, CardHeader, Notice, PlatformBadge } from "@/components/ui";
import { displayAccountId, platformName } from "@/lib/ads/display";
import type { AccountSummary, ClientReport, Totals } from "@/lib/ads/report";
import { formatMoney, formatNumber, formatPercent } from "@/lib/format";
import { goalInfo } from "@/lib/pipeline";
import type { Goal } from "@/lib/types";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
      {sub && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function StatTiles({ totals, currency, goal }: { totals: Totals; currency: string; goal: Goal }) {
  const info = goalInfo(goal);
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
      <StatTile label="Spend" value={formatMoney(totals.spend, currency)} />
      <StatTile
        label="Impressions"
        value={formatNumber(totals.impressions, { compact: totals.impressions >= 100_000 })}
        sub={totals.reach !== null ? `${formatNumber(totals.reach, { compact: totals.reach >= 100_000 })} reached on Meta` : undefined}
      />
      <StatTile label="Clicks" value={formatNumber(totals.clicks)} sub={`${formatPercent(totals.ctr)} click-through rate`} />
      <StatTile label={info.plural} value={formatNumber(totals.results, { decimals: 1 })} />
      <StatTile
        label={info.costLabel}
        value={totals.costPerResult !== null ? formatMoney(totals.costPerResult, currency) : "–"}
        sub={totals.costPerResult === null ? `No ${info.plural.toLowerCase()} in this period` : undefined}
      />
    </div>
  );
}

function resultKeysLabel(account: AccountSummary) {
  if (account.resultKeys === "all") return "all conversions";
  return account.resultKeys?.join(" + ") ?? "";
}

function AccountsTable({ accounts, goal }: { accounts: AccountSummary[]; goal: Goal }) {
  const info = goalInfo(goal);
  return (
    <Card>
      <CardHeader title="By ad account" />
      <div className="relative overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-100">
              <th className="px-5 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 text-right font-medium">Spend</th>
              <th className="hidden px-4 py-2.5 text-right font-medium md:table-cell">Impressions</th>
              <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Clicks</th>
              <th className="hidden px-4 py-2.5 text-right font-medium lg:table-cell">CTR</th>
              <th className="px-4 py-2.5 text-right font-medium whitespace-nowrap">{info.plural}</th>
              <th className="px-5 py-2.5 text-right font-medium whitespace-nowrap">{info.costLabel}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {accounts.map((account) => {
              const t = account.totals;
              return (
                <tr key={account.accountId} className="align-top">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <PlatformBadge platform={account.platform} />
                      <span className="font-medium text-slate-800">{account.name}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400 tabular">
                      {displayAccountId({ platform: account.platform, external_account_id: account.externalId })} · {account.currency}
                    </p>
                    {account.error && <p className="mt-1 max-w-md text-xs text-rose-600">{account.error}</p>}
                    {t && Object.keys(account.reportedConversions).length > 0 && (
                      <details className="mt-1 text-xs text-slate-500">
                        <summary className="cursor-pointer select-none hover:text-slate-800">
                          What {platformName(account.platform)} reported
                        </summary>
                        <p className="mt-1">
                          Counting as {info.plural.toLowerCase()}: <span className="font-mono">{resultKeysLabel(account)}</span>
                        </p>
                        <ul className="mt-1 space-y-0.5 font-mono">
                          {Object.entries(account.reportedConversions)
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 25)
                            .map(([key, value]) => (
                              <li key={key}>
                                {key}: {formatNumber(value, { decimals: 1 })}
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular">{t ? formatMoney(t.spend, account.currency) : "–"}</td>
                  <td className="hidden px-4 py-3 text-right tabular md:table-cell">{t ? formatNumber(t.impressions) : "–"}</td>
                  <td className="hidden px-4 py-3 text-right tabular sm:table-cell">{t ? formatNumber(t.clicks) : "–"}</td>
                  <td className="hidden px-4 py-3 text-right tabular lg:table-cell">{t ? formatPercent(t.ctr) : "–"}</td>
                  <td className="px-4 py-3 text-right tabular">{t ? formatNumber(t.results, { decimals: 1 }) : "–"}</td>
                  <td className="px-5 py-3 text-right tabular">
                    {t?.costPerResult != null ? formatMoney(t.costPerResult, account.currency) : "–"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export function ReportView({ report, goal }: { report: ClientReport; goal: Goal }) {
  const failed = report.accounts.filter((a) => a.error);
  const needsReconnect = failed.some((a) => a.needsReconnect);
  const multiCurrency = report.groups.length > 1;

  return (
    <div className="space-y-6">
      {failed.length > 0 && (
        <Notice kind="warning">
          {failed.length === report.accounts.length ? "Couldn't load any ad accounts" : `Couldn't load ${failed.length} of ${report.accounts.length} ad accounts`}{" "}
          — the numbers below leave {failed.length === 1 ? "it" : "them"} out.{" "}
          {needsReconnect && (
            <Link href="/ad-accounts" className="font-medium underline underline-offset-2">
              Reconnect on the Ad accounts page
            </Link>
          )}
        </Notice>
      )}

      {report.groups.map((group) => (
        <section key={group.currency} className="space-y-4" aria-label={`${group.currency} accounts`}>
          {multiCurrency && (
            <h2 className="text-sm font-semibold text-slate-700">
              Accounts billed in {group.currency}
              <span className="font-normal text-slate-500"> — totals are kept separate per currency</span>
            </h2>
          )}
          <StatTiles totals={group.totals} currency={group.currency} goal={goal} />
          <DailyChart daily={group.daily} platforms={group.platforms} currency={group.currency} resultsLabel={goalInfo(goal).plural} />
        </section>
      ))}

      <AccountsTable accounts={report.accounts} goal={goal} />
    </div>
  );
}
