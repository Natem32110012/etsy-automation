import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { DATA_ROOT } from "./paths";
import { isBuiltinType, printSizeSchema, PRODUCT_TYPES } from "./types";

const listingCopySchema = z.object({
  highlight: z.string().min(1),
  included: z.string().min(1),
  howItWorks: z.string().min(1),
  perfectFor: z.string().min(1),
  extras: z.string().min(1),
  honesty: z.string().min(1),
});

export const customTypeSchema = z.object({
  id: z.string().regex(/^[a-z][a-z0-9-]{0,31}$/),
  label: z.string().min(1),
  sourceTitle: z.string(),
  sourceUrl: z.string(),
  sourceListingId: z.number().int().positive().nullable(),
  searchQuery: z.string().min(1),
  themeDomain: z.string().min(1),
  priceTry: z.number().positive(),
  sectionHints: z.array(z.string()).min(1),
  taxonomyHints: z.array(z.string()).min(1),
  print: printSizeSchema,
  role: z.string().min(1),
  productImageRules: z.string().min(1),
  promoSceneRules: z.string().min(1),
  titleKeywords: z.string().min(1),
  listingCopy: listingCopySchema,
  productRender: z.string().min(1),
  promoRender: z.string().min(1),
  createdAt: z.string(),
});

export type CustomProductType = z.infer<typeof customTypeSchema>;

const FILE = path.join(DATA_ROOT, "custom-types.json");

export function readCustomTypes(): CustomProductType[] {
  if (!existsSync(FILE)) return [];
  try {
    const parsed = z.array(customTypeSchema).parse(JSON.parse(readFileSync(FILE, "utf8")));
    return parsed;
  } catch {
    return [];
  }
}

export function readCustomType(id: string): CustomProductType | null {
  return readCustomTypes().find((entry) => entry.id === id) ?? null;
}

export function saveCustomType(entry: CustomProductType): CustomProductType {
  const saved = customTypeSchema.parse(entry);
  if ((PRODUCT_TYPES as readonly string[]).includes(saved.id) || isBuiltinType(saved.id)) {
    throw new Error(`"${saved.id}" is a built-in product type.`);
  }
  const all = readCustomTypes().filter((row) => row.id !== saved.id);
  all.push(saved);
  mkdirSync(path.dirname(FILE), { recursive: true });
  writeFileSync(FILE, `${JSON.stringify(all, null, 2)}\n`);
  return saved;
}
