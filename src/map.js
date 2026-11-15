import { JEZERO, MAP_LAYERS } from "./constants.js";
import { clamp, formatCoordinate, project, unproject } from "./geo.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function svgElement(name, attributes)
{
    const element = document.createElementNS(SVG_NS, name);

    for (const [key, value] of Object.entries(attributes))
    {
        element.setAttribute(key, String(value));
    }

    return element;
}

export class MarsMap
{
    constructor(container, store, options = {})
    {
        this.container = container;
        this.store = store;
        this.options = options;
        this.zoom = 10;
        this.center = { ...JEZERO };
        this.layer = MAP_LAYERS[0];
        this.layerMaxZoom = Math.min(11, this.layer.maxUsefulZoom || 13);
        this.mode = "pan";
        this.scenarioZones = [];
        this.scenarioSignature = "[]";
        this.drag = null;
        this.loadedImages = 0;
        this.imageErrors = 0;
        this.tiles = new Map();
        this.tileCacheLimit = 72;
        this.tileTemplates = new Map();
        this.capabilityRequest = 0;
        this.frameScheduled = false;
        this.wheelDelta = 0;
        this.wheelTimer = null;
        this.activeTiles = new Set();
        this.preferredTileSuffix = new Map();

        this.container.innerHTML = `<div class="map-fallback" aria-hidden="true"><div class="fallback-globe"></div><div class="coordinate-grid"></div></div><div class="map-tiles"></div><svg class="map-overlays" role="img" aria-label="Editable mission route overlays"></svg><div class="map-attribution">Map tiles © NASA / JPL · Mars Trek</div><div class="map-load-notice" role="status">Loading Mars imagery…</div>`;
        this.tileContainer = this.container.querySelector(".map-tiles");
        this.overlay = this.container.querySelector(".map-overlays");
        this.notice = this.container.querySelector(".map-load-notice");

        this.container.addEventListener("pointerdown", event => this.onPointerDown(event));
        window.addEventListener("pointermove", event => this.onPointerMove(event));
        window.addEventListener("pointerup", event => this.onPointerUp(event));
        window.addEventListener("pointercancel", event => this.onPointerUp(event));
        this.container.addEventListener("wheel", event => this.onWheel(event), { passive: false });
        this.resizeObserver = new ResizeObserver(() => this.render());
        this.resizeObserver.observe(container);
        this.render();
        this.loadCapabilities();
    }

    async loadCapabilities()
    {
        const requestId = ++this.capabilityRequest;
        const endpoint = `${this.layer.url}/WMTSCapabilities.xml`;

        try
        {
            const response = await fetch(endpoint, { mode: "cors" });

            if (!response.ok)
            {
                return;
            }

            const document = new DOMParser().parseFromString(await response.text(), "application/xml");
            const resource = [...document.getElementsByTagName("*")].find(element => element.localName === "ResourceURL" && element.getAttribute("resourceType") === "tile");

            if (!resource || requestId !== this.capabilityRequest)
            {
                return;
            }

            let template = resource.getAttribute("template");
            const sets = [...document.getElementsByTagName("*")].filter(element => element.localName === "TileMatrixSet");
            const matrixSet = sets.find(element => [...element.children].some(child => child.localName === "TileMatrix"));
            const matrices = matrixSet ? [...matrixSet.children].filter(element => element.localName === "TileMatrix") : [];
            const matrixSetName = matrixSet ? [...matrixSet.children].find(element => element.localName === "Identifier")?.textContent.trim() : null;
            template = template?.replaceAll("{TileMatrixSet}", matrixSetName || "default028mm").replaceAll("{Layer}", this.layer.dataset);
            const matrixLookup = new Map();

            for (const matrix of matrices)
            {
                const field = name => [...matrix.children].find(child => child.localName === name)?.textContent.trim();
                const width = Number(field("MatrixWidth"));
                const height = Number(field("MatrixHeight"));
                const identifier = field("Identifier");

                if (width && height && identifier)
                {
                    matrixLookup.set(`${width}-${height}`, identifier);
                }
            }

            const availableLevels = [...matrixLookup.values()].map(Number).filter(Number.isInteger);
            const highestZoom = availableLevels.length ? Math.max(...availableLevels) : 11;
            const previousZoom = this.zoom;
            this.layerMaxZoom = Math.min(this.layer.maxUsefulZoom || 13, highestZoom);
            this.zoom = clamp(this.zoom, 3, this.layerMaxZoom);
            this.tileTemplates.set(this.layer.id, { template, matrixLookup, maxZoom: this.layerMaxZoom });

            if (this.zoom !== previousZoom)
            {
                this.options.onViewChange?.(this.center, this.zoom);
            }

            for (const [key, image] of this.tiles)
            {
                if (image.dataset.state === "error")
                {
                    image.onload = null;
                    image.onerror = null;
                    image.remove();
                    this.tiles.delete(key);
                }
            }

            this.render();
        }
        catch
        {
            // Fallback paths remain available if NASA metadata cannot be fetched.
        }
    }

    setScenarioZones(zones = [])
    {
        const signature = JSON.stringify(zones);

        if (signature === this.scenarioSignature)
        {
            return;
        }

        this.scenarioZones = zones;
        this.scenarioSignature = signature;
        this.renderOverlays();
    }

    setMode(mode)
    {
        this.mode = mode;
        this.container.dataset.mode = mode;
    }

    setLayer(id)
    {
        if (id === this.layer.id)
        {
            return;
        }

        this.capabilityRequest++;
        this.activeTiles.clear();
        this.container.classList.remove("map-has-imagery");
        this.notice.textContent = "Loading Mars imagery…";
        this.layer = MAP_LAYERS.find(layer => layer.id === id) || MAP_LAYERS[0];
        this.layerMaxZoom = Math.min(this.layer.maxUsefulZoom || 13, this.tileTemplates.get(this.layer.id)?.maxZoom || 11);
        this.zoom = clamp(this.zoom, 3, this.layerMaxZoom);
        this.options.onViewChange?.(this.center, this.zoom);
        this.tiles.clear();
        this.tileContainer.replaceChildren();
        this.loadedImages = 0;
        this.imageErrors = 0;
        this.notice.hidden = false;
        this.render();

        if (!this.tileTemplates.has(this.layer.id))
        {
            this.loadCapabilities();
        }

        this.options.onLayerChange?.(this.layer);
    }

    onWheel(event)
    {
        event.preventDefault();

        if (!Number.isFinite(event.deltaY) || event.deltaY === 0)
        {
            return;
        }

        this.wheelDelta += Math.sign(event.deltaY) * Math.min(Math.abs(event.deltaY), 160);
        clearTimeout(this.wheelTimer);
        this.wheelTimer = setTimeout(() =>
        {
            const direction = Math.sign(this.wheelDelta);
            const amount = Math.min(2, Math.max(1, Math.ceil(Math.abs(this.wheelDelta) / 120)));
            this.wheelDelta = 0;
            this.wheelTimer = null;

            if (direction)
            {
                this.changeZoom(-direction * amount);
            }
        }, 120);
    }

    changeZoom(delta)
    {
        const nextZoom = clamp(this.zoom + delta, 3, this.layerMaxZoom);

        if (nextZoom === this.zoom)
        {
            return;
        }

        this.zoom = nextZoom;
        this.render();
        this.options.onViewChange?.(this.center, this.zoom);
    }

    flyTo(point, zoom = this.zoom)
    {
        this.center = { lat: point.lat, lon: point.lon };
        this.zoom = clamp(zoom, 3, this.layerMaxZoom);
        this.render();
        this.options.onViewChange?.(this.center, this.zoom);
    }

    focusRoute()
    {
        const points = this.store.activeRoute.points;

        if (!points.length)
        {
            this.flyTo(JEZERO, 11);
            return;
        }

        const latitude = points.reduce((sum, point) => sum + point.lat, 0) / points.length;
        const longitude = points.reduce((sum, point) => sum + point.lon, 0) / points.length;
        const span = Math.max(...points.map(point => Math.abs(point.lon - longitude)), ...points.map(point => Math.abs(point.lat - latitude)));
        const zoom = span > 0.06 ? 9 : span > 0.025 ? 10 : span > 0.012 ? 11 : 12;
        this.flyTo({ lat: latitude, lon: longitude }, zoom);
    }

    screenToGeo(clientX, clientY)
    {
        const rect = this.container.getBoundingClientRect();
        const center = project(this.center, this.zoom);

        return unproject({ x: center.x + clientX - rect.left - rect.width / 2, y: center.y + clientY - rect.top - rect.height / 2 }, this.zoom);
    }

    geoToScreen(point)
    {
        const rect = this.container.getBoundingClientRect();
        const center = project(this.center, this.zoom);
        const pixel = project(point, this.zoom);

        return { x: rect.width / 2 + pixel.x - center.x, y: rect.height / 2 + pixel.y - center.y };
    }

    onPointerDown(event)
    {
        if (event.button !== 0)
        {
            return;
        }

        const target = event.target.closest?.("[data-point]");
        const pointId = target?.dataset.point;
        this.drag = {
            pointerId: event.pointerId, startX: event.clientX, startY: event.clientY,
            startCenter: project(this.center, this.zoom), moved: false,
            pointId: this.mode === "edit" ? pointId : null,
            targetRoute: event.target.closest?.("[data-route]")?.dataset.route
        };
        this.container.classList.add("is-dragging");
    }

    onPointerMove(event)
    {
        if (!this.drag || this.drag.pointerId !== event.pointerId)
        {
            if (this.container.contains(event.target))
            {
                this.options.onCoordinates?.(this.screenToGeo(event.clientX, event.clientY));
            }

            return;
        }

        const deltaX = event.clientX - this.drag.startX;
        const deltaY = event.clientY - this.drag.startY;
        this.drag.moved ||= Math.hypot(deltaX, deltaY) > 5;

        if (!this.drag.moved)
        {
            return;
        }

        if (this.drag.pointId)
        {
            this.store.movePoint(this.drag.pointId, this.screenToGeo(event.clientX, event.clientY), false);
            this.render();
            return;
        }

        this.center = unproject({ x: this.drag.startCenter.x - deltaX, y: this.drag.startCenter.y - deltaY }, this.zoom);
        this.render();
    }

    onPointerUp(event)
    {
        if (!this.drag || this.drag.pointerId !== event.pointerId)
        {
            return;
        }

        const drag = this.drag;
        this.drag = null;
        this.container.classList.remove("is-dragging");

        if (drag.moved && drag.pointId)
        {
            this.store.save();
        }

        if (drag.moved || !this.container.contains(event.target))
        {
            return;
        }

        if (drag.targetRoute && this.mode === "pan")
        {
            this.store.selectRoute(drag.targetRoute);
            return;
        }

        this.options.onMapClick?.(this.screenToGeo(event.clientX, event.clientY), this.mode);
    }

    createTile(x, y, zoom, left, top)
    {
        const image = document.createElement("img");
        image.className = "map-tile";
        image.alt = "";
        image.draggable = false;
        image.decoding = "async";
        image.style.opacity = "0";
        image.style.left = `${Math.round(left)}px`;
        image.style.top = `${Math.round(top)}px`;

        const capabilities = this.tileTemplates.get(this.layer.id);
        const matrixId = capabilities?.matrixLookup.get(`${2 ** (zoom + 1)}-${2 ** zoom}`) || String(zoom);
        const verifiedTemplate = capabilities?.template?.replaceAll("{TileMatrix}", matrixId).replaceAll("{TileRow}", String(y)).replaceAll("{TileCol}", String(x)).replaceAll("{Style}", "default");
        const candidates = [...new Set([
            ...(verifiedTemplate ? [verifiedTemplate] : []),
            ...this.layer.extensions.map(extension => `${this.layer.url}/default/default028mm/${zoom}/${y}/${x}.${extension}`),
            ...this.layer.extensions.map(extension => `${this.layer.url}/default/default/${zoom}/${y}/${x}.${extension}`)
        ])];
        const preferred = this.preferredTileSuffix.get(this.layer.id);

        if (preferred)
        {
            const verifiedCandidates = candidates.filter(candidate =>
                candidate.includes(`/default/${preferred.matrixSet}/`) && candidate.endsWith(`.${preferred.extension}`));

            if (verifiedCandidates.length)
            {
                candidates.splice(0, candidates.length, ...verifiedCandidates);
            }
        }

        image.dataset.state = "loading";
        let candidateIndex = 0;

        const sourceLayerId = this.layer.id;

        const nextCandidate = () =>
        {
            candidateIndex++;

            if (candidateIndex < candidates.length)
            {
                image.src = candidates[candidateIndex];
                return;
            }

            this.imageErrors++;
            image.dataset.state = "error";
            image.dataset.failedAt = String(Date.now());
            image.style.display = "none";
            this.updateImageryStatus();
        };

        image.onload = () =>
{
            if (sourceLayerId !== this.layer.id || !image.isConnected)
            {
                return;
            }

            if (image.naturalWidth < 240 || image.naturalHeight < 240)
            {
                nextCandidate();
                return;
            }

            image.dataset.state = "loaded";
            this.loadedImages++;
            image.style.opacity = "1";
            const match = candidates[candidateIndex].match(/\/default\/(default028mm|default)\/\d+\/\d+\/\d+\.(png|jpg)$/);

            if (match)
            {
                this.preferredTileSuffix.set(this.layer.id, { matrixSet: match[1], extension: match[2] });
            }

            this.updateImageryStatus();
        };
        image.onerror = () =>
{
            if (sourceLayerId !== this.layer.id || !image.isConnected)
            {
                return;
            }

            nextCandidate();
        };
        image.src = candidates[0];
        return image;
    }

    renderTiles()
    {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        if (!width || !height)
        {
            return;
        }

        const center = project(this.center, this.zoom);
        const minX = Math.floor((center.x - width / 2) / 256);
        const maxX = Math.floor((center.x + width / 2) / 256);
        const minY = Math.floor((center.y - height / 2) / 256);
        const maxY = Math.floor((center.y + height / 2) / 256);
        const maxTileX = 2 ** (this.zoom + 1);
        const maxTileY = 2 ** this.zoom;
        const active = new Set();

        for (let y = minY; y <= maxY; y++)
        {
            for (let x = minX; x <= maxX; x++)
            {
                if (x < 0 || y < 0 || x >= maxTileX || y >= maxTileY)
                {
                    continue;
                }

                const key = `${this.layer.id}-${this.zoom}-${x}-${y}`;
                active.add(key);
                const left = x * 256 - center.x + width / 2;
                const top = y * 256 - center.y + height / 2;

                let tile = this.tiles.get(key);

                if (tile?.dataset.state === "error" && Date.now() - Number(tile.dataset.failedAt) > 15000)
                {
                    tile.onload = null;
                    tile.onerror = null;
                    tile.remove();
                    this.tiles.delete(key);
                    tile = null;
                }

                if (!tile)
                {
                    tile = this.createTile(x, y, this.zoom, left, top);
                    this.tiles.set(key, tile);
                    this.tileContainer.appendChild(tile);
                }

                tile.style.left = `${Math.round(left)}px`;
                tile.style.top = `${Math.round(top)}px`;
                tile.style.display = tile.dataset.state === "error" ? "none" : "";
            }
        }

        this.activeTiles = active;

        for (const [key, tile] of this.tiles)
        {
            if (!active.has(key))
            {
                tile.style.display = "none";
            }
        }

        if (this.tiles.size > this.tileCacheLimit)
        {
            for (const [key, tile] of this.tiles)
            {
                if (active.has(key))
                {
                    continue;
                }

                tile.onload = null;
                tile.onerror = null;
                tile.removeAttribute("src");
                tile.remove();
                this.tiles.delete(key);

                if (this.tiles.size <= this.tileCacheLimit - 12)
                {
                    break;
                }
            }
        }

        this.updateImageryStatus();
    }

    updateImageryStatus()
    {
        let loaded = 0;
        let loading = 0;

        for (const key of this.activeTiles)
        {
            const image = this.tiles.get(key);

            if (image?.dataset.state === "loaded" && image.naturalWidth > 0)
            {
                loaded++;
            }
            else if (image?.dataset.state !== "error")
            {
                loading++;
            }
        }

        this.container.classList.toggle("map-has-imagery", loaded > 0);
        this.notice.hidden = loaded > 0;
        this.notice.textContent = loading ? "Loading Mars imagery…" : "NASA imagery is unavailable at this zoom. Zoom out or change the layer.";
    }

    renderOverlays()
    {
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.overlay.setAttribute("viewBox", `0 0 ${width} ${height}`);
        this.overlay.replaceChildren();

        for (const zone of this.scenarioZones)
        {
            const center = this.geoToScreen(zone);
            const radiusDegrees = zone.radiusMeters / 3396190 * 180 / Math.PI;
            const longitudeDelta = radiusDegrees / Math.max(0.001, Math.cos(zone.lat * Math.PI / 180));
            const east = this.geoToScreen({ lat: zone.lat, lon: zone.lon + longitudeDelta });
            const south = this.geoToScreen({ lat: zone.lat - radiusDegrees, lon: zone.lon });
            const ellipse = svgElement("ellipse", { cx: center.x, cy: center.y, rx: Math.abs(east.x - center.x), ry: Math.abs(south.y - center.y), fill: "#ec9976", "fill-opacity": 0.17, stroke: "#f2aa86", "stroke-width": 1.7, "stroke-dasharray": "6 5", "pointer-events": "none" });
            const title = svgElement("title", {});
            title.textContent = `Hypothetical ${zone.radiusMeters} m exclusion around ${zone.title || "user note"}; not verified terrain hazard`;
            ellipse.appendChild(title);
            this.overlay.appendChild(ellipse);
        }

        for (const route of this.store.current.routes)
        {
            const active = route.id === this.store.current.activeRouteId;
            const coordinates = route.points.map(point => this.geoToScreen(point));

            if (coordinates.length > 1)
            {
                const points = coordinates.map(point => `${point.x},${point.y}`).join(" ");
                const glow = svgElement("polyline", { points, fill: "none", stroke: "#07121a", "stroke-width": active ? 10 : 7, "stroke-linecap": "round", "stroke-linejoin": "round" });
                const path = svgElement("polyline", { points, fill: "none", stroke: route.color, "stroke-width": active ? 4 : 2.5, "stroke-dasharray": active ? "none" : "7 7", "stroke-linecap": "round", "stroke-linejoin": "round", "data-route": route.id, class: "route-path" });
                this.overlay.append(glow, path);
            }

            if (active)
            {
                coordinates.forEach((position, index) =>
{
                    const point = route.points[index];
                    const halo = svgElement("circle", { cx: position.x, cy: position.y, r: 11, fill: route.color, opacity: 0.22 });
                    const circle = svgElement("circle", { cx: position.x, cy: position.y, r: 6, fill: route.color, stroke: "#09111b", "stroke-width": 2, class: "route-node", "data-point": point.id });
                    const title = svgElement("title", {});
                    title.textContent = `Waypoint ${index + 1} · ${formatCoordinate(point.lat, "lat")}, ${formatCoordinate(point.lon, "lon")}`;
                    circle.appendChild(title);
                    this.overlay.append(halo, circle);
                });
            }
        }

        for (const observation of this.store.current.observations)
        {
            const position = this.geoToScreen(observation);
            const halo = svgElement("circle", { cx: position.x, cy: position.y, r: 12, fill: "#7ed4c5", opacity: 0.15 });
            const marker = svgElement("rect", { x: position.x - 5, y: position.y - 5, width: 10, height: 10, rx: 2, transform: `rotate(45 ${position.x} ${position.y})`, fill: "#8fe5d8", stroke: "#10252b", "stroke-width": 1.5 });
            const title = svgElement("title", {});
            title.textContent = observation.title;
            marker.appendChild(title);
            this.overlay.append(halo, marker);
        }
    }

    render()
    {
        if (this.frameScheduled)
        {
            return;
        }

        this.frameScheduled = true;
        requestAnimationFrame(() =>
        {
            this.frameScheduled = false;
            this.renderTiles();
            this.renderOverlays();
        });
    }
}
