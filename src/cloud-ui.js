import { MissionCloud } from "./cloud-sync.js";
import { mountCrewProfile } from "./crew-profile-ui.js";
import { mountMissionChat } from "./mission-chat-ui.js";

export function mountCloudWorkspace({ store, notify })
{
    const account = document.createElement("button");
    account.type = "button";
    account.className = "btn btn-outline compact header-cloud";
    account.id = "mission-hub-open";
    account.textContent = "Mission Center";
    account.hidden = false;
    document.querySelector(".header-actions").prepend(account);

    const dialog = document.createElement("dialog");
    dialog.className = "modal cloud-modal";
    dialog.setAttribute("aria-labelledby", "cloud-title");
    dialog.innerHTML = [
        '<div class="modal-header"><span class="section-label">MISSION CENTER</span><button class="modal-x" type="button" id="cloud-close" aria-label="Close account">×</button></div>',
        '<h2 id="cloud-title">Mission Center</h2>',
        '<p id="hub-status" role="status" aria-live="polite">Missions are saved automatically on this device.</p>',
        '<div class="mission-hub-tabs" role="tablist" aria-label="Mission Center sections">',
        '<button type="button" data-hub-tab="device" class="active" role="tab" aria-selected="true">On device</button>',
        '<button type="button" data-hub-tab="cloud" role="tab" aria-selected="false">Cloud library</button>',
        '<button type="button" data-hub-tab="crew" role="tab" aria-selected="false">Crew profile</button>',
        '<button type="button" data-hub-tab="export" role="tab" aria-selected="false">Share &amp; export</button></div>',
        '<section class="mission-hub-panel" id="hub-device" data-hub-panel="device"><h3>Your missions</h3>',
        '<div id="hub-device-list"></div><div id="hub-checkpoints"></div></section>',
        '<section class="mission-hub-panel" id="hub-cloud" data-hub-panel="cloud" hidden>',
        '<p id="cloud-status" role="status" aria-live="polite">Sign in to access your cloud missions.</p>',
        '<form id="cloud-auth-form" class="cloud-auth-form">',
        '<label>Email<input type="email" name="email" autocomplete="email" maxlength="254" required /></label>',
        '<label>Password<input type="password" name="password" autocomplete="current-password" minlength="8" required /></label>',
        '<div class="cloud-actions"><button class="btn btn-accent" type="submit" value="signin">Sign in</button>',
        '<button class="btn btn-outline" type="submit" value="signup">Create account</button></div></form>',
        '<div id="cloud-session" hidden>',
        '<p class="cloud-account-email" id="cloud-email"></p>',
        '<p class="section-help">Save explicitly to upload your latest changes.</p>',
        '<div class="cloud-actions"><button id="cloud-save" type="button" class="btn btn-accent">Save current mission</button>',
        '<button id="cloud-refresh" type="button" class="btn btn-outline">Refresh library</button></div>',
        '<label class="cloud-label">Cloud missions<select id="cloud-missions" aria-label="Choose a cloud mission"></select></label>',
        '<div class="cloud-actions"><button id="cloud-open" type="button" class="btn btn-outline">Open selected mission</button>',
        '<button id="cloud-signout" type="button" class="btn btn-muted">Sign out</button></div>',
        '<div class="cloud-share" id="cloud-share" hidden><h3>Share selected mission</h3>',
        '<p>Use your teammate\'s account email. Access stays pending until their email is confirmed. No invitation email is sent.</p>',
        '<label>Teammate email<input id="cloud-member-email" type="email" maxlength="254" placeholder="teammate@example.com" autocomplete="off" /></label>',
        '<label>Access<select id="cloud-member-access"><option value="viewer">Can view</option><option value="editor">Can edit</option></select></label>',
        '<button id="cloud-invite" type="button" class="btn btn-outline">Share by email</button>',
        '<div id="cloud-members" class="cloud-members" aria-live="polite"></div>',
        '<div id="cloud-pending" class="cloud-members" aria-live="polite"></div></div></div></section>',
        '<section class="mission-hub-panel" id="hub-crew" data-hub-panel="crew" hidden>',
        '<div id="crew-profile-login" class="crew-profile-login"><p>Sign in to create your crew profile.</p><button type="button" id="crew-go-login" class="btn btn-outline">Sign in to build your profile</button></div>',
        '<div id="crew-profile-content" hidden>',
        '<div class="crew-profile-hero"><div class="crew-avatar"><img id="crew-photo" alt="Your uploaded profile photo" hidden/><span id="crew-avatar-fallback">MA</span></div><div class="crew-preview"><span>PERSONAL MISSION PROFILE</span><strong id="crew-preview-name">Mars Explorer</strong><small id="crew-preview-role">Mission Planner</small></div></div>',
        '<div class="crew-stats"><div><strong id="crew-stat-missions">0</strong><small>Local missions</small></div><div><strong id="crew-stat-points">0</strong><small>Saved waypoints</small></div><div><strong id="crew-stat-notes">0</strong><small>Observations</small></div></div>',
        '<form id="crew-profile-form" class="crew-profile-form">',
        '<div class="crew-profile-fields"><label>Display name<input name="display_name" maxlength="60" autocomplete="nickname" required placeholder="Explorer name"/></label>',
        '<label>Callsign<input name="callsign" maxlength="32" required placeholder="e.g. Pathfinder"/></label>',
        '<label>Mission role<input name="mission_role" maxlength="60" required placeholder="e.g. Terrain analyst"/></label>',
        '<label>Specialty<input name="specialty" maxlength="80" required placeholder="e.g. Mars GIS and routing"/></label></div>',
        '<label class="crew-bio">Crew biography<textarea name="biography" maxlength="600" rows="4" placeholder="Your skills, projects, science interests and objectives."></textarea></label>',
        '<label class="crew-upload">Profile photo (PNG, JPEG, WebP; 2 MB max)<input id="crew-avatar-upload" type="file" accept="image/png,image/jpeg,image/webp"/></label>',
        '<div class="crew-profile-actions"><button type="button" class="btn btn-outline" id="crew-avatar-remove" disabled>Remove photo</button><button class="btn btn-accent" type="submit">Save crew profile</button></div></form>',
        '<p class="science-footnote">Your profile and image are private to your account.</p>',
        '</div><p id="crew-message" role="status" aria-live="polite">Sign in to use your crew profile.</p></section>',
        '<section class="mission-hub-panel" id="hub-export" data-hub-panel="export" hidden>',
        '<h3>Share and export</h3><p>Share a copy by link, or download a backup and route data.</p>',
        '<div id="hub-export-actions" class="mission-hub-actions"></div></section>'
    ].join("");
    document.body.append(dialog);

    const deviceList = dialog.querySelector("#hub-device-list");
    const localList = document.querySelector("#library-list");
    const localDialog = document.querySelector("#library-modal");

    if (localList)
    {
        deviceList.append(localList);
    }

    const importLabel = localDialog?.querySelector(".file-input-button");
    const createMission = localDialog?.querySelector('[data-action="new-mission"]');

    if (importLabel)
    {
        const localActions = document.createElement("div");
        localActions.className = "mission-hub-actions";
        localActions.append(importLabel);

        if (createMission)
        {
            localActions.append(createMission);
        }

        deviceList.append(localActions);
    }

    const checkpointPanel = document.querySelector("#checkpoint-list")?.closest(".panel-section");

    if (checkpointPanel)
    {
        dialog.querySelector("#hub-checkpoints").append(checkpointPanel);
    }

    const exports = dialog.querySelector("#hub-export-actions");
    const linkButton = document.querySelector(".header-share");
    const originalFooter = document.querySelector(".right-footer");

    if (linkButton)
    {
        linkButton.classList.remove("header-share", "compact");
        linkButton.textContent = "Copy mission link";
        exports.append(linkButton);
    }

    for (const button of [...(originalFooter?.querySelectorAll("button") || [])])
    {
        exports.append(button);
    }

    if (originalFooter)
    {
        originalFooter.hidden = true;
    }

    document.querySelector(".header-library")?.remove();

    const get = selector => dialog.querySelector(selector);

    function showHubTab(name)
    {
        if (name !== "chat")
        {
            missionChat?.leave();
        }

        for (const panel of dialog.querySelectorAll("[data-hub-panel]"))
        {
            panel.hidden = panel.dataset.hubPanel !== name;
            panel.setAttribute('role','tabpanel');
            panel.setAttribute('aria-labelledby','hub-tab-' + panel.dataset.hubPanel);
        }

        for (const button of dialog.querySelectorAll("[data-hub-tab]"))
        {
            const selected = button.dataset.hubTab === name;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-selected", String(selected));
            button.id = 'hub-tab-' + button.dataset.hubTab;
            button.setAttribute('aria-controls','hub-' + button.dataset.hubTab);
            button.tabIndex = selected ? 0 : -1;
        }
    }

    dialog.querySelector('.mission-hub-tabs').addEventListener('keydown', event =>
    {
        const current = event.target.closest('[data-hub-tab]');
        const keys = ['ArrowLeft','ArrowRight','Home','End'];
        if (!current || !keys.includes(event.key)) return;
        event.preventDefault();
        const tabs = [...dialog.querySelectorAll('[data-hub-tab]')];
        const index = tabs.indexOf(current);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 :
            (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        tabs[next].click();
        tabs[next].focus();
    });

    dialog.querySelectorAll("[data-hub-tab]").forEach(button =>
    {
        button.addEventListener("click", () =>
        {
            showHubTab(button.dataset.hubTab);

            if (button.dataset.hubTab === "cloud" && cloud.user)
            {
                run(() => updateLibrary(store.current.id));
            }

            if (button.dataset.hubTab === "crew")
            {
                crewProfile.open();
            }
        });
    });

    dialog.addEventListener("click", event =>
    {
        if (event.target.closest("[data-select-mission], [data-action='new-mission']"))
        {
            dialog.close();
        }
    });

    if (document.querySelector("#import-json"))
    {
        document.querySelector("#import-json").addEventListener("change", () =>
        {
            if (document.querySelector("#import-json").files.length)
            {
                dialog.close();
            }
        });
    }
    let cloudRows = [];

    const cloud = new MissionCloud(user =>
    {
        get("#cloud-auth-form").hidden = Boolean(user);
        get("#cloud-session").hidden = !user;
        account.textContent = "Mission Center";
        get("#cloud-email").textContent = user ? "Signed in as " + (user.email || "user") : "";
        get("#cloud-status").textContent = user ? "Your cloud library is available." : "Sign in to access your cloud missions.";

        crewProfile.onUserChanged(user);
        missionChat.onUserChanged(user);

        if (!user)
        {
            cloudRows = [];
            get("#cloud-missions").replaceChildren();
            get("#cloud-share").hidden = true;
        }
    });

    const crewProfile = mountCrewProfile({
        dialog, cloud, store, run, openCloudTab: () => showHubTab("cloud")
    });
    const missionChat = mountMissionChat({
        dialog, cloud, notify, run, openCloudTab: () => showHubTab("cloud")
    });
    dialog.querySelector('[data-hub-tab="chat"]').addEventListener("click", () =>
    {
        showHubTab("chat");
        missionChat.open();
    });

    function message(value)
    {
        get("#cloud-status").textContent = value;
        get("#hub-status").textContent = value;
    }

    store.subscribe(() =>
    {
        if (!dialog.open)
        {
            return;
        }

        get("#hub-status").textContent = store.lastSaveSucceeded
            ? "Changes saved automatically on this device."
            : "Device save failed. Export a JSON backup.";
    });

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
            return { members: [], pending: [] };
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
            title.textContent = "Pending — email account not yet connected";
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

            const copy = document.createElement("button");
            copy.type = "button";
            copy.className = "btn btn-outline";
            copy.textContent = "Copy invite";
            copy.setAttribute("aria-label", "Copy sign-in instructions for " + invite.email);
            copy.addEventListener("click", () => run(async () =>
            {
                const text = "You have been invited to collaborate on a Mars Atlas mission as "
                    + (invite.access === "editor" ? "an editor" : "a viewer")
                    + ". Open " + window.location.origin
                    + ", create or sign in to your account using exactly "
                    + invite.email + ", confirm your email, then open Mission Center → Cloud library.";
                await navigator.clipboard.writeText(text);
                message("Invitation instructions copied. Send them to your teammate.");
            }));

            item.append(info, copy, cancel);
            pendingList.append(item);
        }

        if (!members.length && !pending.length)
        {
            const empty = document.createElement("p");
            empty.className = "section-help";
            empty.textContent = "This mission is private. Share it with a teammate by email.";
            list.append(empty);
        }

        return { members, pending };
    }

    async function updateLibrary(preferredId = null)
    {
        const select = get("#cloud-missions");
        const previousId = preferredId || select.value;
        let invitationsWarning = null;

        try
        {
            await cloud.claimEmailInvitations();
        }
        catch (error)
        {
            invitationsWarning = error;
        }

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

        try
        {
            await refreshMembers();
        }
        catch (error)
        {
            get("#cloud-members").textContent = "Sharing details unavailable. Refresh the library to try again.";
        }

        if (invitationsWarning)
        {
            message("Cloud library loaded. Pending email invitations could not be checked.");
        }

        return cloudRows;
    }

    async function run(task, onError = null)
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
            const value = error?.message || "The request could not be completed.";

            if (onError)
            {
                onError(value);
            }
            else
            {
                message(value);
            }
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
        // Preserve the original Science export button; provide a proxy in Mission Center.
        const scienceExport = document.querySelector("#terrain-evidence-export");

        if (scienceExport)
        {
            let shortcut = exports.querySelector("#hub-science-evidence-export");

            if (!shortcut)
            {
                shortcut = document.createElement("button");
                shortcut.id = "hub-science-evidence-export";
                shortcut.type = "button";
                shortcut.className = "btn btn-outline";
                shortcut.textContent = "Export scientific comparison (.md)";
                shortcut.addEventListener("click",() => scienceExport.click());
                exports.append(shortcut);
            }

            shortcut.disabled = scienceExport.disabled;
        }

        dialog.showModal();
        showHubTab("device");
        get("#hub-status").textContent = store.lastSaveSucceeded
            ? "Changes saved automatically on this device."
            : "Device save failed. Export a JSON backup.";

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
        const missionId = store.current.id;
        const result = await cloud.saveMission(store.current);
        const missions = await updateLibrary(missionId);

        if (!missions.some(item => item.id === missionId))
        {
            throw new Error("Cloud accepted this save, but the mission is missing from your library. Refresh and check your account.");
        }

        get("#cloud-missions").value = missionId;
        message(result.snapshotSaved
            ? "Saved to cloud and verified in your mission library."
            : "Saved to cloud and verified. A history snapshot could not be recorded.");
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
        const accessList = await refreshMembers();
        const isActive = accessList.members.some(member => member.email?.toLowerCase() === email.toLowerCase());

        message(isActive
            ? "Access active. This teammate can open the mission in their Cloud library."
            : "Pending: no confirmed Mars Atlas account matches this exact email yet. No email was sent. Use Copy invite to send instructions.");
    }));

    cloud.initialize().then(enabled =>
    {
        account.hidden = false;

        if (!enabled)
        {
            get("#cloud-status").textContent = "Cloud service is not configured. Your device library and exports remain available.";
            get("#cloud-auth-form").hidden = true;
        }
    }).catch(error =>
    {
        console.warn("Cloud sign-in could not be initialized:", error);
        account.hidden = false;
        get("#cloud-status").textContent = "Cloud connection unavailable. Device saves and exports are still available.";
        get("#cloud-auth-form").hidden = true;
    });

    return { cloud };
}
