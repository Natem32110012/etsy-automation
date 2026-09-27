import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { productTypeConfigSchema, type ProductType, type ProductTypeConfig } from "./types";
import { readCustomType } from "./custom-types";

const configFileSchema = z.record(z.string(), productTypeConfigSchema);

let cache: Record<string, ProductTypeConfig> | null = null;

export async function loadProductTypes(): Promise<Record<string, ProductTypeConfig>> {
  if (cache) return cache;
  const raw = await readFile(path.join(process.cwd(), "config", "product-types.json"), "utf8");
  cache = configFileSchema.parse(JSON.parse(raw));
  return cache;
}

export async function loadProductType(type: ProductType): Promise<ProductTypeConfig> {
  const custom = readCustomType(type);
  if (custom) {
    return {
      label: custom.label,
      slug: custom.id,
      print: custom.print,
      boardEnv: `BOARD_ID_${custom.id.toUpperCase().replace(/-/g, "_")}`,
    };
  }
  const config = (await loadProductTypes())[type];
  if (!config) throw new Error(`product-types.json içinde "${type}" bulunamadı`);
  return config;
}

/** Ürün tipinin board'u; .env'de tanımlı değilse null (Pinterest adımı dry-run olur). */
export function boardIdFor(config: ProductTypeConfig): string | null {
  const value = process.env[config.boardEnv];
  return value && value.trim().length > 0 ? value.trim() : null;
}
