// The far background of the welcome screen: the Milky Way as seen from inside it, the Andromeda galaxy, distant nebulae,
// comets, the asteroid belt and every planet of the solar system. It is decoration, drawn small and faded; sizes and distances
// are not to scale and positions are not real.
const SOLAR_SYSTEM = [
    { name: "Mercury", size: 0.16, colours: ["#9a948d", "#777", "#b0aaa2"], distance: 14, angle: 0.2 },
    { name: "Venus", size: 0.3, colours: ["#e4cf9a", "#d6bd82", "#ead9a8"], distance: 17, angle: 1.1 },
    { name: "Earth", size: 0.34, colours: ["#1c4f9c", "#3f7d4a", "#e8f0ff", "#1c4f9c"], distance: 20, angle: 2.0, moon: true },
    { name: "Jupiter", size: 1.2, colours: ["#c9a679", "#e8d5b0", "#a8774a", "#d9b98a", "#8f6240", "#e2c89e", "#b88a5c"], distance: 30, angle: 3.2, spot: "#b5502e" },
    { name: "Saturn", size: 1.0, colours: ["#d8c08a", "#e8d9a8", "#c9ad78", "#dcc796"], distance: 38, angle: 4.0, ring: true },
    { name: "Uranus", size: 0.55, colours: ["#9ed8e0", "#8fcfd8", "#a8e0e8"], distance: 46, angle: 5.0 },
    { name: "Neptune", size: 0.52, colours: ["#3a5fcd", "#2f4fb8", "#4a6fe0"], distance: 53, angle: 5.8 }
];

function glow(THREE, stops)
{
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 128;
    const context = canvas.getContext("2d");
    const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(([at, colour]) => gradient.addColorStop(at, colour));
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(canvas);
}

function bandedTexture(THREE, colours, spot)
{
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    const height = 128 / colours.length;
    colours.forEach((colour, index) => { context.fillStyle = colour; context.fillRect(0, index * height, 256, height + 1); });
    context.globalAlpha = 0.22;
    for (let i = 0; i < 40; i++) { context.fillStyle = i % 2 ? "#fff" : "#000"; context.fillRect(0, Math.random() * 128, 256, 1 + Math.random() * 3); }
    context.globalAlpha = 1;

    if (spot)
    {
        context.fillStyle = spot;
        context.beginPath();
        context.ellipse(170, 84, 16, 9, 0, 0, Math.PI * 2);
        context.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

// A band of countless stars with dark dust lanes, drawn on the inside of a huge sphere.
function milkyWayTexture(THREE)
{
    const width = 1024, height = 512;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    context.fillStyle = "#04060c";
    context.fillRect(0, 0, width, height);
    const band = context.createLinearGradient(0, height * 0.25, 0, height * 0.75);
    band.addColorStop(0, "rgba(150,160,210,0)");
    band.addColorStop(0.5, "rgba(190,185,215,.38)");
    band.addColorStop(1, "rgba(150,160,210,0)");
    context.fillStyle = band;
    context.fillRect(0, 0, width, height);

    for (let i = 0; i < 9000; i++)
    {
        const x = Math.random() * width;
        const y = height / 2 + (Math.random() + Math.random() + Math.random() - 1.5) * height * 0.2;
        context.fillStyle = `rgba(${210 + Math.random() * 45},${200 + Math.random() * 45},${190 + Math.random() * 60},${0.15 + Math.random() * 0.6})`;
        context.fillRect(x, y, 1 + Math.random() * 1.4, 1 + Math.random() * 1.4);
    }

    // The glowing centre of the galaxy.
    const core = context.createRadialGradient(width * 0.5, height / 2, 0, width * 0.5, height / 2, width * 0.18);
    core.addColorStop(0, "rgba(255,225,180,.6)");
    core.addColorStop(1, "rgba(255,200,150,0)");
    context.fillStyle = core;
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-out";

    for (let i = 0; i < 26; i++)
    {
        const x = Math.random() * width, y = height / 2 + (Math.random() - 0.5) * height * 0.14;
        const lane = context.createRadialGradient(x, y, 0, x, y, 26 + Math.random() * 50);
        lane.addColorStop(0, "rgba(0,0,0,.5)");
        lane.addColorStop(1, "rgba(0,0,0,0)");
        context.fillStyle = lane;
        context.fillRect(x - 90, y - 90, 180, 180);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function addDeepSpace(THREE, scene, { reduced = false, light = false } = {})
{
    const root = new THREE.Group();
    scene.add(root);
    const faded = 0.8;

    // The planets, from Mercury to Neptune, in a loose line far behind Mars, each turning slowly.
    const planets = [];
    SOLAR_SYSTEM.forEach(planet =>
    {
        const texture = bandedTexture(THREE, planet.colours, planet.spot);
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(planet.size, 32, 20), new THREE.MeshStandardMaterial({ map: texture, roughness: 1, transparent: true, opacity: 0.8, fog: false }));
        const angle = planet.angle;
        mesh.position.set(Math.cos(angle) * planet.distance * 0.9 - 10, Math.sin(angle * 1.7) * 6, -Math.abs(Math.sin(angle)) * planet.distance - 14);
        root.add(mesh);
        planets.push(mesh);

        if (planet.ring)
        {
            const ring = new THREE.Mesh(new THREE.RingGeometry(planet.size * 1.3, planet.size * 2.2, 64), new THREE.MeshBasicMaterial({ color: 0xcdb98a, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false }));
            ring.rotation.x = Math.PI / 2 - 0.45;
            mesh.add(ring);
        }

        if (planet.moon)
        {
            const moon = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshStandardMaterial({ color: 0xaaa6a0, roughness: 1 }));
            moon.position.set(0.7, 0.1, 0);
            mesh.add(moon);
        }
    });

    // The asteroid belt between Mars and Jupiter, and the Kuiper belt far out.
    const belt = (count, inner, outer, size, colour, tilt) =>
    {
        const positions = new Float32Array(count * 3);

        for (let i = 0; i < count; i++)
        {
            const angle = Math.random() * Math.PI * 2, radius = inner + Math.random() * (outer - inner);
            positions.set([Math.cos(angle) * radius, (Math.random() - 0.5) * 1.6, Math.sin(angle) * radius], i * 3);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const points = new THREE.Points(geometry, new THREE.PointsMaterial({ color: colour, size, transparent: true, opacity: 0.7, depthWrite: false, fog: false }));
        points.position.set(-8, -3, -46);
        points.rotation.x = tilt;
        root.add(points);
        return points;
    };
    const asteroids = belt(light ? 700 : 1800, 22, 29, 0.07, 0xb7a58a, 0.5);
    const kuiper = belt(light ? 500 : 1200, 60, 80, 0.09, 0x9fb4c8, 0.45);

    // Comets with long tails crossing far from Mars, and a few asteroids tumbling past.
    const glowTexture = glow(THREE, [[0, "rgba(255,255,255,1)"], [0.3, "rgba(190,225,255,.5)"], [1, "rgba(190,225,255,0)"]]);
    const comets = Array.from({ length: 2 }, (_, index) =>
    {
        const head = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.9, fog: false }));
        head.scale.setScalar(0.9);
        const tail = Array.from({ length: 26 }, () => { const piece = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: 0xa8d8ff, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0, fog: false })); root.add(piece); return piece; });
        root.add(head);
        return { head, tail, phase: index * 0.5, speed: 0.012 + index * 0.006 };
    });
    const rocks = Array.from({ length: light ? 3 : 7 }, (_, index) =>
    {
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22 + Math.random() * 0.25, 1), new THREE.MeshStandardMaterial({ color: 0x8b7b6c, roughness: 1, flatShading: true, transparent: true, opacity: 0.8, fog: false }));
        rock.userData = { offset: index / 7, lane: -18 - index * 4, height: (Math.random() - 0.5) * 12, spin: 0.2 + Math.random() * 0.6 };
        root.add(rock);
        return rock;
    });

    return {
        setVisible(visible) { root.visible = visible; },
        update(now)
        {
            if (reduced || !root.visible) return;

            const time = now / 1000;
            planets.forEach((planet, index) => { planet.rotation.y = time * (0.05 + index * 0.01); });
            asteroids.rotation.y = time * 0.01;
            kuiper.rotation.y = time * 0.004;

            for (const comet of comets)
            {
                const u = (time * comet.speed + comet.phase) % 1;
                const x = -90 + u * 180, y = 24 - u * 34, z = -70 - Math.sin(u * Math.PI) * 12;
                comet.head.position.set(x, y, z);

                comet.tail.forEach((piece, index) =>
                {
                    const back = (index + 1) * 1.7;
                    piece.position.set(x - back * 0.9, y + back * 0.35, z);
                    piece.scale.setScalar(Math.max(0.2, 0.9 - index * 0.03));
                    piece.material.opacity = Math.max(0, 0.5 - index * 0.02) * Math.sin(u * Math.PI);
                });
                comet.head.material.opacity = 0.9 * Math.sin(u * Math.PI);
            }

            for (const rock of rocks)
            {
                const u = (time * 0.01 + rock.userData.offset) % 1;
                rock.position.set(70 - u * 140, rock.userData.height, rock.userData.lane);
                rock.rotation.x = time * rock.userData.spin;
                rock.rotation.y = time * rock.userData.spin * 0.7;
            }
        }
    };
}
