// The test checklist page: every item can be ticked, ticks are kept in this browser.
import { PHASES } from "./qa-checklist-data.js";

const KEY = "mars-qa-checklist";
const LABEL = { yes: "Built", partly: "Partly built", no: "To do" };
let ticks = {};

try { ticks = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch { ticks = {}; }

const save = () => { try { localStorage.setItem(KEY, JSON.stringify(ticks)); } catch { /* storage blocked: ticks last until the page closes */ } };
const all = () => PHASES.flatMap(phase => phase.items);

function render()
{
    const host = document.getElementById("phases");
    host.replaceChildren();

    for (const phase of PHASES)
    {
        const details = document.createElement("details");
        details.open = true;
        const done = phase.items.filter(item => ticks[item.id]).length;
        details.innerHTML = `<summary><span>${phase.title}</span><small data-phase-count="${phase.id}">${done} / ${phase.items.length} ticked</small></summary>`;
        const list = document.createElement("ul");

        for (const item of phase.items)
        {
            const row = document.createElement("li");
            row.dataset.id = item.id;
            row.dataset.built = item.built;
            const label = document.createElement("label");
            const box = document.createElement("input");
            box.type = "checkbox";
            box.checked = Boolean(ticks[item.id]);
            box.addEventListener("change", () => { ticks[item.id] = box.checked; save(); row.classList.toggle("done", box.checked); update(); });
            const body = document.createElement("span");
            body.innerHTML = `<span class="id">${item.id}</span> <span class="text"></span><span class="badge ${item.built}">${LABEL[item.built]}</span>${item.test ? `<span class="how"></span>` : ""}`;
            body.querySelector(".text").textContent = item.text;
            if (item.test) body.querySelector(".how").textContent = "How to test: " + item.test;
            label.append(box, body);
            row.append(label);
            row.classList.toggle("done", box.checked);
            list.append(row);
        }

        details.append(list);
        host.append(details);
    }

    update();
}

function update()
{
    const items = all();
    const done = items.filter(item => ticks[item.id]).length;
    document.getElementById("bar").style.width = (done / items.length * 100) + "%";
    document.getElementById("count").textContent = `${done} of ${items.length} ticked · ${items.filter(item => item.built === "yes").length} built`;

    for (const phase of PHASES)
    {
        document.querySelector(`[data-phase-count="${phase.id}"]`).textContent = `${phase.items.filter(item => ticks[item.id]).length} / ${phase.items.length} ticked`;
    }

    const filter = document.getElementById("filter").value;

    document.querySelectorAll("li[data-id]").forEach(row =>
    {
        const ticked = Boolean(ticks[row.dataset.id]);
        const built = row.dataset.built;
        row.hidden = filter === "open" ? ticked : filter === "done" ? !ticked : filter === "built" ? built === "no" : filter === "todo" ? built !== "no" : false;
    });
}

document.getElementById("filter").addEventListener("change", update);
document.getElementById("reset").addEventListener("click", () => { if (confirm("Clear every tick?")) { ticks = {}; save(); render(); } });
document.getElementById("copy").addEventListener("click", async () =>
{
    const lines = PHASES.flatMap(phase => [`## ${phase.title}`, ...phase.items.map(item => `- [${ticks[item.id] ? "x" : " "}] ${item.id} ${item.text} (${LABEL[item.built]})`), ""]);

    try
    {
        await navigator.clipboard.writeText(lines.join("\n"));
        document.getElementById("copy").textContent = "Copied";
        setTimeout(() => { document.getElementById("copy").textContent = "Copy the report"; }, 1500);
    }
    catch
    {
        prompt("Copy this report:", lines.join("\n"));
    }
});

render();
