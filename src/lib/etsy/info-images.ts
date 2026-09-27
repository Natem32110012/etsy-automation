import path from "node:path";
import type { ProductType } from "../types";

export const INFO_LISTING_IMAGES = [
  {
    key: "info-print-at-home",
    file: "print-at-home.jpg",
    label: "Print at home",
    url: "/etsy-info/print-at-home.jpg",
  },
  {
    key: "info-digital-download",
    file: "digital-download.jpg",
    label: "Digital download",
    url: "/etsy-info/digital-download.jpg",
  },
] as const;

export type InfoListingKey = (typeof INFO_LISTING_IMAGES)[number]["key"];

export function infoImageRoot() {
  return path.join(process.cwd(), "public", "etsy-info");
}

export function infoImagePath(key: string) {
  const row = INFO_LISTING_IMAGES.find((entry) => entry.key === key);
  if (!row) throw new Error(`Unknown listing info image: ${key}`);
  return path.join(infoImageRoot(), row.file);
}

export function defaultInfoKeys() {
  return INFO_LISTING_IMAGES.map((entry) => entry.key);
}

export function isInfoKey(key: string): key is InfoListingKey {
  return INFO_LISTING_IMAGES.some((entry) => entry.key === key);
}

/** Extra price chips in the draft form. Coloring shop listings use 149 TRY. */
export const PRICE_PRESETS_TRY: Partial<Record<ProductType, number[]>> = {
  coloring: [39.9, 149],
};
