import path from "node:path";
import { mkdir } from "node:fs/promises";

export const DATA_ROOT = path.join(process.cwd(), "data");

/** Tekrar önleme ve dashboard'un okuduğu tek log dosyası. */
export const CONCEPTS_FILE = path.join(DATA_ROOT, "concepts.json");

/** Onay bekleyen üretimler; export'tan önce burada duruyor. */
export function conceptDir(conceptId: string) {
  return path.join(DATA_ROOT, "products", conceptId);
}

export function generationsDir(conceptId: string, imageKey: string) {
  return path.join(conceptDir(conceptId), imageKey);
}

export const EXPORT_ROOT = path.join(DATA_ROOT, "exports");

export async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

/** data/ altındaki mutlak bir yolu, /api/files ile sunulabilir göreli yola çevirir. */
export function toPublicPath(absolutePath: string) {
  const rel = path.relative(DATA_ROOT, absolutePath).split(path.sep).join("/");
  return `/api/files/${rel}`;
}

/** /api/files için gelen göreli yolu güvenli şekilde mutlak yola çevirir. */
export function resolveDataPath(segments: string[]): string | null {
  const target = path.resolve(DATA_ROOT, ...segments);
  const root = path.resolve(DATA_ROOT);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

/** Türkçe karakterleri de düzleştiren klasör adı üreticisi. */
export function slugify(value: string) {
  const map: Record<string, string> = {
    ç: "c",
    ğ: "g",
    ı: "i",
    ö: "o",
    ş: "s",
    ü: "u",
    â: "a",
    î: "i",
    û: "u",
  };
  return value
    .toLowerCase()
    .replace(/[çğıöşüâîû]/g, (char) => map[char] ?? char)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
