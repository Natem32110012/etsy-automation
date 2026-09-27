import { readCustomTypes } from "../custom-types";
import { etsyForm, etsyGet } from "./client";
import { SECTION_HINTS } from "./config";
import { readShopState, updateShopState, type EtsyShopState } from "./store";
import type { BuiltinProductType, ProductType } from "../types";

type MeResponse = { user_id?: number };
type ShopsResponse = {
  results?: Array<{ shop_id: number; shop_name: string }>;
  shop_id?: number;
  shop_name?: string;
};

export async function syncShopProfile() {
  const me = await etsyGet<MeResponse>("/application/users/me");
  if (!me.user_id) throw new Error("Etsy user id was not returned.");
  const shops = await etsyGet<ShopsResponse>(`/application/users/${me.user_id}/shops`);
  const shop = shops.results?.[0] ?? (shops.shop_id ? shops : null);
  if (!shop?.shop_id) throw new Error("No Etsy shop found for this account.");
  const envShop = Number(process.env.ETSY_SHOP_ID || 0);
  const shopId = envShop || shop.shop_id;
  const shopName = shop.shop_name ?? null;
  await updateShopState((state) => {
    state.shop_id = shopId;
    state.shop_name = shopName;
    state.connected_at = new Date().toISOString();
  });
  return { shop_id: shopId, shop_name: shopName };
}

export async function refreshShopSections() {
  const state = await readShopState();
  if (!state.shop_id) throw new Error("Connect Etsy first.");
  const data = await etsyGet<{ results?: Array<{ shop_section_id?: number; title?: string }> }>(
    `/application/shops/${state.shop_id}/sections`,
  );
  const sections = (data.results ?? [])
    .map((row) => ({ id: Number(row.shop_section_id), title: String(row.title ?? "") }))
    .filter((row) => Number.isFinite(row.id) && row.title);
  const section_by_type: Record<string, number> = {};
  const hintGroups: Array<[string, string[]]> = [
    ...(Object.entries(SECTION_HINTS) as [BuiltinProductType, string[]][]),
    ...readCustomTypes().map((entry) => [entry.id, entry.sectionHints] as [string, string[]]),
  ];
  for (const [type, hints] of hintGroups) {
    const match = hints
      .map(
        (hint) =>
          sections.find((section) => section.title.toLowerCase() === hint.toLowerCase()) ??
          sections.find((section) => section.title.toLowerCase().includes(hint.toLowerCase())),
      )
      .find(Boolean);
    if (match) section_by_type[type] = match.id;
  }
  for (const entry of readCustomTypes()) {
    const title = shopSectionTitle(entry.label, entry.sectionHints);
    const exact = sections.find((section) => section.title.toLowerCase() === title.toLowerCase());
    if (exact) {
      section_by_type[entry.id] = exact.id;
      continue;
    }
    if (sections.length >= 20) continue;
    try {
      const created = await etsyForm<{ shop_section_id?: number; title?: string }>(
        `/application/shops/${state.shop_id}/sections`,
        "POST",
        { title },
      );
      const id = Number(created?.shop_section_id);
      if (!Number.isFinite(id)) continue;
      const savedTitle = created?.title?.trim() || title;
      sections.push({ id, title: savedTitle });
      section_by_type[entry.id] = id;
    } catch {
      // Bölüm açılamazsa tip durur; taslak formunda bölüm boş kalır.
    }
  }
  for (const [type, title] of [
    ["kids-wall-art", "Kids Wall Art"],
    ["adult-wall-art", "Wall Art"],
  ] as const) {
    if (section_by_type[type] || sections.length >= 20) continue;
    const exact = sections.find((section) => section.title.toLowerCase() === title.toLowerCase());
    if (exact) {
      section_by_type[type] = exact.id;
      continue;
    }
    try {
      const created = await etsyForm<{ shop_section_id?: number; title?: string }>(
        `/application/shops/${state.shop_id}/sections`,
        "POST",
        { title },
      );
      const id = Number(created?.shop_section_id);
      if (!Number.isFinite(id)) continue;
      sections.push({ id, title: created?.title?.trim() || title });
      section_by_type[type] = id;
    } catch {
      // Bölüm açılamazsa taslakta boş kalır.
    }
  }
  await updateShopState((current) => {
    current.sections = sections;
    current.section_by_type = { ...current.section_by_type, ...section_by_type };
  });
  return { sections, section_by_type };
}

export function matchedSection(state: EtsyShopState, type: ProductType) {
  const id = state.section_by_type[type];
  if (!id) return null;
  return state.sections.find((section) => section.id === id) ?? { id, title: `Section ${id}` };
}

const GENERIC_SECTION =
  /^(digital prints?|digital|gifts?|gift ideas|printables?|home & living|paper|holiday decor)$/i;

/** Short shop-section name. Etsy allows 24 characters. Skips generic hints. */
export function shopSectionTitle(label: string, hints: string[]) {
  const hint = hints
    .map((entry) => entry.trim())
    .find((entry) => entry.length >= 2 && entry.length <= 24 && !GENERIC_SECTION.test(entry));
  if (hint) return hint;
  let name = label.replace(/^printable\s+/i, "").trim() || label.trim();
  if (name.length <= 24) return name;
  const cut = name.slice(0, 24).replace(/\s+\S*$/, "").trim();
  return cut || name.slice(0, 24);
}

/**
 * Exact section title wins. Otherwise create one section for this product type.
 * Does not rename or delete existing sections.
 */
export async function ensureShopSection(typeId: string, title: string) {
  const state = await readShopState();
  if (!state.shop_id) return { ok: false as const, error: "Connect Etsy first." };
  const name = title.trim().slice(0, 24);
  if (name.length < 2) return { ok: false as const, error: "Section name is too short." };

  const before = await readShopState();
  const had = before.sections.some((section) => section.title.toLowerCase() === name.toLowerCase());
  await refreshShopSections();
  const fresh = await readShopState();
  const exact = fresh.sections.find((section) => section.title.toLowerCase() === name.toLowerCase());
  if (exact) {
    await updateShopState((current) => {
      current.section_by_type[typeId] = exact.id;
    });
    return { ok: true as const, title: exact.title, created: !had };
  }
  if (fresh.sections.length >= 20) {
    return {
      ok: false as const,
      error: "Etsy allows 20 shop sections. Remove an old one, then add the product again.",
    };
  }

  try {
    const created = await etsyForm<{ shop_section_id?: number; title?: string }>(
      `/application/shops/${fresh.shop_id}/sections`,
      "POST",
      { title: name },
    );
    const id = Number(created?.shop_section_id);
    if (!Number.isFinite(id)) return { ok: false as const, error: "Etsy did not return a section id." };
    const savedTitle = created?.title?.trim() || name;
    await updateShopState((current) => {
      current.sections = [...current.sections.filter((section) => section.id !== id), { id, title: savedTitle }];
      current.section_by_type[typeId] = id;
    });
    return { ok: true as const, title: savedTitle, created: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, error: message };
  }
}
