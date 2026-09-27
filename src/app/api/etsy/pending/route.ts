import { NextResponse } from "next/server";
import { failure } from "@/lib/http";
import { listConcepts } from "@/lib/store";
import { serializeConcept } from "@/lib/serialize";
import { toPublicPath } from "@/lib/paths";
import { productSlots } from "@/lib/types";
import { listingEditorUrl } from "@/lib/etsy/config";

export async function GET() {
  try {
    const concepts = (await listConcepts()).filter(
      (concept) =>
        !concept.archived &&
        (concept.etsy_listing_state === "draft" || concept.etsy_listing_state === "failed"),
    );
    return NextResponse.json({
      concepts: concepts.map((concept) => {
        const serialized = serializeConcept(concept);
        const photos = concept.images
          .filter((slot) => slot.kind === "promo" && slot.status === "approved")
          .map((slot) => {
            const chosen = slot.generations.find((g) => g.id === slot.selected_generation_id);
            return chosen ? toPublicPath(chosen.path) : null;
          })
          .filter(Boolean);
        return {
          ...serialized,
          preview: photos[0] ?? null,
          photoCount: photos.length,
          fileCount: productSlots(concept.images).length,
          editorUrl: concept.etsy_listing_id ? listingEditorUrl(concept.etsy_listing_id) : null,
        };
      }),
    });
  } catch (error) {
    return failure(error, 500);
  }
}
