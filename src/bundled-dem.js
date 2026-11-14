import { validateDem } from "./terrain.js";

export const JEZERO_DEM_URL = new URL("../assets/jezero_ctx_trn_dem_20m_clip.json", import.meta.url);
export const JEZERO_DEM_RASTER_SHA256 = "16a1aa66c3f48c1bca252795827db7b417876217aff0f5e1aff18027fab2327b";

export function decodeBundledDem(raw)
{
    if (raw?.encoding !== "uint16-little-endian-base64" || raw?.sourceRasterSha256 !== JEZERO_DEM_RASTER_SHA256)
    {
        throw new Error("Unrecognized Jezero DEM format or provenance. Use a numeric JSON import instead.");
    }

    if (!Number.isInteger(raw.width) || !Number.isInteger(raw.height) || raw.width < 2 || raw.height < 2 || raw.width * raw.height > 60000)
    {
        throw new Error("Bundled DEM grid dimensions are invalid.");
    }

    if (!Number.isFinite(raw.elevationOffsetMeters) || !Number.isFinite(raw.elevationStepMeters) || raw.elevationStepMeters <= 0 || raw.elevationStepMeters > 1)
    {
        throw new Error("Bundled DEM height quantization is invalid.");
    }

    const encoded = raw.elevationsBase64;

    if (typeof encoded !== "string" || encoded.length !== Math.ceil(raw.width * raw.height * 2 / 3) * 4)
    {
        throw new Error("The Jezero DEM elevation buffer is incomplete.");
    }

    let decoded;

    try
    {
        decoded = atob(encoded);
    }
    catch
    {
        throw new Error("The Jezero DEM elevation buffer is not valid base64.");
    }

    if (decoded.length !== raw.width * raw.height * 2)
    {
        throw new Error("The Jezero DEM elevation buffer has an incorrect length.");
    }

    const elevations = [];

    for (let i = 0; i < decoded.length; i += 2)
    {
        const value = decoded.charCodeAt(i) | decoded.charCodeAt(i + 1) << 8;
        elevations.push(value === 65535 ? null : Math.round((raw.elevationOffsetMeters + value * raw.elevationStepMeters) * 100) / 100);
    }

    return validateDem({ ...raw, elevations });
}

export async function loadJezeroDem(fetcher = fetch)
{
    const response = await fetcher(JEZERO_DEM_URL);

    if (!response.ok)
    {
        throw new Error(`Jezero DEM could not load (HTTP ${response.status}). Check your connection or import a local grid.`);
    }

    const payload = await response.json();
    const result = decodeBundledDem(payload);
    result.bundledSource = true;
    return result;
}
