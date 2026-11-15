import { buildTerrainMesh, createTerrainRenderer, terrainPointMarkers } from "./terrain-3d.js";

export function mountTerrain3D({ panel, before, store, readDem, notify })
{
    const section = document.createElement("section");
    section.className = "panel-section science-model-section terrain-3d-panel";
    section.innerHTML = `
        <div class="panel-title-row"><h2 class="section-label">3D TERRAIN EXPLORER</h2><span class="tiny-pill">REAL DEM · WEBGL</span></div>
        <p class="section-help">A 3D mesh derived strictly from numeric terrain elevations. Missing samples produce gaps, not imagined terrain.</p>
        <details id="terrain-3d-open" class="science-details">
            <summary>Explore numeric terrain in 3D</summary>
            <div class="terrain-3d-body">
                <div class="terrain-3d-view">
                    <canvas id="terrain-3d-canvas" tabindex="0" role="img" aria-label="Interactive numeric Martian digital elevation model rendered in WebGL. Drag to orbit the terrain."></canvas>
                </div>
                <div class="terrain-3d-controls">
                    <label>Vertical exaggeration <output id="terrain-3d-relief-readout">7×</output>
                        <input id="terrain-3d-relief" type="range" min="1" max="20" step="1" value="7"/>
                    </label>
                    <label>Viewing angle <output id="terrain-3d-pitch-readout">37°</output>
                        <input id="terrain-3d-pitch" type="range" min="15" max="75" step="1" value="37"/>
                    </label>
                    <button type="button" id="terrain-3d-reset" class="btn btn-outline">Reset view</button>
                </div>
                <p id="terrain-3d-info" class="science-footnote" role="status">Load Jezero DEM to display an actual surface.</p>
                <p class="science-footnote">Drag/touch to orbit; mouse wheel to zoom. Orange markers represent manual waypoints snapped to DEM cell centers for visualization only. The colors encode relative elevation, not a NASA photographic texture. Not a safe-traverse map.</p>
            </div>
        </details>`;
    panel.insertBefore(section, before);
    const details = section.querySelector("#terrain-3d-open");
    const canvas = section.querySelector("#terrain-3d-canvas");
    const info = section.querySelector("#terrain-3d-info");
    const relief = section.querySelector("#terrain-3d-relief");
    const pitch = section.querySelector("#terrain-3d-pitch");
    let renderer = null;
    let mesh = null;
    let activeDem = null;
    let yaw = 0.55;
    let angle = 37;
    let heightScale = 7;
    let zoom = 0.89;
    let dragged = null;
    let error = null;
    let markerSignature = "";

    function redraw()
    {
        if (renderer && details.open && mesh)
        {
            renderer.render({ yaw, pitch: angle * Math.PI / 180, relief: heightScale, zoom });
        }
    }

    function update()
    {
        if (!details.open)
        {
            return;
        }

        const dem = readDem();

        if (!dem)
        {
            info.textContent = "Load the numeric DEM in Terrain → DEM Route Lab first. A photographic map alone cannot generate 3D heights.";
            return;
        }

        if (activeDem !== dem)
        {
            try
            {
                mesh = buildTerrainMesh(dem);
                activeDem = dem;
                markerSignature = "";
                error = null;
            }
            catch (issue)
            {
                info.textContent = issue.message;
                return;
            }
        }

        if (!renderer && !error)
        {
            try
            {
                renderer = createTerrainRenderer(canvas);
            }
            catch (issue)
            {
                error = issue.message;
            }
        }

        if (!renderer)
        {
            info.textContent = "WebGL unavailable: " + (error || "This browser or GPU cannot render the 3D model.") +
                " The numeric DEM, interactive 2D profile and route editor remain available.";
            return;
        }

        const signature = JSON.stringify(store.activeRoute.points.map(point => [point.lat, point.lon]));

        if (signature !== markerSignature)
        {
            markerSignature = signature;
            const markers = terrainPointMarkers(dem, mesh, store.activeRoute.points);
            renderer.setTerrain(mesh, markers);
        }

        info.textContent = mesh.width + " × " + mesh.height + " numeric cells · " +
            mesh.cellCount + " valid samples · " + mesh.triangleCount + " actual DEM triangles · " +
            mesh.minElevation.toFixed(2) + " to " + mesh.maxElevation.toFixed(2) +
            " m elevation · grid width " + mesh.widthMeters.toFixed(0) +
            " m · " + dem.source;
        redraw();
    }

    details.addEventListener("toggle", update);
    relief.addEventListener("input", () =>
    {
        heightScale = Number(relief.value);
        section.querySelector("#terrain-3d-relief-readout").textContent = heightScale + "×";
        redraw();
    });
    pitch.addEventListener("input", () =>
    {
        angle = Number(pitch.value);
        section.querySelector("#terrain-3d-pitch-readout").textContent = angle + "°";
        redraw();
    });
    section.querySelector("#terrain-3d-reset").addEventListener("click", () =>
    {
        yaw = 0.55;
        angle = 37;
        heightScale = 7;
        zoom = 0.89;
        relief.value = "7";
        pitch.value = "37";
        section.querySelector("#terrain-3d-relief-readout").textContent = "7×";
        section.querySelector("#terrain-3d-pitch-readout").textContent = "37°";
        redraw();
    });
    canvas.addEventListener("pointerdown", event =>
    {
        dragged = { x: event.clientX, y: event.clientY };
        canvas.setPointerCapture?.(event.pointerId);
    });
    canvas.addEventListener("pointermove", event =>
    {
        if (!dragged)
        {
            return;
        }

        yaw += (event.clientX - dragged.x) * 0.008;
        angle = Math.min(75, Math.max(15, angle - (event.clientY - dragged.y) * 0.15));
        dragged = { x: event.clientX, y: event.clientY };
        pitch.value = String(Math.round(angle));
        section.querySelector("#terrain-3d-pitch-readout").textContent = Math.round(angle) + "°";
        redraw();
    });
    canvas.addEventListener("pointerup", () => { dragged = null; });
    canvas.addEventListener("pointercancel", () => { dragged = null; });
    canvas.addEventListener("wheel", event =>
    {
        if (!mesh || !details.open)
        {
            return;
        }

        event.preventDefault();
        zoom = Math.min(1.55, Math.max(0.4, zoom - Math.sign(event.deltaY) * 0.07));
        redraw();
    }, { passive: false });
    canvas.addEventListener("keydown", event =>
    {
        if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key))
        {
            return;
        }

        event.preventDefault();
        yaw += event.key === "ArrowLeft" ? -0.1 : event.key === "ArrowRight" ? 0.1 : 0;
        angle = Math.min(75, Math.max(15, angle + (event.key === "ArrowUp" ? 3 : event.key === "ArrowDown" ? -3 : 0)));
        redraw();
    });
    canvas.addEventListener("webglcontextlost", event =>
    {
        event.preventDefault();
        renderer = null;
        error = "The graphics context was lost.";
        info.textContent = error + " Your routes and numeric DEM are unchanged.";
    });
    canvas.addEventListener("webglcontextrestored", () =>
    {
        error = null;
        renderer = null;
        markerSignature = "";
        update();
    });

    return { refresh: update, section };
}
