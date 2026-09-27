import { toPublicPath } from "./paths";
import type { Concept } from "./types";

/**
 * UI dosya sistemine erişemediği için üretimler `/api/files/...` adresiyle
 * gönderiliyor; mutlak yol da hata ayıklama için korunuyor.
 */
export function serializeConcept(concept: Concept) {
  return {
    ...concept,
    images: concept.images.map((slot) => ({
      ...slot,
      generations: slot.generations.map((generation) => ({
        ...generation,
        url: toPublicPath(generation.path),
      })),
    })),
  };
}

export type SerializedConcept = ReturnType<typeof serializeConcept>;
export type SerializedImageSlot = SerializedConcept["images"][number];
export type SerializedGeneration = SerializedImageSlot["generations"][number];
