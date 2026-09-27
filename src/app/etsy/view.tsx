"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, RefreshCw, Store, X } from "lucide-react";
import { Action, ErrorNote, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/client";
import { TaxonomyPicker } from "../etsy-draft-panel";

type Status = {
  ready: boolean;
  connected: boolean;
  shop_id: number | null;
  shop_name: string | null;
  connected_at: string | null;
  last_snapshot_at: string | null;
  redirect_uri: string;
  defaults: { prices: Record<string, number>; quantity: number };
  taxonomy_by_type: Record<string, number>;
  taxonomy: Array<{ id: number; name: string; path: string }>;
  taxonomy_count: number;
};

type PendingRow = {
  id: string;
  title: string;
  etsy_title: string;
  etsy_description: string;
  etsy_tags: string[];
  etsy_listing_id: number | null;
  etsy_listing_state: string;
  etsy_listing_error: string | null;
  etsy_price: number | null;
  etsy_quantity: number | null;
  etsy_taxonomy_id: number | null;
  preview: string | null;
  type: string;
  editorUrl: string | null;
};

export function EtsyShopView() {
  const [status, setStatus] = useState<Status | null>(null);
  const [pending, setPending] = useState<PendingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<PendingRow | null>(null);

  const params = useMemo(
    () => (typeof window === "undefined" ? new URLSearchParams() : new URLSearchParams(window.location.search)),
    [],
  );

  async function load() {
    const shop = await api<Status>("/api/etsy/status");
    setStatus(shop);
    const wait = await api<{ concepts: PendingRow[] }>("/api/etsy/pending");
    setPending(wait.concepts);
  }

  useEffect(() => {
    const oauthError = params.get("error");
    if (oauthError) setError(oauthError);
    load().catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, [params]);

  async function run(id: string, fn: () => Promise<void>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Etsy Shop</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Drafts stay unpublished until you click Approve &amp; publish. Nothing goes live automatically.
        </p>
      </header>

      <ErrorNote message={error} />

      <section className="mb-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-zinc-200">Connection</p>
            {status?.connected ? (
              <p className="mt-1 text-xs text-emerald-300">
                Connected as {status.shop_name ?? "shop"} (id {status.shop_id})
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-500">
                Redirect URI to add in the Etsy app: {status?.redirect_uri}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            {status?.connected && (
              <Action
                icon={<RefreshCw className="size-4" />}
                label="Refresh taxonomy & sections"
                tone="ghost"
                busy={busy === "tax"}
                onClick={() => run("tax", () => api("/api/etsy/taxonomy", {}))}
              />
            )}
            <a
              href="/api/etsy/connect"
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-3.5 py-2 text-sm font-medium text-white hover:bg-violet-500"
            >
              {status?.connected ? <Link2 className="size-4" /> : <Store className="size-4" />}
              {status?.connected ? "Reconnect shop" : "Connect Etsy"}
            </a>
          </div>
        </div>
        {!status?.ready && (
          <p className="mt-3 text-xs text-amber-300">Add ETSY_API_KEY and ETSY_SHARED_SECRET to .env.local, then restart the server.</p>
        )}
      </section>

      <section className="space-y-4">
          {pending.length === 0 && (
            <p className="text-sm text-zinc-500">No drafts waiting. Export a product, then send it as an Etsy draft.</p>
          )}
          {pending.map((row) => (
            <article key={row.id} className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              {row.etsy_listing_id && (
                <button
                  type="button"
                  disabled={busy !== null}
                  title="Remove from this list"
                  aria-label="Remove from this list"
                  className="absolute right-3 top-3 grid size-7 place-items-center rounded-md border border-white/10 text-zinc-500 hover:border-rose-400/50 hover:text-rose-300 disabled:opacity-40"
                  onClick={() =>
                    run(`hide-${row.id}`, () =>
                      api(`/api/etsy/listings/${row.etsy_listing_id}`, { action: "dismiss" }),
                    )
                  }
                >
                  <X className="size-3.5" />
                </button>
              )}
              <div className="flex flex-col gap-4 sm:flex-row">
                {row.preview && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={row.preview} alt="" className="h-40 w-28 rounded-lg object-cover" />
                )}
                <div className="min-w-0 flex-1 pr-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-medium text-zinc-50">{row.etsy_title}</h2>
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[11px] uppercase text-zinc-400">
                      {row.etsy_listing_state}
                    </span>
                    {row.etsy_price != null && (
                      <span className="text-xs text-zinc-400">{row.etsy_price.toFixed(2)} TRY</span>
                    )}
                  </div>
                  <p className="mt-2 max-h-24 overflow-auto text-xs leading-relaxed text-zinc-500">
                    {row.etsy_description}
                  </p>
                  <p className="mt-2 text-[11px] text-zinc-600">{row.etsy_tags.join(" · ")}</p>
                  <p className="mt-2 text-[11px] text-amber-200/80">
                    Tick “With an AI generator” in the Etsy editor before publish. The API cannot set that radio.
                  </p>
                  {row.etsy_listing_error && (
                    <p className="mt-2 text-xs text-rose-300">{row.etsy_listing_error}</p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {row.etsy_listing_state === "failed" && row.etsy_listing_id && (
                      <Action
                        label="Retry upload"
                        busy={busy === `retry-${row.id}`}
                        onClick={() =>
                          run(`retry-${row.id}`, () =>
                            api(`/api/etsy/listings/${row.etsy_listing_id}`, { action: "retry" }),
                          )
                        }
                      />
                    )}
                    {row.etsy_listing_state === "draft" && row.etsy_listing_id && (
                      <Action
                        label="Approve & publish"
                        tone="emerald"
                        busy={busy === `pub-${row.id}`}
                        onClick={() =>
                          run(`pub-${row.id}`, () =>
                            api(`/api/etsy/listings/${row.etsy_listing_id}`, { action: "publish" }),
                          )
                        }
                      />
                    )}
                    <Action label="Edit" tone="ghost" onClick={() => setEditing(row)} />
                    {row.editorUrl && (
                      <a
                        href={row.editorUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
                      >
                        Open in Etsy editor
                      </a>
                    )}
                    {row.etsy_listing_id && (
                      <Action
                        label="Reject / delete"
                        tone="rose"
                        busy={busy === `del-${row.id}`}
                        onClick={() =>
                          run(`del-${row.id}`, () =>
                            api(`/api/etsy/listings/${row.etsy_listing_id}`, { action: "reject" }),
                          )
                        }
                      />
                    )}
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

      {editing && editing.etsy_listing_id && (
        <EditDrawer
          row={editing}
          busy={busy === "save"}
          onClose={() => setEditing(null)}
          onSave={async (payload) => {
            await run("save", () =>
              api(`/api/etsy/listings/${editing.etsy_listing_id}`, { action: "save", ...payload }),
            );
            setEditing(null);
          }}
        />
      )}
    </main>
  );
}

function EditDrawer({
  row,
  busy,
  onClose,
  onSave,
}: {
  row: PendingRow;
  busy: boolean;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    description: string;
    tags: string[];
    price: number;
    quantity: number;
    taxonomyId?: number;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(row.etsy_title);
  const [description, setDescription] = useState(row.etsy_description);
  const [tags, setTags] = useState(row.etsy_tags.join(", "));
  const [price, setPrice] = useState(String(row.etsy_price ?? ""));
  const [quantity, setQuantity] = useState(String(row.etsy_quantity ?? 999));
  const [taxonomyId, setTaxonomyId] = useState<number | null>(row.etsy_taxonomy_id);

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-black/60 p-4 sm:place-items-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-2xl border border-white/10 bg-zinc-950 p-5">
        <h3 className="text-lg font-medium text-zinc-50">Edit draft</h3>
        <div className="mt-4 space-y-3">
          <Field label="Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} maxLength={140} />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={`${inputClass} min-h-40`} />
          </Field>
          <Field label="Tags">
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (TRY)">
              <input value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} />
            </Field>
            <Field label="Quantity">
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className={inputClass} />
            </Field>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Category</p>
            <TaxonomyPicker value={taxonomyId} onChange={setTaxonomyId} />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Action label="Cancel" tone="ghost" onClick={onClose} />
          <Action
            label="Save draft"
            busy={busy}
            onClick={() =>
              onSave({
                title,
                description,
                tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
                price: Number(price),
                quantity: Number(quantity),
                taxonomyId: taxonomyId ?? undefined,
              })
            }
          />
        </div>
      </div>
    </div>
  );
}
