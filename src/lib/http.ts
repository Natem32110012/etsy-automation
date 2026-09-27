import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function failure(error: unknown, status = 400) {
  if (error instanceof ZodError) {
    return NextResponse.json({ error: "Geçersiz istek", details: error.issues }, { status: 422 });
  }
  const message = error instanceof Error ? error.message : String(error);
  console.error("[api]", message);
  return NextResponse.json({ error: message }, { status });
}
