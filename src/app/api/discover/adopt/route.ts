import { NextResponse } from "next/server";
import { z } from "zod";
import { adoptListing } from "@/lib/discover";
import { ensureShopSection, shopSectionTitle } from "@/lib/etsy/shop";
import { failure } from "@/lib/http";

export const maxDuration = 120;

const bodySchema = z.object({
  name: z.string().min(1),
  page: z.string().min(1),
  buyer: z.string().min(1),
  priceTry: z.number().positive(),
  listingId: z.number().int().positive(),
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  url: z.string().default(""),
  price: z.number().nullable().optional(),
  currency: z.string().nullable().optional(),
  description: z.string().default(""),
});

export async function POST(request: Request) {
  try {
    const body = bodySchema.parse(await request.json());
    const type = await adoptListing({
      name: body.name,
      page: body.page,
      buyer: body.buyer,
      priceTry: body.priceTry,
      listing: {
        listingId: body.listingId,
        title: body.title,
        tags: body.tags,
        url: body.url || `https://www.etsy.com/listing/${body.listingId}`,
        price: body.price ?? null,
        currency: body.currency ?? null,
        description: body.description,
      },
    });
    const section = await ensureShopSection(type.id, shopSectionTitle(type.label, type.sectionHints));
    return NextResponse.json({
      type: {
        id: type.id,
        label: type.label,
        themeDomain: type.themeDomain,
        priceTry: type.priceTry,
        print: type.print,
        sourceTitle: type.sourceTitle,
        productImageRules: type.productImageRules,
        sectionTitle: section.ok ? section.title : null,
        sectionCreated: section.ok ? section.created : false,
        sectionError: section.ok ? null : section.error,
      },
    });
  } catch (error) {
    return failure(error);
  }
}
