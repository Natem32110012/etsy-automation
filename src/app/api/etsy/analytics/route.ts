import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { runDailySnapshot } from "@/lib/etsy/analytics";
import { getShopListings } from "@/lib/etsy/listings";
import { readShopState } from "@/lib/etsy/store";
import { listConcepts } from "@/lib/store";

export const maxDuration = 120;

export async function POST() {
  try {
    const result = await runDailySnapshot();
    return NextResponse.json(result);
  } catch (error) {
    return failure(error);
  }
}

export async function GET() {
  try {
    const shop = await readShopState();
    const local = await listConcepts();
    const byListing = new Map(local.filter((c) => c.etsy_listing_id).map((c) => [c.etsy_listing_id!, c]));
    let live: Array<Record<string, unknown>> = [];
    if (shop.shop_id) {
      try {
        live = await getShopListings();
      } catch {
        live = [];
      }
    }

    const snapshots = shop.snapshots;
    const latestDate = snapshots.reduce((max, row) => (row.date > max ? row.date : max), "");
    const today = snapshots.filter((row) => row.date === latestDate);
    const previousDate = snapshots
      .map((row) => row.date)
      .filter((date) => date !== latestDate)
      .sort()
      .at(-1);
    const previous = snapshots.filter((row) => row.date === previousDate);

    const rows = live.map((listing) => {
      const listingId = Number(listing.listing_id);
      const concept = byListing.get(listingId);
      const snap = today.find((row) => row.listing_id === listingId);
      const before = previous.find((row) => row.listing_id === listingId);
      const price =
        typeof listing.price === "object" && listing.price && "amount" in listing.price
          ? Number((listing.price as { amount: number; divisor?: number }).amount) /
            ((listing.price as { divisor?: number }).divisor || 100)
          : Number(listing.price ?? 0);
      return {
        listing_id: listingId,
        title: String(listing.title ?? concept?.etsy_title ?? ""),
        state: String(listing.state ?? ""),
        views: Number(listing.views ?? snap?.views ?? 0),
        views_delta: Number(listing.views ?? 0) - (before?.views ?? 0),
        num_favorers: Number(listing.num_favorers ?? snap?.num_favorers ?? 0),
        quantity: Number(listing.quantity ?? snap?.quantity ?? 0),
        price,
        created: listing.created_timestamp
          ? new Date(Number(listing.created_timestamp) * 1000).toISOString()
          : concept?.created_at ?? null,
        concept_id: concept?.id ?? null,
        type: concept?.type ?? null,
        url: concept?.etsy_link ?? `https://www.etsy.com/listing/${listingId}`,
        sales: snap?.sales ?? 0,
        revenue: snap?.revenue ?? 0,
      };
    });

    const totals = {
      listings: rows.length,
      active: rows.filter((row) => row.state === "active").length,
      draft: rows.filter((row) => row.state === "draft").length,
      views: rows.reduce((sum, row) => sum + row.views, 0),
      favorites: rows.reduce((sum, row) => sum + row.num_favorers, 0),
      orders: today.reduce((sum, row) => sum + row.sales, 0),
      revenue: today.reduce((sum, row) => sum + row.revenue, 0),
    };
    const aov = totals.orders > 0 ? totals.revenue / totals.orders : 0;

    const trend = [...new Set(snapshots.map((row) => row.date))]
      .sort()
      .slice(-30)
      .map((date) => {
        const slice = snapshots.filter((row) => row.date === date);
        return {
          date,
          views: slice.reduce((sum, row) => sum + row.views, 0),
          favorites: slice.reduce((sum, row) => sum + row.num_favorers, 0),
          revenue: slice.reduce((sum, row) => sum + row.revenue, 0),
        };
      });

    return NextResponse.json({
      last_snapshot_at: shop.last_snapshot_at,
      totals: { ...totals, aov },
      rows,
      trend,
      top_views: [...rows].sort((a, b) => b.views - a.views).slice(0, 8),
      top_sales: [...rows].sort((a, b) => b.sales - a.sales).slice(0, 8),
      by_type: Object.entries(
        rows.reduce<Record<string, { type: string; views: number; sales: number; revenue: number }>>(
          (acc, row) => {
            const type = row.type ?? "unlinked";
            if (!acc[type]) acc[type] = { type, views: 0, sales: 0, revenue: 0 };
            acc[type].views += row.views;
            acc[type].sales += row.sales;
            acc[type].revenue += row.revenue;
            return acc;
          },
          {},
        ),
      ).map(([, value]) => value),
    });
  } catch (error) {
    return failure(error, 500);
  }
}
