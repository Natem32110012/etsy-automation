import { conceptPromptFrame, type ArtDirector } from "./shared";

export const plannerArtDirector: ArtDirector = {
  type: "planner",

  conceptPrompt: (vars) =>
    conceptPromptFrame({
      role: "You are the art director for a printable planner digital product line sold on Etsy — functional, layout-driven pages people actually fill in.",
      vars,
      productImageRules:
        "the actual planner page prompt, written layout-first. Name the sections and where they sit on the page: header label, the grid or column structure, row counts, checkbox or line areas, side panel, footer note area. Describe the visual system too (typeface feel, rule weight, accent colour, corner radius). Function comes before decoration: the page must be genuinely usable when printed and written on.",
      promoSceneRules:
        'Three different photographs. The page fills the frame and the layout stays readable. Never the same desk twice. (1) in-use close-up of the printed planner (2) top-down flat lay of the sheet (3) a hand writing on the page with a pen, no face. Scene 1 may mention a tiny English overlay "Planner Page". Every other scene must say "no overlay text".',
      titleKeywords: 'the word "planner" and the specific page type (for example "weekly planner")',
      listingCopy: {
        highlight: "UNDATED PRINTABLE PLANNER PAGE",
        included:
          "1 undated planner page (name the layout type: weekly, meal, budget, habits, etc.), high-resolution PNG only (no PDF), A4 size, 300 dpi, instant digital download, reprint as often as needed",
        howItWorks:
          "line-by-line: purchase, download from Etsy, print, slide into a binder / clipboard / desk stand, fill in by hand with a pen. No Canva, no app, no dated year locked in.",
        perfectFor:
          "Name 8-12 concrete uses that fit THIS layout (Sunday meal prep, bill week, habit reset, study block, cleaning day). Not a kids coloring party.",
        extras:
          "Undated so it can be reprinted and reused indefinitely. Works in a binder, on a clipboard or in a desk stand. Leave writing areas empty in the file — the buyer writes.",
        honesty: "Not a dated 12-month calendar unless the concept truly is. Not editable Canva. Not a multi-page book unless that is what was generated.",
      },
    }),

  productRender: `Printable planner page rules:
- Clean flat graphic design, not an illustration and not a photo. Crisp geometry, perfectly straight rules, consistent spacing.
- Grid, columns, boxes and writing lines must be even, aligned and truly empty — leave real room to write by hand.
- Restrained palette: white base, one accent colour at most, thin grey rules. No heavy fills behind writing areas.
- Section labels are short and correctly spelled (for example "Monday", "Priorities", "Notes"). No placeholder gibberish, no lorem ipsum, no handwriting inside the fields.
- Modern minimal sans-serif type. Generous consistent margins on all four sides.
- No decorative clutter over writing areas; ornament only in the header or as a small corner motif.`,

  promoRender: `Promo styling for planners:
- Follow the SHOT rule: close-up in use, flat lay, or hands. Do not put every photo on the same desk.
- The layout stays legible. A pen is welcome. Never a steep angle that hides the grid.`,

  themeDomain:
    "undated printable planner pages people actually fill in. RANGE (not a closed menu): weekly, daily, meals, budget, bills, habits, cleaning, study, fitness, content calendar, packing, garden, freelance, ADHD-friendly, homeschool, travel prep. Invent a specific niche each time; do not only return weekly / meal / budget.",
};
