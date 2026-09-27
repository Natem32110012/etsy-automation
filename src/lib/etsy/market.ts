import { readCustomType } from "../custom-types";
import { isBuiltinType, type BuiltinProductType } from "../types";

const TYPE_SEARCH: Record<BuiltinProductType, string> = {
  coloring: "kids coloring pages printable",
  doodle: "kawaii doodle coloring page printable",
  planner: "printable planner page",
  invitation: "printable invitation card",
  party: "printable cupcake toppers",
  paperdoll: "printable paper doll",
  favortags: "printable favor tags",
  "kids-wall-art": "kids wall art printable nursery",
  "adult-wall-art": "printable wall art print",
};

export function themeSearchQuery(type: string, idea?: string | null) {
  const custom = isBuiltinType(type) ? null : readCustomType(type);
  const base = custom?.searchQuery ?? (isBuiltinType(type) ? TYPE_SEARCH[type] : "printable digital download");
  const brief = idea?.trim();
  return (brief ? `${brief} ${base}` : base).slice(0, 140);
}
