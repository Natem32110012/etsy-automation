import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { refreshTaxonomy, searchTaxonomy } from "@/lib/etsy/taxonomy";
import { refreshShopSections } from "@/lib/etsy/shop";
import { readShopState } from "@/lib/etsy/store";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const idRaw = url.searchParams.get("id");
    const selectedId = idRaw && /^\d+$/.test(idRaw) ? Number(idRaw) : null;
    const shop = await readShopState();
    const selected = selectedId ? shop.taxonomy.find((node) => node.id === selectedId) ?? null : null;
    return NextResponse.json({
      taxonomy: searchTaxonomy(shop.taxonomy, query, 50, selectedId),
      selected,
      taxonomy_by_type: shop.taxonomy_by_type,
      count: shop.taxonomy.length,
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST() {
  try {
    const result = await refreshTaxonomy();
    const sections = await refreshShopSections().catch(() => ({ sections: [], section_by_type: {} }));
    return NextResponse.json({
      count: result.taxonomy.length,
      taxonomy_by_type: result.taxonomy_by_type,
      sections: sections.sections,
      section_by_type: sections.section_by_type,
    });
  } catch (error) {
    return failure(error);
  }
}
