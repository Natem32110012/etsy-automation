import { exec } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { conceptDir } from "@/lib/paths";
import { getConcept } from "@/lib/store";
import type { Concept } from "@/lib/types";

async function folderToOpen(concept: Concept) {
  if (concept.folder_path) {
    try {
      await access(concept.folder_path);
      return concept.folder_path;
    } catch {
      /* Export klasörü silinmiş olabilir; üretim klasörüne düş. */
    }
  }

  const dir = conceptDir(concept.id);
  try {
    await access(dir);
    return dir;
  } catch {
    throw new Error("Bu ürünün klasörü henüz yok — önce görsel üret veya export et");
  }
}

/** Finder'da export (varsa) veya üretim klasörünü açar. `scope: "promo"` promo klasörünü açar. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as { scope?: string };
    let folder = await folderToOpen(await getConcept(id));
    if (body.scope === "promo") {
      const promo = path.join(folder, "promo");
      try {
        await access(promo);
        folder = promo;
      } catch {
        /* Promo alt klasörü yoksa ürün klasörü açılır. */
      }
    }

    if (process.platform !== "darwin") {
      return NextResponse.json({ opened: false, folder });
    }

    await new Promise<void>((resolve, reject) => {
      exec(`open ${JSON.stringify(folder)}`, (error) =>
        error ? reject(error) : resolve(),
      );
    });

    return NextResponse.json({ opened: true, folder });
  } catch (error) {
    return failure(error);
  }
}
