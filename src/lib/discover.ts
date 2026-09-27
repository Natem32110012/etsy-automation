import { readCustomType, readCustomTypes, saveCustomType, type CustomProductType } from "./custom-types";
import { searchActiveListings, looksDigital, firstListingImage, type MarketListing } from "./etsy/search";
import { parseJson } from "./json";
import { slugify } from "./paths";
import { generateText } from "./replicate";
import { isBuiltinType, PRODUCT_TYPES } from "./types";

const LETTER = {
  label: "letter-300dpi",
  width: 2550,
  height: 3300,
  dpi: 300,
  generateAspect: "1152x1536" as const,
};

const A4 = {
  label: "a4-300dpi",
  width: 2480,
  height: 3508,
  dpi: 300,
  generateAspect: "1024x1536" as const,
};

/** Each press of Find products uses the next group, so the page does not repeat the same cards. */
const SCAN_ROUNDS = [
  [
    "printable wall art digital download",
    "kids worksheet printable",
    "printable sticker sheet",
    "reward chart printable kids",
    "affirmation cards printable",
    "printable game cards",
    "habit tracker printable",
    "printable lunchbox notes",
    "printable alphabet poster",
    "printable recipe card",
  ],
  [
    "printable calendar page",
    "kitchen conversion chart printable",
    "printable flash cards",
    "kids chore chart printable",
    "printable quote poster",
    "printable reading log",
    "printable birthday banner",
    "printable classroom labels",
    "savings tracker printable",
    "printable bingo cards",
  ],
  [
    "printable door hanger",
    "mandala wall art printable",
    "tracing worksheet printable",
    "printable checklists",
    "printable packing list",
    "printable seating chart",
    "printable milestone cards",
    "printable water tracker",
    "printable gift certificate",
    "printable nursery art",
  ],
];

const LICENSED =
  /disney|stitch|pokemon|hello kitty|bluey|cocomelon|frozen|mario|minecraft|harry potter|descendants|sanrio|barbie/i;

export type IdeaExample = {
  listingId: number;
  title: string;
  url: string;
  price: number | null;
  currency: string | null;
  imageUrl: string | null;
};

export type ProductIdea = {
  name: string;
  page: string;
  buyer: string;
  onePage: boolean;
  priceTry: number;
  priceNote: string;
  tags: string[];
  examples: IdeaExample[];
};

export type AdoptIdeaInput = {
  name: string;
  page: string;
  buyer: string;
  priceTry: number;
  listing: MarketListing;
};

const IDEA_TARGET = 10;

export async function scanProductIdeas(extra?: string | null, round = 0) {
  const group = SCAN_ROUNDS[Math.abs(round) % SCAN_ROUNDS.length] ?? SCAN_ROUNDS[0];
  const queries = [...group];
  const extraQuery = extra?.trim();
  if (extraQuery) queries.unshift(extraQuery.slice(0, 140));

  const byId = new Map<number, MarketListing>();
  const groups: ListingGroup[] = [];
  for (const query of queries) {
    const rows = await searchActiveListings(query, 8);
    const digital = rows.filter(looksDigital);
    const picked = (digital.length >= 2 ? digital : rows).slice(0, 4);
    if (picked.length === 0) continue;
    groups.push({ query, listings: picked });
    for (const row of picked) byId.set(row.listingId, row);
  }

  const selected = groups.slice(0, IDEA_TARGET);
  const listings = [...byId.values()];
  if (listings.length < 4 || selected.length === 0) {
    return { ideas: [] as ProductIdea[], scanned: listings.length, round: Math.abs(round) % SCAN_ROUNDS.length };
  }

  const rates = await ratesToTry();
  let ideas = await askIdeas(selected, listings, rates, []);
  if (ideas.length < IDEA_TARGET) {
    const more = await askIdeas(
      selected,
      listings,
      rates,
      ideas.map((idea) => idea.name),
    );
    const seen = new Set(ideas.map((idea) => idea.name.toLowerCase()));
    for (const idea of more) {
      if (ideas.length >= IDEA_TARGET) break;
      const key = idea.name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      ideas.push(idea);
    }
  }
  ideas = ideas.slice(0, IDEA_TARGET);
  await attachExampleImages(ideas);
  return { ideas, scanned: listings.length, round: Math.abs(round) % SCAN_ROUNDS.length };
}

type ListingGroup = { query: string; listings: MarketListing[] };

async function askIdeas(
  groups: ListingGroup[],
  listings: MarketListing[],
  rates: Record<string, number>,
  avoidNames: string[],
) {
  const count = Math.max(1, IDEA_TARGET - avoidNames.length);
  const raw = await generateText(clusterPrompt(groups, avoidNames, count), {
    maxTokens: 8192,
    temperature: 0.4,
  });
  const parsed = parseJson<{ ideas?: unknown }>(raw, "Fikir");
  return materializeIdeas(parsed.ideas, listings, rates);
}

export async function adoptListing(input: AdoptIdeaInput): Promise<CustomProductType> {
  const listing = input.listing;
  const existing = readCustomTypes().find((row) => row.sourceListingId === listing.listingId);
  if (existing) return existing;

  const raw = await generateText(adoptPrompt(input), { maxTokens: 4096, temperature: 0.4 });
  const parsed = parseJson<Record<string, unknown>>(raw, "Ürün tipi");
  const slug = uniqueSlug(String(parsed.slug || parsed.label || input.name));
  const paper = String(parsed.paper || "letter").toLowerCase() === "a4" ? A4 : LETTER;
  const saved = saveCustomType({
    id: slug,
    label: text(parsed.label) || input.name.slice(0, 48),
    sourceTitle: listing.title,
    sourceUrl: listing.url,
    sourceListingId: listing.listingId,
    searchQuery: text(parsed.searchQuery) || input.name.slice(0, 80),
    themeDomain: text(parsed.themeDomain) || `${input.name}. ${input.page}`,
    priceTry: shopPrice(input.priceTry),
    sectionHints: strings(parsed.sectionHints).slice(0, 4).length
      ? strings(parsed.sectionHints).slice(0, 4)
      : [text(parsed.label) || input.name],
    taxonomyHints: strings(parsed.taxonomyHints).slice(0, 4).length
      ? strings(parsed.taxonomyHints).slice(0, 4)
      : ["Digital Prints"],
    print: paper,
    role:
      text(parsed.role) ||
      `You are the art director for a one-page printable "${input.name}" sold on Etsy.`,
    productImageRules: text(parsed.productImageRules) || input.page,
    promoSceneRules:
      text(parsed.promoSceneRules) ||
      'Three different photographs. The product fills the frame. Never the same desk twice. (1) in-use close-up (2) top-down flat lay (3) hands using it, no face. Scene 1 may use a tiny English overlay of the product name. Every other scene must say "no overlay text".',
    titleKeywords: text(parsed.titleKeywords) || '"printable"',
    listingCopy: {
      highlight: text(field(parsed.listingCopy, "highlight")) || "1 PRINTABLE PAGE",
      included:
        text(field(parsed.listingCopy, "included")) ||
        "1 high-resolution PNG only (no PDF), 300 dpi, instant digital download, print as many as needed for personal use",
      howItWorks:
        text(field(parsed.listingCopy, "howItWorks")) ||
        "line-by-line: purchase, download from Etsy, print. No Canva, no extra software.",
      perfectFor: text(field(parsed.listingCopy, "perfectFor")) || input.buyer,
      extras: text(field(parsed.listingCopy, "extras")) || "One page. Home or print shop.",
      honesty: text(field(parsed.listingCopy, "honesty")) || "Not Canva. Not a physical item. Not extra pages.",
    },
    productRender:
      text(parsed.productRender) ||
      "Black line art or flat color as the product needs. White background. Nothing cropped. No watermark.",
    promoRender:
      text(parsed.promoRender) ||
      "Follow the SHOT rule: in-use close-up, flat lay, or hands. The product fills the frame. Do not repeat the same desk. Hands only, no identifiable faces.",
    createdAt: new Date().toISOString(),
  });
  return saved;
}

function alreadyMadeLabels() {
  const custom = readCustomTypes().map((entry) => entry.label);
  return [
    "coloring page",
    "doodle page",
    "planner",
    "invitation",
    "cupcake topper",
    "paper doll",
    "favor tag",
    "kids wall art",
    "adult wall art",
    "wall art print",
    ...custom,
  ];
}

function clusterPrompt(groups: ListingGroup[], avoidNames: string[], count: number) {
  const lines = groups
    .map((group) => {
      const rows = group.listings
        .map((row) => {
          const price = row.price != null ? `${row.price.toFixed(2)} ${row.currency ?? ""}`.trim() : "n/a";
          return `- ${row.listingId} | ${price} | ${row.title.slice(0, 90)}`;
        })
        .join("\n");
      return `Group: ${group.query}\n${rows}`;
    })
    .join("\n\n");
  const avoid = avoidNames.length
    ? `Do not repeat these ideas already chosen: ${avoidNames.join(", ")}.`
    : "";

  return `You turn live Etsy search groups into product types for a factory that prints ONE PNG page. No sales rank is available. Do not invent a product the titles do not support.

Already made here, so skip a group that is only these: ${alreadyMadeLabels().join(", ")}.
${avoid}

${lines}

Return exactly ${count} different ideas, one per group. Do not merge groups into one idea. Skip a group only when every title is licensed or already made. Each idea needs at least 1 listing id copied from its own group.
onePage is false when the product is a book, a multi-page pack, a Canva template, or a physical item.
Skip licensed characters.
name is a short product-type label, not a copied listing title.
page says what is on the single printed page.
buyer says who it is for.
Write every string in English.

Return exactly:
{ "ideas": [ { "name": "string", "page": "string", "buyer": "string", "onePage": true, "listingIds": [1] } ] }`;
}

function materializeIdeas(
  value: unknown,
  listings: MarketListing[],
  rates: Record<string, number>,
): ProductIdea[] {
  if (!Array.isArray(value)) return [];
  const byId = new Map(listings.map((row) => [row.listingId, row]));
  const ideas: ProductIdea[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const name = text(row.name).slice(0, 80);
    const page = text(row.page);
    const buyer = text(row.buyer);
    if (!name || !page || LICENSED.test(`${name} ${page}`)) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;

    const ids = (Array.isArray(row.listingIds) ? row.listingIds : [])
      .map((id) => Number(id))
      .filter((id) => byId.has(id));
    const examples = [...new Set(ids)].slice(0, 3).map((id) => {
      const listing = byId.get(id)!;
      return {
        listingId: listing.listingId,
        title: listing.title,
        url: listing.url,
        price: listing.price,
        currency: listing.currency,
        imageUrl: null,
      };
    });
    if (examples.length === 0) continue;

    const priced = shopPriceFromExamples(
      examples.map((example) => byId.get(example.listingId)!),
      rates,
    );
    seen.add(key);
    ideas.push({
      name,
      page,
      buyer: buyer || "Home printers",
      onePage: row.onePage !== false,
      priceTry: priced.priceTry,
      priceNote: priced.note,
      tags: commonTags(ids.map((id) => byId.get(id)!)),
      examples,
    });
  }

  return ideas.slice(0, 10);
}

async function attachExampleImages(ideas: ProductIdea[]) {
  const ids = [...new Set(ideas.flatMap((idea) => idea.examples.map((example) => example.listingId)))];
  const images = new Map<number, string | null>();
  for (const id of ids) images.set(id, await firstListingImage(id));
  for (const idea of ideas) {
    for (const example of idea.examples) example.imageUrl = images.get(example.listingId) ?? null;
  }
}

function shopPriceFromExamples(listings: MarketListing[], rates: Record<string, number>) {
  const converted = listings
    .map((listing) => toTry(listing.price, listing.currency, rates))
    .filter((value): value is number => value != null);
  if (converted.length === 0) {
    return { priceTry: 49.9, note: "No usable example price — drafts start at 49.9 TRY" };
  }
  const priceTry = shopPrice(median(converted));
  const priced = listings.filter((listing) => toTry(listing.price, listing.currency, rates) != null);
  const only = priced.length === 1 ? priced[0] : null;
  const note = only
    ? `${only.price!.toFixed(2)} ${only.currency} → ${priceTry.toFixed(1)} TRY`
    : `Median of ${priced.length} listing prices → ${priceTry.toFixed(1)} TRY`;
  return { priceTry, note };
}

function toTry(amount: number | null, currency: string | null, rates: Record<string, number>) {
  if (amount == null || amount <= 0 || !currency) return null;
  const rate = rates[currency];
  if (!rate) return null;
  return amount * rate;
}

function shopPrice(amount: number) {
  if (!Number.isFinite(amount) || amount <= 0) return 49.9;
  const tens = Math.max(2, Math.round(amount / 10));
  return Number((tens * 10 - 0.1).toFixed(1));
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function commonTags(listings: MarketListing[]) {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    for (const tag of listing.tags) {
      const key = tag.trim();
      if (!key) continue;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tag]) => tag);
}

async function ratesToTry(): Promise<Record<string, number>> {
  const rates: Record<string, number> = { TRY: 1 };
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", {
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return rates;
    const data = (await response.json()) as { rates?: Record<string, number> };
    const usdTry = data.rates?.TRY;
    if (typeof usdTry !== "number" || usdTry < 5 || usdTry > 200) return rates;
    rates.USD = usdTry;
    for (const code of ["EUR", "GBP", "CAD", "AUD"]) {
      const perUsd = data.rates?.[code];
      if (typeof perUsd === "number" && perUsd > 0) rates[code] = usdTry / perUsd;
    }
  } catch {
    // Kur düşerse sadece TRY ilanlar fiyat olur; diğerleri 49.9 yedeğine iner.
  }
  return rates;
}

function adoptPrompt(input: AdoptIdeaInput) {
  const listing = input.listing;
  return `You design ONE new printable product type for an Etsy factory that generates a single PNG page with an image model. The buyer prints it at home.

Product type: ${input.name}
What is on the page: ${input.page}
Buyer: ${input.buyer}
Source listing title: ${listing.title}
Tags: ${listing.tags.join(", ") || "(none)"}
Description excerpt: ${listing.description || "(none)"}

Rules:
- One page only. PNG, no PDF, no Canva, no editable template, no physical product.
- paper is "letter" (US 8.5x11) unless this is clearly A4 stationery such as a planner or invitation, then "a4".
- slug: lowercase letters and hyphens, 2-24 chars, no spaces. Not one of: ${PRODUCT_TYPES.join(", ")}.
- Write every string in English.
- productRender tells the image model how the page should look (line art vs flat color, what must be on the page, what is forbidden).
- Do not copy the source title word for word into the label. Use the product type name.
- taxonomyHints: 1 to 3 real Etsy seller-taxonomy paths, deepest leaf first. Use a path that names this product (Bookmarks, Gift Tag Templates, Cake Toppers, Coloring Books, Invitations, Calendars & Planners, Art Dolls). If none fits, use "Art & Collectibles > Prints > Digital Prints". Never invent a path.

Return exactly:
{
  "slug": "string",
  "label": "string",
  "searchQuery": "string",
  "themeDomain": "string",
  "paper": "letter",
  "sectionHints": ["string"],
  "taxonomyHints": ["string"],
  "role": "string",
  "productImageRules": "string",
  "promoSceneRules": "string",
  "titleKeywords": "string",
  "productRender": "string",
  "promoRender": "string",
  "listingCopy": {
    "highlight": "string",
    "included": "string",
    "howItWorks": "string",
    "perfectFor": "string",
    "extras": "string",
    "honesty": "string"
  }
}`;
}

function uniqueSlug(raw: string) {
  let slug = slugify(raw).replace(/-/g, "-").slice(0, 24).replace(/-+$/g, "");
  if (!/^[a-z]/.test(slug)) slug = `print-${slug}`.replace(/-+$/g, "").slice(0, 24);
  if (slug.length < 2) slug = "printable";
  let candidate = slug;
  let n = 2;
  while (isBuiltinType(candidate) || readCustomType(candidate)) {
    const suffix = `-${n}`;
    candidate = `${slug.slice(0, 24 - suffix.length)}${suffix}`;
    n += 1;
  }
  return candidate;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => text(entry)).filter(Boolean);
}

function field(value: unknown, key: string) {
  if (!value || typeof value !== "object") return "";
  return (value as Record<string, unknown>)[key];
}
