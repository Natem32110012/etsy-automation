"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, FolderOpen, X } from "lucide-react";
import { Action, ErrorNote } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedConcept } from "@/lib/serialize";

function pinReady(concept: SerializedConcept) {
  if (concept.status === "concept_pending" || concept.status === "concept_rejected") return false;
  const listed = Boolean(concept.etsy_listing_id || concept.etsy_link);
  const photos =
    Boolean(concept.folder_path) ||
    concept.images.some((slot) => slot.kind === "promo" && slot.status === "approved");
  return listed || photos;
}

export function PinsView() {
  const [concepts, setConcepts] = useState<SerializedConcept[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ src: string; label: string } | null>(null);

  useEffect(() => {
    api<{ concepts: SerializedConcept[] }>("/api/concepts")
      .then((data) => setConcepts(data.concepts))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  const rows = useMemo(() => {
    return concepts
      .filter(pinReady)
      .slice()
      .sort((a, b) => {
        if (a.pinterest_shared !== b.pinterest_shared) return a.pinterest_shared ? 1 : -1;
        return b.created_at.localeCompare(a.created_at);
      });
  }, [concepts]);

  const waiting = rows.filter((row) => !row.pinterest_shared).length;

  function replace(updated: SerializedConcept) {
    setConcepts((current) => current.map((concept) => (concept.id === updated.id ? updated : concept)));
  }

  async function toggleShared(concept: SerializedConcept) {
    setBusy(`tick-${concept.id}`);
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept }>(
        `/api/concepts/${concept.id}`,
        { pinterest_shared: !concept.pinterest_shared },
        "PATCH",
      );
      replace(result.concept);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function openPhotos(id: string) {
    setBusy(`open-${id}`);
    setError(null);
    try {
      await api(`/api/concepts/${id}/export/reveal`, { scope: "promo" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function generateCopy(id: string) {
    setBusy(`copy-${id}`);
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept }>(`/api/concepts/${id}/pinterest`, {
        action: "copy",
      });
      replace(result.concept);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Pins</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Tick a row after you post it on Pinterest. Click the product name to open its photo folder.
          {rows.length > 0 ? ` ${waiting} waiting, ${rows.length - waiting} posted.` : ""}
        </p>
      </header>

      <ErrorNote message={error} />

      {rows.length === 0 && !error && (
        <p className="text-sm text-zinc-500">No exported products yet.</p>
      )}

      <div className="space-y-4">
        {rows.map((concept) => {
          const link =
            concept.etsy_link ??
            (concept.etsy_listing_id ? `https://www.etsy.com/listing/${concept.etsy_listing_id}` : "");
          const promos = concept.images.filter(
            (slot) => slot.kind === "promo" && slot.status === "approved",
          );
          return (
            <article
              key={concept.id}
              className={`rounded-2xl border p-4 ${
                concept.pinterest_shared
                  ? "border-white/5 bg-white/[0.015] opacity-70"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              <div className="flex items-start gap-3">
                <label className="mt-1 flex shrink-0 items-center gap-2 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={concept.pinterest_shared}
                    disabled={busy === `tick-${concept.id}`}
                    onChange={() => void toggleShared(concept)}
                    className="size-4 accent-violet-500"
                  />
                  Posted
                </label>
                <button
                  type="button"
                  onClick={() => void openPhotos(concept.id)}
                  disabled={busy === `open-${concept.id}`}
                  className="min-w-0 text-left"
                >
                  <span className="inline-flex items-center gap-2 text-base font-medium text-zinc-50 hover:underline">
                    <FolderOpen className="size-4 shrink-0 text-zinc-400" />
                    {concept.etsy_title || concept.title}
                  </span>
                  {concept.summary_tr && (
                    <span className="mt-1 block text-sm text-zinc-400">{concept.summary_tr}</span>
                  )}
                </button>
              </div>

              {concept.pinterest_title ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <CopyBox label="Headline" value={concept.pinterest_title} />
                  <CopyBox label="Description" value={concept.pinterest_description ?? ""} multiline />
                  <CopyBox label="Product link" value={link} />
                </div>
              ) : (
                <div className="mt-4">
                  <Action
                    label="Generate copy"
                    tone="ghost"
                    busy={busy === `copy-${concept.id}`}
                    onClick={() => void generateCopy(concept.id)}
                  />
                </div>
              )}

              {promos.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {promos.map((slot, index) => {
                    const selected = slot.generations.find((g) => g.id === slot.selected_generation_id);
                    return (
                      <button
                        key={slot.key}
                        type="button"
                        disabled={!selected}
                        onClick={() =>
                          selected && setPreview({ src: selected.url, label: `Promo ${index + 1}` })
                        }
                        className="overflow-hidden rounded-lg border border-white/10 text-left hover:border-violet-400/50 disabled:opacity-40"
                      >
                        {selected && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={selected.url} alt="" className="h-24 w-16 object-cover" />
                        )}
                        <span className="block px-1 py-0.5 text-center text-[10px] text-zinc-500">
                          promo {index + 1}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {preview && <PhotoPreview src={preview.src} label={preview.label} onClose={() => setPreview(null)} />}
    </main>
  );
}

function PhotoPreview({ src, label, onClose }: { src: string; label: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={label}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/50 p-2 text-zinc-200 hover:bg-white/10"
        aria-label="Close"
      >
        <X className="size-5" />
      </button>
      <div className="flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-2" onClick={(event) => event.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={label} className="max-h-[86vh] max-w-[92vw] object-contain shadow-2xl" />
        <p className="text-sm text-zinc-300">{label}</p>
      </div>
    </div>
  );
}

function CopyBox({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <CopyButton value={value} />
      </div>
      <p className={`mt-1.5 text-sm text-zinc-200 ${multiline ? "leading-relaxed" : "break-all font-medium"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      disabled={!value}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-40"
    >
      {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
