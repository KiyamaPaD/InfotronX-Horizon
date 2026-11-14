export function setupAnalyticsNavigation(panel)
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

    const quickbar = document.createElement("div");
    quickbar.className = "analytics-quickbar";

    const label = document.createElement("label");
    label.htmlFor = "analytics-section-select";
    label.textContent = "QUICK ACCESS";

    const select = document.createElement("select");
    select.id = "analytics-section-select";
    select.setAttribute("aria-label", "Jump to a science section");
    select.appendChild(new Option("Choose a section…", ""));

    const toggleAll = document.createElement("button");
    toggleAll.type = "button";
    toggleAll.className = "analytics-toggle-all";
    toggleAll.textContent = "Expand all";

    sections.forEach((section, index) =>
    {
        const heading = section.querySelector(".panel-title-row .section-label");
        const header = section.querySelector(".panel-title-row");

        if (!heading || !header)
        {
            return;
        }

        const name = heading.textContent.trim().replace(/\s+/g, " ");
        const id = "analytics-section-" + index;
        const expanded = name === "MISSION TELEMETRY" || name === "DEM ROUTE LAB";
        section.id = id;
        section.classList.add("analytics-collapsible");
        section.classList.toggle("analytics-collapsed", !expanded);
        select.appendChild(new Option(name.toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()), id));

        const toggle = document.createElement("button");
        toggle.className = "analytics-section-toggle";
        toggle.type = "button";
        toggle.setAttribute("aria-label", "Toggle " + name.toLowerCase());
        toggle.setAttribute("aria-expanded", String(expanded));
        toggle.textContent = expanded ? "−" : "+";
        header.appendChild(toggle);

        toggle.addEventListener("click", () =>
        {
            const nowExpanded = section.classList.toggle("analytics-collapsed") === false;
            toggle.setAttribute("aria-expanded", String(nowExpanded));
            toggle.textContent = nowExpanded ? "−" : "+";
            toggleAll.textContent = sections.some(item => item.classList.contains("analytics-collapsed")) ? "Expand all" : "Collapse extras";

            if (nowExpanded)
            {
                window.dispatchEvent(new Event("resize"));
            }
        });
    });

    select.addEventListener("change", () =>
    {
        const section = document.getElementById(select.value);

        if (!section)
        {
            return;
        }

        section.classList.remove("analytics-collapsed");
        const toggle = section.querySelector(".analytics-section-toggle");

        if (toggle)
        {
            toggle.textContent = "−";
            toggle.setAttribute("aria-expanded", "true");
        }

        requestAnimationFrame(() =>
        {
            section.scrollIntoView({ block: "start", behavior: "smooth" });
            window.dispatchEvent(new Event("resize"));
        });
    });

    toggleAll.addEventListener("click", () =>
    {
        const expand = sections.some(section => section.classList.contains("analytics-collapsed"));

        sections.forEach(section =>
        {
            const name = section.querySelector(".section-label")?.textContent.trim();
            const open = expand || name === "MISSION TELEMETRY" || name === "DEM ROUTE LAB";
            section.classList.toggle("analytics-collapsed", !open);
            const toggle = section.querySelector(".analytics-section-toggle");

            if (toggle)
            {
                toggle.textContent = open ? "−" : "+";
                toggle.setAttribute("aria-expanded", String(open));
            }
        });

        toggleAll.textContent = expand ? "Collapse extras" : "Expand all";
        window.dispatchEvent(new Event("resize"));
    });

    quickbar.append(label, select, toggleAll);
    panel.prepend(quickbar);
}
