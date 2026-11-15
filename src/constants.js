export const MARS_RADIUS_METERS = 3396190;
export const JEZERO = Object.freeze({ lat: 18.4446, lon: 77.4509 });
export const STORAGE_KEY = "mars-atlas.missions.v1";
export const SHARE_HASH_PREFIX = "#mission=";
export const MAX_POINTS_PER_ROUTE = 80;
export const MAX_OBSERVATIONS = 80;

export const MAP_LAYERS = [
    {
        id: "viking",
        name: "Viking Global",
        short: "VIKING",
        agency: "NASA / Viking",
        dataset: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
        description: "Continuous Viking color mosaic for global Mars exploration. Native detail is limited to its map resolution.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0",
        extensions: ["jpg"],
        maxUsefulZoom: 7
    },
    {
        id: "hirise",
        name: "HiRISE Jezero",
        short: "HIRISE",
        agency: "NASA / MRO",
        dataset: "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
        description: "Grayscale HiRISE Jezero imagery through zoom 11, with transparent gaps over grayscale Viking context.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0",
        extensions: ["png"],
        coverage: { south: 18.3067994, north: 18.669315, west: 77.2229331, east: 77.583964 },
        maxUsefulZoom: 11
    },
    {
        id: "mola",
        name: "MOLA Relief",
        short: "MOLA",
        agency: "NASA / MGS / ESA",
        dataset: "Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw",
        description: "Monochrome MOLA and HRSC hillshade blend. Visual relief shading, not numeric elevation.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw/1.0.0",
        extensions: ["jpg"],
        maxUsefulZoom: 7
    },
    {
        id: "mola-color",
        name: "MOLA Colour Relief",
        short: "MOLA COLOUR",
        agency: "NASA / MGS",
        dataset: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
        description: "MOLA elevation in colour with hillshading: lows in blue, highs in red and white. The colours stand for height; the picture is not a photograph.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0",
        extensions: ["jpg"],
        maxUsefulZoom: 7
    }
];

// Local photographic backdrop for HiRISE, hidden from the basemap selector.
export const JEZERO_CTX_CONTEXT = Object.freeze({
    id: "ctx-jezero",
    name: "CTX Jezero",
    dataset: "JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0",
    url: "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_ctx_B_soc_008_orthoMosaic_6m_Eqc_latTs0_lon0/1.0.0",
    extensions: ["png"],
    coverage: { south: 18.2110274, north: 18.7211945, west: 77.1604655, east: 77.6991776 },
    maxUsefulZoom: 11
});

export const ROUTE_COLORS = ["#ec9976", "#75d1c8", "#e2c77d", "#b1a8f1", "#77aaf1"];
