import { NextResponse } from "next/server";
import { z } from "zod";
import { generateConcepts, normalizePageCount, normalizePromoCount } from "@/lib/concepts";
import { failure } from "@/lib/http";
import { serializeConcept } from "@/lib/serialize";
import { listConcepts } from "@/lib/store";
import { conceptStatusSchema, productTypeSchema } from "@/lib/types";

const createSchema = z.object({
  type: productTypeSchema,
  quantity: z.coerce.number().int().min(1).max(1).default(1),
  theme: z.string().nullish(),
  promoCount: z.unknown().optional(),
  pageCount: z.unknown().optional(),
});

export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    const status = params.getAll("status");

    const concepts = await listConcepts({
      type: type ? productTypeSchema.parse(type) : undefined,
      status: status.length > 0 ? status.map((value) => conceptStatusSchema.parse(value)) : undefined,
    });

    return NextResponse.json({
      concepts: concepts.filter((concept) => !concept.archived).map(serializeConcept),
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = createSchema.parse(await request.json());
    const result = await generateConcepts({
      type: body.type,
      quantity: 1,
      theme: body.theme?.trim() ? body.theme.trim() : null,
      promoCount: normalizePromoCount(body.promoCount),
      pageCount: normalizePageCount(body.pageCount),
    });

    return NextResponse.json({
      concepts: result.created.map(serializeConcept),
      missing: result.missing,
    });
  } catch (error) {
    return failure(error);
  }
}
