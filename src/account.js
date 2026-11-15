// One simple account flow. Guests can use everything but nothing they draw is saved. Signing in saves it automatically.
//  - a sign-in / create-account window at the start (guest is one click away)
//  - a slim reminder bar for guests, and a warning before closing the tab with unsaved work
//  - automatic cloud saving for signed-in users, with a clear status in the side panel
const GUEST_KEY = "mars-guest-session";
const SAVE_DELAY_MS = 2500;

const MESSAGES = [
    [/invalid login credentials/i, "Wrong email or password."],
    [/email not confirmed/i, "Confirm your email first. Open the link we sent you, then sign in."],
    [/already registered|already been registered/i, "This email already has an account. Choose Sign in instead."],
    [/password should be at least|weak password/i, "Choose a longer password (at least 8 characters)."],
    [/rate limit|too many/i, "Too many attempts. Wait a minute and try again."],
    [/failed to fetch|network|load failed/i, "Could not reach the sign-in service. Check your connection and try again."]
];

function friendly(error)
{
    const text = String(error?.message || error || "");
    return MESSAGES.find(([pattern]) => pattern.test(text))?.[1] || (text.length < 140 && text ? text : "Something went wrong. Please try again.");
}

const hasContent = mission => mission.routes.some(route => route.points.length) || mission.observations.length > 0 || mission.routes.length > 1;
const fingerprint = mission => JSON.stringify({ ...mission, updatedAt: null });

export function mountAccount({ store, cloudWorkspace, notify, shell })
{
    const { cloud } = cloudWorkspace;
    const accountButton = cloudWorkspace.account;
    const status = shell.querySelector("#storage-status");
    let finish = () => {};
    const ready = new Promise(resolve => { finish = resolve; });
    let initialised = false;

    // ----- Sign-in window -----
    const gate = document.createElement("dialog");
    gate.className = "modal account-gate";
    gate.id = "account-gate";
    gate.setAttribute("aria-labelledby", "gate-title");
    gate.innerHTML = `
        <div class="gate-brand">MARS ATLAS</div>
        <h2 id="gate-title">Sign in to keep your routes</h2>
        <p class="gate-lede">As a guest you can use everything, but <strong>nothing you draw is saved</strong>. With an account your work is saved automatically.</p>
        <div class="gate-tabs" role="tablist" aria-label="Account">
            <button type="button" role="tab" data-gate-tab="signin" aria-selected="true">Sign in</button>
            <button type="button" role="tab" data-gate-tab="signup" aria-selected="false">Create account</button>
        </div>
        <form class="gate-form" novalidate>
            <label>Email<input type="email" name="email" autocomplete="email" inputmode="email" required></label>
            <label>Password
                <span class="gate-password"><input type="password" name="password" autocomplete="current-password" minlength="8" required>
                <button type="button" data-gate-toggle aria-label="Show password" aria-pressed="false">Show</button></span>
            </label>
            <p class="gate-hint" data-gate-hint hidden>Use at least 8 characters.</p>
            <button class="btn btn-accent wide" type="submit" data-gate-submit>Sign in</button>
            <p class="gate-status" role="status" aria-live="polite"></p>
        </form>
        <div class="gate-divider"><span>or</span></div>
        <button class="btn btn-outline wide" type="button" data-gate-guest>Continue as a guest · nothing is saved</button>`;
    document.body.appendChild(gate);
    const form = gate.querySelector(".gate-form");
    const message = gate.querySelector(".gate-status");
    const submit = gate.querySelector("[data-gate-submit]");
    let mode = "signin";
    let busy = false;

    function setMode(next)
    {
        mode = next;
        gate.querySelectorAll("[data-gate-tab]").forEach(tab => tab.setAttribute("aria-selected", String(tab.dataset.gateTab === mode)));
        submit.textContent = mode === "signin" ? "Sign in" : "Create account";
        form.elements.password.autocomplete = mode === "signin" ? "current-password" : "new-password";
        gate.querySelector("[data-gate-hint]").hidden = mode === "signin";
        message.textContent = "";
        message.className = "gate-status";
    }

    function say(text, kind = "")
    {
        message.textContent = text;
        message.className = "gate-status" + (kind ? " is-" + kind : "");
    }

    function openGate(tab = "signin")
    {
        setMode(tab);
        if (!gate.open) gate.showModal();
        form.elements.email.focus();
    }

    function chooseGuest()
    {
        try { sessionStorage.setItem(GUEST_KEY, "1"); } catch { /* storage blocked: the window may show again on reload */ }
        if (gate.open) gate.close();
    }

    gate.addEventListener("close", () => { finish(); window.dispatchEvent(new Event("mars-gate-closed")); });
    gate.addEventListener("cancel", () => chooseGuest());
    gate.querySelector("[data-gate-guest]").addEventListener("click", chooseGuest);
    gate.querySelectorAll("[data-gate-tab]").forEach(tab => tab.addEventListener("click", () => setMode(tab.dataset.gateTab)));
    gate.querySelector("[data-gate-toggle]").addEventListener("click", event =>
    {
        const shown = form.elements.password.type === "password";
        form.elements.password.type = shown ? "text" : "password";
        event.currentTarget.textContent = shown ? "Hide" : "Show";
        event.currentTarget.setAttribute("aria-pressed", String(shown));
        event.currentTarget.setAttribute("aria-label", shown ? "Hide password" : "Show password");
    });

    form.addEventListener("submit", async event =>
    {
        event.preventDefault();

        if (busy) return;

        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;

        if (!/^\S+@\S+\.\S+$/.test(email)) { say("Enter a valid email address.", "error"); return; }

        if (password.length < 8) { say("The password needs at least 8 characters.", "error"); return; }

        busy = true;
        submit.disabled = true;
        say(mode === "signin" ? "Signing in…" : "Creating your account…");

        try
        {
            if (mode === "signin")
            {
                await cloud.signIn(email, password);
                gate.close();
            }
            else
            {
                const result = await cloud.signUp(email, password);

                if (result?.session)
                {
                    gate.close();
                }
                else
                {
                    setMode("signin");
                    say("Account created. We sent a confirmation link to " + email + ". Open it, then sign in here.", "ok");
                }
            }
        }
        catch (error)
        {
            say(friendly(error), "error");
        }
        finally
        {
            busy = false;
            submit.disabled = false;
        }
    });

    // ----- Reminder bar for guests -----
    const banner = document.createElement("div");
    banner.className = "guest-banner";
    banner.setAttribute("role", "region");
    banner.setAttribute("aria-label", "Account");
    banner.innerHTML = `<span><strong>Guest mode.</strong> Your routes are not saved.</span><span class="guest-banner-actions"><button type="button" data-banner="signin">Sign in</button><button type="button" data-banner="signup">Create account</button></span>`;
    shell.querySelector(".header")?.after(banner);
    banner.addEventListener("click", event =>
    {
        const action = event.target.closest("[data-banner]")?.dataset.banner;

        if (action) openGate(action);
    });

    function paint()
    {
        const signedIn = Boolean(cloud.user);
        shell.dataset.account = signedIn ? "user" : "guest";
        banner.hidden = signedIn || !initialised || !cloud.configured;
        if (accountButton) accountButton.textContent = signedIn ? "Mission Center" : "Sign in";
    }

    // A guest's button opens the sign-in window; a signed-in user's button opens Mission Center as before.
    accountButton?.addEventListener("click", event =>
    {
        if (!cloud.user && cloud.configured)
        {
            event.stopImmediatePropagation();
            event.preventDefault();
            openGate("signin");
        }
    }, true);

    window.addEventListener("beforeunload", event =>
    {
        if (!cloud.user && store.missions.some(hasContent))
        {
            event.preventDefault();
            event.returnValue = "";
        }
    });

    // ----- Automatic saving for signed-in users -----
    const saved = new Map();
    const blocked = new Set();
    let timer = null;
    let saving = false;

    function setStatus(text)
    {
        if (cloud.user && status) status.textContent = text;
    }

    function schedule()
    {
        if (!cloud.user) return;

        const mission = store.current;

        if (blocked.has(mission.id) || !hasContent(mission) || saved.get(mission.id) === fingerprint(mission))
        {
            return;
        }

        setStatus("SAVING TO YOUR ACCOUNT…");
        clearTimeout(timer);
        timer = setTimeout(run, SAVE_DELAY_MS);
    }

    async function run()
    {
        if (!cloud.user) return;

        if (saving) { schedule(); return; }

        const mission = store.current;
        const key = fingerprint(mission);

        if (blocked.has(mission.id) || saved.get(mission.id) === key) return;

        saving = true;

        try
        {
            await cloud.saveMission(mission, { snapshot: false });
            saved.set(mission.id, key);
            setStatus("SAVED TO YOUR ACCOUNT");
        }
        catch (error)
        {
            const text = String(error?.message || error);

            if (/another revision|changed in the cloud|removed from the cloud/i.test(text))
            {
                blocked.add(mission.id);
                setStatus("NOT SAVED · CLOUD COPY CHANGED");
                notify(text);
            }
            else if (/row-level security|permission|not allowed/i.test(text))
            {
                blocked.add(mission.id);
                setStatus("READ-ONLY MISSION · NOT SAVED");
            }
            else
            {
                setStatus("NOT SAVED · RETRYING");
                clearTimeout(timer);
                timer = setTimeout(run, 8000);
            }
        }
        finally
        {
            saving = false;
        }
    }

    store.subscribe(() =>
    {
        if (cloud.user) schedule();
        else if (status) status.textContent = "NOT SAVED · SIGN IN TO KEEP YOUR WORK";
    });

    // ----- React to sign-in and sign-out -----
    let knownId = null;
    const original = cloud.onUserChange;
    cloud.onUserChange = user =>
    {
        original(user);
        const id = user?.id || null;

        if (id && id !== knownId)
        {
            store.attachAccount(id);
            if (initialised && gate.open) gate.close();
            if (initialised) notify("Signed in. Your work is now saved automatically.");
            schedule();
        }
        else if (!id && knownId)
        {
            clearTimeout(timer);
            saved.clear();
            blocked.clear();
            store.detachAccount();
            notify("Signed out. This device no longer keeps your missions.");
        }

        knownId = id;
        paint();
    };

    // ----- Start-up: wait for the account service, then show the window once if nobody is signed in -----
    (async () =>
    {
        const enabled = await cloudWorkspace.ready;
        initialised = true;
        paint();

        let seen = false;
        try { seen = sessionStorage.getItem(GUEST_KEY) === "1"; } catch { /* storage blocked */ }

        if (!enabled || cloud.user || seen)
        {
            finish();
            window.dispatchEvent(new Event("mars-gate-closed"));
            return;
        }

        if (document.querySelector(".home"))
        {
            await new Promise(resolve => window.addEventListener("mars-home-closed", resolve, { once: true }));
        }

        openGate("signin");
    })();

    return { ready, open: openGate };
}
