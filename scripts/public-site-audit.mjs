import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const ROOT = process.env.MARS_PUBLIC_URL || "https://mars-atlas-map.netlify.app/";
const paths = [
    "index.html",
    "src/main.js",
    "src/cloud-ui.js",
    "src/cloud-sync.js",
    "src/mission-chat.js",
    "src/mission-chat-ui.js",
    "src/mission-copilot.js",
    "src/mission-copilot-ui.js",
    "src/terrain-3d.js",
    "src/terrain-3d-ui.js",
    "src/science-workbench.js",
    "src/workspace-ux.js",
    "src/science.css",
    "assets/jezero_ctx_trn_dem_20m_clip.json"
];
const hash = input => createHash("sha256").update(input).digest("hex");
const report = {
    auditedUrl:ROOT,
    generatedAt:new Date().toISOString(),
    commit:process.env.GITHUB_SHA || "unknown",
    assetChecks:[]
};

async function inspect(path)
{
    const expected = await readFile(new URL("../" + path, import.meta.url));
    const url = new URL(path,ROOT);
    let status = 0;
    let contentType = "";
    let actual = null;
    let failure = null;

    try
    {
        const response = await fetch(url, {
            redirect:"follow",
            headers:{"User-Agent":"MarsAtlasPublicDeploymentAudit/1.0"},
            signal:AbortSignal.timeout(12000)
        });
        status = response.status;
        contentType = response.headers.get("content-type") || "";

        if (response.ok)
        {
            actual = Buffer.from(await response.arrayBuffer());
        }
        else
        {
            failure = "HTTP " + response.status;
        }
    }
    catch(error)
    {
        failure = error.message;
    }

    const equal = actual !== null && hash(actual) === hash(expected);
    const detail = {
        path,
        status,
        outcome:equal ? "MATCH" : actual ? "OUTDATED_OR_MODIFIED" : "UNAVAILABLE",
        size:actual?.length ?? null,
        expectedBytes:expected.length,
        contentType,
        failure
    };
    report.assetChecks.push(detail);
    console.log(detail.outcome.padEnd(22) + path.padEnd(43) + (failure || "HTTP " + status));
}

const parsed = new URL(ROOT);

if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".netlify.app"))
{
    throw new Error("Public audit only permits the configured HTTPS Netlify website.");
}

for (const path of paths)
{
    await inspect(path);
}

report.matches = report.assetChecks.filter(item => item.outcome === "MATCH").length;
report.outdated = report.assetChecks.filter(item => item.outcome === "OUTDATED_OR_MODIFIED").length;
report.unavailable = report.assetChecks.filter(item => item.outcome === "UNAVAILABLE").length;
report.total = report.assetChecks.length;

await writeFile("public-site-audit.json", JSON.stringify(report,null,2) + "\n");

if (report.matches !== report.total)
{
    console.log("::warning title=Netlify release mismatch::The live Netlify domain is not the same as this tested GitHub source. Inspect public-site-audit.json and redeploy the exact commit.");
}

console.log(JSON.stringify({
    publicUrl:ROOT,
    commit:report.commit,
    matching:report.matches,
    outdated:report.outdated,
    unavailable:report.unavailable,
    total:report.total
}));
