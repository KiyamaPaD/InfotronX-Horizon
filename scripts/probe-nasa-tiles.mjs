// Diagnostic of public NASA map imagery. Run manually or from Verify CI.
import { MAP_LAYERS, JEZERO } from "../src/constants.js";

function coords(zoom)
{
    return {
        x: Math.floor((JEZERO.lon + 180) / 360 * 2 ** (zoom + 1)),
        y: Math.floor((90 - JEZERO.lat) / 180 * 2 ** zoom)
    };
}

async function probe(label, url, inspectImage = false)
{
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6500);

    try
    {
        const response = await fetch(url, { signal: controller.signal });
        const bytes = new Uint8Array(await response.arrayBuffer());
        let dimensions = null;

        if (inspectImage && bytes.length > 24)
        {
            if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71)
            {
                const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
                dimensions = [view.getUint32(16), view.getUint32(20)];
            }
            else if (bytes[0] === 255 && bytes[1] === 216)
            {
                let i = 2;

                while (i + 9 < bytes.length)
                {
                    if (bytes[i] !== 255)
                    {
                        i++;
                        continue;
                    }

                    const marker = bytes[i + 1];

                    if ([0xc0, 0xc1, 0xc2, 0xc3].includes(marker))
                    {
                        dimensions = [(bytes[i + 7] << 8) | bytes[i + 8], (bytes[i + 5] << 8) | bytes[i + 6]];
                        break;
                    }

                    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01)
                    {
                        i += 2;
                    }
                    else
                    {
                        const length = (bytes[i + 2] << 8) | bytes[i + 3];
                        i += length + 2;
                    }
                }
            }
        }

        const detail = { label, status: response.status, type: response.headers.get("content-type"), bytes: bytes.length, dimensions };

        if (!inspectImage)
        {
            const xml = new TextDecoder().decode(bytes);
            const resource = xml.match(/<ResourceURL\b[^>]*>/i)?.[0] || null;
            detail.template = resource?.match(/template="([^"]+)"/i)?.[1] || null;
            detail.mentionsMosaic = /TileMatrixSet/.test(xml);
            detail.sample = xml.slice(0, 120).replace(/\s+/g, " ");
        }

        console.log(JSON.stringify(detail));
    }
    catch (error)
    {
        console.log(JSON.stringify({ label, error: error.name + ": " + error.message }));
    }
    finally
    {
        clearTimeout(timer);
    }
}

const requests = [];

for (const layer of MAP_LAYERS)
{
    requests.push(probe(layer.id + ":capabilities", layer.url + "/WMTSCapabilities.xml"));

    const levels = layer.id === "hirise" ? [9, 10] : layer.id === "mola" ? [5, 7] : [5, 8];

    for (const zoom of levels)
    {
        const { x, y } = coords(zoom);

        for (const extension of layer.extensions)
        {
            requests.push(probe(layer.id + ":" + zoom + ":" + extension,
                layer.url + "/default/default028mm/" + zoom + "/" + y + "/" + x + "." + extension, true));
        }
    }
}

for (const [name, dataset, extension] of [
    ["mola-gray", "Mars_MGS_MOLA_DEM_mosaic_global_463m_8", "png"],
    ["mola-shaded", "Mars_MOLA_blend200ppx_HRSC_Shade_clon0dd_200mpp_lzw", "jpg"],
    ["hrsc-color", "Mars_MOLA_blend200ppx_HRSC_ClrShade_clon0dd_200mpp_lzw", "jpg"]
])
{
    const url = "https://trek.nasa.gov/tiles/Mars/EQ/" + dataset + "/1.0.0";
    requests.push(probe(name + ":capabilities", url + "/WMTSCapabilities.xml"));

    for (const zoom of [5, 7])
    {
        const { x, y } = coords(zoom);
        requests.push(probe(name + ":" + zoom, url + "/default/default028mm/" + zoom + "/" + y + "/" + x + "." + extension, true));
    }
}

await Promise.all(requests);
