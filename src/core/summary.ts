import type { ExportMode, LayerMode, MapMode } from "../domain/manifest.ts";

const CYAN = "\u001B[36m";
const RESET = "\u001B[0m";

export interface ExportSummary {
  project: string;
  mode: ExportMode;
  mapMode: MapMode;
  layerMode: LayerMode;
  mapsProcessed: number;
  collectionsWritten: number;
  featuresWritten: number;
  featuresSkipped: number;
  imagesDownloaded: number;
  duplicatesSkipped: number;
  duplicatesReplaced: number;
}

export function createEmptySummary(
  project: string,
  mode: ExportMode,
  mapMode: MapMode,
  layerMode: LayerMode,
): ExportSummary {
  return {
    project,
    mode,
    mapMode,
    layerMode,
    mapsProcessed: 0,
    collectionsWritten: 0,
    featuresWritten: 0,
    featuresSkipped: 0,
    imagesDownloaded: 0,
    duplicatesSkipped: 0,
    duplicatesReplaced: 0,
  };
}

export function renderExportSummary(summary: ExportSummary): string {
  return [
    formatSummaryLine("Project", summary.project),
    formatSummaryLine("Mode", summary.mode),
    formatSummaryLine("Maps", summary.mapMode),
    formatSummaryLine("Layers", summary.layerMode),
    formatSummaryLine("Maps Processed", summary.mapsProcessed),
    formatSummaryLine("Collections Written", summary.collectionsWritten),
    formatSummaryLine("Features Written", summary.featuresWritten),
    formatSummaryLine("Features Skipped", summary.featuresSkipped),
    formatSummaryLine("Images Downloaded", summary.imagesDownloaded),
    formatSummaryLine("Duplicates Skipped", summary.duplicatesSkipped),
    formatSummaryLine("Duplicates Replaced", summary.duplicatesReplaced),
  ].join("\n");
}

export interface HypeSummary {
  locale: string;
  ok: number;
  error: number;
  skip: number;
}

export function createHypeSummary(
  locale: string,
  rows: Array<Record<string, string>>,
): HypeSummary {
  return rows.reduce<HypeSummary>(
    (summary, row) => {
      if (row.status === "OK") {
        summary.ok += 1;
      } else if (row.status === "ERROR") {
        summary.error += 1;
      } else {
        summary.skip += 1;
      }
      return summary;
    },
    { locale, ok: 0, error: 0, skip: 0 },
  );
}

export function renderHypeSummary(summary: HypeSummary): string {
  return [
    formatSummaryLine("Locale", summary.locale),
    formatSummaryLine("OK", summary.ok),
    formatSummaryLine("ERROR", summary.error),
    formatSummaryLine("SKIP", summary.skip),
  ].join("\n");
}

function formatSummaryLine(key: string, value: string | number): string {
  return `${CYAN}${key}:${RESET} ${value}`;
}
