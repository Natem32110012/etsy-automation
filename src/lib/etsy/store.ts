import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_ROOT, ensureDir } from "../paths";
import { z } from "zod";

const ETSY_DIR = path.join(DATA_ROOT, "etsy");
const TOKENS_FILE = path.join(ETSY_DIR, "tokens.json");
const STATE_FILE = path.join(ETSY_DIR, "state.json");

const tokenSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  token_type: z.string().default("Bearer"),
});

const snapshotSchema = z.object({
  date: z.string(),
  listing_id: z.number(),
  views: z.number(),
  num_favorers: z.number(),
  quantity: z.number(),
  price: z.number(),
  state: z.string(),
  sales: z.number().default(0),
  revenue: z.number().default(0),
});

const taxonomyNodeSchema = z.object({
  id: z.number(),
  name: z.string(),
  path: z.string(),
});

const stateSchema = z.object({
  shop_id: z.number().nullable().default(null),
  shop_name: z.string().nullable().default(null),
  connected_at: z.string().nullable().default(null),
  last_snapshot_at: z.string().nullable().default(null),
  taxonomy: z.array(taxonomyNodeSchema).default([]),
  taxonomy_by_type: z.record(z.string(), z.number()).default({}),
  sections: z.array(z.object({ id: z.number(), title: z.string() })).default([]),
  section_by_type: z.record(z.string(), z.number()).default({}),
  snapshots: z.array(snapshotSchema).default([]),
});

export type EtsyTokens = z.infer<typeof tokenSchema>;
export type EtsySnapshot = z.infer<typeof snapshotSchema>;
export type EtsyShopState = z.infer<typeof stateSchema>;
export type TaxonomyNode = z.infer<typeof taxonomyNodeSchema>;

let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

async function writeAtomic(file: string, contents: string) {
  await ensureDir(path.dirname(file));
  const tmp = path.join(path.dirname(file), `.${path.basename(file)}.${process.pid}.tmp`);
  await writeFile(tmp, contents, "utf8");
  await rename(tmp, file);
}

export async function readTokens(): Promise<EtsyTokens | null> {
  try {
    const raw = await readFile(TOKENS_FILE, "utf8");
    return tokenSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function writeTokens(tokens: EtsyTokens) {
  await writeAtomic(TOKENS_FILE, `${JSON.stringify(tokens, null, 2)}\n`);
}

export async function clearTokens() {
  try {
    await unlink(TOKENS_FILE);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readShopState(): Promise<EtsyShopState> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    if (!raw.trim()) return stateSchema.parse({});
    return stateSchema.parse(JSON.parse(raw));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return stateSchema.parse({});
    throw error;
  }
}

export function updateShopState(
  mutate: (state: EtsyShopState) => void | Promise<void>,
): Promise<EtsyShopState> {
  return withLock(async () => {
    const state = await readShopState();
    await mutate(state);
    const validated = stateSchema.parse(state);
    await writeAtomic(STATE_FILE, `${JSON.stringify(validated, null, 2)}\n`);
    return validated;
  });
}
