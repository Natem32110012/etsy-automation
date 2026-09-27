"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Action, ErrorNote, inputClass, statusLabel } from "@/components/ui";
import { api } from "@/lib/client";
import type { ConceptStatus, ProductType } from "@/lib/types";

type TypeRow = {
  id: ProductType;
  label: string;
  approved: number;
  rejected: number;
  pending: number;
  exported: number;
  pinterestPosted: number;
};

type ConceptRow = {
  id: string;
  title: string;
  etsyTitle: string;
  type: ProductType;
  typeLabel: string;
  status: ConceptStatus;
  theme: string;
  createdAt: string;
  etsyLink: string | null;
  etsyListed: boolean;
  folderPath: string | null;
  pinCount: number;
};

type Payload = {
  byType: TypeRow[];
  totals: { all: number; exported: number; pinterestPosted: number; etsyListed: number };
  rows: ConceptRow[];
};

/** concepts.json'u okuyup type/status üzerinden gruplayan minimal görünüm. */
export function DashboardView() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ProductType | "all">("all");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [pendingRemove, setPendingRemove] = useState<ConceptRow | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    api<Payload>("/api/dashboard")
      .then(setData)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    return filter === "all" ? data.rows : data.rows.filter((row) => row.type === filter);
  }, [data, filter]);

  async function openFolder(id: string) {
    setOpeningId(id);
    setError(null);
    try {
      await api(`/api/concepts/${id}/export/reveal`, {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setOpeningId(null);
    }
  }

  async function toggleListed(row: ConceptRow, listed: boolean) {
    setError(null);
    setData((current) => {
      if (!current) return current;
      return {
        ...current,
        rows: current.rows.map((entry) =>
          entry.id === row.id ? { ...entry, etsyListed: listed } : entry,
        ),
        totals: {
          ...current.totals,
          etsyListed: current.totals.etsyListed + (listed ? 1 : -1),
        },
      };
    });
    try {
      await api(`/api/concepts/${row.id}`, { etsy_listed: listed }, "PATCH");
    } catch (cause) {
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          rows: current.rows.map((entry) =>
            entry.id === row.id ? { ...entry, etsyListed: row.etsyListed } : entry,
          ),
          totals: {
            ...current.totals,
            etsyListed: current.totals.etsyListed + (listed ? -1 : 1),
          },
        };
      });
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function confirmRemove() {
    const row = pendingRemove;
    if (!row) return;
    setRemoving(true);
    setError(null);
    try {
      await api(`/api/concepts/${row.id}`, { archived: true }, "PATCH");
      const payload = await api<Payload>("/api/dashboard");
      setData(payload);
      setPendingRemove(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setRemoving(false);
    }
  }

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Dashboard</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Ürün adına tıklayınca klasörü açılır. Etsy tiki paylaşım takibi içindir. X listeden gizler,
          dosyayı silmez.
        </p>
      </header>

      <ErrorNote message={error} />

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {data.byType.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <p className="text-xs text-zinc-500">{entry.label}</p>
                <p className="mt-1 text-2xl font-semibold text-zinc-50">{entry.approved}</p>
                <p className="mt-1 text-[11px] text-zinc-600">
                  {entry.pending} bekliyor · {entry.rejected} reddedildi
                </p>
              </div>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Toplam konsept" value={data.totals.all} />
            <Stat
              label="Export edildi, Pinterest bekliyor"
              value={data.totals.exported}
              tone="text-amber-300"
            />
            <Stat
              label="Pinterest'e gönderildi"
              value={data.totals.pinterestPosted}
              tone="text-rose-300"
            />
            <Stat
              label="Etsy'de paylaşıldı"
              value={data.totals.etsyListed}
              tone="text-emerald-300"
            />
          </div>

          <div className="mt-10 mb-4 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
              Ürünler ({rows.length})
            </h2>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value as ProductType | "all")}
              className={`${inputClass} mt-0 w-48`}
            >
              <option value="all">Tüm tipler</option>
              {data.byType.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Etsy</th>
                  <th className="px-4 py-3 font-medium">Ürün</th>
                  <th className="px-4 py-3 font-medium">Tip</th>
                  <th className="px-4 py-3 font-medium">Tarih</th>
                  <th className="px-4 py-3 font-medium">Durum</th>
                  <th className="px-4 py-3 font-medium">Pin</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <label
                          className="inline-flex cursor-pointer items-center"
                          title="Etsy'de paylaştım"
                        >
                          <input
                            type="checkbox"
                            checked={row.etsyListed}
                            onChange={(event) => toggleListed(row, event.target.checked)}
                            className="size-4 rounded border-white/20 bg-black/40 accent-emerald-500"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => setPendingRemove(row)}
                          className="grid size-6 place-items-center rounded-md border border-white/10 text-zinc-500 hover:border-rose-400/50 hover:text-rose-300"
                          title="Listeden kaldır"
                          aria-label={`${row.title} ürününü listeden kaldır`}
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="max-w-xs px-4 py-3">
                      <button
                        type="button"
                        onClick={() => openFolder(row.id)}
                        disabled={openingId === row.id}
                        className="block w-full truncate text-left text-zinc-200 underline-offset-2 hover:text-violet-200 hover:underline disabled:opacity-50"
                        title="Klasörü aç"
                      >
                        {openingId === row.id ? "açılıyor…" : row.title}
                      </button>
                      {row.theme && (
                        <span className="block truncate text-xs text-zinc-600">{row.theme}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{row.typeLabel}</td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {row.createdAt.slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{statusLabel(row.status)}</td>
                    <td className="px-4 py-3 text-zinc-500">{row.pinCount || "-"}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-600">
                      Kayıt yok.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {pendingRemove && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="remove-title"
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-zinc-950 p-5 shadow-2xl">
            <h2 id="remove-title" className="text-lg font-semibold text-zinc-50">
              Emin misin?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              “{pendingRemove.title}” listeden kalkacak. Klasör ve dosyalar silinmez; sadece bu
              listede görünmez.
            </p>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Action
                label="Vazgeç"
                tone="ghost"
                disabled={removing}
                onClick={() => setPendingRemove(null)}
              />
              <Action
                label="Evet, kaldır"
                tone="rose"
                busy={removing}
                onClick={() => void confirmRemove()}
              />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Stat({
  label,
  value,
  tone = "text-zinc-50",
}: {
  label: string;
  value: number;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
