import { readCustomTypes } from "../custom-types";
import { etsyGet } from "./client";
import { TAXONOMY_HINTS } from "./config";
import { updateShopState, type TaxonomyNode } from "./store";
import type { BuiltinProductType } from "../types";

type TaxonomyTreeNode = {
  id: number;
  name: string;
  children?: TaxonomyTreeNode[];
};

type TaxonomyResponse = { results?: TaxonomyTreeNode[] };

function flatten(nodes: TaxonomyTreeNode[] | undefined, parents: string[] = []): TaxonomyNode[] {
  if (!nodes) return [];
  const rows: TaxonomyNode[] = [];
  for (const node of nodes) {
    const path = [...parents, node.name];
    rows.push({ id: node.id, name: node.name, path: path.join(" > ") });
    rows.push(...flatten(node.children, path));
  }
  return rows;
}

export async function refreshTaxonomy() {
  const data = await etsyGet<TaxonomyResponse>("/application/seller-taxonomy/nodes");
  const taxonomy = flatten(data.results);
  const taxonomy_by_type: Record<string, number> = {};
  const hintGroups: Array<[string, string[]]> = [
    ...(Object.entries(TAXONOMY_HINTS) as [BuiltinProductType, string[]][]),
    ...readCustomTypes().map((entry) => [entry.id, entry.taxonomyHints] as [string, string[]]),
  ];
  for (const [type, hints] of hintGroups) {
    const match = matchTaxonomy(taxonomy, hints);
    if (match) taxonomy_by_type[type] = match.id;
  }
  await updateShopState((state) => {
    state.taxonomy = taxonomy;
    state.taxonomy_by_type = { ...state.taxonomy_by_type, ...taxonomy_by_type };
  });
  return { taxonomy, taxonomy_by_type };
}

/** Exact path, then exact name, then the leaf name. A missing path must not stick to a parent. */
export function matchTaxonomy(nodes: TaxonomyNode[], hints: string[]): TaxonomyNode | undefined {
  for (const hint of hints) {
    const q = hint.trim().toLowerCase();
    if (!q) continue;
    const exactPath = nodes.find((node) => node.path.toLowerCase() === q);
    if (exactPath) return exactPath;
    const exactName = nodes.find((node) => node.name.toLowerCase() === q);
    if (exactName) return exactName;
    const leaf = q.split(">").pop()?.trim();
    if (leaf && leaf !== q) {
      const byLeaf = nodes.find((node) => node.name.toLowerCase() === leaf);
      if (byLeaf) return byLeaf;
    }
  }
  return undefined;
}

export function searchTaxonomy(
  nodes: TaxonomyNode[],
  query: string,
  limit = 40,
  selectedId?: number | null,
) {
  const q = query.trim().toLowerCase();
  const hits = q
    ? nodes.filter((node) => node.path.toLowerCase().includes(q)).slice(0, limit)
    : nodes.slice(0, limit);
  if (selectedId == null) return hits;
  const selected = nodes.find((node) => node.id === selectedId);
  if (!selected || hits.some((node) => node.id === selected.id)) return hits;
  return [selected, ...hits].slice(0, limit);
}
