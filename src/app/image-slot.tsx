"use client";

import { useEffect, useState } from "react";
import { Check, ImagePlus, Pencil, RefreshCw, X } from "lucide-react";
import { Action, ErrorNote } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedConcept, SerializedImageSlot } from "@/lib/serialize";
import { QUALITY_LABELS, productPageLabel, type ImageQuality, type ProductType } from "@/lib/types";

/**
 * Adım 2 — 2. onay katmanı, görsel başına. Reddedilen üretimler silinmiyor:
 * geçmişte kalıyor, export sırasında `rejected/` klasörüne kopyalanıyor.
 */
export function ImageSlotCard({
  conceptId,
  conceptType,
  slot,
  index,
  quality,
  locked,
  lockHint,
  canDrop,
  onChange,
}: {
  conceptId: string;
  conceptType: ProductType;
  slot: SerializedImageSlot;
  index: number;
  /** Kurulum panelinden seçilen kalite; her üretim isteğine ekleniyor. */
  quality: ImageQuality;
  /** Ürün görseli onaylanmadan promo kareleri üretilemiyor (referans o dosya). */
  locked: boolean;
  lockHint?: string;
  /** 3'ten fazla promo varken köşedeki X bu kareyi çıkarır. */
  canDrop?: boolean;
  onChange: (concept: SerializedConcept) => void;
}) {
  const [busy, setBusy] = useState<"generate" | "approve" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [preview, setPreview] = useState(false);
  const [instruction, setInstruction] = useState(slot.instruction);
  const [revision, setRevision] = useState("");
  const [overlay, setOverlay] = useState(slot.overlay_text);

  const selected = slot.generations.find((g) => g.id === slot.selected_generation_id) ?? null;
  const label =
    slot.kind === "product"
      ? productPageLabel(conceptType, slot.key, index)
      : `Promo ${index}`;
  const generating = slot.status === "generating" || busy === "generate";

  async function saveOverlay(overlayText: boolean) {
    setOverlay(overlayText);
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept }>(
        `/api/concepts/${conceptId}/images/${slot.key}`,
        { action: "settings", overlayText },
      );
      onChange(result.concept);
    } catch (cause) {
      setOverlay(!overlayText);
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function call(body: Record<string, unknown>, kind: "generate" | "approve" | "remove") {
    setBusy(kind);
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept }>(
        `/api/concepts/${conceptId}/images/${slot.key}`,
        body,
      );
      onChange(result.concept);
      setEditing(false);
      if (typeof body.revision === "string") setRevision("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border p-4 ${
        slot.status === "approved"
          ? "border-emerald-500/30 bg-emerald-500/[0.04]"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-2 text-sm font-medium text-zinc-200">
          {label}
          {slot.status === "approved" && (
            <span className="inline-flex items-center gap-1 text-[11px] font-normal text-emerald-300">
              <Check className="size-3.5" /> onaylı
            </span>
          )}
          {slot.status !== "approved" && slot.kind !== "promo" && (
            <span className="text-[11px] font-normal text-zinc-600" title="Kurulum panelinden değiştirilir">
              kalite: {quality}
            </span>
          )}
        </span>
        {slot.kind === "promo" && slot.key === "promo-1" && (
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-zinc-400">
            <input
              type="checkbox"
              checked={overlay}
              disabled={locked || generating}
              onChange={(event) => void saveOverlay(event.target.checked)}
              className="size-3.5 rounded border-white/20 bg-black/40 accent-violet-500"
            />
            Yazı ekle
          </label>
        )}
      </div>

      <div className="relative aspect-[2/3] overflow-hidden rounded-lg border border-white/10 bg-black/40">
        {selected ? (
          <button
            type="button"
            onClick={() => setPreview(true)}
            className="size-full cursor-zoom-in"
            title="Büyüt"
          >
            {/* Üretilen dosyalar /api/files ile stream ediliyor; next/image gereksiz. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={selected.url} alt={label} className="size-full object-contain" />
          </button>
        ) : (
          <div className="grid size-full place-items-center text-xs text-zinc-600">
            {generating ? "üretiliyor…" : "henüz üretilmedi"}
          </div>
        )}
        {generating && <div className="absolute inset-0 animate-pulse bg-violet-500/10" />}
        {canDrop && (
          <button
            type="button"
            disabled={busy !== null || generating}
            onClick={() => void call({ action: "drop" }, "remove")}
            className="absolute top-2 right-2 z-10 grid size-7 place-items-center rounded-full bg-black/75 text-zinc-100 shadow hover:bg-rose-600 disabled:opacity-40"
            aria-label="Remove this promo"
            title="Remove this promo"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {slot.generations.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {slot.generations.map((generation, position) => {
            const active = generation.id === slot.selected_generation_id;
            return (
              <div
                key={generation.id}
                className={`inline-flex items-center overflow-hidden rounded-md border ${
                  active ? "border-violet-400 bg-violet-500/20" : "border-white/10"
                }`}
              >
                <button
                  type="button"
                  onClick={() => call({ action: "select", generationId: generation.id }, "approve")}
                  className={`px-2 py-0.5 font-mono text-[10px] transition ${
                    active ? "text-violet-100" : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  title={`seed ${generation.seed}${
                    generation.quality ? ` · ${QUALITY_LABELS[generation.quality]}` : ""
                  }`}
                >
                  v{position + 1}
                </button>
                <button
                  type="button"
                  disabled={busy !== null || generating}
                  onClick={() => call({ action: "remove", generationId: generation.id }, "remove")}
                  className="border-l border-white/10 px-1 py-0.5 text-zinc-500 hover:bg-rose-500/20 hover:text-rose-200 disabled:opacity-40"
                  title="Remove this version"
                  aria-label="Remove this version"
                >
                  <X className="size-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="flex flex-col gap-2">
          <textarea
            value={revision}
            onChange={(event) => setRevision(event.target.value)}
            rows={2}
            placeholder="Revize: örn. ayakkabıları tam karşıdan çiz, bilezik ekle"
            disabled={locked || generating}
            className="scroll-thin w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-violet-400/60"
          />
          <Action
            icon={<Pencil className="size-4" />}
            label="Bu görseli revize et"
            busy={generating}
            disabled={locked || busy !== null || revision.trim().length === 0}
              onClick={() =>
              call(
                { action: "generate", revision: revision.trim(), quality, overlayText: overlay },
                "generate",
              )
            }
          />
          <p className="text-[11px] text-zinc-600">
            Seçili kare referans gider; sadece yazdığın değişiklik uygulanır. Yeni sürüm onay ister.
          </p>
        </div>
      )}

      {editing ? (
        <textarea
          value={instruction}
          onChange={(event) => setInstruction(event.target.value)}
          rows={5}
          className="scroll-thin w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs leading-relaxed text-zinc-200 outline-none focus:border-violet-400/60"
        />
      ) : (
        <p className="scroll-thin max-h-20 overflow-y-auto text-xs leading-relaxed text-zinc-500">
          {slot.instruction}
        </p>
      )}

      <ErrorNote message={error ?? slot.error} />

      <div className="flex flex-wrap gap-2">
        {editing ? (
          <>
            <Action
              icon={<RefreshCw className="size-4" />}
              label="Bu talimatla üret"
              busy={generating}
              disabled={locked}
              onClick={() => call({ action: "generate", instruction, quality, overlayText: overlay }, "generate")}
            />
            <Action
              label="Vazgeç"
              tone="ghost"
              onClick={() => {
                setInstruction(slot.instruction);
                setEditing(false);
              }}
            />
          </>
        ) : (
          <>
            <Action
              icon={selected ? <RefreshCw className="size-4" /> : <ImagePlus className="size-4" />}
              label={selected ? "Yeniden üret" : "Üret"}
              busy={generating}
              disabled={locked || busy !== null}
              onClick={() => call({ action: "generate", quality, overlayText: overlay }, "generate")}
            />
            {selected && slot.status !== "approved" && (
              <Action
                icon={<Check className="size-4" />}
                label="Onayla"
                tone="emerald"
                busy={busy === "approve"}
                disabled={busy !== null}
                onClick={() => call({ action: "approve" }, "approve")}
              />
            )}
            <Action
              icon={<Pencil className="size-4" />}
              label="Talimatı düzenle"
              tone="ghost"
              disabled={busy !== null}
              onClick={() => setEditing(true)}
            />
          </>
        )}
      </div>

      {locked && (
        <p className="text-[11px] text-amber-300/80">
          {lockHint ?? "Bu kare henüz kilitli — önce önceki sayfayı onayla."}
        </p>
      )}

      {preview && selected && (
        <ImagePreview
          src={selected.url}
          alt={label}
          onClose={() => setPreview(false)}
        />
      )}
    </div>
  );
}

function ImagePreview({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
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
      aria-label={alt}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 rounded-full border border-white/15 bg-black/50 p-2 text-zinc-200 hover:bg-white/10"
        aria-label="Kapat"
      >
        <X className="size-5" />
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] max-w-[92vw] object-contain shadow-2xl"
      />
    </div>
  );
}
