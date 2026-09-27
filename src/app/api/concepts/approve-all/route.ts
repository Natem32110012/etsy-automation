import { NextResponse } from "next/server";
import { z } from "zod";
import { approveAllPending } from "@/lib/concepts";
import { failure } from "@/lib/http";
import { serializeConcept } from "@/lib/serialize";
import { productTypeSchema } from "@/lib/types";

const bodySchema = z.object({ type: productTypeSchema });

export async function POST(request: Request) {
  try {
    const { type } = bodySchema.parse(await request.json());
    const concepts = await approveAllPending(type);
    return NextResponse.json({ concepts: concepts.map(serializeConcept) });
  } catch (error) {
    return failure(error);
  }
}
