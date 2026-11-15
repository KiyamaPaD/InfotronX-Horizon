// A small window that opens right after a waypoint is placed: name it, pick what kind of place it is, and see what to do there.
// The presets fill in the name, type, symbol, colour and a short plan. Everything can be changed, and the window can be turned off.
import { WAYPOINT_PRESETS } from "./mars-sites.js";

const ASK_KEY = "mars-quick-waypoint";

export function quickWaypointEnabled()
{
    try
    {
        return localStorage.getItem(ASK_KEY) !== "off";
    }
    catch
    {
        return true;
    }
}

export function mountQuickWaypoint({ store, notify, openFullEditor })
{
    const dialog = document.createElement("dialog");
    dialog.className = "modal quick-waypoint";
    dialog.setAttribute("aria-labelledby", "quick-waypoint-title");
    dialog.innerHTML = `
        <div class="modal-header"><span class="section-label">NEW WAYPOINT</span><button class="modal-x" type="button" data-qw="skip" aria-label="Close">×</button></div>
        <h2 id="quick-waypoint-title">What is this place?</h2>
        <p class="qw-coords" data-qw="coords"></p>
        <label class="qw-field">Name<input type="text" maxlength="80" data-qw="name" placeholder="Waypoint" autocomplete="off"></label>
        <div class="qw-presets" role="group" aria-label="Kind of waypoint">
            ${WAYPOINT_PRESETS.map(preset => `<button type="button" class="qw-preset" data-qw-preset="${preset.id}" aria-pressed="false"><i style="background:${preset.color}"></i>${preset.label}</button>`).join("")}
        </div>
        <label class="qw-field">What to do here<textarea rows="3" maxlength="500" data-qw="todo" placeholder="Choose a kind above for a ready-made plan, or write your own."></textarea></label>
        <p class="qw-note">Your plan is a note you write. It is not measured data.</p>
        <label class="qw-ask"><input type="checkbox" data-qw="ask"> Ask me this each time I add a waypoint</label>
        <div class="dialog-actions">
            <button class="btn btn-quiet" type="button" data-qw="more">More options</button>
            <button class="btn btn-outline" type="button" data-qw="skip">Skip</button>
            <button class="btn btn-accent" type="button" data-qw="save">Save waypoint</button>
        </div>`;
    document.body.appendChild(dialog);
    const part = name => dialog.querySelector(`[data-qw="${name}"]`);
    let pointId = null;
    let preset = null;
    let lastName = "";
    let lastTodo = "";

    function choose(id)
    {
        preset = WAYPOINT_PRESETS.find(item => item.id === id) || null;
        dialog.querySelectorAll("[data-qw-preset]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.qwPreset === id)));

        if (!preset) return;

        // Only replace what the user has not changed.
        if (!part("name").value.trim() || part("name").value === lastName) part("name").value = preset.name;
        if (!part("todo").value.trim() || part("todo").value === lastTodo) part("todo").value = preset.todo;
        lastName = preset.name;
        lastTodo = preset.todo;
    }

    function open(id, presetId = null)
    {
        const point = store.activeRoute.points.find(item => item.id === id);

        if (!point) return;

        pointId = id;
        preset = null;
        lastName = "";
        lastTodo = "";
        const index = store.activeRoute.points.indexOf(point);
        part("coords").textContent = `Waypoint ${index + 1} · ${point.lat.toFixed(4)}° N · ${point.lon.toFixed(4)}° E`;
        part("name").value = point.name || "";
        part("name").placeholder = `Waypoint ${index + 1}`;
        part("todo").value = point.description || "";
        part("ask").checked = quickWaypointEnabled();
        dialog.querySelectorAll("[data-qw-preset]").forEach(button => button.setAttribute("aria-pressed", "false"));

        if (presetId) choose(presetId);

        if (!dialog.open) dialog.showModal();

        part("name").focus();
    }

    function save()
    {
        const point = store.activeRoute.points.find(item => item.id === pointId);

        if (point)
        {
            const input = { lat: point.lat, lon: point.lon, name: part("name").value, description: part("todo").value };

            if (preset)
            {
                input.category = preset.category;
                input.icon = preset.icon;
                input.color = preset.color;
            }

            store.updateWaypoint(pointId, input);
        }

        dialog.close();
    }

    dialog.addEventListener("click", event =>
    {
        const action = event.target.closest("[data-qw]")?.dataset.qw;
        const presetId = event.target.closest("[data-qw-preset]")?.dataset.qwPreset;

        if (presetId) choose(presetId);
        else if (action === "save") save();
        else if (action === "skip") dialog.close();
        else if (action === "more")
        {
            const id = pointId;
            dialog.close();
            openFullEditor?.(id);
        }
    });
    part("name").addEventListener("keydown", event => { if (event.key === "Enter") { event.preventDefault(); save(); } });
    part("ask").addEventListener("change", event =>
    {
        try { localStorage.setItem(ASK_KEY, event.target.checked ? "on" : "off"); } catch { /* storage blocked */ }
        if (!event.target.checked) notify?.("Waypoints will be added without asking. Edit one any time by clicking it.");
    });

    return { open };
}
