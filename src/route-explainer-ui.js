// The visual explanation is derived from deterministic numeric model results.
function html(value)
{
    return String(value ?? "").replace(/[&<>"']/g, character =>
        ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function measure(value, digits = 1)
{
    return Number(value).toLocaleString("en-US", { maximumFractionDigits: digits });
}

function meters(value)
{
    return measure(value, 1) + " m";
}

export function renderRouteDecision(target, decision, context = {})
{
    if (!decision.alternatives.length)
    {
        target.innerHTML = '<p class="why-empty">No valid modeled alternatives. No optimum can be claimed. ' +
            html(decision.explanation) + '</p>' + decision.rejected.map(item =>
            '<p class="why-rejected"><strong>' + html(item.label) + ':</strong> ' +
            html(item.reason) + '</p>').join("");
        return;
    }

    const alternatives = decision.alternatives;
    const maximum = Math.max(1, ...alternatives.map(item => item.costMeters));
    const winners = new Set(decision.winners);
    const selected = alternatives.find(item => winners.has(item.id));
    const winnerLabel = decision.equivalent ? 'EQUIVALENT RESULTS' :
        winners.size > 1 ? 'TIED BEST COST' : 'MINIMUM MODELED COST';
    const formula = '<p class="why-equation"><strong>C = D + λ × (A + H)</strong>' +
        '<span>D = grid distance; A = total ascent; H = total descent; λ = selected slope penalty.</span></p>';
    const explanation = '<p class="why-explanation">' + html(decision.explanation) + '</p>';
    const source = '<p class="why-provenance"><strong>Input:</strong> ' +
        html(context.source || 'Unspecified numeric DEM') +
        ' · maximum allowed adjacent-grid grade ' + html(context.maxSlopePercent ?? 'unknown') +
        '% · ' + html(context.exclusionCount || 0) + ' hypothetical exclusion zones. ' +
        'All rows use identical DEM, waypoint anchors and constraints.</p>';
    const warning = '<p class="why-warning">' + html(decision.warning) +
        ' The human-drawn route is not evaluated under the same cell-by-cell slope rules; ' +
        'its straight-line distance is shown separately and must not be used as a safety ranking.</p>';
    const verdict = '<div class="why-verdict"><span>' + winnerLabel + '</span><strong>' +
        html(selected.label) + '</strong><small>' + meters(selected.costMeters) +
        ' modeled cost · ' + meters(selected.distanceMeters) + ' grid distance + ' +
        meters(selected.penaltyMeters) + ' elevation penalty (λ = ' +
        html(decision.slopePenalty) + ')</small></div>';
    const bars = alternatives.map(item =>
    {
        const dist = Math.max(0, item.distanceMeters / maximum * 100);
        const grade = Math.max(0, item.penaltyMeters / maximum * 100);
        const win = winners.has(item.id);
        return '<div class="why-bar-row' + (win ? ' why-winner' : '') + '">' +
            '<div class="why-bar-label"><strong>' + html(item.label) + '</strong><span>' +
            meters(item.costMeters) + '</span></div>' +
            '<div class="why-bar-track" role="img" aria-label="' + html(item.label) +
            ': ' + meters(item.distanceMeters) + ' distance plus ' + meters(item.penaltyMeters) +
            ' elevation penalty">' +
            '<span class="why-bar-distance" style="width:' + dist.toFixed(3) + '%"></span>' +
            '<span class="why-bar-height" style="width:' + grade.toFixed(3) + '%"></span>' +
            '</div></div>';
    }).join("");
    const table = '<div class="why-table-scroll"><table class="why-data-table"><thead><tr>' +
        '<th>Candidate</th><th>Grid D</th><th>Ascent</th><th>Descent</th>' +
        '<th>Max adjacent grade</th><th>Cost at λ = ' + decision.slopePenalty + '</th><th>Pareto D / |Δh|</th></tr></thead>' +
        '<tbody>' + alternatives.map(item =>
            '<tr' + (winners.has(item.id) ? ' class="why-selected"' : '') + '><th scope="row">' +
            html(item.label) + '</th><td>' + meters(item.distanceMeters) + '</td><td>' +
            meters(item.ascentMeters) + '</td><td>' + meters(item.descentMeters) +
            '</td><td>' + (item.maxGradePercent === null ? 'Unknown' :
            measure(item.maxGradePercent, 2) + '%') + '</td><td>' +
            meters(item.costMeters) + '</td><td>' + (item.onFrontier ? 'Non-dominated' : 'Dominated') +
            '</td></tr>').join("") + '</tbody></table></div>';
    const xMin = Math.min(...alternatives.map(item => item.distanceMeters));
    const xMax = Math.max(...alternatives.map(item => item.distanceMeters));
    const yMin = Math.min(...alternatives.map(item => item.verticalMeters));
    const yMax = Math.max(...alternatives.map(item => item.verticalMeters));
    const plotX = item => 42 + (item.distanceMeters - xMin) / Math.max(1e-6, xMax - xMin) * 276;
    const plotY = item => 155 - (item.verticalMeters - yMin) / Math.max(1e-6, yMax - yMin) * 118;
    const plotPoints = alternatives.map((item, index) =>
    {
        const label = html(item.label) + ' · D ' + meters(item.distanceMeters) +
            ', absolute climb/descent ' + meters(item.verticalMeters);
        const color = item.onFrontier ? '#87dfc7' : '#aab6c0';

        return '<circle cx="' + plotX(item).toFixed(2) + '" cy="' + plotY(item).toFixed(2) +
            '" r="' + (winners.has(item.id) ? 7 : 5) + '" fill="' + color +
            '" stroke="#0b1b26" stroke-width="2"><title>' + label + '</title></circle>';
    }).join("");
    const scatter = '<div class="why-scatter"><h4>Route trade-off · sampled candidates</h4>' +
        '<svg viewBox="0 0 340 186" role="img" aria-label="Scatter plot of grid path distance versus cumulative absolute elevation change">' +
        '<path d="M42 18 V155 H318" stroke="#708b9a" stroke-width="1.5" fill="none"/>' + plotPoints +
        '<text x="180" y="180" text-anchor="middle">Grid distance (m) →</text>' +
        '<text x="12" y="90" text-anchor="middle" transform="rotate(-90 12 90)">|Δh| (m) →</text>' +
        '</svg><p class="why-scatter-note">Each dot is a model candidate, not a measured rover track. ' +
        'A non-dominated point improves neither axis without worsening the other. ' +
        'Overlapping points may represent identical results.</p></div>';
    const inconsistent = alternatives.filter(item => item.costConsistent === false);

    target.innerHTML = verdict + formula + explanation + '<div class="why-legend">' +
        '<span><i class="why-legend-distance"></i>Grid distance</span>' +
        '<span><i class="why-legend-height"></i>λ × absolute height change</span></div>' +
        '<div class="why-bars">' + bars + '</div>' + table + scatter + source + warning +
        (inconsistent.length ? '<p class="why-warning">Internal cost validation failed for: ' +
            inconsistent.map(item => html(item.label)).join(', ') +
            '. Do not use these candidates for a scientific claim.</p>' : '');
}
