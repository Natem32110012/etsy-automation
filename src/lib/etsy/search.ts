import { etsyGet } from "./client";

export type MarketListing = {
  listingId: number;
  title: string;
  tags: string[];
  url: string;
  price: number | null;
  currency: string | null;
  description: string;
};

type RawListing = {
  listing_id?: number;
  title?: string;
  tags?: string[];
  url?: string;
  description?: string;
  price?: { amount?: number; divisor?: number; currency_code?: string } | number;
  currency_code?: string;
};

function money(value: RawListing["price"]): number | null {
  if (typeof value === "number") return value;
  if (!value || typeof value.amount !== "number") return null;
  return value.amount / (value.divisor || 100);
}

function currencyOf(row: RawListing): string | null {
  if (row.price && typeof row.price === "object" && row.price.currency_code) {
    return row.price.currency_code.toUpperCase();
  }
  return row.currency_code ? row.currency_code.toUpperCase() : null;
}

/** Public active-listing search. Titles and tags only — no sales rank. */
export async function searchActiveListings(keywords: string, limit = 25): Promise<MarketListing[]> {
  const query = keywords.trim().slice(0, 140);
  if (!query) return [];
  const data = await etsyGet<{ results?: RawListing[] }>("/application/listings/active", {
    keywords: query,
    limit: Math.min(Math.max(limit, 1), 50),
    sort_on: "score",
    sort_order: "desc",
  });
  return (data.results ?? [])
    .map((row) => {
      const listingId = Number(row.listing_id);
      const title = String(row.title ?? "").trim();
      if (!Number.isFinite(listingId) || !title) return null;
      return {
        listingId,
        title,
        tags: (row.tags ?? []).map((tag) => String(tag).trim()).filter(Boolean).slice(0, 13),
        url: row.url || `https://www.etsy.com/listing/${listingId}`,
        price: money(row.price),
        currency: currencyOf(row),
        description: String(row.description ?? "").replace(/\s+/g, " ").trim().slice(0, 400),
      };
    })
    .filter((row): row is MarketListing => Boolean(row));
}

const DIGITAL =
  /printable|digital|download|coloring|colouring|planner|worksheet|invitation|sticker|bookmark|svg|png|template|paper doll|favor tag|cupcake/i;

export function looksDigital(listing: MarketListing) {
  const haystack = `${listing.title} ${listing.tags.join(" ")} ${listing.description}`;
  return DIGITAL.test(haystack);
}

/** Rank 1 image on a public listing. Missing images stay null. */
export async function firstListingImage(listingId: number): Promise<string | null> {
  try {
    const data = await etsyGet<{
      results?: Array<{ rank?: number; url_570xN?: string; url_fullxfull?: string }>;
    }>(`/application/listings/${listingId}/images`);
    const images = [...(data.results ?? [])].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
    const first = images[0];
    return first?.url_570xN || first?.url_fullxfull || null;
  } catch {
    return null;
  }
}
