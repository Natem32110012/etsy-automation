import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { artDirectorFor } from "@/lib/prompts";
import { avoidList } from "@/lib/store";
import { PACK_PAGE_MAX, PACK_PAGE_MIN, PROMO_COUNT_DEFAULT, isPackType, productTypeSchema } from "@/lib/types";

/**
 * Modele giden metni tek kuruş harcamadan görmek için. Prompt ayarlarken
 * "acaba ne gönderiyoruz" sorusunu deneme üretimi yapmadan cevaplıyor.
 *
 * Örnek: /api/prompts?type=doodle&quantity=2&theme=uzay
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const type = productTypeSchema.parse(params.get("type") ?? "coloring");
    const director = artDirectorFor(type);

    const quantity = Number(params.get("quantity") ?? 1) || 1;
    const theme = params.get("theme");
    const promoCount = Number(params.get("promoCount") ?? PROMO_COUNT_DEFAULT) || PROMO_COUNT_DEFAULT;
    const requestedPages = Number(params.get("pageCount") ?? 1) || 1;
    const pageCount = isPackType(type)
      ? Math.min(PACK_PAGE_MAX, Math.max(PACK_PAGE_MIN, requestedPages))
      : 1;

    return NextResponse.json({
      type,
      conceptPrompt: director.conceptPrompt({
        quantity,
        selectedTheme: theme,
        avoidList: await avoidList(type),
        promoCount,
        pageCount,
      }),
      productRender: director.productRender,
      promoRender: director.promoRender,
      themeDomain: director.themeDomain,
    });
  } catch (error) {
    return failure(error);
  }
}
