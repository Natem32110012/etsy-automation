import { randomInt } from "node:crypto";
import { avoidBlock } from "./shared";
import type { ArtDirector } from "./shared";

const ANGLES = [
  "a quiet gift",
  "a night-time ritual",
  "a tiny collection",
  "a seasonal table",
  "a hobby corner",
  "a friendship moment",
  "a travel souvenir",
  "a rainy indoor hour",
  "a celebration detail",
  "a maker's desk",
  "a soft vintage mood",
  "a bold graphic mood",
];

const TWISTS = [
  "moonlight",
  "linen",
  "citrus",
  "ink",
  "snow",
  "honey",
  "fern",
  "velvet",
  "paper",
  "copper",
  "seasalt",
  "lavender",
];

/**
 * Suggest themes invents niche titles for the selected product.
 * Etsy titles are not used — they pulled neighboring products into the list.
 */
export function buildThemePrompt(
  director: ArtDirector,
  avoidList: string[],
  extraExclude: string[],
  idea?: string | null,
  product?: { label: string; pageRules?: string },
) {
  const brief = idea?.trim() ?? "";
  const angle = ANGLES[randomInt(ANGLES.length)];
  const twist = TWISTS[randomInt(TWISTS.length)];
  const banned = extraExclude.length > 0 ? extraExclude.map((item) => `- ${item}`).join("\n") : "(none this round)";
  const page = product?.pageRules?.trim();
  const briefBlock = brief
    ? `The seller's brief is: "${brief}".
HARD: every title stays inside this brief AND stays this product. Do not wander to a different product.`
    : `This round's mood (obey it, do not name it literally unless it fits): ${angle}.
A fresh detail for at most two titles: ${twist}. The other titles must be different subjects, not eight versions of that detail.`;

  return `You invent 8 niche titles for one Etsy printable. You do not copy live listings.

Product name: ${product?.label ?? director.type}
What this product is: ${director.themeDomain}
${page ? `What is on the page: ${page.slice(0, 500)}` : ""}

HARD: every title is a niche of THIS product only.
A bookmark product gets bookmark niches. A coloring page gets coloring niches.
Do not switch products. No worksheets, bingo, bulletin boards, journals, or classroom kits unless that is the product above.
The examples inside the domain line are a range, not a menu. Do not recycle them as the 8 answers.

${briefBlock}

Already used — do not repeat these or close variants:
${avoidBlock(avoidList)}

Already shown this session — skip these too:
${banned}

Each title is 3 to 6 words, Title Case, English, specific and pretty. A buyer could search it.
Good title: "Snowflake Reading Bookmarks"
Bad title: "Winter"
Bad title: "Festive winter animal coloring sheets bring holiday cheer to elementary art centers"
No sentences in the title. No period. No words: printable, digital, download, page, pack, instant.
8 titles. At least 6 different subjects. At least 3 less-obvious niches. No licensed characters.
Follow any mix in the domain line (if it says cute AND adult, return about half of each).

Each theme also has summary_tr: one Turkish sentence, max 30 words, for a seller who does not read the English title. Say what the artwork will show, the main colors, and what is left out. Not a word-for-word translation of the title.

Return exactly:
{ "themes": [{ "title": "Snowflake Reading Bookmarks", "summary_tr": "Kar taneli kitap ayracı; lacivert ve beyaz, korkunç figür yok." }] }`;
}
