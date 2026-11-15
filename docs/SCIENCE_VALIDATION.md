# Scientific source and validation — Jezero CTX DTM clip

**Origin:** Fergason, R. L., Galuszka, D. M., Hare, T. M., Mayer, D. P., and Redding, B. L. (2020), *Mars 2020 Terrain Relative Navigation CTX DTM Mosaic*, USGS Astrogeology Science Center, DOI: [10.5066/P906QQT8](https://doi.org/10.5066/P906QQT8), license USGS CC0 1.0 (source requests citation). Data derived from NASA Mars Reconnaissance Orbiter Context Camera stereo imagery.

**Download:** [USGS product](https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic) → [direct original 20 m GeoTIFF](https://planetarymaps.usgs.gov/mosaic/mars2020_trn/CTX/JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif). The original file used to make this clip had **SHA-256** `16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b`, 9,662,387 bytes, 1596×1512 float32 cells. This is our downloaded copy's hash, **not** a checksum supplied by USGS.

**Original georeferencing checked with rasterio:** projected Mars equirectangular, Mars 2000 sphere, radius **3,396,190 m**, meter grid spacing **20×20 m**, planetocentric east-positive angles in product metadata, one elevation band, original nodata approximately -3.4028227e38. This site operates on degree-based equirectangular data and models local distances using the same spherical radius. Its numeric elevation datum follows the USGS product's **MOLA topography / DeltaGeoid** convention and is not interchangeable with a terrestrial MSL or Earth sea-level datum.

**Prepared clip:** decimal degree centers: north 18.470, south 18.438, west 77.443, east 77.478; 104 columns × 96 rows, 9984/9984 valid numeric cells, observed interval approximately −2615.13 to −2549.79 m. Extracted with `scripts/prepare_dem.py` and rasterio/pyproj and output as a documented JSON grid. For transfer efficiency, elevations were quantized from float32 to integer centimeters, offset −2700 m with `uint16` little-endian base64. Maximum rounding error 0.005 m. See `src/bundled-dem.js` for deterministic decoder and `assets/jezero_ctx_trn_dem_20m_clip.json` for bundle metadata.

**What is validated:** Source URL, original TIFF dimensions and CRS, source data numeric quality, grid coordinate coverage, non-missing grid samples, deterministic A* paths between valid coordinates, scenario compare and elevation chart computations. The manual route demo points are inside this clip.

**What is NOT validated:** ESA/NASA EVA walkability, real astronaut O₂/battery draw, regolith strength, human safety constraints, boulders smaller than the stereo effective resolution, uncertain DTM artifacts, locally calibrated path cost penalties, actual geological hazard at the user note, coverage outside the clip, full NASA Mars Trek imagery in all browsers or the exact challenge Resources list. **Nominal 20 m posts do not imply a guaranteed 20 m recoverable landform resolution**; see [Kirk et al. 2020](https://doi.org/10.5194/isprs-archives-XLIII-B3-2020-1129-2020).

**Reproduction:** Download the source GeoTIFF, validate its SHA-256 against the recorded original, then run:

```bash
python scripts/prepare_dem.py JEZ_ctx_B_soc_008_DTM_MOLAtopography_DeltaGeoid_20m_Eqc_latTs0_lon0.tif /tmp/jezero-source-clip.json \
  --north 18.470 --south 18.438 --west 77.443 --east 77.478 --width 104 --height 96 \
  --source 'USGS/NASA Mars 2020 Jezero TRN MRO CTX DTM 20m' \
  --source-url 'https://astrogeology.usgs.gov/search/map/mars_2020_terrain_relative_navigation_ctx_dtm_mosaic' \
  --vertical-datum 'MOLA topography / DeltaGeoid (USGS source)'
```

Manual file import remains available. The built-in DEM is a **small study region**, not a global numeric Mars layer.

**Real DEM integration test (15 November 2026):** [JEZERO_NUMERIC_AUDIT.md](JEZERO_NUMERIC_AUDIT.md) includes checks of the committed numeric payload, independently verified route costs and explicit outside-coverage behavior. Its decoded-byte SHA256 is a local integrity fingerprint, not a new independent validation of the source GeoTIFF.
