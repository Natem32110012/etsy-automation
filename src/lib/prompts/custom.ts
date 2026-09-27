import { conceptPromptFrame, type ArtDirector } from "./shared";
import type { CustomProductType } from "../custom-types";

export function customArtDirector(spec: CustomProductType): ArtDirector {
  return {
    type: spec.id,
    themeDomain: spec.themeDomain,
    productRender: spec.productRender,
    promoRender: spec.promoRender,
    conceptPrompt: (vars) =>
      conceptPromptFrame({
        role: spec.role,
        vars,
        productImageRules: spec.productImageRules,
        promoSceneRules: spec.promoSceneRules,
        titleKeywords: spec.titleKeywords,
        listingCopy: spec.listingCopy,
      }),
  };
}
