import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  ETSY_TITLE_MAX,
  PARTY_PAGE_COUNT,
} from "../types";
import { avoidBlock, etsyListingDescriptionRules, themeBlock, type ArtDirector } from "./shared";

/**
 * Cupcake Party: tek Letter sayfa — 12 unique topper + altta yazılabilir etiket.
 * İkinci sayfa, banner, davetiye veya boyama yok.
 */
export const partyArtDirector: ArtDirector = {
  type: "party",

  conceptPrompt: (vars) => `You are the art director for printable CUPCAKE TOPPER sheets on Etsy. Buyers print ONE Letter page on card stock, cut the pieces, tape circles to toothpicks for cupcakes, and write on the blank labels for bottles or snacks.

This is ONE page only. NOT a second banner sheet. NOT an invitation. NOT a coloring page. NOT a poster. NOT a photo of a party.

Generate ${vars.quantity} completely distinct listing concept${vars.quantity === 1 ? "" : "s"}. Each concept is ONE listing: exactly ${PARTY_PAGE_COUNT} print-and-cut sheet.

Hard constraints:
- Each concept must be visually and thematically distinct from these recently used concepts:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
  If inventing a theme, pick ONE style lane below. Mix cute and adult across concepts — do not only do kids' parties.
- Write every buyer-facing field in English.
- Output must be valid JSON matching the schema below. No prose outside JSON.

STYLE LANES (pick one per concept):
1. MATCHING KAWAII SET — same circle frame (soft stripes, dots or pastel fill), twelve different cute motifs from one world (smiling foods, drinks, tiny animals). Cohesive like a dessert stand. No text on the toppers.
2. ORIGINAL CHARACTER SET — twelve different invented animals or people in one illustration style, bold and simple so they read at 5cm. Cute or teen/adult (cool, stylish), not only toddler. No text on the toppers.
3. ADULT HUMOR SET — original simple doodle people (bean-body or stick, round head). Each circle is a DIFFERENT joke or caption about birthday, aging, wine, brunch, office, or a milestone (30 / 40 / 50). PG-13: sarcasm and alcohol ok; no nudity, no slurs, no explicit sex, no hate.

COPYRIGHT — HARD FAIL if broken:
- Invent every character. No trademarks, logos, or characters from books, movies, TV, games, comics, or viral named memes.
- Do not draw or name Winnie-the-Pooh, Paddington, Clifford, Curious George, Cat in the Hat, Grinch, Peter Rabbit, Hungry Caterpillar, Disney/Pixar, Nintendo, or any lookalike in the same outfit/colors.
- Do not copy a famous meme character 1:1. Original doodle people only.

TEXT ON TOPPERS — HARD FAIL if broken:
- Never print the same word on every circle (no SPLASH, RAWR, YAY, PARTY, ONE on all 12).
- Never a HAPPY BIRTHDAY banner, pennants, or letter flags on this sheet.
- Kawaii / character: ZERO letters on the circles. Motif only.
- Humor: a different English punchline on each circle, spelled correctly.

For each concept produce:
1. title — short internal working title (max 8 words), e.g. "Kawaii Brunch Toppers" or "Sarcastic Thirty Cupcakes".
2. theme — two or three words (e.g. "kawaii brunch", "milestone forty", "original frogs").
3. theme_bible — 1-2 sentences locking the style lane, palette (2-4 colours), and that toppers have no repeated slogan.
4. page_prompts — array of exactly ${PARTY_PAGE_COUNT} string. Begins with theme_bible copied verbatim.
   - ONE Letter sheet, pure white background, flat graphic, no photo, no mockup, no shadows.
   - TOP: tidy 4x3 grid of 12 identical-size ROUND cupcake toppers (about 5cm / 2 inch). All 12 UNIQUE. Thin dashed cut-line around every circle.
   - BOTTOM: 6 rectangular food/name labels in 2 rows of 3. Same motif family, character tucked to one side, LARGE empty white writing area so the buyer can write a name or food. No printed names, no slogans on the labels. Dashed cut-line around every rectangle.
   - 10mm page margin. Nothing cropped. No pennants, no banner, no second page of flags.
5. promo_scenes — array of exactly ${vars.promoCount} strings. Three different photographs, toppers fill the frame, never the same table twice. (1) in-use close-up of cupcakes with these toppers (2) flat lay of the cut circles (3) a hand pushing a toothpick into frosting, no face. Pieces MUST match the sheet.
6. etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters. Must include "printable" and "cupcake toppers", plus the theme keyword. Add "funny" or "adult" when the set is humor; add "kawaii" or "cute" when it is a matching sweet set. Never write "digital download" or "instant download" in the title.
7. ${etsyListingDescriptionRules({
      highlight: "12 UNIQUE DESIGNS + 6 BLANK LABELS",
      included:
        "12 different cupcake toppers, 6 write-on food/name labels, 1 Letter 8.5x11 print-and-cut sheet, PNG only (no PDF), 300 dpi, instant download, print as many as needed for personal use",
      howItWorks:
        "line-by-line: purchase, download from Etsy, print, cut dashed lines (2-inch punch optional), tape toppers to toothpicks, write on labels, add to cupcakes. No Canva, no extra software.",
      perfectFor:
        "Invent 8-12 named occasions that fit THIS theme (adult humor sets get adult occasions; kawaii sets get sweet/kids/brunch). Not three generic ones.",
      extras:
        "One-page print-and-cut sheet. White cardstock. 12 unique toppers, never the same slogan on every circle.",
      honesty: "NOT Canva, NOT editable, NOT a physical item, no licensed characters, no extra banner page, never claim 20 designs.",
    })}
8. etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates. Include "cupcake toppers" and "printable".

SEO coherence: primary keyword in the hook and once more later; at least four tags appear naturally.

Return exactly this shape:
{
  "concepts": [
    {
      "title": "string",
      "summary_tr": "string",
      "theme": "string",
      "theme_bible": "string",
      "page_prompts": ["string"],
      "promo_scenes": ["string"],
      "etsy_title": "string",
      "etsy_description": "string",
      "etsy_tags": ["string"]
    }
  ]
}`,

  productRender: `Printable CUPCAKE TOPPER sheet rules (print and cut, ONE page):
- Flat graphic sheet on pure white. Straight-on. No photo, no mockup, no drop shadows, no perspective.
- TOP: exactly 12 round toppers in a 4x3 grid, identical circle size, dashed cut-line 2-3mm outside each circle. All 12 designs UNIQUE.
- BOTTOM: exactly 6 rectangular write-on labels, character on one side, large empty white area, dashed cut-line around each. No printed names.
- NO pennant banner, NO letter flags, NO second sheet, NO repeated slogan (never SPLASH/PARTY/YAY on every circle).
- Simple, bold, centred art that still reads at 5cm. Not a full-page scene. Not an invitation.
- Original characters only. No trademarks, no lookalike licensed mascots.
- Humor captions (if any): English, spelled correctly, a different joke per circle.
- 10mm empty margin. Nothing cropped by the page edge.`,

  promoRender: `Promo styling for cupcake toppers:
- Follow the SHOT rule. Real cupcakes with the ACTUAL toppers from the sheet on toothpicks. The circles fill the frame. Do not repeat the same table.
- Faithful copies only: do not restyle the doodles or rewrite the jokes. Overlay titles belong at the top of the PHOTO, never on the circles.
- Show cut circles in use. Labels may appear on a bottle or treat bag if the scene asks.
- Hands and arms are fine. No identifiable faces.`,

  themeDomain:
    "printable cupcake toppers with write-on food labels, one Letter sheet, no banners. Mix cute AND adult (about half each). RANGE (not a closed menu): kawaii food, original animals, cottage, brunch, office humor, milestone ages, girls night, retirement roast, sports roast, book club, teacher gifts. Never licensed characters. Never HAPPY BIRTHDAY flag / pennant themes. Do not only return kawaii bakery + sarcastic thirty.",
};
