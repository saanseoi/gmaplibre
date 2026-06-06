import { CliError } from "../core/errors.ts";
import type { FeatureRecord } from "../domain/feature.ts";
import type { LayerRecord } from "../domain/layer.ts";
import type { MapRecord } from "../domain/map.ts";
import { createFeatureId, hashValue, slugify } from "../utils/project.ts";

export interface SourceMapBundle extends MapRecord {}

export async function fetchGoogleMyMapsSource(url: string): Promise<SourceMapBundle> {
  validateGoogleMapUrl(url);

  const mapId = extractMapId(url);
  const title = `map-${mapId}`;
  const layerId = `layer-${mapId}`;
  const feature = createPlaceholderFeature(mapId, layerId, url);
  const layer: LayerRecord = {
    id: layerId,
    mapId,
    name: title,
    features: [feature],
  };

  return {
    id: mapId,
    title,
    originalUrl: url,
    description: "Placeholder map record. KML extraction not yet implemented.",
    layers: [layer],
  };
}

function validateGoogleMapUrl(url: string): void {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("google.com")) {
      throw new CliError(`Unsupported source URL: ${url}`);
    }
  } catch {
    throw new CliError(`Invalid URL: ${url}`);
  }
}

function extractMapId(url: string): string {
  const parsed = new URL(url);
  const mapId = parsed.searchParams.get("mid");
  if (!mapId) {
    throw new CliError(`Google My Maps URL is missing "mid": ${url}`);
  }

  return slugify(mapId);
}

function createPlaceholderFeature(mapId: string, layerId: string, url: string): FeatureRecord {
  const name = `Placeholder ${mapId}`;
  const sourceFeatureKey = hashValue([url, layerId, name, "0", "0"].join("|"));

  return {
    featureId: createFeatureId(),
    mapId,
    layerId,
    name,
    description: "Replace this placeholder once KML extraction is implemented.",
    descriptionRaw: "",
    images: [],
    latitude: 0,
    longitude: 0,
    sourceRef: {
      mapUrl: url,
      sourceFeatureKey,
    },
  };
}
