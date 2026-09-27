import { readFile } from "node:fs/promises";
import { boardIdFor, loadProductType } from "./config";
import { parseJson } from "./json";
import { buildPinterestPrompt } from "./prompts/pinterest";
import { generateText } from "./replicate";
import { getConcept, updateConcept } from "./store";
import { PINTEREST_DESCRIPTION_MAX, PINTEREST_TITLE_MAX, sanitizeEtsyTitle, type Concept, type Pin } from "./types";

function apiBase() {
  return process.env.PINTEREST_API_BASE?.replace(/\/+$/, "") ?? "https://api.pinterest.com/v5";
}

export function hasPinterestToken() {
  return Boolean(process.env.PINTEREST_ACCESS_TOKEN?.trim());
}

/**
 * Etsy metnini kopyalamak yerine ayrı bir süzgeç çağrısı: Pinterest başlığı 100,
 * açıklaması 500 karakterle sınırlı ve arama davranışı Etsy'den farklı.
 */
export async function generatePinterestCopy(conceptId: string) {
  const concept = await getConcept(conceptId);
  const config = await loadProductType(concept.type);

  const raw = await generateText(buildPinterestPrompt(concept, config.label), { maxTokens: 700 });
  const parsed = parseJson<{ title?: unknown; description?: unknown }>(raw, "Pinterest metni");

  const title = sanitizeEtsyTitle(String(parsed.title ?? "")).slice(0, PINTEREST_TITLE_MAX);
  const description = String(parsed.description ?? "")
    .trim()
    .slice(0, PINTEREST_DESCRIPTION_MAX);

  if (!title || !description) throw new Error("Pinterest metni boş döndü — tekrar dene");

  return updateConcept(conceptId, (current) => {
    current.pinterest_title = title;
    current.pinterest_description = description;
  });
}

type CreatePinResponse = { id?: string };

async function createPin(input: {
  boardId: string;
  title: string;
  description: string;
  link: string;
  image: Buffer;
}): Promise<string> {
  const response = await fetch(`${apiBase()}/pins`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.PINTEREST_ACCESS_TOKEN?.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      board_id: input.boardId,
      title: input.title,
      description: input.description,
      link: input.link,
      // Görseller public bir yere host edilmiyor; v5 base64 kabul ediyor.
      media_source: {
        source_type: "image_base64",
        content_type: "image/png",
        data: input.image.toString("base64"),
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Pinterest pin oluşturulamadı (${response.status}): ${body.slice(0, 300)}`);
  }

  const data = (await response.json()) as CreatePinResponse;
  if (!data.id) throw new Error("Pinterest pin id döndürmedi");
  return data.id;
}

export type PublishInput = {
  etsyLink: string;
  /** Pin atılacak promo görsellerinin slot anahtarları, ör. ["promo-1", "promo-3"]. */
  imageKeys: string[];
};

/**
 * Etsy linki girildiğinde tetiklenen adım: metin üretimi + pin oluşturma.
 *
 * Token ya da board tanımlı değilse "dry-run" çalışıyor — metinler üretilip
 * kaydediliyor, pin atılmıyor. Böylece Pinterest hesabı açılmadan da akış
 * baştan sona denenebiliyor.
 */
export async function publishToPinterest(conceptId: string, input: PublishInput) {
  const link = input.etsyLink.trim();
  if (!/^https?:\/\//i.test(link)) throw new Error("Geçerli bir Etsy linki gir (http/https)");

  await updateConcept(conceptId, (current) => {
    current.etsy_link = link;
  });

  let concept = await getConcept(conceptId);
  if (!concept.folder_path) throw new Error("Önce ürünü export et");

  if (!concept.pinterest_title || !concept.pinterest_description) {
    concept = await generatePinterestCopy(conceptId);
  }

  const config = await loadProductType(concept.type);
  const boardId = boardIdFor(config);
  const dryRun = !hasPinterestToken() || !boardId;

  const targets = selectTargets(concept, input.imageKeys);
  const pins: Pin[] = [];

  for (const key of targets) {
    const slot = concept.images.find((entry) => entry.key === key)!;
    const generation = slot.generations.find((g) => g.id === slot.selected_generation_id);
    if (!generation) {
      pins.push(pinRecord(key, null, boardId, dryRun, "onaylı görsel yok"));
      continue;
    }

    if (dryRun) {
      pins.push(pinRecord(key, null, boardId, true, null));
      continue;
    }

    try {
      const id = await createPin({
        boardId: boardId!,
        title: concept.pinterest_title!,
        description: concept.pinterest_description!,
        link,
        image: await readFile(generation.path),
      });
      pins.push(pinRecord(key, id, boardId, false, null));
    } catch (error) {
      pins.push(
        pinRecord(key, null, boardId, false, error instanceof Error ? error.message : String(error)),
      );
    }
  }

  const updated = await updateConcept(conceptId, (current) => {
    current.pinterest_pins = [...current.pinterest_pins, ...pins];
    if (pins.some((pin) => pin.pin_id)) current.status = "pinterest_posted";
  });

  const reason = !hasPinterestToken()
    ? "PINTEREST_ACCESS_TOKEN tanımlı değil"
    : !boardId
      ? `${config.boardEnv} tanımlı değil`
      : null;

  return { concept: updated, pins, dryRun, reason };
}

function selectTargets(concept: Concept, imageKeys: string[]): string[] {
  const promos = concept.images.filter((slot) => slot.kind === "promo");
  const valid = imageKeys.filter((key) => promos.some((slot) => slot.key === key));
  if (valid.length > 0) return valid;
  // Seçim gelmediyse ilk onaylı promo karesi pinlenir.
  const fallback = promos.find((slot) => slot.status === "approved");
  if (!fallback) throw new Error("Pinlenecek onaylı promo görseli yok");
  return [fallback.key];
}

function pinRecord(
  imageKey: string,
  pinId: string | null,
  boardId: string | null,
  dryRun: boolean,
  error: string | null,
): Pin {
  return {
    image_key: imageKey,
    pin_id: pinId,
    board_id: boardId,
    created_at: new Date().toISOString(),
    dry_run: dryRun,
    error,
  };
}
