import { CrewProfileService, MAX_AVATAR_BYTES } from "./crew-profile.js";

export function mountCrewProfile({ dialog, cloud, store, run, openCloudTab })
{
    const section = dialog.querySelector("#hub-crew");
    const service = new CrewProfileService(cloud);
    const get = selector => section.querySelector(selector);
    const form = get("#crew-profile-form");
    const message = get("#crew-message");
    const photo = get("#crew-photo");
    const placeholder = get("#crew-avatar-fallback");
    const summary = get("#crew-preview-name");
    const subtitle = get("#crew-preview-role");
    const avatarFile = get("#crew-avatar-upload");
    let currentId = null;

    function setMessage(value)
    {
        message.textContent = value;
    }

    function reset()
    {
        currentId = null;
        form.reset();
        photo.removeAttribute("src");
        photo.hidden = true;
        placeholder.hidden = false;
        get("#crew-profile-content").hidden = true;
        get("#crew-profile-login").hidden = false;
        get("#crew-avatar-remove").disabled = true;
        summary.textContent = "Mars Explorer";
        subtitle.textContent = "Mission Planner";
        setMessage("Sign in via Cloud library to save a private crew profile.");
    }

    async function load()
    {
        const userId = cloud.user?.id;

        if (!userId)
        {
            reset();
            return;
        }

        const profile = await service.load();

        if (cloud.user?.id !== userId)
        {
            return;
        }

        currentId = userId;

        for (const field of ["display_name", "callsign", "mission_role", "specialty", "biography"])
        {
            form.elements.namedItem(field).value = profile[field] || "";
        }

        summary.textContent = profile.display_name;
        subtitle.textContent = `${profile.mission_role} · ${profile.callsign}`;
        placeholder.textContent = profile.display_name.trim().split(/\s+/).slice(0, 2)
            .map(word => word.charAt(0).toUpperCase()).join("") || "MA";
        get("#crew-stat-missions").textContent = String(store.missions.length);
        get("#crew-stat-points").textContent = String(store.missions.reduce((sum, mission) =>
            sum + mission.routes.reduce((count, route) => count + route.points.length, 0), 0));
        get("#crew-stat-notes").textContent = String(store.missions.reduce((sum, mission) =>
            sum + mission.observations.length, 0));
        get("#crew-profile-login").hidden = true;
        get("#crew-profile-content").hidden = false;
        get("#crew-avatar-remove").disabled = !profile.avatar_path;
        photo.hidden = true;
        photo.removeAttribute("src");
        placeholder.hidden = false;

        if (profile.avatar_path)
        {
            const url = await service.signedAvatarUrl(profile);

            if (cloud.user?.id === userId && url)
            {
                photo.src = url;
            }
        }

        setMessage("Private profile loaded. Your identity and role are user-entered, not NASA credentials.");
    }

    photo.addEventListener("load", () =>
    {
        photo.hidden = false;
        placeholder.hidden = true;
    });
    photo.addEventListener("error", () =>
    {
        photo.hidden = true;
        placeholder.hidden = false;
    });

    form.addEventListener("submit", event =>
    {
        event.preventDefault();
        run(async () =>
        {
            if (!cloud.user || cloud.user.id !== currentId)
            {
                throw new Error("Sign in again before saving your profile.");
            }

            setMessage("Saving profile securely…");
            const file = avatarFile.files?.[0];

            if (file && (!["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
                file.size <= 0 || file.size > MAX_AVATAR_BYTES))
            {
                throw new Error("Choose a PNG, JPEG or WebP image up to 2 MB.");
            }

            const values = Object.fromEntries(new FormData(form).entries());
            await service.save(values);

            if (file)
            {
                await service.uploadAvatar(file);
                avatarFile.value = "";
            }

            await load();
            setMessage("Crew profile and avatar saved to your private account.");
        }, setMessage);
    });

    get("#crew-avatar-remove").addEventListener("click", () =>
    {
        if (!window.confirm("Remove your private profile photo?"))
        {
            return;
        }

        run(async () =>
        {
            await service.removeAvatar();
            await load();
            setMessage("Profile photo removed from your account.");
        }, setMessage);
    });

    get("#crew-go-login").addEventListener("click", openCloudTab);

    reset();

    return {
        onUserChanged(user)
        {
            if (!user || user.id !== currentId)
            {
                reset();
            }
        },
        open()
        {
            run(load, setMessage);
        }
    };
}
