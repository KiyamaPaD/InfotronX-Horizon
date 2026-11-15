# Waypoint & Mission Editor V2

The map remains manual-first: users create and edit mission data without AI confirmation or external approval.

## Editing on the map

- Choose **Draw** and click to add a waypoint, or use **Coordinates** for precise values.
- In **Explore** or **Move**, click an existing waypoint icon to open the waypoint editor.
- Right-click the map for a context menu. On an existing waypoint, select **Edit waypoint** or **Delete waypoint**. On empty terrain, choose **Place waypoint here** or **Add field note here**.
- In **Move**, drag a marker to change its geographic coordinates; ordinary Explore mode pans the map.
- On touch screens, tapping a waypoint opens the same editor. The right-click menu is an optional desktop shortcut.

Waypoint fields include an optional name, category, description, icon, individual color and precise latitude/longitude. Categories are human planning labels, not verified NASA classifications. Setting **Use active route color** keeps the marker's appearance in sync with the route color.

The waypoint's actual latitude and longitude always determine route geometry and distance. Its icon is not displaced at lower zoom levels.

## Mission and route editing

Use **Edit mission** to change the title and description. The Route Planner supports route naming, route color selection, manual waypoint order changes, duplication and separate route alternatives. New missions begin without automatic demo markers. Example missions are opened explicitly.

## Undo, redo and checkpoints

**Undo** (Ctrl+Z) and **Redo** (Ctrl+Y or Ctrl+Shift+Z) cover local mission edits including waypoint creation, deletion, movement, details, route color and mission changes. The history keeps up to 40 previous mission states in memory, for the currently active mission only. Switching missions starts a fresh history. History is intentionally not persisted across browser reloads.

Mission checkpoints and exported JSON are distinct durable ways to preserve earlier work. Restore a checkpoint if you need a persistent version rather than a short-term undo operation. Saving to a cloud account remains an explicit action, not synchronous multiuser editing.

## Persistence and scientific integrity

User-entered waypoint metadata survives local storage, mission JSON, checkpoints and cloud snapshot validation. GeoJSON includes the waypoint metadata in each route feature's properties, without modifying geographic coordinates. Existing missions with only coordinates continue to load.

Renaming a waypoint or changing its icon/category/color does not invalidate its numerical terrain analysis. Changing geographic coordinates invalidates any cached route-specific terrain model, since it describes the previous path. A label such as **Hypothetical hazard** is not evidence of a real mapped obstacle.

## Verification

Run `npm test` for model validation, route geometry, metadata and undo/redo regression checks. The optional GitHub Actions Chromium map-browser job also exercises real NASA tiles and the waypoint edit flow. It is triggered with a commit message containing `[browser]` or manually from Actions.
