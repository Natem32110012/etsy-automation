import { randomUUID } from "node:crypto";
import { loadProductType } from "./config";
import { readCustomType } from "./custom-types";
import { parseJson } from "./json";
import { artDirectorFor } from "./prompts";
import { listingFillPrompt } from "./prompts/listing";
import { buildThemePrompt } from "./prompts/theme";
import { generateText } from "./replicate";
import { avoidList, getConcept, readLog, updateConcept, updateLog, usedThemes } from "./store";
import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  PRODUCT_KEY,
  sanitizeEtsyTitle,
  PROMO_COUNT_DEFAULT,
  PROMO_COUNT_MAX,
  PROMO_COUNT_MIN,
  PAPERDOLL_PAGE_COUNT,
  WALL_SET_MAX,
  PARTY_PAGE_COUNT,
  FAVORTAGS_PAGE_COUNT,
  PACK_PAGE_MAX,
  PACK_PAGE_MIN,
  isPackType,
  isWallArt,
  isBuiltinType,
  productPageKey,
  promoKey,
  type Concept,
  type ImageSlot,
  type ProductType,
} from "./types";

/** Tek istekte 5 konsept istemek çıktıyı token sınırında kesiyordu. */
const BATCH_SIZE = 3;
/** Cupcake ilan metni 450-650 kelime; diğer alanlarla birlikte kesilmesin. */
const TOKENS_PER_CONCEPT = 2800;

function conceptTokenPages(type: ProductType, requested: number) {
  if (type === "paperdoll") return PAPERDOLL_PAGE_COUNT;
  if (type === "party") return PARTY_PAGE_COUNT;
  if (type === "favortags") return FAVORTAGS_PAGE_COUNT;
  if (isPackType(type)) return normalizePageCount(requested);
  if (isWallArt(type)) return Math.min(WALL_SET_MAX, Math.max(1, Math.round(requested) || 1));
  return 1;
}

function conceptMaxTokens(type: ProductType, batch: number, pages: number) {
  const base = TOKENS_PER_CONCEPT * batch + 800 * pages + 1200;
  return type === "paperdoll" || isWallArt(type) ? Math.max(base, 8192) : base;
}

const SELLER_SUMMARY = `Also set summary_tr on every concept: one Turkish sentence, max 30 words, for the seller. What the artwork shows, the main colors, and what is left out. Not a translation of the title. Title, theme, prompts, and Etsy fields stay English.`;

type RawConcept = {
  title?: unknown;
  summary_tr?: unknown;
  theme?: unknown;
  product_image_prompt?: unknown;
  character_bible?: unknown;
  theme_bible?: unknown;
  page_prompts?: unknown;
  landscape_prompts?: unknown;
  promo_scenes?: unknown;
  etsy_title?: unknown;
  etsy_description?: unknown;
  etsy_tags?: unknown;
};

export type GenerateConceptsInput = {
  type: ProductType;
  quantity: number;
  theme: string | null;
  promoCount: number;
  pageCount: number;
};

export function normalizePageCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return PACK_PAGE_MIN;
  return Math.min(PACK_PAGE_MAX, Math.max(PACK_PAGE_MIN, Math.round(parsed)));
}

export function normalizePromoCount(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return PROMO_COUNT_DEFAULT;
  return Math.min(PROMO_COUNT_MAX, Math.max(PROMO_COUNT_MIN, Math.round(parsed)));
}

/**
 * Konseptler gruplara bölünerek üretiliyor. Her grup, o ana kadar üretilenlerin
 * başlıklarını da `avoid_list`'e alıyor: aynı çalışmada iki kere "uzay temalı"
 * konsept çıkmasın.
 */
export async function generateConcepts(input: GenerateConceptsInput) {
  const director = artDirectorFor(input.type);
  const history = await avoidList(input.type);
  const created: Concept[] = [];
  const pageCount = conceptTokenPages(input.type, input.pageCount);
  const wanted = 1;
  const maxAttempts = 3;

  for (let attempt = 0; attempt < maxAttempts && created.length < wanted; attempt += 1) {
    const batch = Math.min(BATCH_SIZE, wanted - created.length);
    try {
      const raw = await generateText(
        `${director.conceptPrompt({
          quantity: batch,
          selectedTheme: input.theme,
          avoidList: [...history, ...created.map((c) => `${c.title} — ${c.theme}`)],
          promoCount: input.promoCount,
          pageCount,
        })}\n\n${SELLER_SUMMARY}`,
        { maxTokens: conceptMaxTokens(input.type, batch, pageCount) },
      );

      const parsed = parseJson<{ concepts?: RawConcept[] }>(raw, "Konsept");
      const entries = (parsed.concepts ?? []).slice(0, batch);
      if (entries.length === 0) {
        if (attempt === maxAttempts - 1) {
          throw new Error("Model hiç konsept döndürmedi — tekrar dene ya da adedi düşür");
        }
        continue;
      }

      for (const entry of entries) {
        const complete = await completeListingCopy(entry, { ...input, pageCount });
        created.push(toConcept(complete, { ...input, pageCount }));
      }
    } catch (error) {
      if (attempt === maxAttempts - 1 || created.length > 0) throw error;
    }
  }

  if (created.length === 0) {
    throw new Error("Model hiç konsept döndürmedi — tekrar dene ya da adedi düşür");
  }

  await updateLog((log) => {
    log.concepts.push(...created);
  });

  return { created, missing: Math.max(0, wanted - created.length) };
}

/** Kartın "Yeniden üret" butonu: aynı tip/tema, yerinde değiştiriliyor. */
export async function regenerateConcept(id: string) {
  const log = await readLog();
  const existing = log.concepts.find((c) => c.id === id);
  if (!existing) throw new Error(`Konsept bulunamadı: ${id}`);
  if (existing.status !== "concept_pending") {
    throw new Error("Sadece onay bekleyen konseptler yeniden üretilebilir");
  }

  const director = artDirectorFor(existing.type);
  const history = await avoidList(existing.type);
  const promoCount = existing.promo_scenes.length || PROMO_COUNT_DEFAULT;
  const pageCount = conceptTokenPages(existing.type, existing.product_pages.length);

  const raw = await generateText(
    `${director.conceptPrompt({
      quantity: 1,
      selectedTheme: existing.theme || null,
      // Beğenilmeyen hâli de listede: model aynı fikri geri getirmesin.
      avoidList: [...history, `${existing.title} — ${existing.theme}`],
      promoCount,
      pageCount,
    })}\n\n${SELLER_SUMMARY}`,
    { maxTokens: conceptMaxTokens(existing.type, 1, pageCount) },
  );

  const parsed = parseJson<{ concepts?: RawConcept[] }>(raw, "Konsept");
  const entry = parsed.concepts?.[0];
  if (!entry) throw new Error("Model yeni konsept döndürmedi");

  const complete = await completeListingCopy(entry, {
    type: existing.type,
    quantity: 1,
    theme: existing.theme || null,
    promoCount,
    pageCount,
  });
  const fresh = toConcept(complete, {
    type: existing.type,
    quantity: 1,
    theme: existing.theme || null,
    promoCount,
    pageCount,
  });

  return updateConcept(id, (concept) => {
    concept.title = fresh.title;
    concept.summary_tr = fresh.summary_tr;
    concept.theme = fresh.theme;
    concept.product_image_prompt = fresh.product_image_prompt;
    concept.product_pages = fresh.product_pages;
    concept.character_bible = fresh.character_bible;
    concept.theme_bible = fresh.theme_bible;
    concept.promo_scenes = fresh.promo_scenes;
    concept.etsy_title = fresh.etsy_title;
    concept.etsy_description = fresh.etsy_description;
    concept.etsy_tags = fresh.etsy_tags;
    concept.images = fresh.images;
  });
}

export async function approveConcept(id: string) {
  return updateConcept(id, (concept) => {
    if (concept.status !== "concept_pending") return;
    concept.status = "concept_approved";
  });
}

/**
 * Reddedilen konsept silinmiyor: log'da kalıyor ve `avoid_list` üzerinden bir
 * daha üretilmesini engelliyor.
 */
export async function rejectConcept(id: string) {
  return updateConcept(id, (concept) => {
    if (concept.status !== "concept_pending") {
      throw new Error("Sadece onay bekleyen konseptler reddedilebilir");
    }
    concept.status = "concept_rejected";
  });
}

export async function approveAllPending(type: ProductType) {
  const log = await updateLog((current) => {
    for (const concept of current.concepts) {
      if (concept.type === type && concept.status === "concept_pending") {
        concept.status = "concept_approved";
      }
    }
  });
  return log.concepts.filter((c) => c.type === type && c.status === "concept_approved");
}

export async function suggestThemes(
  type: ProductType,
  exclude: string[] = [],
  idea?: string | null,
): Promise<Array<{ title: string; summary_tr: string }>> {
  const director = artDirectorFor(type);
  const product = await loadProductType(type);
  const history = await usedThemes(type);
  const extra = exclude.map((item) => item.trim().toLowerCase()).filter(Boolean);
  const blocked = new Set(
    [...history, ...extra].map((item) => item.trim().toLowerCase()).filter(Boolean),
  );
  const custom = isBuiltinType(type) ? null : readCustomType(type);

  const raw = await generateText(
    buildThemePrompt(director, history, extra, idea, {
      label: product.label,
      pageRules: custom?.productImageRules,
    }),
    { maxTokens: 4096, temperature: 0.9 },
  );
  return collectThemes(parseJson<{ themes?: unknown }>(raw, "Tema").themes, blocked);
}

function collectThemes(value: unknown, blocked: Set<string>) {
  if (!Array.isArray(value)) return [];
  const used = new Set<string>();
  const themes: Array<{ title: string; summary_tr: string }> = [];
  for (const entry of value) {
    const title = typeof entry === "string" ? entry : text((entry as { title?: unknown }).title);
    const summary = typeof entry === "string" ? "" : text((entry as { summary_tr?: unknown }).summary_tr);
    const clean = title.trim().replace(/\s+/g, " ").replace(/[.]+$/, "");
    const key = clean.toLowerCase();
    const words = clean.split(" ").length;
    if (words < 2 || words > 8 || clean.length > 72 || used.has(key) || blocked.has(key)) continue;
    used.add(key);
    themes.push({ title: clean, summary_tr: summary });
  }
  return themes.slice(0, 8);
}

function listingFieldsMissing(entry: RawConcept) {
  return !text(entry.etsy_title) || !text(entry.etsy_description) || strings(entry.etsy_tags).length === 0;
}

function conceptToRaw(concept: Concept): RawConcept {
  return {
    title: concept.title,
    theme: concept.theme,
    theme_bible: concept.theme_bible,
    character_bible: concept.character_bible,
    product_image_prompt: concept.product_image_prompt,
    page_prompts: concept.product_pages.length > 0 ? concept.product_pages : [concept.product_image_prompt],
    promo_scenes: concept.promo_scenes,
    etsy_title: concept.etsy_title,
    etsy_description: concept.etsy_description,
    etsy_tags: concept.etsy_tags,
  };
}

async function completeListingCopy(entry: RawConcept, input: GenerateConceptsInput): Promise<RawConcept> {
  if (!listingFieldsMissing(entry)) return entry;

  const config = await loadProductType(input.type);
  const pages = parseProductPages(
    entry,
    input.type,
    text(entry.character_bible) || null,
    text(entry.theme_bible) || null,
    input.pageCount,
  );
  const raw = await generateText(
    listingFillPrompt({
      type: input.type,
      typeLabel: config.label,
      title: text(entry.title),
      theme: text(entry.theme) || input.theme || "",
      themeBible: text(entry.theme_bible) || null,
      pageCount: Math.max(pages.length, input.pageCount || 1),
      pageSummaries: pages.map((page) => page.slice(0, 280)),
    }),
    { maxTokens: 4096 },
  );
  const parsed = parseJson<{
    etsy_title?: unknown;
    etsy_description?: unknown;
    etsy_tags?: unknown;
  }>(raw, "İlan metni");

  return {
    ...entry,
    etsy_title: text(entry.etsy_title) || parsed.etsy_title,
    etsy_description: text(entry.etsy_description) || parsed.etsy_description,
    etsy_tags: strings(entry.etsy_tags).length > 0 ? entry.etsy_tags : parsed.etsy_tags,
  };
}

/** Export veya kartta başlık/açıklama boşsa ayrı bir metin çağrısıyla doldurur. */
export async function ensureListingCopy(conceptId: string): Promise<Concept> {
  const concept = await getConcept(conceptId);
  const entry = conceptToRaw(concept);
  if (!listingFieldsMissing(entry)) return concept;

  const pageCount = Math.max(concept.product_pages.length, 1);
  const filled = await completeListingCopy(entry, {
    type: concept.type,
    quantity: 1,
    theme: concept.theme || null,
    promoCount: concept.promo_scenes.length || PROMO_COUNT_DEFAULT,
    pageCount,
  });
  if (listingFieldsMissing(filled)) {
    throw new Error("İlan başlığı veya açıklaması üretilemedi — tekrar dene");
  }

  return updateConcept(conceptId, (current) => {
    current.etsy_title = sanitizeEtsyTitle(text(filled.etsy_title));
    current.etsy_description = text(filled.etsy_description);
    current.etsy_tags = normalizeTags(filled.etsy_tags);
  });
}

function toConcept(entry: RawConcept, input: GenerateConceptsInput): Concept {
  const title = text(entry.title) || "İsimsiz konsept";
  const promoScenes = strings(entry.promo_scenes).slice(0, input.promoCount);
  const bible = text(entry.character_bible) || null;
  const themeBible = text(entry.theme_bible) || null;
  const pages = parseProductPages(entry, input.type, bible, themeBible, input.pageCount);
  const productPrompt = pages[0] ?? text(entry.product_image_prompt);
  const etsyTitle = sanitizeEtsyTitle(text(entry.etsy_title));
  const etsyDescription = text(entry.etsy_description);

  if (!productPrompt) {
    throw new Error(`"${title}" için ürün görseli promptu boş döndü — yeniden üret`);
  }
  if (!etsyTitle || !etsyDescription) {
    throw new Error(`"${title}" için Etsy başlığı/açıklaması boş döndü — tekrar dene`);
  }
  if (input.type === "paperdoll" && pages.length !== PAPERDOLL_PAGE_COUNT) {
    throw new Error(`"${title}" için ${PAPERDOLL_PAGE_COUNT} sayfa bekleniyordu, ${pages.length} geldi — yeniden üret`);
  }
  if (isWallArt(input.type) && pages.length !== input.pageCount) {
    throw new Error(`"${title}" için ${input.pageCount} duvar resmi bekleniyordu, ${pages.length} geldi — yeniden üret`);
  }
  if (input.type === "party" && pages.length !== PARTY_PAGE_COUNT) {
    throw new Error(`"${title}" için ${PARTY_PAGE_COUNT} sayfa bekleniyordu, ${pages.length} geldi — yeniden üret`);
  }
  if (input.type === "favortags" && pages.length !== FAVORTAGS_PAGE_COUNT) {
    throw new Error(
      `"${title}" için ${FAVORTAGS_PAGE_COUNT} sayfa bekleniyordu, ${pages.length} geldi — yeniden üret`,
    );
  }
  if (isPackType(input.type) && input.pageCount > 1 && pages.length !== input.pageCount) {
    throw new Error(
      `"${title}" için ${input.pageCount} sayfalık paket bekleniyordu, ${pages.length} geldi — yeniden üret`,
    );
  }
  if (promoScenes.length === 0) {
    throw new Error(`"${title}" için promo sahnesi döndürülmedi — yeniden üret`);
  }

  return {
    id: randomUUID(),
    type: input.type,
    status: "concept_pending",
    title,
    summary_tr: text(entry.summary_tr) || null,
    theme: text(entry.theme) || input.theme || "",
    product_image_prompt: productPrompt,
    product_pages: pages.length > 1 ? pages : [],
    character_bible: bible,
    theme_bible: themeBible,
    promo_scenes: promoScenes,
    etsy_title: etsyTitle,
    etsy_description: etsyDescription,
    etsy_tags: normalizeTags(entry.etsy_tags),
    etsy_link: null,
    etsy_listed: false,
    etsy_listing_id: null,
    etsy_listing_state: "none",
    etsy_listing_error: null,
    etsy_price: null,
    etsy_quantity: null,
    etsy_taxonomy_id: null,
    etsy_cover_page: false,
    archived: false,
    pinterest_shared: false,
    pinterest_title: null,
    pinterest_description: null,
    pinterest_pins: [],
    folder_path: null,
    created_at: new Date().toISOString(),
    images: isWallArt(input.type)
      ? buildWallSlots(pages.length > 0 ? pages : [productPrompt], promoScenes)
      : buildSlots(pages.length > 0 ? pages : [productPrompt], promoScenes),
  };
}

function parseProductPages(
  entry: RawConcept,
  type: ProductType,
  bible: string | null,
  themeBible: string | null,
  pageCount: number,
): string[] {
  if (type === "party" || type === "favortags") {
    const count = type === "favortags" ? FAVORTAGS_PAGE_COUNT : PARTY_PAGE_COUNT;
    const fromArray = strings(entry.page_prompts);
    const fromObject = pagePromptsFromObject(entry.page_prompts, count);
    const raw = (fromArray.length > 0 ? fromArray : fromObject).slice(0, count);
    const pages = raw.map((page) => withLock(page, [themeBible]));
    if (pages.length > 0) return pages;
    const single = text(entry.product_image_prompt);
    return single ? [withLock(single, [themeBible])] : [];
  }
  if (type === "paperdoll") {
    const fromArray = strings(entry.page_prompts);
    const fromObject = pagePromptsFromObject(entry.page_prompts, PAPERDOLL_PAGE_COUNT);
    const raw = (fromArray.length > 0 ? fromArray : fromObject).slice(0, PAPERDOLL_PAGE_COUNT);
    return raw.map((page) => withLock(page, [bible, themeBible]));
  }
  if (isWallArt(type)) {
    const fromArray = strings(entry.page_prompts);
    const fromObject = pagePromptsFromObject(entry.page_prompts, pageCount);
    const raw = (fromArray.length > 0 ? fromArray : fromObject).slice(0, pageCount);
    const pages = raw.map((page) => withLock(page, [themeBible]));
    if (pages.length > 0) return pages;
  }
  if (isPackType(type) && pageCount > 1) {
    const fromArray = strings(entry.page_prompts);
    const fromObject = pagePromptsFromObject(entry.page_prompts, pageCount);
    const raw = (fromArray.length > 0 ? fromArray : fromObject).slice(0, pageCount);
    return raw.map((page) => withLock(page, [themeBible]));
  }
  const single = text(entry.product_image_prompt);
  return single ? [single] : [];
}

/** Model bazen page_prompts'u {page_1, page_2, page_3} nesnesi olarak veriyor. */
function pagePromptsFromObject(value: unknown, count: number): string[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const record = value as Record<string, unknown>;
  return Array.from({ length: count }, (_, index) => index + 1)
    .map((index) => text(record[`page_${index}`] ?? record[`page${index}`] ?? record[String(index)]))
    .filter((page) => page.length > 0);
}

function withLock(prompt: string, locks: (string | null)[]) {
  let result = prompt;
  for (const lock of [...locks].reverse()) {
    if (!lock) continue;
    const needle = lock.slice(0, Math.min(80, lock.length));
    if (needle && result.includes(needle)) continue;
    result = `${lock} ${result}`;
  }
  return result;
}

function buildWallSlots(portraits: string[], promoScenes: string[]): ImageSlot[] {
  const empty = {
    status: "pending" as const,
    error: null,
    generations: [],
    selected_generation_id: null,
    overlay_text: false,
  };
  const products = portraits.map((instruction, index) => ({
    key: productPageKey(index + 1),
    kind: "product" as const,
    instruction,
    ...empty,
  }));
  return [
    ...products,
    ...promoScenes.map((scene, index) => ({
      key: promoKey(index + 1),
      kind: "promo" as const,
      instruction: scene,
      ...empty,
    })),
  ];
}

function buildSlots(productPages: string[], promoScenes: string[]): ImageSlot[] {
  const empty = {
    status: "pending" as const,
    error: null,
    generations: [],
    selected_generation_id: null,
    overlay_text: false,
  };
  const products =
    productPages.length > 1
      ? productPages.map((instruction, index) => ({
          key: productPageKey(index + 1),
          kind: "product" as const,
          instruction,
          ...empty,
        }))
      : [{ key: PRODUCT_KEY, kind: "product" as const, instruction: productPages[0] ?? "", ...empty }];

  return [
    ...products,
    ...promoScenes.map((scene, index) => ({
      key: promoKey(index + 1),
      kind: "promo" as const,
      instruction: scene,
      ...empty,
    })),
  ];
}

/** Etsy tag kuralları: 13 tane, 20 karakter, küçük harf, noktalama yok, tekrar yok. */
function normalizeTags(value: unknown): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const tag of strings(value)) {
    const clean = tag
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, ETSY_TAG_MAX)
      .trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    tags.push(clean);
  }
  return tags.slice(0, ETSY_TAG_COUNT);
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      if (typeof entry === "string") return entry.trim();
      // Model bazen promo_scenes'i {scene_instruction: "..."} olarak veriyor.
      if (entry && typeof entry === "object") {
        const record = entry as Record<string, unknown>;
        const candidate = record.scene_instruction ?? record.instruction ?? record.scene;
        if (typeof candidate === "string") return candidate.trim();
      }
      return "";
    })
    .filter((entry) => entry.length > 0);
}
