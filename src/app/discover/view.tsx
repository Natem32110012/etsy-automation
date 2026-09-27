"use client";

import { useEffect, useState } from "react";
import { Compass, Plus, Search } from "lucide-react";
import { Action, ErrorNote, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/client";

type Example = {
  listingId: number;
  title: string;
  url: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
};

type Idea = {
  name: string;
  page: string;
  buyer: string;
  onePage: boolean;
  priceTry: number;
  priceNote: string;
  tags: string[];
  examples: Example[];
};

type Added = {
  id: string;
  label: string;
  sourceTitle: string;
  sourceUrl: string;
  priceTry: number;
};

type AddedNote = {
  label: string;
  priceTry: number;
  themeDomain: string;
  productImageRules: string;
  sectionTitle: string | null;
  sectionCreated: boolean;
  sectionError: string | null;
};

export function DiscoverView() {
  const [extra, setExtra] = useState("");
  const [round, setRound] = useState(0);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [scanned, setScanned] = useState(0);
  const [added, setAdded] = useState<Added[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [addedNote, setAddedNote] = useState<AddedNote | null>(null);

  useEffect(() => {
    api<{ types: Added[] }>("/api/discover")
      .then((data) => setAdded(data.types))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)));
  }, []);

  async function scan(nextRound = round) {
    setBusy("scan");
    setError(null);
    setNote(null);
    try {
      const data = await api<{ ideas: Idea[]; scanned: number; round: number }>("/api/discover", {
        extra: extra.trim() || undefined,
        round: nextRound,
      });
      setIdeas(data.ideas);
      setScanned(data.scanned);
      setRound(data.round + 1);
      if (data.ideas.length === 0) setNote("No one-page product ideas came back. Press Find products again.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  async function adopt(idea: Idea) {
    const source = idea.examples[0];
    if (!source) return;
    setBusy(`add-${source.listingId}`);
    setError(null);
    setNote(null);
    try {
      const data = await api<{
        type: {
          id: string;
          label: string;
          priceTry: number;
          themeDomain: string;
          productImageRules: string;
          sectionTitle: string | null;
          sectionCreated: boolean;
          sectionError: string | null;
        };
      }>("/api/discover/adopt", {
        name: idea.name,
        page: idea.page,
        buyer: idea.buyer,
        priceTry: idea.priceTry,
        listingId: source.listingId,
        title: source.title,
        tags: idea.tags,
        url: source.url,
        price: source.price,
        currency: source.currency,
        description: idea.page,
      });
      const row: Added = {
        id: data.type.id,
        label: data.type.label,
        sourceTitle: source.title,
        sourceUrl: source.url,
        priceTry: data.type.priceTry,
      };
      setAdded((current) => [row, ...current.filter((entry) => entry.id !== row.id)]);
      setAddedNote({
        label: data.type.label,
        priceTry: data.type.priceTry,
        themeDomain: data.type.themeDomain,
        productImageRules: data.type.productImageRules,
        sectionTitle: data.type.sectionTitle,
        sectionCreated: data.type.sectionCreated,
        sectionError: data.type.sectionError,
      });
      setNote(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto max-w-screen-2xl px-6 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">Ideas</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400">
          Press Find products. The factory searches Etsy and groups listings into one-page printable types.
          Add one and its example price becomes the draft price in Üretim. This is not a bestseller ranking.
        </p>
      </header>

      <ErrorNote message={error} />
      {addedNote && (
        <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
          <p className="text-sm font-medium text-emerald-200">Product added</p>
          <p className="mt-1 text-sm text-emerald-50">
            {addedNote.label} is now a product type in Üretim at {addedNote.priceTry.toFixed(1)} TRY.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
            The factory wrote how this page is made
            {addedNote.themeDomain ? ` (${addedNote.themeDomain})` : ""}. Select it under Product type and generate.
          </p>
          {addedNote.productImageRules && (
            <p className="mt-2 text-xs leading-relaxed text-zinc-300">{addedNote.productImageRules}</p>
          )}
          {addedNote.sectionTitle && (
            <p className="mt-2 text-xs leading-relaxed text-emerald-100/80">
              Shop section “{addedNote.sectionTitle}”{" "}
              {addedNote.sectionCreated ? "was created on Etsy." : "is ready. New drafts use it."}
            </p>
          )}
          {addedNote.sectionError && (
            <p className="mt-2 text-xs leading-relaxed text-amber-200">
              Shop section was not created. {addedNote.sectionError}
            </p>
          )}
        </div>
      )}
      {note && <p className="mb-4 text-sm text-emerald-300">{note}</p>}

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <Field label="Extra keywords" hint="Optional. Leave this empty unless you already have a phrase in mind.">
          <input
            value={extra}
            onChange={(event) => setExtra(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void scan(0);
            }}
            placeholder="Only if you already know a phrase"
            className={inputClass}
          />
        </Field>
        <div className="mt-4">
          <Action
            icon={<Search className="size-4" />}
            label={ideas.length > 0 ? "Find more products" : "Find products"}
            busy={busy === "scan"}
            disabled={busy !== null}
            onClick={() => void scan()}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
            Press the button. The factory searches Etsy on its own. Each press brings a different batch.
          </p>
        </div>
      </section>

      {added.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 text-sm font-medium text-zinc-300">Added types</h2>
          <ul className="flex flex-wrap gap-2">
            {added.map((entry) => (
              <li key={entry.id} className="rounded-full border border-white/10 px-3 py-1 text-xs text-zinc-300">
                {entry.label}
                <span className="text-zinc-500"> · {entry.priceTry.toFixed(1)} TRY</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {scanned > 0 && ideas.length > 0 && (
        <p className="mt-6 text-xs text-zinc-500">Grouped from {scanned} live listings.</p>
      )}

      <section className="mt-4 space-y-3">
        {ideas.map((idea) => {
          const source = idea.examples[0];
          return (
            <article key={idea.name} className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  {idea.examples.some((example) => example.imageUrl) && (
                    <div className="mb-3 flex gap-2">
                      {idea.examples.map((example) =>
                        example.imageUrl ? (
                          <a key={example.listingId} href={example.url} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={example.imageUrl}
                              alt=""
                              className="h-28 w-20 rounded-lg object-cover"
                            />
                          </a>
                        ) : null,
                      )}
                    </div>
                  )}
                  <h2 className="text-base font-medium text-zinc-50">{idea.name}</h2>
                  <p className="mt-1 text-sm text-emerald-300">{idea.priceTry.toFixed(1)} TRY</p>
                  <p className="mt-0.5 text-[11px] text-zinc-500">{idea.priceNote}</p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{idea.page}</p>
                  <p className="mt-1 text-xs text-zinc-500">For {idea.buyer}</p>
                  {idea.tags.length > 0 && (
                    <p className="mt-2 text-[11px] leading-relaxed text-zinc-600">{idea.tags.join(" · ")}</p>
                  )}
                  <ul className="mt-3 space-y-1">
                    {idea.examples.map((example) => (
                      <li key={example.listingId} className="text-xs text-zinc-400">
                        <a href={example.url} target="_blank" rel="noreferrer" className="hover:text-violet-200">
                          {example.title}
                        </a>
                        {example.price != null && (
                          <span className="text-zinc-600">
                            {" "}
                            · {example.price.toFixed(2)} {example.currency ?? ""}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                {idea.onePage && source ? (
                  <Action
                    icon={<Plus className="size-4" />}
                    label="Add as category"
                    tone="emerald"
                    busy={busy === `add-${source.listingId}`}
                    disabled={busy !== null}
                    onClick={() => void adopt(idea)}
                  />
                ) : (
                  <p className="text-xs text-zinc-500">Not a one-page printable.</p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      {ideas.length === 0 && added.length === 0 && (
        <p className="mt-8 flex items-center gap-2 text-sm text-zinc-500">
          <Compass className="size-4" />
          Press Find products. You do not need to type a search.
        </p>
      )}
    </main>
  );
}
