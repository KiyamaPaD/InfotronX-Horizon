#!/usr/bin/env python3
"""Clip a documented Mars numeric DEM GeoTIFF to the Mars Atlas JSON grid format."""

import argparse
import json
import math
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS, Transformer

MAX_CELLS = 60000


def parse_args():
    parser = argparse.ArgumentParser(description="Sample a Mars DEM GeoTIFF into the Mars Atlas numeric grid format.")
    parser.add_argument("input", type=Path, help="Locally downloaded Mars DEM GeoTIFF")
    parser.add_argument("output", type=Path, help="Output JSON clip (never raw RGB imagery)")
    parser.add_argument("--north", type=float, required=True, help="Northernmost sample center latitude, degrees")
    parser.add_argument("--south", type=float, required=True, help="Southernmost sample center latitude, degrees")
    parser.add_argument("--west", type=float, required=True, help="Westernmost sample center longitude, degrees east")
    parser.add_argument("--east", type=float, required=True, help="Easternmost sample center longitude, degrees east")
    parser.add_argument("--width", type=int, default=120)
    parser.add_argument("--height", type=int, default=120)
    parser.add_argument("--source", default="USGS Mars 2020 Science Investigation CTX DEM Mosaic (20 m/pixel)")
    parser.add_argument("--source-url", default="https://astrogeology.usgs.gov/search/map/mars_2020_science_investigation_ctx_dem_mosaic")
    parser.add_argument("--vertical-datum", default="See original raster metadata and product documentation")
    return parser.parse_args()


def main():
    args = parse_args()

    if not args.input.is_file():
        raise ValueError("Input GeoTIFF not found. Download it from the documented USGS source first.")

    if not (2 <= args.width <= 60000 and 2 <= args.height <= 60000 and args.width * args.height <= MAX_CELLS):
        raise ValueError(f"Grid exceeds {MAX_CELLS} supported cells.")

    if not (-90 <= args.south < args.north <= 90 and -180 <= args.west < args.east <= 180):
        raise ValueError("Invalid geographic clipping bounds.")

    lat_step = (args.north - args.south) / (args.height - 1)
    lon_step = (args.east - args.west) / (args.width - 1)

    with rasterio.open(args.input) as raster:
        if raster.count != 1 or raster.crs is None:
            raise ValueError("DEM must be a single-band raster with a declared spatial CRS.")

        source_crs = CRS.from_user_input(raster.crs)
        radius = source_crs.ellipsoid.semi_major_metre

        if not 3_000_000 <= radius <= 3_700_000:
            raise ValueError(f"Raster reference radius {radius} m is not Mars-like; refusing Earth/unknown georeferencing.")

        if not np.issubdtype(np.dtype(raster.dtypes[0]), np.number):
            raise ValueError("Raster band must contain numeric elevations.")

        source_geographic = source_crs.geodetic_crs

        if source_geographic is None:
            raise ValueError("Cannot derive Mars geographic CRS from the source raster.")

        transformer = Transformer.from_crs(source_geographic, source_crs, always_xy=True)
        points = []

        for row in range(args.height):
            lat = args.north - row * lat_step

            for column in range(args.width):
                lon = args.west + column * lon_step
                x, y = transformer.transform(lon, lat)
                points.append((x, y))

        elevations = []

        for sample in raster.sample(points, indexes=1, masked=True):
            value = sample[0]

            if np.ma.is_masked(value):
                elevations.append(None)
            else:
                numeric = float(value)
                elevations.append(numeric if math.isfinite(numeric) and abs(numeric) < 40000 else None)

        valid = sum(value is not None for value in elevations)

        if valid < max(2, int(args.width * args.height * 0.25)):
            raise ValueError(f"Clip has only {valid}/{len(elevations)} numeric samples. Verify bounds, input coverage and coordinate conventions.")

        payload = {
            "version": 1,
            "width": args.width,
            "height": args.height,
            "north": args.north,
            "west": args.west,
            "latStep": lat_step,
            "lonStep": lon_step,
            "elevations": elevations,
            "source": args.source,
            "sourceUrl": args.source_url,
            "resolution": f"Input pixel spacing ~{abs(raster.res[0]):.2f} × {abs(raster.res[1]):.2f} CRS units; output sampled at {args.width}×{args.height}",
            "horizontalDatum": f"Raster CRS: {source_crs.name}; assumed east-positive geographic degrees",
            "verticalDatum": args.vertical_datum
        }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"Created {args.output} with {valid}/{len(elevations)} numeric DEM cells ({args.output.stat().st_size:,} bytes).")
    print("Verify planetocentric vs planetographic latitude and datum against the original product before scientific interpretation.")


if __name__ == "__main__":
    main()
