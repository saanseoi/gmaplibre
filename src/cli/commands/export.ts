import { confirm, isCancel, note, spinner } from "@clack/prompts";
import { parseArgs, getStringArrayFlag, getStringFlag } from "../args.ts";
import {
  promptDuplicatePolicy,
  promptLayerMode,
  promptMapMode,
  promptMapUrls,
  promptProjectSelection,
  promptReplaceOrExtend,
} from "../prompts/project.ts";
import { ensureProjectDirs, getProjectPaths, listExistingProjects } from "../../core/paths.ts";
import { CliError } from "../../core/errors.ts";
import {
  createDefaultManifest,
  loadManifest,
  saveManifest,
  type ExportMode,
  type LayerMode,
  type MapMode,
} from "../../domain/manifest.ts";
import { computeCollectionWrites, mergeCollectionWrites } from "../../transform/generic.ts";
import { countFeatureDuplicates } from "../../transform/dedupe.ts";
import {
  loadExistingCollections,
  writeCollections,
  type GenericFeatureCollection,
} from "../../formats/geojson.ts";
import { resolveProjectName } from "../../utils/project.ts";
import { fetchGoogleMyMapsSource } from "../../extract/google-mymaps.ts";
import { createEmptySummary, renderExportSummary } from "../../core/summary.ts";
import type { ImageDownloadProgress } from "../../transform/images.ts";

export async function runExportCommand(argv: string[]): Promise<void> {
  const parsed = parseArgs(argv);
  const existingProjects = await listExistingProjects();
  const project =
    resolveProjectName(getStringFlag(parsed.flags, "project")) ??
    (await promptProjectSelection(existingProjects));

  const paths = getProjectPaths(project);
  await ensureProjectDirs(paths);

  const existingCollections = await loadExistingCollections(paths.mapsDir);
  const existingManifest = await loadManifest(paths.manifestFile);
  const mode =
    normalizeExportMode(getStringFlag(parsed.flags, "mode")) ??
    (await decideMode(existingCollections));

  const sourceUrls = dedupeUrls(
    getStringArrayFlag(parsed.flags, "url").length > 0
      ? getStringArrayFlag(parsed.flags, "url")
      : await promptMapUrls(),
  );

  if (sourceUrls.length === 0) {
    throw new CliError("At least one Google My Maps URL is required.");
  }

  const mapMode =
    normalizeMapMode(getStringFlag(parsed.flags, "map-mode")) ??
    (await decideMapMode(sourceUrls.length));
  const layerMode =
    normalizeLayerMode(getStringFlag(parsed.flags, "layer-mode")) ??
    (await decideLayerMode(mapMode, sourceUrls.length, existingCollections.length));

  const manifest = mode === "replace" || !existingManifest
    ? createDefaultManifest(project)
    : existingManifest;

  const duplicateUrls = sourceUrls.filter((url) => manifest.sourceUrls.includes(url));
  if (duplicateUrls.length > 0) {
    const shouldContinue = await confirm({
      message: `${duplicateUrls.length} source URLs were already imported. Continue and resolve duplicate features later?`,
      initialValue: true,
    });

    if (isCancel(shouldContinue) || !shouldContinue) {
      throw new CliError("Export cancelled.");
    }
  }

  const summary = createEmptySummary(project, mode, mapMode, layerMode);
  const spin = spinner();
  const sources = [];

  spin.start("Resolving source maps");
  for (const url of sourceUrls) {
    spin.message(`Resolving source map ${summary.mapsProcessed + 1}/${sourceUrls.length}`);
    const source = await fetchGoogleMyMapsSource(
      url,
      paths.imagesDir,
      summary,
      (progress) => {
        spin.message(formatImageProgress(progress));
      },
    );
    sources.push(source);
    summary.mapsProcessed += 1;
  }
  spin.stop("Source map metadata resolved");

  const collectionWrites = computeCollectionWrites(project, sources, mapMode, layerMode);
  const collectionsToMerge =
    mode === "extend" ? existingCollections : [];
  const duplicateCount =
    mode === "extend" ? countCollectionDuplicates(collectionsToMerge, collectionWrites) : 0;
  const duplicatePolicy: "replace" | "skip" =
    duplicateCount > 0
      ? await promptDuplicatePolicy(duplicateCount)
      : "skip";
  const mergedCollections = mergeCollectionWrites(
    collectionsToMerge,
    collectionWrites,
    duplicatePolicy,
    summary,
  );

  await writeCollections(paths.mapsDir, mergedCollections);

  for (const source of sources) {
    if (!manifest.sourceUrls.includes(source.originalUrl)) {
      manifest.sourceUrls.push(source.originalUrl);
    }
  }

  manifest.project = project;
  manifest.updatedAt = new Date().toISOString();
  manifest.mode = mode;
  manifest.mapMode = mapMode;
  manifest.layerMode = layerMode;
  manifest.collections = mergedCollections.map((collection) => ({
    id: collection.id,
    filename: collection.filename,
    mapIds: [...new Set(collection.features.map((feature) => feature.properties.mapId))],
    featureCount: collection.features.length,
  }));

  await saveManifest(paths.manifestFile, manifest);

  note(renderExportSummary(summary), "Summary");
}

function normalizeExportMode(value?: string): ExportMode | undefined {
  if (value === "replace" || value === "extend") {
    return value;
  }

  return undefined;
}

function normalizeMapMode(value?: string): MapMode | undefined {
  if (value === "combine" || value === "keepSeparate") {
    return value;
  }

  return undefined;
}

function normalizeLayerMode(value?: string): LayerMode | undefined {
  if (value === "flatten" || value === "groupByName" || value === "asIs") {
    return value;
  }

  return undefined;
}

async function decideMode(
  existingCollections: GenericFeatureCollection[],
): Promise<ExportMode> {
  if (existingCollections.length === 0) {
    return "replace";
  }

  return promptReplaceOrExtend(existingCollections);
}

async function decideMapMode(sourceCount: number): Promise<MapMode> {
  if (sourceCount <= 1) {
    return "combine";
  }

  return promptMapMode();
}

async function decideLayerMode(
  mapMode: MapMode,
  sourceCount: number,
  existingCollectionCount: number,
): Promise<LayerMode> {
  return promptLayerMode(mapMode, sourceCount, existingCollectionCount);
}

function dedupeUrls(urls: string[]): string[] {
  return [...new Set(urls.map((url) => url.trim()).filter(Boolean))];
}

function formatImageProgress(progress: ImageDownloadProgress): string {
  const [current, ...rest] = progress.activeFeatures;
  if (!current) {
    return `Downloading images ${progress.completed}/${progress.total}: Waiting for image downloads`;
  }

  const suffix = rest.length > 0 ? ` + ${rest.length} to go` : "";
  return `Downloading images ${progress.completed}/${progress.total}: ${current.name}${suffix}`;
}

function countCollectionDuplicates(
  existing: GenericFeatureCollection[],
  incoming: GenericFeatureCollection[],
): number {
  const existingByFilename = new Map(existing.map((collection) => [collection.filename, collection]));

  return incoming.reduce((count, collection) => {
    const current = existingByFilename.get(collection.filename);
    if (!current) {
      return count;
    }

    return count + countFeatureDuplicates(current.features, collection.features);
  }, 0);
}
