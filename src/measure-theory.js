import { MARS_RADIUS_METERS } from "./constants.js";

const RADIANS = Math.PI / 180;

// Natural spherical surface-area measure (rotation invariant, not flat lat/lon area).
export function marsCellAreaSqMeters(dem, row)
{
    if (!Number.isInteger(row) || row < 0 || row >= dem.height || !Number.isFinite(dem.latStep) || !Number.isFinite(dem.lonStep) || dem.latStep <= 0 || dem.lonStep <= 0)
    {
        throw new Error("Invalid DEM grid row or angular sample spacing.");
    }

    const center = dem.north - row * dem.latStep;
    const north = Math.min(90, center + dem.latStep / 2) * RADIANS;
    const south = Math.max(-90, center - dem.latStep / 2) * RADIANS;
    return MARS_RADIUS_METERS ** 2 * dem.lonStep * RADIANS * (Math.sin(north) - Math.sin(south));
}

// Discrete area integral over DEM-centered Voronoi cells where a Boolean mask is true.
export function measureGridRegion(dem, mask, options = {})
{
    const total = dem.width * dem.height;

    if (!mask || mask.length !== total)
    {
        throw new Error("Area mask must have one value for every DEM cell.");
    }

    const includeNoData = options.includeNoData === true;
    let squareMeters = 0;
    let cells = 0;

    for (let row = 0; row < dem.height; row++)
    {
        const cellArea = marsCellAreaSqMeters(dem, row);

        for (let column = 0; column < dem.width; column++)
        {
            const index = row * dem.width + column;

            if (mask[index] && (includeNoData || Number.isFinite(dem.elevations[index])))
            {
                squareMeters += cellArea;
                cells++;
            }
        }
    }

    return { squareMeters, squareKilometers: squareMeters / 1000000, cells };
}

// Haar analysis of 2x2 elevation patches. Coefficients are in meters, not probabilities.
// With mean a and details h,v,d: sum((zi-a)^2) / 4 = h*h + v*v + d*d.
export function haarBlock(z00, z01, z10, z11)
{
    if (![z00, z01, z10, z11].every(Number.isFinite))
    {
        return null;
    }

    const mean = (z00 + z01 + z10 + z11) / 4;
    const horizontal = (z00 - z01 + z10 - z11) / 4;
    const vertical = (z00 + z01 - z10 - z11) / 4;
    const diagonal = (z00 - z01 - z10 + z11) / 4;
    return { mean, horizontal, vertical, diagonal, contrastMeters: Math.hypot(horizontal, vertical, diagonal) };
}

export function analyzeHaarTerrain(dem, maxLevels = 5)
{
    if (!Number.isInteger(maxLevels) || maxLevels < 1 || maxLevels > 10)
    {
        throw new Error("Haar levels must be between 1 and 10.");
    }

    let grid = dem.elevations;
    let width = dem.width;
    let height = dem.height;
    const levels = [];
    const centerLatitude = (dem.north - (dem.height - 1) * dem.latStep / 2) * RADIANS;
    const approximateEastStep = MARS_RADIUS_METERS * Math.cos(centerLatitude) * dem.lonStep * RADIANS;
    const northStep = MARS_RADIUS_METERS * dem.latStep * RADIANS;
    const postingMeters = Math.sqrt(approximateEastStep * northStep);

    for (let level = 1; level <= maxLevels && width >= 2 && height >= 2; level++)
    {
        const nextWidth = Math.floor(width / 2);
        const nextHeight = Math.floor(height / 2);
        const averaged = Array(nextWidth * nextHeight).fill(null);
        let sumOfSquares = 0;
        let maximumContrast = 0;
        let usableBlocks = 0;

        for (let row = 0; row < nextHeight; row++)
        {
            for (let column = 0; column < nextWidth; column++)
            {
                const top = row * 2 * width + column * 2;
                const bottom = top + width;
                const values = haarBlock(grid[top], grid[top + 1], grid[bottom], grid[bottom + 1]);

                if (!values)
                {
                    continue;
                }

                averaged[row * nextWidth + column] = values.mean;
                sumOfSquares += values.contrastMeters ** 2;
                maximumContrast = Math.max(maximumContrast, values.contrastMeters);
                usableBlocks++;
            }
        }

        levels.push({
            level,
            footprintMetersApprox: 2 ** level * postingMeters,
            rmsContrastMeters: usableBlocks ? Math.sqrt(sumOfSquares / usableBlocks) : null,
            maxContrastMeters: usableBlocks ? maximumContrast : null,
            validBlocks: usableBlocks,
            totalBlocks: nextWidth * nextHeight,
            width: nextWidth,
            height: nextHeight
        });

        grid = averaged;
        width = nextWidth;
        height = nextHeight;
    }

    return { levels, postingMetersApprox: postingMeters, caveat: "Haar height contrast includes ordinary grade and is not an obstacle, traction, or safety measurement. Scales are limited by the DEM posting." };
}
