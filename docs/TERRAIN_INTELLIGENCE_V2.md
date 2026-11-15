# Terrain Intelligence V2 — Interactive profile

## What it does

The interactive elevation profile links the **active manual route** to a **numeric digital elevation model (DEM)**. In **Science → Terrain → DEM Route Lab**, load the bundled Jezero elevation clip or import a supported numeric DEM JSON file. The profile draws an elevation chart and reports:

- Minimum and maximum elevation at sampled locations, in meters, using the selected DEM vertical reference.
- Partial or complete sampled ascent/descent along the user-defined polyline.
- Number and approximate percentage of sampling locations with real numerical elevation values.
- Elevation and elevation change at individual waypoints.
- **Mean grade between consecutive waypoint elevations**, calculated as vertical height change / Mars spherical surface distance × 100%. Positive means rising towards the next waypoint; negative means falling.

Use the graph cursor, its keyboard-accessible range slider, or a waypoint row to select a sample. A small highlighted probe appears at that sample's actual Mars coordinate on the map. **Locate on Mars map** centers that location. **Clear marker** removes the temporary probe. Nothing is added to the mission or saved when you inspect a sample.

## Where the numbers come from

The project already has a documented USGS/NASA CTX terrain clip, approximately 18.438–18.470° N and 77.443–77.478° E; the bundled file reports source and vertical datum information. Elevation samples are read from the nearest valid DEM grid cell, *not* inferred from brightness or color of NASA imagery.

The sampling method follows straight-line interpolation in planetocentric latitude/longitude between manually placed route vertices, and distances use a spherical Mars model (radius 3,396,190 m). The nearest-grid-cell method is not a continuous or high-accuracy surface reconstruction.

Only adjacent **known** samples contribute to the reported ascent/descent. The plot breaks across NoData and outside-grid intervals instead of inventing heights. In partial coverage, cumulative ascent/descent are incomplete, and the data-coverage percentage describes sampled positions rather than area coverage. Mean waypoint-to-waypoint grade must **not** be interpreted as the maximum local slope, safe traverse grade or rock/soil traction.

## How this relates to the existing tools

Terrain Intelligence V2 complements the existing **Slope & Roughness**, **Haar analysis**, **Line of Sight**, **Reachability** and **A*** labs. It adds accessible visual selection and exact link to the map, rather than replacing those mathematical modules.

Inspecting data never changes route geometry or source images. The highlighted point is purely presentational; only manual waypoint editing changes the mission. Exported Mission Brief includes a concise sampling coverage summary.

## Limitations

- The bundled source covers **only a small clipped region**, not all of Jezero or Mars.
- External DEM files can be imported but are not automatically verified as NASA observations.
- NoData, interpolation, geodetic horizontal/vertical reference definitions, uncertainty, hazards and traction affect the scientific interpretation.
- The tool provides a research/education aid and **not** a NASA navigation or EVA safety certification.

## Tests

`node --test tests/terrain-profile-v2.test.mjs` covers sampled geographic positions, uphill/downhill and missing samples, route statistics and interaction wiring. GitHub Actions Chromium smoke tests validate real NASA imagery, observing note deletion on the map, and the interactive profile/route map probe.
