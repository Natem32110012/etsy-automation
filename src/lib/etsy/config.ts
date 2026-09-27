import { isBuiltinType, type BuiltinProductType } from "../types";
import { readCustomType } from "../custom-types";

export const ETSY_API_BASE = "https://openapi.etsy.com/v3";
export const ETSY_OAUTH_AUTHORIZE = "https://www.etsy.com/oauth/connect";
export const ETSY_OAUTH_TOKEN = "https://api.etsy.com/v3/public/oauth/token";

export const ETSY_SCOPES = [
  "listings_w",
  "listings_r",
  "listings_d",
  "shops_r",
  "shops_w",
  "transactions_r",
] as const;

/** Digital printables: buyer gets files, shop currency is TRY. */
export const ETSY_CURRENCY = "TRY";
export const ETSY_WHO_MADE = "i_did";
/** Instant digital files — not the "made to order" digital checkbox. */
export const ETSY_WHEN_MADE = "2020_2026";
export const ETSY_IS_SUPPLY = false;
export const ETSY_LISTING_TYPE = "download";

export const SECTION_HINTS: Record<BuiltinProductType, string[]> = {
  coloring: ["Coloring Pages"],
  doodle: ["Doodles"],
  planner: ["Planners"],
  invitation: ["Invitations"],
  party: ["Party Decor"],
  paperdoll: ["Paper Dolls"],
  favortags: ["Party Decor", "Gift Tags"],
  "kids-wall-art": ["Kids Wall Art"],
  "adult-wall-art": ["Wall Art"],
};

/** Default listing price in TRY — editable per listing. */
export const DEFAULT_PRICE_TRY: Record<BuiltinProductType, number> = {
  doodle: 49.9,
  coloring: 39.9,
  planner: 49.9,
  invitation: 59.9,
  party: 69.9,
  paperdoll: 79.9,
  favortags: 59.9,
  "kids-wall-art": 249.9,
  "adult-wall-art": 299.9,
};

export const DEFAULT_QUANTITY = 999;

/** Search hints against Etsy seller taxonomy names. */
/** Exact seller-taxonomy paths. First hit wins. */
export const TAXONOMY_HINTS: Record<BuiltinProductType, string[]> = {
  coloring: ["Books, Movies & Music > Books > Coloring Books"],
  doodle: ["Art & Collectibles > Prints > Digital Prints"],
  planner: ["Paper & Party Supplies > Paper > Calendars & Planners"],
  invitation: ["Paper & Party Supplies > Paper > Invitations & Announcements > Invitations"],
  party: [
    "Craft Supplies & Tools > Kitchen Supplies > Baking & Cake Decorations > Cake Toppers & Picks > Cake Toppers",
  ],
  paperdoll: ["Art & Collectibles > Dolls & Miniatures > Art Dolls"],
  favortags: [
    "Paper & Party Supplies > Paper > Stationery > Design & Templates > Templates > Gift Tag Templates",
  ],
  "kids-wall-art": ["Art & Collectibles > Prints > Digital Prints"],
  "adult-wall-art": ["Art & Collectibles > Prints > Digital Prints"],
};

export function priceFor(type: string): number {
  if (isBuiltinType(type)) return DEFAULT_PRICE_TRY[type];
  return readCustomType(type)?.priceTry ?? 49.9;
}

export function etsyCredentials() {
  const apiKey = process.env.ETSY_API_KEY?.trim() ?? "";
  const sharedSecret = process.env.ETSY_SHARED_SECRET?.trim() ?? "";
  const redirectUri =
    process.env.ETSY_REDIRECT_URI?.trim() || "http://localhost:3001/api/etsy/callback";
  return { apiKey, sharedSecret, redirectUri };
}

/** Etsy v3: x-api-key is keystring:shared_secret. */
export function etsyApiKeyHeader() {
  const { apiKey, sharedSecret } = etsyCredentials();
  if (!apiKey) throw new Error("ETSY_API_KEY is missing in .env.local");
  return sharedSecret ? `${apiKey}:${sharedSecret}` : apiKey;
}

export function listingUrl(listingId: number) {
  return `https://www.etsy.com/listing/${listingId}`;
}

export function listingEditorUrl(listingId: number) {
  return `https://www.etsy.com/your/shops/me/listing-editor/edit/${listingId}`;
}
