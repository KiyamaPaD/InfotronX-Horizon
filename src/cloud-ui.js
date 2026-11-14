import { MissionCloud } from "./cloud-sync.js";

export function mountCloudWorkspace({ store, notify })
{
    const account = document.createElement("button");
    account.type = "button";
    account.className = "btn btn-outline compact header-cloud";
    account.textContent = "Account";
    account.hidden = true;
    document.querySelector(".header-actions").prepend(account);

    const dialog = document.createElement("dialog");
    dialog.className = "modal cloud-modal";
    dialog.setAttribute("aria-labelledby", "cloud-title");
    dialog.innerHTML = [
        '<div class="modal-header"><span class="section-label">MARS ATLAS ACCOUNT</span><button class="modal-x" type="button" id="cloud-close" aria-label="Close account">×</button></div>',
        '<h2 id="cloud-title">Mission library</h2>',
        '<p id="cloud-status" role="status">Sign in to save and share missions across devices.</p>',
        '<form id="cloud-auth-form" class="cloud-auth-form">',
        '<label>Email<input type="email" name="email" autocomplete="email" required /></label>',
        '<label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required /></label>',
        '<div class="cloud-actions"><button class="btn btn-accent" type="submit" value="signin">Sign in</button>',
        '<button class="btn btn-outline" type="submit" value="signup">Create account</button></div></form>',
        '<div id="cloud-session" hidden>',
        '<p class="cloud-account-email" id="cloud-email"></p>',
        '<div class="cloud-actions"><button id="cloud-save" type="button" class="btn btn-accent">Save current mission</button>',
        '<button id="cloud-refresh" type="button" class="btn btn-outline">Refresh library</button></div>',
        '<label class="cloud-label">Cloud missions<select id="cloud-missions"></select></label>',
        '<div class="cloud-actions"><button id="cloud-open" type="button" class="btn btn-outline">Open selected mission</button>',
        '<button id="cloud-signout" type="button" class="btn btn-muted">Sign out</button></div>',
        '<div class="cloud-share"><h3>Share a mission</h3>',
        '<p>Teammates can view or edit missions you own. Ask them to copy their account ID.</p>',
        '<label>Your account ID<input id="cloud-account-id" readonly /></label>',
        '<button id="cloud-copy-id" type="button" class="btn btn-outline">Copy account ID</button>',
        '<label>Teammate account ID<input id="cloud-member-id" placeholder="Account UUID" autocomplete="off" /></label>',
        '<label>Access<select id="cloud-member-access"><option value="viewer">Can view</option><option value="editor">Can edit</option></select></label>',
        '<button id="cloud-invite" type="button" class="btn btn-outline">Share current mission</button>',
        '<div id="cloud-members"></div></div></div>'
    ].join("");
    document.body.append(dialog);

    const get = selector => dialog.querySelector(selector);
    const cloud = new MissionCloud(user =>
    {
        get("#cloud-auth-form").hidden = Boolean(user);
        get("#cloud-session").hidden = !user;
        account.textContent = user ? "My account" : "Account";
        get("#cloud-email").textContent = user ? "Signed in as " + (user.email || "user") : "";
        get("#cloud-account-id").value = user?.id || "";
        get("#cloud-status").textContent = user
            ? "Choose a mission to save or open."
            : "Sign in to save and share missions across devices.";
    });

    function message(value)
    {
        get("#cloud-status").textContent = value;
    }

    async function updateLibrary()
    {
        const select = get("#cloud-missions");
        const missions = await cloud.listMissions();
        select.replaceChildren();

        if (!missions.length)
        {
            select.add(new Option("No cloud missions yet", ""));
        }

        for (const mission of missions)
        {
            select.add(new Option(mission.title + (mission.owner_id === cloud.user.id ? " · Yours" : " · Shared"), mission.id));
        }

        get("#cloud-open").disabled = !missions.length;
    }

    async function run(task)
    {
        const controls = [...dialog.querySelectorAll("button")];
        controls.forEach(button => button.disabled = true);

        try
        {
            await task();
        }
        catch (error)
        {
            message(error?.message || "The request could not be completed.");
        }
        finally
        {
            controls.forEach(button => button.disabled = false);
        }
    }

    account.addEventListener("click", () =>
    {
        dialog.showModal();

        if (cloud.user)
        {
            run(updateLibrary);
        }
    });

    get("#cloud-close").addEventListener("click", () => dialog.close());

    get("#cloud-auth-form").addEventListener("submit", event =>
    {
        event.preventDefault();
        const form = event.currentTarget;
        const email = form.elements.email.value.trim();
        const password = form.elements.password.value;
        const createAccount = event.submitter?.value === "signup";

        run(async () =>
        {
            if (createAccount)
            {
                const result = await cloud.signUp(email, password);
                message(result.session ? "Account created and signed in." : "Check your inbox for a confirmation email.");
            }
            else
            {
                await cloud.signIn(email, password);
                message("Signed in.");
                await updateLibrary();
            }

            form.elements.password.value = "";
        });
    });

    get("#cloud-save").addEventListener("click", () => run(async () =>
    {
        const result = await cloud.saveMission(store.current);
        message(result.snapshotSaved ? "Mission saved to your cloud library." : "Mission saved. Its history snapshot could not be recorded.");
        await updateLibrary();
    }));

    get("#cloud-refresh").addEventListener("click", () => run(async () =>
    {
        await updateLibrary();
        message("Library updated.");
    }));

    get("#cloud-open").addEventListener("click", () => run(async () =>
    {
        const id = get("#cloud-missions").value;

        if (!id)
        {
            return;
        }

        const exists = store.missions.some(mission => mission.id === id);

        if (exists && !window.confirm("Replace the copy of this mission on your device with the cloud copy? Export a backup if needed."))
        {
            return;
        }

        const mission = await cloud.loadMission(id);

        if (!store.loadCloudMission(mission))
        {
            throw new Error("Mission library is full. Export or remove an unused mission.");
        }

        dialog.close();
        notify("Mission opened from your cloud library.");
    }));

    get("#cloud-signout").addEventListener("click", () => run(async () =>
    {
        await cloud.signOut();
        message("Signed out. Missions already on this device are still available.");
    }));

    get("#cloud-copy-id").addEventListener("click", () => run(async () =>
    {
        await navigator.clipboard.writeText(cloud.user.id);
        message("Account ID copied.");
    }));

    get("#cloud-invite").addEventListener("click", () => run(async () =>
    {
        const userId = get("#cloud-member-id").value.trim();
        const access = get("#cloud-member-access").value;
        await cloud.inviteMember(store.current.id, userId, access);
        get("#cloud-member-id").value = "";
        message("Mission shared with this teammate.");
    }));

    cloud.initialize().then(enabled =>
    {
        account.hidden = !enabled;
    }).catch(error =>
    {
        console.warn("Cloud sign-in could not be initialized:", error);
        account.hidden = true;
    });
}
