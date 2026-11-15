// The guided tour, in order. `view` switches the workspace first (explore, plan, analyze or all) so the target is on screen.
// A step whose target cannot be found is shown in the middle of the screen instead, so nothing is skipped silently.
export const TUTORIAL_STEPS = [
    { chapter: "WELCOME", title: "Welcome to Mars Atlas", text: "This tour walks through every part of the app, one step at a time. Use Next or the arrow keys. You can close it at any moment and replay it from the Tutorial button." },
    { chapter: "WELCOME", view: "explore", element: ".workflow-steps", position: "bottom", title: "Three steps, one panel at a time", text: "Explore, Plan and Analyze guide your work. The app moves you forward when you act, for example after your first waypoint. \"All tools\" shows everything at once." },

    { chapter: "1 · EXPLORE", view: "explore", element: ".top-section", position: "right", title: "Your mission", text: "Name and describe your mission here. New mission starts a fresh one and Edit mission renames it. Everything is saved on this device automatically." },
    { chapter: "1 · EXPLORE", view: "explore", element: "[data-action='load-review-demo']", position: "right", title: "Example mission", text: "Open a ready-made route across Jezero to try every tool without drawing anything first." },
    { chapter: "1 · EXPLORE", view: "explore", element: "#layer-buttons", position: "right", title: "Map layers", text: "Choose the imagery: Viking global colour, sharp HiRISE detail near Jezero, or MOLA shaded relief. MOLA shows shading, not altitude." },
    { chapter: "1 · EXPLORE", view: "explore", element: ".map-controls", position: "left", title: "Map controls", text: "Zoom in and out, fit the map to your route, reset the view, or open the 3D terrain of Jezero Crater." },
    { chapter: "1 · EXPLORE", view: "explore", element: ".live-coordinate", position: "top", title: "Live coordinates", text: "Shows the latitude and longitude under your pointer, in degrees on Mars." },
    { chapter: "1 · EXPLORE", view: "explore", element: ".panel-toggle-left", position: "right", title: "Hide the panel", text: "Use this tab to hide the side panel and give the map the whole screen. Click it again to bring the panel back." },

    { chapter: "2 · PLAN", view: "plan", element: ".mode-switcher", position: "right", title: "Map tools", text: "Explore moves the map. Draw adds waypoints when you click. Move drags a waypoint. Observe drops a field note on the map." },
    { chapter: "2 · PLAN", view: "plan", element: "#route-list", position: "right", title: "Your routes", text: "Each route is a list of waypoints. Click a route to make it the active one. Distances are calculated on the real radius of Mars." },
    { chapter: "2 · PLAN", view: "plan", element: "[data-action='add-coordinates']", position: "right", title: "Type coordinates", text: "Add a waypoint by typing an exact latitude and longitude instead of clicking." },
    { chapter: "2 · PLAN", view: "plan", element: ".route-history", position: "right", title: "Undo and redo", text: "Every edit can be undone with Ctrl+Z and redone with Ctrl+Y. Undo only covers the current mission." },
    { chapter: "2 · PLAN", view: "plan", element: ".route-options", position: "right", title: "Route options", text: "Duplicate a route to try an alternative, rename it, clear its points, delete it, or pick its colour on the map." },

    { chapter: "3 · ANALYZE", view: "analyze", element: ".ad-chips", position: "bottom", title: "Six steps to understand a route", text: "Size, Height, Legs, Compare, 3D and Decide, plus a place to ask questions. Click a number to jump, or follow Next step. This page fills in once your route has two or more waypoints." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-1", position: "top", title: "1 · Size", text: "Distance along the surface of Mars, the number of waypoints, the longest leg and the total climb and descent. Each figure is labelled Calculated, Your plan or Unknown." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-2", position: "top", title: "2 · Height", text: "An elevation profile from the USGS terrain model. Move the mouse over it to read distance and height. Where there is no height data, the answer is Unknown, never flat or safe." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-3", position: "top", title: "3 · Legs", text: "Bars for each leg. The longest one is highlighted, and splitting it gives you more places to check." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-4", position: "top", title: "4 · Compare", text: "Put your routes side by side. A shorter route is not automatically safer, so read distance together with slope." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-5", position: "top", title: "5 · 3D", text: "See your route on the terrain in 3D, on a small planet with real Viking colour and MOLA relief. Drag to look around." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-6", position: "top", title: "6 · Decide", text: "A checklist built from your numbers: waypoints, height coverage, slope and comparison. It helps you choose; the decision stays yours." },
    { chapter: "3 · ANALYZE", view: "analyze", element: "#ad-step-7", position: "top", title: "7 · Ask a question", text: "Ask about your route in your own words. Answers come from your own numbers and work offline. The optional AI explanation needs sign-in and your consent, and never receives coordinates, titles or notes." },

    { chapter: "ALL TOOLS", view: "all", element: ".analytics-categories", position: "left", title: "Science, math and resources", text: "Overview, Terrain & math, Models & resources and Mission group every tool. Pick a group to see its tools." },
    { chapter: "ALL TOOLS", view: "all", element: "#analytics-section-select", position: "left", title: "Go to a tool", text: "Jump straight to any tool in the current group. Each tool can be opened or collapsed with its + and − button." },
    { chapter: "ALL TOOLS", view: "all", element: ".analytics-readiness", position: "left", title: "What each tool needs", text: "A short checklist: a route with two waypoints, numeric elevation data, and a second route to compare. Tools explain what is missing instead of guessing." },
    { chapter: "ALL TOOLS", view: "all", element: ".bottom-area", position: "top", title: "Route comparison", text: "Compare route distances. Simulate a detour makes an illustrative alternative, and How to choose a route explains how to judge them." },
    { chapter: "ALL TOOLS", view: "all", element: "#tab-notes", position: "left", title: "Field notes", text: "Notes tied to places on the map: samples, hazards or reminders. They stay with your mission." },
    { chapter: "ALL TOOLS", view: "all", element: ".header-copilot", position: "bottom", title: "Insights", text: "Quick explanations of your route computed on your device. Nothing is sent anywhere unless you ask the optional AI." },

    { chapter: "SHARE & HELP", element: ".header-cloud", position: "bottom", title: "Mission Center", text: "Save and open missions, export a backup, keep checkpoints, use the cloud library and share with teammates by email." },
    { chapter: "SHARE & HELP", element: ".header-share", position: "bottom", title: "Share mission", text: "Create a link to your mission. Anyone with the link can see its data, so share it only with people you trust." },
    { chapter: "SHARE & HELP", element: ".header-help", position: "bottom", title: "Help", text: "Keyboard shortcuts and a short guide. You can also open it any time with the ? button." },
    { chapter: "READY", title: "You're ready", text: "Start by drawing a route on the map. Mars Atlas is a planning aid, not a navigation tool, and nothing in it is approved by NASA. Replay this tour from the Tutorial button whenever you like." }
];
