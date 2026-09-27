import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { etsyCredentials, DEFAULT_PRICE_TRY, DEFAULT_QUANTITY } from "@/lib/etsy/config";
import { readTokens, readShopState } from "@/lib/etsy/store";
import { searchTaxonomy } from "@/lib/etsy/taxonomy";

export async function GET(request: Request) {
  try {
    const { apiKey } = etsyCredentials();
    const tokens = await readTokens();
    const shop = await readShopState();
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json({
      ready: Boolean(apiKey),
      connected: Boolean(tokens && shop.shop_id),
      shop_id: shop.shop_id,
      shop_name: shop.shop_name,
      connected_at: shop.connected_at,
      last_snapshot_at: shop.last_snapshot_at,
      redirect_uri: etsyCredentials().redirectUri,
      defaults: { prices: DEFAULT_PRICE_TRY, quantity: DEFAULT_QUANTITY },
      taxonomy_by_type: shop.taxonomy_by_type,
      taxonomy: searchTaxonomy(shop.taxonomy, query, query ? 40 : 30),
      taxonomy_count: shop.taxonomy.length,
    });
  } catch (error) {
    return failure(error, 500);
  }
}
