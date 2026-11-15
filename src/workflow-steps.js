// Guided Explore → Plan → Analyze workflow. Nothing is removed: each step only decides which existing panels are in view,
// and "All tools" restores the full workspace. Steps advance automatically from what the user actually does.
const STORAGE_KEY = "mars-atlas.workflow-step";
const STEPS = [
    { id: "explore", number: "1", label: "Explore", hint: "Look around Jezero and pick a map layer." },
    { id: "plan", number: "2", label: "Plan", hint: "Click the map to add waypoints." },
    { id: "analyze", number: "3", label: "Analyze", hint: "Distance, slope profile and why this route." }
];

export function nextStepFor(current, waypointCount)
{
    if (current === "all")
    {
        return "all";
    }

    if (current === "explore" && waypointCount >= 1)
    {
        return "plan";
    }

    return current;
}

function readStoredStep()
{
    try
    {
        const value = localStorage.getItem(STORAGE_KEY);
        return ["explore", "plan", "analyze", "all"].includes(value) ? value : null;
    }
    catch
    {
        return null;
    }
}

function storeStep(step)
{
    try
    {
        localStorage.setItem(STORAGE_KEY, step);
    }
    catch
    {
        // Private windows may block storage; the workflow still works for this visit.
    }
}

export function mountWorkflowSteps({ shell, store, setMode, loadTerrain, isTerrainReady })
{
    const host = shell.querySelector(".map-title-copy");

    if (!host || shell.querySelector(".workflow-steps"))
    {
        return null;
    }

    const nav = document.createElement("nav");
    nav.className = "workflow-steps";
    nav.setAttribute("aria-label", "Mission workflow");
    nav.innerHTML = '<button type="button" class="workflow-home" data-action="open-home" title="Back to the start page"><span class="workflow-step-number">0</span><span class="workflow-step-label">Start</span></button><span class="workflow-step-line" aria-hidden="true"></span>' + STEPS.map(step =>
        `<button type="button" class="workflow-step" data-step="${step.id}" aria-pressed="false" title="${step.hint}"><span class="workflow-step-number">${step.number}</span><span class="workflow-step-label">${step.label}</span></button>`
    ).join('<span class="workflow-step-line" aria-hidden="true"></span>') +
        '<button type="button" class="workflow-all" data-step="all" aria-pressed="false" title="Show every panel and tool">All tools</button>';
    host.prepend(nav);
    const hint = document.createElement("p");
    hint.className = "workflow-hint";
    hint.setAttribute("aria-live", "polite");
    nav.after(hint);
    shell.classList.add("workflow-ready");

    let current = null;
    let terrainRequested = false;

    function waypointCount()
    {
        return store.activeRoute?.points?.length || 0;
    }

    function apply(step, { remember = true, quiet = false } = {})
    {
        if (step === current)
        {
            return;
        }

        current = step;
        shell.dataset.step = step;

        for (const button of nav.querySelectorAll("[data-step]"))
        {
            const active = button.dataset.step === step;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        }

        const index = STEPS.findIndex(item => item.id === step);
        nav.querySelectorAll(".workflow-step").forEach((button, position) => button.classList.toggle("done", index >= 0 && position < index));
        hint.textContent = step === "all" ? "Every panel and tool is visible." : STEPS[index].hint;

        if (step === "explore")
        {
            hint.insertAdjacentHTML("beforeend", ' <button type="button" class="workflow-cta" data-step="plan">Start a route →</button>');
        }

        if (remember)
        {
            storeStep(step);
        }

        if (quiet)
        {
            return;
        }

        if (step === "explore")
        {
            setMode("pan");
        }
        else if (step === "plan" && waypointCount() < 2)
        {
            setMode("draw");
        }
        else if (step === "analyze")
        {
            setMode("pan");
            shell.querySelector('.analytics-categories [data-group="terrain"]')?.click();
            requestTerrain();
        }
    }

    // The bundled Jezero elevation model is small; once a route exists it loads by itself so profiles appear without a click.
    function requestTerrain()
    {
        if (terrainRequested || isTerrainReady?.() || waypointCount() < 2)
        {
            return;
        }

        terrainRequested = true;
        loadTerrain?.();
    }

    function onStoreChange()
    {
        const count = waypointCount();
        const next = nextStepFor(current, count);

        if (next !== current)
        {
            apply(next);
        }

        nav.querySelector('[data-step="analyze"]').classList.toggle("ready", count >= 2 && current !== "analyze");

        if (count >= 2)
        {
            requestTerrain();
        }
    }

    const onStepClick = event =>
    {
        const button = event.target.closest("[data-step]");

        if (button)
        {
            apply(button.dataset.step);
        }
    };

    nav.addEventListener("click", onStepClick);
    hint.addEventListener("click", onStepClick);

    apply(readStoredStep() || (waypointCount() >= 1 ? "plan" : "explore"), { remember: false, quiet: true });
    store.subscribe(onStoreChange);
    onStoreChange();

    return { setStep: step => apply(step), get step() { return current; } };
}
