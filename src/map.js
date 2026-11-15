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
        this.zoom = 7;
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
        this.capabilitiesReady = false;
        this.capabilitiesTimer = null;

        this.container.innerHTML = `<div class="map-fallback" aria-hidden="true"><div class="fallback-globe"></div><div class="coordinate-grid"></div></div><div class="map-background-tiles"></div><div class="map-tiles"></div><svg class="map-overlays" role="img" aria-label="Editable mission route overlays"></svg><div class="map-attribution">Map tiles © NASA / JPL · Mars Trek</div><div class="map-load-notice" role="status">Loading Mars imagery…</div>`;
        this.tileContainer = this.container.querySelector(".map-tiles");
        this.backgroundTileContainer = this.container.querySelector(".map-background-tiles");
        this.backgroundTiles = new Map();
        this.backgroundActiveTiles = new Set();
        this.backgroundTileCacheLimit = 24;
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
        this.scheduleCapabilities();
    }

    scheduleCapabilities()
    {
        clearTimeout(this.capabilitiesTimer);
        const verifiedLayer = this.layer.id === "hirise" || this.layer.id === "mola";
        this.capabilitiesReady = verifiedLayer || this.tileTemplates.has(this.layer.id);

        if (this.capabilitiesReady)
        {
            this.render();

            if (!this.tileTemplates.has(this.layer.id))
            {
                this.loadCapabilities();
            }

            return;
        }

        this.capabilitiesTimer = setTimeout(() =>
        {
            this.capabilitiesReady = true;
            this.render();
        }, 850);
        this.loadCapabilities();
    }

    async loadCapabilities()
    {
        const requestId = ++this.capabilityRequest;
        const layer = this.layer;
        const endpoint = `${layer.url}/WMTSCapabilities.xml`;

        try
        {
            const response = await fetch(endpoint, { mode: "cors" });

            if (!response.ok || requestId !== this.capabilityRequest)
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
            template = template?.replaceAll("{TileMatrixSet}", matrixSetName || "default028mm").replaceAll("{Layer}", layer.dataset);
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

            const availableLevels = [...matrixLookup.keys()].map(value => Math.log2(Number(value.split("-")[1]))).filter(Number.isInteger);
            const highestZoom = availableLevels.length ? Math.max(...availableLevels) : layer.maxUsefulZoom || 10;
            const previousZoom = this.zoom;
            if (requestId !== this.capabilityRequest)
            {
                return;
            }

            this.layerMaxZoom = Math.min(layer.maxUsefulZoom || 13, highestZoom);
            this.zoom = clamp(this.zoom, 3, this.layerMaxZoom);
            this.tileTemplates.set(layer.id, { template, matrixLookup, maxZoom: this.layerMaxZoom });
            this.capabilitiesReady = true;
            clearTimeout(this.capabilitiesTimer);

            if (this.zoom !== previousZoom)
            {
                this.options.onViewChange?.(this.center, this.zoom);
            }

            // Metadata updates must not cancel images already loading.
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
        clearTimeout(this.capabilitiesTimer);
        this.activeTiles.clear();
        this.backgroundActiveTiles.clear();
        this.container.classList.remove("map-has-imagery");
        this.notice.textContent = "Loading Mars imagery…";
        this.layer = MAP_LAYERS.find(layer => layer.id === id) || MAP_LAYERS[0];
        this.layerMaxZoom = Math.min(this.layer.maxUsefulZoom || 13, this.tileTemplates.get(this.layer.id)?.maxZoom || 11);
        this.zoom = clamp(this.zoom, 3, this.layerMaxZoom);
        this.options.onViewChange?.(this.center, this.zoom);
        for (const tile of this.tiles.values())
        {
            this.releaseTile(tile);
        }

        this.tiles.clear();
        this.tileContainer.replaceChildren();
        this.loadedImages = 0;
        this.imageErrors = 0;
        this.notice.hidden = false;
        this.render();

        this.scheduleCapabilities();

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

        if (drag.moved && !drag.pointId)
        {
            this.options.onViewChange?.(this.center, this.zoom);
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

    releaseTile(tile)
    {
        tile.dispose?.();
        tile.remove?.();
    }

    getImageryLayer(zoom = this.zoom, tileX = null, tileY = null)
    {
        if (this.layer.id !== "hirise")
        {
            return this.layer;
        }

        const fallback = MAP_LAYERS.find(layer => layer.id === "viking") || this.layer;

        if (zoom < 9)
        {
            return fallback;
        }

        const bounds = this.layer.coverage;

        if (Number.isInteger(tileX) && Number.isInteger(tileY))
        {
            const northwest = unproject({ x: tileX * 256, y: tileY * 256 }, zoom);
            const southeast = unproject({ x: (tileX + 1) * 256, y: (tileY + 1) * 256 }, zoom);
            const intersects = northwest.lon < bounds.east && southeast.lon > bounds.west
                && northwest.lat > bounds.south && southeast.lat < bounds.north;

            return intersects ? this.layer : fallback;
        }

        const point = this.center;
        return point.lon >= bounds.west && point.lon <= bounds.east
            && point.lat >= bounds.south && point.lat <= bounds.north ? this.layer : fallback;
    }

    tileCandidates(x, y, zoom, layer = this.getImageryLayer(zoom))
    {
        const capabilities = this.tileTemplates.get(layer.id);
        const dimensions = String(2 ** (zoom + 1)) + "-" + String(2 ** zoom);
        const matrixId = capabilities?.matrixLookup.get(dimensions) || String(zoom);
        const template = capabilities?.template
            ?.replaceAll("{TileMatrix}", matrixId)
            .replaceAll("{TileRow}", String(y))
            .replaceAll("{TileCol}", String(x))
            .replaceAll("{Style}", "default")
            .replace(/\/{2,}(?=default\/)/g, "/");
        const candidates = [...new Set([
            ...(template ? [template] : []),
            ...layer.extensions.map(extension => layer.url + "/default/default028mm/" + zoom + "/" + y + "/" + x + "." + extension),
            ...layer.extensions.map(extension => layer.url + "/default/default/" + zoom + "/" + y + "/" + x + "." + extension)
        ])];
        const preferred = this.preferredTileSuffix.get(layer.id + ":" + zoom);

        if (preferred)
        {
            const matches = candidate =>
                candidate.includes("/default/" + preferred.matrixSet + "/")
                && candidate.endsWith("." + preferred.extension);
            candidates.sort((left, right) => Number(matches(right)) - Number(matches(left)));
        }

        return candidates;
    }

    createTile(x, y, zoom, left, top)
    {
        const selectedLayerId = this.layer.id;
        const layer = this.getImageryLayer(zoom, x, y);
        const sourceDepth = Math.max(0, zoom - (layer.maxUsefulZoom || zoom));
        const sourceRatio = 2 ** sourceDepth;
        const sourceZoom = zoom - sourceDepth;
        const sourceX = Math.floor(x / sourceRatio);
        const sourceY = Math.floor(y / sourceRatio);
        const tile = document.createElement("div");
        tile.className = "map-tile";
        tile.dataset.state = "loading";
        tile.dataset.preview = "loading";
        tile.dataset.source = layer.id;
        tile.dataset.lowDetail = String(sourceDepth > 0);

        if (selectedLayerId === "hirise")
        {
            tile.style.filter = "grayscale(1)";
        }

        tile.style.left = Math.round(left) + "px";
        tile.style.top = Math.round(top) + "px";

        const preview = document.createElement("img");
        preview.className = "map-tile-preview";
        preview.alt = "";
        preview.draggable = false;
        preview.decoding = "async";
        preview.style.opacity = "0";

        const detail = document.createElement("img");
        detail.className = "map-tile-detail";
        detail.alt = "";
        detail.draggable = false;
        detail.decoding = "async";
        detail.style.opacity = "0";
        tile.append(preview, detail);

        if (sourceDepth)
        {
            const enlarged = 256 * sourceRatio;
            detail.style.width = enlarged + "px";
            detail.style.height = enlarged + "px";
            detail.style.left = -(x % sourceRatio) * 256 + "px";
            detail.style.top = -(y % sourceRatio) * 256 + "px";
        }

        const primaryCandidates = this.tileCandidates(sourceX, sourceY, sourceZoom, layer);
        let primaryIndex = 0;
        let previewDepth = selectedLayerId === "hirise" ? Math.max(1, zoom - 8) : 1;
        let previewIndex = 0;
        let previewCandidates = [];
        let disposed = false;

        const isCurrent = () => !disposed
            && selectedLayerId === this.layer.id
            && layer.id === this.getImageryLayer(zoom, x, y).id
            && tile.isConnected;

        const report = () =>
        {
            if (isCurrent())
            {
                this.updateImageryStatus();
            }
        };

        const nextPrimary = () =>
        {
            if (!isCurrent())
            {
                return;
            }

            primaryIndex++;

            if (primaryIndex < primaryCandidates.length)
            {
                detail.src = primaryCandidates[primaryIndex];
                return;
            }

            this.imageErrors++;
            tile.dataset.state = "error";
            tile.dataset.failedAt = String(Date.now());
            detail.style.opacity = "0";
            report();
        };

        detail.onload = () =>
        {
            if (!isCurrent())
            {
                return;
            }

            if (detail.naturalWidth < 240 || detail.naturalHeight < 240)
            {
                nextPrimary();
                return;
            }

            tile.dataset.state = "loaded";
            this.loadedImages++;
            detail.style.opacity = "1";
            preview.style.opacity = selectedLayerId === "hirise" && layer.id === "hirise"
                && tile.dataset.preview === "loaded" ? "1" : "0";
            const source = primaryCandidates[primaryIndex];
            const match = source.match(/\/default\/(default028mm|default)\/[^/]+\/\d+\/\d+\.(png|jpg)$/);

            if (match)
            {
                this.preferredTileSuffix.set(layer.id + ":" + zoom, {
                    matrixSet: match[1], extension: match[2]
                });
            }

            report();
        };

        detail.onerror = nextPrimary;

        const loadPreview = () =>
        {
            if (!isCurrent() || zoom - previewDepth < 3 || tile.dataset.state === "loaded")
            {
                tile.dataset.preview = "error";
                report();
                return;
            }

            const fallback = selectedLayerId === "hirise"
                ? MAP_LAYERS.find(item => item.id === "viking") || layer : layer;
            const parentZoom = Math.min(zoom - previewDepth, fallback.maxUsefulZoom || zoom);
            const ratio = 2 ** (zoom - parentZoom);
            const parentX = Math.floor(x / ratio);
            const parentY = Math.floor(y / ratio);
            const size = 256 * ratio;
            preview.style.width = size + "px";
            preview.style.height = size + "px";
            preview.style.left = -((x % ratio) * 256) + "px";
            preview.style.top = -((y % ratio) * 256) + "px";
            previewCandidates = this.tileCandidates(parentX, parentY, parentZoom, fallback);
            previewIndex = 0;
            preview.src = previewCandidates[0];
        };

        const nextPreview = () =>
        {
            if (!isCurrent())
            {
                return;
            }

            previewIndex++;

            if (previewIndex < previewCandidates.length)
            {
                preview.src = previewCandidates[previewIndex];
                return;
            }

            if (previewDepth < 2)
            {
                previewDepth++;
                loadPreview();
                return;
            }

            tile.dataset.preview = "error";
            report();
        };

        preview.onload = () =>
        {
            if (!isCurrent())
            {
                return;
            }

            if (preview.naturalWidth < 240 || preview.naturalHeight < 240)
            {
                nextPreview();
                return;
            }

            tile.dataset.preview = "loaded";
            preview.style.opacity = selectedLayerId === "hirise" && layer.id === "hirise"
                ? "1" : tile.dataset.state === "loaded" ? "0" : "1";
            report();
        };

        preview.onerror = nextPreview;

        tile.startLoading = () =>
        {
            if (!isCurrent())
            {
                return;
            }

            detail.src = primaryCandidates[0];

            if (zoom > 3 && !(selectedLayerId === "hirise" && layer.id === "viking"))
            {
                loadPreview();
            }
            else
            {
                tile.dataset.preview = "error";
            }
        };

        tile.dispose = () =>
        {
            disposed = true;
            detail.onload = null;
            detail.onerror = null;
            preview.onload = null;
            preview.onerror = null;
            detail.removeAttribute("src");
            preview.removeAttribute("src");
        };

        return tile;
    }

    createBackgroundTile(x, y, zoom)
    {
        const source = MAP_LAYERS.find(item => item.id === "viking");
        const tile = document.createElement("img");
        tile.className = "map-background-tile";
        tile.alt = "";
        tile.draggable = false;
        tile.decoding = "async";
        tile.dataset.state = "loading";
        tile.style.opacity = "0";
        const candidates = this.tileCandidates(x, y, zoom, source);
        let attempt = 0;
        let disposed = false;

        const report = () =>
        {
            if (!disposed && this.layer.id === "hirise")
            {
                this.updateHiRISEStatus();
            }
        };

        const next = () =>
        {
            if (disposed)
            {
                return;
            }

            attempt++;

            if (attempt < candidates.length)
            {
                tile.src = candidates[attempt];
                return;
            }

            tile.dataset.state = "error";
            tile.dataset.failedAt = String(Date.now());
            tile.style.opacity = "0";
            report();
        };

        tile.onload = () =>
        {
            if (disposed)
            {
                return;
            }

            if (tile.naturalWidth < 240 || tile.naturalHeight < 240)
            {
                next();
                return;
            }

            tile.dataset.state = "loaded";
            tile.style.opacity = "1";
            report();
        };

        tile.onerror = next;
        tile.startLoading = () => { tile.src = candidates[0]; };
        tile.dispose = () =>
        {
            disposed = true;
            tile.onload = null;
            tile.onerror = null;
            tile.removeAttribute("src");
        };

        return tile;
    }

    renderBackgroundTiles(width, height, center)
    {
        const source = MAP_LAYERS.find(item => item.id === "viking");
        const level = Math.min(this.zoom, source.maxUsefulZoom);
        const ratio = 2 ** (this.zoom - level);
        const size = 256 * ratio;
        const minX = Math.floor((center.x - width / 2) / size);
        const maxX = Math.floor((center.x + width / 2) / size);
        const minY = Math.floor((center.y - height / 2) / size);
        const maxY = Math.floor((center.y + height / 2) / size);
        const worldWidth = 2 ** (level + 1);
        const worldHeight = 2 ** level;
        const active = new Set();

        this.backgroundTileContainer.style.display = "";

        for (let y = minY; y <= maxY; y++)
        {
            for (let x = minX; x <= maxX; x++)
            {
                if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight)
                {
                    continue;
                }

                const key = level + "-" + x + "-" + y;
                active.add(key);
                let tile = this.backgroundTiles.get(key);

                if (tile?.dataset.state === "error" && Date.now() - Number(tile.dataset.failedAt) >= 16000)
                {
                    this.releaseTile(tile);
                    this.backgroundTiles.delete(key);
                    tile = null;
                }

                if (!tile)
                {
                    tile = this.createBackgroundTile(x, y, level);
                    this.backgroundTiles.set(key, tile);
                    this.backgroundTileContainer.appendChild(tile);
                    tile.startLoading();
                }

                tile.style.left = Math.round(x * size - center.x + width / 2) + "px";
                tile.style.top = Math.round(y * size - center.y + height / 2) + "px";
                tile.style.width = size + "px";
                tile.style.height = size + "px";
                tile.style.display = "";
            }
        }

        this.backgroundActiveTiles = active;

        for (const [key, tile] of this.backgroundTiles)
        {
            if (!active.has(key))
            {
                tile.style.display = "none";
            }
        }

        if (this.backgroundTiles.size > this.backgroundTileCacheLimit)
        {
            for (const [key, tile] of this.backgroundTiles)
            {
                if (active.has(key))
                {
                    continue;
                }

                this.releaseTile(tile);
                this.backgroundTiles.delete(key);

                if (this.backgroundTiles.size <= this.backgroundTileCacheLimit - 4)
                {
                    break;
                }
            }
        }
    }

    createHiRISETile(x, y, zoom)
    {
        const tile = document.createElement("img");
        tile.className = "map-hires-tile";
        tile.alt = "";
        tile.draggable = false;
        tile.decoding = "async";
        tile.dataset.state = "loading";
        tile.style.opacity = "0";
        const candidates = this.tileCandidates(x, y, zoom, this.layer);
        let attempt = 0;
        let disposed = false;

        const report = () =>
        {
            if (!disposed && this.layer.id === "hirise")
            {
                this.updateHiRISEStatus();
            }
        };

        const next = () =>
        {
            if (disposed)
            {
                return;
            }

            attempt++;

            if (attempt < candidates.length)
            {
                tile.src = candidates[attempt];
                return;
            }

            tile.dataset.state = "error";
            tile.dataset.failedAt = String(Date.now());
            tile.style.opacity = "0";
            report();
        };

        tile.onload = () =>
        {
            if (disposed)
            {
                return;
            }

            if (tile.naturalWidth < 240 || tile.naturalHeight < 240)
            {
                next();
                return;
            }

            tile.dataset.state = "loaded";
            tile.style.opacity = "1";
            report();
        };

        tile.onerror = next;
        tile.startLoading = () => { tile.src = candidates[0]; };
        tile.dispose = () =>
        {
            disposed = true;
            tile.onload = null;
            tile.onerror = null;
            tile.removeAttribute("src");
        };

        return tile;
    }

    renderHiRISETiles(width, height, center)
    {
        this.renderBackgroundTiles(width, height, center);
        const active = new Set();

        if (this.zoom >= 9)
        {
            const minX = Math.floor((center.x - width / 2) / 256);
            const maxX = Math.floor((center.x + width / 2) / 256);
            const minY = Math.floor((center.y - height / 2) / 256);
            const maxY = Math.floor((center.y + height / 2) / 256);
            const worldWidth = 2 ** (this.zoom + 1);
            const worldHeight = 2 ** this.zoom;

            for (let y = minY; y <= maxY; y++)
            {
                for (let x = minX; x <= maxX; x++)
                {
                    if (x < 0 || y < 0 || x >= worldWidth || y >= worldHeight
                        || this.getImageryLayer(this.zoom, x, y).id !== "hirise")
                    {
                        continue;
                    }

                    const key = "hirise-" + this.zoom + "-" + x + "-" + y;
                    active.add(key);
                    let tile = this.tiles.get(key);

                    if (tile?.dataset.state === "error" && Date.now() - Number(tile.dataset.failedAt) >= 16000)
                    {
                        this.releaseTile(tile);
                        this.tiles.delete(key);
                        tile = null;
                    }

                    if (!tile)
                    {
                        tile = this.createHiRISETile(x, y, this.zoom);
                        this.tiles.set(key, tile);
                        this.tileContainer.appendChild(tile);
                        tile.startLoading();
                    }

                    tile.style.left = Math.round(x * 256 - center.x + width / 2) + "px";
                    tile.style.top = Math.round(y * 256 - center.y + height / 2) + "px";
                    tile.style.display = "";
                }
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

                this.releaseTile(tile);
                this.tiles.delete(key);

                if (this.tiles.size <= this.tileCacheLimit - 12)
                {
                    break;
                }
            }
        }

        this.updateHiRISEStatus();
    }

    updateHiRISEStatus()
    {
        let loaded = 0;
        let waiting = 0;

        for (const key of this.backgroundActiveTiles)
        {
            const tile = this.backgroundTiles.get(key);

            if (tile?.dataset.state === "loaded")
            {
                loaded++;
            }
            else if (tile?.dataset.state !== "error")
            {
                waiting++;
            }
        }

        for (const key of this.activeTiles)
        {
            const tile = this.tiles.get(key);

            if (tile?.dataset.state === "loaded")
            {
                loaded++;
            }
            else if (tile?.dataset.state !== "error")
            {
                waiting++;
            }
        }

        const anyImagery = loaded > 0;
        this.container.classList.toggle("map-has-imagery", anyImagery);
        this.notice.classList.remove("map-preview-notice");
        this.notice.hidden = anyImagery || (!this.backgroundActiveTiles.size && !this.activeTiles.size);
        this.notice.textContent = waiting > 0
            ? "Loading Mars imagery…" : "NASA imagery is unavailable for this area.";
    }

    renderTiles()
    {
        if (this.capabilitiesReady === false)
        {
            return;
        }

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        if (!width || !height)
        {
            return;
        }

        const center = project(this.center, this.zoom);

        if (this.layer.id === "hirise")
        {
            this.renderHiRISETiles(width, height, center);
            return;
        }

        this.backgroundTileContainer.style.display = "none";
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

                const key = this.layer.id + "-" + this.zoom + "-" + x + "-" + y;
                active.add(key);
                const left = x * 256 - center.x + width / 2;
                const top = y * 256 - center.y + height / 2;
                let tile = this.tiles.get(key);

                if (tile?.dataset.state === "error" && Date.now() - Number(tile.dataset.failedAt) > 18000)
                {
                    this.releaseTile(tile);
                    this.tiles.delete(key);
                    tile = null;
                }

                if (!tile)
                {
                    tile = this.createTile(x, y, this.zoom, left, top);
                    this.tiles.set(key, tile);
                    this.tileContainer.appendChild(tile);
                    tile.startLoading?.();
                }

                tile.style.left = Math.round(left) + "px";
                tile.style.top = Math.round(top) + "px";
                tile.style.display = "";
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

                this.releaseTile(tile);
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
        let detail = 0;
        let preview = 0;
        let pending = 0;
        let missing = 0;

        for (const key of this.activeTiles)
        {
            const tile = this.tiles.get(key);

            if (tile?.dataset.state === "loaded" && tile.dataset.lowDetail !== "true")
            {
                detail++;
            }
            else if (tile?.dataset.state === "loaded")
            {
                preview++;
            }
            else if (tile?.dataset.preview === "loaded")
            {
                preview++;
            }
            else if (tile?.dataset.state === "error" && tile?.dataset.preview === "error")
            {
                missing++;
            }
            else
            {
                pending++;
            }
        }

        const anyImagery = detail + preview > 0;
        const reducedDetail = preview > 0 || missing > 0 && detail > 0;
        this.container.classList.toggle("map-has-imagery", anyImagery);
        this.notice.classList.toggle("map-preview-notice", reducedDetail);
        this.notice.hidden = !reducedDetail && (detail > 0 || !this.activeTiles.size);
        this.notice.textContent = preview > 0
            ? "Lower-resolution NASA imagery is shown in some areas."
            : missing > 0 && detail > 0
                ? "Some NASA map areas are unavailable at this zoom."
                : pending > 0 ? "Loading Mars imagery…" : "NASA imagery is unavailable at this view. Try another basemap.";
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
