# Numeric DEM import — Mars Atlas V5

The app **does not manufacture elevation data**. CTX imagery, MOLA colored hillshades, and Viking mosaics are *not* suitable numeric input for A* slope calculations. The V5 DEM routing button is disabled until a valid numeric grid is imported.

## Source recommended for Jezero

- [USGS Astrogeology: Mars 2020 Science Investigation CTX DEM Mosaic](https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic), 20 m/pixel, MRO Context Camera stereo products, 2021; the product lists the file `M20_JezeroCrater_CTXDEM_20m.tif` (~87 MB) from `planetarymaps.usgs.gov`.
- [USGS: Mars Sample Return HiRISE Mosaics for Terrain Relative Navigation](https://www.usgs.gov/data/mars-sample-return-hirise-mosaics-terrain-relative-navigation), 2025, DOI [10.5066/P13CPYYU](https://doi.org/10.5066/P13CPYYU); higher fidelity for its particular geographic extent, much larger download.
- [NASA PDS MRO HiRISE DTM dataset](https://data.nasa.gov/dataset/mro-mars-high-resolution-imaging-science-experiment-dtm-v1-0-4cd19), provenance for orbital terrain model products.

**State as of this release:** these sources have been identified, but an original TIFF has **not** yet been downloaded, verified, clipped, or shipped with the site. The V5 UI therefore cannot yet calculate Jezero-specific slopes automatically.

## Prepare a real clipped JSON

Dependencies: `pip install rasterio pyproj numpy` (only on a developer's computer; not needed for website users).

Download the *numeric* GeoTIFF from the official product listing and verify the raster's coordinate system and vertical datum using its documentation. Example command, **illustrative bounds only**:

```bash
python scripts/prepare_dem.py M20_JezeroCrater_CTXDEM_20m.tif assets/jezero_dem_clip.json \
  --north 18.47 --south 18.43 --west 77.43 --east 77.48 \
  --width 120 --height 120 \
  --source "USGS Mars 2020 CTX DEM Mosaic / Jezero, numeric GeoTIFF"
```

Check that the selected bounds actually overlap the raster's coverage. If they don't, change the bounds based on the raster metadata rather than inserting fake cells. The converter refuses Earth-like CRS radii and clips with too little numerical coverage.

The script samples a single-band elevation raster using its native CRS, retaining `null` for NoData. **Important:** projection conversion alone cannot guarantee that planetographic and planetocentric latitudes are interchangeable. The dataset's exact latitude convention, reference radius and vertical datum must be cross-checked independently before a scientific claim.

In the Mission Control Science sidebar, choose **Load DEM grid (.json)**. The user must import the JSON file; it is **not uploaded to any server** and is only retained in the active browser session. The imported file's label is user-provided provenance, not independent NASA validation.

## Technical assumptions

- A* uses 8 neighboring grid centers and cannot step across missing elevation cells.
- An edge's grade is `100 × Δelevation / horizontalDistance`, in percent. This is the **directional slope between neighboring samples**, not a high-resolution hazard analysis.
- User-adjusted cost `horizontalDistance × (1 + slopePenalty × |grade| / 100)` stays nonnegative.
- User-set slope threshold is an illustrative constraint, **not** an EVA/hardware safety limit.
- Obstacle footprints, loose regolith, shadows, equipment capabilities, slope measurement error, optical stereo gaps, and real EVA safety factors are **not** modeled.
- The planner routes through the nearest DEM grid centers corresponding to *all* user waypoints in their order (coordinates are snapped; not kept exact). It only collapses consecutive straight grid steps; if more than 80 turns are needed, it refuses the plan rather than cutting across unexamined cells.
- The plotted elevation profile uses nearest-cell samples and breaks its line at NoData gaps.
- Model metadata is stored with the derived route. Any direct manual edit invalidates that saved terrain-model label, while the user's manual route remains editable.

Do not call the output a NASA-approved traversability route or astronaut suit telemetry.
