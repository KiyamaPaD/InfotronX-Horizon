// Preferences kept in this browser: which blocks are folded, and a small control panel to change or clear them.
// Nothing here is sent anywhere or changes a mission.
const PREFS_KEY = "mars-prefs";
const KNOWN = [
    ["mars-home-skip", "Skip the welcome page next time", "1"],
    ["mars-quick-waypoint", "Ask for details when I add a waypoint", "on"]
];

let cache = null;

function read()
{
    if (!cache)
    {
        try { cache = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") || {}; } catch { cache = {}; }
    }

    return cache;
}

export function getPref(name, fallback = null)
{
    const value = read()[name];
    return value === undefined ? fallback : value;
}

export function setPref(name, value)
{
    read()[name] = value;

    try { localStorage.setItem(PREFS_KEY, JSON.stringify(cache)); } catch { /* storage blocked: the choice lasts until the page closes */ }
}

// Gives every <details data-pref="name"> inside `root` the open or closed state the visitor last chose.
export function rememberDetails(root = document)
{
    for (const details of root.querySelectorAll("details[data-pref]"))
    {
        const stored = getPref("open:" + details.dataset.pref);

        if (stored !== null) details.open = Boolean(stored);

        details.addEventListener("toggle", () => setPref("open:" + details.dataset.pref, details.open));
    }
}

export function clearLayoutPrefs()
{
    cache = {};

    try { localStorage.removeItem(PREFS_KEY); } catch { /* nothing to clear */ }
}

export function mountSettings({ notify })
{
    const dialog = document.createElement("dialog");
    dialog.className = "modal settings-dialog";
    dialog.setAttribute("aria-labelledby", "settings-title");
    dialog.innerHTML = `
        <div class="modal-header"><span class="section-label">SETTINGS</span><button class="modal-x" type="button" data-set="close" aria-label="Close settings">×</button></div>
        <h2 id="settings-title">Your preferences</h2>
        <p class="settings-note">These choices stay in this browser. They never change a mission.</p>
        <div class="settings-list"></div>
        <label class="settings-row">Graphics<select data-set-perf><option value="auto">Automatic</option><option value="light">Lighter (older computers)</option><option value="full">Full detail</option></select></label>
        <div class="dialog-actions">
            <button class="btn btn-outline" type="button" data-set="layout">Reset folded blocks</button>
            <button class="btn btn-accent" type="button" data-set="close">Done</button>
        </div>`;
    document.body.appendChild(dialog);
    const list = dialog.querySelector(".settings-list");
    const perf = dialog.querySelector("[data-set-perf]");

    function paint()
    {
        list.replaceChildren();

        for (const [key, label, yes] of KNOWN)
        {
            const row = document.createElement("label");
            row.className = "settings-row";
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = key === "mars-quick-waypoint" ? localStorage.getItem(key) !== "off" : localStorage.getItem(key) === yes;
            box.addEventListener("change", () =>
            {
                try { localStorage.setItem(key, key === "mars-quick-waypoint" ? (box.checked ? "on" : "off") : (box.checked ? yes : "0")); } catch { /* storage blocked */ }
            });
            row.append(box, document.createTextNode(" " + label));
            list.append(row);
        }

        try { perf.value = localStorage.getItem("mars-perf") || "auto"; } catch { perf.value = "auto"; }
    }

    perf.addEventListener("change", () =>
    {
        try { localStorage.setItem("mars-perf", perf.value); } catch { /* storage blocked */ }
        notify?.("Graphics setting saved. It applies the next time the planet opens.");
    });
    dialog.addEventListener("click", event =>
    {
        const action = event.target.closest("[data-set]")?.dataset.set;

        if (action === "close") dialog.close();
        else if (action === "layout") { clearLayoutPrefs(); notify?.("Folded blocks reset. They open as designed after a reload."); }
    });

    return { open() { paint(); if (!dialog.open) dialog.showModal(); } };
}
