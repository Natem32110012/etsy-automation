import { conceptPromptFrame, type ArtDirector } from "./shared";

export const invitationArtDirector: ArtDirector = {
  type: "invitation",

  conceptPrompt: (vars) =>
    conceptPromptFrame({
      role: "You are the art director for a printable invitation card line sold on Etsy — print-ready cards with placeholder English so the layout reads as a finished invite.",
      vars,
      productImageRules:
        "the actual invitation card prompt. Describe the occasion, the illustration or pattern style, the palette, and — most importantly — the text layout: where the event name, the date and time line, the venue line and the RSVP line sit, and how much clear space each gets. Use realistic placeholder wording (for example an event name, \"Saturday, June 14th at 2 PM\", a venue name, \"RSVP\" with a phone number) so the buyer can see the structure. Decoration frames the text, it never sits under it.",
      promoSceneRules:
        'Three different photographs. The card fills the frame and the event text stays readable. Never the same surface twice. (1) in-use close-up of the printed invitation (2) top-down flat lay of the card (3) a hand holding the card, no face. Scene 1 may mention a tiny English overlay "Invitation". Every other scene must say "no overlay text".',
      titleKeywords: 'the word "invitation" and the occasion (for example "birthday invitation")',
      listingCopy: {
        highlight: "PRINT-READY INVITATION CARD",
        included:
          "1 print-ready invitation design with placeholder English event text baked in, high-resolution PNG only (no PDF), A4 size, 300 dpi, instant digital download",
        howItWorks:
          "line-by-line: purchase, download from Etsy, print on card stock, trim if needed, hand out or mail. Placeholder names/dates/venue are examples — this file is NOT a Canva or Corjl template and is not editable by the buyer. If they need custom wording they must message the shop (do not promise a free edit unless asked).",
        perfectFor:
          "Name 8-12 occasions that match THIS card (the actual party type in the artwork). Mix host uses: at-home party, classroom, shower, dinner.",
        extras:
          "The wording on the card is placeholder English so the layout reads as a finished invite. Decoration frames the text. Print on white or cream card stock.",
        honesty:
          "HARD: do not claim Canva, Corjl, editable PDF, or that the buyer can change names in the file. It is a print-as-is PNG.",
      },
    }),

  productRender: `Printable invitation rules:
- Flat graphic card design filling the page, straight-on, no perspective, no mockup, no shadow — this file is the print-ready card itself.
- Typography is the centrepiece: clear type hierarchy, event name largest, then date and time, then venue, then RSVP line. All text horizontally aligned to one system.
- Every word must be correctly spelled real English. No lorem ipsum, no invented letterforms, no duplicated lines, no text running off the edge.
- Illustration and pattern sit in the margins, corners or as a light background — never behind the text at a contrast that hurts legibility.
- Keep clear breathing room around the text block and a consistent print margin on all sides.
- Cohesive palette of two to four colours plus a neutral.`,

  promoRender: `Promo styling for invitations:
- Follow the SHOT rule: close-up in use, flat lay, or hands. Do not repeat the same surface.
- The card's text stays sharp. An envelope or a ribbon is welcome. Hands are fine, faces are not.`,

  themeDomain:
    "print-ready invitation cards with placeholder English. RANGE (not a closed menu): kids birthday, teen birthday, baby shower, bridal shower, wedding, graduation, dinner, holiday, retirement, housewarming, classroom party, sports banquet. Vary the occasion AND the visual style; do not only return kids birthday / baby shower.",
};
