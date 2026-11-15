// Geometry helpers for the NASA Mars 3D model (assets/nasa/mars-3d-model.glb, NASA/JPL-Caltech, from
// https://science.nasa.gov/resource/planet-mars-3d-model/). The model is a low-poly cube-sphere with a cube-map texture.
// Here it is made denser so real MOLA heights can lift it, and its sphere is tied to real latitude and longitude.

// Mars is slightly flattened: polar radius / equatorial radius. The NASA mesh itself has 497.06 / 500.
export const POLAR_RATIO = 0.99411;

// Found by matching known places in the model's texture: Olympus Mons sits at the texture seam and Syrtis Major and Hellas
// line up at their real longitudes. Longitude runs the opposite way round the model's vertical axis.
export const LON_OFFSET_DEGREES = 180.8;

const toRadians = degrees => degrees * Math.PI / 180;

// Radius, relative to the equatorial radius, of the flattened sphere in the direction of the unit vector (x, y, z).
export function ellipseRadius(x, y, z)
{
    return 1 / Math.sqrt(x * x + z * z + (y / POLAR_RATIO) ** 2);
}

// Unit vector, in the model's frame, pointing at a real latitude and east longitude on Mars.
export function directionOf(lat, lon)
{
    const modelLongitude = toRadians(LON_OFFSET_DEGREES - lon), latitude = toRadians(lat);
    return { x: Math.cos(latitude) * Math.cos(modelLongitude), y: Math.sin(latitude), z: Math.cos(latitude) * Math.sin(modelLongitude) };
}

// Inverse of directionOf: real latitude and east longitude (-180 to 180) of a direction in the model's frame.
export function latLonOf(x, y, z)
{
    const length = Math.hypot(x, y, z) || 1;
    let lon = LON_OFFSET_DEGREES - Math.atan2(z, x) * 180 / Math.PI;
    lon = ((lon + 180) % 360 + 360) % 360 - 180;
    return { lat: Math.asin(Math.max(-1, Math.min(1, y / length))) * 180 / Math.PI, lon };
}

// Splits every triangle into four, `passes` times. New points are pushed out onto the flattened sphere and take the average
// texture coordinate of the edge they split, which is exactly what linear interpolation across the old triangle gave.
export function subdivide(positions, uvs, indices, passes)
{
    let p = Float32Array.from(positions), t = Float32Array.from(uvs), triangles = Uint32Array.from(indices);

    for (let pass = 0; pass < passes; pass++)
    {
        const count = p.length / 3;
        const midpoints = new Map();
        const addedPositions = [], addedUvs = [];
        const next = new Uint32Array(triangles.length * 4);

        const middle = (a, b) =>
        {
            const key = a < b ? a * 4294967296 + b : b * 4294967296 + a;
            let found = midpoints.get(key);

            if (found === undefined)
            {
                const x = (p[a * 3] + p[b * 3]) / 2, y = (p[a * 3 + 1] + p[b * 3 + 1]) / 2, z = (p[a * 3 + 2] + p[b * 3 + 2]) / 2;
                const length = Math.hypot(x, y, z) || 1;
                const scale = ellipseRadius(x / length, y / length, z / length) / length;
                addedPositions.push(x * scale, y * scale, z * scale);
                addedUvs.push((t[a * 2] + t[b * 2]) / 2, (t[a * 2 + 1] + t[b * 2 + 1]) / 2);
                found = count + midpoints.size;
                midpoints.set(key, found);
            }

            return found;
        };

        for (let i = 0; i < triangles.length; i += 3)
        {
            const a = triangles[i], b = triangles[i + 1], c = triangles[i + 2];
            const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a);
            next.set([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca], i * 4);
        }

        const grownPositions = new Float32Array(p.length + addedPositions.length);
        grownPositions.set(p);
        grownPositions.set(addedPositions, p.length);
        const grownUvs = new Float32Array(t.length + addedUvs.length);
        grownUvs.set(t);
        grownUvs.set(addedUvs, t.length);
        p = grownPositions;
        t = grownUvs;
        triangles = next;
    }

    return { positions: p, uvs: t, indices: triangles };
}

// Groups vertices that sit at the same place (the texture seams duplicate them) so their normals can be averaged.
export function positionGroups(positions)
{
    const keys = new Map();
    const group = new Int32Array(positions.length / 3);

    for (let i = 0; i < group.length; i++)
    {
        const key = Math.round(positions[i * 3] * 1e5) + "," + Math.round(positions[i * 3 + 1] * 1e5) + "," + Math.round(positions[i * 3 + 2] * 1e5);
        let id = keys.get(key);

        if (id === undefined)
        {
            id = keys.size;
            keys.set(key, id);
        }

        group[i] = id;
    }

    return { group, count: keys.size };
}

// Reads the first mesh and its two images out of a binary glTF (.glb). No loader library is needed.
export function parseGlb(buffer)
{
    const view = new DataView(buffer);

    if (view.getUint32(0, true) !== 0x46546C67)
    {
        throw new Error("Not a glTF binary file.");
    }

    const jsonLength = view.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
    const binary = 20 + jsonLength + 8;
    const offsetOf = accessor => binary + (json.bufferViews[accessor.bufferView].byteOffset || 0) + (accessor.byteOffset || 0);
    const floats = index => { const a = json.accessors[index]; return new Float32Array(buffer.slice(offsetOf(a), offsetOf(a) + a.count * (a.type === "VEC3" ? 12 : 8))); };
    const primitive = json.meshes[0].primitives[0];
    const indexAccessor = json.accessors[primitive.indices];
    const indexStart = offsetOf(indexAccessor);
    const indices = indexAccessor.componentType === 5125
        ? new Uint32Array(buffer.slice(indexStart, indexStart + indexAccessor.count * 4))
        : Uint32Array.from(new Uint16Array(buffer.slice(indexStart, indexStart + indexAccessor.count * 2)));
    const material = json.materials[primitive.material];
    const imageBytes = textureIndex =>
    {
        const image = json.images[json.textures[textureIndex].source];
        const view2 = json.bufferViews[image.bufferView];
        return { bytes: new Uint8Array(buffer, binary + (view2.byteOffset || 0), view2.byteLength), type: image.mimeType };
    };

    return {
        positions: floats(primitive.attributes.POSITION),
        uvs: floats(primitive.attributes.TEXCOORD_0),
        indices,
        diffuse: imageBytes(material.pbrMetallicRoughness.baseColorTexture.index),
        normal: imageBytes(material.normalTexture.index)
    };
}
