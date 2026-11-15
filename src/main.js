import { JEZERO, MAP_LAYERS, MAX_POINTS_PER_ROUTE } from "./constants.js";
import { MARKER_ICONS, normalizeMarkerIcon } from "./marker-icons.js";
import { WAYPOINT_CATEGORIES, waypointLabel, categoryLabel } from "./waypoint-editor.js";
import { analyzeRoute, formatCoordinate, formatDistance, generateDetour } from "./geo.js";
import { MissionStore } from "./store.js";
import { MarsMap } from "./map.js";
import { renderRouteComparison, renderSegmentChart } from "./analytics.js";
import { drawRouteGraph } from "./route-graph.js";
import { createShareLink, downloadFile, readSharedMission, toGeoJson } from "./share.js";
import { inspectRoute } from "./inspector.js";
import { initScienceWorkbench } from "./science-workbench.js";
import { createJezeroReviewMission } from "./review-demo.js";
import { mountWorkspaceDisclosures } from "./workspace-disclosures.js";
import { setupAnalyticsNavigation } from "./workspace-ux.js";
import { mountCloudWorkspace } from "./cloud-ui.js";
import { mountMissionCopilot } from "./mission-copilot-ui.js";
import { mountWorkflowSteps } from "./workflow-steps.js";
import { animateNumber } from "./motion.js";
import { Tutorial } from "./tutorial.js";
import { TUTORIAL_STEPS } from "./tutorial-steps.js";
import { enableCardTilt } from "./tilt.js";
import { mountHome } from "./home.js";
import { mountAnalyzeDashboard } from "./analyze-dashboard.js";
import { mountAccount } from "./account.js";

const store = new MissionStore();
const imported = readSharedMission();

const tutorial = new Tutorial(TUTORIAL_STEPS);

if (imported)
{

    store.importMission(imported);
    history.replaceState(null, "", location.pathname + location.search);
}

const safe = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
const app = document.querySelector("#app");

app.innerHTML = `
    <div class="shell" id="mars-shell" data-mobile-panel="map">
        <a class="skip-link" href="#map-root">Skip to interactive map</a>
        <header class="header" role="banner">
            <div class="brand"><div class="brand-symbol"><span></span></div><div><div class="brand-wordmark">MARS <strong>ATLAS</strong></div><div class="brand-subline">INFOTRONX HORIZON</div></div></div>
            <div class="header-center"><span class="header-center-title">Jezero Crater <span class="header-divider"></span> Mars</span></div>
            <div class="header-actions"><button class="btn btn-outline compact" id="start-tutorial">Tutorial</button><button class="btn btn-outline compact header-copilot" data-action="open-copilot">Insights <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button><span class="edition-pill">NASA SPACE APPS · 2026</span><button class="btn btn-quiet compact header-help" data-action="show-guide" aria-label="Open help and keyboard shortcuts">? <span>Help</span></button><button class="btn btn-accent compact header-share" data-action="share">Share mission <span aria-hidden="true">↗</span></button></div>
        </header>
        <div class="workspace">
                        <aside class="sidebar sidebar-left" id="left-sidebar">
                <div class="sidebar-content">
                    <div class="panel-section top-section"><div class="section-eyebrow">YOUR MISSION <span class="status-dot" aria-hidden="true"></span></div><h1 id="mission-heading">Jezero reconnaissance</h1><details class="mission-notes"><summary>Mission notes</summary><div class="subtle-copy" id="mission-description"></div></details><div class="mission-top-actions"><button class="btn btn-outline" data-action="new-mission">+ New mission</button><button class="btn btn-muted" data-action="rename-mission">Edit mission</button></div><button class="btn btn-outline wide" type="button" data-action="load-review-demo">◉ Open Jezero example mission</button></div>
                    <div class="panel-section"><div class="panel-title-row"><div class="section-label">ROUTE PLANNER</div><span class="count-chip" id="route-count">01</span></div><div class="mode-switcher" role="group" aria-label="Map editing tools"><button class="mode-btn active" data-mode="pan" title="Pan map">↔ <span>Explore</span></button><button class="mode-btn" data-mode="draw" title="Add waypoints">✎ <span>Draw</span></button><button class="mode-btn" data-mode="edit" title="Move waypoints">◎ <span>Move</span></button><button class="mode-btn" data-mode="observe" title="Add an observation">✧ <span>Observe</span></button></div><div id="route-list" class="route-list"></div><div class="route-primary-actions"><button class="btn btn-outline" data-action="new-route">＋ Route</button><button class="btn btn-outline" data-action="add-coordinates">＋ Coordinates</button></div><div class="route-history" role="group" aria-label="Edit history"><button class="btn btn-muted" data-action="undo-edit" title="Undo edit (Ctrl+Z)" disabled>↶ Undo</button><button class="btn btn-muted" data-action="redo-edit" title="Redo edit (Ctrl+Y)" disabled>↷ Redo</button></div><details class="route-options"><summary>Route options</summary><div class="route-actions"><button class="btn btn-outline" data-action="duplicate-route">Duplicate</button><button class="btn btn-outline" data-action="rename-route">Rename</button><button class="btn btn-outline" data-action="clear-route">Clear points</button><button class="btn btn-outline" data-action="delete-route">Delete route</button></div><label class="route-color-setting" for="active-route-color">Route color <input id="active-route-color" type="color" value="#ec9976" aria-label="Active route line color" /></label></details></div>
                    <div class="panel-section"><div class="panel-title-row"><div class="section-label">MAP DATA</div><span class="tiny-pill">NASA TREK</span></div><div id="layer-buttons" class="layer-buttons"></div><div class="layer-description" id="layer-description"></div></div>

                </div>
                <div class="sidebar-foot"><span class="dot-green"></span> <span id="storage-status">NOT SAVED · SIGN IN TO KEEP YOUR WORK</span> </div>
            </aside>
            <main class="center-column">
                <div class="map-titlebar"><div class="map-title-copy"><div class="titlebar-kicker"><span class="titlebar-live-dot"></span> EXPLORE · PLAN · ANALYZE <span>/</span> JEZERO REGION</div><div class="map-title">Explore Jezero <span class="map-title-small">/ Mars</span></div></div><div class="map-title-actions"><div class="map-data-badge"><span class="map-source-eyebrow">CURRENT IMAGERY</span><strong id="map-source-name">VIKING GLOBAL</strong></div><span class="map-zoom-text" id="zoom-text">ZOOM 7</span><button class="btn btn-outline map-focus-btn" data-action="focus-mode" aria-pressed="false" title="Expand map workspace"><span aria-hidden="true">⛶</span> <span>Focus map</span></button></div></div>
                <div class="map-wrap"><div class="map-root" id="map-root" role="region" tabindex="-1" aria-label="Interactive Mars map. Draw routes with map tools or enter waypoint coordinates manually."></div><button type="button" class="panel-toggle panel-toggle-left" data-action="toggle-left" aria-label="Hide left panel" aria-pressed="false">‹</button><button type="button" class="panel-toggle panel-toggle-right" data-action="toggle-right" aria-label="Hide right panel" aria-pressed="false">›</button><div class="map-context-menu" id="map-context-menu" role="menu" aria-label="Map actions" hidden><button type="button" role="menuitem" data-context-action="edit-waypoint">✎ Edit waypoint</button><button type="button" role="menuitem" data-context-action="delete-waypoint">× Delete waypoint</button><button type="button" role="menuitem" data-context-action="edit-observation">✎ Edit observation</button><button type="button" role="menuitem" data-context-action="delete-observation">× Delete observation</button><button type="button" role="menuitem" data-context-action="add-waypoint">＋ Place waypoint here</button><button type="button" role="menuitem" data-context-action="add-note">◇ Add field note here</button></div><div class="map-top-overlay"><div class="mode-indicator"><span class="indicator-symbol" aria-hidden="true">⌖</span><span id="mode-description">Explore mode · drag to navigate</span></div><div class="planet-tag"><span class="planet-tag-indicator"></span> PLANET MARS <span>·</span> JEZERO</div></div><div class="mobile-map-toolbar" role="group" aria-label="Map editing tools"><button data-mode="pan" class="active" aria-pressed="true">↔ Explore</button><button data-mode="draw" aria-pressed="false">✎ Draw</button><button data-mode="edit" aria-pressed="false">◎ Move</button><button data-mode="observe" aria-pressed="false">✧ Note</button></div><div class="map-controls"><button data-action="zoom-in" title="Maximum map detail" aria-label="Zoom in" disabled>＋</button><button data-action="zoom-out" title="Zoom out" aria-label="Zoom out">−</button><span class="control-break"></span><button data-action="focus-route" title="Fit active route" aria-label="Fit active route">⌖</button><button data-action="reset-map" title="Reset map" aria-label="Reset map">⟲</button><span class="control-break"></span><button data-action="open-3d" class="map-3d-toggle" title="3D terrain view" aria-label="Open 3D terrain view">3D</button></div><div class="map-bottom-overlay"><div class="live-coordinate" id="live-coordinates">18.44460° N · 77.45090° E</div><span class="map-scale">SPHERICAL DISTANCE MODEL</span></div></div>
                <div class="bottom-area"><div class="bottom-section-header"><div><span class="section-label">ROUTE COMPARISON</span><p>Compare route distances. Shorter does not necessarily mean safer.</p></div><div class="bottom-section-actions"><button class="btn btn-quiet small" data-action="show-route-guide">How to choose a route</button><button class="btn btn-outline small" data-action="simulate-detour">↗ Simulate a detour</button></div></div><div class="route-comparison" id="route-comparison"></div></div>
            </main>
                        <aside class="sidebar sidebar-right" id="right-sidebar">
                <div class="right-tabs" role="tablist" aria-label="Scientific information">
<button id="tab-analytics" class="right-tab active" role="tab" aria-controls="analytics-panel" tabindex="0" data-tab="analytics" aria-selected="true">ANALYTICS</button><button id="tab-notes" class="right-tab" role="tab" aria-controls="notes-panel" tabindex="-1" data-tab="field-notes" aria-selected="false">FIELD NOTES</button></div>
                <div class="sidebar-content" id="analytics-panel" role="tabpanel" aria-labelledby="tab-analytics"><div class="panel-section"><div class="panel-title-row"><span class="section-label">MISSION TELEMETRY</span><span class="tiny-pill amber">PLANNED</span></div><div class="metric-grid"><div class="metric-card"><span>ACTIVE ROUTE</span><strong id="metric-distance">—</strong><small>Surface distance <span class="why-tag why-tag-calculated">Calculated</span></small></div><div class="metric-card"><span>WAYPOINTS</span><strong id="metric-waypoints">0</strong><small>Planned stops <span class="why-tag why-tag-scenario">User plan</span></small></div><div class="metric-card"><span>ALTERNATIVES</span><strong id="metric-routes">0</strong><small>Total routes</small></div><div class="metric-card"><span>OBSERVATIONS</span><strong id="metric-observations">0</strong><small>User annotations <span class="why-tag why-tag-scenario">User note</span></small></div></div></div>
                    <div class="panel-section"><div class="panel-title-row"><span class="section-label">SEGMENT DISTANCES</span><span class="small-muted">METERS</span></div><div id="segment-chart"></div><div class="mobile-comparison"><div class="panel-title-row" style="margin-top:24px"><span class="section-label">ROUTE COMPARISON</span></div><div class="route-comparison" id="route-comparison-mobile"></div></div><p class="data-note">Measured from user-selected coordinates using a spherical Mars radius of 3,396.19 km. No terrain elevation corrections.</p></div>
                    <div class="panel-section"><div class="panel-title-row"><span class="section-label">ROUTE CONNECTIVITY GRAPH</span><span class="tiny-pill">GRAPH THEORY</span></div><p class="section-help">Graph of user-created waypoints and route segments, with Mars spherical-distance edge weights. An abstract diagram, not a geographic route map.</p><div id="route-connectivity-graph"></div></div>
                    <div class="panel-section"><div class="panel-title-row"><span class="section-label">ROUTE INSPECTOR</span><span class="tiny-pill amber">REVIEW</span></div><p class="section-help">Transparent checks on geometry and user notes. Not a terrain safety certification.</p><div id="route-inspector" class="inspection-list"></div></div>
                    <div class="panel-section"><div class="panel-title-row"><span class="section-label">WAYPOINT COORDINATES</span><span class="small-muted" id="point-summary"></span></div><div id="waypoint-list" class="waypoint-list"></div></div>
                    <div class="panel-section"><div class="panel-title-row"><span class="section-label">DATA SOURCES</span><span class="tiny-pill">NASA</span></div><div class="evidence-item"><span class="evidence-dot"></span><div><strong>NASA Mars Trek imagery</strong><small>Viking MDIM 2.1 global mosaic, HiRISE Jezero 25 cm orthomosaic, MOLA/HRSC shaded relief (visual only, not elevation)</small></div></div><div class="evidence-item"><span class="evidence-dot"></span><div><strong>Jezero CTX elevation model</strong><small>USGS Astrogeology, Fergason et al. 2020 · <a href="https://doi.org/10.5066/P906QQT8" target="_blank" rel="noopener noreferrer">DOI 10.5066/P906QQT8 ↗</a></small></div></div><div class="evidence-item"><span class="evidence-dot yellow"></span><div><strong>Elevation analysis</strong><small>Uses numeric DEM grids, never image colors.</small></div></div><div class="evidence-item"><span class="evidence-dot yellow"></span><div><strong>Project credits</strong><small><a href="https://github.com/KiyamaPaD/Mars-Atlas/blob/main/docs/AI_USE_AND_SOURCES.md" target="_blank" rel="noopener noreferrer">Development methods and contributors ↗</a></small></div></div><div class="evidence-item"><span class="evidence-dot yellow"></span><div><strong>What-if scenarios</strong><small>Modeled alternatives do not establish safe traversability.</small></div></div><a class="source-link" href="https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars" target="_blank" rel="noopener noreferrer">View NASA layer documentation ↗</a></div>
                    <div class="panel-section"><div class="panel-title-row"><span class="section-label">MISSION CHECKPOINTS</span><span class="tiny-pill">CHECKPOINT HISTORY</span></div><p class="section-help">Save a complete manual checkpoint before changing routes. Restore an earlier plan whenever needed.</p><button class="btn btn-outline wide" data-action="save-checkpoint">＋ Save checkpoint</button><div id="checkpoint-list" class="checkpoint-list"></div></div>

                </div>
                <div class="sidebar-content" id="notes-panel" role="tabpanel" aria-labelledby="tab-notes" hidden><div class="panel-section"><div class="panel-title-row"><span class="section-label">OBSERVATION LOG</span><span class="tiny-pill">USER ANNOTATIONS</span></div><p class="section-help">Select Observe, then click the map to add a georeferenced note. Notes are unverified until independently checked.</p><div id="observation-list" class="observation-list"></div></div></div>
                <div class="right-footer"><button class="btn btn-outline" data-action="export-json">↓ Mission JSON</button><button class="btn btn-outline" data-action="export-geojson">↓ GeoJSON</button><button class="btn btn-outline" data-action="export-brief">↓ Brief</button></div>
            </aside>
        </div>
        <footer class="global-footer"><span>© 2026 INFOTRONX HORIZON · MARS ATLAS · <nav class="legal-links" aria-label="Legal"><a href="./legal.html#terms">Terms</a><a href="./legal.html#privacy">Privacy</a><a href="./legal.html#cookies">Cookies</a><a href="./legal.html#credits">Credits</a></nav></span><span>Planning tool · Terrain hazards are not assessed</span></footer>
        <nav class="mobile-dock" aria-label="Mobile workspace navigation"><button data-action="show-map" class="mobile-dock-btn active" aria-pressed="true"><span aria-hidden="true">⌖</span> Map</button><button data-action="show-planner" class="mobile-dock-btn" aria-pressed="false"><span aria-hidden="true">☷</span> Planner</button><button data-action="show-analytics" class="mobile-dock-btn" aria-pressed="false"><span aria-hidden="true">◫</span> Science</button><button data-action="show-guide" class="mobile-dock-btn"><span aria-hidden="true">?</span> Help</button></nav><button type="button" class="mobile-panel-scrim" data-action="show-map" aria-label="Close panel" hidden></button>
        <div class="toast-stack" id="toasts" aria-live="polite" aria-atomic="false"></div>
        <dialog class="modal guide-modal" id="guide-modal" aria-labelledby="guide-title"><div class="modal-header"><span class="section-label">FIELD OPERATIONS / QUICK GUIDE</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close guide">×</button></div><h2 id="guide-title">Your mission starts here.</h2><p>Use the map directly to build and inspect a mission plan in three steps.</p><div class="guide-steps"><div><span>01</span><div><strong>Draw your path</strong><p>Choose Draw, then tap the map to place waypoints. Use Move to adjust them.</p></div></div><div><span>02</span><div><strong>Study the route</strong><p>Open Science to compare distance, read route checks and inspect observations.</p></div></div><div><span>03</span><div><strong>Save and share</strong><p>Mission changes save locally. Create checkpoints, export data or share a link.</p></div></div></div><div class="guide-shortcuts"><strong>Keyboard shortcuts</strong><span>D · Draw</span><span>M · Move</span><span>E · Explore</span><span>N · Observe</span><span>Ctrl+Z / Ctrl+Y · Undo / Redo</span><span>Right click · Map actions</span><span>Esc · Explore / close panel</span></div><div class="guide-disclaimer">Routes are analytical plans, not certified for real astronaut navigation.</div><div class="dialog-actions"><button class="btn btn-accent" data-action="close-modal">Start exploring ↗</button></div></dialog>
        <dialog class="modal guide-modal" id="route-guide-modal" aria-labelledby="route-guide-title"><div class="modal-header"><span class="section-label">ROUTE PLANNING / HOW TO CHOOSE</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close route guide">×</button></div><h2 id="route-guide-title">Choosing between routes</h2><p>The app compares the routes you create. It does not decide for you, and it picks the best of the options you calculated, not a proven optimum.</p><div class="guide-steps"><div><span>01</span><div><strong>Decide what matters most</strong><p>Shortest distance, gentlest slopes, or the least ground without elevation data. Write it down; it is the rule you will judge every route by.</p></div></div><div><span>02</span><div><strong>Build two or three alternatives</strong><p>Draw a first route, then use Duplicate and move waypoints, or Simulate a detour. Keep the same start and end so the routes are comparable.</p></div></div><div><span>03</span><div><strong>Compare distance</strong><p>Route comparison shows the surface distance of each route, calculated on Mars's radius. A shorter route is not automatically safer.</p></div></div><div><span>04</span><div><strong>Check slope and elevation</strong><p>Open the Terrain tab. Slopes and climbs are only computed where elevation data exists. If a stretch has no data, treat it as unknown, never as safe.</p></div></div><div><span>05</span><div><strong>Avoid exclusion zones</strong><p>Mark any area you want to stay out of and let the route recalculate. A route that crosses one has to justify why.</p></div></div><div><span>06</span><div><strong>Choose and record why</strong><p>Pick the route that best fits the rule from step 01, and add a field note with the reason. This is a planning aid, not a navigation or safety approval.</p></div></div></div><div class="dialog-actions"><button class="btn btn-accent" type="button" data-action="close-modal">Got it</button></div></dialog>
        <dialog class="modal" id="mission-modal"><form method="dialog" id="mission-form"><div class="modal-header"><span class="section-label" id="modal-eyebrow">NEW MISSION</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close dialog">×</button></div><h2 id="modal-title">Create a mission</h2><p id="modal-hint">Plan your next Marswalk.</p><label class="field-label" for="mission-input">MISSION NAME</label><input id="mission-input" class="field-input" maxlength="90" autocomplete="off" required /><div id="mission-description-field"><label class="field-label" for="mission-description-input">MISSION DESCRIPTION</label><textarea id="mission-description-input" class="field-input" rows="3" maxlength="300" placeholder="Mission purpose, objectives or field notes"></textarea></div><div class="dialog-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button id="mission-submit" type="submit" class="btn btn-accent">Create mission</button></div></form></dialog>
        <dialog class="modal" id="observation-modal"><form method="dialog" id="observation-form"><div class="modal-header"><span class="section-label">GEOREFERENCED NOTE</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close dialog">×</button></div><h2>Record observation</h2><p id="observation-location"></p><label class="field-label" for="observation-title">TITLE</label><input id="observation-title" class="field-input" maxlength="80" required placeholder="Sample site, landmark, hazard hypothesis..."/><label class="field-label" for="observation-note">FIELD NOTES</label><textarea id="observation-note" class="field-input" maxlength="500" rows="4" placeholder="Describe what you observed. Mark uncertainty clearly."></textarea><label class="field-label" for="observation-source">SOURCE / EVIDENCE REFERENCE (OPTIONAL)</label><input id="observation-source" class="field-input" maxlength="160" placeholder="Example: NASA Mars Trek / user field note"/><div class="dialog-actions"><button type="button" class="btn btn-outline" data-action="delete-editing-observation" id="observation-delete" hidden>Delete note</button><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-accent" id="observation-submit">Save note</button></div></form></dialog>
        <dialog class="modal" id="coordinate-modal"><form method="dialog" id="coordinate-form"><div class="modal-header"><span class="section-label">MANUAL INPUT</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close dialog">×</button></div><h2>Enter coordinates</h2><p>Enter a precise Mars position in planetocentric east-positive decimal degrees.</p><label class="field-label" for="latitude-input">LATITUDE (−90 TO 90)</label><input id="latitude-input" class="field-input" type="number" step="any" min="-90" max="90" required placeholder="18.4446"/><label class="field-label" for="longitude-input">LONGITUDE (−180 TO 180)</label><input id="longitude-input" class="field-input" type="number" step="any" min="-180" max="180" required placeholder="77.4509"/><div class="dialog-actions"><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-accent"><span id="coordinate-submit-label">Add waypoint</span></button></div></form></dialog>
        <dialog class="modal waypoint-editor-modal" id="waypoint-editor-modal" aria-labelledby="waypoint-editor-title"><form id="waypoint-editor-form"><div class="modal-header"><span class="section-label">WAYPOINT / MANUAL EDITOR V2</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close waypoint editor">×</button></div><h2 id="waypoint-editor-title">Edit waypoint</h2><p>Every change belongs to your mission and can be undone.</p><label class="field-label" for="waypoint-name-input">WAYPOINT NAME</label><input id="waypoint-name-input" class="field-input" maxlength="80" autocomplete="off" placeholder="e.g. Delta sampling site"/><label class="field-label" for="waypoint-category-input">CATEGORY</label><select id="waypoint-category-input" class="field-input"></select><label class="field-label" for="waypoint-description-input">DESCRIPTION / PURPOSE</label><textarea id="waypoint-description-input" class="field-input" rows="3" maxlength="500" placeholder="What is this point for? Separate hypotheses from measured facts."></textarea><div class="waypoint-editor-grid"><div><label class="field-label" for="waypoint-icon-input">MARKER SHAPE</label><select id="waypoint-icon-input" class="field-input"></select></div><div><label class="field-label" for="waypoint-color-input">MARKER COLOR</label><input id="waypoint-color-input" class="field-input color-field" type="color" value="#ec9976"/></div></div><label class="editor-color-default"><input id="waypoint-use-route-color" type="checkbox" checked/> Use active route color</label><div class="waypoint-editor-grid"><div><label class="field-label" for="waypoint-lat-input">LATITUDE (°)</label><input id="waypoint-lat-input" class="field-input" type="number" step="any" min="-90" max="90" required/></div><div><label class="field-label" for="waypoint-lon-input">LONGITUDE (°)</label><input id="waypoint-lon-input" class="field-input" type="number" step="any" min="-180" max="180" required/></div></div><div class="dialog-actions waypoint-editor-actions"><button type="button" class="btn btn-outline" data-action="delete-editing-waypoint">Delete point</button><button type="button" class="btn btn-outline" data-action="close-modal">Cancel</button><button type="submit" class="btn btn-accent">Save waypoint</button></div></form></dialog>
        <dialog class="modal library-modal" id="library-modal"><div class="modal-header"><span class="section-label">MISSION LIBRARY</span><button class="modal-x" type="button" data-action="close-modal" aria-label="Close dialog">×</button></div><h2>Your saved missions</h2><p>Your missions are saved on this device. Export a JSON backup to keep a copy.</p><div class="library-list" id="library-list"></div><div class="dialog-actions"><label class="btn btn-outline file-input-button">↑ Import JSON<input type="file" accept=".json,application/json" id="import-json" hidden /></label><button class="btn btn-accent" data-action="new-mission">＋ New mission</button></div></dialog>
    </div>`;

const get = selector => document.querySelector(selector);
let currentMode = "pan";
let modalAction = "new-mission";
let observationCoordinate = null;
let editingObservationId = null;
let editingWaypointId = null;
let mapContextTarget = null;

get("#waypoint-category-input").innerHTML = WAYPOINT_CATEGORIES.map(item =>
    `<option value="${item.id}">${safe(item.label)}</option>`).join("");
get("#waypoint-icon-input").innerHTML = MARKER_ICONS.map(item =>
    `<option value="${item.id}">${item.symbol} ${safe(item.label)}</option>`).join("");


function notify(message)
{
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.textContent = message;
    get("#toasts").appendChild(toast);
    setTimeout(() => toast.remove(), 4500);
}

function updateImageryLabel(map)
{
    const source = map.getImageryLayer();
    const overview = source.id !== map.layer.id;
    get("#map-source-name").textContent = map.layer.id === "hirise" && map.zoom >= 9
        ? "HIRISE + CTX" : map.layer.id === "hirise" && map.zoom === 8
            ? "VIKING OVERVIEW" : source.name.toUpperCase();
    get(".map-source-eyebrow").textContent = overview ? "GLOBAL OVERVIEW" : "CURRENT IMAGERY";
    get(".map-data-badge").title = map.layer.id === "hirise" && map.zoom >= 9
        ? "NASA Jezero CTX context (6 m/pixel) over Viking, with HiRISE detail (25 cm/pixel) where available."
        : overview ? "Viking global overview; NASA CTX and HiRISE are available at higher zoom."
            : source.description;
}

const map = new MarsMap(get("#map-root"), store, {
    onCoordinates: point => get("#live-coordinates").textContent = `${formatCoordinate(point.lat, "lat")} · ${formatCoordinate(point.lon, "lon")}`,
    onLayerChange: layer =>
    {
        updateImageryLabel(map);
        get("#layer-description").textContent = layer.description;
    },
    onViewChange: (_, zoom) =>
    {
        updateImageryLabel(map);
        get("#zoom-text").textContent = `ZOOM ${zoom}`;
        const zoomIn = get("[data-action='zoom-in']");
        zoomIn.disabled = zoom >= map.layerMaxZoom;
        zoomIn.title = zoomIn.disabled ? "Maximum available map detail" : "Zoom in";
        get("[data-action='zoom-out']").disabled = zoom <= 3;
    },
    onWaypointSelect: id => openWaypointEditor(id),
    onObservationSelect: id => openObservationEditor(id),
    onContextMenu: details => showMapContextMenu(details),
    onMapClick: (point, mode) =>
{
        if (mode === "draw")
        {
            if (!store.addPoint(point))
            {
                notify(`Route limit reached (${MAX_POINTS_PER_ROUTE} points).`);
            }
        }
        else if (mode === "observe")
        {
            openObservationAt(point);
        }
    }
});

let missionCopilot = null;
const scienceWorkbench = initScienceWorkbench({ store, map, notify,
    onTerrainChange: () =>
    {
        analyticsNavigation?.refresh();
        missionCopilot?.refresh();
    }
});
const cloudWorkspace = mountCloudWorkspace({ store, notify });
missionCopilot = mountMissionCopilot({
    panel: get("#analytics-panel"),
    before: get("#analytics-panel").firstElementChild,
    store, getDem: () => scienceWorkbench.numericDem,
});
const analyticsNavigation = setupAnalyticsNavigation(get("#analytics-panel"), {
    getState: () => ({
        waypoints: store.activeRoute.points.length,
        routes: store.current.routes.length,
        demLoaded: scienceWorkbench.isDemReady
    }),
    onDraw: () => get('[data-mode="draw"]').click(),
    onLoadDem: async () =>
    {
        await scienceWorkbench.loadBundledDem();
        analyticsNavigation.refresh();
    },
    onAddRoute: () => get('[data-action="new-route"]').click()
});

function closeMapContextMenu()
{
    get("#map-context-menu").hidden = true;
    mapContextTarget = null;
}

function showMapContextMenu(details)
{
    const menu = get("#map-context-menu");
    mapContextTarget = details;

    menu.querySelectorAll("[data-context-action]").forEach(button =>
    {
        const action = button.dataset.contextAction;

        if (["edit-waypoint", "delete-waypoint"].includes(action))
        {
            button.hidden = !details.pointId;
        }
        else if (["edit-observation", "delete-observation"].includes(action))
        {
            button.hidden = !details.observationId;
        }
        else
        {
            button.hidden = Boolean(details.pointId || details.observationId);
        }
    });

    menu.style.left = Math.max(8, Math.min(details.clientX, window.innerWidth - 246)) + "px";
    menu.style.top = Math.max(8, Math.min(details.clientY, window.innerHeight - 178)) + "px";
    menu.hidden = false;
    menu.querySelector("button:not([hidden])")?.focus();
}

function openObservationAt(point)
{
    editingObservationId = null;
    observationCoordinate = point;
    get("#observation-form").reset();
    get("#observation-modal h2").textContent = "Record observation";
    get("#observation-submit").textContent = "Save note";
    get("#observation-delete").hidden = true;
    get("#observation-location").textContent = `${formatCoordinate(point.lat, "lat")} · ${formatCoordinate(point.lon, "lon")}`;
    get("#observation-modal").showModal();
}

function openObservationEditor(id)
{
    const observation = store.current.observations.find(item => item.id === id);

    if (!observation)
    {
        return;
    }

    closeMapContextMenu();
    editingObservationId = id;
    observationCoordinate = { lat: observation.lat, lon: observation.lon };
    get("#observation-form").reset();
    get("#observation-modal h2").textContent = "Edit field observation";
    get("#observation-submit").textContent = "Save changes";
    get("#observation-delete").hidden = false;
    get("#observation-title").value = observation.title;
    get("#observation-note").value = observation.note;
    get("#observation-source").value = observation.source;
    get("#observation-location").textContent = `${formatCoordinate(observation.lat, "lat")} · ${formatCoordinate(observation.lon, "lon")}`;
    get("#observation-modal").showModal();
    get("#observation-title").focus();
}

function openWaypointEditor(id)
{
    const index = store.activeRoute.points.findIndex(point => point.id === id);

    if (index < 0)
    {
        return;
    }

    const point = store.activeRoute.points[index];
    editingWaypointId = id;
    closeMapContextMenu();
    get("#waypoint-editor-title").textContent = waypointLabel(point, index);
    get("#waypoint-name-input").value = point.name || "";
    get("#waypoint-category-input").value = point.category || "navigation";
    get("#waypoint-description-input").value = point.description || "";
    get("#waypoint-icon-input").value = normalizeMarkerIcon(point.icon);
    get("#waypoint-color-input").value = point.color || store.activeRoute.color;
    get("#waypoint-use-route-color").checked = !point.color;
    get("#waypoint-color-input").disabled = !point.color;
    get("#waypoint-lat-input").value = point.lat;
    get("#waypoint-lon-input").value = point.lon;
    get("#waypoint-editor-modal").showModal();
    get("#waypoint-name-input").focus();
}

function renderRoutes()
{
    get("#route-count").textContent = String(store.current.routes.length).padStart(2, "0");
    get("#route-list").innerHTML = store.current.routes.map(route =>
{
        const active = store.current.activeRouteId === route.id;
        return `<button class="route-item ${active ? "selected" : ""}" data-select-route="${safe(route.id)}" aria-pressed="${active}"><span class="route-color" style="background:${route.color}"></span><span class="route-body"><strong>${safe(route.name)}</strong><small>${route.points.length} waypoint${route.points.length === 1 ? "" : "s"} · ${formatDistance(analyzeRoute(route.points).totalDistance)}</small></span>${active ? "<span class='route-selected-icon'>✓</span>" : ""}</button>`;
    }).join("");
}

function renderLayers()
{
    get("#layer-buttons").innerHTML = MAP_LAYERS.map(layer => `<button class="layer-btn ${map.layer.id === layer.id ? "active" : ""}" data-layer="${layer.id}" aria-pressed="${map.layer.id === layer.id}"><span class="layer-orbit">◉</span><span><strong>${safe(layer.name)}</strong><small>${safe(layer.agency)}</small></span>${map.layer.id === layer.id ? "<span class='layer-check'>✓</span>" : ""}</button>`).join("");
    get("#layer-description").textContent = map.layer.description;
}

function renderWaypoints()
{
    get("#point-summary").textContent = `${store.activeRoute.points.length} PLACED`;
    get("#waypoint-list").innerHTML = store.activeRoute.points.length ? store.activeRoute.points.map((point, index) =>
    {
        const name = waypointLabel(point, index);
        const coordinates = `${formatCoordinate(point.lat, "lat")} · ${formatCoordinate(point.lon, "lon")}`;

        return `<article class="waypoint-row" data-waypoint-row="${safe(point.id)}">
            <div class="waypoint-main">
                <span class="waypoint-index">${String(index + 1).padStart(2, "0")}</span>
                <div class="waypoint-coordinates">
                    <strong title="${safe(name)}">${safe(name)}</strong>
                    <small>${safe(categoryLabel(point.category))}</small>
                    <span class="waypoint-location" title="${safe(coordinates)}">${safe(coordinates)}</span>
                </div>
            </div>
            <div class="waypoint-actions" aria-label="Actions for ${safe(name)}">
                <button class="edit-point-btn point-order-btn" title="Move waypoint earlier" aria-label="Move waypoint earlier" data-move-point="${safe(point.id)}" data-point-direction="-1" ${index === 0 ? "disabled" : ""}>↑</button>
                <button class="edit-point-btn point-order-btn" title="Move waypoint later" aria-label="Move waypoint later" data-move-point="${safe(point.id)}" data-point-direction="1" ${index === store.activeRoute.points.length - 1 ? "disabled" : ""}>↓</button>
                <select class="marker-icon-select" data-point-icon="${safe(point.id)}" title="Change marker icon" aria-label="Change ${safe(name)} icon">
                    ${MARKER_ICONS.map(icon => `<option value="${icon.id}" ${normalizeMarkerIcon(point.icon) === icon.id ? "selected" : ""}>${icon.symbol} ${icon.label}</option>`).join("")}
                </select>
                <button class="edit-point-btn waypoint-edit" title="Edit waypoint details" aria-label="Edit ${safe(name)}" data-edit-point="${safe(point.id)}">Edit</button>
                <button class="remove-btn" title="Delete waypoint" aria-label="Delete ${safe(name)}" data-delete-point="${safe(point.id)}">×</button>
            </div>
        </article>`;
    }).join("") : `<div class="empty-inline">Draw your first waypoint on the map.</div>`;
}
function renderObservations()
{
    get("#observation-list").innerHTML = store.current.observations.length ? store.current.observations.map(observation => `<div class="note-card"><div class="note-head"><strong>${safe(observation.title)}</strong><button class="edit-point-btn" data-edit-observation="${safe(observation.id)}" title="Edit observation" aria-label="Edit observation">Edit</button><select class="marker-icon-select" data-observation-icon="${safe(observation.id)}" title="Change observation icon" aria-label="Change observation marker icon">${MARKER_ICONS.map(icon => `<option value="${icon.id}" ${normalizeMarkerIcon(observation.icon || "diamond") === icon.id ? "selected" : ""}>${icon.symbol} ${icon.label}</option>`).join("")}</select><button class="remove-btn" title="Delete note" aria-label="Delete note" data-delete-observation="${safe(observation.id)}">×</button></div><p>${safe(observation.note || "No details provided.")}</p><small>${formatCoordinate(observation.lat, "lat")} · ${formatCoordinate(observation.lon, "lon")}</small><div class="note-origin">${safe(observation.source)} · USER-REPORTED / UNVERIFIED</div><button class="btn btn-outline note-waypoint" data-observation-waypoint="${safe(observation.id)}" title="Append this observation to the active route">＋ Use as waypoint</button></div>`).join("") : `<div class="empty-inline">No observations yet. Mark something worth investigating.</div>`;
}

function renderInspector()
{
    const container = get("#route-inspector");
    const report = inspectRoute(store.activeRoute, store.current.observations);
    const findings = report.findings.map(finding => `<div class="inspection-item ${finding.severity}"><strong>${safe(finding.title)}</strong><p>${safe(finding.detail)}</p></div>`);
    const nearby = report.nearby.slice(0, 5).map(entry => `<div class="inspection-item linked"><strong>${safe(entry.observation.title)}</strong><p>${formatDistance(entry.distance)} from route · user-reported, unverified</p></div>`);
    container.innerHTML = [...findings, ...nearby].join("") || `<div class="inspection-item"><strong>Basic geometry ready</strong><p>Scientific traversal validation is still required.</p></div>`;
}

function renderCheckpoints()
{
    const items = store.current.checkpoints;
    const root = get("#checkpoint-list");

    if (!items.length)
    {
        root.innerHTML = `<div class="empty-inline">No checkpoints yet. Save the current plan before editing.</div>`;
        return;
    }

    root.innerHTML = items.map(checkpoint => `<div class="checkpoint-item"><div class="checkpoint-info"><strong>${safe(checkpoint.label)}</strong><small>${checkpoint.routes.length} route${checkpoint.routes.length === 1 ? "" : "s"} · ${checkpoint.observations.length} note${checkpoint.observations.length === 1 ? "" : "s"} · ${safe(checkpoint.createdAt.slice(0, 16).replace("T", " "))} UTC</small></div><div class="checkpoint-actions"><button class="btn btn-outline small" data-restore-checkpoint="${safe(checkpoint.id)}">Restore</button><button class="remove-btn" data-delete-checkpoint="${safe(checkpoint.id)}" aria-label="Delete checkpoint">×</button></div></div>`).join("");
}

function renderLibrary()
{
    get("#library-list").innerHTML = store.missions.map(mission => `<div class="library-entry"><button class="library-item ${mission.id === store.activeId ? "active" : ""}" data-select-mission="${safe(mission.id)}"><span class="library-glyph">◎</span><span><strong>${safe(mission.title)}</strong><small>${mission.routes.length} route${mission.routes.length === 1 ? "" : "s"} · ${mission.observations.length} note${mission.observations.length === 1 ? "" : "s"}</small></span><span>↗</span></button><button class="remove-btn delete-mission" data-delete-mission="${safe(mission.id)}" title="Delete this mission" aria-label="Delete this mission">×</button></div>`).join("");
}

function render()
{
    const mission = store.current;
    const route = store.activeRoute;
    const analysis = analyzeRoute(route.points);
    get("#mission-heading").textContent = mission.title;
    get("#mission-description").textContent = mission.description;
    const twoDigits = value => String(Math.round(value)).padStart(2, "0");
    animateNumber(get("#metric-distance"), analysis.totalDistance, formatDistance);
    animateNumber(get("#metric-waypoints"), analysis.count, twoDigits, 400);
    animateNumber(get("#metric-routes"), mission.routes.length, twoDigits, 400);
    animateNumber(get("#metric-observations"), mission.observations.length, twoDigits, 400);
    renderRoutes();
    renderLayers();
    renderWaypoints();
    renderObservations();
    renderLibrary();
    renderSegmentChart(get("#segment-chart"), route);
    drawRouteGraph(get("#route-connectivity-graph"), mission.routes, mission.activeRouteId);
    renderInspector();
    renderCheckpoints();
    get("#storage-status").textContent = !store.persistLocal ? "NOT SAVED · SIGN IN TO KEEP YOUR WORK" : store.lastSaveSucceeded ? "SAVED ON THIS DEVICE" : "SAVE FAILED · EXPORT A BACKUP";
    get("#active-route-color").value = route.color;
    get("[data-action='undo-edit']").disabled = !store.canUndo;
    get("[data-action='redo-edit']").disabled = !store.canRedo;
    renderRouteComparison(get("#route-comparison"), mission.routes, mission.activeRouteId);
    renderRouteComparison(get("#route-comparison-mobile"), mission.routes, mission.activeRouteId);
    scienceWorkbench.render();
    analyticsNavigation.refresh();
    map.render();
}

function setMode(mode)
{
    currentMode = mode;
    map.setMode(mode);
    document.querySelectorAll("button[data-mode]").forEach(button =>
    {
        const active = button.dataset.mode === mode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });
    const descriptions = { pan: "Explore mode · drag to navigate", draw: "Draw mode · click to add a waypoint", edit: "Move mode · drag a route waypoint", observe: "Observe mode · click to place a note" };
    get("#mode-description").textContent = descriptions[mode];
    get("#mode-description").parentElement.classList.toggle("tool-active", mode !== "pan");
}

function setMobilePanel(panel)
{
    const shell = get("#mars-shell");
    shell.dataset.mobilePanel = panel;
    const scrim = get(".mobile-panel-scrim");
    scrim.hidden = panel === "map";

    document.querySelectorAll(".mobile-dock-btn[data-action^='show-']").forEach(button =>
    {
        const active = button.dataset.action === `show-${panel}`;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
    });

    requestAnimationFrame(() => map.render());
}

function toggleFocusMode()
{
    const shell = get("#mars-shell");
    const focused = shell.classList.toggle("focus-map");
    const button = get("[data-action='focus-mode']");
    button.setAttribute("aria-pressed", String(focused));
    button.querySelector("span:last-child").textContent = focused ? "Exit focus" : "Focus map";
    requestAnimationFrame(() => map.render());
}

function openMissionModal(action)
{
    modalAction = action;
    get("#modal-eyebrow").textContent = action === "new-mission" ? "NEW MISSION" : action === "rename-route" ? "RENAME ROUTE" : "EDIT MISSION";
    get("#modal-title").textContent = action === "new-mission" ? "Create a mission" : action === "rename-route" ? "Rename active route" : "Edit mission details";
    get("#mission-submit").textContent = action === "new-mission" ? "Create mission" : action === "rename-route" ? "Rename route" : "Rename mission";
    get("#mission-input").value = action === "new-mission" ? "" : action === "rename-route" ? store.activeRoute.name : store.current.title;
    get("#mission-description-field").hidden = action === "rename-route";
    get("#mission-description-input").value = action === "new-mission" ? "" : store.current.description;
    get("#mission-modal").showModal();
    get("#mission-input").focus();
}

function createMissionBrief(mission)
{
    const lines = [
        `# MARS ATLAS — ${mission.title}`,
        "",
        `Region: Jezero Crater, Mars`,
        `Description: ${mission.description}`,
        `Updated: ${mission.updatedAt}`,
        "",
        "## Planned routes"
    ];

    for (const route of mission.routes)
    {
        const analysis = analyzeRoute(route.points);
        const report = inspectRoute(route, mission.observations);
        lines.push("", `### ${route.name}`, `Waypoints: ${route.points.length}`, `Spherical surface distance: ${formatDistance(analysis.totalDistance)}`);
        lines.push(`Inspection notes: ${report.findings.map(finding => finding.title).join(" | ") || "None"}`);

        if (route.terrainModel)
        {
            lines.push(`Unverified numeric DEM route: ${route.terrainModel.source}`);
            lines.push(`Modeled ascent: ${route.terrainModel.stats.ascentMeters.toFixed(1)} m; max adjacent-cell grade: ${route.terrainModel.stats.maxGradePercent.toFixed(1)}%.`);
            for (const zone of route.terrainModel.scenario?.exclusionZones || [])
            {
                lines.push(`What-if: exclude a ${zone.radiusMeters} m radius around user note ${zone.title} (${formatCoordinate(zone.lat, "lat")}, ${formatCoordinate(zone.lon, "lon")}); not a NASA-verified obstacle.`);
            }

            lines.push("The imported DEM source and route have NOT been independently scientifically validated.");
        }

        route.points.forEach((point, index) => lines.push(`${index + 1}. ${waypointLabel(point, index)} [${categoryLabel(point.category)}] — ${formatCoordinate(point.lat, "lat")}, ${formatCoordinate(point.lon, "lon")}${point.description ? ` · ${point.description}` : ""}`));
    }

    lines.push("", "## Saved checkpoints", `Local checkpoint count: ${mission.checkpoints?.length || 0}`);

    for (const checkpoint of mission.checkpoints || [])
    {
        lines.push(`- ${checkpoint.label} (${checkpoint.createdAt}): ${checkpoint.routes.length} routes, ${checkpoint.observations.length} observations`);
    }

    lines.push("", "## User observations");

    for (const observation of mission.observations)
    {
        lines.push(`- **${observation.title}** — ${formatCoordinate(observation.lat, "lat")}, ${formatCoordinate(observation.lon, "lon")}: ${observation.note || "No note"} (unverified · source: ${observation.source})`);
    }

    lines.push("", scienceWorkbench.getScenarioBrief());

    lines.push("", "## Scientific limitations", "Great-circle distances use a spherical Mars model with radius 3,396,190 m. Numeric DEM estimates, where imported, are user-provided and NOT independently authenticated. Resource scenarios are illustrative only. Routes are not certified for astronaut EVA.", "", "Data attribution: NASA/JPL Mars Trek — https://trek.nasa.gov/tiles/apidoc/trekAPI.html?body=mars");
    return lines.join("\n");
}

function exportJson()
{
    const filename = `mars-atlas-${store.current.id.slice(0, 8)}.json`;
    downloadFile(filename, JSON.stringify(store.current, null, 2));
    notify("Mission JSON exported.");
}

function openCopilot()
{
    get('#tab-analytics').click();
    const workflow = get('button[data-step="analyze"]');
    if (get('#mars-shell').dataset.step === 'explore') workflow?.click();
    setMobilePanel('analytics');
    missionCopilot.refresh();
    analyticsNavigation.openSection(missionCopilot.section);
}


async function shareMission()
{
    const link = createShareLink(store.current);

    if (link.length > 8000)
    {
        notify("Mission is too large for a reliable link. Export JSON instead.");
        return;
    }

    try
    {
        await navigator.clipboard.writeText(link);
        notify("Mission link copied. Anyone with this link can see the mission data inside it.");
    }
    catch
    {
        window.prompt("Copy the mission link. Anyone with this link can see the mission data inside it:", link);
    }
}

document.addEventListener("click", event =>
{
    const action = event.target.closest("[data-action]")?.dataset.action;
    const mode = event.target.closest("[data-mode]")?.dataset.mode;
    const layer = event.target.closest("[data-layer]")?.dataset.layer;
    const selectedRoute = event.target.closest("[data-select-route]")?.dataset.selectRoute;
    const selectedMission = event.target.closest("[data-select-mission]")?.dataset.selectMission;
    const missionToDelete = event.target.closest("[data-delete-mission]")?.dataset.deleteMission;
    const pointToDelete = event.target.closest("[data-delete-point]")?.dataset.deletePoint;
    const pointToEdit = event.target.closest("[data-edit-point]")?.dataset.editPoint;
    const noteToDelete = event.target.closest("[data-delete-observation]")?.dataset.deleteObservation;
    const noteToEdit = event.target.closest("[data-edit-observation]")?.dataset.editObservation;
    const noteToWaypoint = event.target.closest("[data-observation-waypoint]")?.dataset.observationWaypoint;
    const pointToMove = event.target.closest("[data-move-point]")?.dataset.movePoint;
    const pointDirection = Number(event.target.closest("[data-point-direction]")?.dataset.pointDirection);
    const checkpointToRestore = event.target.closest("[data-restore-checkpoint]")?.dataset.restoreCheckpoint;
    const checkpointToDelete = event.target.closest("[data-delete-checkpoint]")?.dataset.deleteCheckpoint;
    const tab = event.target.closest("[data-tab]")?.dataset.tab;
    const contextAction = event.target.closest("[data-context-action]")?.dataset.contextAction;

    if (contextAction && mapContextTarget)
    {
        const target = mapContextTarget;
        closeMapContextMenu();

        if (contextAction === "edit-waypoint" && target.pointId)
        {
            openWaypointEditor(target.pointId);
        }
        else if (contextAction === "delete-waypoint" && target.pointId)
        {
            if (confirm("Delete this waypoint? You can use Undo to restore it."))
            {
                store.removePoint(target.pointId);
            }
        }
        else if (contextAction === "edit-observation" && target.observationId)
        {
            openObservationEditor(target.observationId);
        }
        else if (contextAction === "delete-observation" && target.observationId)
        {
            if (confirm("Delete this observation? Undo restores it if needed."))
            {
                store.deleteObservation(target.observationId);
                notify("Observation removed from the map.");
            }
        }
        else if (contextAction === "add-waypoint")
        {
            if (store.addPoint(target.coordinate))
            {
                openWaypointEditor(store.activeRoute.points.at(-1).id);
            }
            else
            {
                notify("Invalid coordinates or waypoint limit reached.");
            }
        }
        else if (contextAction === "add-note")
        {
            openObservationAt(target.coordinate);
        }

        return;
    }

    if (!event.target.closest("#map-context-menu"))
    {
        closeMapContextMenu();
    }

    if (action === "load-review-demo")
    {
        if (store.importMission(createJezeroReviewMission()))
        {
            map.focusRoute();
            scienceWorkbench.loadBundledDem();
            notify("Example mission opened.");
            setMobilePanel("analytics");
        }
        else
        {
            notify("The mission library is full (30). Export or remove an unused mission first.");
        }

        return;
    }

    if (mode)
    {
        setMode(mode);
    }

    if (layer)
    {
        map.setLayer(layer);
        renderLayers();
    }

    if (selectedRoute)
    {
        store.selectRoute(selectedRoute);
    }

    if (missionToDelete && confirm("Delete this mission from this browser? Export a backup first if needed."))
    {
        store.deleteMission(missionToDelete);
        map.focusRoute();
        notify("Mission removed from local library.");
    }

    if (selectedMission)
    {
        store.selectMission(selectedMission);
        get("#library-modal").close();
        map.focusRoute();
    }

    if (pointToEdit)
    {
        openWaypointEditor(pointToEdit);
    }

    if (pointToDelete)
    {
        store.removePoint(pointToDelete);
    }

    if (noteToEdit)
    {
        openObservationEditor(noteToEdit);
    }

    if (noteToDelete && confirm("Delete this observation? You can use Undo to restore it."))
    {
        store.deleteObservation(noteToDelete);
    }
    if (noteToWaypoint)
    {
        if (store.addObservationWaypoint(noteToWaypoint))
        {
            notify("Observation appended as a route waypoint. Source remains unverified.");
            map.focusRoute();
        }
        else
        {
            notify("Could not add this observation as a waypoint. Check the route limit.");
        }
    }

    if (pointToMove)
    {
        store.reorderPoint(pointToMove, pointDirection);
    }

    if (checkpointToRestore && confirm("Restore this checkpoint? The current unsaved changes will be replaced. Save another checkpoint first if needed."))
    {
        if (store.restoreCheckpoint(checkpointToRestore))
        {
            map.focusRoute();
            notify("Checkpoint restored. The saved checkpoint remains available.");
        }
    }

    if (checkpointToDelete && confirm("Delete this saved checkpoint?"))
    {
        store.deleteCheckpoint(checkpointToDelete);
    }

    if (tab)
    {
        get("#analytics-panel").hidden = tab !== "analytics";
        get("#notes-panel").hidden = tab !== "field-notes";
        document.querySelectorAll("[data-tab]").forEach(button =>
        {
            const active = button.dataset.tab === tab;
            button.classList.toggle("active", active);
            button.setAttribute("aria-selected", String(active));
            button.tabIndex = active ? 0 : -1;
        });
    }

    switch (action)
    {
        case "open-copilot": openCopilot(); break;
        case "show-guide":
            get("#guide-modal").showModal();
            break;
        case "show-route-guide":
            get("#route-guide-modal").showModal();
            break;
        case "show-map":
        case "show-planner":
        case "show-analytics":
            setMobilePanel(action.replace("show-", ""));
            break;
        case "focus-mode":
            toggleFocusMode();
            break;
        case "new-mission":
        case "rename-mission":
        case "rename-route":
            if (get("#library-modal").open)
            {
                get("#library-modal").close();
            }

            openMissionModal(action);
            break;
        case "open-library": get("#mission-hub-open")?.click(); break;
        case "close-modal":
            event.target.closest("dialog")?.close();
            editingWaypointId = null;
            editingObservationId = null;
            break;
        case "delete-editing-observation":
            if (editingObservationId && confirm("Delete this observation? Undo can restore it."))
            {
                store.deleteObservation(editingObservationId);
                get("#observation-modal").close();
                editingObservationId = null;
                observationCoordinate = null;
                notify("Observation removed from the map.");
            }
            break;
        case "delete-editing-waypoint":
            if (editingWaypointId && confirm("Delete this waypoint? You can use Undo to restore it."))
            {
                store.removePoint(editingWaypointId);
                get("#waypoint-editor-modal").close();
                editingWaypointId = null;
            }
            break;
        case "add-coordinates": get("#coordinate-form").reset(); get("#coordinate-modal h2").textContent = "Enter coordinates"; get("#coordinate-submit-label").textContent = "Add waypoint"; get("#coordinate-modal").showModal(); break;
        case "delete-route": if (store.current.routes.length < 2) { notify("Keep at least one route in the mission."); } else if (confirm("Delete the active route?")) { store.deleteRoute(store.activeRoute.id); } break;
        case "new-route": if (store.addRoute(`Route ${store.current.routes.length + 1}`)) { setMode("draw"); notify("New route created. Click the map to add waypoints."); } else { notify("Route limit reached (15). Export or start another mission."); } break;
        case "duplicate-route": if (store.duplicateRoute()) { setMode("edit"); notify("Route duplicated. Drag waypoints to create a comparison."); } else { notify("Route limit reached (15)."); } break;
        case "undo-point": store.undoPoint(); break;
        case "undo-edit": if (!store.undo()) notify("Nothing to undo in this mission."); break;
        case "redo-edit": if (!store.redo()) notify("Nothing to redo in this mission."); break;
        case "clear-route":
            if (store.activeRoute.points.length && confirm("Remove all waypoints from this route? Export a backup first if needed."))
            {
                store.clearActiveRoute();
                notify("Waypoints cleared from the active route.");
            }
            break;
        case "zoom-in": map.changeZoom(1); break;
        case "zoom-out": map.changeZoom(-1); break;
        case "focus-route": map.focusRoute(); break;
                case "reset-map": map.flyTo(JEZERO, 11); break;
        case "start-tutorial": tutorial.start(); break;
        case "toggle-left": togglePanel("left"); break;
        case "toggle-right": togglePanel("right"); break;
        case "open-3d":

            if (!document.querySelector(".map-3d-layer"))
            {
                import("./map-3d.js").then(({ openMap3d }) => openMap3d({
                    host: get(".map-wrap"),
                    points: store.activeRoute.points,
                    routeColor: store.activeRoute.color || "#ff9a6b",
                    onFocusArea: point => map.flyTo(point, 11)
                }));
            }
            break;
        case "share": shareMission(); break;
        case "export-json": exportJson(); break;
        case "export-geojson": downloadFile("mars-atlas-routes.geojson", JSON.stringify(toGeoJson(store.current), null, 2), "application/geo+json"); notify("Mars GeoJSON exported; coordinates are not Earth WGS84."); break;
        case "export-brief": downloadFile("mars-atlas-mission-brief.md", createMissionBrief(store.current), "text/markdown"); notify("Mission Brief exported."); break;
        case "save-checkpoint": {
            const label = prompt("Checkpoint name (e.g. Before geological review):", `Plan ${store.current.checkpoints.length + 1}`);

            if (label !== null)
            {
                if (store.saveCheckpoint(label))
                {
                    notify("Mission checkpoint saved locally.");
                }
                else
                {
                    notify("Checkpoint limit reached (8). Delete an old checkpoint before saving.");
                }
            }

            break;
        }
        case "simulate-detour": {
            const points = generateDetour(store.activeRoute.points);

            if (!points)
            {
                notify("Add at least two waypoints before simulating a detour.");
                break;
            }

            if (points.length > MAX_POINTS_PER_ROUTE || store.current.routes.length >= 15)
            {
                notify("Cannot add detour: route or waypoint limit reached.");
                break;
            }

            const name = `${store.activeRoute.name} · detour scenario`;
            const route = store.addRoute(name);

            if (!route)
            {
                notify("Cannot add detour: route or waypoint limit reached.");
                break;
            }

            route.points = points;
            store.save();
            setMode("edit");
            notify("Illustrative geometric detour created. Not validated against terrain.");
            break;
        }
    }
});

get("#mission-form").addEventListener("submit", event =>
{
    event.preventDefault();
    const title = get("#mission-input").value.trim();
    const description = get("#mission-description-input").value.trim();

    if (!title)
    {
        return;
    }

    if (modalAction === "new-mission")
    {
        if (!store.addMission(title))
        {
            notify("Mission library limit reached (30). Export a backup before adding more.");
            return;
        }

        store.updateMissionDetails(title, description || store.current.description);
        setMode("draw");
    }
    else if (modalAction === "rename-route")
    {
        store.activeRoute.name = title;
        store.save();
    }
    else
    {
        store.updateMissionDetails(title, description);
    }

    get("#mission-modal").close();
    map.focusRoute();
    notify("Mission saved locally.");
});

document.addEventListener("change", event =>
{
    const waypointPicker = event.target.closest("[data-point-icon]");
    const routeColor = event.target.closest("#active-route-color");
    const observationPicker = event.target.closest("[data-observation-icon]");

    if (routeColor)
    {
        store.setRouteColor(routeColor.value);
    }
    else if (waypointPicker)
    {
        store.setPointIcon(waypointPicker.dataset.pointIcon, waypointPicker.value);
    }
    else if (observationPicker)
    {
        store.setObservationIcon(observationPicker.dataset.observationIcon, observationPicker.value);
    }
});

get("#waypoint-use-route-color").addEventListener("change", event =>
{
    get("#waypoint-color-input").disabled = event.target.checked;

    if (event.target.checked)
    {
        get("#waypoint-color-input").value = store.activeRoute.color;
    }
});

get("#waypoint-editor-form").addEventListener("submit", event =>
{
    event.preventDefault();

    if (!editingWaypointId)
    {
        return;
    }

    const changed = store.updateWaypoint(editingWaypointId, {
        lat: Number(get("#waypoint-lat-input").value),
        lon: Number(get("#waypoint-lon-input").value),
        name: get("#waypoint-name-input").value,
        category: get("#waypoint-category-input").value,
        description: get("#waypoint-description-input").value,
        icon: get("#waypoint-icon-input").value,
        color: get("#waypoint-use-route-color").checked ? null : get("#waypoint-color-input").value
    });

    if (!changed)
    {
        notify("Invalid waypoint coordinates.");
        return;
    }

    get("#waypoint-editor-modal").close();
    editingWaypointId = null;
    notify("Waypoint updated and saved locally.");
});

get("#coordinate-form").addEventListener("submit", event =>
{
    event.preventDefault();
    const lat = Number(get("#latitude-input").value);
    const lon = Number(get("#longitude-input").value);

    const changed = store.addPoint({ lat, lon });

    if (changed)
    {
        get("#coordinate-modal").close();
        map.flyTo({ lat, lon });
        notify("Coordinate added to the active route.");
    }
    else
    {
        notify("Invalid coordinates or route waypoint limit reached.");
    }
});

get("#observation-form").addEventListener("submit", event =>
{
    event.preventDefault();

    if (observationCoordinate)
    {
        const title = get("#observation-title").value.trim();
        const note = get("#observation-note").value.trim();
        const source = get("#observation-source").value.trim() || "User annotation";
        const saved = editingObservationId ? store.updateObservation(editingObservationId, { title, note, source }) :
            store.addObservation(observationCoordinate, title, note, source);

        if (!saved)
        {
            notify("Could not save observation. Check the fields and mission limits.");
            return;
        }

        get("#observation-modal").close();
        editingObservationId = null;
        observationCoordinate = null;
        notify("Georeferenced observation saved.");
    }
});

get("#import-json").addEventListener("change", async event =>
{
    const file = event.target.files[0];

    if (!file)
    {
        return;
    }

    try
    {
        if (file.size > 200000)
        {
            throw new Error("File exceeds 200 KB limit");
        }

        if (!store.importMission(JSON.parse(await file.text())))
        {
            throw new Error("Invalid mission file");
        }

        get("#library-modal").close();
        map.focusRoute();
        notify("Mission imported successfully.");
    }
    catch (error)
    {
        notify(`Import failed: ${error.message}`);
    }

    event.target.value = "";
});

window.addEventListener("keydown", event =>
{
    if (event.target instanceof HTMLElement && event.target.matches(".right-tab") && ["ArrowLeft", "ArrowRight"].includes(event.key))
    {
        event.preventDefault();
        const tabs = [...document.querySelectorAll(".right-tab")];
        const position = tabs.indexOf(event.target);
        const next = tabs[(position + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length];
        next.click();
        next.focus();
        return;
    }

    if (event.key === "Escape")
    {
        if (!get("#map-context-menu").hidden)
        {
            closeMapContextMenu();
            event.preventDefault();
            return;
        }

        if (!document.querySelector("dialog[open]"))
        {
            setMode("pan");
            setMobilePanel("map");
        }
    }

    if (event.target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName) || event.target.isContentEditable))
    {
        return;
    }

    if (document.querySelector("dialog[open]"))
    {
        return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z")
    {
        event.preventDefault();
        if (event.shiftKey) store.redo();
        else store.undo();
        return;
    }

    if ((event.ctrlKey || event.metaKey) &&
        (event.key.toLowerCase() === "y" || event.key.toLowerCase() === "z" && event.shiftKey))
    {
        event.preventDefault();
        store.redo();
        return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey || event.repeat)
    {
        return;
    }

    const shortcutModes = { d: "draw", m: "edit", e: "pan", n: "observe" };
    const mode = shortcutModes[event.key.toLowerCase()];

    if (mode)
    {
        setMode(mode);
    }
});

mountWorkspaceDisclosures(get("#mars-shell"));
store.subscribe(render);
setMode("pan");
render();


get("#start-tutorial").onclick = () => tutorial.start();
enableCardTilt();
let tourRequested = false;
mountHome({
    onStart: () => get('.workflow-step[data-step="plan"]')?.click(),
    onDemo: () => get('[data-action="load-review-demo"]')?.click(),
    onTour: () => { tourRequested = true; }
});

function togglePanel(side)
{
    const workspace = get(".workspace");
    const hidden = workspace.classList.toggle("collapse-" + side);
    const button = get(".panel-toggle-" + side);
    button.setAttribute("aria-pressed", String(hidden));
    button.setAttribute("aria-label", (hidden ? "Show " : "Hide ") + side + " panel");
    button.textContent = (side === "left") === hidden ? "›" : "‹";
    try { localStorage.setItem("mars-panel-" + side, hidden ? "hidden" : "shown"); } catch {}
    setTimeout(() => window.dispatchEvent(new Event("resize")), 60);
}

try
{
    for (const side of ["left", "right"]) if (localStorage.getItem("mars-panel-" + side) === "hidden") togglePanel(side);
    // The tour starts once the welcome screen and the sign-in window are out of the way.
    window.addEventListener("mars-gate-closed", () =>
    {
        if (tourRequested || !localStorage.getItem("mars-tutorial-seen")) setTimeout(() => tutorial.start(), 700);
    }, { once: true });
}
catch {}

mountWorkflowSteps({


    shell: get("#mars-shell"),
    store,
    setMode,
    loadTerrain: () => scienceWorkbench.loadBundledDem().then(() => analyticsNavigation.refresh()).catch(() => {}),
    isTerrainReady: () => scienceWorkbench.isDemReady
});
map.focusRoute();

if (imported)
{
    notify("Shared mission imported into your local library.");
}

mountAnalyzeDashboard({ shell: get("#mars-shell"), store, getCloud: () => cloudWorkspace.cloud, getDem: () => scienceWorkbench.numericDem });

mountAccount({ store, cloudWorkspace, notify, shell: get("#mars-shell") });
