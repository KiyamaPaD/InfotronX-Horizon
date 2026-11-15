import { buildMissionFacts, localMissionExplanation, normalizeCopilotQuestion } from "./mission-copilot.js";

export function mountMissionCopilot({ panel, before, store, getDem, getCloud, notify })
{
    const section = document.createElement("section");
    section.className = "panel-section science-model-section";
    section.innerHTML = `
        <div class="panel-title-row"><h2 class="section-label">MISSION COPILOT</h2><span class="tiny-pill">OPTIONAL · READ-ONLY</span></div>
        <p class="section-help">Inspect the mission using deterministic mathematics, or optionally request a language-model explanation. AI has no ability to edit, delete, publish or approve mission data.</p>
        <button type="button" id="copilot-local" class="btn btn-outline wide">Analyze mission with verified calculations</button>
        <form id="copilot-ai-form" class="copilot-ai-form">
            <label>Question for AI (optional)
                <textarea id="copilot-question" maxlength="240" rows="3" placeholder="Explain the difference between route distance and DEM grid distance."></textarea>
            </label>
            <label class="copilot-consent"><input id="copilot-consent" type="checkbox"/>
                I agree to send aggregate mission statistics, the DEM source label (if loaded), and my question to the AI provider. Mission titles, raw coordinates, notes, chat messages and profile photos are excluded.
            </label>
            <button type="submit" class="btn btn-outline wide" id="copilot-ask">Ask AI (sign-in + server configuration required)</button>
        </form>
        <pre id="copilot-output" class="copilot-output" role="status" aria-live="polite">Choose local analysis to see sourced metrics without AI or a cloud account.</pre>
        <p class="science-footnote">Responses are optional explanations, never NASA-certified scientific measurements. A server-side model key must be configured separately; no API key belongs in frontend code.</p>`;
    panel.insertBefore(section,before);
    const output = section.querySelector("#copilot-output");
    const form = section.querySelector("#copilot-ai-form");
    const question = section.querySelector("#copilot-question");
    const consent = section.querySelector("#copilot-consent");
    const send = section.querySelector("#copilot-ask");

    section.querySelector("#copilot-local").addEventListener("click",() =>
    {
        try
        {
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

        try
        {
            const input = normalizeCopilotQuestion(question.value);
            const facts = buildMissionFacts(store.current,getDem());
            send.disabled = true;
            output.textContent = "Requesting a read-only explanation. No mission data are being changed.";
            const response = await cloud.client.functions.invoke("mars-mission-copilot",{
                body:{ question:input, facts }
            });

            if (response.error)
            {
                throw new Error("AI backend is unavailable or not configured. Local analysis remains available.");
            }

            if (typeof response.data?.answer !== "string" || !response.data.answer.trim())
            {
                throw new Error("No AI explanation was returned. Try local verified analysis.");
            }

            output.textContent = response.data.answer.slice(0,3200) +
                "\n\nAI-generated explanation; verify against the actual route charts and scientific source data.";
        }
        catch(error)
        {
            output.textContent = error.message;
        }
        finally
        {
            send.disabled = false;
        }
    });

    return { section };
}
