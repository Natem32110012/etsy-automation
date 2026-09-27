import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/http";
import { generatePinterestCopy, publishToPinterest } from "@/lib/pinterest";
import { serializeConcept } from "@/lib/serialize";

const bodySchema = z.object({
  action: z.enum(["publish", "copy"]).default("publish"),
  etsyLink: z.string().nullish(),
  /** Pin atılacak promo slotları; boş gelirse ilk onaylı promo kullanılır. */
  imageKeys: z.array(z.string()).default([]),
});

export const maxDuration = 800;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    if (body.action === "copy") {
      const concept = await generatePinterestCopy(id);
      return NextResponse.json({ concept: serializeConcept(concept) });
    }

    if (!body.etsyLink) throw new Error("Etsy linki gerekli");

    const result = await publishToPinterest(id, {
      etsyLink: body.etsyLink,
      imageKeys: body.imageKeys,
    });

    return NextResponse.json({
      concept: serializeConcept(result.concept),
      pins: result.pins,
      dryRun: result.dryRun,
      reason: result.reason,
    });
  } catch (error) {
    return failure(error);
  }
}
