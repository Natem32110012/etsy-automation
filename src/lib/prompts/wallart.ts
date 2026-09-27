import {
  ETSY_TAG_COUNT,
  ETSY_TAG_MAX,
  ETSY_TITLE_MAX,
  WALL_SET_MAX,
} from "../types";
import { avoidBlock, etsyListingDescriptionRules, themeBlock, type ArtDirector } from "./shared";

function wallArtDirector(input: {
  type: "kids-wall-art" | "adult-wall-art";
  audience: string;
  themeDomain: string;
  titlePhrase: string;
}): ArtDirector {
  return {
    type: input.type,
    themeDomain: input.themeDomain,
    productRender: `Printable wall art rules:
- One finished illustration, edge to edge. No white page margin, no frame, no mockup, no wall, no room.
- Flat, straight-on artwork. Not a photo of a print.
- Bold shapes that stay readable after a large print. No tiny text, no watermark, no signature.
- One portrait 3:4 artwork, the print file is 18x24 inches. No second orientation.
- Original art only. No trademarks, no licensed characters.`,
    promoRender: `Promo styling for wall art:
- Every photo shows the framed print hanging on a wall.
- Each photo is a different wall and a different room.
- No hands, no people, no desk, no flat lay.
- The artwork fills the frame of the print.`,
    conceptPrompt: (vars) => {
      const designs = Math.min(WALL_SET_MAX, Math.max(1, vars.pageCount || 1));
      const setLine =
        designs === 1
          ? "This listing is ONE print."
          : `This listing is a matching set of exactly ${designs} prints that hang together.`;
      return `You are the art director for printable wall art sold on Etsy. Audience: ${input.audience}.

Generate ${vars.quantity} distinct concept${vars.quantity === 1 ? "" : "s"}.
${setLine}

Hard constraints:
- Each concept must be distinct from:
${avoidBlock(vars.avoidList)}
- ${themeBlock(vars.selectedTheme)}
- Write every buyer-facing field in English.
- Output valid JSON only.

For each concept produce:
1. title — internal working title, max 8 words.
2. theme — two or three words.
3. theme_bible — 1-2 sentences locking palette, subject, and what does not belong.
4. etsy_title — max ${ETSY_TITLE_MAX} characters. Include "printable", "18x24" and ${input.titlePhrase}. ${designs > 1 ? `Say it is a set of ${designs}.` : "Do not call it a set."} Never write "digital download" or "instant download".
5. etsy_tags — exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation.
6. page_prompts — exactly ${designs} strings. Each is a PORTRAIT 3:4 artwork, printed at 18x24 inches. Design 1 is the hero. Later designs are the same world, different scene, not a copy.
7. promo_scenes — exactly ${vars.promoCount} strings. Every scene is the framed 18x24 print hanging on a wall. (1) close-up on one wall (2) a wider view on a different wall in another room (3) a third wall in a third room. No hands, no people, no flat lay, no desk. Scene 1 may use a tiny English overlay "${input.type === "kids-wall-art" ? "Kids Wall Art" : "Wall Art"}". Other scenes say "no overlay text".
8. ${etsyListingDescriptionRules({
        highlight: designs > 1 ? `SET OF ${designs} PRINTABLE WALL ART PRINTS` : "1 PRINTABLE WALL ART PRINT",
        included: `${designs} portrait design${designs > 1 ? "s" : ""}, each one PNG at 18x24 inches, 300 dpi. No other sizes, no landscape file, no PDF, no Canva.`,
        howItWorks:
          "line-by-line: purchase, download the zip from Etsy, print the size that fits the frame, or send the file to a print shop. No physical print is shipped.",
        perfectFor:
          designs > 1
            ? "Name rooms and occasions for a gallery wall of this set."
            : "Name rooms and occasions for this single print.",
        extras: "One size: 18x24 inches, about 46x61 cm. Portrait only.",
        honesty: "Digital files only. Not a framed physical print. Not Canva.",
      })}

Return exactly:
{
  "concepts": [
    {
      "title": "string",
      "summary_tr": "string",
      "theme": "string",
      "theme_bible": "string",
      "etsy_title": "string",
      "etsy_tags": ["string"],
      "page_prompts": ["string"],
      "promo_scenes": ["string"],
      "etsy_description": "string"
    }
  ]
}`;
    },
  };
}

export const kidsWallArtDirector = wallArtDirector({
  type: "kids-wall-art",
  audience: "children and nursery buyers. Friendly, bright, ages about 0-8. No horror, no weapons, no tiny clutter.",
  themeDomain:
    "kids printable wall art and nursery prints. RANGE: animals, alphabet, vehicles, space, ocean, dinosaurs, bedtime, seasons. Do not only return dinosaurs or rainbows.",
  titlePhrase: 'the phrase "kids wall art" or "nursery print"',
});

export const adultWallArtDirector = wallArtDirector({
  type: "adult-wall-art",
  audience: "adults decorating a home. Gallery, botanical, abstract, line art, quotes. Not preschool, not cartoon nursery.",
  themeDomain:
    "adult printable wall art. RANGE: botanicals, abstracts, architecture, line drawings, quiet landscapes, typography. Do not only return beige botanicals.",
  titlePhrase: 'the phrase "wall art print"',
});
