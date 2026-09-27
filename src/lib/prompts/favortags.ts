import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  ETSY_TITLE_MAX,
  FAVORTAGS_PAGE_COUNT,
} from "../types";
import { avoidBlock, etsyListingDescriptionRules, themeBlock, type ArtDirector } from "./shared";

/**
 * Party favor tags: one Letter sheet — 12 identical rectangular hang tags.
 * Buyer prints, cuts, punches the marked hole, ties onto gifts or treat bags.
 */
export const favortagsArtDirector: ArtDirector = {
  type: "favortags",

  conceptPrompt: (vars) => `You are the art director for printable PARTY FAVOR TAG / gift hang-tag sheets on Etsy. Buyers print ONE Letter page on card stock, cut the rectangles, punch the marked hole, and tie each tag onto a gift, favor bag or treat.

This is ONE page only. NOT cupcake toppers. NOT an invitation. NOT a coloring page. NOT a Canva/self-edit template. NOT a photo of a party.

Generate ${vars.quantity} completely distinct listing concept${vars.quantity === 1 ? "" : "s"}. Each concept is ONE listing: exactly ${FAVORTAGS_PAGE_COUNT} print-and-cut sheet.

Hard constraints:
- Each concept must be visually and thematically distinct from these recently used concepts:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
  If inventing a theme, pick a party or holiday world (halloween, birthday, baby shower, bridal, christmas, thank you, classroom party). Cute and friendly, not horror, no weapons, no scary faces.
- Write every buyer-facing field in English.
- Output must be valid JSON matching the schema below. No prose outside JSON.

COPYRIGHT — HARD FAIL if broken:
- Invent every character. No trademarks, logos, or characters from books, movies, TV, games, comics, or viral named memes.
- Do not copy a shop watermark, brand name, or "self edit / try before you buy" badge onto the sheet.

SHEET — HARD FAIL if broken:
- Exactly 12 rectangular hang tags in a tidy 3-column × 4-row grid.
- All 12 tags are IDENTICAL copies of ONE design (same art, same greeting, same colours). Not 12 unique tags.
- Each tag: vertical rectangle, small hole-punch circle at the TOP CENTER, thin dashed cut-line around the rectangle.
- COLORED illustration (not black-and-white coloring art). Cute icons matching the theme, scattered in the upper two-thirds.
- One short English greeting on every tag (e.g. "Happy Halloween", "Thank You", "Happy Birthday"), spelled correctly. Same greeting on all 12.
- Bottom of each tag: the word "from," plus a blank handwriting line. No printed guest names, no "Your Name" filled in.
- Pure white page background. 10mm margin. Nothing cropped. No watermark.

For each concept produce:
1. title — short internal working title (max 8 words), e.g. "Cute Halloween Favor Tags".
2. theme — two or three words naming the party world.
3. theme_bible — 1-2 sentences locking the palette (2-4 colours), the greeting words, and the 3–6 icons that appear on every tag.
4. page_prompts — array of exactly ${FAVORTAGS_PAGE_COUNT} string. Begins with theme_bible copied verbatim.
   - ONE Letter sheet, flat graphic, no photo, no mockup, no shadows.
   - 3×4 grid of 12 IDENTICAL rectangular hang tags.
   - Hole punch mark at top center of each tag. Dashed cut-line around each tag.
   - Greeting + blank "from," line as specified above.
5. promo_scenes — array of exactly ${vars.promoCount} strings. Three different photographs, the tag fills the frame, never the same table twice. (1) in-use close-up of one cut tag tied with twine on a kraft box (2) flat lay of the cut tags (3) a hand tying twine through the hole, no face. Tags MUST match the sheet.
6. etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters. Must include "printable" and "favor tags" or "gift tags", plus the theme keyword. Never write "digital download" or "instant download" in the title.
7. ${etsyListingDescriptionRules({
      highlight: "12 MATCHING PRINTABLE FAVOR TAGS",
      included:
        "12 identical rectangular hang tags on 1 Letter 8.5x11 print-and-cut sheet, hole-punch mark on each tag, blank from-line to handwrite, high-resolution PNG only (no PDF), 300 dpi, print as many as needed for personal use",
      howItWorks:
        "line-by-line: purchase, download from Etsy, print on white cardstock, cut dashed lines, punch the marked hole, handwrite a name on the from-line, tie onto gifts or treat bags. No Canva, no extra software.",
      perfectFor:
        "Invent 8-12 named occasions that fit THIS tag set (halloween favors, birthday loot bags, baby shower thank-yous, classroom treats). Not three generic ones.",
      extras:
        "One-page print-and-cut sheet. White cardstock. All 12 tags match. Greeting is printed; the from-line is blank for handwriting.",
      honesty:
        "NOT Canva, NOT editable, NOT a physical item, no licensed characters, never claim unique designs if they are identical, never claim a template the buyer can type into.",
    })}
8. etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates. Include "favor tags" or "gift tags" and "printable".

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

  productRender: `Printable PARTY FAVOR TAG sheet rules (print and cut, ONE page):
- Flat graphic sheet on pure white. Straight-on. No photo, no mockup, no drop shadows, no perspective.
- Exactly 12 vertical rectangular hang tags in a 3×4 grid. All 12 IDENTICAL.
- Small hole-punch circle at the TOP CENTER of every tag. Thin dashed cut-line 2-3mm outside each rectangle.
- Colored cute illustration in the upper area. One English greeting, spelled correctly, same on every tag.
- Bottom of each tag: "from," plus a blank line for handwriting. No filled-in names.
- No watermark, no shop name, no "self edit" badge, no QR code.
- Original characters only. No trademarks, no lookalike licensed mascots.
- 10mm empty margin. Nothing cropped by the page edge.`,

  promoRender: `Promo styling for party favor tags:
- Follow the SHOT rule. Cut tags, hole punched, tied with twine. The tag fills the frame. Do not repeat the same table.
- Faithful copies only: same icons, same greeting, same colours as the sheet. Overlay titles belong at the top of the PHOTO, never on the tag.
- Daylight, tidy gift-table or craft-table scene. Hands and arms are fine. No identifiable faces.`,

  themeDomain:
    "printable party favor hang tags, 12 identical rectangles on one Letter sheet, hole punch, write-on from-line. RANGE (not a closed menu): halloween, birthday, baby shower, bridal shower, thank you, christmas, classroom treats, graduation, easter. Cute, not horror. Never licensed characters. Never Canva/self-edit templates.",
};
