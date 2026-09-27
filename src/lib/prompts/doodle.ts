import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  ETSY_TITLE_MAX,
} from "../types";
import {
  avoidBlock,
  conceptPromptFrame,
  etsyListingDescriptionRules,
  themeBlock,
  type ArtDirector,
} from "./shared";

export const doodleArtDirector: ArtDirector = {
  type: "doodle",

  conceptPrompt: (vars) => {
    const pages = vars.pageCount || 1;
    if (pages <= 1) {
      return conceptPromptFrame({
        role: "You are the art director for a doodle art digital product line sold on Etsy — cute, clean, instantly readable doodle collage pages.",
        vars,
        productImageRules:
          "the actual doodle line-art prompt. Describe a full-page collage of 15-25 separate cute objects and characters that belong to the theme, packed close together with small filler doodles (leaves, sparkles, swirls, tiny hearts, bubbles) tucked into the gaps. Name the individual objects. Every object is drawn simply, sits on its own, and is recognisable at a glance; many of them carry a simple kawaii face (dot eyes and a small smile). The page is busy overall but each single shape stays clean and open inside — the appeal is charm and clarity, not intricacy.",
        promoSceneRules:
          'Three different photographs. The page fills the frame. Never the same desk twice. (1) in-use close-up of the printed doodle page with markers (2) top-down flat lay of the printed sheet (3) a hand colouring with a marker, no face. Scene 1 may mention a tiny English overlay "Doodle Pages". Every other scene must say "no overlay text".',
        titleKeywords: 'the phrase "coloring page" together with "doodle" or "kawaii"',
        listingCopy: {
          highlight: "1 KAWAII DOODLE COLORING PAGE",
          included:
            "1 full-page doodle collage coloring page, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use",
          howItWorks:
            "line-by-line: purchase, download from Etsy, print, colour with markers / gel pens / coloured pencils. No Canva, no extra software. Optional: frame a finished page.",
          perfectFor:
            "Name teen and adult occasions (unwind night, kawaii craft session, bullet-journal mood, gift for a marker lover). Not preschool worksheets.",
          extras:
            "Suits teens and adults who want to unwind. Clean bold outlines colour easily with markers, gel pens or coloured pencils. One page only.",
          honesty: "Not a kids 4-8 worksheet. Not a pack of pages. Not a Canva template.",
        },
      });
    }

    return `You are the art director for a kawaii doodle coloring PACK sold on Etsy — cute, clean, instantly readable collage pages for teens and adults.

Generate ${vars.quantity} completely distinct pack concept${vars.quantity === 1 ? "" : "s"}. Each concept is ONE listing: a set of exactly ${pages} matching doodle collage pages that belong together.

Hard constraints:
- Each concept must be visually and thematically distinct from these recently used concepts:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
  If inventing a theme, keep it teen/adult kawaii collage — not preschool worksheets, not zentangle/mandala.
- Write every buyer-facing field in English.
- Output must be valid JSON matching the schema below. No prose outside JSON.

For each concept produce:
1. title — short internal working title (max 8 words).
2. theme — two or three words naming the pack world.
3. theme_bible — 1-2 sentences locking the object family, faces and outline style so every page is clearly the same set.
4. etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters. Must include "printable", "coloring pages" and "doodle" or "kawaii", plus the theme keyword. Mention it is a ${pages}-page set. Never write "digital download" or "instant download" in the title.
5. etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates.
6. page_prompts — array of exactly ${pages} strings. Each is a full-page collage of 15-25 separate cute objects that belong to the theme, packed close with small filler doodles. Name the individual objects. Simple shapes, open interiors, many kawaii faces.
   - page 1 HERO: the cover collage a buyer would recognise in the Etsy thumbnail.
   - pages 2–${pages} COMPANIONS: the SAME theme and object family as page 1, same bold outline style. Each page is a NEW arrangement with NEW objects in that family (not a copy of page 1). A buyer should feel they are colouring the next page of the same set.
7. promo_scenes — array of exactly ${vars.promoCount} strings. Three different photographs, page fills the frame, never the same desk twice. (1) in-use close-up with markers (2) top-down flat lay of a printed page (3) a hand colouring, no face. Use different pages of the pack across scenes.
   Scene 1 MAY include a tiny overlay in ENGLISH only, at most four words (e.g. "Doodle Pages"). No Turkish. No badges, no banners, no infographic.
   Scenes 2–${vars.promoCount} must be completely textless: write "no overlay text" in each. No titles, no stickers, no "digital download" badges.
8. ${etsyListingDescriptionRules({
      highlight: `${pages}-PAGE KAWAII DOODLE PACK`,
      included: `${pages} matching doodle collage coloring pages in the same world, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use`,
      howItWorks:
        "line-by-line: purchase, download from Etsy, print the set, colour with markers / gel pens / coloured pencils. No Canva. Pages belong together as one set, not unrelated sheets.",
      perfectFor:
        `Name teen and adult occasions that fit THIS pack world (unwind night, kawaii craft session, gift for a marker lover). Always say it is a ${pages}-page set. Not preschool worksheets.`,
      extras: `Suits teens and adults. Clean bold outlines. Exactly ${pages} pages — never claim a different count.`,
      honesty: `HARD: the pack has exactly ${pages} pages. Not a kids 4-8 worksheet. Not Canva. Not 20 unrelated designs.`,
    })}

SEO coherence: primary keyword in the hook and once more later; at least four tags appear naturally in sentences; fields must agree on the ${pages}-page count.

Return exactly this shape:
{
  "concepts": [
    {
      "title": "string",
      "summary_tr": "string",
      "theme": "string",
      "theme_bible": "string",
      "etsy_title": "string",
      "etsy_tags": ["string"],
      "page_prompts": [${Array.from({ length: pages }, () => '"string"').join(", ")}],
      "promo_scenes": ["string"],
      "etsy_description": "string"
    }
  ]
}`;
  },

  /**
   * Bu kurallar bilerek "yoğunluk"tan çok "okunabilirlik" üzerine kurulu:
   * önceki sürüm zentangle/mandala isteyince model her boşluğu desenle
   * dolduran, tek bakışta okunmayan sayfalar üretiyordu.
   */
  productRender: `Doodle collage page rules:
- Black line art only on white. One consistent, confident, fairly thick outline weight across the whole page, like a bold fineliner.
- Every object is a simple, clean, cartoon-style shape with a large empty interior left open for colouring. Give the cute objects simple kawaii faces: two dot eyes, a small curved smile, optional round cheeks.
- Objects touch and overlap slightly to fill the page, but each one stays whole and recognisable — never merge them into an unreadable tangle.
- Absolutely no zentangle, no mandala, no ornamental pattern fills, no scales, no stippling, no cross-hatching, no shading, no grey, no colour. Do not decorate the inside of a shape with tiny repeating detail.
- Detail budget: only what is needed to identify the object. If a shape needs a magnifier to read, simplify it.
- Keep the smallest enclosed area comfortably large enough to colour with a normal marker tip.
- Fill leftover gaps with simple small doodles (leaves, stars, sparkles, swirls, dots, tiny hearts) rather than with pattern.
- Composition fills the page to a narrow clean margin. No text.
- Do NOT draw a page border, frame or decorative rectangle. A thin black finishing line is added after generation and CLIPPED, same as the children's coloring pages: keep every object inside the page, nothing hanging off the edge.
- If this is a later page in a pack, keep the SAME theme, object family and outline style as the reference page 1, but draw a NEW collage with NEW objects. Do not duplicate page 1's layout.`,

  promoRender: `Promo styling for doodle pages:
- Follow the SHOT rule: close-up in use, flat lay, or hands. Do not put every photo on the same desk.
- Markers and fineliners are welcome. Soft daylight. Hands are fine, faces are not.
- The printed page fills most of the frame.
- Overlay text is controlled separately: follow the HARD RULE at the top of the prompt. Do not invent extra badges or banners.`,

  themeDomain:
    "cute doodle collage pages for teens and adults. RANGE (not a closed menu): snacks, drinks, stationery, plants, pets, hobbies, rooms, weather, sports, music, travel, tiny collections, seasonal objects. Invent new object-families each time; do not default to cats / coffee / plants / space / ocean on every round.",
};
