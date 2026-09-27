"use client";

import { useCallback, useEffect, useState } from "react";
import { Lightbulb, Sparkles } from "lucide-react";
import { Action, ErrorNote, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedConcept } from "@/lib/serialize";
import {
  DEFAULT_QUALITY,
  PACK_PAGE_MAX,
  PROMO_COUNT_DEFAULT,
  PROMO_COUNT_MAX,
  PROMO_COUNT_MIN,
  QUALITY_LABELS,
  SELECTABLE_QUALITIES,
  imageQualitySchema,
  isPackType,
  isWallArt,
  WALL_SET_MAX,
  type ImageQuality,
  type PrintSize,
  type ProductType,
  type QualitySettings,
} from "@/lib/types";
import { ConceptCard } from "./concept-card";
import { ProductionCard } from "./production-card";

const QUALITY_STORAGE_KEY = "etsy-fabrika-quality";
const IDEA_STORAGE_KEY = "etsy-fabrika-ideas";

type TypeInfo = {
  id: ProductType;
  label: string;
  print: PrintSize;
  boardEnv: string;
  boardReady: boolean;
};

export function Studio() {
  const [types, setTypes] = useState<TypeInfo[]>([]);
  const [replicateReady, setReplicateReady] = useState(true);
  const [type, setType] = useState<ProductType>("coloring");
  const [quantity, setQuantity] = useState("");
  const [promoCount, setPromoCount] = useState(PROMO_COUNT_DEFAULT);
  const [theme, setTheme] = useState<string | null>(null);
  const [themes, setThemes] = useState<Array<{ title: string; summary_tr: string }>>([]);
  const [themeHistory, setThemeHistory] = useState<string[]>([]);
  const [ideas, setIdeas] = useState<Partial<Record<ProductType, string>>>({});
  const [quality, setQuality] = useState<QualitySettings>(DEFAULT_QUALITY);
  const [concepts, setConcepts] = useState<SerializedConcept[]>([]);
  const [busy, setBusy] = useState<"themes" | "concepts" | "approveAll" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (target: ProductType) => {
    const result = await api<{ concepts: SerializedConcept[] }>(`/api/concepts?type=${target}`);
    setConcepts(result.concepts);
  }, []);

  // Kalite seçimi tarayıcıda kalıyor: her yeniden yüklemede tekrar ayarlamak
  // yerine son seçim korunuyor.
  useEffect(() => {
    const stored = window.localStorage.getItem(QUALITY_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Record<string, unknown>;
      setQuality({
        product: imageQualitySchema.catch(DEFAULT_QUALITY.product).parse(parsed.product),
        promo: imageQualitySchema.catch(DEFAULT_QUALITY.promo).parse(parsed.promo),
      });
    } catch {
      // Bozuk kayıt varsayılana düşer.
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem(IDEA_STORAGE_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Partial<Record<ProductType, string>>;
      if (parsed && typeof parsed === "object") setIdeas(parsed);
    } catch {
      // Bozuk kayıt boş fikirle devam.
    }
  }, []);

  function changeQuality(next: QualitySettings) {
    setQuality(next);
    window.localStorage.setItem(QUALITY_STORAGE_KEY, JSON.stringify(next));
  }

  function changeIdea(value: string) {
    setIdeas((current) => {
      const next = { ...current, [type]: value };
      window.localStorage.setItem(IDEA_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  useEffect(() => {
    api<{ types: TypeInfo[]; replicateReady: boolean }>("/api/product-types")
      .then((result) => {
        setTypes(result.types);
        setReplicateReady(result.replicateReady);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : String(cause)),
      );
  }, []);

  useEffect(() => {
    setThemes([]);
    setTheme(null);
    setThemeHistory([]);
    load(type).catch((cause: unknown) =>
      setError(cause instanceof Error ? cause.message : String(cause)),
    );
  }, [type, load]);

  function replace(updated: SerializedConcept) {
    setConcepts((current) => current.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function run(kind: "themes" | "concepts" | "approveAll", action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    setNote(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  const pending = concepts.filter((c) => c.status === "concept_pending");
  const production = concepts.filter(
    (c) =>
      c.status === "concept_approved" ||
      c.status === "images_pending" ||
      c.status === "images_approved" ||
      c.status === "exported" ||
      c.status === "pinterest_posted",
  );
  const activeType = types.find((entry) => entry.id === type);
  const pack = isPackType(type);
  const wall = isWallArt(type);
  const idea = ideas[type] ?? "";
  const brief = (theme ?? idea).trim() || null;

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Üretim</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Generate one concept, approve it, produce images, export. Then send an Etsy draft from
          the card — it stays unpublished until you approve it on Shop.
        </p>
      </header>

      {!replicateReady && (
        <div className="mb-6">
          <ErrorNote message="REPLICATE_API_TOKEN tanımlı değil — .env.local dosyasına ekleyip sunucuyu yeniden başlat." />
        </div>
      )}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className={`grid gap-4 ${pack || wall ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Field label="Product type">
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ProductType)}
              className={inputClass}
            >
              {types.length === 0 && <option value={type}>loading…</option>}
              {types.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          {(pack || wall) && (
            <Field
              label={wall ? "Prints in set" : "Pages in pack"}
              hint={
                wall
                  ? "1 is a single print. 3 is a matching set. Each print is one portrait file, 18×24 in."
                  : `Up to ${PACK_PAGE_MAX} pages in one listing. Page 1 is the reference.`
              }
            >
              <input
                value={quantity}
                onChange={(event) => setQuantity(event.target.value.replace(/[^0-9]/g, ""))}
                placeholder="1"
                className={inputClass}
              />
            </Field>
          )}

          <Field label={`Promo images (${PROMO_COUNT_MIN}-${PROMO_COUNT_MAX})`}>
            <select
              value={promoCount}
              onChange={(event) => setPromoCount(Number(event.target.value))}
              className={inputClass}
            >
              {Array.from(
                { length: PROMO_COUNT_MAX - PROMO_COUNT_MIN + 1 },
                (_, index) => PROMO_COUNT_MIN + index,
              ).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4 grid gap-4 border-t border-white/5 pt-4 sm:grid-cols-2">
          <Field label="Ürün görseli kalitesi" hint="Print dosyası — çizgi netliği buradan gelir">
            <select
              value={quality.product}
              onChange={(event) =>
                changeQuality({ ...quality, product: event.target.value as ImageQuality })
              }
              className={inputClass}
            >
              {SELECTABLE_QUALITIES.map((value) => (
                <option key={value} value={value}>
                  {QUALITY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Promo görseli kalitesi" hint="Ekranda 1000x1500 görünüyor">
            <select
              value={quality.promo}
              onChange={(event) =>
                changeQuality({ ...quality, promo: event.target.value as ImageQuality })
              }
              className={inputClass}
            >
              {SELECTABLE_QUALITIES.map((value) => (
                <option key={value} value={value}>
                  {QUALITY_LABELS[value]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {activeType && (
          <p className="mt-3 text-xs text-zinc-500">
            Ürün görseli {activeType.print.width}x{activeType.print.height}px @{" "}
            {activeType.print.dpi}dpi · promo 1000x1500px
            {!activeType.boardReady && (
              <span className="text-amber-300/80">
                {" "}
                · {activeType.boardEnv} boş, Pinterest dry-run çalışır
              </span>
            )}
          </p>
        )}

        <div className="mt-4 border-t border-white/5 pt-4">
          <Field
            label="Your idea"
            hint="Per product type. Suggestions and the concept follow this brief — e.g. halloween."
          >
            <textarea
              value={idea}
              onChange={(event) => changeIdea(event.target.value)}
              placeholder="halloween, cute not scary, pumpkins and black cats"
              className={`${inputClass} min-h-20`}
            />
          </Field>
          <p className="mt-2 text-[11px] text-zinc-600">
            Suggest themes invents niche titles for this product. Each press is a new set.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Action
            icon={<Lightbulb className="size-4" />}
            label="Suggest themes"
            tone="ghost"
            busy={busy === "themes"}
            disabled={busy !== null}
            onClick={() =>
              run("themes", async () => {
                const result = await api<{ themes: Array<{ title: string; summary_tr: string }> }>("/api/themes", {
                  type,
                  exclude: [...themeHistory, ...themes.map((entry) => entry.title)],
                  idea: idea.trim() || undefined,
                });
                setThemes(result.themes);
                setThemeHistory((current) => [...current, ...result.themes.map((entry) => entry.title)]);
                if (result.themes.length === 0) setNote("No themes returned — try again.");
              })
            }
          />
          <Action
            icon={<Sparkles className="size-4" />}
            label="Generate concept"
            busy={busy === "concepts"}
            disabled={busy !== null}
            onClick={() =>
              run("concepts", async () => {
                const result = await api<{ concepts: SerializedConcept[]; missing: number }>(
                  "/api/concepts",
                  {
                    type,
                    quantity: 1,
                    pageCount: wall
                      ? Math.min(WALL_SET_MAX, Math.max(1, quantity === "" ? 1 : Number(quantity)))
                      : pack
                        ? quantity === ""
                          ? 1
                          : Number(quantity)
                        : 1,
                    theme: brief,
                    promoCount,
                  },
                );
                await load(type);
                if (result.missing > 0) {
                  setNote("Concept did not generate — try again.");
                }
              })
            }
          />
          {theme && (
            <button
              onClick={() => setTheme(null)}
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
            >
              Clear selected suggestion
            </button>
          )}
        </div>

        {themes.length > 0 && (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {themes.map((entry) => (
              <button
                key={entry.title}
                onClick={() => setTheme(entry.title === theme ? null : entry.title)}
                className={`rounded-xl border px-3 py-2.5 text-left transition ${
                  entry.title === theme
                    ? "border-violet-400 bg-violet-500/20 text-violet-50"
                    : "border-white/10 bg-white/[0.02] text-zinc-200 hover:border-violet-400/40"
                }`}
              >
                <span className="block text-sm font-medium leading-snug">{entry.title}</span>
                {entry.summary_tr && (
                  <span className={`mt-1 block text-xs font-normal leading-relaxed ${entry.title === theme ? "text-violet-100/80" : "text-zinc-400"}`}>
                    {entry.summary_tr}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="mt-4 space-y-2">
          <ErrorNote message={error} />
          {note && (
            <p className="rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-sm text-sky-200">
              {note}
            </p>
          )}
        </div>
      </section>

      {pending.length > 0 && (
        <Section
          title={`Konsept onayı bekleyen (${pending.length})`}
          action={
            <Action
              label="Tümünü onayla"
              tone="ghost"
              busy={busy === "approveAll"}
              disabled={busy !== null}
              onClick={() =>
                run("approveAll", async () => {
                  await api("/api/concepts/approve-all", { type });
                  await load(type);
                })
              }
            />
          }
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {pending.map((concept) => (
              <ConceptCard key={concept.id} concept={concept} onChange={replace} />
            ))}
          </div>
        </Section>
      )}

      {production.length > 0 && (
        <Section title={`Görsel üretimi (${production.length})`}>
          <div className="space-y-4">
            {production.map((concept) => (
              <ProductionCard
                key={concept.id}
                concept={concept}
                quality={quality}
                onChange={replace}
              />
            ))}
          </div>
        </Section>
      )}

      {concepts.length === 0 && (
        <p className="mt-10 text-center text-sm text-zinc-600">
          Bu tip için henüz konsept yok. Yukarıdan üretmeye başla.
        </p>
      )}
    </main>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
