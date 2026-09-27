import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { updateConcept } from "../store";
import { isWallArt, sanitizeEtsyTitle, type Concept } from "../types";
import {
  DEFAULT_QUANTITY,
  ETSY_IS_SUPPLY,
  ETSY_LISTING_TYPE,
  ETSY_WHEN_MADE,
  ETSY_WHO_MADE,
  listingUrl,
} from "./config";
import { etsyForm, etsyGet, etsyMultipart } from "./client";
import { defaultInfoKeys, infoImagePath } from "./info-images";
import { refreshShopSections } from "./shop";
import { readShopState } from "./store";

type EtsyListing = {
  listing_id: number;
  state: string;
  title?: string;
  url?: string;
};

function shopIdOrThrow(shopId: number | null) {
  if (!shopId) throw new Error("Shop id is missing. Connect Etsy first.");
  return shopId;
}

function mimeFor(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "image/png";
}

async function imageForm(field: string, filePath: string, filename: string) {
  const buffer = await readFile(filePath);
  const form = new FormData();
  form.append(field, new File([new Uint8Array(buffer)], filename, { type: mimeFor(filePath) }));
  return form;
}

function listingFilename(filePath: string, index: number) {
  const ext = path.extname(filePath).toLowerCase() || ".png";
  return `${String(index).padStart(2, "0")}${ext}`;
}

async function uploadListingAssets(shopId: number, listingId: number, photoPaths: string[], filePaths: string[]) {
  let rank = 1;
  for (const photo of photoPaths) {
    const form = await imageForm("image", photo, listingFilename(photo, rank));
    form.append("rank", String(rank));
    form.append("overwrite", "true");
    await etsyMultipart(`/application/shops/${shopId}/listings/${listingId}/images`, form);
    rank += 1;
  }
  let fileIndex = 1;
  for (const file of filePaths) {
    const name = listingFilename(file, fileIndex);
    const form = await imageForm("file", file, name);
    form.append("name", name);
    await etsyMultipart(`/application/shops/${shopId}/listings/${listingId}/files`, form);
    fileIndex += 1;
  }
}

async function trySetAiProperty(shopId: number, listingId: number, taxonomyId: number) {
  try {
    const data = await etsyGet<{
      results?: Array<{
        property_id?: number;
        name?: string;
        display_name?: string;
        possible_values?: Array<{ value_id?: number; name?: string }>;
      }>;
    }>(`/application/seller-taxonomy/nodes/${taxonomyId}/properties`);
    for (const prop of data.results ?? []) {
      const label = `${prop.name ?? ""} ${prop.display_name ?? ""}`.toLowerCase();
      if (!/ai|digital content created|how is this digital/.test(label)) continue;
      const ai = (prop.possible_values ?? []).find((value) =>
        /ai generator|artificial intelligence|with an ai/i.test(value.name ?? ""),
      );
      if (!prop.property_id || !ai?.value_id) continue;
      await etsyForm(
        `/application/shops/${shopId}/listings/${listingId}/properties/${prop.property_id}`,
        "PUT",
        { value_ids: ai.value_id, values: ai.name },
      );
      return true;
    }
  } catch {
    // Etsy has not exposed the AI radio on the public API.
  }
  return false;
}

export async function createDraftListing(input: {
  concept: Concept;
  title: string;
  description: string;
  tags: string[];
  price: number;
  quantity: number;
  taxonomyId: number;
  photoPaths: string[];
  filePaths: string[];
  coverPage: boolean;
}) {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  if (state.sections.length === 0) {
    await refreshShopSections().catch(() => undefined);
  }
  const shop = await readShopState();
  const tags = input.tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 13);
  const title = sanitizeEtsyTitle(input.title);
  const listing = await etsyForm<EtsyListing>(`/application/shops/${shopId}/listings`, "POST", {
    quantity: input.quantity || DEFAULT_QUANTITY,
    title: title.slice(0, 140),
    description: input.description,
    price: input.price.toFixed(2),
    who_made: ETSY_WHO_MADE,
    when_made: ETSY_WHEN_MADE,
    taxonomy_id: input.taxonomyId,
    type: ETSY_LISTING_TYPE,
    is_supply: ETSY_IS_SUPPLY,
    should_auto_renew: true,
    tags: tags.join(","),
    shop_section_id: shop.section_by_type[input.concept.type],
  });
  if (!listing?.listing_id) throw new Error("Etsy did not return a listing id.");

  const listingId = listing.listing_id;
  try {
    await uploadListingAssets(shopId, listingId, input.photoPaths, input.filePaths);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateConcept(input.concept.id, (concept) => {
      concept.etsy_title = title;
      concept.etsy_description = input.description;
      concept.etsy_tags = tags;
      concept.etsy_listing_id = listingId;
      concept.etsy_listing_state = "failed";
      concept.etsy_listing_error = message;
      concept.etsy_price = input.price;
      concept.etsy_quantity = input.quantity;
      concept.etsy_taxonomy_id = input.taxonomyId;
      concept.etsy_cover_page = input.coverPage;
      concept.etsy_link = listingUrl(listingId);
    });
    return { listing, uploadError: message };
  }

  await applyListingDefaults(shopId, listingId, input.concept, input.taxonomyId).catch(() => undefined);
  await updateConcept(input.concept.id, (concept) => {
    concept.etsy_title = title;
    concept.etsy_description = input.description;
    concept.etsy_tags = tags;
    concept.etsy_listing_id = listingId;
    concept.etsy_listing_state = "draft";
    concept.etsy_listing_error = null;
    concept.etsy_price = input.price;
    concept.etsy_quantity = input.quantity;
    concept.etsy_taxonomy_id = input.taxonomyId;
    concept.etsy_cover_page = input.coverPage;
    concept.etsy_link = listingUrl(listingId);
    concept.etsy_listed = false;
  });

  return { listing, uploadError: null };
}

export async function updateDraftListing(input: {
  listingId: number;
  title?: string;
  description?: string;
  tags?: string[];
  price?: number;
  quantity?: number;
  taxonomyId?: number;
}) {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  const fields: Record<string, string | number | boolean | undefined> = {
    title: input.title ? sanitizeEtsyTitle(input.title) : undefined,
    description: input.description,
    price: input.price !== undefined ? input.price.toFixed(2) : undefined,
    quantity: input.quantity,
    taxonomy_id: input.taxonomyId,
    tags: input.tags?.join(","),
    when_made: ETSY_WHEN_MADE,
  };
  return etsyForm<EtsyListing>(`/application/shops/${shopId}/listings/${input.listingId}`, "PATCH", fields);
}

/** Live publish — only from an explicit dashboard click. */
export async function publishListing(listingId: number) {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  return etsyForm<EtsyListing>(`/application/shops/${shopId}/listings/${listingId}`, "PATCH", {
    state: "active",
  });
}

export async function deactivateListing(listingId: number) {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  return etsyForm<EtsyListing>(`/application/shops/${shopId}/listings/${listingId}`, "PATCH", {
    state: "inactive",
  });
}

export async function deleteListing(listingId: number) {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  await etsyForm(`/application/shops/${shopId}/listings/${listingId}`, "DELETE", {});
}

export async function retryListingUploads(concept: Concept, listingId: number) {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  await uploadListingAssets(
    shopId,
    listingId,
    listingPhotoPaths(
      concept,
      orderedPhotoKeys(concept, defaultPhotoKeys(concept), concept.etsy_cover_page),
      defaultInfoKeys(),
    ),
    selectedAssetPaths(concept, defaultFileKeys(concept)),
  );
  await applyListingDefaults(shopId, listingId, concept, concept.etsy_taxonomy_id ?? undefined).catch(
    () => undefined,
  );
}

async function applyListingDefaults(
  shopId: number,
  listingId: number,
  concept: Concept,
  taxonomyId?: number,
) {
  const shop = await readShopState();
  await etsyForm(`/application/shops/${shopId}/listings/${listingId}`, "PATCH", {
    when_made: ETSY_WHEN_MADE,
    shop_section_id: shop.section_by_type[concept.type],
  });
  if (taxonomyId) await trySetAiProperty(shopId, listingId, taxonomyId);
}

export async function getShopListings() {
  const state = await readShopState();
  const shopId = shopIdOrThrow(state.shop_id);
  const listings: Array<Record<string, unknown>> = [];
  for (const listingState of ["draft", "active", "inactive", "sold_out"] as const) {
    let offset = 0;
    for (;;) {
      const page = await etsyGet<{ results?: Array<Record<string, unknown>> }>(
        `/application/shops/${shopId}/listings`,
        { state: listingState, limit: 100, offset },
      );
      const rows = page.results ?? [];
      listings.push(...rows);
      offset += rows.length;
      if (rows.length < 100) break;
    }
  }
  return listings;
}

export function firstPageKey(concept: Concept) {
  const pages = concept.images.filter((slot) => slot.kind === "product" && slot.status === "approved");
  const first = pages.find((slot) => slot.key === "product-1" || slot.key === "product") ?? pages[0];
  return first?.key ?? null;
}

/** Page 1 leads the gallery. Promo keys stay after it. Info slides are appended later. */
export function orderedPhotoKeys(concept: Concept, photoKeys: string[], coverPage: boolean) {
  if (!coverPage) return photoKeys;
  const page = firstPageKey(concept);
  if (!page) return photoKeys;
  return [page, ...photoKeys.filter((key) => key !== page)];
}

export function listingPhotoPaths(concept: Concept, photoKeys: string[], infoKeys: string[]) {
  return [...selectedAssetPaths(concept, photoKeys), ...infoKeys.map((key) => infoImagePath(key))];
}

function wallArtPrintPath(concept: Concept, key: string) {
  if (!isWallArt(concept.type) || !concept.folder_path) return null;
  const design = key.match(/^product-(\d+)/)?.[1];
  if (!design) return null;
  const sized = path.join(concept.folder_path, "product", `${design}-18x24.png`);
  return existsSync(sized) ? sized : null;
}

export function selectedAssetPaths(concept: Concept, keys: string[]) {
  if (isWallArt(concept.type) && concept.folder_path) {
    const zipPath = path.join(concept.folder_path, "wall-art-sizes.zip");
    if (existsSync(zipPath)) return [zipPath];
  }
  return keys.map((key) => {
    const sized = wallArtPrintPath(concept, key);
    if (sized) return sized;
    const slot = concept.images.find((entry) => entry.key === key);
    if (!slot) throw new Error(`Image slot not found: ${key}`);
    const chosen = slot.generations.find((g) => g.id === slot.selected_generation_id);
    if (!chosen) throw new Error(`No approved file for ${key}`);
    return chosen.path;
  });
}

export function defaultPhotoKeys(concept: Concept) {
  return concept.images.filter((slot) => slot.kind === "promo" && slot.status === "approved").map((slot) => slot.key);
}

export function defaultFileKeys(concept: Concept) {
  return concept.images.filter((slot) => slot.kind === "product" && slot.status === "approved").map((slot) => slot.key);
}
