"use client";

import { useState } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { Action, ErrorNote } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedConcept } from "@/lib/serialize";

/**
 * Adım 1 — 1. onay katmanı. Kart bazlı onay/red/yeniden üretim; görsel üretimi
 * bu katman geçilmeden başlamıyor, çünkü boşa harcanan görsel çağrısı pahalı.
 */
export function ConceptCard({
  concept,
  onChange,
}: {
  concept: SerializedConcept;
  onChange: (concept: SerializedConcept) => void;
}) {
  const [busy, setBusy] = useState<"approve" | "reject" | "regenerate" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "approve" | "reject" | "regenerate") {
    setBusy(action);
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept }>(
        `/api/concepts/${concept.id}/decision`,
        { action },
      );
      onChange(result.concept);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <header>
        <h3 className="text-[15px] font-semibold text-zinc-50">{concept.title}</h3>
        {concept.summary_tr && (
          <p className="mt-2 text-sm leading-relaxed text-zinc-200">{concept.summary_tr}</p>
        )}
        {concept.theme && (
          <p className="mt-1 text-xs text-violet-300/80">tema: {concept.theme}</p>
        )}
      </header>

      {concept.theme_bible && (
        <Block label="Theme bible">
          <p className="line-clamp-3 leading-relaxed">{concept.theme_bible}</p>
        </Block>
      )}

      {concept.character_bible && (
        <Block label="Character bible">
          <p className="line-clamp-4 leading-relaxed">{concept.character_bible}</p>
        </Block>
      )}

      {concept.product_pages.length > 1 ? (
        <Block label={`Ürün sayfaları (${concept.product_pages.length})`}>
          <ol className="space-y-2">
            {concept.product_pages.map((page, index) => (
              <li key={index} className="leading-relaxed">
                <span className="font-mono text-[11px] text-zinc-600">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p className="mt-0.5 line-clamp-3">{page}</p>
              </li>
            ))}
          </ol>
        </Block>
      ) : (
        <Block label="Ürün görseli promptu">
          <p className="line-clamp-4 leading-relaxed">{concept.product_image_prompt}</p>
        </Block>
      )}

      <Block label={`Promo sahneleri (${concept.promo_scenes.length})`}>
        <ol className="space-y-1.5">
          {concept.promo_scenes.map((scene, index) => (
            <li key={index} className="flex gap-2 leading-relaxed">
              <span className="shrink-0 font-mono text-[11px] text-zinc-600">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="line-clamp-2">{scene}</span>
            </li>
          ))}
        </ol>
      </Block>

      <Block label={`Etsy başlığı (${concept.etsy_title.length}/140)`}>
        <p className="leading-relaxed text-zinc-300">{concept.etsy_title}</p>
      </Block>

      <Block label="Etsy açıklaması">
        <p className="scroll-thin max-h-28 overflow-y-auto whitespace-pre-line leading-relaxed">
          {concept.etsy_description}
        </p>
      </Block>

      <Block label={`Etiketler (${concept.etsy_tags.length}/13)`}>
        <div className="flex flex-wrap gap-1.5">
          {concept.etsy_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      </Block>

      <ErrorNote message={error} />

      <footer className="flex flex-wrap gap-2 border-t border-white/5 pt-4">
        <Action
          icon={<Check className="size-4" />}
          label="Onayla"
          tone="emerald"
          busy={busy === "approve"}
          disabled={busy !== null}
          onClick={() => decide("approve")}
        />
        <Action
          icon={<RefreshCw className="size-4" />}
          label="Yeniden üret"
          tone="ghost"
          busy={busy === "regenerate"}
          disabled={busy !== null}
          onClick={() => decide("regenerate")}
        />
        <Action
          icon={<X className="size-4" />}
          label="Reddet"
          tone="rose"
          busy={busy === "reject"}
          disabled={busy !== null}
          onClick={() => decide("reject")}
        />
      </footer>
    </article>
  );
}

function Block({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <div className="text-sm text-zinc-400">{children}</div>
    </div>
  );
}
