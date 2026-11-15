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
        extensions: ["jpg", "png"],
        maxUsefulZoom: 8
    },
    {
        id: "hirise",
        name: "HiRISE Jezero",
        short: "HIRISE",
        agency: "NASA / MRO",
        dataset: "JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd",
        description: "Controlled 25 cm HiRISE mosaic of Jezero. Outside its coverage, the map displays lower-resolution Viking context.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/JEZ_hirise_soc_006_orthoMosaic_25cm_Eqc_latTs0_lon0_first_dd/1.0.0",
        extensions: ["png", "jpg"],
        coverage: { south: 18.3067994, north: 18.669315, west: 77.2229331, east: 77.583964 },
        maxUsefulZoom: 10
    },
    {
        id: "mola",
        name: "MOLA Relief",
        short: "MOLA",
        agency: "NASA / MGS",
        dataset: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
        description: "Mars Global Surveyor MOLA color hillshade. Regional relief overview; not a local elevation profile.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0",
        extensions: ["png", "jpg"],
        maxUsefulZoom: 7
    }
];

export const ROUTE_COLORS = ["#ec9976", "#75d1c8", "#e2c77d", "#b1a8f1", "#77aaf1"];
