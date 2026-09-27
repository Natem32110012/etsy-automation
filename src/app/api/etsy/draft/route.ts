import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/http";
import { getConcept } from "@/lib/store";
import { serializeConcept } from "@/lib/serialize";
import { DEFAULT_QUANTITY, priceFor } from "@/lib/etsy/config";
import { sanitizeEtsyTitle } from "@/lib/types";
import { defaultInfoKeys, INFO_LISTING_IMAGES, PRICE_PRESETS_TRY } from "@/lib/etsy/info-images";
import { matchedSection, refreshShopSections } from "@/lib/etsy/shop";
import { readShopState } from "@/lib/etsy/store";
import {
  createDraftListing,
  defaultFileKeys,
  defaultPhotoKeys,
  listingPhotoPaths,
  orderedPhotoKeys,
  selectedAssetPaths,
} from "@/lib/etsy/listings";

export const maxDuration = 120;

const bodySchema = z.object({
  conceptId: z.string(),
  title: z.string().min(1).max(140),
  description: z.string().min(1),
  tags: z.array(z.string()).max(13),
  price: z.number().positive(),
  quantity: z.number().int().positive(),
  taxonomyId: z.number().int().positive(),
  photoKeys: z.array(z.string()).min(1),
  fileKeys: z.array(z.string()).min(1),
  infoKeys: z.array(z.string()).default([]),
  coverPage: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const concept = await getConcept(body.conceptId);
    if (concept.archived) throw new Error("Archived concepts cannot be listed.");
    if (concept.etsy_listing_id && concept.etsy_listing_state !== "deleted") {
      throw new Error("This product already has an Etsy listing. Open Shop to edit, retry, or reject it.");
    }
    const shop = await readShopState();
    if (!shop.shop_id) throw new Error("Connect Etsy first.");

    const { listing, uploadError } = await createDraftListing({
      concept,
      title: body.title,
      description: body.description,
      tags: body.tags,
      price: body.price,
      quantity: body.quantity,
      taxonomyId: body.taxonomyId,
      photoPaths: listingPhotoPaths(
        concept,
        orderedPhotoKeys(concept, body.photoKeys, body.coverPage),
        body.infoKeys,
      ),
      filePaths: selectedAssetPaths(concept, body.fileKeys),
      coverPage: body.coverPage,
    });

    const updated = await getConcept(concept.id);
    return NextResponse.json({ listing, concept: serializeConcept(updated), uploadError });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(request: Request) {
  try {
    const conceptId = new URL(request.url).searchParams.get("conceptId");
    if (!conceptId) throw new Error("conceptId is required");
    const concept = await getConcept(conceptId);
    let shop = await readShopState();
    if (shop.shop_id && shop.sections.length === 0) {
      await refreshShopSections().catch(() => undefined);
      shop = await readShopState();
    }
    const section = matchedSection(shop, concept.type);
    return NextResponse.json({
      title: sanitizeEtsyTitle(concept.etsy_title),
      description: concept.etsy_description,
      tags: concept.etsy_tags,
      price: concept.etsy_price ?? priceFor(concept.type),
      quantity: concept.etsy_quantity ?? DEFAULT_QUANTITY,
      taxonomyId: concept.etsy_taxonomy_id ?? shop.taxonomy_by_type[concept.type] ?? null,
      photoKeys: defaultPhotoKeys(concept),
      fileKeys: defaultFileKeys(concept),
      infoKeys: defaultInfoKeys(),
      infoImages: INFO_LISTING_IMAGES,
      pricePresets: PRICE_PRESETS_TRY[concept.type] ?? [priceFor(concept.type)],
      shopSection: section,
    });
  } catch (error) {
    return failure(error);
  }
}
