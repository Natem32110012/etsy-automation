import { NextResponse } from "next/server";
import { boardIdFor, loadProductType, loadProductTypes } from "@/lib/config";
import { readCustomTypes } from "@/lib/custom-types";
import { failure } from "@/lib/http";
import { hasPinterestToken } from "@/lib/pinterest";
import { hasToken } from "@/lib/replicate";
import { PRODUCT_TYPES } from "@/lib/types";

export async function GET() {
  try {
    const configs = await loadProductTypes();
    const ids = [...PRODUCT_TYPES, ...readCustomTypes().map((entry) => entry.id)];
    const types = await Promise.all(
      ids.map(async (type) => {
        const config = configs[type] ?? (await loadProductType(type));
        return {
          id: type,
          label: config.label,
          print: config.print,
          boardEnv: config.boardEnv,
          boardReady: Boolean(boardIdFor(config)),
        };
      }),
    );
    return NextResponse.json({
      types,
      replicateReady: hasToken(),
      pinterestReady: hasPinterestToken(),
    });
  } catch (error) {
    return failure(error, 500);
  }
}
