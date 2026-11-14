# Mars Atlas — Interface System V4


## Interface hierarchy

- **Desktop:** workspace header, left mission planner, central Mars map and route comparison, right scientific analytics.
- **Tablet and mobile:** map-first experience. Planner and Science open as dismissible drawers from the bottom navigation. Edit tools remain available over the map.
- **Focus mode:** collapses desktop side panels to prioritize the map without changing stored mission data.
- **Field guide:** three-step help dialog and keyboard shortcuts. No account or onboarding gate.

## Controls

| Action | Shortcut |
| --- | --- |
| Explore / pan | E |
| Draw new waypoint | D |
| Move existing waypoint | M |
| Record observation | N |
| Return to Explore or close mobile drawer | Escape |
| Undo last waypoint | Ctrl/Cmd + Z |

The Science tab switcher supports left/right arrow keys. Editing precise coordinates is accessible from the Planner without pointing at the map.

## Readability and accessibility

- Larger default text and contrast-oriented neutral-dark colors.
- Readable labels, 40–47 px controls for frequent actions, keyboard focus outlines and semantic navigation.
- `aria-pressed` for map modes, mobile navigation and basemap selection; accessible help dialog; skip-to-map link.
- Respects `prefers-reduced-motion`.

## Visual vocabulary

| Token | Value | Purpose |
| --- | --- | --- |
| Background | `#080d14` | Unobtrusive map context |
| Panel | `#111923` | Readable mission panels |
| Foreground | `#f5f7fa` | Primary text |
| Mars accent | `#e99570` | Active actions / selection |
| Mint accent | `#8ddfcb` | Positive system state |

The fall-back visual field is abstract. It is **not an elevation model or a georeferenced image**. Mars Trek imagery displays when available; no hazard, slope or elevation claims are inferred from colors.

## Technology decision

The current app uses modular HTML/CSS/JavaScript. This revision introduces no build step, third-party runtime or authentication dependency, preserving simple static hosting and the validated mission engine. React + TypeScript can improve larger-team maintenance later, but a complete framework rewrite is a poor trade-off before verifying the NASA tiles and submission demo. A 3D map would use browser-side WebGL/Three.js, not Node.js itself; high-quality 3D also needs a correctly referenced terrain DEM.
