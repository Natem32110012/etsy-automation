import { ETSY_TAG_COUNT, ETSY_TAG_MAX, ETSY_TITLE_MAX, isWallArt, type ProductType } from "../types";
import { etsyListingDescriptionRules, type EtsyListingCopy } from "./shared";

export function listingCopySpec(type: ProductType, pageCount: number): EtsyListingCopy {
  const pages = Math.max(1, pageCount);
  if (isWallArt(type)) {
    const kids = type === "kids-wall-art";
    return {
      highlight: pages > 1 ? `SET OF ${pages} PRINTABLE WALL ART PRINTS` : "1 PRINTABLE WALL ART PRINT",
      included: `${pages} portrait design${pages > 1 ? "s" : ""}, each one PNG at 18x24 inches, 300 dpi. No other sizes. No PDF.`,
      howItWorks: "line-by-line: purchase, download the zip from Etsy, print the size that fits the frame. No physical print is shipped.",
      perfectFor: kids
        ? "Name kids rooms and occasions for this nursery or kids print."
        : "Name adult rooms and occasions for this gallery print. Not a nursery.",
      extras: "One size: 18x24 inches, about 46x61 cm. Portrait only.",
      honesty: "Digital files only. Not a framed physical print. Not Canva.",
    };
  }
  if (type === "doodle") {
    if (pages > 1) {
      return {
        highlight: `${pages}-PAGE KAWAII DOODLE PACK`,
        included: `${pages} matching doodle collage coloring pages in the same world, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use`,
        howItWorks:
          "line-by-line: purchase, download from Etsy, print the set, colour with markers / gel pens / coloured pencils. No Canva. Pages belong together as one set, not unrelated sheets.",
        perfectFor: `Name teen and adult occasions that fit THIS pack world. Always say it is a ${pages}-page set. Not preschool worksheets.`,
        extras: `Suits teens and adults. Clean bold outlines. Exactly ${pages} pages — never claim a different count.`,
        honesty: `HARD: the pack has exactly ${pages} pages. Not a kids 4-8 worksheet. Not Canva. Not 20 unrelated designs.`,
      };
    }
    return {
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
    };
  }
  if (type === "coloring") {
    if (pages > 1) {
      return {
        highlight: `${pages}-PAGE MATCHING COLORING PACK`,
        included: `${pages} matching coloring pages in the same world, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use`,
        howItWorks:
          "line-by-line: purchase, download from Etsy, print the set, colour with crayons. No Canva. Pages belong together as one story, not unrelated sheets.",
        perfectFor: `Name 8-12 kid occasions that fit THIS pack world. Always say it is a ${pages}-page set.`,
        extras: `Ages 4 to 8. Bold outlines, thick crayons. Exactly ${pages} pages — never claim a different count.`,
        honesty: `HARD: the pack has exactly ${pages} pages. Not Canva. Not 20 unrelated designs.`,
      };
    }
    return {
      highlight: "1 PRINTABLE KIDS COLORING PAGE",
      included:
        "1 coloring page, high-resolution PNG only (no PDF), Letter size 8.5x11 inches, 300 dpi, instant digital download, print as many as needed for personal use",
      howItWorks:
        "line-by-line: purchase, download from Etsy, print, colour with crayons or thick markers. No Canva, no extra software.",
      perfectFor:
        "Name 8-12 kid occasions (rainy day, quiet time, birthday party activity, classroom, travel, ages 4-8). Tie them to THIS scene, not generic 'any party'.",
      extras: "Ages 4 to 8. Bold outlines and large open areas suit small hands and thick crayons. One page only.",
      honesty: "Not a multi-page pack. Not adult intricate mandala. Not Canva.",
    };
  }
  if (type === "paperdoll") {
    return {
      highlight: "3-PAGE PRINTABLE PAPER DOLL SET",
      included:
        "3 Letter pages (page 1: cuttable teen doll + room furniture; page 2: mix-and-match separate tops, bottoms and shoes; page 3: bags, hats, jewelry and a scene card), high-resolution PNG only (no PDF), 300 dpi, instant digital download",
      howItWorks:
        "line-by-line: purchase, download from Etsy, print, colour, cut along the dashed lines. Card stock for the doll and furniture, lighter paper for clothes. Layer a top and a bottom on the doll. No Canva.",
      perfectFor:
        "Name 8-12 tween/teen uses (fashion play, rainy day, party activity, screen-free craft). Ages about 8-14, not toddlers.",
      extras: "Colorable black-and-white outlines. Exactly 3 matching sheets of one play-world.",
      honesty: "Exactly 3 pages. Doll only on page 1. Page 2 is mix-and-match separates. Not a toddler doll. Not Canva.",
    };
  }
  return {
    highlight: pages > 1 ? `${pages}-PAGE PRINTABLE SET` : "1 PRINTABLE PAGE",
    included: `${pages} high-resolution PNG file${pages > 1 ? "s" : ""} only (no PDF), 300 dpi, instant digital download, print as many as needed for personal use`,
    howItWorks: "line-by-line: purchase, download from Etsy, print. No Canva, no extra software.",
    perfectFor: "Name 8-12 concrete occasions that fit THIS design.",
    extras: `Exactly ${pages} page${pages > 1 ? "s" : ""}. Do not invent extra files.`,
    honesty: "Digital only. Not Canva. Not a physical item.",
  };
}

export function listingFillPrompt(input: {
  type: ProductType;
  typeLabel: string;
  title: string;
  theme: string;
  themeBible: string | null;
  pageCount: number;
  pageSummaries: string[];
}): string {
  const copy = listingCopySpec(input.type, input.pageCount);
  const pages = input.pageSummaries
    .map((page, index) => `${index + 1}. ${page}`)
    .join("\n");

  return `You write Etsy listing copy only for an existing digital printable. Do not invent extra pages.

Product type: ${input.typeLabel} (${input.type})
Internal title: ${input.title}
Theme: ${input.theme}
Page count: ${input.pageCount}
Theme bible: ${input.themeBible || "(none)"}
Page summaries:
${pages || "(see title and theme)"}

etsy_title — SEO-optimised, max ${ETSY_TITLE_MAX} characters, front-loads the primary keyword, includes the word "printable". Never write "digital download", "instant download", or "digital file" in the title.
${etsyListingDescriptionRules(copy)}
etsy_tags — array of exactly ${ETSY_TAG_COUNT} tags, each at most ${ETSY_TAG_MAX} characters, lowercase, no punctuation, no duplicates.

Return exactly:
{
  "etsy_title": "string",
  "etsy_description": "string",
  "etsy_tags": ["string"]
}`;
}
