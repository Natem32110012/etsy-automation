import { readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { loadProductType } from "./config";
import { fitToPrint, fitToPromo, toReferenceDataUrl } from "./image";
import { ensureDir, generationsDir } from "./paths";
import { PRINT_RULES, PROMO_RULES, PAPERDOLL_PRINT_RULES, artDirectorFor } from "./prompts";
import { generateImage, qualityFor, variationSuffix } from "./replicate";
import { getConcept, updateConcept } from "./store";
import {
  PRODUCT_KEY,
  PROMO_ASPECT,
  PROMO_COUNT_MIN,
  isPackType,
  isWallArt,
  isWallLandscapeKey,
  productSlots,
  slotUnlocked,
  type Concept,
  type ImageQuality,
  type ImageSlot,
  type ProductTypeConfig,
} from "./types";

function slotOf(concept: Concept, imageKey: string): ImageSlot {
  const slot = concept.images.find((entry) => entry.key === imageKey);
  if (!slot) throw new Error(`"${imageKey}" görsel slotu bulunamadı`);
  return slot;
}

function approvedGeneration(slot: ImageSlot) {
  if (slot.status !== "approved") return null;
  return slot.generations.find((g) => g.id === slot.selected_generation_id) ?? null;
}

export function selectedGeneration(slot: ImageSlot) {
  return slot.generations.find((g) => g.id === slot.selected_generation_id) ?? null;
}

function buildPrompt(
  concept: Concept,
  slot: ImageSlot,
  config: ProductTypeConfig,
  seed: number,
): string {
  const director = artDirectorFor(concept.type);

  if (slot.kind === "product") {
    const parts = [
      slot.instruction,
      director.productRender,
      concept.type === "paperdoll" ? PAPERDOLL_PRINT_RULES : PRINT_RULES,
      `Target output: a single ${config.print.label.replace("-", " ")} portrait page, ${config.print.width}x${config.print.height} pixels at ${config.print.dpi} dpi after upscaling.`,
    ];
    if (concept.type === "paperdoll" && slot.key === "product-1") {
      parts.unshift(
        "HARD RULE — PLAY-SIZE DOLL: The standing doll (hair to stand tab) is at most half the page height. She is a small cut-out toy, NOT a full-page poster. Do not stretch her top-to-bottom. Fill every leftover gap with extra complete furniture pieces (whole bed, chair, vanity, lamp, plant, extras). Clothes hanging on a rack are tiny room decoration, not wearable outfits.",
      );
    }
    if (concept.type === "paperdoll" && slot.key === "product-2") {
      parts.unshift(
        "HARD RULE: Do NOT draw any doll, person, face, head, hair, ghost mannequin, or full-length one-piece outfit. Clothes sheet of SEPARATES only: flat tops, skirts, shorts, pants, shoes. No neck-to-ankle dress on an invisible body. The first reference is PAGE 1. IGNORE furniture, beds, sofas, vehicles and props — they are larger than the girl and must not set the size. Scale ONLY to the standing girl: a top ≈ 18-22% of THIS page height (her torso), a skirt ≈ 15-20%, pants ≈ 25-30%, each shoe ≈ 6-8% (her foot). A garment as tall as one-third of the page is a failure. Copying her face onto this page is a failure. Every shoe pair is TWO matching shoes standing side by side, BOTH perfectly FRONT-FACING — toes at the camera. NEVER 3/4 view, NEVER a side-on boot.",
      );
    }
    if (concept.type === "paperdoll" && slot.key === "product-3") {
      parts.unshift(
        "HARD RULE: ACCESSORIES sheet, doll-scale only. Do NOT draw any doll, face, hair, clothes, full dress, extra tops, skirts or pants. Reference 1 is page 1 (the girl) — IGNORE furniture. Reference 2 is page 2 — COPY that garment scale. A hat fits her HEAD (small). A bag fits her HAND. Jewelry is tiny. If you draw shoes they must be THE SAME SIZE as the shoe pairs on page 2 (doll feet, not poster sneakers). A shoe or boot as large as a tote bag is a failure. Prefer extra jewelry and bags instead of extra shoes. Scene card may be larger; wearable pieces must fit the doll.",
      );
    }
    if (concept.type === "party" && slot.kind === "product") {
      parts.unshift(
        "HARD RULE — ONE PAGE CUPCAKE SHEET: 12 UNIQUE round toppers on top + 6 blank rectangular write-on labels at the bottom. Never repeat the same word on every circle (no SPLASH / PARTY / YAY). No pennant banner, no letter flags, no HAPPY BIRTHDAY bunting on this sheet. Labels have a large empty white writing area. Original characters only.",
      );
    }
    if (concept.type === "favortags" && slot.kind === "product") {
      parts.unshift(
        "HARD RULE — ONE PAGE FAVOR TAG SHEET: 12 IDENTICAL vertical rectangular hang tags in a 3×4 grid. Hole-punch circle at the TOP CENTER of every tag. Dashed cut-line around each rectangle. Same colored illustration and same English greeting on all 12. Bottom of each tag: 'from,' plus a blank handwriting line — no printed names. No watermark, no self-edit badge. Original characters only.",
      );
    }
    if (isWallArt(concept.type)) {
      parts.unshift(
        "HARD RULE — PORTRAIT WALL ART: 3:4 artwork, printed at 18x24 inches. Edge to edge. No frame, no wall, no white page margin, no mockup.",
      );
    }
    if (isPackType(concept.type) && slot.key !== "product-1" && slot.key !== PRODUCT_KEY) {
      parts.unshift(
        concept.type === "doodle"
          ? "HARD RULE: The first reference image is PAGE 1 of this doodle pack. Draw a NEW kawaii doodle collage in the SAME theme and object family, same bold outline style. Different objects and layout — do not copy page 1's composition. A buyer should recognise this as the next page of the same set."
          : "HARD RULE: The first reference image is PAGE 1 of this coloring pack. Draw a NEW coloring page in the SAME world with the SAME characters, same cute rounded style and stroke weight. Different scene, pose or activity — do not copy page 1's composition. A child should recognise this as the next page of the same set.",
      );
    }
    return parts.join("\n\n") + variationSuffix(seed);
  }

  return [
    promoTextRule(concept, slot, config.label),
    `Create a promotional image for an Etsy digital product: "${concept.title}" (${config.label}).`,
    promoReferenceRule(concept),
    promoShotBlock(concept, slot),
    concept.type === "paperdoll"
      ? paperdollPromoReferences(concept)
      : concept.type === "party"
        ? partyPackPromoReferences(concept)
      : concept.type === "favortags"
        ? favorTagsPromoReferences(concept)
      : isPackType(concept.type) && productSlots(concept.images).length > 1
        ? coloringPackPromoReferences(concept)
        : null,
    `Scene: ${promoSceneInstruction(slot)}`,
    director.promoRender,
    PROMO_RULES,
  ]
    .filter((part): part is string => Boolean(part))
    .join("\n\n") + variationSuffix(seed);
}

function paperdollPromoReferences(concept: Concept) {
  const pages = productSlots(concept.images);
  const lines = pages.map((page, index) => {
    const name =
      page.key === "product-1"
        ? "page 1 — doll + furniture"
        : page.key === "product-2"
          ? "page 2 — clothes, shoes, gloves"
          : page.key === "product-3"
            ? "page 3 — accessories + scene card"
            : page.key;
    return `Reference image ${index + 1}: ${name}.`;
  });
  return [
    "Product sheet references (use ALL that the scene needs, not only image 1):",
    ...lines,
    "When the scene says coloured/cut, show those exact pieces filled with colour and cut free, not as an uncut line-art page.",
  ].join("\n");
}

function partyPackPromoReferences(concept: Concept) {
  const pages = productSlots(concept.images);
  const lines = pages.map(
    (page, index) => `Reference image ${index + 1}: cupcake topper sheet (${page.key}).`,
  );
  return [
    "Product sheet references — printable cupcake toppers:",
    ...lines,
    "Show the circles CUT and stuck into real cupcakes on toothpicks. Each topper must be a photocopy of a circle from the sheet — same doodle, same joke text, same colours. Do not invent new characters or new captions. Labels may go on a bottle or treat bag if the scene asks, still copied from the sheet. No extra banner unless it is already on the sheet.",
  ].join("\n");
}

function favorTagsPromoReferences(concept: Concept) {
  const pages = productSlots(concept.images);
  const lines = pages.map(
    (page, index) => `Reference image ${index + 1}: favor tag sheet (${page.key}).`,
  );
  return [
    "Product sheet references — printable party favor hang tags:",
    ...lines,
    "Show the rectangles CUT, hole punched, and tied with twine onto kraft gift boxes, treat bags or favor pouches. Each tag must be a photocopy of a tag from the sheet — same icons, same greeting, same colours. Do not invent new art or rewrite the greeting.",
  ].join("\n");
}

function coloringPackPromoReferences(concept: Concept) {
  const pages = productSlots(concept.images);
  const kind = concept.type === "doodle" ? "doodle page" : "coloring page";
  const lines = pages.map((page, index) => `Reference image ${index + 1}: ${kind} ${index + 1} (${page.key}).`);
  return [
    `Product page references — this is a matching ${concept.type === "doodle" ? "doodle" : "coloring"} pack, not a single page:`,
    ...lines,
    "Keep the same theme and style. Show the page the scene asks for.",
  ].join("\n");
}

function promoSceneInstruction(slot: ImageSlot) {
  if (!slot.overlay_text) return slot.instruction;
  return `${slot.instruction.replace(/\bno overlay text\b/gi, "").replace(/\bno text\b/gi, "").trim()} Include a short English title overlay at the TOP of the photo only — not on the product.`;
}

function promoIndex(slot: ImageSlot) {
  const match = /^promo-(\d+)$/.exec(slot.key);
  return match ? Number(match[1]) : 1;
}

function promoOverlayName(concept: Concept, productLabel: string) {
  if (concept.type === "coloring") {
    return productSlots(concept.images).length > 1 ? "Coloring Pages" : "Coloring Page";
  }
  if (concept.type === "kids-wall-art") return "Kids Wall Art";
  if (concept.type === "adult-wall-art") return "Wall Art";
  if (concept.type === "doodle") return "Doodle Pages";
  if (concept.type === "paperdoll") return "Paper Doll";
  if (concept.type === "party") return "Cupcake Toppers";
  if (concept.type === "favortags") return "Favor Tags";
  if (concept.type === "planner") return "Planner Page";
  if (concept.type === "invitation") return "Invitation";
  const cleaned = productLabel.replace(/^printable\s+/i, "").trim();
  if (/bookmark/i.test(`${cleaned} ${concept.type}`)) return "Bookmarks";
  const words = cleaned.split(/\s+/).filter((word) => !/^(sheet|page|pack|set|digital)$/i.test(word));
  const picked = (words.length > 0 ? words : cleaned.split(/\s+/)).slice(0, 3);
  return picked.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function promoReferenceRule(concept: Concept) {
  const several =
    concept.type === "paperdoll" ||
    concept.type === "party" ||
    concept.type === "favortags" ||
    (isPackType(concept.type) && productSlots(concept.images).length > 1);
  if (!several) {
    return "REFERENCE: One product page. Show that page, or the pieces cut from it. Do not invent a different design.";
  }
  return "REFERENCE: This listing has more than one page. Show the page the scene names. Later pages are the same product, not a different design.";
}

function promoShotBlock(concept: Concept, slot: ImageSlot) {
  const index = promoIndex(slot);
  if (isWallArt(concept.type)) {
    const rooms =
      concept.type === "kids-wall-art"
        ? ["a nursery wall", "a playroom wall", "a child's bedroom wall", "a reading-nook wall"]
        : ["a living-room wall", "a hallway wall", "a bedroom wall", "a dining-room wall"];
    const room = rooms[(index - 1) % rooms.length];
    return `SHOT ${index} — WALL ONLY. The framed 18x24 print hangs on ${room}. Each promo is a different wall and a different room. No hands, no people, no desk, no flat lay, no sheet on a table. The artwork stays large and readable. Ignore any scene note that asks for hands, a desk, or a flat lay.`;
  }
  const shot = index === 1 ? "close" : index === 2 ? "flat" : index === 3 ? "hands" : "other";
  const bookmark = /bookmark/i.test(`${concept.type} ${concept.title}`);
  const use =
    concept.type === "paperdoll"
      ? "Coloured, cut paper-doll pieces in play, with a thin white paper edge. Not an uncut line-art sheet."
      : concept.type === "party"
        ? "Real cupcakes with this sheet's toppers on toothpicks. The circles are large."
        : concept.type === "favortags"
          ? "One cut tag, hole punched and tied with twine on a kraft box or treat bag. The tag is large."
          : concept.type === "planner"
            ? "The printed planner page in use, layout large and readable."
            : concept.type === "invitation"
              ? "The printed invitation large in the frame, event text readable."
              : concept.type === "doodle"
                ? "The printed doodle page large in the frame, with markers beside it."
                : bookmark
                  ? "One cut bookmark large in an open book. Not the whole uncut letter sheet shrunk on a desk."
                  : "The printed page large in the frame, with the tools a buyer would use beside it.";
  const hands =
    concept.type === "paperdoll"
      ? "hands dressing the coloured cut doll"
      : concept.type === "party"
        ? "a hand pushing a toothpick topper into frosting"
        : concept.type === "favortags"
          ? "a hand tying twine through the tag hole"
          : concept.type === "invitation"
            ? "a hand holding the invitation"
            : bookmark
              ? "a hand sliding the cut bookmark into a book"
              : "a hand using the printed page";
  if (shot === "close") {
    return `SHOT 1 — IN-USE CLOSE-UP. ${use} The product fills most of the frame.`;
  }
  if (shot === "flat") {
    return concept.type === "paperdoll" || concept.type === "party" || concept.type === "favortags" || bookmark
      ? "SHOT 2 — FLAT LAY. Top-down photo of the cut pieces laid on a plain surface, filling the frame. Not the same desk as the other shots."
      : "SHOT 2 — FLAT LAY. Top-down photo of the printed sheet, filling the frame. Not the same desk as the other shots.";
  }
  if (shot === "hands") {
    return `SHOT 3 — HANDS. ${hands}. No identifiable face. The product stays large in the frame. A different surface from the other shots.`;
  }
  return `SHOT ${index} — a new angle on a different surface. Do not repeat the desk, mug, or plant. The product fills most of the frame.`;
}

function promoTextRule(concept: Concept, slot: ImageSlot, productLabel: string) {
  const faithful = isWallArt(concept.type)
    ? "HARD RULE — PRODUCT 1:1. Copy the artwork exactly: same drawings, same colours, same letters already printed ON the print. Do not redraw, simplify, translate, or invent new words. The print hangs large in a frame on a wall. Never hands, never a person holding it, never a flat lay on a desk."
    : "HARD RULE — PRODUCT 1:1. Copy the artwork exactly: same drawings, same colours, same letters already printed ON the product. Do not redraw, simplify, translate, or invent new words. A flat-lay may keep the sheet. An in-use or hands shot shows the finished piece large (cut bookmark, cut topper, cut tag, coloured doll, or the printed page) — never a tiny uncut page lost in the photo.";
  const withText = slot.key === "promo-1" && slot.overlay_text;
  if (withText) {
    const label = promoOverlayName(concept, productLabel);
    return `${faithful}

HARD RULE — PROMOTIONAL TITLE ONLY AT THE TOP OF THE PHOTO. Put the product name in empty space above the product, clean sans-serif, high contrast, spelled correctly. Use: "${label}". Optional second line: the theme "${concept.theme}". This overlay is a photo caption, not part of the product. No Turkish. No badges, ribbons, icons, infographic, or "download now". Never print the overlay on the product. Ignore any scene note that says no text.`;
  }
  return `${faithful}

HARD RULE — NO promotional overlay. No photo titles, badges, banners, watermarks, or "download now". The only letters allowed are those already on the product in the reference.`;
}

export async function setSlotOverlayText(conceptId: string, imageKey: string, overlayText: boolean) {
  return updateConcept(conceptId, (concept) => {
    slotOf(concept, imageKey).overlay_text = overlayText;
  });
}

/**
 * Promo kareleri onaylanan ürün sayfalarını referans alıyor.
 * Paper doll sayfa 2 sayfa 1'i, sayfa 3 hem 1 hem 2'yi ölçek için alır.
 */
async function referencesFor(concept: Concept, slot: ImageSlot): Promise<string[]> {
  const products = productSlots(concept.images);
  const primary = products[0];

  if (slot.kind === "product") {
    if (isWallArt(concept.type) && isWallLandscapeKey(slot.key)) {
      const portrait = products.find((entry) => entry.key === slot.key.replace(/-land$/, ""));
      const approved = portrait ? approvedGeneration(portrait) : null;
      if (!approved) throw new Error("Approve the portrait first — the landscape recomposes it.");
      return [await toReferenceDataUrl(await readFile(approved.path))];
    }
    if (concept.type === "paperdoll" && slot.key === (primary?.key ?? "product-1")) return [];
    if (!primary || slot.key === primary.key) return [];
    const approved = approvedGeneration(primary);
    if (!approved) {
      throw new Error(
        `Önce ${primary.key === PRODUCT_KEY ? "ürün görselini" : "sayfa 1'i"} üretip onayla — sonraki sayfalar onu referans alıyor`,
      );
    }
    if (concept.type === "paperdoll" && slot.key === "product-3") {
      const page2 = products.find((entry) => entry.key === "product-2");
      const page2Approved = page2 ? approvedGeneration(page2) : null;
      if (!page2Approved) {
        throw new Error("Önce sayfa 2'yi üretip onayla — sayfa 3 aksesuar ölçeğini ondan alır");
      }
      return [
        await toReferenceDataUrl(await readFile(approved.path)),
        await toReferenceDataUrl(await readFile(page2Approved.path)),
      ];
    }
    return [await toReferenceDataUrl(await readFile(approved.path))];
  }

  const approvedProducts = products
    .map((entry) => approvedGeneration(entry))
    .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry));
  if (approvedProducts.length === 0 || approvedProducts.length !== products.length) {
    throw new Error("Önce bütün ürün sayfalarını üretip onayla — promo kareleri onları referans alıyor");
  }
  return Promise.all(approvedProducts.map(async (entry) => toReferenceDataUrl(await readFile(entry.path))));
}

export type GenerateImageOptions = {
  /** Doldurulursa slotun talimatı güncellenip o metinle üretilir. */
  instruction?: string;
  /** Arayüzden seçilen kalite kademesi; gelmezse tipe göre varsayılan kullanılır. */
  quality?: ImageQuality;
  /**
   * Seçili görseli referans alıp yalnızca bu düzeltmeyi uygular. Slot talimatını
   * değiştirmez — "yeniden üret"ten ayrı, küçük revize.
   */
  revision?: string;
  /** Promo 1 yazı tiki; gelirse slota yazılır. */
  overlayText?: boolean;
};

export async function generateSlotImage(
  conceptId: string,
  imageKey: string,
  options: GenerateImageOptions = {},
) {
  const instruction = options.instruction?.trim();
  const revision = options.revision?.trim();
  if (options.overlayText !== undefined) {
    await updateConcept(conceptId, (concept) => {
      slotOf(concept, imageKey).overlay_text = options.overlayText === true;
    });
  }
  if (instruction) {
    await updateConcept(conceptId, (concept) => {
      const slot = slotOf(concept, imageKey);
      slot.instruction = instruction;
      // Konseptin kendisi de güncelleniyor: export metni ve Pinterest çağrısı
      // kullanıcının düzenlediği hâli görsün.
      if (slot.kind === "product") {
        const index = productSlots(concept.images).findIndex((entry) => entry.key === slot.key);
        if (index === 0) concept.product_image_prompt = instruction;
        if (concept.product_pages.length > 0 && index >= 0) {
          concept.product_pages[index] = instruction;
        }
      } else {
        const index = concept.images.filter((s) => s.kind === "promo").indexOf(slot);
        if (index >= 0) concept.promo_scenes[index] = instruction;
      }
    });
  }

  const concept = await getConcept(conceptId);
  if (concept.status === "concept_pending" || concept.status === "concept_rejected") {
    throw new Error("Bu konsept onaylanmadı — görsel üretilemez");
  }

  const config = await loadProductType(concept.type);
  const slot = slotOf(concept, imageKey);
  if (!slotUnlocked(concept.images, slot, concept.type)) {
    throw new Error(
      slot.kind === "promo"
        ? "Önce bütün ürün sayfalarını onayla — promo kareleri onları referans alıyor"
        : concept.type === "paperdoll" && slot.key === "product-3"
          ? "Önce sayfa 2'yi üretip onayla — sayfa 3 aksesuar ölçeğini ondan alır"
          : "Önce sayfa 1'i üretip onayla — sonraki sayfalar onu referans alıyor",
    );
  }
  const current = selectedGeneration(slot);
  if (revision && !current) {
    throw new Error("Revize için önce bir görsel üret");
  }
  const references = revision && current
    ? [await toReferenceDataUrl(await readFile(current.path))]
    : await referencesFor(concept, slot);
  const seed = Math.floor(Math.random() * 1_000_000);
  const quality = options.quality ?? qualityFor(slot.kind);
  const prompt = revision
    ? [
        `EDIT PASS of the first reference image. Keep the same layout, character, items, scale, line weight and composition. Apply ONLY this change: ${revision}. Do not redesign the page. Do not add new objects unless the change asks for them. Everything not mentioned stays identical.`,
        buildPrompt(concept, slot, config, seed),
      ].join("\n\n")
    : buildPrompt(concept, slot, config, seed);

  await updateConcept(conceptId, (current) => {
    const target = slotOf(current, imageKey);
    target.status = "generating";
    target.error = null;
    if (current.status === "concept_approved") current.status = "images_pending";
  });

  try {
    const raw = await generateImage({
      prompt,
      inputImages: references,
      aspectRatio:
        slot.kind === "product"
          ? isWallArt(concept.type) && isWallLandscapeKey(slot.key)
            ? "1536x1152"
            : config.print.generateAspect
          : PROMO_ASPECT,
      quality,
    });

    const finished =
      slot.kind === "product"
        ? await fitToPrint(
            raw,
            isWallArt(concept.type) && isWallLandscapeKey(slot.key)
              ? { label: "24x16-300dpi", width: 7200, height: 4800, dpi: 300, generateAspect: "1536x1152" }
              : config.print,
            { pageFrame: concept.type === "coloring" || concept.type === "doodle" },
          )
        : await fitToPromo(raw);

    const generationId = randomUUID().slice(0, 8);
    const dir = generationsDir(conceptId, imageKey);
    await ensureDir(dir);
    const file = path.join(dir, `${generationId}.png`);
    await writeFile(file, finished);

    return updateConcept(conceptId, (current) => {
      const target = slotOf(current, imageKey);
      target.generations.push({
        id: generationId,
        created_at: new Date().toISOString(),
        prompt,
        seed,
        quality,
        path: file,
      });
      target.selected_generation_id = generationId;
      target.status = "generated";
      target.error = null;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateConcept(conceptId, (current) => {
      const target = slotOf(current, imageKey);
      target.status = "failed";
      target.error = message;
    });
    throw error;
  }
}

/**
 * Onaylanan üretim seçili kalıyor, diğerleri silinmiyor: export sırasında
 * `rejected/` klasörüne kopyalanıyorlar (maliyet takibi ve ileride referans).
 */
export async function approveSlotImage(
  conceptId: string,
  imageKey: string,
  generationId?: string,
) {
  return updateConcept(conceptId, (concept) => {
    const slot = slotOf(concept, imageKey);
    const chosen = generationId ?? slot.selected_generation_id;
    if (!chosen || !slot.generations.some((g) => g.id === chosen)) {
      throw new Error("Onaylanacak üretim bulunamadı");
    }
    slot.selected_generation_id = chosen;
    slot.status = "approved";
    slot.error = null;

    if (concept.images.every((entry) => entry.status === "approved")) {
      // Export edilmiş bir ürünün karesi yeniden onaylanırsa durumu geri almıyoruz.
      if (concept.status === "images_pending" || concept.status === "concept_approved") {
        concept.status = "images_approved";
      }
    }
  });
}

/** Bir üretimi seçili yapar (onaylamadan) — kullanıcı eski denemeye dönebilsin. */
export async function selectGeneration(
  conceptId: string,
  imageKey: string,
  generationId: string,
) {
  return updateConcept(conceptId, (concept) => {
    const slot = slotOf(concept, imageKey);
    if (!slot.generations.some((g) => g.id === generationId)) {
      throw new Error("Üretim bulunamadı");
    }
    slot.selected_generation_id = generationId;
    if (slot.status === "approved") slot.status = "generated";
  });
}

export async function removeGeneration(conceptId: string, imageKey: string, generationId: string) {
  const concept = await getConcept(conceptId);
  const slot = slotOf(concept, imageKey);
  const generation = slot.generations.find((entry) => entry.id === generationId);
  if (!generation) throw new Error("Üretim bulunamadı");

  try {
    await unlink(generation.path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  return updateConcept(conceptId, (current) => {
    const target = slotOf(current, imageKey);
    target.generations = target.generations.filter((entry) => entry.id !== generationId);
    if (target.selected_generation_id === generationId) {
      const fallback = target.generations.at(-1) ?? null;
      target.selected_generation_id = fallback?.id ?? null;
    }
    if (target.generations.length === 0) {
      target.selected_generation_id = null;
      target.status = "pending";
    } else if (target.status === "approved") {
      target.status = "generated";
    }
    if (
      (current.status === "images_approved" || current.status === "concept_approved") &&
      current.images.some((entry) => entry.status !== "approved")
    ) {
      current.status = "images_pending";
    }
  });
}

/** Fazla promo karesini konseptten çıkarır. Ürün sayfalarına dokunmaz. En az 3 promo kalır. */
export async function removePromoSlot(conceptId: string, imageKey: string) {
  const concept = await getConcept(conceptId);
  if (concept.etsy_listing_id && concept.etsy_listing_state !== "deleted") {
    throw new Error("This promo is already on an Etsy listing.");
  }
  const promos = concept.images.filter((slot) => slot.kind === "promo");
  const slot = promos.find((entry) => entry.key === imageKey);
  if (!slot) throw new Error("Promo slot not found.");
  if (promos.length <= PROMO_COUNT_MIN) {
    throw new Error("Keep at least 3 promo images.");
  }

  await rm(generationsDir(conceptId, imageKey), { recursive: true, force: true });

  return updateConcept(conceptId, (current) => {
    const currentPromos = current.images.filter((entry) => entry.kind === "promo");
    if (currentPromos.length <= PROMO_COUNT_MIN) throw new Error("Keep at least 3 promo images.");
    const promoIndex = currentPromos.findIndex((entry) => entry.key === imageKey);
    if (promoIndex < 0) throw new Error("Promo slot not found.");
    current.images = current.images.filter((entry) => entry.key !== imageKey);
    if (promoIndex < current.promo_scenes.length) current.promo_scenes.splice(promoIndex, 1);
    if (
      current.images.length > 0 &&
      current.images.every((entry) => entry.status === "approved") &&
      (current.status === "images_pending" || current.status === "images_approved")
    ) {
      current.status = "images_approved";
    }
  });
}
