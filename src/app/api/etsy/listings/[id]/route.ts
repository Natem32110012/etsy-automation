import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/http";
import { getConcept, listConcepts, updateConcept } from "@/lib/store";
import { listingUrl } from "@/lib/etsy/config";
import { sanitizeEtsyTitle } from "@/lib/types";
import { deleteListing, publishListing, retryListingUploads, updateDraftListing } from "@/lib/etsy/listings";
import { serializeConcept } from "@/lib/serialize";

const bodySchema = z.object({
  action: z.enum(["publish", "save", "reject", "retry", "dismiss"]),
  title: z.string().max(140).optional(),
  description: z.string().optional(),
  tags: z.array(z.string()).optional(),
  price: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
  taxonomyId: z.number().int().positive().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const listingId = Number((await context.params).id);
    if (!Number.isFinite(listingId)) throw new Error("Invalid listing id");
    const body = bodySchema.parse(await request.json());
    const concept = (await listConcepts()).find((entry) => entry.etsy_listing_id === listingId);
    if (!concept) throw new Error("No local product is linked to this listing.");

    if (body.action === "save") {
      await updateDraftListing({
        listingId,
        title: body.title,
        description: body.description,
        tags: body.tags,
        price: body.price,
        quantity: body.quantity,
        taxonomyId: body.taxonomyId,
      });
      const updated = await updateConcept(concept.id, (current) => {
        if (body.title) current.etsy_title = sanitizeEtsyTitle(body.title);
        if (body.description) current.etsy_description = body.description;
        if (body.tags) current.etsy_tags = body.tags;
        if (body.price !== undefined) current.etsy_price = body.price;
        if (body.quantity !== undefined) current.etsy_quantity = body.quantity;
        if (body.taxonomyId !== undefined) current.etsy_taxonomy_id = body.taxonomyId;
        current.etsy_listing_error = null;
      });
      return NextResponse.json({ concept: serializeConcept(updated) });
    }

    if (body.action === "dismiss") {
      const updated = await updateConcept(concept.id, (current) => {
        current.etsy_listing_state = "active";
        current.etsy_listed = true;
        current.etsy_listing_error = null;
      });
      return NextResponse.json({ concept: serializeConcept(updated) });
    }

    if (body.action === "reject") {
      await deleteListing(listingId);
      const updated = await updateConcept(concept.id, (current) => {
        current.etsy_listing_state = "deleted";
        current.etsy_listing_error = null;
        current.etsy_listed = false;
      });
      return NextResponse.json({ concept: serializeConcept(updated) });
    }

    if (body.action === "retry") {
      await retryListingUploads(concept, listingId);
      const updated = await updateConcept(concept.id, (current) => {
        current.etsy_listing_state = "draft";
        current.etsy_listing_error = null;
      });
      return NextResponse.json({ concept: serializeConcept(updated) });
    }

    const listing = await publishListing(listingId);
    const updated = await updateConcept(concept.id, (current) => {
      current.etsy_listing_state = "active";
      current.etsy_listed = true;
      current.etsy_listing_error = null;
      current.etsy_link = listing.url ?? listingUrl(listingId);
    });
    return NextResponse.json({ concept: serializeConcept(updated), listing });
  } catch (error) {
    return failure(error);
  }
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const listingId = Number((await context.params).id);
    const concept = (await listConcepts()).find((entry) => entry.etsy_listing_id === listingId);
    if (!concept) throw new Error("Listing not found locally");
    return NextResponse.json({ concept: serializeConcept(await getConcept(concept.id)) });
  } catch (error) {
    return failure(error);
  }
}
