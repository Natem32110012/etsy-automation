import { NextResponse } from "next/server";
import { z } from "zod";
import { approveConcept, regenerateConcept, rejectConcept } from "@/lib/concepts";
import { failure } from "@/lib/http";
import { serializeConcept } from "@/lib/serialize";

const bodySchema = z.object({ action: z.enum(["approve", "reject", "regenerate"]) });

/** Adım 1'in üç kararı tek route'ta: onayla / reddet / yeniden üret. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const { action } = bodySchema.parse(await request.json());

    const concept =
      action === "approve"
        ? await approveConcept(id)
        : action === "reject"
          ? await rejectConcept(id)
          : await regenerateConcept(id);

    return NextResponse.json({ concept: serializeConcept(concept) });
  } catch (error) {
    return failure(error);
  }
}
