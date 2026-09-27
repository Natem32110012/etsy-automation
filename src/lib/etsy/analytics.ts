import { updateShopState, readShopState } from "./store";
import { etsyGet } from "./client";
import { getShopListings } from "./listings";

type Receipt = {
  receipt_id?: number;
  created_timestamp?: number;
  grandtotal?: { amount?: number; divisor?: number } | number;
  transactions?: Array<{ listing_id?: number; quantity?: number; price?: { amount?: number; divisor?: number } | number }>;
};

function money(value: { amount?: number; divisor?: number } | number | undefined) {
  if (typeof value === "number") return value;
  if (!value || typeof value.amount !== "number") return 0;
  return value.amount / (value.divisor || 100);
}

export async function runDailySnapshot() {
  const listings = await getShopListings();
  const salesByListing = new Map<number, { sales: number; revenue: number }>();

  try {
  const shop = await readShopState();
    if (shop.shop_id) {
      const receipts = await etsyGet<{ results?: Receipt[] }>(
        `/application/shops/${shop.shop_id}/receipts`,
        { limit: 100, was_paid: "true", includes: "Transactions" },
      );
      for (const receipt of receipts.results ?? []) {
        for (const tx of receipt.transactions ?? []) {
          if (!tx.listing_id) continue;
          const current = salesByListing.get(tx.listing_id) ?? { sales: 0, revenue: 0 };
          current.sales += tx.quantity ?? 1;
          current.revenue += money(tx.price) * (tx.quantity ?? 1);
          salesByListing.set(tx.listing_id, current);
        }
      }
    }
  } catch {
    // Receipts are optional; listing views still snapshot.
  }

  const date = new Date().toISOString().slice(0, 10);
  await updateShopState((state) => {
    state.last_snapshot_at = new Date().toISOString();
    state.snapshots = state.snapshots.filter((row) => row.date !== date);
    for (const listing of listings) {
      const listingId = Number(listing.listing_id);
      const sales = salesByListing.get(listingId) ?? { sales: 0, revenue: 0 };
      state.snapshots.push({
        date,
        listing_id: listingId,
        views: Number(listing.views ?? 0),
        num_favorers: Number(listing.num_favorers ?? 0),
        quantity: Number(listing.quantity ?? 0),
        price: money(listing.price as { amount?: number; divisor?: number } | number | undefined),
        state: String(listing.state ?? ""),
        sales: sales.sales,
        revenue: sales.revenue,
      });
    }
  });

  return { date, count: listings.length };
}
