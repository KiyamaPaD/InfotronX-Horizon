// Calls the read-only mars-mission-copilot Supabase function. The model key stays on the server; the browser only sends
// bounded route totals and a short question, and only after the user has agreed.
const EXPLANATIONS = {
    SUPABASE_CONFIG_MISSING: "The AI gateway is not configured correctly yet. The local answer still works.",
    AUTH_INVALID: "Your sign-in has expired. Sign in again from Mission Center.",
    AI_NOT_CONFIGURED: "The AI assistant has not been switched on by the project owner. Local answers work without it.",
    AI_RATE_LIMIT: "You have reached the AI limit (five questions every ten minutes). Try again shortly or use a local answer.",
    AI_PROVIDER_REJECTED: "The AI provider refused the request. The project owner needs to check the key, model access and billing.",
    AI_PROVIDER_UNREACHABLE: "The AI provider could not be reached. Use a local answer.",
    AI_EMPTY_RESPONSE: "The AI provider returned no readable answer. Use a local answer."
};

export async function askCopilot(cloud, body)
{
    if (!cloud?.user || !cloud.client)
    {
        const error = new Error("Sign in from Mission Center to use the AI assistant. Local answers do not need an account.");
        error.code = "SIGN_IN_REQUIRED";
        throw error;
    }

    const result = await cloud.client.functions.invoke("mars-mission-copilot", { body });

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
            // Network errors and gateway failures do not always carry JSON.
        }

        const error = new Error(EXPLANATIONS[code] || "The AI service could not answer right now. The local answer still works.");
        error.code = code;
        throw error;
    }

    const answer = typeof result.data?.answer === "string" ? result.data.answer.trim() : "";

    if (!answer)
    {
        throw new Error(EXPLANATIONS.AI_EMPTY_RESPONSE);
    }

    return answer.slice(0, 3200);
}
