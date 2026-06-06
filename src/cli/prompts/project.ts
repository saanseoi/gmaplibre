import {
  group,
  isCancel,
  select,
  text,
} from "@clack/prompts";
import { styleText } from "node:util";
import { CliError } from "../../core/errors.ts";
import type { ExportMode, LayerMode, MapMode } from "../../domain/manifest.ts";
import type { GenericFeatureCollection } from "../../formats/geojson.ts";
import { resolveProjectName } from "../../utils/project.ts";

export async function promptProjectSelection(existingProjects: string[]): Promise<string> {
  if (existingProjects.length > 0) {
    const project = await select({
      message: "Select a project or choose new",
      options: [
        { value: "__new__", label: "New project" },
        ...existingProjects.map((value) => ({ value, label: value })),
      ],
    });

    if (isCancel(project)) {
      throw new CliError("Project selection cancelled.");
    }

    if (project !== "__new__") {
      return project;
    }
  }

  const name = await text({
    message: "Project name",
    placeholder: "cityrecorder-neon",
    validate(value) {
      return resolveProjectName(value) ? undefined : "Use lowercase letters, numbers, and dashes.";
    },
  });

  if (isCancel(name)) {
    throw new CliError("Project selection cancelled.");
  }

  return resolveProjectName(name)!;
}

export async function promptReplaceOrExtend(
  existingCollections: GenericFeatureCollection[],
): Promise<ExportMode> {
  const collectionLabel = formatCollectionSummary(existingCollections);
  const mode = await select({
    message: `Existing GeoJSON export found:\n\n${collectionLabel}\n\nReplace it or extend it?`,
    options: [
      { value: "replace", label: "Replace" },
      { value: "extend", label: "Extend" },
    ],
  });

  if (isCancel(mode)) {
    throw new CliError("Export cancelled.");
  }

  return mode;
}

export async function promptMapMode(): Promise<MapMode> {
  const mode = await select({
    message: "How should multiple maps in this project be handled?",
    options: [
      { value: "combine", label: "Combine maps", hint: "Distinct Google Maps can contribute to the same GeoJSON" },
      { value: "keepSeparate", label: "Keep maps separate", hint: "Each Google Map keeps its own GeoJSON" },
    ],
  });

  if (isCancel(mode)) {
    throw new CliError("Export cancelled.");
  }

  return mode;
}

export async function promptLayerMode(
  mapMode: MapMode,
  sourceCount: number,
  existingCollectionCount: number,
): Promise<LayerMode> {
  const shouldOfferCombinedLayerModes = mapMode === "combine" &&
    (sourceCount > 1 || existingCollectionCount > 1);
  const options: Array<{ value: LayerMode; label: string; hint: string }> = !shouldOfferCombinedLayerModes
    ? [
      {
        value: "flatten",
        label: "Flatten layers into one file",
        hint: "All layers will be combined into one GeoJSON file.",
      },
      {
        value: "asIs",
        label: "Leave layers as-is",
        hint: "Each top-level layer becomes its own GeoJSON file.",
      },
    ]
    : mapMode === "combine"
    ? [
      {
        value: "flatten",
        label: "Flatten layers",
        hint: "All layers will be combined into a single layer",
      },
      {
        value: "groupByName",
        label: "Combine layers with same name",
        hint: "Only merge layers when their names are identical across maps",
      },
      {
        value: "asIs",
        label: "Leave layers untouched",
        hint: "All layers remain intact; duplicate layer names get a map-title suffix",
      },
    ]
    : [
      {
        value: "flatten",
        label: "Keep maps separate, Flatten layers",
        hint: "Each map becomes one GeoJSON file with all of its layers combined.",
      },
      {
        value: "asIs",
        label: "Keep maps separate, Leave layers as-is",
        hint: "Each map-layer pair becomes its own GeoJSON file.",
      },
    ];
  const mode = await select({
    message: "How should layers be written?",
    options,
  });

  if (isCancel(mode)) {
    throw new CliError("Export cancelled.");
  }

  return mode as LayerMode;
}

export async function promptMapUrls(): Promise<string[]> {
  const urls = await text({
    message: "Google My Maps URLs",
    placeholder: "Paste one or more URLs separated by commas",
    validate(value) {
      const items = (value ?? "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);
      return items.length > 0 ? undefined : "At least one URL is required.";
    },
  });

  if (isCancel(urls)) {
    throw new CliError("Export cancelled.");
  }

  return urls
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export async function promptDuplicatePolicy(duplicateCount: number): Promise<"replace" | "skip"> {
  const value = await select({
    message: `${duplicateCount} duplicate features were found. How should they be handled?`,
    options: [
      { value: "replace", label: "Replace duplicate features" },
      { value: "skip", label: "Skip duplicate features" },
      { value: "cancel", label: "Cancel" },
    ],
  });

  if (isCancel(value) || value === "cancel") {
    throw new CliError("Export cancelled.");
  }

  return value;
}

export async function promptLocale(): Promise<string> {
  const locale = await select({
    message: "Select locale",
    options: [
      { value: "en", label: "en" },
      { value: "zh-hant", label: "zh-hant" },
      { value: "zh-hans", label: "zh-hans" },
      { value: "__other__", label: "other" },
    ],
  });

  if (isCancel(locale)) {
    throw new CliError("HYPE export cancelled.");
  }

  if (locale !== "__other__") {
    return locale;
  }

  const customLocale = await text({
    message: "Locale code",
    placeholder: "fr",
    validate(value) {
      return (value ?? "").trim() ? undefined : "Locale is required.";
    },
  });

  if (isCancel(customLocale)) {
    throw new CliError("HYPE export cancelled.");
  }

  return customLocale.trim();
}

export async function promptHypeUser(): Promise<{ email: string; id: string }> {
  const values = await group(
    {
      email: () =>
        text({
          message: "HYPE user email",
          validate(value) {
            return (value ?? "").includes("@") ? undefined : "Enter a valid email.";
          },
        }),
      id: () =>
        text({
          message: "HYPE user ID",
          validate(value) {
            return (value ?? "").trim() ? undefined : "User ID is required.";
          },
        }),
    },
    {
      onCancel() {
        throw new CliError("HYPE export cancelled.");
      },
    },
  );

  return {
    email: values.email.trim(),
    id: values.id.trim(),
  };
}

function formatCollectionSummary(existingCollections: GenericFeatureCollection[]): string {
  return existingCollections
    .map((collection) => formatCollectionLabel(collection))
    .join("\n");
}

function formatMapTitles(collection: GenericFeatureCollection): string {
  const metadata = collection.metadata as {
    maps?: Array<{ title?: string }>;
    map?: { title?: string };
  } | undefined;
  const titles = [
    ...(metadata?.maps?.flatMap((map) => {
      const title = map.title?.trim();
      return title ? [title] : [];
    }) ?? []),
    ...(metadata?.map?.title?.trim() ? [metadata.map.title.trim()] : []),
  ];
  const uniqueTitles = [...new Set(titles)];
  return uniqueTitles.length > 0 ? humanJoin(uniqueTitles) : "Untitled map";
}

function humanJoin(values: string[]): string {
  if (values.length <= 1) {
    return values[0] ?? "";
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`;
  }

  return `${values.slice(0, -1).join(", ")}, and ${values[values.length - 1]}`;
}

function formatCollectionLabel(collection: GenericFeatureCollection): string {
  const mapName = formatMapTitles(collection);
  const layerName = formatLayerName(collection);
  const featureCount = String(collection.features.length);
  return `${styleText("red", mapName.trim())}: ${styleText("yellow", layerName.trim())} ${
    styleText("gray", "(")
  }${styleText("white", featureCount)}${styleText("gray", " features)")}`;
}

function formatLayerName(collection: GenericFeatureCollection): string {
  const metadata = collection.metadata as {
    layer?: { name?: string };
  } | undefined;
  const name = metadata?.layer?.name?.trim();
  return name || "Untitled layer";
}
