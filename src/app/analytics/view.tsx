"use client";

import { useEffect, useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { Action, ErrorNote, inputClass } from "@/components/ui";
import { api } from "@/lib/client";

type Analytics = {
  last_snapshot_at: string | null;
  totals: {
    listings: number;
    active: number;
    draft: number;
    views: number;
    favorites: number;
    orders: number;
    revenue: number;
    aov: number;
  };
  rows: Array<{
    listing_id: number;
    title: string;
    state: string;
    views: number;
    views_delta: number;
    num_favorers: number;
    quantity: number;
    price: number;
    created: string | null;
    type: string | null;
    url: string;
    sales: number;
    revenue: number;
  }>;
  trend: Array<{ date: string; views: number; favorites: number; revenue: number }>;
  top_views: Array<{ listing_id: number; title: string; views: number }>;
  top_sales: Array<{ listing_id: number; title: string; sales: number }>;
  by_type: Array<{ type: string; views: number; sales: number; revenue: number }>;
};

export function AnalyticsView() {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sort, setSort] = useState<"views" | "sales" | "favorites">("views");
  const [stateFilter, setStateFilter] = useState("all");

  async function load() {
    const stats = await api<Analytics>("/api/etsy/analytics");
    setAnalytics(stats);
  }

  useEffect(() => {
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  async function refresh() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/etsy/analytics", {});
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  const listingRows = useMemo(() => {
    const rows = analytics?.rows ?? [];
    const filtered = stateFilter === "all" ? rows : rows.filter((row) => row.state === stateFilter);
    return [...filtered].sort((a, b) => {
      if (sort === "sales") return b.sales - a.sales;
      if (sort === "favorites") return b.num_favorers - a.num_favorers;
      return b.views - a.views;
    });
  }, [analytics, sort, stateFilter]);

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-10">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Analytics</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
            Views, favorites, and sales from the latest shop snapshot. Refresh pulls a new snapshot from Etsy.
          </p>
        </div>
        <Action
          icon={<BarChart3 className="size-4" />}
          label="Refresh snapshot"
          busy={busy}
          onClick={() => void refresh()}
        />
      </header>

      <ErrorNote message={error} />

      {!analytics && !error && <p className="text-sm text-zinc-500">Loading shop snapshot…</p>}

      {analytics && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Revenue (TRY)" value={analytics.totals.revenue.toFixed(2)} />
            <Stat label="Orders" value={String(analytics.totals.orders)} />
            <Stat label="Average order" value={analytics.totals.aov.toFixed(2)} />
            <Stat label="Views" value={String(analytics.totals.views)} />
            <Stat label="Favorites" value={String(analytics.totals.favorites)} />
            <Stat label="Active listings" value={String(analytics.totals.active)} />
            <Stat label="Drafts" value={String(analytics.totals.draft)} />
            <Stat
              label="Last snapshot"
              value={analytics.last_snapshot_at ? analytics.last_snapshot_at.slice(0, 16).replace("T", " ") : "—"}
            />
          </div>

          {analytics.trend.length > 1 && (
            <div className="rounded-2xl border border-white/10 p-4">
              <p className="mb-3 text-sm font-medium text-zinc-200">Views trend</p>
              <TrendBars points={analytics.trend} />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <TopList title="Most viewed" rows={analytics.top_views.map((r) => ({ name: r.title, value: r.views }))} />
            <TopList title="Most sold" rows={analytics.top_sales.map((r) => ({ name: r.title, value: r.sales }))} />
          </div>

          {analytics.by_type.length > 0 && (
            <TopList
              title="By product type"
              rows={analytics.by_type.map((row) => ({
                name: `${row.type} · ${row.sales} sales`,
                value: row.views,
              }))}
            />
          )}

          <div className="flex flex-wrap gap-3">
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className={inputClass}>
              <option value="views">Sort by views</option>
              <option value="sales">Sort by sales</option>
              <option value="favorites">Sort by favorites</option>
            </select>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className={inputClass}>
              <option value="all">All states</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="inactive">Inactive</option>
              <option value="sold_out">Sold out</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/5 text-[11px] uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3">Listing</th>
                  <th className="px-4 py-3">State</th>
                  <th className="px-4 py-3">Views</th>
                  <th className="px-4 py-3">Favorites</th>
                  <th className="px-4 py-3">Sales</th>
                  <th className="px-4 py-3">Price</th>
                </tr>
              </thead>
              <tbody>
                {listingRows.map((row) => (
                  <tr key={row.listing_id} className="border-t border-white/5">
                    <td className="px-4 py-3">
                      <a href={row.url} className="text-zinc-100 hover:underline" target="_blank" rel="noreferrer">
                        {row.title}
                      </a>
                      <p className="text-[11px] text-zinc-600">{row.type ?? "unlinked"}</p>
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{row.state}</td>
                    <td className="px-4 py-3 text-zinc-200">
                      {row.views}
                      {row.views_delta !== 0 && (
                        <span className="ml-1 text-[11px] text-zinc-500">
                          {row.views_delta > 0 ? "+" : ""}
                          {row.views_delta}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-200">{row.num_favorers}</td>
                    <td className="px-4 py-3 text-zinc-200">{row.sales}</td>
                    <td className="px-4 py-3 text-zinc-200">{row.price.toFixed(2)} TRY</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-zinc-50">{value}</p>
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: Array<{ name: string; value: number }> }) {
  return (
    <div className="rounded-2xl border border-white/10 p-4">
      <p className="mb-3 text-sm font-medium text-zinc-200">{title}</p>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.name} className="flex justify-between gap-3 text-sm">
            <span className="truncate text-zinc-300">{row.name || "Untitled"}</span>
            <span className="text-zinc-50">{row.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TrendBars({ points }: { points: Array<{ date: string; views: number }> }) {
  const max = Math.max(...points.map((p) => p.views), 1);
  return (
    <div className="flex h-32 items-end gap-1">
      {points.map((point) => (
        <div key={point.date} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t bg-violet-500/70"
            style={{ height: `${Math.max(6, (point.views / max) * 100)}%` }}
            title={`${point.date}: ${point.views}`}
          />
        </div>
      ))}
    </div>
  );
}
