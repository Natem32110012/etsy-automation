import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  ETSY_TITLE_MAX,
  PAPERDOLL_PAGE_COUNT,
} from "../types";
import { avoidBlock, etsyListingDescriptionRules, themeBlock, type ArtDirector } from "./shared";

/**
 * Paper doll kenara yapışmaz: her parça tam görünür, kesim payı sayfa
 * kenarının içinde kalır. Genel PRINT_RULES "kenara kadar doldur" dediği
 * için bu tipte o kural kullanılmıyor.
 */
export const PAPERDOLL_PRINT_RULES = `Print production rules for paper doll sheets:
- Pure white background, no canvas texture, no paper grain, no drop shadows, no vignette.
- Flat, straight-on view. This is a print-ready activity sheet, not a photo of a page.
- Keep a clear empty margin of at least 10mm on all four sides. NOTHING may be cropped by the page edge — no half rugs, half beds, half chairs, half outfits, half shoes. If an object would hit the border, draw it smaller and fully inside.
- FRONT VIEW ONLY: every object is drawn perfectly flat and facing the camera. No 3/4 view, no objects turning left or right.
- Clean vector-like edges. No noise, no dithering, no fine cross-hatching.
- No watermark, no signature, no logo, no decorative page frame.
- No lorem ipsum and no misspelled words.`;

/**
 * Paper doll: 3 ayrı iş sayfası. Sayfa 1 kesilebilir bebek + oda (bebek
 * mobilyaya yapışmaz). Sayfa 2 parça kıyafet ızgarası (üst, etek, pantolon,
 * ayakkabı) — boydan hayalet-elbise yok. Sayfa 3 aksesuar + sahne kartı.
 */
export const paperdollArtDirector: ArtDirector = {
  type: "paperdoll",

  conceptPrompt: (vars) => `You are the art director for a printable paper doll dress-up activity sold on Etsy. COLORABLE black-and-white outlines only — the buyer prints, colours, cuts and plays.

The doll appears ONLY on page 1. Page 2 is mix-and-match SEPARATE garments (tops, bottoms, shoes) — never a full-length ghost-body outfit. Page 3 is accessories only (bags, jewelry, hats) — never a second wardrobe.

Generate ${vars.quantity} completely distinct paper doll concept${vars.quantity === 1 ? "" : "s"}.

Hard constraints:
- Each concept must be visually and thematically distinct from these recently used concepts:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
  If inventing a theme, pick a Gen-Z play-world (K-pop bedroom, concert dressing room, streetwear loft, beauty vanity, gamer room, cafe hangout, spa bathroom). Not a toddler nursery. No scary faces, no weapons.
- Write every buyer-facing field in English.
- Output must be valid JSON matching the schema below. No prose outside JSON.

Each concept is exactly ${PAPERDOLL_PAGE_COUNT} product pages plus ${vars.promoCount} promotional mockup scenes.

For each concept produce:
1. title — short internal working title (max 8 words).
2. theme — two or three words naming the play-world.
3. theme_bible — 1-2 sentences locking the room, furniture and what does NOT belong. Teen/Gen-Z, not preschool.
4. character_bible — TEEN fashion doll (16-20 look), not a toddler. Almond eyes with lashes, defined brows, full lips outline; trendy hair; long slim legs, defined waist. Standing, arms slightly out. Do NOT paste this bible into page_prompts — it is attached automatically.
5. etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters. Must include "printable", "paper doll", "dress up" and "coloring", plus the theme keyword. Never write "digital download" or "instant download" in the title.
6. etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates.
7. page_prompts — array of exactly ${PAPERDOLL_PAGE_COUNT} SHORT strings. Do not repeat character_bible or theme_bible. Only the extra instructions for that page. Bold clean black outline, no colour.
   All items match theme_bible. 10mm empty margin. Every object fully visible. FRONT-FACING and FLAT. Each shoe pair: two matching shoes side by side, toes at the camera. Dashed cut-line 3-5mm outside every cuttable piece, inside the margin. No dashed lines on wallpaper/floor.
   - page 1: PLAY-SIZE doll LEFT (at most half the page, hair to stand tab), stand tab, teen base (tank + shorts or leotard). RIGHT: complete furniture of the world, none touching the doll. Rack clothes are tiny decoration, not wearable.
   - page 2: NO doll, NO full-body outfit. Dense grid of SEPARATES only, sized to the page-1 GIRL not the furniture: 6-8 flat tops (torso-sized), 4-6 bottoms (hip-to-knee or waist-to-ankle), 3-4 tiny front-view shoe pairs (her feet). Optional gloves/belts/socks.
   - page 3: NO doll, NO wardrobe. Accessories that fit HER: hat ≈ head, bag ≈ hand, jewelry tiny. No poster sneakers. Scene card may be larger.
8. promo_scenes — array of exactly ${vars.promoCount} strings. Three different photographs, pieces fill the frame, never the same desk twice. (1) in-use close-up of the coloured cut doll (2) flat lay of cut clothes and accessories (3) hands dressing the doll, no face. Different product page each time.
9. ${etsyListingDescriptionRules({
      highlight: "3-PAGE PRINTABLE PAPER DOLL SET",
      included:
        "3 Letter pages (page 1: cuttable teen doll + room furniture; page 2: mix-and-match separate tops, bottoms and shoes; page 3: bags, hats, jewelry and a scene card), high-resolution PNG only (no PDF), 300 dpi, instant digital download",
      howItWorks:
        "line-by-line: purchase, download from Etsy, print, colour, cut along the dashed lines. Card stock for the doll and furniture, lighter paper for clothes. Layer a top and a bottom on the doll (no full-body dress to size). No Canva.",
      perfectFor:
        "Name 8-12 tween/teen uses (fashion play, K-pop dressing room, rainy day, party activity, screen-free craft). Ages about 8-14, not toddlers.",
      extras:
        "Colorable black-and-white outlines. Three matching sheets of one play-world. Best for tweens and teens who like fashion dolls.",
      honesty: "Exactly 3 pages. Doll only on page 1. Page 2 is mix-and-match separates, not full-body outfits. Not a toddler doll. Not Canva. No licensed characters.",
    })}

SEO coherence: primary keyword in the hook and once more later; at least four tags appear naturally in sentences; fields must agree.

Return exactly this shape:
{
  "concepts": [
    {
      "title": "string",
      "summary_tr": "string",
      "theme": "string",
      "theme_bible": "string",
      "character_bible": "string",
      "etsy_title": "string",
      "etsy_tags": ["string"],
      "page_prompts": ["string", "string", "string"],
      "promo_scenes": ["string"],
      "etsy_description": "string"
    }
  ]
}`,

  productRender: `Paper doll page rules:
- Black line art only on white. Uniform, fairly thick, clean outline. No greyscale, no hatching, no colour, no pattern fills. Interiors empty for colouring.
- CHARACTER AGE: the doll is a teen / young Gen-Z fashion doll (Bratz / K-pop idol vibe), NOT a toddler, NOT a 3-year-old, NOT a preschool chibi. Almond eyes with lashes and simple eyeliner, defined brows, full lips in outline, trendy hair. Fashion-doll body: long slim legs, defined waist. Cute, not babyish.
- VIEW: perfectly FRONT-FACING and FLAT on every piece (doll, tops, bottoms, shoes, bags). Orthographic, no 3/4 angle, no left/right turn, no perspective. Each shoe pair is two matching shoes side by side, both facing the camera, toes pointing at the viewer, both toe boxes visible — never a 3/4 boot, never a side silhouette. Tops have mirrored left/right sleeves. No ghost mannequin.
- Cut lines: a thin dashed cut-line about 3-5mm outside the solid black outline of every cuttable piece (doll, each garment, each accessory, each standalone furniture piece). The dashed line stays inside the page. Do not replace dashes with a second solid outline. Do not put dashed lines on connected wallpaper or floor.
- All items on all 3 pages must match the same theme_bible — do not introduce unrelated themes (e.g. no jungle/explorer/space items unless theme_bible explicitly says so).

Page 1 — PLAY-SIZE doll + furniture (fill leftover space):
- SCALE: the doll (hair to stand tab) is at most half the page height. Not a full-page poster. Empty gaps around her are filled with extra complete furniture.
- Doll: front-facing, arms slightly out, teen-doll base (tank and shorts or simple leotard — not a baby camisole), stand tab at the feet, empty white halo, dashed cut-line around her.
- Furniture as separate complete play pieces (whole bed, whole armchair, whole vanity, whole lamp, whole plant). None touch the doll. Each has its own dashed cut-line.
- Clothes hanging on a rack are tiny room decoration, not wearable. Wearable mix-and-match pieces are page 2 only.
- No object glued to the doll. No object running off the page.

Page 2 — SEPARATES sheet, DOLL FORBIDDEN, NO FULL-BODY OUTFIT:
- HARD RULE: the character exists only on page 1. Do not draw any person, doll, face, head, hair, ghost mannequin, invisible body, empty neck hole of a full outfit, or a neck-to-ankle dress/jumpsuit.
- Mix-and-match FLAT garments in a dense grid: 6-8 tops, 4-6 bottoms (skirts, shorts, pants), 3-4 FRONT-VIEW shoe pairs, gloves/belts/socks in the gaps. Packed, not sparse.
- SCALE TO THE GIRL ONLY. Ignore beds, sofas, vans, ramps and every other prop in the reference — they are larger than her and must not set the size. A top is about 18-22% of the page height (her shoulder-to-waist). A skirt/shorts is about 15-20%. Pants about 25-30% (waist-to-ankle). Each shoe is about 6-8% (her foot). If any garment is as tall as one-third of the page, it is a failure.
- SHOES: every pair is two shoes standing side by side, both perfectly front-facing, toes at the camera. A 3/4 or side-view shoe is a failure.
- Optional tiny shoulder tabs on tops, tiny waist tabs on skirts. Interiors empty for colouring.
- Gen-Z / street / stage wardrobe matching theme_bible. Never cropped.

Page 3 — ACCESSORIES only, DOLL FORBIDDEN, CLOTHES FORBIDDEN, DOLL SCALE:
- No character. No ghost-body outfits, no full dresses, no extra tops/skirts/pants. Another clothes grid is a failure.
- Same girl-only scale as page 2. Ignore furniture. Hat ≈ her head (small). Bag ≈ her hand. Jewelry tiny. NEVER poster sneakers. Skip extra shoes unless they match page-2 shoe size exactly.
- Handbags, backpack, hats, sunglasses, headphones, phone, makeup, hairbrush, hair clips, necklace, bracelets, earrings, plus one complete scene card of the SAME world (the card may be larger).
- Jewelry (bracelets, necklace) and bags must appear. Dashed cut-line around every piece. Fold tabs only on hats and bags.

No page text except a tiny optional label if a tab would otherwise be ambiguous, spelled correctly.`,

  promoRender: `Promo styling for paper doll sets:
- Reference images are the three product sheets IN ORDER: image 1 = page 1 (doll + furniture), image 2 = page 2 (clothes), image 3 = page 3 (accessories). Use the sheet the scene asks for — do not ignore pages 2 and 3.
- Show pieces as FINISHED PLAY: already coloured-in and cut out along their dashed lines, with a thin white paper edge. Not a photo of a blank line-art print unless the scene explicitly says "uncut printed page".
- Faithfully reuse the actual doll, outfits and extras from those sheets (same face, hair, clothes). Do not invent a different character or wardrobe.
- Follow the SHOT rule: close-up play, flat lay of cut pieces, or hands. Do not put every photo on the same desk. Hands and arms only, no identifiable faces.
- Vertical 2:3. At most four words of overlay text, only if the scene asks. No watermark.`,

  themeDomain:
    "Gen-Z fashion paper doll worlds for tweens and teens. RANGE (not a closed menu): K-pop, concert, streetwear, beauty vanity, gamer, cafe, spa, campus, dance studio, thrift loft, ski trip, summer stall, art studio. Not toddler nurseries. Do not only return K-pop bedroom / streetwear loft / gamer room.",
};
