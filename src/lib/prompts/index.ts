import type { ProductType } from "../types";
import { isBuiltinType, type BuiltinProductType } from "../types";
import { readCustomType } from "../custom-types";
import type { ArtDirector } from "./shared";
import { coloringArtDirector } from "./coloring";
import { customArtDirector } from "./custom";
import { doodleArtDirector } from "./doodle";
import { favortagsArtDirector } from "./favortags";
import { invitationArtDirector } from "./invitation";
import { paperdollArtDirector } from "./paperdoll";
import { partyArtDirector } from "./party";
import { plannerArtDirector } from "./planner";
import { adultWallArtDirector, kidsWallArtDirector } from "./wallart";

/**
 * Tipler birbirine karışmasın diye her sanat yönetmeni kendi dosyasında; burada
 * sadece eşleme var. Yeni tip eklemek = yeni dosya + bu haritaya bir satır +
 * config/product-types.json kaydı.
 */
export const ART_DIRECTORS: Record<BuiltinProductType, ArtDirector> = {
  doodle: doodleArtDirector,
  coloring: coloringArtDirector,
  planner: plannerArtDirector,
  invitation: invitationArtDirector,
  party: partyArtDirector,
  paperdoll: paperdollArtDirector,
  favortags: favortagsArtDirector,
  "kids-wall-art": kidsWallArtDirector,
  "adult-wall-art": adultWallArtDirector,
};

export function artDirectorFor(type: ProductType): ArtDirector {
  if (isBuiltinType(type)) return ART_DIRECTORS[type];
  const custom = readCustomType(type);
  if (!custom) throw new Error(`No art director for product type "${type}"`);
  return customArtDirector(custom);
}

export type { ArtDirector, ConceptPromptVars } from "./shared";
export { PRINT_RULES, PROMO_RULES } from "./shared";
export { PAPERDOLL_PRINT_RULES } from "./paperdoll";
