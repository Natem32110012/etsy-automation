import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { CONCEPTS_FILE, DATA_ROOT, ensureDir } from "./paths";
import {
  AVOID_WINDOW,
  logFileSchema,
  type Concept,
  type ConceptStatus,
  type LogFile,
  type ProductType,
} from "./types";

/**
 * Aynı log'a eşzamanlı yazan iki istek birbirinin değişikliğini ezmesin diye tek
 * sıralı kuyruk. Kartlar tek tek onaylandığı için bu çok sık oluyor.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

const EMPTY: LogFile = { export_counter: 0, concepts: [] };

export async function readLog(): Promise<LogFile> {
  try {
    const raw = await readFile(CONCEPTS_FILE, "utf8");
    return logFileSchema.parse(migrate(JSON.parse(raw)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return { ...EMPTY, concepts: [] };
    throw error;
  }
}

/** Şema büyüdüğünde eski concepts.json dosyaları hâlâ okunabilsin. */
function migrate(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const log = raw as Record<string, unknown>;
  if (typeof log.export_counter !== "number") log.export_counter = 0;
  if (!Array.isArray(log.concepts)) log.concepts = [];

  for (const entry of log.concepts as Record<string, unknown>[]) {
    if (!Array.isArray(entry.pinterest_pins)) entry.pinterest_pins = [];
    if (!Array.isArray(entry.images)) entry.images = [];
    if (entry.folder_path === undefined) entry.folder_path = null;
    if (entry.etsy_link === undefined) entry.etsy_link = null;
    if (entry.etsy_listed === undefined) entry.etsy_listed = false;
    if (entry.etsy_listing_id === undefined) entry.etsy_listing_id = null;
    if (entry.etsy_listing_state === undefined) entry.etsy_listing_state = "none";
    if (entry.etsy_listing_error === undefined) entry.etsy_listing_error = null;
    if (entry.etsy_price === undefined) entry.etsy_price = null;
    if (entry.etsy_quantity === undefined) entry.etsy_quantity = null;
    if (entry.etsy_taxonomy_id === undefined) entry.etsy_taxonomy_id = null;
    if (entry.etsy_cover_page === undefined) entry.etsy_cover_page = false;
    if (entry.archived === undefined) entry.archived = false;
    if (entry.pinterest_shared === undefined) entry.pinterest_shared = false;
    if (entry.pinterest_title === undefined) entry.pinterest_title = null;
    if (entry.pinterest_description === undefined) entry.pinterest_description = null;
    if (entry.character_bible === undefined) entry.character_bible = null;
    if (entry.theme_bible === undefined) entry.theme_bible = null;
    if (entry.summary_tr === undefined) entry.summary_tr = null;
    if (!Array.isArray(entry.product_pages)) entry.product_pages = [];
    if (Array.isArray(entry.images)) {
      for (const image of entry.images as Record<string, unknown>[]) {
        if (image.overlay_text === undefined) image.overlay_text = false;
      }
    }
  }

  return log;
}

async function writeAtomic(file: string, contents: string) {
  await ensureDir(path.dirname(file));
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, file);
}

/** Log'u oku, değiştir, yaz — kilitli. Mutasyon fonksiyonu log'u yerinde değiştirir. */
export function updateLog(mutate: (log: LogFile) => void | Promise<void>): Promise<LogFile> {
  return withLock(async () => {
    const log = await readLog();
    await mutate(log);
    const validated = logFileSchema.parse(log);
    await ensureDir(DATA_ROOT);
    await writeAtomic(CONCEPTS_FILE, JSON.stringify(validated, null, 2));
    return validated;
  });
}

/** Tek bir konsepti değiştirir; bulunamazsa hata verir. */
export async function updateConcept(
  id: string,
  mutate: (concept: Concept, log: LogFile) => void | Promise<void>,
): Promise<Concept> {
  const log = await updateLog(async (current) => {
    const concept = current.concepts.find((c) => c.id === id);
    if (!concept) throw new Error(`Konsept bulunamadı: ${id}`);
    await mutate(concept, current);
  });
  return log.concepts.find((c) => c.id === id)!;
}

export async function getConcept(id: string): Promise<Concept> {
  const concept = (await readLog()).concepts.find((c) => c.id === id);
  if (!concept) throw new Error(`Konsept bulunamadı: ${id}`);
  return concept;
}

export async function listConcepts(filter?: {
  type?: ProductType;
  status?: ConceptStatus[];
}): Promise<Concept[]> {
  const log = await readLog();
  return log.concepts
    .filter((c) => (filter?.type ? c.type === filter.type : true))
    .filter((c) => (filter?.status ? filter.status.includes(c.status) : true))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/**
 * Konsept promptuna enjekte edilen tekrar önleme listesi. Sadece başlık + tema
 * gidiyor, tüm JSON değil — token tasarrufu.
 *
 * Reddedilenler de listede: kullanıcı bir fikri elemişse model onu tekrar
 * getirmemeli. Aynı tipin geçmişine bakılıyor, tipler birbirini kısıtlamıyor.
 */
export async function avoidList(type: ProductType, limit = AVOID_WINDOW): Promise<string[]> {
  const concepts = await listConcepts({ type });
  return concepts.slice(0, limit).map((c) => `${c.title} — ${c.theme}`);
}

/** All distinct themes already used for this type — theme chips should skip them. */
export async function usedThemes(type: ProductType): Promise<string[]> {
  const concepts = await listConcepts({ type });
  const seen = new Set<string>();
  const themes: string[] = [];
  for (const concept of concepts) {
    const theme = concept.theme.trim().toLowerCase();
    if (!theme || seen.has(theme)) continue;
    seen.add(theme);
    themes.push(theme);
  }
  return themes;
}

/** Export klasörlerinin başındaki sıra numarasını ayırır. */
export async function reserveExportNumber(): Promise<number> {
  let reserved = 0;
  await updateLog((log) => {
    log.export_counter += 1;
    reserved = log.export_counter;
  });
  return reserved;
}
