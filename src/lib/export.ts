import { copyFile, readdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ensureListingCopy } from "./concepts";
import { loadProductType } from "./config";
import { EXPORT_ROOT, ensureDir, slugify } from "./paths";
import { reserveExportNumber, updateConcept } from "./store";
import { isWallArt, type Concept, type ProductTypeConfig } from "./types";

async function writeWallArtSizes(source: string, productDir: string, key: string) {
  const design = key.match(/^product-(\d+)/)?.[1] ?? "1";
  const target = path.join(productDir, `${design}-18x24.png`);
  await sharp(source)
    .resize(5400, 7200, { fit: "fill" })
    .withMetadata({ density: 300 })
    .png({ compressionLevel: 9, palette: true, quality: 90, effort: 8 })
    .toFile(target);
  return [target];
}

/** `01-yildiz-boyama-2026-08-10-letter-300dpi` */
function folderName(index: number, concept: Concept, config: ProductTypeConfig) {
  const date = concept.created_at.slice(0, 10);
  const slug = slugify(concept.etsy_title || concept.title) || config.slug;
  return `${String(index).padStart(2, "0")}-${slug}-${date}-${config.print.label}`;
}

/**
 * Export hepsi-ya-hiç: eksik bir promo karesiyle klasör oluşturmak, Etsy'ye
 * yarım set yüklemeye davetiye çıkarıyor.
 *
 * Reddedilen üretimler silinmiyor, `rejected/` altına kopyalanıyor — maliyet
 * takibi ve "bunu bir daha deneme" referansı için.
 */
export async function exportConcept(conceptId: string) {
  const concept = await ensureListingCopy(conceptId);
  const config = await loadProductType(concept.type);

  const missing = concept.images.filter((slot) => slot.status !== "approved");
  if (missing.length > 0) {
    throw new Error(
      `Onaylanmayan görsel var: ${missing.map((slot) => slot.key).join(", ")} — export edilemez`,
    );
  }

  // Aynı ürün ikinci kez export edilirse numara harcamıyoruz, klasörü tazeliyoruz.
  const existing = concept.folder_path;
  const dir =
    existing ?? path.join(EXPORT_ROOT, folderName(await reserveExportNumber(), concept, config));

  const productDir = path.join(dir, "product");
  const promoDir = path.join(dir, "promo");
  const rejectedDir = path.join(dir, "rejected");
  await Promise.all([ensureDir(productDir), ensureDir(promoDir), ensureDir(rejectedDir)]);

  const files: string[] = [];
  let productPosition = 0;
  let promoPosition = 0;

  for (const slot of concept.images) {
    const chosen = slot.generations.find((g) => g.id === slot.selected_generation_id);
    if (!chosen) throw new Error(`${slot.key} için seçili üretim yok`);

    if (slot.kind === "product" && isWallArt(concept.type)) {
      const written = await writeWallArtSizes(chosen.path, productDir, slot.key);
      files.push(...written);
    } else if (slot.kind === "product") {
      productPosition += 1;
      const target = path.join(productDir, `${String(productPosition).padStart(2, "0")}.png`);
      await copyFile(chosen.path, target);
      files.push(target);
    } else {
      promoPosition += 1;
      const target = path.join(promoDir, `${String(promoPosition).padStart(2, "0")}.png`);
      await copyFile(chosen.path, target);
      files.push(target);
    }

    for (const generation of slot.generations) {
      if (generation.id === chosen.id) continue;
      await copyFile(generation.path, path.join(rejectedDir, `${slot.key}-${generation.id}.png`));
    }
  }

  await dropStalePngs(productDir, files.filter((file) => file.startsWith(productDir)));
  await dropStalePngs(promoDir, files.filter((file) => file.startsWith(promoDir)));

  const copyMd = path.join(dir, "copy.md");
  const copyJson = path.join(dir, "copy.json");
  await writeFile(copyMd, buildCopyMarkdown(concept, config), "utf8");
  await writeFile(copyJson, `${JSON.stringify(buildCopyJson(concept, config), null, 2)}\n`, "utf8");

  const updated = await updateConcept(conceptId, (current) => {
    current.folder_path = dir;
    if (current.status === "images_approved" || current.status === "images_pending") {
      current.status = "exported";
    }
  });

  return { concept: updated, folder: dir, files: [...files, copyMd, copyJson] };
}

async function dropStalePngs(dir: string, kept: string[]) {
  const names = new Set(kept.map((file) => path.basename(file)));
  const entries = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.endsWith(".png") && !names.has(name))
      .map((name) => unlink(path.join(dir, name)).catch(() => undefined)),
  );
}

function buildCopyMarkdown(concept: Concept, config: ProductTypeConfig) {
  return `# ${concept.title}

- Tip: ${config.label}
- Tema: ${concept.theme || "-"}
- Ürün boyutu: ${config.print.width}x${config.print.height}px @ ${config.print.dpi}dpi
- Promo görseli: 1000x1500px (2:3)
- Oluşturma: ${concept.created_at.slice(0, 10)}
${concept.theme_bible ? `\n## Theme bible\n${concept.theme_bible}\n` : ""}
${concept.character_bible ? `\n## Character bible\n${concept.character_bible}\n` : ""}
${
  concept.product_pages.length > 1
    ? `## Sayfalar\n${concept.product_pages.map((page, index) => `### ${index + 1}\n${page}`).join("\n\n")}\n`
    : ""
}
## Etsy Title
${concept.etsy_title}

_${concept.etsy_title.length} karakter_

## Etsy Description
${concept.etsy_description}

## Etsy Tags
${concept.etsy_tags.map((tag) => `- ${tag}`).join("\n")}

_${concept.etsy_tags.length} tag_
`;
}

function buildCopyJson(concept: Concept, config: ProductTypeConfig) {
  return {
    id: concept.id,
    type: concept.type,
    type_label: config.label,
    title: concept.title,
    theme: concept.theme,
    theme_bible: concept.theme_bible,
    character_bible: concept.character_bible,
    product_pages: concept.product_pages,
    etsy_title: concept.etsy_title,
    etsy_description: concept.etsy_description,
    etsy_tags: concept.etsy_tags,
    product_size: {
      width: config.print.width,
      height: config.print.height,
      dpi: config.print.dpi,
    },
    promo_size: { width: 1000, height: 1500 },
    created_at: concept.created_at,
  };
}
