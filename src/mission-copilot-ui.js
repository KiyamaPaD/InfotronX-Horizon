import { buildMissionFacts, buildAssistantView } from "./mission-copilot.js";

export function mountMissionCopilot({ panel, before, store, getDem })
{
    const section = document.createElement("section");
    section.className = "panel-section science-model-section copilot-section";
    section.innerHTML = `
        <div class="panel-title-row"><h2 class="section-label">MISSION COPILOT</h2></div>
        <div class="copilot-context"></div>
        <div class="assistant-topics" role="group" aria-label="Route insights">
            <button type="button" data-topic="overview" aria-pressed="true">Route</button>
            <button type="button" data-topic="terrain" aria-pressed="false">Terrain</button>
            <button type="button" data-topic="compare" aria-pressed="false">Compare</button>
            <button type="button" data-topic="resources" aria-pressed="false">Resources</button>
        </div>
        <div id="copilot-output" class="assistant-result" aria-live="polite"></div>
        <button type="button" id="copilot-propose" class="btn btn-outline wide">Explore route options <span aria-hidden="true">→</span></button>`;
    panel.insertBefore(section,before);
    let topic = "overview";

    function render()
    {
        const route = store.activeRoute;
        section.querySelector('.copilot-context').textContent = route.name;
        const output = section.querySelector('#copilot-output');
        output.replaceChildren();
        const view = buildAssistantView(buildMissionFacts(store.current,getDem()),topic);
        const grid = document.createElement('div');
        grid.className = 'assistant-metrics';
        for (const metric of view.metrics)
        {
            const card = document.createElement('div');
            const value = document.createElement('strong');
            const label = document.createElement('span');
            value.textContent = metric.value;
            label.textContent = metric.label;
            card.append(value,label);
            grid.append(card);
        }
        output.append(grid);
        for (const item of view.routes || [])
        {
            const row = document.createElement('div');
            row.className = 'assistant-route-row';
            const name = document.createElement('span');
            name.textContent = store.current.routes[item.index - 1].name;
            const value = document.createElement('strong');
            value.textContent = item.value;
            row.append(name,value);
            output.append(row);
        }
        if (view.source)
        {
            const source = document.createElement('small');
            source.className = 'assistant-source';
            source.textContent = view.source;
            output.append(source);
        }
        const note = document.createElement('p');
        note.className = 'assistant-note';
        note.textContent = view.note;
        output.append(note);
        if (route.points.length < 2)
        {
            const add = document.createElement('button');
            add.type = 'button';
            add.className = 'btn btn-outline wide';
            add.dataset.action = 'add-coordinates';
            add.textContent = 'Add a waypoint';
            output.append(add);
        }
        for (const button of section.querySelectorAll('[data-topic]'))
        {
            button.setAttribute('aria-pressed', String(button.dataset.topic === topic));
        }
    }

    section.querySelectorAll('[data-topic]').forEach(button =>
    {
        button.addEventListener('click', () => { topic = button.dataset.topic; render(); });
    });
    section.querySelector('#copilot-propose').addEventListener('click', () =>
    {
        panel.querySelector('[data-group="terrain"]')?.click();
        const compare = panel.querySelector('#terrain-compare');
        const lab = compare?.closest('.analytics-collapsible');
        const toggle = lab?.querySelector('.analytics-section-toggle');
        if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
        if (getDem() && store.activeRoute.points.length >= 2) compare?.click();
        lab?.scrollIntoView({ block:'start', behavior:'smooth' });
    });
    store.subscribe(render);
    render();
    return { section, refresh:render };
}
