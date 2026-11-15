import { JEZERO, STORAGE_KEY, ROUTE_COLORS, MAX_OBSERVATIONS, MAX_POINTS_PER_ROUTE } from "./constants.js";
import { isValidCoordinate } from "./geo.js";
import { MARKER_ICONS, normalizeMarkerIcon } from "./marker-icons.js";
import { DEFAULT_EVA_ASSUMPTIONS, validateEvaAssumptions } from "./resources.js";

const createId = () => crypto.randomUUID();
const MAX_MISSIONS = 30;
const MAX_ROUTES = 15;
const MAX_CHECKPOINTS = 8;

export function createMission(title = "Untitled Marswalk")
{
    const routeId = createId();

    return {
        id: createId(),
        title,
        description: "Exploration mission · Jezero Crater",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        activeRouteId: routeId,
        routes: [{ id: routeId, name: "Primary route", color: ROUTE_COLORS[0], points: [] }],
        observations: [],
        evaScenario: { ...DEFAULT_EVA_ASSUMPTIONS },
        checkpoints: []
    };
}

export function createDemoMission()
{
    const mission = createMission("Jezero field reconnaissance");
    mission.description = "Explore Jezero with an editable route. Traversability has not been assessed.";
    mission.routes[0].points = [
        { id: createId(), lat: 18.44460, lon: 77.45090 },
        { id: createId(), lat: 18.44960, lon: 77.45610 },
        { id: createId(), lat: 18.45490, lon: 77.46200 },
        { id: createId(), lat: 18.46020, lon: 77.46950 }
    ];
    mission.observations.push({
        id: createId(), lat: 18.45160, lon: 77.45920,
        title: "Survey checkpoint", note: "Example user note. Not a verified geological discovery.",
        source: "User annotation", createdAt: new Date().toISOString()
    });

    return mission;
}

export function validateMission(candidate)
{
    if (!candidate || typeof candidate !== "object" || !Array.isArray(candidate.routes) || candidate.routes.length > MAX_ROUTES)
    {
        return null;
    }

    const mission = createMission(String(candidate.title || "Imported mission").slice(0, 90));
    mission.id = typeof candidate.id === "string" ? candidate.id.slice(0, 80) : mission.id;
    mission.description = String(candidate.description || "").slice(0, 300);

    try
    {
        mission.evaScenario = validateEvaAssumptions(candidate.evaScenario || {});
    }
    catch
    {
        mission.evaScenario = { ...DEFAULT_EVA_ASSUMPTIONS };
    }
    mission.routes = candidate.routes.filter(route => route && typeof route === "object" && !Array.isArray(route)).map((route, index) => ({
        id: String(route.id || createId()).slice(0, 80),
        name: String(route.name || `Route ${index + 1}`).slice(0, 70),
        color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        points: Array.isArray(route.points) ? route.points.filter(isValidCoordinate).slice(0, MAX_POINTS_PER_ROUTE).map(point => ({ id: String(point.id || createId()).slice(0, 80), lat: Number(point.lat), lon: Number(point.lon), ...(typeof point.icon === "string" ? { icon: normalizeMarkerIcon(point.icon) } : {}) })) : [],
        terrainModel: readTerrainMetadata(route.terrainModel)
    }));
    mission.observations = Array.isArray(candidate.observations) ? candidate.observations.filter(observation => observation && typeof observation === "object" && isValidCoordinate(observation)).slice(0, MAX_OBSERVATIONS).map(observation => ({
        id: String(observation.id || createId()).slice(0, 80),
        lat: Number(observation.lat), lon: Number(observation.lon),
        title: String(observation.title || "Observation").slice(0, 80),
        note: String(observation.note || "").slice(0, 500),
        source: String(observation.source || "User annotation").slice(0, 160),
        createdAt: String(observation.createdAt || new Date().toISOString()),
        ...(typeof observation.icon === "string" ? { icon: normalizeMarkerIcon(observation.icon) } : {})
    })) : [];
    mission.checkpoints = Array.isArray(candidate.checkpoints) ? candidate.checkpoints.slice(0, MAX_CHECKPOINTS).filter(item => item && typeof item === "object" && Array.isArray(item.routes) && item.routes.length > 0 && item.routes.length <= MAX_ROUTES).map(item =>
    {
        const routes = item.routes.filter(route => route && typeof route === "object" && Array.isArray(route.points)).map((route, index) => ({
            id: String(route.id || createId()).slice(0, 80),
            name: String(route.name || `Route ${index + 1}`).slice(0, 70),
            color: ROUTE_COLORS[index % ROUTE_COLORS.length],
            points: route.points.filter(isValidCoordinate).slice(0, MAX_POINTS_PER_ROUTE).map(point => ({ id: String(point.id || createId()).slice(0, 80), lat: Number(point.lat), lon: Number(point.lon), ...(typeof point.icon === "string" ? { icon: normalizeMarkerIcon(point.icon) } : {}) })),
            terrainModel: readTerrainMetadata(route.terrainModel)
        }));
        const observations = Array.isArray(item.observations) ? item.observations.filter(observation => observation && isValidCoordinate(observation)).slice(0, MAX_OBSERVATIONS).map(observation => ({
            id: String(observation.id || createId()).slice(0, 80), lat: Number(observation.lat), lon: Number(observation.lon),
            title: String(observation.title || "Observation").slice(0, 80), note: String(observation.note || "").slice(0, 500),
            source: String(observation.source || "User annotation").slice(0, 160), createdAt: String(observation.createdAt || ""),
            ...(typeof observation.icon === "string" ? { icon: normalizeMarkerIcon(observation.icon) } : {})
        })) : [];
        return {
            id: String(item.id || createId()).slice(0, 80),
            label: String(item.label || "Mission checkpoint").slice(0, 70),
            createdAt: String(item.createdAt || new Date().toISOString()),
            activeRouteId: routes.some(route => route.id === item.activeRouteId) ? item.activeRouteId : routes[0]?.id,
            routes,
            observations,
            evaScenario: safeEvaScenario(item.evaScenario)
        };
    }).filter(item => item.routes.length > 0) : [];
    mission.activeRouteId = mission.routes.some(route => route.id === candidate.activeRouteId) ? candidate.activeRouteId : mission.routes[0]?.id;
    mission.createdAt = typeof candidate.createdAt === "string" ? candidate.createdAt : mission.createdAt;
    mission.updatedAt = new Date().toISOString();

    if (!mission.routes.length)
    {
        mission.routes = createMission().routes;
        mission.activeRouteId = mission.routes[0].id;
    }

    return mission;
}

function safeEvaScenario(candidate)
{
    try
    {
        return validateEvaAssumptions(candidate || {});
    }
    catch
    {
        return { ...DEFAULT_EVA_ASSUMPTIONS };
    }
}

function readTerrainMetadata(candidate)
{
    if (!candidate || typeof candidate !== "object" || typeof candidate.source !== "string")
    {
        return null;
    }

    const stats = candidate.stats;

    if (!stats || ![stats.distanceMeters, stats.ascentMeters, stats.descentMeters, stats.maxGradePercent].every(Number.isFinite))
    {
        return null;
    }

    const scenario = candidate.scenario && typeof candidate.scenario === "object" ? candidate.scenario : null;
    const exclusions = Array.isArray(scenario?.exclusionZones) ? scenario.exclusionZones.slice(0, 20).filter(zone => isValidCoordinate(zone) && Number.isFinite(zone.radiusMeters) && zone.radiusMeters >= 1 && zone.radiusMeters <= 5000).map(zone => ({
        observationId: String(zone.observationId || "").slice(0, 80),
        title: String(zone.title || "User observation").slice(0, 80),
        lat: zone.lat, lon: zone.lon, radiusMeters: zone.radiusMeters
    })) : [];

    return {
        source: candidate.source.slice(0, 240),
        unverified: true,
        scenario: scenario ? {
            model: scenario.model === "Two-objective Pareto on sampled DEM" ? scenario.model : "A* 8-neighbor numeric DEM scenario",
            maxSlopePercent: Number.isFinite(scenario.maxSlopePercent) ? Math.max(0, Math.min(100, scenario.maxSlopePercent)) : null,
            slopePenalty: Number.isFinite(scenario.slopePenalty) ? Math.max(0, Math.min(100, scenario.slopePenalty)) : null,
            exclusionZones: exclusions,
            verified: false
        } : null,
        stats: {
            distanceMeters: Math.max(0, stats.distanceMeters),
            ascentMeters: Math.max(0, stats.ascentMeters),
            descentMeters: Math.max(0, stats.descentMeters),
            maxGradePercent: Math.max(0, stats.maxGradePercent)
        }
    };
}

export class MissionStore
{
    constructor()
    {
        this.listeners = new Set();
        this.missions = this.read();
        this.activeId = this.missions.some(mission => mission.id === this.loadedActiveId) ? this.loadedActiveId : this.missions[0].id;
        this.lastSaveSucceeded = true;
    }

    read()
    {
        try
        {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            const rows = Array.isArray(stored) ? stored : stored?.missions;
            this.loadedActiveId = typeof stored?.activeId === "string" ? stored.activeId : null;
            const missions = Array.isArray(rows) ? rows.slice(0, MAX_MISSIONS).map(validateMission).filter(Boolean) : [];

            return missions.length ? missions : [createDemoMission()];
        }
        catch
        {
            return [createDemoMission()];
        }
    }

    get current()
    {
        return this.missions.find(mission => mission.id === this.activeId) || this.missions[0];
    }

    get activeRoute()
    {
        return this.current.routes.find(route => route.id === this.current.activeRouteId) || this.current.routes[0];
    }

    subscribe(listener)
    {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    save(touch = true)
    {
        if (touch)
        {
            this.current.updatedAt = new Date().toISOString();
        }

        try
        {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ activeId: this.activeId, missions: this.missions }));
            this.lastSaveSucceeded = true;
        }
        catch (error)
        {
            this.lastSaveSucceeded = false;
            console.warn("Local storage unavailable", error);
        }

        for (const listener of this.listeners)
        {
            listener();
        }
    }

    setEvaScenario(input)
    {
        this.current.evaScenario = validateEvaAssumptions(input);
        this.save();
        return this.current.evaScenario;
    }

    addMission(title)
    {
        if (this.missions.length >= MAX_MISSIONS)
        {
            return null;
        }

        const mission = createMission(title);
        this.missions.unshift(mission);
        this.activeId = mission.id;
        this.save();
        return mission;
    }

    selectMission(id)
    {
        if (!this.missions.some(mission => mission.id === id))
        {
            return;
        }

        this.activeId = id;
        this.save(false);
    }

    deleteMission(id)
    {
        if (!this.missions.some(mission => mission.id === id))
        {
            return false;
        }

        this.missions = this.missions.filter(mission => mission.id !== id);

        if (!this.missions.length)
        {
            this.missions = [createMission("New Marswalk")];
        }

        if (this.activeId === id)
        {
            this.activeId = this.missions[0].id;
        }

        this.save(false);
        return true;
    }

    loadCloudMission(candidate)
    {
        const mission = validateMission(candidate);

        if (!mission)
        {
            return false;
        }

        const previous = this.missions.findIndex(item => item.id === mission.id);

        if (previous < 0 && this.missions.length >= MAX_MISSIONS)
        {
            return false;
        }

        if (previous >= 0)
        {
            this.missions[previous] = mission;
        }
        else
        {
            this.missions.unshift(mission);
        }

        this.activeId = mission.id;
        this.save(false);
        return true;
    }

    importMission(candidate)
    {
        const mission = validateMission(candidate);

        if (!mission)
        {
            return false;
        }

        if (this.missions.length >= MAX_MISSIONS)
        {
            return false;
        }

        mission.id = createId();
        this.missions.unshift(mission);
        this.activeId = mission.id;
        this.save();
        return true;
    }

    saveCheckpoint(label = "Mission checkpoint")
    {
        if (this.current.checkpoints.length >= MAX_CHECKPOINTS)
        {
            return null;
        }

        const snapshot = {
            id: createId(),
            label: String(label).trim().slice(0, 70) || "Mission checkpoint",
            createdAt: new Date().toISOString(),
            activeRouteId: this.current.activeRouteId,
            evaScenario: structuredClone(this.current.evaScenario),
            routes: structuredClone(this.current.routes),
            observations: structuredClone(this.current.observations)
        };
        this.current.checkpoints.unshift(snapshot);
        this.save();
        return snapshot;
    }

    restoreCheckpoint(id)
    {
        const snapshot = this.current.checkpoints.find(item => item.id === id);

        if (!snapshot)
        {
            return false;
        }

        this.current.routes = structuredClone(snapshot.routes);
        this.current.evaScenario = safeEvaScenario(snapshot.evaScenario);
        this.current.observations = structuredClone(snapshot.observations);
        this.current.activeRouteId = snapshot.activeRouteId;
        this.save();
        return true;
    }

    deleteCheckpoint(id)
    {
        const previous = this.current.checkpoints.length;
        this.current.checkpoints = this.current.checkpoints.filter(item => item.id !== id);

        if (this.current.checkpoints.length === previous)
        {
            return false;
        }

        this.save();
        return true;
    }

    reorderPoint(id, offset)
    {
        if (offset !== -1 && offset !== 1)
        {
            return false;
        }

        const points = this.activeRoute.points;
        const index = points.findIndex(point => point.id === id);
        const destination = index + offset;

        if (index < 0 || destination < 0 || destination >= points.length)
        {
            return false;
        }

        [points[index], points[destination]] = [points[destination], points[index]];
        this.activeRoute.terrainModel = null;
        this.save();
        return true;
    }

    addObservationWaypoint(id)
    {
        const observation = this.current.observations.find(item => item.id === id);

        if (!observation)
        {
            return false;
        }

        return this.addPoint({ lat: observation.lat, lon: observation.lon });
    }

    addRoute(name = "Alternative route")
    {
        if (this.current.routes.length >= MAX_ROUTES)
        {
            return null;
        }

        const route = { id: createId(), name, color: ROUTE_COLORS[this.current.routes.length % ROUTE_COLORS.length], points: [] };
        this.current.routes.push(route);
        this.current.activeRouteId = route.id;
        this.save();
        return route;
    }

    duplicateRoute()
    {
        const source = this.activeRoute;
        const route = this.addRoute(`${source.name} · copy`);

        if (!route)
        {
            return null;
        }

        route.points = source.points.map(point => ({ ...point, id: createId() }));
        route.terrainModel = readTerrainMetadata(source.terrainModel);
        this.save();
        return route;
    }

    selectRoute(id)
    {
        if (this.current.routes.some(route => route.id === id))
        {
            this.current.activeRouteId = id;
            this.save();
        }
    }

    deleteRoute(id)
    {
        if (this.current.routes.length <= 1)
        {
            return false;
        }

        this.current.routes = this.current.routes.filter(route => route.id !== id);
        this.current.activeRouteId = this.current.routes[0].id;
        this.save();
        return true;
    }

    addPoint(coordinate)
    {
        if (!isValidCoordinate(coordinate) || this.activeRoute.points.length >= MAX_POINTS_PER_ROUTE)
        {
            return false;
        }

        this.activeRoute.points.push({ id: createId(), lat: coordinate.lat, lon: coordinate.lon });
        this.activeRoute.terrainModel = null;
        this.save();
        return true;
    }

    movePoint(id, coordinate, persist = true)
    {
        const point = this.activeRoute.points.find(item => item.id === id);

        if (!point || !isValidCoordinate(coordinate))
        {
            return false;
        }

        point.lat = coordinate.lat;
        point.lon = coordinate.lon;
        this.activeRoute.terrainModel = null;

        if (persist)
        {
            this.save();
        }

        return true;
    }

    updatePoint(id, coordinate)
    {
        const point = this.activeRoute.points.find(item => item.id === id);

        if (!point || !isValidCoordinate(coordinate))
        {
            return false;
        }

        point.lat = coordinate.lat;
        point.lon = coordinate.lon;
        this.activeRoute.terrainModel = null;
        this.save();
        return true;
    }

    setPointIcon(id, icon)
    {
        const point = this.activeRoute.points.find(item => item.id === id);

        if (!point || !MARKER_ICONS.some(option => option.id === icon))
        {
            return false;
        }

        point.icon = icon;
        this.save();
        return true;
    }

    removePoint(id)
    {
        this.activeRoute.points = this.activeRoute.points.filter(point => point.id !== id);
        this.activeRoute.terrainModel = null;
        this.save();
    }

    undoPoint()
    {
        if (this.activeRoute.points.length)
        {
            this.activeRoute.points.pop();
            this.activeRoute.terrainModel = null;
            this.save();
        }
    }

    addObservation(coordinate, title, note, source = "User annotation")
    {
        if (!isValidCoordinate(coordinate) || this.current.observations.length >= MAX_OBSERVATIONS)
        {
            return false;
        }

        this.current.observations.push({ id: createId(), lat: coordinate.lat, lon: coordinate.lon, title: String(title).slice(0, 80), note: String(note).slice(0, 500), source: String(source || "User annotation").slice(0, 160), createdAt: new Date().toISOString() });
        this.save();
        return true;
    }

    setObservationIcon(id, icon)
    {
        const observation = this.current.observations.find(item => item.id === id);

        if (!observation || !MARKER_ICONS.some(option => option.id === icon))
        {
            return false;
        }

        observation.icon = icon;
        this.save();
        return true;
    }

    deleteObservation(id)
    {
        this.current.observations = this.current.observations.filter(observation => observation.id !== id);
        this.save();
    }
}
