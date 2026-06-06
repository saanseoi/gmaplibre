import type { SourceMapBundle } from "../extract/google-mymaps.ts";
import {
  featureToGeoJson,
  type GenericFeatureCollection,
} from "../formats/geojson.ts";
import type { LayerMode, MapMode } from "../domain/manifest.ts";
import { mergeFeatures } from "./dedupe.ts";
import type { DuplicatePolicy } from "./dedupe.ts";
import type { ExportSummary } from "../core/summary.ts";
import { hashValue, slugify } from "../utils/project.ts";

export function computeCollectionWrites(
  project: string,
  sources: SourceMapBundle[],
  mapMode: MapMode,
  layerMode: LayerMode,
): GenericFeatureCollection[] {
  if (mapMode === "combine" && layerMode === "flatten") {
    const features = sources.flatMap((map) =>
      map.layers.flatMap((layer) =>
        layer.features.map((feature) => featureToGeoJson(feature, map.title, layer.name))),
    );

    return [
      {
        type: "FeatureCollection",
        id: project,
        filename: `${project}.geojson`,
        metadata: {
          maps: sources.map((map) => ({
            id: map.id,
            title: map.title,
            description: map.description,
            originalUrl: map.originalUrl,
          })),
        },
        features,
      },
    ];
  }

  const grouped = new Map<string, PendingCollection>();

  for (const map of sources) {
    for (const layer of map.layers) {
      const output = describeCollection(project, map, layer, mapMode, layerMode);
      const existing = grouped.get(output.logicalKey);
      const layerFeatures = layer.features.map((feature) => featureToGeoJson(feature, map.title, layer.name));

      if (!existing) {
        grouped.set(output.logicalKey, {
          logicalKey: output.logicalKey,
          preferredStem: output.preferredStem,
          layerId: output.layerId,
          layerName: output.layerName,
          maps: [mapMetadata(map)],
          features: layerFeatures,
        });
        continue;
      }

      existing.features.push(...layerFeatures);
      mergeCollectionMaps(existing.maps, map);
    }
  }

  return materializeCollections([...grouped.values()]).sort((left, right) => left.filename.localeCompare(right.filename));
}

export function mergeCollectionWrites(
  existing: GenericFeatureCollection[],
  incoming: GenericFeatureCollection[],
  duplicatePolicy: Exclude<DuplicatePolicy, "cancel">,
  summary: ExportSummary,
): GenericFeatureCollection[] {
  const byFilename = new Map(existing.map((collection) => [collection.filename, collection]));

  for (const collection of incoming) {
    const current = byFilename.get(collection.filename);
    if (!current) {
      byFilename.set(collection.filename, collection);
      continue;
    }

    byFilename.set(collection.filename, {
      ...current,
      metadata: mergeCollectionMetadata(current.metadata, collection.metadata),
      features: mergeFeatures(current.features, collection.features, duplicatePolicy, summary),
    });
  }

  const merged = [...byFilename.values()].sort((left, right) => left.filename.localeCompare(right.filename));
  summary.collectionsWritten = merged.length;
  summary.featuresWritten = merged.reduce(
    (count, collection) => count + collection.features.length,
    0,
  );
  return merged;
}

function mergeCollectionMaps(
  maps: Array<{
    id: string;
    title: string;
    description?: string;
    originalUrl: string;
  }>,
  map: SourceMapBundle,
): void {
  if (!maps.some((item) => item.id === map.id)) {
    maps.push(mapMetadata(map));
  }
}

function mapMetadata(map: SourceMapBundle): {
  id: string;
  title: string;
  description?: string;
  originalUrl: string;
} {
  return {
    id: map.id,
    title: map.title,
    description: map.description,
    originalUrl: map.originalUrl,
  };
}

function describeCollection(
  project: string,
  map: SourceMapBundle,
  layer: SourceMapBundle["layers"][number],
  mapMode: MapMode,
  layerMode: LayerMode,
): CollectionDescriptor {
  const mapSlug = slugify(map.title) || map.id;
  const layerSlug = slugify(layer.name) || hashValue(layer.name).slice(0, 10);

  if (mapMode === "combine" && layerMode === "groupByName") {
    return {
      logicalKey: `combine:groupByName:${layer.name}`,
      preferredStem: `${project}-${layerSlug}`,
      layerId: `${project}-${layerSlug}`,
      layerName: layer.name,
    };
  }

  if (mapMode === "keepSeparate" && layerMode === "flatten") {
    return {
      logicalKey: `keepSeparate:flatten:${map.id}`,
      preferredStem: `${project}-${mapSlug}`,
      layerId: `${project}-${mapSlug}`,
      layerName: map.title,
    };
  }

  if (mapMode === "keepSeparate") {
    return {
      logicalKey: `keepSeparate:asIs:${map.id}:${layer.id}`,
      preferredStem: `${project}-${mapSlug}-${layerSlug}`,
      layerId: `${project}-${mapSlug}-${layerSlug}`,
      layerName: layer.name,
    };
  }

  return {
    logicalKey: `combine:asIs:${map.id}:${layer.id}`,
    preferredStem: `${project}-${layerSlug}-${mapSlug}`,
    layerId: `${project}-${layerSlug}-${mapSlug}`,
    layerName: `${layer.name} (${map.title})`,
  };
}

function mergeCollectionMetadata(
  current: GenericFeatureCollection["metadata"],
  incoming: GenericFeatureCollection["metadata"],
): GenericFeatureCollection["metadata"] {
  if (!current) {
    return incoming;
  }

  if (!incoming) {
    return current;
  }

  const maps = readMetadataMaps(current);
  for (const map of readMetadataMaps(incoming)) {
    if (!maps.some((item) => item.id === map.id)) {
      maps.push(map);
    }
  }

  return {
    ...current,
    ...incoming,
    maps,
  };
}

function readMetadataMaps(metadata: GenericFeatureCollection["metadata"]): Array<{
  id: string;
  title: string;
  description?: string;
  originalUrl: string;
}> {
  const value = metadata as {
    maps?: Array<{
      id: string;
      title: string;
      description?: string;
      originalUrl: string;
    }>;
  };
  if (!value.maps) {
    value.maps = [];
  }
  return value.maps;
}

interface CollectionDescriptor {
  logicalKey: string;
  preferredStem: string;
  layerId: string;
  layerName: string;
}

interface PendingCollection {
  logicalKey: string;
  preferredStem: string;
  layerId: string;
  layerName: string;
  maps: Array<{
    id: string;
    title: string;
    description?: string;
    originalUrl: string;
  }>;
  features: GenericFeatureCollection["features"];
}

function materializeCollections(pending: PendingCollection[]): GenericFeatureCollection[] {
  const claimedStems = new Map<string, string>();

  return pending.map((collection) => {
    const stem = ensureUniqueStem(claimedStems, collection.preferredStem, collection.logicalKey);
    return {
      type: "FeatureCollection",
      id: stem,
      filename: `${stem}.geojson`,
      metadata: {
        maps: collection.maps,
        layer: {
          id: collection.layerId,
          name: collection.layerName,
        },
      },
      features: collection.features,
    };
  });
}

function ensureUniqueStem(
  claimedStems: Map<string, string>,
  preferredStem: string,
  logicalKey: string,
): string {
  const existing = claimedStems.get(preferredStem);
  if (!existing) {
    claimedStems.set(preferredStem, logicalKey);
    return preferredStem;
  }

  if (existing === logicalKey) {
    return preferredStem;
  }

  const suffix = hashValue(logicalKey).slice(0, 8);
  const uniqueStem = `${preferredStem}-${suffix}`;
  claimedStems.set(uniqueStem, logicalKey);
  return uniqueStem;
}
