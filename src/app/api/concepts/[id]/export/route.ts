import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { exportConcept } from "@/lib/export";
import { serializeConcept } from "@/lib/serialize";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const result = await exportConcept(id);
    return NextResponse.json({
      concept: serializeConcept(result.concept),
      folder: result.folder,
      fileCount: result.files.length,
    });
  } catch (error) {
    return failure(error);
  }
}
