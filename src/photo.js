// Photos attached to a waypoint. A picture is shrunk in the browser to a small JPEG so it can travel with the mission
// (a mission file and a cloud save are both limited in size).
export const MAX_PHOTO_CHARS = 90000;
export const MAX_PHOTOS_PER_MISSION = 10;

export function isPhotoData(value)
{
    return typeof value === "string" && value.length <= MAX_PHOTO_CHARS && /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value);
}

// Returns a data URL under the size limit, or throws a message that says what to do.
export async function shrinkPhoto(file)
{
    if (!file || !/^image\//.test(file.type || ""))
    {
        throw new Error("Choose a picture (JPEG, PNG, WebP).");
    }

    const bitmap = await createImageBitmap(file);
    let side = 720;

    for (let attempt = 0; attempt < 6; attempt++)
    {
        const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(bitmap.width * scale));
        canvas.height = Math.max(1, Math.round(bitmap.height * scale));
        canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);

        for (const quality of [0.78, 0.65, 0.5])
        {
            const data = canvas.toDataURL("image/jpeg", quality);

            if (isPhotoData(data))
            {
                bitmap.close?.();
                return data;
            }
        }

        side = Math.round(side * 0.75);
    }

    bitmap.close?.();
    throw new Error("That picture is too detailed to keep with the mission. Try a smaller one.");
}
