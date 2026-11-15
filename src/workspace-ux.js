export function setupAnalyticsNavigation(panel, options = {})
{
    if (!panel || panel.querySelector(".analytics-quickbar"))
    {
        return;
    }

    const sections = [...panel.children].filter(section => section.classList.contains("panel-section"));

    if (!sections.length)
    {
        return;
    }

    const groupDefinitions = [
        { id: "overview", label: "Overview", items: ["MISSION TELEMETRY", "SEGMENT DISTANCES", "ROUTE CONNECTIVITY GRAPH", "ROUTE INSPECTOR", "WAYPOINT COORDINATES"] },
        { id: "terrain", label: "Terrain", items: ["DEM ROUTE LAB", "3D TERRAIN EXPLORER", "TERRAIN INTELLIGENCE", "ADVANCED MATHEMATICS LAB"] },
        { id: "models", label: "Models", items: ["MARSWALK RESOURCE MODEL", "MISSION STRESS LAB", "ADVANCED ALGORITHMS"] },
        { id: "mission", label: "Mission", items: ["MISSION CHECKPOINTS", "ROUTE INSIGHTS", "DATA SOURCES", "DATA INTEGRITY"] }
    ];

    const groups = new Map();
    const quickbar = document.createElement("div");
    quickbar.className = "analytics-quickbar";

    const categories = document.createElement("div");
    categories.className = "analytics-categories";
    categories.setAttribute("role", "group");
    categories.setAttribute("aria-label", "Science workspace categories");

    const label = document.createElement("label");
    label.htmlFor = "analytics-section-select";
    label.textContent = "GO TO TOOL";

    const select = document.createElement("select");
    select.id = "analytics-section-select";
    select.setAttribute("aria-label", "Jump to a science section");

    const toggleAll = document.createElement("button");
    toggleAll.type = "button";
    toggleAll.className = "analytics-toggle-all";
    toggleAll.textContent = "Expand group";

    let activeGroup = "overview";

    const readiness = document.createElement("section");
    readiness.className = "analytics-readiness";
    readiness.setAttribute("aria-label", "How to activate science tools");
    readiness.innerHTML = `
        <details open>
            <summary>How to unlock the science tools <span aria-hidden="true">▾</span></summary>
            <p>Modules stay available to explore. Some calculations need real user data before they can run.</p>
            <div class="analytics-ready-list">
                <div class="analytics-ready-item" data-ready-item="route"><span class="analytics-ready-mark">1</span>
                    <div><strong>Route geometry</strong><small data-ready-text="route">Draw two waypoints for distance and route models.</small></div>
                    <button type="button" data-ready-action="draw">Draw</button></div>
                <div class="analytics-ready-item" data-ready-item="dem"><span class="analytics-ready-mark">2</span>
                    <div><strong>Numeric elevation data</strong><small data-ready-text="dem">Load Jezero DEM for slope, elevation, contours and A*.</small></div>
                    <button type="button" data-ready-action="dem">Load DEM</button></div>
                <div class="analytics-ready-item" data-ready-item="alternative"><span class="analytics-ready-mark">3</span>
                    <div><strong>Alternative routes</strong><small data-ready-text="alternative">Create a second route for comparisons.</small></div>
                    <button type="button" data-ready-action="alternative">New route</button></div>
            </div>
            <p class="analytics-ready-footnote">No sample waypoint is added automatically. You can enter coordinates manually or explore tools without calculating.</p>
        </details>`;

    function refresh()
    {
        const status = options.getState?.() || {};
        const count = Number(status.waypoints || 0);
        const routes = Number(status.routes || 1);
        const complete = {
            route: count >= 2,
            dem: Boolean(status.demLoaded),
            alternative: routes >= 2
        };
        const labels = {
            route: complete.route ? `${count} waypoints in the selected route — ready` : `${count}/2 waypoints — add ${2 - count} more`,
            dem: complete.dem ? "Numeric DEM loaded — terrain calculations available" : "Load a numeric DEM — pictures alone cannot provide height",
            alternative: complete.alternative ? `${routes} routes — comparisons available after both have points` : "Create a second, manually editable route"
        };

        for (const [key, ready] of Object.entries(complete))
        {
            const item = readiness.querySelector(`[data-ready-item="${key}"]`);
            item.dataset.ready = ready ? "true" : "false";
            item.querySelector(`[data-ready-text="${key}"]`).textContent = labels[key];
            item.querySelector("[data-ready-action]").textContent = ready ? "Ready ✓" :
                key === "route" ? "Draw" : key === "dem" ? "Load DEM" : "New route";
            item.querySelector("[data-ready-action]").disabled = ready;
        }
    }

    readiness.addEventListener("click", event =>
    {
        const key = event.target.closest("[data-ready-action]")?.dataset.readyAction;

        if (key === "draw")
        {
            options.onDraw?.();
        }
        else if (key === "dem")
        {
            showGroup("terrain");
            options.onLoadDem?.();
        }
        else if (key === "alternative")
        {
            options.onAddRoute?.();
        }
    });

    function visibleSections()
    {
        return sections.filter(section => section.dataset.analyticsGroup === activeGroup);
    }

    function updateToggleAll()
    {
        toggleAll.textContent = visibleSections().some(section => section.classList.contains("analytics-collapsed"))
            ? "Expand group" : "Collapse group";
    }

    function setExpanded(section, expanded)
    {
        section.classList.toggle("analytics-collapsed", !expanded);
        const toggle = section.querySelector(".analytics-section-toggle");

        if (toggle)
        {
            toggle.textContent = expanded ? "−" : "+";
            toggle.setAttribute("aria-expanded", String(expanded));
        }
    }

    function showGroup(group)
    {
        activeGroup = group;
        select.replaceChildren();
        select.add(new Option("Choose a tool…", ""));

        for (const section of sections)
        {
            const visible = section.dataset.analyticsGroup === group;
            section.hidden = !visible;

            if (visible)
            {
                select.add(new Option(section.dataset.analyticsTitle, section.id));
            }
        }

        categories.querySelectorAll("button").forEach(button =>
        {
            const selected = button.dataset.group === group;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
        });

        updateToggleAll();
        panel.scrollTop = 0;
        window.dispatchEvent(new Event("resize"));
    }

    for (const definition of groupDefinitions)
    {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.group = definition.id;
        button.textContent = definition.label;
        button.setAttribute("aria-pressed", String(definition.id === activeGroup));
        button.addEventListener("click", () => showGroup(definition.id));
        categories.append(button);
    }

    sections.forEach((section, index) =>
    {
        const heading = section.querySelector(".panel-title-row .section-label");
        const header = section.querySelector(".panel-title-row");

        if (!heading || !header)
        {
            return;
        }

        const title = heading.textContent.trim().replace(/\s+/g, " ");
        const group = groupDefinitions.find(definition => definition.items.includes(title))?.id || "models";
        const expanded = true;
        const id = "analytics-section-" + index;
        section.id = id;
        section.dataset.analyticsGroup = group;
        section.dataset.analyticsTitle = title.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase());
        section.classList.add("analytics-collapsible");
        section.classList.toggle("analytics-collapsed", !expanded);
        groups.set(id, section);

        const toggle = document.createElement("button");
        toggle.className = "analytics-section-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Toggle " + title.toLowerCase());
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.textContent = expanded ? "−" : "+";
        header.append(toggle);

        toggle.addEventListener("click", () =>
        {
            setExpanded(section, section.classList.contains("analytics-collapsed"));
            updateToggleAll();
            window.dispatchEvent(new Event("resize"));
        });
    });

    select.addEventListener("change", () =>
    {
        const section = groups.get(select.value);

        if (!section)
        {
            return;
        }

        setExpanded(section, true);
        updateToggleAll();
        requestAnimationFrame(() =>
        {
            section.scrollIntoView({ block: "start", behavior: "smooth" });
            window.dispatchEvent(new Event("resize"));
        });
    });

    toggleAll.addEventListener("click", () =>
    {
        const expand = visibleSections().some(section => section.classList.contains("analytics-collapsed"));
        visibleSections().forEach(section => setExpanded(section, expand));
        updateToggleAll();
        window.dispatchEvent(new Event("resize"));
    });

    quickbar.append(categories, label, select, toggleAll);
    panel.prepend(quickbar, readiness);
    showGroup(activeGroup);
    refresh();

    return { refresh };
}
