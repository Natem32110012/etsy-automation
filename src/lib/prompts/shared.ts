import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  ETSY_TITLE_MAX,
  PROMO_SIZE,
  type ProductType,
} from "../types";

export type ConceptPromptVars = {
  quantity: number;
  /** Kullanıcı tema seçtiyse konseptler onun etrafında kurulur. */
  selectedTheme: string | null;
  /** Son kayıtların "başlık — tema" özeti; tekrar önleme için. */
  avoidList: string[];
  promoCount: number;
  /** Boyama paketi: bir konseptte kaç ürün sayfası (1. sayfa referans). */
  pageCount: number;
};

/**
 * Her ürün tipi kendi sanat yönetmenliğini yazıyor (ton, çizim kuralları, promo
 * sahne örnekleri); Etsy alanlarının kuralları ve JSON sözleşmesi ortak kalıyor
 * — parser tek yerden okuyor, tipler arası kayma olmuyor.
 */
export type ArtDirector = {
  type: ProductType;
  /** Adım 1'deki konsept üretimi promptu. */
  conceptPrompt: (vars: ConceptPromptVars) => string;
  /** Ürün görseli üretilirken konseptin promptuna eklenen çizim/print kuralları. */
  productRender: string;
  /** Promo görseli üretilirken sahne talimatına eklenen mockup kuralları. */
  promoRender: string;
  /** "Tema öner" çağrısına verilen alan tarifi. */
  themeDomain: string;
};

export function avoidBlock(avoidList: string[]) {
  if (avoidList.length === 0) return "(no history yet — you are free, but stay original)";
  return avoidList.map((entry) => `- ${entry}`).join("\n");
}

export function themeBlock(selectedTheme: string | null) {
  return selectedTheme && selectedTheme.trim().length > 0
    ? `The seller's brief is fixed: "${selectedTheme.trim()}". Build the whole concept inside this scene (characters, setting, what is on the page, listing copy). The theme field may be a tighter name, but the product must clearly be this brief. Do not wander to an unrelated subject.`
    : "No brief was given. Invent an original theme for each concept.";
}

/** Etsy ilan metni: tarama blokları, 450-650 kelime. Kısa 5 paragraf yasak. */
export type EtsyListingCopy = {
  /** ✨ satırının geri kalanı, örn. "1 DOODLE COLORING PAGE" */
  highlight: string;
  /** WHAT'S INCLUDED maddeleri — dürüst parça/sayfa sayısı ve format. */
  included: string;
  /** HOW IT WORKS adımları. */
  howItWorks: string;
  /** PERFECT FOR ipucu: kime, kaç madde, hangi vesileler. */
  perfectFor: string;
  /** Baskı / yaş / kullanım notu. */
  extras: string;
  /** Uydurulmayacak şeyler (Canva, fazladan sayfa, telif). */
  honesty: string;
};

export function etsyListingDescriptionRules(copy: EtsyListingCopy) {
  return `etsy_description — a FULL Etsy listing, 450-650 words. Short five-paragraph blurbs are a failure. Match the scannable shop style below. Use the primary keyword from etsy_title in the opening and once more near the end. ${copy.extras}
   Structure, blank line between blocks:
   (1) Hook — 3-5 sentences. Open with the keyword, what the buyer gets, and how they use it.
   (2) Line: ✨ ${copy.highlight}
   (3) ✨ WHAT'S INCLUDED — "• " list: ${copy.included}
   (4) ✨ PERFECT FOR — "• " list of 8-12 named occasions. ${copy.perfectFor}
   (5) ✨ HOW IT WORKS — ${copy.howItWorks}
   (6) ✨ PRINTING — ${copy.extras} Also: home or print shop, colours may vary slightly between screen and paper.
   (7) ✨ PLEASE NOTE — digital only, nothing ships, print-ready PNG files only (no PDF), personal use, review listing before purchase. ${copy.honesty}
   (8) Closing sentence that repeats the keyword and the true page/piece count.

Emoji only as the ✨ section markers. No markdown # headings. Do not invent Canva, editable templates, extra pages, licensed characters, or a physical item.`;
}

/**
 * Konsept promptunun ortak iskeleti. Tip dosyaları sadece kendi alanlarını
 * doldurur; sıra, alan adları ve JSON sözleşmesi burada sabit.
 */
export function conceptPromptFrame(input: {
  role: string;
  vars: ConceptPromptVars;
  /** 2. alan: ürün görseli promptunun nasıl yazılacağı. */
  productImageRules: string;
  /** 3. alan: promo sahne talimatlarının nasıl yazılacağı + örnekler. */
  promoSceneRules: string;
  /** etsy_title'da geçmesi gereken ürün tipi ifadesi. */
  titleKeywords: string;
  /** etsy_description tarama blokları (tipin dürüst içeriği). */
  listingCopy: EtsyListingCopy;
}) {
  const { vars } = input;

  return `${input.role}
Generate ${vars.quantity} completely distinct concept${vars.quantity === 1 ? "" : "s"}.

Hard constraints:
- Each concept must be visually and thematically distinct from these recently used concepts:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
- Write every buyer-facing field in English.
- Output must be valid JSON matching the schema below. No prose outside JSON.

For each concept produce:
1. title — short internal working title (max 8 words).
2. summary_tr — one Turkish sentence, max 30 words, for the seller. What the artwork shows, the main colors, and what is left out. Not a translation of the title. Every other field stays English.
3. theme — two or three words naming the theme, used for de-duplication later.
3. etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters, front-loads the primary keyword, includes ${input.titleKeywords} and the word "printable". Never write "digital download", "instant download", or "digital file" in the title.
4. etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates, no single generic word repeated across tags.
5. product_image_prompt — ${input.productImageRules}
6. promo_scenes — array of exactly ${vars.promoCount} strings. Each string is one scene instruction for a promotional image. ${input.promoSceneRules}
7. ${etsyListingDescriptionRules(input.listingCopy)}

SEO coherence between the fields:
- The primary keyword from etsy_title must appear word for word in the hook and once more later in the description.
- At least four of your own etsy_tags must appear naturally inside description sentences.
- Never list keywords, never stuff them, never repeat a phrase awkwardly. If a keyword does not fit a sentence, leave it out.
- The title, the description and the tags must clearly describe the same product. Do not introduce a feature, a page count or a format in one field that the others contradict.

Return exactly this shape:
{
  "concepts": [
    {
      "title": "string",
      "summary_tr": "string",
      "theme": "string",
      "etsy_title": "string",
      "etsy_tags": ["string"],
      "product_image_prompt": "string",
      "promo_scenes": ["string"],
      "etsy_description": "string"
    }
  ]
}`;
}

/**
 * Her ürün görseline eklenen print kuralları. Model 1536px üretiyor, dosya
 * sonra 300dpi'ye büyütülüyor; bu yüzden ince tarama/doku değil temiz kontur
 * isteniyor — büyütmede dağılan tek şey o.
 */
export const PRINT_RULES = `Print production rules:
- Pure white background, no canvas texture, no paper grain, no drop shadows, no vignette.
- Flat, straight-on view. The artwork fills the frame edge to edge as a finished printable page, it is not a photo of a page.
- Clean vector-like edges. No noise, no dithering, no fine cross-hatching or stippling — the file is upscaled to 300dpi and those details break down.
- No watermark, no signature, no logo, no border frame unless the concept explicitly asks for one.
- No lorem ipsum and no misspelled words. Any text that appears must be spelled correctly and be intentional.`;

/**
 * Promo kareleri hem Etsy galerisinde hem Pinterest'te aynı dosya olarak
 * kullanılıyor, o yüzden oran sabit ve kompozisyon dikey okunacak şekilde
 * kuruluyor.
 */
export const PROMO_RULES = `Promotional image rules:
- Vertical 2:3 composition (${PROMO_SIZE.width}x${PROMO_SIZE.height}). It is used both in the Etsy gallery and as a Pinterest pin, so the subject must read clearly as a tall thumbnail.
- The product fills most of the frame. A tiny full page lost on a wide desk is a failure.
- Follow the SHOT rule. Do not repeat the same desk, mug, and plant in every photo.
- Photographic and naturally lit. The printed page or cut pieces stay fully in frame and never crop past their edges.
- Promotional overlay (if required) sits only at the top of the photo, never on the product. Product text stays 1:1 from the reference.
- No watermark, no stock-photo logo, no borders, no collage of unrelated products.`;
