import { PINTEREST_DESCRIPTION_MAX, PINTEREST_TITLE_MAX, type Concept } from "../types";

/**
 * Etsy metni Pinterest'te birebir işe yaramıyor: başlık 100, açıklama 500
 * karakterle sınırlı ve Pinterest aramasında cümle gibi yazılmış, hashtag'siz
 * metinler daha iyi çalışıyor. Bu yüzden export metnini kopyalamak yerine ayrı
 * bir süzgeç çağrısı yapılıyor.
 */
export function buildPinterestPrompt(concept: Concept, typeLabel: string) {
  return `You write Pinterest pin copy for an Etsy printable shop.

Product type: ${typeLabel}
Etsy title: ${concept.etsy_title}
Theme: ${concept.theme}
Etsy description: ${concept.etsy_description}
Keywords already used: ${concept.etsy_tags.join(", ")}

Write pin copy that a Pinterest user searching for this product would click.

Rules:
- title: max ${PINTEREST_TITLE_MAX} characters. Front-load the search keyword. No shop name, no hashtags, no ALL CAPS, no emoji. Never write "digital download" or "instant download".
- description: max ${PINTEREST_DESCRIPTION_MAX} characters. Two or three natural sentences that say what it is, who it is for and what the buyer gets. Include the main keyword once more in a sentence. No hashtags, no emoji, no link, no "click here", no bullet list.
- Do not repeat the Etsy title word for word.
- English only.

Return exactly: { "title": "string", "description": "string" }`;
}
