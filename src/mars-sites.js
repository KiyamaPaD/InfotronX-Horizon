// Real places on Mars that are always on the planet: where rovers and landers touched down, and the biggest features.
// Coordinates are planetocentric latitude and east longitude (-180 to 180). Facts are short summaries written for this app;
// photos are fetched from the NASA Image and Video Library when a site is opened (the `query` is the search text).
export const MARS_SITES = Object.freeze([
    { id: "jezero", name: "Jezero Crater", type: "landing", lat: 18.44, lon: 77.45, query: "Perseverance Jezero crater delta",
      summary: "A crater about 45 km wide that held a lake billions of years ago. Perseverance landed here to look for signs of ancient life and to collect samples.",
      facts: ["Perseverance landed on 18 February 2021 near the edge of an ancient river delta.", "Deltas trap fine sediment, which makes this a prime place to search for signs of past life.", "Ingenuity, the first helicopter to fly on another planet, took off from here and made 72 flights."] },
    { id: "gale", name: "Gale Crater · Curiosity", type: "landing", lat: -5.4, lon: 137.8, query: "Curiosity Gale crater Mount Sharp",
      summary: "A 154 km wide crater with a mountain of layered rock in the middle. Curiosity has been climbing it since 2014.",
      facts: ["Curiosity landed in August 2012.", "Mount Sharp (Aeolis Mons) rises about 5 km above the crater floor.", "Early on, Curiosity found that this place once had conditions that could have supported microbes."] },
    { id: "olympus", name: "Olympus Mons", type: "feature", lat: 18.65, lon: -133.8, query: "Olympus Mons volcano Mars",
      summary: "The tallest known volcano in the solar system: about 22 km high and roughly 600 km across.",
      facts: ["That is about two and a half times the height of Mount Everest.", "It is a shield volcano, so its slopes are gentle, averaging only about 5 degrees.", "Its summit holds a cluster of collapsed craters called calderas."] },
    { id: "valles", name: "Valles Marineris", type: "feature", lat: -13.9, lon: -59.2, query: "Valles Marineris canyon Mars",
      summary: "A system of canyons about 4,000 km long, up to 7 km deep. It would stretch across the width of the United States.",
      facts: ["It is roughly ten times longer than the Grand Canyon.", "It formed mostly as the crust cracked and stretched near the Tharsis volcanoes.", "Layered walls show a long history of the planet's rocks."] },
    { id: "hellas", name: "Hellas Planitia", type: "feature", lat: -42.4, lon: 70.5, query: "Hellas Planitia basin Mars",
      summary: "One of the largest impact basins in the solar system, about 2,300 km across and some 7 km deep.",
      facts: ["It was carved by a giant impact early in the planet's history.", "Because it is so deep, air pressure at the bottom is higher than anywhere else on Mars.", "Winter frost sometimes whitens its floor, so it can be seen from Earth."] },
    { id: "viking1", name: "Viking 1 · Chryse Planitia", type: "landing", lat: 22.27, lon: -47.95, query: "Viking 1 lander Chryse Planitia",
      summary: "The first successful US landing on Mars, in July 1976.",
      facts: ["It touched down on 20 July 1976 and worked for more than six years.", "Its camera sent back the first colour pictures from the surface of Mars.", "It tested the soil for signs of life; the results were not conclusive."] },
    { id: "viking2", name: "Viking 2 · Utopia Planitia", type: "landing", lat: 47.64, lon: -134.26, query: "Viking 2 lander Utopia Planitia frost",
      summary: "The second Viking lander, which landed on a cold northern plain in September 1976.",
      facts: ["It landed on 3 September 1976.", "It photographed a thin layer of water-ice frost on the ground in winter.", "Its orbiter and lander together gave the first detailed view of the planet."] },
    { id: "pathfinder", name: "Pathfinder · Ares Vallis", type: "landing", lat: 19.13, lon: -33.25, query: "Mars Pathfinder Sojourner Ares Vallis",
      summary: "Landed in July 1997 and delivered Sojourner, the first rover on Mars.",
      facts: ["It landed on 4 July 1997, using airbags to bounce to a stop.", "Sojourner was about the size of a microwave oven.", "It studied rocks washed down by an ancient flood."] },
    { id: "spirit", name: "Gusev Crater · Spirit", type: "landing", lat: -14.57, lon: 175.47, query: "Spirit rover Gusev crater",
      summary: "Landing site of the Spirit rover in January 2004, in a crater that may once have held a lake.",
      facts: ["Spirit was built for 90 days and worked for more than six years.", "It found rocks and soil altered by water, including bright silica-rich soil.", "Contact was lost in 2010 after it became stuck in soft sand."] },
    { id: "opportunity", name: "Meridiani Planum · Opportunity", type: "landing", lat: -1.95, lon: -5.53, query: "Opportunity rover Meridiani Planum",
      summary: "Landing site of the Opportunity rover in January 2004, a flat plain rich in small iron-bearing spheres.",
      facts: ["Opportunity was built for 90 days and worked for almost 15 years.", "It found clear evidence that liquid water once soaked these rocks.", "It drove more than 45 km, farther than any other rover on another world."] },
    { id: "phoenix", name: "Phoenix · Vastitas Borealis", type: "landing", lat: 68.22, lon: -125.7, query: "Phoenix lander Mars arctic ice",
      summary: "A lander that touched down on the icy northern plains in May 2008.",
      facts: ["It landed on 25 May 2008, far closer to the pole than any earlier mission.", "Its scoop dug up water ice just below the dust.", "It watched snow fall from clouds and the seasons change before the polar winter ended its work."] },
    { id: "insight", name: "InSight · Elysium Planitia", type: "landing", lat: 4.5, lon: 135.62, query: "InSight lander Elysium Planitia seismometer",
      summary: "A lander that listened for marsquakes to learn what the inside of Mars is like.",
      facts: ["It landed on 26 November 2018.", "Its seismometer recorded more than a thousand marsquakes.", "The mission ended in December 2022 when dust covered its solar panels."] },
    { id: "zhurong", name: "Zhurong · Utopia Planitia", type: "landing", lat: 25.1, lon: 109.9, query: "Zhurong rover Utopia Planitia Tianwen-1",
      summary: "Landing site of China's Zhurong rover, the second country to operate a rover on Mars.",
      facts: ["The Tianwen-1 mission landed on 14 May 2021.", "Zhurong drove across a plain that may have been shaped by ancient water.", "NASA's orbiters photographed the rover from above."] },
    { id: "syrtis", name: "Syrtis Major", type: "feature", lat: 8.4, lon: 69.5, query: "Syrtis Major Planum Mars",
      summary: "A dark volcanic region that can be seen from Earth through a small telescope.",
      facts: ["Christiaan Huygens sketched it in 1659, the first surface feature of another planet ever recorded.", "It is a broad, low shield of dark volcanic rock.", "Its darkness changes with the seasons as dust moves across it."] },
    { id: "pavonis", name: "Pavonis Mons", type: "feature", lat: 0.8, lon: -113.4, query: "Pavonis Mons volcano Mars",
      summary: "A large shield volcano on the Tharsis bulge, standing right on the equator.",
      facts: ["It rises about 14 km above the surrounding plains.", "It is one of three volcanoes in a straight line, called the Tharsis Montes.", "Its summit crater is about 5 km deep."] },
    { id: "elysium", name: "Elysium Mons", type: "feature", lat: 25.0, lon: 147.2, query: "Elysium Mons volcano Mars",
      summary: "The tallest volcano of the Elysium region, about 12 to 14 km high.",
      facts: ["It sits on a large volcanic rise on the other side of the planet from Olympus Mons.", "Lava flows and channels spread across the plains around it.", "InSight landed on the plain just to the south."] },
    { id: "north-pole", name: "North polar cap", type: "feature", lat: 85, lon: 0, query: "Mars north polar cap ice layers",
      summary: "A cap of water ice and dust about 1,000 km wide, ringed by dark dunes.",
      facts: ["Its layers record changes in the climate over millions of years.", "In winter a thin layer of carbon dioxide frost covers it.", "The Phoenix lander worked on the plains below it."] },
    { id: "south-pole", name: "South polar cap", type: "feature", lat: -87, lon: 0, query: "Mars south polar cap ice",
      summary: "A smaller cap with a permanent layer of carbon dioxide ice over water ice.",
      facts: ["The ice here shrinks and grows with the seasons.", "Radar from orbit has searched beneath it for liquid water.", "Spring warming cracks the surface into spider-like channels."] }
]);

export const SITE_TYPES = Object.freeze({
    landing: { label: "Landing site", colour: 0x75d1c8 },
    feature: { label: "Natural feature", colour: 0xe3a06a }
});

// Ready-made waypoint kinds. Each fills the name, type, symbol, colour and a short "what to do here" note.
// The notes are plans written by the user, never measured facts, and hazards are hypothetical.
export const WAYPOINT_PRESETS = Object.freeze([
    { id: "base", label: "Base camp", category: "navigation", icon: "star", color: "#92c279", name: "Base camp", todo: "Check suits and radio, record the start time and confirm the route." },
    { id: "checkpoint", label: "Checkpoint", category: "navigation", icon: "circle", color: "#75d1c8", name: "Checkpoint", todo: "Confirm position and the remaining oxygen and battery before going on." },
    { id: "sample", label: "Sample site", category: "sample", icon: "diamond", color: "#e2c77d", name: "Sample site", todo: "Collect a core or soil sample, label it, and note the depth and surroundings." },
    { id: "science", label: "Science target", category: "science", icon: "triangle", color: "#b1a8f1", name: "Science target", todo: "Photograph the outcrop from three angles and record its colour and layering." },
    { id: "photo", label: "Photo stop", category: "science", icon: "circle", color: "#e8e6e1", name: "Photo stop", todo: "Take a wide panorama and a close-up, and note the time of day." },
    { id: "landmark", label: "Landmark", category: "landmark", icon: "square", color: "#77aaf1", name: "Landmark", todo: "Use this feature on the horizon to check your position." },
    { id: "rest", label: "Rest and recharge", category: "other", icon: "square", color: "#f1b4c6", name: "Rest stop", todo: "Rest, recharge and re-check the remaining supplies." },
    { id: "hazard", label: "Avoid (hypothetical)", category: "hazard", icon: "triangle", color: "#ec9976", name: "Area to avoid", todo: "Keep out of this area. This is a hypothetical hazard set by you, not a measured one." }
]);

export function siteById(id)
{
    return MARS_SITES.find(site => site.id === id) || null;
}
