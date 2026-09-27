"use client";

import { useEffect, useState } from "react";
import { Check, Copy, FolderOpen, Package, Sparkles } from "lucide-react";
import { Action, ErrorNote, StatusPill } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedConcept } from "@/lib/serialize";
import type { QualitySettings } from "@/lib/types";
import { productSlots, slotUnlocked, PROMO_COUNT_MIN } from "@/lib/types";
import { EtsyDraftPanel } from "./etsy-draft-panel";
import { ImageSlotCard } from "./image-slot";

/** Adım 2–4: görsel onayı → export → Etsy draft → Pinterest copy kit. */
export function ProductionCard({
  concept,
  quality,
  onChange,
}: {
  concept: SerializedConcept;
  quality: QualitySettings;
  onChange: (concept: SerializedConcept) => void;
}) {
  const [busy, setBusy] = useState<"all" | "export" | "reveal" | "pin" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const listed = Boolean(concept.etsy_listing_id) && concept.etsy_listing_state !== "deleted";

  const productPages = productSlots(concept.images);
  const promoSlots = concept.images.filter((slot) => slot.kind === "promo");
  const allProductsApproved = productPages.every((slot) => slot.status === "approved");
  const allApproved = concept.images.every((slot) => slot.status === "approved");
  const exported = Boolean(concept.folder_path);

  /** Sırayla üretim: kilitli kareler (sayfa 2 veya promo) referans bekler. */
  async function generateRemaining() {
    setBusy("all");
    setError(null);
    setNote(null);
    try {
      let current = concept;
      const targets = current.images.filter(
        (slot) =>
          (slot.status === "pending" || slot.status === "failed") &&
          slotUnlocked(current.images, slot, current.type),
      );

      for (const slot of targets) {
        const result = await api<{ concept: SerializedConcept }>(
          `/api/concepts/${current.id}/images/${slot.key}`,
          { action: "generate", quality: quality[slot.kind], overlayText: slot.overlay_text },
        );
        current = result.concept;
        onChange(current);
      }

      const stillLocked = current.images.some(
        (slot) =>
          (slot.status === "pending" || slot.status === "failed") &&
          !slotUnlocked(current.images, slot, current.type),
      );
      if (stillLocked) {
        setNote(
          allProductsApproved
            ? "Ürün sayfalarını onaylayınca promo kareleri de üretilebilir."
            : current.type === "paperdoll"
              ? "Sayfa 1'i onaylayınca kıyafetler, sayfa 2'yi onaylayınca aksesuarlar açılır."
              : "Sayfa 1'i onaylayınca diğer sayfalar, hepsini onaylayınca promo açılır.",
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function runExport() {
    setBusy("export");
    setError(null);
    setNote(null);
    try {
      const result = await api<{ concept: SerializedConcept; folder: string; fileCount: number }>(
        `/api/concepts/${concept.id}/export`,
        {},
      );
      onChange(result.concept);
      setNote(`${result.fileCount} dosya yazıldı: ${result.folder}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function reveal() {
    setBusy("reveal");
    setError(null);
    try {
      await api(`/api/concepts/${concept.id}/export/reveal`, {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function generatePinCopy() {
    setBusy("pin");
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept }>(`/api/concepts/${concept.id}/pinterest`, {
        action: "copy",
      });
      onChange(result.concept);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold text-zinc-50">{concept.title}</h3>
          <p className="mt-1 text-xs text-zinc-500">
            {concept.theme && <span className="text-violet-300/80">{concept.theme} · </span>}
            {concept.images.filter((slot) => slot.status === "approved").length}/
            {concept.images.length} görsel onaylı
          </p>
        </div>
        <StatusPill status={concept.status} />
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {productPages.map((slot, index) => (
          <ImageSlotCard
            key={slot.key}
            conceptId={concept.id}
            conceptType={concept.type}
            slot={slot}
            index={index}
            quality={quality.product}
            locked={busy === "all" || !slotUnlocked(concept.images, slot, concept.type)}
            lockHint={
              slot.key !== productPages[0]?.key
                ? concept.type === "paperdoll"
                    ? slot.key === "product-3"
                      ? "Sayfa 2 onaylanınca açılır. Aksesuarlar sayfa 2 ile aynı ölçekte; bebeğin ayağına ve eline oturur."
                      : "Sayfa 1 onaylanınca açılır. Bebek yalnızca sayfa 1'de; burada parça kıyafet ızgarası (üst, etek, pantolon) üretilir — boydan elbise yok."
                  : concept.type === "party" || concept.type === "favortags"
                    ? "Bu ürün tek sayfa; ikinci sayfa üretilmez."
                    : "Sayfa 1 onaylanınca açılır — onu referans alarak aynı paketin devamı üretilir."
                : undefined
            }
            onChange={onChange}
          />
        ))}
        {promoSlots.map((slot, index) => (
          <ImageSlotCard
            key={slot.key}
            conceptId={concept.id}
            conceptType={concept.type}
            slot={slot}
            index={index + 1}
            quality={quality.promo}
            locked={!allProductsApproved || busy === "all"}
            lockHint="Bütün ürün sayfaları onaylanınca açılır — promo onları referans alıyor."
            canDrop={!listed && promoSlots.length > PROMO_COUNT_MIN}
            onChange={onChange}
          />
        ))}
      </div>

      <ErrorNote message={error} />
      {note && (
        <p className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
          {note}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-white/5 pt-4">
        <Action
          icon={<Sparkles className="size-4" />}
          label="Kalanları sırayla üret"
          busy={busy === "all"}
          disabled={busy !== null || allApproved}
          onClick={generateRemaining}
        />
        <Action
          icon={<Package className="size-4" />}
          label={exported ? "Export'u yenile" : "Export et"}
          tone="emerald"
          busy={busy === "export"}
          disabled={busy !== null || !allApproved}
          onClick={runExport}
        />
        {exported && (
          <Action
            icon={<FolderOpen className="size-4" />}
            label="Klasörü aç"
            tone="ghost"
            busy={busy === "reveal"}
            disabled={busy !== null}
            onClick={reveal}
          />
        )}
      </div>

      {exported && (
        <EtsyDraftPanel concept={concept} onChange={onChange} disabled={busy !== null} />
      )}

      {exported && listed && (
        <PinterestPanel
          concept={concept}
          busy={busy === "pin"}
          disabled={busy !== null}
          onGenerate={generatePinCopy}
        />
      )}
    </article>
  );
}

/** Manual Pinterest kit: copy headline, description, and store URL. Nothing is posted. */
function PinterestPanel({
  concept,
  busy,
  disabled,
  onGenerate,
}: {
  concept: SerializedConcept;
  busy: boolean;
  disabled: boolean;
  onGenerate: () => void;
}) {
  const storeLink =
    concept.etsy_link ??
    (concept.etsy_listing_id ? `https://www.etsy.com/listing/${concept.etsy_listing_id}` : "");
  const promos = concept.images.filter(
    (slot) => slot.kind === "promo" && slot.status === "approved",
  );

  useEffect(() => {
    if (concept.pinterest_title || busy || disabled) return;
    onGenerate();
    // Generate once after the Etsy draft exists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept.id, concept.pinterest_title]);

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">Pinterest</p>
          <p className="mt-1 text-xs text-zinc-500">
            Copy the headline, description and store link into Pinterest. Nothing is posted
            automatically.
          </p>
        </div>
        <Action
          label={concept.pinterest_title ? "Regenerate copy" : "Generate copy"}
          tone="ghost"
          busy={busy}
          disabled={disabled}
          onClick={onGenerate}
        />
      </div>

      <CopyBox label="Headline" value={concept.pinterest_title ?? (busy ? "Writing…" : "")} />
      <CopyBox
        label="Description"
        value={concept.pinterest_description ?? (busy ? "Writing…" : "")}
        multiline
      />

      <div className="mt-3 rounded-xl border border-rose-400/30 bg-rose-500/10 p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-rose-200/80">
              Product link
            </p>
            <p className="mt-1 break-all font-mono text-sm text-zinc-100">{storeLink || "—"}</p>
          </div>
          <CopyButton value={storeLink} disabled={!storeLink} />
        </div>
      </div>

      {promos.length > 0 && (
        <div className="mt-3">
          <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Pin photos — upload these in Pinterest
          </p>
          <div className="flex flex-wrap gap-2">
            {promos.map((slot, index) => {
              const selected = slot.generations.find((g) => g.id === slot.selected_generation_id);
              return (
                <div key={slot.key} className="overflow-hidden rounded-lg border border-white/10">
                  {selected && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={selected.url} alt="" className="h-24 w-16 object-cover" />
                  )}
                  <span className="block px-1 py-0.5 text-center text-[10px] text-zinc-500">
                    promo {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function CopyBox({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="mt-3 rounded-lg border border-white/10 bg-black/30 p-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <CopyButton value={value} disabled={!value || value === "Writing…"} />
      </div>
      <p className={`mt-1.5 text-sm text-zinc-200 ${multiline ? "leading-relaxed" : "font-medium"}`}>
        {value || "—"}
      </p>
    </div>
  );
}

function CopyButton({ value, disabled }: { value: string; disabled?: boolean }) {
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
      disabled={disabled}
      className="inline-flex shrink-0 items-center gap-1 rounded-md border border-white/15 px-2 py-1 text-[11px] font-medium text-zinc-300 hover:bg-white/5 disabled:opacity-40"
    >
      {copied ? <Check className="size-3.5 text-emerald-300" /> : <Copy className="size-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
