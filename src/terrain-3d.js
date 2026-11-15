import { gridCellForPoint, sampleElevation } from "./terrain.js";
import { marsDistance } from "./geo.js";

export function buildTerrainMesh(dem)
{
    if (!dem || !Number.isInteger(dem.width) || !Number.isInteger(dem.height) ||
        dem.elevations?.length !== dem.width * dem.height || dem.width * dem.height > 60000)
    {
        throw new Error("A validated numeric DEM is required for the 3D surface.");
    }

    const valid = dem.elevations.filter(Number.isFinite);

    if (!valid.length)
    {
        throw new Error("Numeric terrain contains no valid elevation samples.");
    }

    const min = Math.min(...valid);
    const max = Math.max(...valid);
    const spread = Math.max(1, max - min);
    const widthMeters = marsDistance({ lat: dem.north, lon: dem.west },
        { lat: dem.north, lon: dem.west + (dem.width - 1) * dem.lonStep });
    const heightMeters = marsDistance({ lat: dem.north, lon: dem.west },
        { lat: dem.north - (dem.height - 1) * dem.latStep, lon: dem.west });
    const scaleMeters = Math.max(1, widthMeters, heightMeters);
    const normalized = new Float32Array(dem.width * dem.height * 6);
    const indices = [];

    for (let row = 0; row < dem.height; row++)
    {
        for (let column = 0; column < dem.width; column++)
        {
            const id = row * dem.width + column;
            const elevation = dem.elevations[id];
            const height = elevation === null ? 0 : elevation - (min + max) / 2;
            const level = elevation === null ? 0 : (elevation - min) / spread;
            const base = id * 6;

            normalized[base] = (column / (dem.width - 1) - 0.5) * widthMeters / scaleMeters * 1.7;
            normalized[base + 1] = height / scaleMeters * 1.7;
            normalized[base + 2] = (0.5 - row / (dem.height - 1)) * heightMeters / scaleMeters * 1.7;
            normalized[base + 3] = 0.30 + level * 0.38;
            normalized[base + 4] = 0.36 + level * 0.28;
            normalized[base + 5] = 0.43 + level * 0.24;

            if (row === dem.height - 1 || column === dem.width - 1)
            {
                continue;
            }

            const a = id;
            const b = a + 1;
            const c = a + dem.width;
            const d = c + 1;
            const usable = index => dem.elevations[index] !== null;

            if (usable(a) && usable(b) && usable(c))
            {
                indices.push(a, b, c);
            }

            if (usable(b) && usable(c) && usable(d))
            {
                indices.push(b, d, c);
            }
        }
    }

    return {
        vertexData: normalized,
        triangles: new Uint16Array(indices),
        widthMeters,
        heightMeters,
        minElevation: min,
        maxElevation: max,
        cellCount: valid.length,
        triangleCount: indices.length / 3,
        scaleMeters,
        width: dem.width,
        height: dem.height,
        source: dem.source
    };
}

export function terrainPointMarkers(dem, mesh, points = [])
{
    const result = [];

    for (const point of points)
    {
        const cell = gridCellForPoint(dem, point);

        if (!cell || sampleElevation(dem, point) === null)
        {
            continue;
        }

        const id = (cell.row * dem.width + cell.column) * 6;
        result.push(mesh.vertexData[id], mesh.vertexData[id + 1] + 0.002,
            mesh.vertexData[id + 2], 1, 0.70, 0.34);
    }

    return new Float32Array(result);
}

function compile(gl, type, source)
{
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
    {
        const reason = gl.getShaderInfoLog(shader) || "Shader compilation failed";
        gl.deleteShader(shader);
        throw new Error(reason);
    }

    return shader;
}

export function createTerrainRenderer(canvas)
{
    const gl = canvas.getContext("webgl", { antialias: true, alpha: false, preserveDrawingBuffer: false });

    if (!gl)
    {
        return null;
    }

    const vertex = compile(gl, gl.VERTEX_SHADER, `
        attribute vec3 aPosition;
        attribute vec3 aColor;
        varying vec3 vColor;
        uniform float uYaw;
        uniform float uPitch;
        uniform float uRelief;
        uniform float uZoom;
        uniform float uPointSize;

        void main()
        {
            vec3 position = vec3(aPosition.x, aPosition.y * uRelief, aPosition.z);
            float x = cos(uYaw) * position.x + sin(uYaw) * position.z;
            float z = -sin(uYaw) * position.x + cos(uYaw) * position.z;
            float y = cos(uPitch) * position.y + sin(uPitch) * z;
            float depth = sin(uPitch) * position.y - cos(uPitch) * z;
            gl_Position = vec4(x * uZoom, y * uZoom, depth * 0.21, 1.0);
            gl_PointSize = uPointSize;
            vColor = aColor;
        }`);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, `
        precision mediump float;
        varying vec3 vColor;
        void main() { gl_FragColor = vec4(vColor, 1.0); }`);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS))
    {
        throw new Error("Cannot link the terrain renderer.");
    }

    const attributes = {
        position: gl.getAttribLocation(program, "aPosition"),
        color: gl.getAttribLocation(program, "aColor")
    };
    const uniforms = {
        yaw: gl.getUniformLocation(program, "uYaw"),
        pitch: gl.getUniformLocation(program, "uPitch"),
        relief: gl.getUniformLocation(program, "uRelief"),
        zoom: gl.getUniformLocation(program, "uZoom"),
        pointSize: gl.getUniformLocation(program, "uPointSize")
    };
    const vertexBuffer = gl.createBuffer();
    const indexBuffer = gl.createBuffer();
    let vertices = 0;
    let indices = 0;
    let markers = new Float32Array();

    function render({ yaw = 0.55, pitch = 0.65, relief = 7, zoom = 0.90 } = {})
    {
        if (!indices || gl.isContextLost())
        {
            return;
        }

        const pixelRatio = Math.min(2, window.devicePixelRatio || 1);
        const targetWidth = Math.min(2048, Math.max(1, Math.round(canvas.clientWidth * pixelRatio)));
        const targetHeight = Math.min(1400, Math.max(1, Math.round(canvas.clientHeight * pixelRatio)));

        if (canvas.width !== targetWidth || canvas.height !== targetHeight)
        {
            canvas.width = targetWidth;
            canvas.height = targetHeight;
        }

        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clearColor(0.045, 0.087, 0.13, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.enable(gl.DEPTH_TEST);
        gl.useProgram(program);
        gl.uniform1f(uniforms.yaw, yaw);
        gl.uniform1f(uniforms.pitch, pitch);
        gl.uniform1f(uniforms.relief, relief);
        gl.uniform1f(uniforms.zoom, zoom);
        gl.uniform1f(uniforms.pointSize, 7);
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.vertexAttribPointer(attributes.position, 3, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(attributes.color, 3, gl.FLOAT, false, 24, 12);
        gl.enableVertexAttribArray(attributes.position);
        gl.enableVertexAttribArray(attributes.color);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.drawElements(gl.TRIANGLES, indices, gl.UNSIGNED_SHORT, 0);

        if (markers.length)
        {
            gl.disable(gl.DEPTH_TEST);
            gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
            gl.bufferData(gl.ARRAY_BUFFER, markers, gl.DYNAMIC_DRAW);
            gl.drawArrays(gl.POINTS, 0, markers.length / 6);
            gl.enable(gl.DEPTH_TEST);
            gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        }
    }

    function setTerrain(mesh, pointData = new Float32Array())
    {
        vertices = mesh.vertexData;
        markers = pointData;
        indices = mesh.triangles.length;
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.triangles, gl.STATIC_DRAW);
    }

    function dispose()
    {
        gl.deleteBuffer(vertexBuffer);
        gl.deleteBuffer(indexBuffer);
        gl.deleteProgram(program);
        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
    }

    return { setTerrain, render, dispose };
}
