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

export const coloringArtDirector: ArtDirector = {
  type: "coloring",

  conceptPrompt: (vars) => {
    const pages = vars.pageCount || 1;
    if (pages <= 1) {
      return conceptPromptFrame({
        role: "You are the art director for a children's coloring page digital product line sold on Etsy.",
        vars,
        productImageRules:
          "the actual coloring page line-art prompt. Bold clean outlines of even weight, no shading, no grey fill, no colour. One clear subject or one simple readable scene, large open areas a 4-8 year old can fill without leaving the lines. Age-appropriate and friendly: no scary faces, no weapons, no tiny background clutter.",
        promoSceneRules:
          'Three different photographs. The page fills the frame. Never the same desk twice. (1) in-use close-up of the printed page with chunky crayons (2) top-down flat lay of the printed sheet (3) a hand colouring the page, no face. Scene 1 may mention a tiny English overlay "Coloring Pages". Every other scene must say "no overlay text".',
        titleKeywords: "the phrase \"coloring page\" or \"coloring pages\"",
        listingCopy: {
          highlight: "1 PRINTABLE KIDS COLORING PAGE",
          included:
            "1 coloring page, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use",
          howItWorks:
            "line-by-line: purchase, download from Etsy, print, colour with crayons or thick markers. No Canva, no extra software.",
          perfectFor:
            "Name 8-12 kid occasions (rainy day, quiet time, birthday party activity, classroom, travel, ages 4-8). Tie them to THIS scene, not generic 'any party'.",
          extras:
            "Ages 4 to 8. Bold outlines and large open areas suit small hands and thick crayons. One page only.",
          honesty: "Not a multi-page pack. Not adult intricate mandala. Not Canva.",
        },
      });
    }

    return `You are the art director for a children's coloring page PACK sold on Etsy. COLORABLE black-and-white outlines only.

Generate ${vars.quantity} completely distinct pack concept${vars.quantity === 1 ? "" : "s"}. Each concept is ONE listing: a set of exactly ${pages} matching coloring pages that belong together.

Hard constraints:
- Each concept must be visually and thematically distinct from these recently used concepts:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
  If inventing a theme, keep it age 4-8, friendly, no scary faces, no weapons.
- Write every buyer-facing field in English.
- Output must be valid JSON matching the schema below. No prose outside JSON.

For each concept produce:
1. title — short internal working title (max 8 words).
2. theme — two or three words naming the pack world.
3. theme_bible — 1-2 sentences locking the world and the main characters so every page is clearly the same set.
4. etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters. Must include "printable", "coloring pages" and the theme keyword. Mention it is a ${pages}-page set. Never write "digital download" or "instant download" in the title.
5. etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates.
6. page_prompts — array of exactly ${pages} strings. Bold clean outlines, no shading, no grey, no colour. Large open areas for a 4-8 year old.
   - page 1 HERO: the main scene of the pack, the cover page a parent would recognise in the Etsy thumbnail.
   - pages 2–${pages} COMPANIONS: the SAME characters and world as page 1, same cute rounded style and line weight. Each page is a NEW scene, pose or activity (not a copy of page 1). A child should feel they are colouring the next page of the same story.
7. promo_scenes — array of exactly ${vars.promoCount} strings. Three different photographs, page fills the frame, never the same desk twice. (1) in-use close-up with crayons (2) top-down flat lay of a printed page (3) a hand colouring, no face. Use different pages of the pack across scenes.
   Scene 1 MAY include a tiny overlay in ENGLISH only, at most four words (e.g. "Coloring Pages"). No Turkish. No badges, no banners, no infographic.
   Scenes 2–${vars.promoCount} must be completely textless: write "no overlay text" in each. No titles, no stickers, no "digital download" badges.
8. ${etsyListingDescriptionRules({
      highlight: `${pages}-PAGE MATCHING COLORING PACK`,
      included: `${pages} matching coloring pages in the same world, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use`,
      howItWorks:
        "line-by-line: purchase, download from Etsy, print the set, colour with crayons. No Canva. Pages belong together as one story, not unrelated sheets.",
      perfectFor:
        `Name 8-12 kid occasions that fit THIS pack world (birthday activity, classroom, rainy day, travel). Always say it is a ${pages}-page set.`,
      extras: `Ages 4 to 8. Bold outlines, thick crayons. Exactly ${pages} pages — never claim a different count.`,
      honesty: `HARD: the pack has exactly ${pages} pages. Not Canva. Not 20 unrelated designs.`,
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

  productRender: `Children's coloring page rules:
- Black line art only on white. Uniform stroke weight, thick enough for a child to colour inside comfortably.
- Absolutely no greyscale fill, no hatching, no gradients, no colour anywhere.
- Simple shapes, generous white space, closed outlines everywhere so colour cannot leak out.
- Friendly rounded style, no realistic detail, no fine texture.
- No text on the page unless the concept explicitly asks for a single simple word to colour in.
- If this is a later page in a pack, keep the SAME characters and world as the reference page 1, but draw a NEW scene. Do not duplicate page 1's layout.
- Do NOT draw a page border, frame or decorative rectangle. A thin black finishing line is added after generation and CLIPPED: keep every character and leaf inside the page, nothing hanging off the edge.`,

  promoRender: `Promo styling for children's coloring pages:
- Follow the SHOT rule: close-up in use, flat lay, or hands. Do not put every photo on the same desk.
- Bright daylight. Crayons are welcome. Hands and arms only, no identifiable faces.
- The printed page fills most of the frame.
- Overlay text is controlled separately: follow the HARD RULE at the top of the prompt. Do not invent extra badges or banners.`,

  themeDomain:
    "children's coloring pages for ages 4-8, friendly, no weapons. RANGE (not a closed menu): everyday home, school, parks, jobs, sports, food, vehicles, seasons, gentle fantasy, holidays, friendship. Do not default to dinosaurs / mermaids / unicorns / jungle safari / outer space on every round.",
};
