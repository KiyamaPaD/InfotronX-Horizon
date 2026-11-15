// Builds legal.html from the Markdown legal pages, so the site and the repository share one text.
// Run: node scripts/build-legal.mjs
import { readFileSync, writeFileSync } from "node:fs";

const PAGES = [
    ["terms", "Terms of Use", "TERMS.md"],
    ["privacy", "Privacy Policy", "PRIVACY.md"],
    ["cookies", "Cookies and local storage", "COOKIES.md"],
    ["credits", "Credits", "CREDITS.md"]
];

const escapeHtml = text => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inline(text)
{
    return escapeHtml(text)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/\*([^*]+)\*/g, "<em>$1</em>")
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => `<a href="${url.replace(/^(\w+)\.md$/, (__, name) => "#" + name.toLowerCase())}"${url.startsWith("http") ? ' rel="noopener"' : ""}>${label}</a>`);
}

function convert(markdown, idPrefix)
{
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const out = [];
    let list = false, table = false, paragraph = [];
    const flush = () => { if (paragraph.length) { out.push("<p>" + inline(paragraph.join(" ")) + "</p>"); paragraph = []; } };
    const closeList = () => { if (list) { out.push("</ul>"); list = false; } };
    const closeTable = () => { if (table) { out.push("</tbody></table>"); table = false; } };

    for (const line of lines)
    {
        if (line.startsWith("# ")) { flush(); closeList(); closeTable(); continue; }

        if (line.startsWith("## ")) { flush(); closeList(); closeTable(); out.push(`<h3>${inline(line.slice(3))}</h3>`); continue; }

        if (line.startsWith("|"))
        {
            flush(); closeList();
            const cells = line.split("|").slice(1, -1).map(cell => cell.trim());

            if (cells.every(cell => /^-+$/.test(cell))) continue;

            if (!table) { out.push("<table><thead><tr>" + cells.map(cell => `<th>${inline(cell)}</th>`).join("") + "</tr></thead><tbody>"); table = true; }
            else out.push("<tr>" + cells.map(cell => `<td>${inline(cell)}</td>`).join("") + "</tr>");

            continue;
        }

        closeTable();

        if (/^[-*] /.test(line)) { flush(); if (!list) { out.push("<ul>"); list = true; } out.push(`<li>${inline(line.slice(2))}</li>`); continue; }

        if (!line.trim()) { flush(); closeList(); continue; }

        paragraph.push(line.trim());
    }

    flush(); closeList(); closeTable();
    return out.join("\n");
}

const sections = PAGES.map(([id, title, file]) => `<section id="${id}"><h2>${title}</h2>\n${convert(readFileSync(new URL("../" + file, import.meta.url), "utf8"), id)}</section>`).join("\n");
const nav = PAGES.map(([id, title]) => `<a href="#${id}">${title}</a>`).join("");

const html = `<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="theme-color" content="#080d15" />
    <title>Legal | Mars Atlas</title>
    <link rel="icon" href="./assets/favicon.svg" type="image/svg+xml" />
    <style>
        :root { --bg: #080d15; --panel: #101a24; --line: #2c3b49; --text: #e7eef4; --muted: #a9b8c5; --accent: #f3a480; }
        @media (prefers-color-scheme: light) { :root { --bg: #f6f3ef; --panel: #ffffff; --line: #ddd5cc; --text: #1d2630; --muted: #55616d; --accent: #b4552e; } }
        * { box-sizing: border-box; }
        body { margin: 0; background: var(--bg); color: var(--text); font: 16px/1.65 system-ui, "Segoe UI", sans-serif; }
        header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: 8px 20px; padding: 14px 20px; background: var(--bg); border-bottom: 1px solid var(--line); }
        header strong { letter-spacing: 2px; }
        nav { display: flex; flex-wrap: wrap; gap: 6px; }
        nav a { padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; color: var(--text); text-decoration: none; font-size: 14px; }
        nav a:hover { border-color: var(--accent); }
        main { max-width: 820px; margin: 0 auto; padding: 24px 20px 80px; }
        section { margin: 0 0 32px; padding: 24px 26px; background: var(--panel); border: 1px solid var(--line); border-radius: 16px; scroll-margin-top: 80px; }
        h2 { margin: 0 0 8px; font-size: 28px; }
        h3 { margin: 22px 0 6px; font-size: 18px; color: var(--accent); }
        p, li { color: var(--muted); }
        li { margin: 4px 0; }
        a { color: var(--accent); }
        code { padding: 1px 6px; border-radius: 6px; background: #ffffff14; font-size: 14px; }
        table { width: 100%; border-collapse: collapse; font-size: 14px; }
        th, td { padding: 8px; text-align: left; vertical-align: top; border-bottom: 1px solid var(--line); }
        th { color: var(--text); }
        a:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }
    </style>
</head>
<body>
    <header><strong>MARS ATLAS</strong><nav aria-label="Legal pages">${nav}<a href="./">← Back to the app</a></nav></header>
    <main>
${sections}
    </main>
</body>
</html>
`;

writeFileSync(new URL("../legal.html", import.meta.url), html);
console.log("legal.html written");
