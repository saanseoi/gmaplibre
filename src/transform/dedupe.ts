import type { GenericFeature } from "../formats/geojson.ts";
import type { ExportSummary } from "../core/summary.ts";

export type DuplicatePolicy = "replace" | "skip" | "cancel";

export function mergeFeatures(
  existing: GenericFeature[],
  incoming: GenericFeature[],
  policy: Exclude<DuplicatePolicy, "cancel">,
  summary: ExportSummary,
): GenericFeature[] {
  const byKey = new Map(existing.map((feature) => [feature.properties.sourceRef.sourceFeatureKey, feature]));

  for (const feature of incoming) {
    const key = feature.properties.sourceRef.sourceFeatureKey;
    const found = byKey.get(key);

    if (!found) {
      byKey.set(key, feature);
      continue;
    }

    if (policy === "skip") {
      summary.duplicatesSkipped += 1;
      continue;
    }

    byKey.set(key, feature);
    summary.duplicatesReplaced += 1;
  }

  return [...byKey.values()];
}
