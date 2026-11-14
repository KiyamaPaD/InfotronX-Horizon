export const MARS_RADIUS_METERS = 3396190;
export const JEZERO = Object.freeze({ lat: 18.4446, lon: 77.4509 });
export const STORAGE_KEY = "mars-atlas.missions.v1";
export const SHARE_HASH_PREFIX = "#mission=";
export const MAX_POINTS_PER_ROUTE = 80;
export const MAX_OBSERVATIONS = 80;

export const MAP_LAYERS = [
    {
        id: "ctx",
        name: "CTX Orbital",
        short: "CTX",
        agency: "NASA / MRO",
        dataset: "CTX_beta01_uncontrolled_5m_Caltech",
        description: "Mars Reconnaissance Orbiter CTX global image mosaic. Visual planning context, not a certified hazard map.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/CTX_beta01_uncontrolled_5m_Caltech/1.0.0",
        extensions: ["jpg", "png"]
    },
    {
        id: "mola",
        name: "MOLA Relief",
        short: "MOLA",
        agency: "NASA / MGS",
        dataset: "Mars_MGS_MOLA_ClrShade_merge_global_463m",
        description: "Mars Global Surveyor MOLA color hillshade. Regional relief overview; not a local elevation profile.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_MGS_MOLA_ClrShade_merge_global_463m/1.0.0",
        extensions: ["png", "jpg"]
    },
    {
        id: "viking",
        name: "Viking Color",
        short: "VIKING",
        agency: "NASA / Viking",
        dataset: "Mars_Viking_MDIM21_ClrMosaic_global_232m",
        description: "Viking global color mosaic for planetary visual context.",
        url: "https://trek.nasa.gov/tiles/Mars/EQ/Mars_Viking_MDIM21_ClrMosaic_global_232m/1.0.0",
        extensions: ["jpg", "png"]
    }
];

export const ROUTE_COLORS = ["#ec9976", "#75d1c8", "#e2c77d", "#b1a8f1", "#77aaf1"];
