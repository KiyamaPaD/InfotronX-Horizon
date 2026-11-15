import { buildMissionFacts, localMissionExplanation, normalizeCopilotQuestion } from "./mission-copilot.js";

export function mountMissionCopilot({ panel, before, store, getDem, getCloud, notify })
{
    const section = document.createElement("section");
    section.className = "panel-section science-model-section copilot-section";
    section.innerHTML = `
        <div class="panel-title-row"><h2 class="section-label">MISSION COPILOT</h2><span class="tiny-pill">ASSISTANT</span></div>
        <p class="section-help copilot-intro">Understand your route, compare alternatives and explore terrain evidence.</p>
        <div class="copilot-context" aria-live="polite"></div>
        <div class="copilot-prompts" aria-label="Suggested questions">
            <button type="button" data-copilot-prompt="Explain this route and its limitations.">Explain route</button>
            <button type="button" data-copilot-prompt="What can the loaded DEM tell us, and what data are missing?">Read terrain</button>
            <button type="button" data-copilot-prompt="How should I compare alternative routes without assuming the shortest is safest?">Compare</button>
        </div>
        <form id="copilot-ai-form" class="copilot-ai-form">
            <label for="copilot-question">Your question</label>
            <textarea id="copilot-question" maxlength="240" rows="3" placeholder="What should I look at in this mission?"></textarea>
            <label class="copilot-consent"><input id="copilot-consent" type="checkbox"/> Allow this question and aggregate mission metrics to be sent to the AI provider.</label>
            <button type="submit" class="btn btn-accent wide" id="copilot-ask">Ask Copilot <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 12 12 4M4 4h8v8" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        </form>
        <div id="copilot-notice" class="copilot-notice" role="status" hidden></div>
        <div id="copilot-output" class="copilot-output" role="status" aria-live="polite">Choose a question to start. Local calculations are available without an AI account.</div>
        <div class="copilot-local-actions">
            <button type="button" id="copilot-local" class="btn btn-outline wide">Calculate local summary</button>
            <button type="button" id="copilot-propose" class="btn btn-outline wide">Preview DEM route options</button>
        </div>
        <details class="copilot-settings"><summary>Service & privacy</summary>
            <p>AI explanations require sign-in and a configured backend. Mission titles, raw coordinates, notes, chat messages and photos are excluded from the automatic context. Your question and the DEM source label are sent as written.</p>
            <button type="button" id="copilot-health" class="btn btn-outline wide">Check AI service status</button>
            <div id="copilot-owner-help" hidden><p>The backend reports a missing provider key. Project owners can set <code>OPENAI_API_KEY</code> in Supabase Edge Function Secrets, then check the service again.</p><a href="https://supabase.com/dashboard/project/yuvdrjptwumbfzjsimoe/functions/secrets" target="_blank" rel="noopener noreferrer">Open server settings ↗</a></div>
        </details>
        <p class="science-footnote">AI explains the supplied evidence. DEM proposals are computed locally and added only when you choose them.</p>`;
    panel.insertBefore(section,before);
    const output = section.querySelector("#copilot-output");
    const form = section.querySelector("#copilot-ai-form");
    const question = section.querySelector("#copilot-question");
    const consent = section.querySelector("#copilot-consent");
    const send = section.querySelector("#copilot-ask");
    const status = section.querySelector("#copilot-health");
    const notice = section.querySelector("#copilot-notice");
    const ownerHelp = section.querySelector("#copilot-owner-help");
    function updateContext()
    {
        const route = store.activeRoute;
        const populated = store.current.routes.filter(item => item.points.length >= 2).length;
        section.querySelector('.copilot-context').textContent = route.name + ' · ' + route.points.length + ' waypoints' +
            (route.points.length < 2 && populated ? ' · Select a populated route for analysis' : '') +
            (getDem() ? ' · DEM loaded' : ' · No DEM');
    }
    function clearNotice()
    {
        notice.hidden = true;
        notice.textContent = '';
    }
    function showFailure(error)
    {
        const missing = error.code === 'AI_NOT_CONFIGURED';
        notice.textContent = missing
            ? 'AI unavailable — the server has no provider key configured. Your question has been kept. You can use the local summary below.'
            : error.message;
        notice.hidden = false;
        ownerHelp.hidden = !missing;
        if (missing) section.querySelector(".copilot-settings").open = true;
        output.textContent = missing
            ? 'No AI answer was generated. Local analysis runs only when you choose Calculate local summary.'
            : 'No AI answer was generated. Retry, or choose the local summary.';
    }
    updateContext();

    let requestVersion = 0;
    const missionSignature = () => JSON.stringify(store.current);
    store.subscribe(() =>
    {
        requestVersion++;
        updateContext();
        clearNotice();
        output.textContent = "Mission updated. Run analysis again to use the current route and assumptions.";
    });
    section.querySelectorAll("[data-copilot-prompt]").forEach(button =>
    {
        button.addEventListener("click", () =>
        {
            question.value = button.dataset.copilotPrompt;
            question.focus();
        });
    });
    section.querySelector("#copilot-propose").addEventListener("click", () =>
    {
        if (!getDem() || store.activeRoute.points.length < 2)
        {
            output.textContent = "Load numeric Jezero terrain data and add two waypoints inside its coverage first. Route proposals use the DEM solver; no coordinates are invented by AI.";
            return;
        }
        panel.querySelector('[data-group="terrain"]')?.click();
        requestVersion++;
        const compare = panel.querySelector("#terrain-compare");
        const lab = compare?.closest('.analytics-collapsible');
        const toggle = lab?.querySelector('.analytics-section-toggle');
        if (toggle?.getAttribute('aria-expanded') === 'false') toggle.click();
        compare?.click();
        panel.querySelector("#terrain-strategies")?.scrollIntoView({ block:"nearest", behavior:"smooth" });
        output.textContent = "Terrain strategies requested using your current anchors, grade limit and exclusions. Review the candidates in Terrain, then choose Add editable candidate yourself. No route was added automatically.";
    });

    async function invokeCopilot(cloud, body)
    {
        const result = await cloud.client.functions.invoke("mars-mission-copilot",{ body });

        if (result.error)
        {
            let code = "";

            try
            {
                const payload = await result.error.context?.clone?.().json?.();
                code = typeof payload?.code === "string" ? payload.code : "";
            }
            catch
            {
                // Network errors and gateway failures do not always include a JSON response.
            }

            const explanations = {
                SUPABASE_CONFIG_MISSING:"The Supabase gateway configuration is incomplete. Project setup needs review.",
                AUTH_INVALID:"The login session has expired. Sign out and sign in again.",
                AI_NOT_CONFIGURED:"Generative AI has not been activated by the project owner. The local scientific analysis works without it.",
                AI_RATE_LIMIT:"AI requests are temporarily rate-limited. The local scientific analysis remains available.",
                AI_PROVIDER_REJECTED:"The AI provider rejected this request. The project owner must verify API key, model access and billing.",
                AI_PROVIDER_UNREACHABLE:"The AI provider is unreachable. Use local scientific analysis.",
                AI_EMPTY_RESPONSE:"The AI provider returned no readable answer. Use local analysis."
            };

            const error = new Error(explanations[code] ||
                "The external AI service could not complete your request. The offline analysis remains available.");
            error.code = code;
            throw error;
        }

        return result.data;
    }

    status.addEventListener("click",async () =>
    {
        const cloud = getCloud();

        if (!cloud?.user || !cloud.client)
        {
            output.textContent = "Sign in through Mission Center → Cloud library to check AI service availability. Local analysis does not require a login.";
            return;
        }

        const version = ++requestVersion;
        const userId = cloud.user.id;
        clearNotice();
        status.disabled = true;

        try
        {
            const result = await invokeCopilot(cloud,{action:"status"});
            if (version !== requestVersion || cloud.user?.id !== userId) return;
            if (typeof result?.ready !== 'boolean')
            {
                throw new Error('The backend returned no valid service status. Please retry.');
            }
            ownerHelp.hidden = result.ready;
            if (result.ready)
            {
                output.textContent = 'AI service configured. Ask a question to verify a real model response.';
            }
            else
            {
                const error = new Error('AI provider key missing.');
                error.code = 'AI_NOT_CONFIGURED';
                showFailure(error);
            }
        }
        catch(error)
        {
            if (version !== requestVersion || cloud.user?.id !== userId) return;
            showFailure(error);
        }
        finally
        {
            status.disabled = false;
        }
    });

    section.querySelector("#copilot-local").addEventListener("click",() =>
    {
        try
        {
            requestVersion++;
            clearNotice();
            updateContext();
            output.textContent = localMissionExplanation(buildMissionFacts(store.current,getDem()));
        }
        catch(error)
        {
            output.textContent = error.message;
        }
    });

    form.addEventListener("submit",async event =>
    {
        event.preventDefault();

        if (!consent.checked)
        {
            output.textContent = "Consent is required before any mission facts are sent to an external AI.";
            return;
        }

        const cloud = getCloud();

        if (!cloud?.user || !cloud.client)
        {
            output.textContent = "Sign in through Mission Center → Cloud library, or use local verified analysis without AI.";
            return;
        }

        clearNotice();
        const version = ++requestVersion;
        const signature = missionSignature();
        const userId = cloud.user.id;

        try
        {
            const input = normalizeCopilotQuestion(question.value);
            const facts = buildMissionFacts(store.current,getDem());
            send.disabled = true;
            output.textContent = "Requesting a read-only explanation. No mission data are being changed.";
            const response = await invokeCopilot(cloud,{ question:input, facts });

            if (version !== requestVersion)
            {
                return;
            }

            if (signature !== missionSignature() || cloud.user?.id !== userId)
            {
                output.textContent = "Mission or account changed during the request. Ask again for the current context.";
                return;
            }

            if (typeof response?.answer !== "string" || !response.answer.trim())
            {
                throw new Error("No AI explanation was returned. Try local verified analysis.");
            }

            output.textContent = response.answer.slice(0,3200) +
                "\n\nAI-generated explanation; verify against the actual route charts and scientific source data.";
        }
        catch(error)
        {
            if (version !== requestVersion || signature !== missionSignature() || cloud.user?.id !== userId)
            {
                return;
            }
            showFailure(error);
        }
        finally
        {
            send.disabled = false;
        }
    });

    return { section, refresh:updateContext };
}
