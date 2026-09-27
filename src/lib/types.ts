import { z } from "zod";

export const PRODUCT_TYPES = [
  "doodle",
  "coloring",
  "planner",
  "invitation",
  "party",
  "paperdoll",
  "favortags",
  "kids-wall-art",
  "adult-wall-art",
] as const;

export type BuiltinProductType = (typeof PRODUCT_TYPES)[number];

export function isBuiltinType(type: string): type is BuiltinProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(type);
}

/** Built-in tipler ve Ideas sayfasından eklenen slug'lar. */
export const productTypeSchema = z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);
export type ProductType = string;

/**
 * gpt-image-2'nin kabul ettiği oran/piksel değerleri. Print boyutları (A4/Letter)
 * bu listedeki hiçbir orana tam denk gelmediği için üretim en yakın oranda
 * yapılıp `src/lib/image.ts` içinde beyaz kenarla hedef boyuta oturtuluyor.
 */
export const ASPECT_RATIOS = [
  "1:1",
  "2:3",
  "3:4",
  "3:2",
  "3:4",
  "4:3",
  "9:16",
  "16:9",
  "auto",
  "1024x1024",
  "1024x1536",
  "1536x1024",
  "1152x1536",
  "1536x1152",
  "2448x3264",
  "2048x2048",
] as const;

export type AspectRatio = (typeof ASPECT_RATIOS)[number];

/**
 * gpt-image-2'nin kalite kademesi — doğrudan maliyeti belirliyor. "auto" şemada
 * var çünkü REPLICATE_IMAGE_QUALITY ile verilebiliyor; arayüz sadece üç kademeyi
 * gösteriyor.
 */
export const IMAGE_QUALITIES = ["low", "medium", "high", "auto"] as const;
export const SELECTABLE_QUALITIES = ["low", "medium", "high"] as const;

export const imageQualitySchema = z.enum(IMAGE_QUALITIES);
export type ImageQuality = z.infer<typeof imageQualitySchema>;

/** Arayüzün açılış değerleri: ürün print'e gidiyor, promo ekranda kalıyor. */
export const DEFAULT_PRODUCT_QUALITY: ImageQuality = "high";
export const DEFAULT_PROMO_QUALITY: ImageQuality = "medium";

/** Ürün ve promo için ayrı seçilebilen kalite; her üretim isteğine ekleniyor. */
export type QualitySettings = { product: ImageQuality; promo: ImageQuality };

export const DEFAULT_QUALITY: QualitySettings = {
  product: DEFAULT_PRODUCT_QUALITY,
  promo: DEFAULT_PROMO_QUALITY,
};

export const QUALITY_LABELS: Record<ImageQuality, string> = {
  low: "Düşük — en ucuz",
  medium: "Orta",
  high: "Yüksek — en pahalı",
  auto: "Otomatik",
};

/** Promo görselleri hem Etsy hem Pinterest için tek boyutta üretiliyor (2:3 dikey). */
export const PROMO_SIZE = { width: 1000, height: 1500 } as const;
export const PROMO_ASPECT: AspectRatio = "1024x1536";

export const PROMO_COUNT_MIN = 3;
export const PROMO_COUNT_MAX = 5;
export const PROMO_COUNT_DEFAULT = 4;

/** Konsept promptuna enjekte edilen geçmiş kayıt sayısı — tekrar önleme penceresi. */
export const AVOID_WINDOW = 30;

export const printSizeSchema = z.object({
  /** Klasör adının sonuna yazılan etiket, ör. "letter-2550x3300". */
  label: z.string(),
  width: z.number(),
  height: z.number(),
  dpi: z.number(),
  /** Modelden istenecek oran; hedef orana en yakın desteklenen değer. */
  generateAspect: z.enum(ASPECT_RATIOS),
});

export const productTypeConfigSchema = z.object({
  label: z.string(),
  /** Klasör/dosya adlarında kullanılan kısa ad. */
  slug: z.string(),
  print: printSizeSchema,
  /** Bu tipin pinlerinin gideceği board'un .env değişkeni. */
  boardEnv: z.string(),
});

export type PrintSize = z.infer<typeof printSizeSchema>;
export type ProductTypeConfig = z.infer<typeof productTypeConfigSchema>;

export const generationSchema = z.object({
  id: z.string(),
  created_at: z.string(),
  /** Modele gönderilen tam prompt — maliyet/hata takibi için saklanıyor. */
  prompt: z.string(),
  /** "Yeniden üret" aynı promptu farklı seed ile çalıştırıyor. */
  seed: z.number(),
  /** Hangi kalite kademesinde üretildi — maliyet takibi için. */
  quality: imageQualitySchema.nullable().default(null),
  path: z.string(),
});

export const imageStatusSchema = z.enum([
  "pending",
  "generating",
  "generated",
  "approved",
  "failed",
]);

export const imageSlotSchema = z.object({
  /** "product" veya "promo-1", "promo-2"... Route ve klasör adlarında da bu geçiyor. */
  key: z.string(),
  kind: z.enum(["product", "promo"]),
  /**
   * Promo slotunda sahne talimatı, ürün slotunda ürün görseli promptu. Kullanıcı
   * düzenleyip yeniden üretebildiği için konseptin kendisinden ayrı tutuluyor.
   */
  instruction: z.string(),
  status: imageStatusSchema,
  error: z.string().nullable(),
  generations: z.array(generationSchema),
  selected_generation_id: z.string().nullable(),
  /** Promo 1: tikliyse İngilizce overlay, değilse yazısız. */
  overlay_text: z.boolean().default(false),
});

export const conceptStatusSchema = z.enum([
  "concept_pending",
  "concept_approved",
  "concept_rejected",
  "images_pending",
  "images_approved",
  "exported",
  "pinterest_posted",
]);

export const pinSchema = z.object({
  image_key: z.string(),
  pin_id: z.string().nullable(),
  board_id: z.string().nullable(),
  created_at: z.string(),
  /** Pinterest token'ı yokken metinler üretilip pin atılmıyor. */
  dry_run: z.boolean(),
  error: z.string().nullable(),
});

export const conceptSchema = z.object({
  id: z.string(),
  type: productTypeSchema,
  status: conceptStatusSchema,
  title: z.string(),
  /** Satıcının okuduğu kısa Türkçe özet. Eski konseptlerde boş kalır. */
  summary_tr: z.string().nullable().default(null),
  theme: z.string(),
  product_image_prompt: z.string(),
  /**
   * Paper doll gibi çok sayfalı ürünlerde her sayfanın promptu. Tek sayfalı
   * tiplerde boş kalır; o zaman ürün görseli `product_image_prompt`.
   */
  product_pages: z.array(z.string()).default([]),
  /** Bebeğin yüz/saç/oran/duruşu — üç sayfada birebir tekrarlanmak için. */
  character_bible: z.string().nullable().default(null),
  /** Oyun dünyasının sabit tarifi — sayfa 2/3'ün temadan sapmaması için. */
  theme_bible: z.string().nullable().default(null),
  promo_scenes: z.array(z.string()),
  etsy_title: z.string(),
  etsy_description: z.string(),
  etsy_tags: z.array(z.string()),
  etsy_link: z.string().nullable(),
  /** Dashboard tiki: ürün Etsy'de paylaşıldı mı. Listing linkinden bağımsız. */
  etsy_listed: z.boolean().default(false),
  etsy_listing_id: z.number().nullable().default(null),
  etsy_listing_state: z.enum(["none", "draft", "active", "inactive", "sold_out", "failed", "deleted"]).default("none"),
  etsy_listing_error: z.string().nullable().default(null),
  etsy_price: z.number().nullable().default(null),
  etsy_quantity: z.number().nullable().default(null),
  etsy_taxonomy_id: z.number().nullable().default(null),
  /** Taslak yüklenirken 1. sayfa ilanın ilk fotoğrafı olsun. */
  etsy_cover_page: z.boolean().default(false),
  /** Listeden gizlendi; dosyalar durur, tekrar önleme listesinde kalır. */
  archived: z.boolean().default(false),
  /** Satıcı Pinterest’e elle attıktan sonra tikler. API pin’i değildir. */
  pinterest_shared: z.boolean().default(false),
  pinterest_title: z.string().nullable(),
  pinterest_description: z.string().nullable(),
  pinterest_pins: z.array(pinSchema),
  folder_path: z.string().nullable(),
  created_at: z.string(),
  images: z.array(imageSlotSchema),
});

export const logFileSchema = z.object({
  /** Export klasörlerinin başındaki sıra numarası; hiç sıfırlanmıyor. */
  export_counter: z.number(),
  concepts: z.array(conceptSchema),
});

export type Generation = z.infer<typeof generationSchema>;
export type ImageSlot = z.infer<typeof imageSlotSchema>;
export type ImageStatus = z.infer<typeof imageStatusSchema>;
export type Concept = z.infer<typeof conceptSchema>;
export type ConceptStatus = z.infer<typeof conceptStatusSchema>;
export type Pin = z.infer<typeof pinSchema>;
export type LogFile = z.infer<typeof logFileSchema>;

export const ETSY_TITLE_MAX = 140;

/** Strip common Etsy title stuffing — keep the product name, drop format slogans. */
export function sanitizeEtsyTitle(raw: string) {
  let title = raw;
  for (const pattern of [
    /\binstant\s+digital\s+download\b/gi,
    /\bdigital\s+download\b/gi,
    /\binstant\s+download\b/gi,
  ]) {
    title = title.replace(pattern, " ");
  }
  return title
    .replace(/\s*[|•·]\s*/g, " ")
    .replace(/\s*[-–—:,]+\s*$/g, "")
    .replace(/^[-–—:,]+\s*/g, "")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,!?.])/g, "$1")
    .trim()
    .slice(0, ETSY_TITLE_MAX)
    .trim();
}
export const ETSY_TAG_MAX = 20;
export const ETSY_TAG_COUNT = 13;
export const PINTEREST_TITLE_MAX = 100;
export const PINTEREST_DESCRIPTION_MAX = 500;

export function promoKey(index: number) {
  return `promo-${index}`;
}

export const PRODUCT_KEY = "product";

/** Çok sayfalı ürünlerde 1-indexed: product-1, product-2, product-3. */
export function productPageKey(index: number) {
  return `product-${index}`;
}

export const PACK_PAGE_TYPES = ["coloring", "doodle"] as const;
export type PackPageType = (typeof PACK_PAGE_TYPES)[number];

export function isPackType(type: ProductType): type is PackPageType {
  return (PACK_PAGE_TYPES as readonly string[]).includes(type);
}

export const PACK_PAGE_MIN = 1;
export const PACK_PAGE_MAX = 8;

export const WALL_ART_TYPES = ["kids-wall-art", "adult-wall-art"] as const;
export const WALL_SET_MAX = 3;

export function isWallArt(type: ProductType): boolean {
  return (WALL_ART_TYPES as readonly string[]).includes(type);
}

export function wallLandscapeKey(index: number) {
  return `product-${index}-land`;
}

export function isWallLandscapeKey(key: string) {
  return /^product-\d+-land$/.test(key);
}

export const PAPERDOLL_PAGE_COUNT = 3;
export const PARTY_PAGE_COUNT = 1;
export const FAVORTAGS_PAGE_COUNT = 1;

export const PAPERDOLL_PAGE_FILES: Record<string, string> = {
  "product-1": "01.png",
  "product-2": "02.png",
  "product-3": "03.png",
};

export const PARTY_PAGE_FILES: Record<string, string> = {
  "product-1": "01.png",
};

export const PARTY_PAGE_LABELS: Record<string, string> = {
  "product-1": "Topper + etiket",
};

export const FAVORTAGS_PAGE_LABELS: Record<string, string> = {
  "product-1": "Favor tags sheet",
};

export const PAPERDOLL_PAGE_LABELS: Record<string, string> = {
  "product-1": "Sayfa 1 — bebek + oda",
  "product-2": "Sayfa 2 — parça kıyafetler",
  "product-3": "Sayfa 3 — aksesuarlar",
};

export function productPageLabel(type: ProductType, key: string, index: number) {
  if (type === "paperdoll") return PAPERDOLL_PAGE_LABELS[key] ?? `Sayfa ${index + 1}`;
  if (type === "party") return PARTY_PAGE_LABELS[key] ?? `Sayfa ${index + 1}`;
  if (type === "favortags") return FAVORTAGS_PAGE_LABELS[key] ?? "Favor tags sheet";
  if (isWallArt(type)) {
    const land = key.match(/^product-(\d+)-land$/);
    if (land) return `Landscape ${land[1]}`;
    const portrait = key.match(/^product-(\d+)$/);
    if (portrait) return `Portrait ${portrait[1]}`;
  }
  if (key === PRODUCT_KEY) return "Ürün görseli";
  return `Sayfa ${index + 1}`;
}

export function productSlots<T extends { kind: "product" | "promo" }>(images: T[]) {
  return images.filter((slot) => slot.kind === "product");
}

/**
 * Sayfa 1 (veya tek sayfalı üründeki tek ürün karesi) serbest.
 * Sayfa 2–3, sayfa 1 onaylanmadan kilitli — kıyafet bebekle aynı ölçekte olsun diye.
 * Promo, bütün ürün sayfaları onaylanmadan kilitli.
 */
export function slotUnlocked(
  images: { key: string; kind: "product" | "promo"; status: string }[],
  slot: { key: string; kind: "product" | "promo" },
  type?: ProductType,
) {
  const products = images.filter((entry) => entry.kind === "product");
  const primary = products[0];
  if (slot.kind === "product") {
    if (isWallLandscapeKey(slot.key)) {
      const portrait = images.find((entry) => entry.key === slot.key.replace(/-land$/, ""));
      return portrait?.status === "approved";
    }
    if (!primary || slot.key === primary.key) return true;
    if (type === "paperdoll" && slot.key === "product-3") {
      const page2 = products.find((entry) => entry.key === "product-2");
      return primary.status === "approved" && page2?.status === "approved";
    }
    return primary.status === "approved";
  }
  return products.length > 0 && products.every((entry) => entry.status === "approved");
}
