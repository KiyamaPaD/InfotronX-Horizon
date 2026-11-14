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
        '<h2 id="cloud-title">Your mission library</h2>',
        '<p id="cloud-status" role="status" aria-live="polite">Sign in to access your cloud missions.</p>',
        '<form id="cloud-auth-form" class="cloud-auth-form">',
        '<label>Email<input type="email" name="email" autocomplete="email" maxlength="254" required /></label>',
        '<label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required /></label>',
        '<div class="cloud-actions"><button class="btn btn-accent" type="submit" value="signin">Sign in</button>',
        '<button class="btn btn-outline" type="submit" value="signup">Create account</button></div></form>',
        '<div id="cloud-session" hidden>',
        '<p class="cloud-account-email" id="cloud-email"></p>',
        '<p class="section-help">Save your current route to the cloud, or open a mission shared with you. Your on-device missions remain available separately.</p>',
        '<div class="cloud-actions"><button id="cloud-save" type="button" class="btn btn-accent">Save current mission</button>',
        '<button id="cloud-refresh" type="button" class="btn btn-outline">Refresh library</button></div>',
        '<label class="cloud-label">Cloud missions<select id="cloud-missions" aria-label="Choose a cloud mission"></select></label>',
        '<div class="cloud-actions"><button id="cloud-open" type="button" class="btn btn-outline">Open selected mission</button>',
        '<button id="cloud-signout" type="button" class="btn btn-muted">Sign out</button></div>',
        '<div class="cloud-share" id="cloud-share" hidden><h3>Share selected mission</h3>',
        '<p>Choose a mission you own, enter your teammate\'s email and select a role. They can access it after signing in with that address. No invitation email is sent automatically.</p>',
        '<label>Teammate email<input id="cloud-member-email" type="email" maxlength="254" placeholder="teammate@example.com" autocomplete="off" /></label>',
        '<label>Access<select id="cloud-member-access"><option value="viewer">Can view</option><option value="editor">Can edit</option></select></label>',
        '<button id="cloud-invite" type="button" class="btn btn-outline">Share by email</button>',
        '<div id="cloud-members" class="cloud-members" aria-live="polite"></div>',
        '<div id="cloud-pending" class="cloud-members" aria-live="polite"></div></div></div>'
    ].join("");
    document.body.append(dialog);

    const get = selector => dialog.querySelector(selector);
    let cloudRows = [];

    const cloud = new MissionCloud(user =>
    {
        get("#cloud-auth-form").hidden = Boolean(user);
        get("#cloud-session").hidden = !user;
        account.textContent = user ? "My account" : "Account";
        get("#cloud-email").textContent = user ? "Signed in as " + (user.email || "user") : "";
        get("#cloud-status").textContent = user ? "Your cloud library is available." : "Sign in to access your cloud missions.";

        if (!user)
        {
            cloudRows = [];
            get("#cloud-missions").replaceChildren();
            get("#cloud-share").hidden = true;
        }
    });

    function message(value)
    {
        get("#cloud-status").textContent = value;
    }

    function selectedMission()
    {
        return cloudRows.find(row => row.id === get("#cloud-missions").value) || null;
    }

    async function refreshMembers()
    {
        const row = selectedMission();
        const isOwner = row && cloud.user && row.owner_id === cloud.user.id;
        get("#cloud-share").hidden = !isOwner;
        const list = get("#cloud-members");
        const pendingList = get("#cloud-pending");
        list.replaceChildren();
        pendingList.replaceChildren();

        if (!isOwner)
        {
            return;
        }

        const [members, pending] = await Promise.all([
            cloud.listMembers(row.id),
            cloud.listPendingInvitations(row.id)
        ]);

        if (members.length)
        {
            const title = document.createElement("h4");
            title.textContent = "Shared with";
            list.append(title);
        }

        for (const member of members)
        {
            const item = document.createElement("div");
            item.className = "cloud-member-row";
            const info = document.createElement("span");
            info.textContent = member.email + " · " + (member.access === "editor" ? "Can edit" : "Can view");

            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "btn btn-muted";
            remove.textContent = "Revoke";
            remove.addEventListener("click", () => run(async () =>
            {
                if (!window.confirm("Remove this teammate's access?"))
                {
                    return;
                }

                await cloud.removeMember(row.id, member.user_id);
                await refreshMembers();
                message("Teammate access removed.");
            }));

            item.append(info, remove);
            list.append(item);
        }

        if (pending.length)
        {
            const title = document.createElement("h4");
            title.textContent = "Waiting for sign-in";
            pendingList.append(title);
        }

        for (const invite of pending)
        {
            const item = document.createElement("div");
            item.className = "cloud-member-row";
            const info = document.createElement("span");
            info.textContent = invite.email + " · " + (invite.access === "editor" ? "Can edit" : "Can view");

            const cancel = document.createElement("button");
            cancel.type = "button";
            cancel.className = "btn btn-muted";
            cancel.textContent = "Cancel";
            cancel.addEventListener("click", () => run(async () =>
            {
                await cloud.cancelPendingInvitation(row.id, invite.email);
                await refreshMembers();
                message("Pending invitation cancelled.");
            }));

            item.append(info, cancel);
            pendingList.append(item);
        }

        if (!members.length && !pending.length)
        {
            const empty = document.createElement("p");
            empty.className = "section-help";
            empty.textContent = "This mission is private. Share it with a teammate by email.";
            list.append(empty);
        }
    }

    async function updateLibrary(preferredId = null)
    {
        const select = get("#cloud-missions");
        const previousId = preferredId || select.value;
        cloudRows = await cloud.listMissions();
        select.replaceChildren();

        for (const mission of cloudRows)
        {
            const kind = mission.owner_id === cloud.user.id ? "Yours" : "Shared";
            select.add(new Option(mission.title + " · " + kind, mission.id));
        }

        if (!cloudRows.length)
        {
            select.add(new Option("No cloud missions yet", ""));
        }
        else if (cloudRows.some(row => row.id === previousId))
        {
            select.value = previousId;
        }

        get("#cloud-open").disabled = !cloudRows.length;
        await refreshMembers();
    }

    async function run(task)
    {
        const controls = [...dialog.querySelectorAll("button")];
        const original = controls.map(button => button.disabled);
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
            controls.forEach((button, index) =>
            {
                if (button.isConnected)
                {
                    button.disabled = original[index];
                }
            });
            get("#cloud-open").disabled = !cloudRows.length;
        }
    }

    account.addEventListener("click", () =>
    {
        dialog.showModal();

        if (cloud.user)
        {
            run(() => updateLibrary(store.current.id));
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
            try
            {
                if (createAccount)
                {
                    const result = await cloud.signUp(email, password);
                    message(result.session ? "Account created and signed in." : "Check your email to confirm your account.");

                    if (result.session)
                    {
                        await updateLibrary();
                    }
                }
                else
                {
                    await cloud.signIn(email, password);
                    await updateLibrary();
                    message("Signed in successfully.");
                }
            }
            finally
            {
                form.elements.password.value = "";
            }
        });
    });

    get("#cloud-save").addEventListener("click", () => run(async () =>
    {
        const result = await cloud.saveMission(store.current);
        await updateLibrary(store.current.id);
        message(result.snapshotSaved ? "Mission saved to the cloud." : "Mission saved; its history snapshot could not be recorded.");
    }));

    get("#cloud-refresh").addEventListener("click", () => run(async () =>
    {
        await updateLibrary();
        message("Cloud library updated.");
    }));

    get("#cloud-missions").addEventListener("change", () => run(refreshMembers));

    get("#cloud-open").addEventListener("click", () => run(async () =>
    {
        const id = get("#cloud-missions").value;

        if (!id)
        {
            return;
        }

        const exists = store.missions.some(mission => mission.id === id);

        if (exists && !window.confirm("Replace the on-device copy with this cloud version? Export your current mission first if needed."))
        {
            return;
        }

        const mission = await cloud.loadMission(id);

        if (!store.loadCloudMission(mission))
        {
            throw new Error("Your mission library is full. Export or remove an unused mission.");
        }

        dialog.close();
        notify("Cloud mission opened. You can edit routes manually.");
    }));

    get("#cloud-signout").addEventListener("click", () => run(async () =>
    {
        await cloud.signOut();
        message("Signed out. On-device missions remain available.");
    }));

    get("#cloud-invite").addEventListener("click", () => run(async () =>
    {
        const row = selectedMission();

        if (!row || row.owner_id !== cloud.user?.id)
        {
            throw new Error("Choose a cloud mission you own before sharing it.");
        }

        const email = get("#cloud-member-email").value.trim();
        const access = get("#cloud-member-access").value;
        await cloud.shareByEmail(row.id, email, access);
        get("#cloud-member-email").value = "";
        await refreshMembers();
        message("Access saved. Ask your teammate to open Mars Atlas and sign in using that email.");
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
