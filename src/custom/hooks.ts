import type { GenericFeatureCollection } from "../formats/geojson.ts";

export interface HypeHookContext {
  collection: GenericFeatureCollection;
}

export interface HypeHooks {
  isArchivedFromFeature?: (feature: GenericFeatureCollection["features"][number], context: HypeHookContext) => boolean;
  isIntangibleFromFeature?: (feature: GenericFeatureCollection["features"][number], context: HypeHookContext) => boolean;
  isPublishedFromFeature?: (feature: GenericFeatureCollection["features"][number], context: HypeHookContext) => boolean;
  isVisitableFromFeature?: (feature: GenericFeatureCollection["features"][number], context: HypeHookContext) => boolean;
}
