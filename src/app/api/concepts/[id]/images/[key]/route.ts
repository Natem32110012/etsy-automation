import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/http";
import { approveSlotImage, generateSlotImage, removeGeneration, removePromoSlot, selectGeneration, setSlotOverlayText } from "@/lib/images";
import { serializeConcept } from "@/lib/serialize";
import { imageQualitySchema } from "@/lib/types";

const bodySchema = z.object({
  action: z.enum(["generate", "approve", "select", "settings", "remove", "drop"]).default("generate"),
  /** "Sahne talimatını düzenleyip yeniden üret" bu alanı gönderiyor. */
  instruction: z.string().nullish(),
  /** Seçili görseli referans alarak küçük düzeltme. */
  revision: z.string().nullish(),
  generationId: z.string().nullish(),
  /** Arayüzdeki kalite seçimi; gelmezse sunucu varsayılanı kullanılır. */
  quality: imageQualitySchema.nullish(),
  overlayText: z.boolean().nullish(),
});

/** Görsel üretimi dakikalar sürebiliyor; platform sınırı varsa tavanı yükseltir. */
export const maxDuration = 800;

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; key: string }> },
) {
  try {
    const { id, key } = await context.params;
    const body = bodySchema.parse(await request.json().catch(() => ({})));

    if (body.action === "approve") {
      const concept = await approveSlotImage(id, key, body.generationId ?? undefined);
      return NextResponse.json({ concept: serializeConcept(concept) });
    }

    if (body.action === "select") {
      if (!body.generationId) throw new Error("generationId gerekli");
      const concept = await selectGeneration(id, key, body.generationId);
      return NextResponse.json({ concept: serializeConcept(concept) });
    }

    if (body.action === "remove") {
      if (!body.generationId) throw new Error("generationId gerekli");
      const concept = await removeGeneration(id, key, body.generationId);
      return NextResponse.json({ concept: serializeConcept(concept) });
    }

    if (body.action === "drop") {
      const concept = await removePromoSlot(id, key);
      return NextResponse.json({ concept: serializeConcept(concept) });
    }

    if (body.action === "settings") {
      if (body.overlayText === undefined || body.overlayText === null) {
        throw new Error("overlayText gerekli");
      }
      const concept = await setSlotOverlayText(id, key, body.overlayText);
      return NextResponse.json({ concept: serializeConcept(concept) });
    }

    const concept = await generateSlotImage(id, key, {
      instruction: body.instruction ?? undefined,
      quality: body.quality ?? undefined,
      revision: body.revision ?? undefined,
      overlayText: body.overlayText ?? undefined,
    });
    return NextResponse.json({ concept: serializeConcept(concept) });
  } catch (error) {
    return failure(error);
  }
}
