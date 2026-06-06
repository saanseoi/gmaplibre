import type { LayeringMode, ExportMode } from "../domain/manifest.ts";

export interface ExportSummary {
  project: string;
  mode: ExportMode;
  layering: LayeringMode;
  mapsProcessed: number;
  collectionsWritten: number;
  featuresWritten: number;
  duplicatesSkipped: number;
  duplicatesReplaced: number;
}

export function createEmptySummary(
  project: string,
  mode: ExportMode,
  layering: LayeringMode,
): ExportSummary {
  return {
    project,
    mode,
    layering,
    mapsProcessed: 0,
    collectionsWritten: 0,
    featuresWritten: 0,
    duplicatesSkipped: 0,
    duplicatesReplaced: 0,
  };
}

export function renderExportSummary(summary: ExportSummary): string {
  return [
    `project: ${summary.project}`,
    `mode: ${summary.mode}`,
    `layering: ${summary.layering}`,
    `maps processed: ${summary.mapsProcessed}`,
    `collections written: ${summary.collectionsWritten}`,
    `features written: ${summary.featuresWritten}`,
    `duplicates skipped: ${summary.duplicatesSkipped}`,
    `duplicates replaced: ${summary.duplicatesReplaced}`,
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
    `locale: ${summary.locale}`,
    `OK: ${summary.ok}`,
    `ERROR: ${summary.error}`,
    `SKIP: ${summary.skip}`,
  ].join("\n");
}
