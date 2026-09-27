"use client";

import { useEffect, useState } from "react";
import { Store } from "lucide-react";
import { Action, Field, inputClass } from "@/components/ui";
import { api } from "@/lib/client";
import type { SerializedConcept } from "@/lib/serialize";

type TaxonomyRow = { id: number; name: string; path: string };

type DraftPrefill = {
  title: string;
  description: string;
  tags: string[];
  price: number;
  quantity: number;
  taxonomyId: number | null;
  photoKeys: string[];
  fileKeys: string[];
  infoKeys: string[];
  infoImages: Array<{ key: string; label: string; url: string }>;
  pricePresets: number[];
  shopSection: { id: number; title: string } | null;
};

export function TaxonomyPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<TaxonomyRow[]>([]);
  const [seededFor, setSeededFor] = useState<number | null>(null);

  useEffect(() => {
    if (!value || seededFor === value) return;
    let cancelled = false;
    api<{ selected: TaxonomyRow | null }>(`/api/etsy/taxonomy?id=${value}`)
      .then((data) => {
        if (cancelled || !data.selected?.path) return;
        setQuery(data.selected.path);
        setSeededFor(value);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [value, seededFor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const id = value ? `&id=${value}` : "";
      api<{ taxonomy: TaxonomyRow[] }>(`/api/etsy/taxonomy?q=${encodeURIComponent(query)}${id}`)
        .then((data) => setRows(data.taxonomy))
        .catch(() => setRows([]));
    }, 200);
    return () => clearTimeout(timer);
  }, [query, value]);

  const selected = rows.find((row) => row.id === value);

  return (
    <div>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search category"
        className={inputClass}
      />
      {value && (
        <p className="mt-1 text-[11px] text-emerald-300">
          Selected: {selected?.path ?? `#${value}`}
        </p>
      )}
      <ul className="mt-2 max-h-36 overflow-auto rounded-lg border border-white/10">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onChange(row.id)}
              className={`block w-full px-3 py-1.5 text-left text-xs ${
                row.id === value ? "bg-violet-500/20 text-zinc-50" : "text-zinc-400 hover:bg-white/5"
              }`}
            >
              {row.path}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function EtsyDraftPanel({
  concept,
  onChange,
  disabled,
}: {
  concept: SerializedConcept;
  onChange: (concept: SerializedConcept) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [title, setTitle] = useState(concept.etsy_title);
  const [description, setDescription] = useState(concept.etsy_description);
  const [tags, setTags] = useState(concept.etsy_tags.join(", "));
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("999");
  const [taxonomyId, setTaxonomyId] = useState<number | null>(concept.etsy_taxonomy_id);
  const [photoKeys, setPhotoKeys] = useState<string[]>([]);
  const [fileKeys, setFileKeys] = useState<string[]>([]);
  const [infoKeys, setInfoKeys] = useState<string[]>([]);
  const [coverPage, setCoverPage] = useState(false);
  const [infoImages, setInfoImages] = useState<DraftPrefill["infoImages"]>([]);
  const [pricePresets, setPricePresets] = useState<number[]>([]);
  const [shopSection, setShopSection] = useState<DraftPrefill["shopSection"]>(null);

  const listed = Boolean(concept.etsy_listing_id) && concept.etsy_listing_state !== "deleted";
  const promos = concept.images.filter((slot) => slot.kind === "promo" && slot.status === "approved");
  const products = concept.images.filter((slot) => slot.kind === "product" && slot.status === "approved");
  const pageOne = products.find((slot) => slot.key === "product-1" || slot.key === "product") ?? products[0];
  const pageOneFile = pageOne?.generations.find((generation) => generation.id === pageOne.selected_generation_id);

  useEffect(() => {
    api<{ connected: boolean }>("/api/etsy/status")
      .then((status) => setConnected(status.connected))
      .catch(() => setConnected(false));
  }, []);

  useEffect(() => {
    if (listed) return;
    let cancelled = false;
    loadPrefill()
      .then(() => {
        if (!cancelled) setOpen(true);
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
      });
    return () => {
      cancelled = true;
    };
    // Prefill once per product after export.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [concept.id, listed]);

  async function loadPrefill() {
    const data = await api<DraftPrefill>(`/api/etsy/draft?conceptId=${concept.id}`);
    setTitle(data.title);
    setDescription(data.description);
    setTags(data.tags.join(", "));
    setPrice(String(data.price));
    setQuantity(String(data.quantity));
    setTaxonomyId(data.taxonomyId);
    setPhotoKeys(data.photoKeys);
    setFileKeys(data.fileKeys);
    setInfoKeys(data.infoKeys);
    setInfoImages(data.infoImages);
    setPricePresets(data.pricePresets);
    setShopSection(data.shopSection);
  }

  async function sendDraft() {
    if (!taxonomyId) {
      setError("Pick an Etsy category.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ concept: SerializedConcept; uploadError: string | null }>("/api/etsy/draft", {
        conceptId: concept.id,
        title,
        description,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
          .slice(0, 13),
        price: Number(price),
        quantity: Number(quantity),
        taxonomyId,
        photoKeys,
        fileKeys,
        infoKeys,
        coverPage,
      });
      onChange(result.concept);
      setOpen(false);
      if (result.uploadError) {
        setError(`Draft created, but upload failed. Open Shop and click Retry upload. ${result.uploadError}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  function toggle(list: string[], key: string, setList: (next: string[]) => void) {
    setList(list.includes(key) ? list.filter((item) => item !== key) : [...list, key]);
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-200">Etsy draft</p>
          <p className="mt-1 text-xs text-zinc-500">
            Creates a draft only. It will not go live until you click Approve &amp; publish on Shop.
          </p>
          {listed && (
            <p className="mt-1 text-xs text-emerald-300">
              Listing {concept.etsy_listing_state}
              {concept.etsy_price != null ? ` · ${concept.etsy_price.toFixed(2)} TRY` : ""}
            </p>
          )}
          {concept.etsy_listing_error && (
            <p className="mt-1 text-xs text-rose-300">{concept.etsy_listing_error}</p>
          )}
        </div>
        {listed ? (
          <a
            href="/etsy"
            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-medium text-zinc-300 hover:bg-white/5"
          >
            <Store className="size-4" />
            Open Shop
          </a>
        ) : (
          <Action
            icon={<Store className="size-4" />}
            label={open ? "Hide draft form" : "Send as Etsy draft"}
            disabled={disabled || !connected}
            onClick={async () => {
              if (!open) {
                try {
                  await loadPrefill();
                  setOpen(true);
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : String(cause));
                }
              } else {
                setOpen(false);
              }
            }}
          />
        )}
      </div>

      {!connected && (
        <p className="mt-3 text-xs text-amber-300">
          Connect the shop first: <a className="underline" href="/etsy">Shop</a>
        </p>
      )}
      {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}

      {open && !listed && (
        <div className="mt-4 space-y-4">
          <AssetPicker
            label="Listing photos"
            hint="Shown on the Etsy listing. Info slides are added at the end by default."
            slots={promos}
            selected={photoKeys}
            onToggle={(key) => toggle(photoKeys, key, setPhotoKeys)}
          />
          <label className="flex items-start gap-3 rounded-lg border border-white/10 px-3 py-2">
            <input
              type="checkbox"
              className="mt-1"
              checked={coverPage}
              disabled={!pageOne}
              onChange={(event) => setCoverPage(event.target.checked)}
            />
            <span className="min-w-0 flex-1">
              <span className="block text-sm text-zinc-200">Use page 1 as the first listing photo</span>
              <span className="mt-0.5 block text-[11px] leading-relaxed text-zinc-500">
                Only page 1. Later pages stay in the download and are not added to the gallery.
              </span>
            </span>
            {pageOneFile && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pageOneFile.url} alt="" className="h-16 w-11 rounded object-cover" />
            )}
          </label>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">End slides</p>
            <p className="mt-0.5 text-[11px] text-zinc-600">Appended after listing photos. Uncheck to skip.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {infoImages.map((image) => {
                const active = infoKeys.includes(image.key);
                return (
                  <button
                    key={image.key}
                    type="button"
                    onClick={() => toggle(infoKeys, image.key, setInfoKeys)}
                    className={`overflow-hidden rounded-lg border transition ${
                      active ? "border-violet-400" : "border-white/10 hover:border-white/30"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image.url} alt="" className="h-24 w-16 object-cover" />
                    <span
                      className={`block px-1 py-0.5 text-[10px] ${
                        active ? "bg-violet-500/20 text-violet-100" : "text-zinc-500"
                      }`}
                    >
                      {image.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          <AssetPicker
            label="Digital files"
            hint="Buyer download. Named 01.png, 02.png, 03.png."
            slots={products}
            selected={fileKeys}
            onToggle={(key) => toggle(fileKeys, key, setFileKeys)}
          />
          <Field label="Title">
            <input value={title} onChange={(event) => setTitle(event.target.value)} className={inputClass} maxLength={140} />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className={`${inputClass} min-h-40`}
            />
          </Field>
          <Field label="Tags" hint="Comma separated, max 13">
            <input value={tags} onChange={(event) => setTags(event.target.value)} className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Price (TRY)">
              {pricePresets.length > 0 && (
                <div className="mt-1.5 mb-1.5 flex flex-wrap gap-1.5">
                  {pricePresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPrice(String(preset))}
                      className={`rounded-full border px-3 py-1 text-xs ${
                        Number(price) === preset
                          ? "border-violet-400 bg-violet-500/20 text-violet-100"
                          : "border-white/10 text-zinc-400 hover:border-white/25"
                      }`}
                    >
                      {preset.toFixed(preset % 1 === 0 ? 0 : 2)} TRY
                    </button>
                  ))}
                </div>
              )}
              <input value={price} onChange={(event) => setPrice(event.target.value)} className={inputClass} />
            </Field>
            <Field label="Quantity">
              <input value={quantity} onChange={(event) => setQuantity(event.target.value)} className={inputClass} />
            </Field>
          </div>
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Category</p>
            <TaxonomyPicker value={taxonomyId} onChange={setTaxonomyId} />
          </div>
          <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs leading-relaxed text-zinc-400">
            <p>
              <span className="text-zinc-200">AI generator:</span> tick “With an AI generator” in the Etsy editor. The
              API cannot set that radio.
            </p>
            <p className="mt-1.5">
              <span className="text-zinc-200">Shop section:</span>{" "}
              {shopSection?.title ?? "None matched. Add the section in Etsy, then click Refresh taxonomy & sections."}
            </p>
            <p className="mt-1.5">
              <span className="text-zinc-200">Made to order:</span> off. Files download instantly.
            </p>
          </div>
          <Action
            label="Create draft"
            busy={busy}
            disabled={disabled || photoKeys.length === 0 || fileKeys.length === 0 || !taxonomyId}
            onClick={sendDraft}
          />
        </div>
      )}
    </div>
  );
}

function AssetPicker({
  label,
  hint,
  slots,
  selected,
  onToggle,
}: {
  label: string;
  hint: string;
  slots: SerializedConcept["images"];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div>
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-0.5 text-[11px] text-zinc-600">{hint}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {slots.map((slot, index) => {
          const chosen = slot.generations.find((generation) => generation.id === slot.selected_generation_id);
          const active = selected.includes(slot.key);
          return (
            <button
              key={slot.key}
              type="button"
              onClick={() => onToggle(slot.key)}
              className={`overflow-hidden rounded-lg border transition ${
                active ? "border-violet-400" : "border-white/10 hover:border-white/30"
              }`}
            >
              {chosen && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={chosen.url} alt="" className="h-24 w-16 object-cover" />
              )}
              <span
                className={`block px-1 py-0.5 text-[10px] ${
                  active ? "bg-violet-500/20 text-violet-100" : "text-zinc-500"
                }`}
              >
                {String(index + 1).padStart(2, "0")}.png
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
