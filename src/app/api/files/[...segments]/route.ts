import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { resolveDataPath } from "@/lib/paths";

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".json": "application/json",
  ".md": "text/markdown; charset=utf-8",
};

/**
 * data/ klasörü public değil (gizli kalması ve dev sunucusunu sürekli yeniden
 * derletmemesi için); üretilen görseller UI'a buradan stream ediliyor.
 */
export async function GET(_request: Request, context: { params: Promise<{ segments: string[] }> }) {
  const { segments } = await context.params;
  const target = resolveDataPath(segments);
  if (!target) return NextResponse.json({ error: "Geçersiz yol" }, { status: 400 });

  try {
    const file = await readFile(target);
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Dosya bulunamadı" }, { status: 404 });
  }
}
