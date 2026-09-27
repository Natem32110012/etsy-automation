import { NextResponse } from "next/server";
import { z } from "zod";
import { failure } from "@/lib/http";
import { serializeConcept } from "@/lib/serialize";
import { getConcept, updateConcept } from "@/lib/store";

const patchSchema = z.object({
  etsy_listed: z.boolean().optional(),
  archived: z.boolean().optional(),
  pinterest_shared: z.boolean().optional(),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    return NextResponse.json({ concept: serializeConcept(await getConcept(id)) });
  } catch (error) {
    return failure(error, 404);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = patchSchema.parse(await request.json());
    const concept = await updateConcept(id, (current) => {
      if (body.etsy_listed !== undefined) current.etsy_listed = body.etsy_listed;
      if (body.archived !== undefined) current.archived = body.archived;
      if (body.pinterest_shared !== undefined) current.pinterest_shared = body.pinterest_shared;
    });
    return NextResponse.json({ concept: serializeConcept(concept) });
  } catch (error) {
    return failure(error);
  }
}
