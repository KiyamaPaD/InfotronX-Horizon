// One set of line settings shared by the 2D map and the 3D planet, with a small control panel to change them.
// Saved in the browser as a preference; it never changes your mission data.
const KEY = "mars-line-style";

export const DEFAULT_LINE_STYLE = Object.freeze({
    width: 1,        // multiplier of the normal line thickness
    opacity: 1,      // 0.3 - 1
    style: "solid",  // solid, dashed or flowing (animated)
    glow: true,      // dark outline that keeps the line readable on bright ground
    markerSize: 1,   // multiplier of the waypoint marker size
    animate: true    // pulsing rings and the marker that travels along the route (3D)
});

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));

export function cleanLineStyle(source)
{
    const input = source && typeof source === "object" ? source : {};
    return {
        width: clamp(Number(input.width) || DEFAULT_LINE_STYLE.width, 0.4, 4),
        opacity: clamp(Number(input.opacity) || DEFAULT_LINE_STYLE.opacity, 0.3, 1),
        style: ["solid", "dashed", "flowing"].includes(input.style) ? input.style : DEFAULT_LINE_STYLE.style,
        glow: input.glow === undefined ? DEFAULT_LINE_STYLE.glow : Boolean(input.glow),
        markerSize: clamp(Number(input.markerSize) || DEFAULT_LINE_STYLE.markerSize, 0.5, 2.5),
        animate: input.animate === undefined ? DEFAULT_LINE_STYLE.animate : Boolean(input.animate)
    };
}

let current = null;

export function getLineStyle()
{
    if (!current)
    {
        try
        {
            current = cleanLineStyle(JSON.parse(localStorage.getItem(KEY) || "null"));
        }
        catch
        {
            current = cleanLineStyle(null);
        }
    }

    return current;
}

export function setLineStyle(changes)
{
    current = cleanLineStyle({ ...getLineStyle(), ...changes });

    try
    {
        localStorage.setItem(KEY, JSON.stringify(current));
    }
    catch
    {
        // Storage blocked: the setting still applies until the page closes.
    }

    window.dispatchEvent(new CustomEvent("mars-line-style", { detail: current }));
    return current;
}

// Builds the controls inside `container`. `route` supplies the active route's colour.
export function mountLineControls(container, route = {})
{
    const style = getLineStyle();
    container.innerHTML = `
        <label class="ls-row">Thickness<span data-ls-out="width"></span><input type="range" data-ls="width" min="0.4" max="4" step="0.1"></label>
        <label class="ls-row">Opacity<span data-ls-out="opacity"></span><input type="range" data-ls="opacity" min="0.3" max="1" step="0.05"></label>
        <label class="ls-row">Waypoint size<span data-ls-out="markerSize"></span><input type="range" data-ls="markerSize" min="0.5" max="2.5" step="0.1"></label>
        <div class="ls-row ls-choice" role="group" aria-label="Line style">Style
            <span><button type="button" data-ls-style="solid">Solid</button><button type="button" data-ls-style="dashed">Dashed</button><button type="button" data-ls-style="flowing">Flowing</button></span>
        </div>
        <label class="ls-row ls-colour">Route colour<input type="color" data-ls-colour aria-label="Active route colour"></label>
        <label class="ls-check"><input type="checkbox" data-ls="glow"> Dark outline for contrast</label>
        <label class="ls-check"><input type="checkbox" data-ls="animate"> Animated markers (3D)</label>
        <button type="button" class="ls-reset" data-ls-reset>Reset to defaults</button>`;

    const paint = () =>
    {
        const now = getLineStyle();

        for (const input of container.querySelectorAll("[data-ls]"))
        {
            if (input.type === "checkbox") input.checked = Boolean(now[input.dataset.ls]);
            else input.value = String(now[input.dataset.ls]);
        }

        container.querySelector('[data-ls-out="width"]').textContent = now.width.toFixed(1) + "×";
        container.querySelector('[data-ls-out="opacity"]').textContent = Math.round(now.opacity * 100) + "%";
        container.querySelector('[data-ls-out="markerSize"]').textContent = now.markerSize.toFixed(1) + "×";
        container.querySelectorAll("[data-ls-style]").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.lsStyle === now.style)));
        const colour = container.querySelector("[data-ls-colour]");
        const routeColour = route.getColor?.();

        if (routeColour && /^#[0-9a-f]{6}$/i.test(routeColour)) colour.value = routeColour;
    };

    container.addEventListener("input", event =>
    {
        const key = event.target.dataset.ls;

        if (key) setLineStyle({ [key]: event.target.type === "checkbox" ? event.target.checked : Number(event.target.value) });
        else if (event.target.matches("[data-ls-colour]")) route.setColor?.(event.target.value);
    });
    container.addEventListener("click", event =>
    {
        const choice = event.target.closest("[data-ls-style]")?.dataset.lsStyle;

        if (choice) setLineStyle({ style: choice });
        else if (event.target.closest("[data-ls-reset]")) setLineStyle({ ...DEFAULT_LINE_STYLE });
    });
    window.addEventListener("mars-line-style", paint);
    paint();
    return { refresh: paint, style };
}
