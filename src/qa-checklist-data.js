// Every request from the review prompt, in order, grouped in five phases.
// built: "yes" (done, needs your check), "partly" (some of it is done), "no" (planned).
export const PHASES = [
    {
        id: "p1", title: "Phase 1 · Bugs, overlaps and quick fixes",
        items: [
            { id: "1.1", built: "yes", text: "In 'More options' of a waypoint, the category field is duplicated and must go.", test: "Place a waypoint, press More options: there is no Category list, only a 'Kind of place…' button that reopens the quick window." },
            { id: "1.2", built: "yes", text: "The legend label overlaps the coordinates label on the 2D map.", test: "Open the 2D map (✕ 2D map). The legend and the Lines box sit at the right; the coordinates stay at the left." },
            { id: "1.3", built: "yes", text: "When the legend is closed it hides behind the coordinates.", test: "Close the legend (click its title). It stays visible at the right, above the bottom edge." },
            { id: "1.4", built: "yes", text: "In 3D, the maps/status label overlaps the compass label.", test: "Open the 3D view. The status text is at the bottom right, the compass at the bottom left." },
            { id: "1.5", built: "yes", text: "The surface view panel overlaps 'Height along the route'.", test: "Draw a route, drag the figure onto the planet. The surface panel is at the top, the profile at the bottom." },
            { id: "1.6", built: "yes", text: "Console error: 'safetyHtml is not defined' in analyze-dashboard.js.", test: "Open the console, go to Analyze with 2+ waypoints: no red error." },
            { id: "1.7", built: "yes", text: "Console error: Vector3.distanceToSquared of undefined (route fly-over).", test: "Press 'Fly over the route' on a route with repeated points: no error, the flight runs or stops cleanly." },
            { id: "1.8", built: "yes", text: "Console error: 'Cannot read properties of null (reading trim)' on the start screen.", test: "Press 'Start exploring' on the welcome page: no error when the flight ends." },
            { id: "1.9", built: "yes", text: "Insights hardly works.", test: "Press Insights in the header: the full workspace opens with the Mission Copilot panel in view." },
            { id: "1.10", built: "partly", text: "In Analytics, with no waypoints, a 3D sphere appears without its material.", test: "Open Analyze with no route and open All tools. If a plain sphere shows, send a screenshot: it was not reproduced here." },
            { id: "1.11", built: "yes", text: "Zoom buttons are redundant in 3D: remove them.", test: "In 3D the +, −, fit and reset buttons are gone." },
            { id: "1.12", built: "yes", text: "Focus map in 3D should be almost full screen.", test: "Press Focus map: the map or planet fills nearly the whole window." },
            { id: "1.13", built: "yes", text: "Make everything in 3D smaller (markers, pins, labels).", test: "Markers, pins and names are visibly smaller; the Lines panel can still make them bigger or smaller." },
            { id: "1.14", built: "yes", text: "An interactive checklist to test every request.", test: "You are looking at it. Ticks are saved in this browser." }
        ]
    },
    {
        id: "p2", title: "Phase 2 · Maps: 2D, 3D, layers and sharpness",
        items: [
            { id: "2.1", built: "yes", text: "3D waypoints show the photo I chose, at the icon.", test: "Add a photo to a waypoint (More options). In 3D the marker shows the photo in a round frame." },
            { id: "2.2", built: "yes", text: "Right-click on waypoints and on marks in 3D, to edit and delete them.", test: "Right-click a waypoint or a field note on the planet: a menu with Edit and Delete appears." },
            { id: "2.3", built: "yes", text: "Compass with N, S, E, W and the points between them, stylish.", test: "The 3D compass is a turning dial with eight directions and degree ticks." },
            { id: "2.4", built: "partly", text: "2D map with icons, identical to 3D.", test: "Waypoints show the same shapes, colours and photos on both maps. Names and sizes still differ a little." },
            { id: "2.5", built: "partly", test: "Distant planets and the start-screen planets use banded textures; real NASA planet textures are still to do.", text: "Better 3D graphics, and better materials on the other planets." },
            { id: "2.6", built: "yes", text: "Not too bright when you are at the surface.", test: "Fly down with the figure or the wheel: the light and the glow soften as you get close." },
            { id: "2.7", built: "no", text: "Surface detail in 3D as fine as the 2D map (rendering at the ground)." },
            { id: "2.8", built: "no", text: "2D at very high zoom: sharp, not blurred or pixelated." },
            { id: "2.9", built: "no", text: "3D at very high zoom: sharp, not blurred." },
            { id: "2.10", built: "no", text: "Change the map layer in 3D like in 2D (Map data affects 3D)." },
            { id: "2.11", built: "no", text: "More NASA maps (layers) from NASA resources." },
            { id: "2.12", built: "no", text: "Surface and zoom behaviour in 3D like the Astra team's project (martian-map-project-astra)." },
            { id: "2.13", built: "no", text: "More photos and more places, some of them random, from online sources." },
            { id: "2.14", built: "partly", text: "Animations on the 2D and 3D routes.", test: "3D has a travelling marker and pulsing rings; 2D has the Flowing line style. A travelling marker on 2D is still to do." },
            { id: "2.15", built: "yes", text: "A control panel to change the lines: thickness and more.", test: "Open Lines on the 2D map or in the 3D panel: thickness, opacity, style, colour, outline, marker size." }
        ]
    },
    {
        id: "p3", title: "Phase 3 · Start screen, tutorial, navigation and preferences",
        items: [
            { id: "3.1", built: "yes", test: "Open the welcome page: the Milky Way band, the Andromeda glow, soft nebulae, a comet and tumbling rocks drift far behind Mars. Older computers get a lighter version.", text: "Start screen: Andromeda galaxy, the Milky Way seen from inside, far nebulae, comets, meteors and asteroids beyond Mars." },
            { id: "3.2", built: "yes", test: "On the welcome page, look behind Mars: Mercury, Venus, Earth with its Moon, Jupiter, Saturn with rings, Uranus and Neptune, plus an asteroid belt and a far Kuiper belt.", text: "All the planets of the solar system and the asteroid belts." },
            { id: "3.3", built: "yes", test: "Scroll the welcome page: the Built with bar scrolls the tools from left to right and pauses on hover.", text: "A bottom bar on the start screen scrolling the tools used, with logos (Codex, Claude, HTML, CSS, ...)." },
            { id: "3.4", built: "partly", test: "The Built on real data list now includes the NASA 3D model and the NASA image library. A full per-feature table is still to do (4.9).", text: "All the NASA resources used, listed on the start screen." },
            { id: "3.5", built: "yes", test: "Press Help & tour: a guide whose head is the logo waves, points toward the box and cheers at the end. It moves to a free corner and never covers the tutorial box.", text: "A tutorial mascot whose head is the site logo, in different poses, never covering the tutorial box." },
            { id: "3.6", built: "partly", test: "Some blocks have a turning light on their edge (Analyze step 1, the welcome cards) and a faint robot drifts across the Analyze background. More blocks can get it.", text: "Animated outlines on some labels and blocks, and robots in some backgrounds." },
            { id: "3.7", built: "yes", test: "The header has a navigation row: Start, Planet 3D, Map 2D, Plan, Analyze, All tools, Sources, Legal, Settings (wide screens).", text: "A heading at the top to navigate the site more easily." },
            { id: "3.8", built: "yes", test: "Fold the legend, the Lines box, the 3D panel, the profile or an Analyze step, then reload: they stay as you left them. Settings has Reset folded blocks.", text: "Preferences (collapsed blocks, settings) saved and kept everywhere, with a control panel." },
            { id: "3.9", built: "no", text: "All tools, right tab: simpler, more interactive, nicer to read, with advanced mathematics kept and correct." },
            { id: "3.10", built: "yes", text: "'Help' and the tutorial merged; the start page one click away from the step bar.", test: "The header has one 'Help & tour' button; step 0 · Start reopens the welcome page." }
        ]
    },
    {
        id: "p4", title: "Phase 4 · For the jury: proof, accuracy, links and law",
        items: [
            { id: "4.1", built: "partly", text: "Everything legal on terms, cookies, privacy and credits. Very important.", test: "Open legal.html: terms, privacy, cookies and credits exist. A lawyer should still review them." },
            { id: "4.2", built: "yes", test: "Analyze → step 4 → Load the benchmark mission. Three routes with the same start and end appear; npm test re-plans them and checks the numbers did not drift (tests/benchmark.test.mjs).", text: "A repeatable mission benchmark: fixed start and destination in the height model, three variants, results, method and mission file." },
            { id: "4.3", built: "yes", test: "Analyze → step 4: move the penalty slider. The table re-ranks the routes and the text names the penalty (about 10.6 for the benchmark) where the choice changes.", text: "A slider that trades distance against relief and explains why the ranking of the routes changes." },
            { id: "4.4", built: "no", text: "Data quality visible at the selected point: image source, height-model coverage, resolution, calculated or illustrative." },
            { id: "4.5", built: "yes", test: "The 3D panel, the profile note and the tour say the relief is approximate (8-bit, about 115 m per level). Nothing says 'real' or 'true scale'.", text: "Fix the 3D wording about MOLA heights ('real', 'true scale') so it matches what the data can support." },
            { id: "4.6", built: "no", text: "An independent check of a few points and a profile with a GIS tool, written down." },
            { id: "4.7", built: "no", text: "Test the public flow: guest, example, analysis, comparison, export; and separately a new account." },
            { id: "4.8", built: "partly", test: "npm run build now includes legal.html and checklist.html, and the README points to the current repository and the Vercel address. Check the live site after you deploy.", text: "legal.html included in the published build; README and links point to the current repository and site." },
            { id: "4.9", built: "no", text: "A table that links each requirement of the challenge to the feature that covers it." },
            { id: "4.10", built: "no", text: "AI tool disclosure, and the NASA resource from the challenge listed and cited." },
            { id: "4.11", built: "no", text: "A demo of at most 30 seconds of video or 7 slides, in English." },
            { id: "4.12", built: "yes", text: "The mathematics in the README, with worked examples checked by tests.", test: "Open the README: 'The mathematics' renders formulas; npm test passes tests/readme-math.test.mjs." },
            { id: "4.13", built: "yes", text: "Connect any two waypoints in Draw mode (the missing side of a triangle).", test: "Draw 3 points, then click point 1 and point 3: a dashed line joins them. Esc cancels." },
            { id: "4.14", built: "yes", text: "Photos can be attached to waypoints.", test: "More options → choose a picture; it shows in the editor and on the 3D marker." },
            { id: "4.15", built: "yes", text: "Route fly-over with the height profile in sync.", test: "3D panel → Fly over the route; the cursor on the profile moves with the camera." },
            { id: "4.16", built: "yes", text: "A figure to drag onto the map for a surface view, like street view.", test: "Drag the figure from the 2D map controls onto the map, or from the 3D panel onto the planet." },
            { id: "4.17", built: "yes", text: "Ideas for robots that go with the astronaut, and what to pack when something goes wrong.", test: "Analyze → step 8 · Safety: robots, kit and the point of no return." }
        ]
    },
    {
        id: "p5", title: "Phase 5 · Advanced mission ideas (backlog, in order of value)",
        items: [
            { id: "5.1", built: "no", text: "Plan by scientific value: choose goals and a time budget, get the visits worth making and what stays uncovered." },
            { id: "5.2", built: "no", text: "Instruments change the mission: choose equipment, each goal states instruments and time, incompatibilities are flagged." },
            { id: "5.3", built: "no", text: "A route that maximises geological diversity from a documented geological map." },
            { id: "5.4", built: "no", text: "'Why is there no route?': name the blocking constraint and test controlled changes." },
            { id: "5.5", built: "no", text: "Backup plans with triggers (if B is blocked go to C; if time is short drop the secondary goal)." },
            { id: "5.6", built: "no", text: "Earth–Mars communication delay simulation with a queue of commands." },
            { id: "5.7", built: "no", text: "Route robustness to terrain uncertainty: does the preferred variant stay the same?" },
            { id: "5.8", built: "no", text: "'What information would help most?': where one more observation could change the choice." },
            { id: "5.9", built: "no", text: "Navigation without GPS: a position uncertainty that grows and shrinks at landmarks." },
            { id: "5.10", built: "no", text: "Map alignment correction between an image and a height model, with the residual error." },
            { id: "5.11", built: "no", text: "Routes that respect the rover's turning radius and reversing." },
            { id: "5.12", built: "no", text: "Vehicle footprint check: width plus a margin along the route." },
            { id: "5.13", built: "no", text: "Lateral stability analysis on cross slopes." },
            { id: "5.14", built: "no", text: "Wheel slip simulator: commanded versus real distance." },
            { id: "5.15", built: "no", text: "Several rovers coordinating, with conflicts in narrow passes." },
            { id: "5.16", built: "no", text: "A computed meeting point and time for two teams." },
            { id: "5.17", built: "no", text: "Radio relay placement from terrain line of sight and a radio model." },
            { id: "5.18", built: "no", text: "Planning in space and time with time windows." },
            { id: "5.19", built: "no", text: "A dynamic battery over time with charging and temperature." },
            { id: "5.20", built: "no", text: "Thermal state of the equipment with warm-up and pauses." },
            { id: "5.21", built: "no", text: "Optimised depots and resupply points for several expeditions." },
            { id: "5.22", built: "no", text: "Physical handling of samples: id, mass, volume, container, transfer history." },
            { id: "5.23", built: "no", text: "Contamination prevention rules between samples." },
            { id: "5.24", built: "no", text: "A data budget: what to send now, compress or keep." },
            { id: "5.25", built: "no", text: "Recovery planning after an uncertain landing (an ellipse of start positions)." },
            { id: "5.26", built: "no", text: "Change detection between two observations of the same area." },
            { id: "5.27", built: "no", text: "Combining the orbital map with local 3D observations (point cloud)." },
            { id: "5.28", built: "no", text: "Connecting to a real educational rover (JPL Open Source Rover)." }
        ]
    }
];
