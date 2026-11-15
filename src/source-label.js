import { MAP_LAYERS } from "./constants.js";

const VIKING_NATIVE_ZOOM = MAP_LAYERS.find(layer => layer.id === "viking").maxUsefulZoom;
const MOLA_NATIVE_ZOOM = MAP_LAYERS.find(layer => layer.id === "mola").maxUsefulZoom;
const HIRISE = MAP_LAYERS.find(layer => layer.id === "hirise");
// The map shows HiRISE tiles from zoom 9; below that the HiRISE selection displays the Viking backdrop.
const HIRISE_FIRST_ZOOM = 9;

function insideHiRISE(center)
{
    const { south, north, west, east } = HIRISE.coverage;
    return center.lat >= south && center.lat <= north && center.lon >= west && center.lon <= east;
}

function viking(zoom)
{
    return zoom <= VIKING_NATIVE_ZOOM ? "Viking · z" + zoom : "Viking upscaled from z" + VIKING_NATIVE_ZOOM + " · z" + zoom;
}

export function describeSource(layerId, zoom, center)
{
    if (layerId === "mola")
    {
        return zoom <= MOLA_NATIVE_ZOOM
            ? "MOLA shaded relief (not elevation) · z" + zoom
            : "MOLA shaded relief (not elevation) upscaled from z" + MOLA_NATIVE_ZOOM + " · z" + zoom;
    }

    if (layerId === "hirise" && zoom >= HIRISE_FIRST_ZOOM && insideHiRISE(center))
    {
        return "HiRISE 25 cm · z" + zoom;
    }

    return viking(zoom);
}
