// Helpers for writing catalog entries.

import type { Connections } from "../../model/types";
import type { CatalogEntry, Variant } from "../types";

/**
 * An entry whose connection values come from its variants: `connections` is what `of` gives the
 * default variant (the default width and the first energy), so the two never disagree.
 */
export function withVariants(e: Omit<CatalogEntry, "connections" | "variantConnections">, of: (v: Variant) => Connections): CatalogEntry {
  return { ...e, variantConnections: of, connections: of({ width: e.width, energy: e.energy?.[0] }) };
}
