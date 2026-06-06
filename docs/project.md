```sh
gmaplibre/
├─ src/
│  ├─ cli/
│  │  ├─ index.ts              # entrypoint for `gmaplibre`
│  │  ├─ commands/
│  │  │  ├─ export.ts          # default generic export flow
│  │  │  └─ hype.ts            # `gmaplibre hype`
│  │  └─ prompts/
│  │     ├─ project.ts
│  │     ├─ maps.ts
│  │     ├─ locale.ts
│  │     └─ hype-user.ts
│  ├─ core/
│  │  ├─ config.ts
│  │  ├─ paths.ts
│  │  ├─ errors.ts
│  │  ├─ logging.ts
│  │  └─ summary.ts
│  ├─ extract/
│  │  ├─ google-mymaps.ts      # resolve source URL -> KML/KMZ or fail clearly
│  │  ├─ kml.ts                # unzip/read/parse KML/KMZ
│  │  └─ folders.ts            # KML Folder/Document -> layer/file strategy
│  ├─ transform/
│  │  ├─ generic.ts            # KML -> internal model -> GeoJSON
│  │  ├─ description.ts        # parse HTML, strip images, keep raw
│  │  ├─ images.ts             # download/store images
│  │  ├─ dedupe.ts             # decide replace/skip behavior during extend
│  │  └─ hype.ts               # internal model/GeoJSON -> HYPE CSV rows
│  ├─ formats/
│  │  ├─ geojson.ts
│  │  ├─ csv.ts
│  │  └─ kml-types.ts
│  ├─ custom/
│  │  ├─ loader.ts             # loads project hooks from `/custom/{project}`
│  │  └─ hooks.ts              # hook type definitions
│  ├─ domain/
│  │  ├─ map.ts
│  │  ├─ layer.ts
│  │  ├─ feature.ts
│  │  └─ hype.ts
│  └─ utils/
│     ├─ fs.ts
│     ├─ html.ts
│     ├─ ids.ts
│     └─ locale.ts
├─ custom/
│  └─ {project}/
│     ├─ generic.ts            # optional project overrides
│     └─ hype.ts               # optional project overrides
├─ export/
│  └─ {project}/
│     ├─ {collection}.geojson
│     ├─ ...
│     ├─ images/
│     │  ├─ {featureId}-00.jpg
│     │  └─ ...
│     ├─ hype/
│     │  └─ {locale}.csv
│     └─ manifest.json         # run metadata, source URLs, counts, timestamps, duplicate-handling history
├─ docs/
├─ package.json
├─ tsconfig.json
└─ bun.lock
```
