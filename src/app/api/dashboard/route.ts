import { NextResponse } from "next/server";
import { loadProductType, loadProductTypes } from "@/lib/config";
import { readCustomTypes } from "@/lib/custom-types";
import { failure } from "@/lib/http";
import { readLog } from "@/lib/store";
import { PRODUCT_TYPES, type ConceptStatus } from "@/lib/types";

/** Onaylanmış sayılan durumlar: konsept onayından sonraki her aşama. */
const APPROVED: ConceptStatus[] = [
  "concept_approved",
  "images_pending",
  "images_approved",
  "exported",
  "pinterest_posted",
];

/**
 * Dashboard ek bir veri toplama mekanizması kurmuyor; concepts.json'u okuyup
 * type/status üzerinden grupluyor.
 */
export async function GET() {
  try {
    const [log, configs] = await Promise.all([readLog(), loadProductTypes()]);
    const visible = log.concepts.filter((concept) => !concept.archived);
    const labels: Record<string, string> = {};
    for (const [id, config] of Object.entries(configs)) labels[id] = config.label;
    for (const entry of readCustomTypes()) labels[entry.id] = entry.label;

    const ids = [...PRODUCT_TYPES, ...readCustomTypes().map((entry) => entry.id)];
    const byType = await Promise.all(
      ids.map(async (type) => {
        const all = visible.filter((concept) => concept.type === type);
        const config = configs[type] ?? (await loadProductType(type));
        return {
          id: type,
          label: config.label,
          approved: all.filter((concept) => APPROVED.includes(concept.status)).length,
          rejected: all.filter((concept) => concept.status === "concept_rejected").length,
          pending: all.filter((concept) => concept.status === "concept_pending").length,
          exported: all.filter((concept) => concept.status === "exported").length,
          pinterestPosted: all.filter((concept) => concept.status === "pinterest_posted").length,
        };
      }),
    );

    const rows = visible
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .map((concept) => ({
        id: concept.id,
        title: concept.title,
        etsyTitle: concept.etsy_title,
        type: concept.type,
        typeLabel: labels[concept.type] ?? concept.type,
        status: concept.status,
        theme: concept.theme,
        createdAt: concept.created_at,
        etsyLink: concept.etsy_link,
        etsyListed: concept.etsy_listed,
        folderPath: concept.folder_path,
        pinCount: concept.pinterest_pins.filter((pin) => pin.pin_id).length,
      }));

    return NextResponse.json({
      byType,
      totals: {
        all: visible.length,
        exported: visible.filter((concept) => concept.status === "exported").length,
        pinterestPosted: visible.filter((concept) => concept.status === "pinterest_posted")
          .length,
        etsyListed: visible.filter((concept) => concept.etsy_listed).length,
      },
      rows,
    });
  } catch (error) {
    return failure(error, 500);
  }
}
