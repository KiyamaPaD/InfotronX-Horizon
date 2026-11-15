import { buildMissionFacts, localMissionExplanation, normalizeCopilotQuestion } from "./mission-copilot.js";

export function mountMissionCopilot({ panel, before, store, getDem, getCloud, notify })
{
    const section = document.createElement("section");
    section.className = "panel-section science-model-section copilot-section";
    section.innerHTML = `
        <div class="panel-title-row"><h2 class="section-label">MISSION COPILOT</h2><span class="tiny-pill">OPTIONAL · READ-ONLY</span></div>
        <p class="copilot-kicker">YOUR MISSION, EXPLAINED</p><h3 class="copilot-title">From terrain<br>to understanding.</h3><p class="section-help">Ask about your plan. Explore the evidence. Keep every decision yours.</p><div class="copilot-prompts"><button type="button" data-copilot-prompt="Explain this route and its limitations.">Explain route ↗</button><button type="button" data-copilot-prompt="What can the loaded DEM tell us, and what data are missing?">Read terrain ↗</button><button type="button" data-copilot-prompt="How should I compare alternative routes without assuming the shortest is safest?">Compare routes ↗</button></div><button type="button" id="copilot-propose" class="btn btn-outline wide">Preview terrain route strategies</button>
        <button type="button" id="copilot-local" class="btn btn-outline wide">Analyze mission with verified calculations</button>
        <button type="button" id="copilot-health" class="btn btn-outline wide">Check AI service status</button>
        <form id="copilot-ai-form" class="copilot-ai-form">
            <label>Question for AI (optional)
                <textarea id="copilot-question" maxlength="240" rows="3" placeholder="Explain the difference between route distance and DEM grid distance."></textarea>
            </label>
            <label class="copilot-consent"><input id="copilot-consent" type="checkbox"/>
                I agree to send aggregate route comparisons, illustrative resource estimates, the DEM source label (if loaded), and my question to the AI provider. Mission titles, raw coordinates, notes, chat messages and profile photos are excluded.
            </label>
            <button type="submit" class="btn btn-outline wide" id="copilot-ask">Ask Copilot ↗</button>
        </form>
        <pre id="copilot-output" class="copilot-output" role="status" aria-live="polite">Start with a prompt, or calculate a local mission summary. AI explanations require sign-in and an enabled backend.</pre>
        <p class="science-footnote">Responses are optional explanations, never NASA-certified scientific measurements. A server-side model key must be configured separately; no API key belongs in frontend code.</p>`;
    panel.insertBefore(section,before);
    const output = section.querySelector("#copilot-output");
    const form = section.querySelector("#copilot-ai-form");
    const question = section.querySelector("#copilot-question");
    const consent = section.querySelector("#copilot-consent");
    const send = section.querySelector("#copilot-ask");
    const status = section.querySelector("#copilot-health");

    let requestVersion = 0;
    const missionSignature = () => JSON.stringify(store.current);
    store.subscribe(() =>
    {
        requestVersion++;
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

            throw new Error(explanations[code] ||
                "The external AI service could not complete your request. The offline analysis remains available.");
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

        requestVersion++;
        status.disabled = true;

        try
        {
            const result = await invokeCopilot(cloud,{action:"status"});
            output.textContent = result?.ready
                ? "The AI backend is configured and reachable. A real model response has not yet been verified by this status check."
                : "The AI backend is reachable, but generative explanations have not been enabled. Verified local analysis works now.";
        }
        catch(error)
        {
            output.textContent = error.message;
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
            let fallback = "";

            try
            {
                fallback = "\n\n" + localMissionExplanation(buildMissionFacts(store.current,getDem()));
            }
            catch
            {
                // The failure reason remains visible even if local geometry is invalid.
            }

            output.textContent = error.message + fallback;
        }
        finally
        {
            send.disabled = false;
        }
    });

    return { section };
}
