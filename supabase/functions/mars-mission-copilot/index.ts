const ALLOWED_ORIGINS = new Set([
    "https://mars-atlas-map.netlify.app",
    "https://mars-atlas-mu.vercel.app"
]);
const USER_LIMIT = 240;
const SOURCES_LIMIT = 160;

function originAllowed(origin: string | null): boolean
{
    return !origin || ALLOWED_ORIGINS.has(origin) || /^http:\/\/localhost:\d+$/.test(origin);
}

function headers(origin: string | null): Headers
{
    const result = new Headers({
        "Content-Type":"application/json",
        "Vary":"Origin",
        "Cache-Control":"no-store",
        "Access-Control-Allow-Headers":"authorization,apikey,x-client-info,content-type",
        "Access-Control-Allow-Methods":"POST,OPTIONS"
    });

    if (origin && originAllowed(origin))
    {
        result.set("Access-Control-Allow-Origin",origin);
    }

    return result;
}

function response(status: number, data: Record<string,unknown>, origin: string | null): Response
{
    return new Response(JSON.stringify(data),{status,headers:headers(origin)});
}

function nonnegative(value: unknown): number | null
{
    return typeof value === "number" && Number.isFinite(value) && value >= 0 && value < 1e9 ? value : null;
}

function verifiedFacts(raw: any): Record<string, unknown> | null
{
    if (!raw || typeof raw !== "object" || Array.isArray(raw))
    {
        return null;
    }

    const routeCount = nonnegative(raw.routeCount);
    const waypointCount = nonnegative(raw.waypointCount);
    const observationCount = nonnegative(raw.observationCount);
    const distance = nonnegative(raw.horizontalDistanceMeters);

    if ([routeCount,waypointCount,observationCount,distance].some(x => x === null) ||
        routeCount! > 15 || waypointCount! > 250 || observationCount! > 200)
    {
        return null;
    }

    return {
        routeCount, waypointCount, observationCount,
        horizontalDistanceMeters:distance,
        hasNumericDem:raw.hasNumericDem === true,
        demSource:typeof raw.demSource === "string" ? raw.demSource.slice(0,SOURCES_LIMIT) : null,
        demCoveredWaypoints:nonnegative(raw.demCoveredWaypoints),
        modeledGridDistanceMeters:nonnegative(raw.modeledGridDistanceMeters),
        modeledMaxGradePercent:nonnegative(raw.modeledMaxGradePercent),
        terrainModelUnverified:true
    };
}

Deno.serve(async (request: Request): Promise<Response> =>
{
    const origin = request.headers.get("origin");

    if (!originAllowed(origin))
    {
        return response(403,{error:"Origin not allowed."},null);
    }

    if (request.method === "OPTIONS")
    {
        return response(200,{ok:true},origin);
    }

    if (request.method !== "POST")
    {
        return response(405,{error:"POST required."},origin);
    }

    const auth = request.headers.get("Authorization") || "";

    if (!/^Bearer eyJ[A-Za-z0-9._-]+$/.test(auth))
    {
        return response(401,{error:"Sign in to use the optional AI assistant."},origin);
    }

    const url = Deno.env.get("SUPABASE_URL");
    const publishable = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY");
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!url || !publishable)
    {
        return response(503,{error:"The AI authentication gateway is not configured."},origin);
    }

    // Defense in depth: verify the actual Supabase user JWT; never trust user_id from input.
    const identity = await fetch(url + "/auth/v1/user",{
        headers:{ apikey:publishable,Authorization:auth }
    }).catch(() => null);

    if (!identity?.ok)
    {
        return response(401,{error:"Your Supabase session is not valid."},origin);
    }

    if (!apiKey)
    {
        return response(503,{error:"AI not configured. Use deterministic local mission analysis."},origin);
    }

    let input: any;

    try
    {
        input = await request.json();
    }
    catch
    {
        return response(400,{error:"Invalid JSON."},origin);
    }

    const question = typeof input?.question === "string" ? input.question.trim() : "";
    const facts = verifiedFacts(input?.facts);

    if (!question || question.length > USER_LIMIT || !facts)
    {
        return response(400,{error:"Supply a short question and valid bounded mission metrics."},origin);
    }

    // Database enforcement is transaction-safe and restricts even concurrent requests.
    const limited = await fetch(url + "/rest/v1/mars_copilot_requests",{
        method:"POST",
        headers:{
            apikey:publishable,Authorization:auth,
            "Content-Type":"application/json",
            Prefer:"return=minimal"
        },
        body:"{}"
    }).catch(() => null);

    if (!limited?.ok)
    {
        return response(429,{error:"Request quota reached or permission denied. Try again later."},origin);
    }

    const system = [
        "You are MARS ATLAS mission explainability Copilot.",
        "The following user metrics were computed by deterministic code, but are not independently certified.",
        "You have no tools, no file access, no route editing permissions and cannot write to Supabase.",
        "Only explain supplied numbers, source uncertainty and scientific limitations.",
        "Never invent terrain data, safety improvements, NASA approvals or missing coordinates.",
        "Do not claim any user-defined hazard is a NASA observation.",
        "Avoid publishing raw mission data. Keep under 300 words.",
        "If the user asks you to change, save or share a route, explain that only the human can do that through the manual editor."
    ].join(" ");

    const payload = {
        model:Deno.env.get("OPENAI_MODEL") || "gpt-4.1-mini",
        store:false,
        max_output_tokens:450,
        instructions:system,
        input:"User question: " + question + "\nComputed mission metrics (no raw waypoints or notes): " +
            JSON.stringify(facts)
    };

    let upstream: Response | null = null;

    try
    {
        upstream = await fetch("https://api.openai.com/v1/responses",{
            method:"POST",
            headers:{Authorization:"Bearer " + apiKey,"Content-Type":"application/json"},
            body:JSON.stringify(payload),
            signal:AbortSignal.timeout(20000)
        });
    }
    catch
    {
        return response(503,{error:"The AI provider did not respond. Use the local analysis."},origin);
    }

    if (!upstream.ok)
    {
        return response(503,{error:"The AI provider is temporarily unavailable. Use local analysis."},origin);
    }

    const result = await upstream.json().catch(() => null);
    const answer = (result?.output || []).flatMap((item: any) => item.content || [])
        .filter((item: any) => item.type === "output_text" && typeof item.text === "string")
        .map((item: any) => item.text).join("\n").slice(0,3000);

    if (!answer)
    {
        return response(503,{error:"No readable explanation was returned."},origin);
    }

    return response(200,{answer,mode:"read-only",source:"OpenAI Responses API; unverified explanatory text"},origin);
});
