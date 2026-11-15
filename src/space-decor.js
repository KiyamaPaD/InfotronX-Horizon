// Faded deep-space backdrop for the 3D terrain view: stars, distant planets, shooting stars, satellites and a rocket.
// Purely decorative; sizes are in units of the little planet's radius so it works at any map scale.
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

function bands(THREE, colours, spot)
{
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    const height = 128 / colours.length;
    colours.forEach((colour, index) => { context.fillStyle = colour; context.fillRect(0, index * height, 256, height + 1); });
    context.globalAlpha = 0.25;
    for (let i = 0; i < 40; i++) { context.fillStyle = i % 2 ? "#ffffff" : "#000000"; context.fillRect(0, Math.random() * 128, 256, 1 + Math.random() * 3); }
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

function earthTexture(THREE)
{
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 128;
    const context = canvas.getContext("2d");
    context.fillStyle = "#1c4f9c";
    context.fillRect(0, 0, 256, 128);
    context.fillStyle = "#3f7d4a";

    for (let i = 0; i < 26; i++)
    {
        context.beginPath();
        context.ellipse(Math.random() * 256, 20 + Math.random() * 88, 8 + Math.random() * 22, 5 + Math.random() * 12, Math.random() * 3, 0, Math.PI * 2);
        context.fill();
    }

    context.fillStyle = "rgba(255,255,255,.7)";

    for (let i = 0; i < 40; i++)
    {
        context.beginPath();
        context.ellipse(Math.random() * 256, Math.random() * 128, 6 + Math.random() * 18, 2 + Math.random() * 4, 0, 0, Math.PI * 2);
        context.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}

export function addSpaceDecor(THREE, scene, { radius, center, reduced = false, fade = 0.5 })
{
    const glowTexture = glow(THREE, [[0, "rgba(255,255,255,1)"], [0.4, "rgba(255,255,255,.35)"], [1, "rgba(255,255,255,0)"]]);
    const sprite = (colour, size, opacity = 1) =>
    {
        const item = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture, color: colour, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity, fog: false }));
        item.scale.setScalar(size);
        return item;
    };

    // Stars on a far sphere, plus a few very soft colour clouds.
    const starCount = 2200;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++)
    {
        const theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1), distance = radius * 13;
        positions.set([distance * Math.sin(phi) * Math.cos(theta), distance * Math.cos(phi), distance * Math.sin(phi) * Math.sin(theta)], i * 3);
    }

    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xdfe8ff, size: radius * 0.035, sizeAttenuation: true, transparent: true, opacity: 0.9 * fade, depthWrite: false, fog: false }));
    scene.add(stars);

    for (const [colour, x, y, z] of [[0x5a4a9a, -8, 5, -9], [0x2a6a8a, 9, -3, -8], [0x9a4a3a, 2, 7, 9]])
    {
        const cloud = sprite(colour, radius * 12, 0.07 * fade * 2);
        cloud.position.set(x * radius, y * radius, z * radius);
        scene.add(cloud);
    }

    // Distant planets, each turning slowly.
    const planetMaterial = map => new THREE.MeshStandardMaterial({ map, roughness: 1, transparent: true, opacity: Math.min(1, fade + 0.15), fog: false });
    const planets = [];
    const addPlanet = (size, direction, distance, material, spin) =>
    {
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius * size, 48, 32), material);
        mesh.position.set(...direction).normalize().multiplyScalar(radius * distance);
        scene.add(mesh);
        planets.push({ mesh, spin, home: mesh.position.clone() });
        return mesh;
    };
    addPlanet(0.34, [-0.8, 0.45, -0.5], 9, planetMaterial(earthTexture(THREE)), 0.05);
    addPlanet(0.8, [0.7, 0.4, -0.9], 11, planetMaterial(bands(THREE, ["#c9a679", "#e8d5b0", "#a8774a", "#d9b98a", "#8f6240", "#e2c89e", "#b88a5c"], "#b5502e")), 0.03);
    addPlanet(0.2, [0.9, -0.2, 0.6], 8, planetMaterial(bands(THREE, ["#e4cf9a", "#d6bd82", "#ead9a8"])), 0.02);
    addPlanet(0.12, [-0.5, -0.3, 0.9], 7, planetMaterial(bands(THREE, ["#8a8580", "#9a948d", "#777"])), 0.02);
    const saturn = addPlanet(0.6, [0.2, 0.75, 0.75], 12, planetMaterial(bands(THREE, ["#d8c08a", "#e8d9a8", "#c9ad78", "#dcc796"])), 0.03);
    const ringCanvas = document.createElement("canvas");
    ringCanvas.width = 256;
    ringCanvas.height = 4;
    const ringContext = ringCanvas.getContext("2d");
    const ringGradient = ringContext.createLinearGradient(0, 0, 256, 0);
    [[0, "rgba(220,200,160,0)"], [0.18, "rgba(220,200,160,.8)"], [0.45, "rgba(180,160,120,.35)"], [0.55, "rgba(210,190,150,.8)"], [0.9, "rgba(210,190,150,.5)"], [1, "rgba(210,190,150,0)"]].forEach(([at, colour]) => ringGradient.addColorStop(at, colour));
    ringContext.fillStyle = ringGradient;
    ringContext.fillRect(0, 0, 256, 4);
    const ringGeometry = new THREE.RingGeometry(radius * 0.85, radius * 1.5, 96);
    const ringPositions = ringGeometry.attributes.position, ringUv = ringGeometry.attributes.uv, ringVector = new THREE.Vector3();

    for (let i = 0; i < ringPositions.count; i++)
    {
        ringVector.fromBufferAttribute(ringPositions, i);
        ringUv.setXY(i, (ringVector.length() - radius * 0.85) / (radius * 0.65), 0.5);
    }

    const saturnRing = new THREE.Mesh(ringGeometry, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ringCanvas), transparent: true, opacity: fade + 0.1, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    saturnRing.rotation.x = Math.PI / 2 - 0.45;
    saturn.add(saturnRing);

    // Shooting stars.
    const meteors = Array.from({ length: 3 }, () =>
    {
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe9d0, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
        line.frustumCulled = false;
        scene.add(line);
        return { line, geometry, life: 0, wait: 1 + Math.random() * 5, start: new THREE.Vector3(), direction: new THREE.Vector3() };
    });

    // Satellites circling the little planet, with blinking lights.
    const makeSatellite = (size, blinkColour) =>
    {
        const group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.035, 0.07), new THREE.MeshStandardMaterial({ color: 0xd8c690, metalness: 0.7, roughness: 0.35, transparent: true, opacity: fade + 0.3 })));

        for (const side of [-1, 1])
        {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.004, 0.05), new THREE.MeshStandardMaterial({ color: 0x2e4f86, metalness: 0.8, roughness: 0.3, transparent: true, opacity: fade + 0.3 }));
            panel.position.x = side * 0.095;
            group.add(panel);
        }

        const light = sprite(blinkColour, 0.18);
        light.position.y = 0.05;
        group.add(light);
        group.scale.setScalar(size);
        group.userData.light = light;
        return group;
    };
    const orbits = [];
    const addOrbit = (orbitRadius, tilt, count, size, speed, colour) =>
    {
        const holder = new THREE.Group();
        holder.position.copy(center);
        holder.rotation.set(tilt, 0, tilt * 0.4);
        const points = Array.from({ length: 160 }, (_, i) => new THREE.Vector3(Math.cos(i / 160 * Math.PI * 2) * orbitRadius, 0, Math.sin(i / 160 * Math.PI * 2) * orbitRadius));
        holder.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(points), new THREE.LineBasicMaterial({ color: 0xffb890, transparent: true, opacity: 0.12 * fade * 2 })));
        const satellites = Array.from({ length: count }, (_, index) =>
        {
            const satellite = makeSatellite(size, colour);
            const angle = index / count * Math.PI * 2;
            satellite.position.set(Math.cos(angle) * orbitRadius, 0, Math.sin(angle) * orbitRadius);
            holder.add(satellite);
            return satellite;
        });
        scene.add(holder);
        orbits.push({ holder, satellites, speed });
    };
    addOrbit(radius * 1.3, 0.55, 5, radius * 0.04, 0.09, 0xff7a5c);
    addOrbit(radius * 1.7, -0.4, 1, radius * 0.08, 0.05, 0x75d1c8);
    addOrbit(radius * 1.5, 1.2, 2, radius * 0.03, 0.13, 0xffd27a);

    // A rocket crossing the backdrop now and then.
    const rocket = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: 0xf1f1f1, metalness: 0.3, roughness: 0.35, transparent: true, opacity: fade + 0.3 });
    rocket.add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 16).rotateX(Math.PI / 2), white));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.13, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd2463a, roughness: 0.4, transparent: true, opacity: fade + 0.3 }));
    nose.position.z = 0.235;
    rocket.add(nose);
    const flame = sprite(0xffa050, 0.34);
    flame.position.z = -0.3;
    rocket.add(flame);
    rocket.scale.setScalar(radius * 0.22);
    rocket.visible = false;
    scene.add(rocket);
    const trail = Array.from({ length: 30 }, () => { const item = sprite(0xffb070, 0.1, 0); item.visible = false; scene.add(item); return { item, life: 0 }; });
    const flight = { t: -1, wait: 3, emitted: 0, next: 0 };
    const flightPoint = (t, target) =>
    {
        const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
        return target.set(-3.4 * a - 0.2 * b + 3 * c, -0.3 * a - 1.5 * b + 1.1 * c, -1.8 * a + 1.6 * b + 0.8 * c).multiplyScalar(radius).add(center);
    };
    const ahead = new THREE.Vector3();
    let previous = 0;

    return {
        update(now)
        {
            const delta = Math.min(0.05, (now - previous) / 1000);
            previous = now;
            if (reduced) return;
            const time = now / 1000;
            stars.rotation.y = time * 0.004;

            for (const planet of planets)
            {
                planet.mesh.rotation.y += planet.spin * delta;
            }

            for (const orbit of orbits)
            {
                orbit.holder.rotation.y = time * orbit.speed;
                orbit.satellites.forEach((satellite, index) => { satellite.userData.light.material.opacity = 0.2 + 0.8 * Math.max(0, Math.sin(time * 4 + index * 1.7)) * fade * 2; });
            }

            for (const meteor of meteors)
            {
                if (meteor.life <= 0)
                {
                    meteor.wait -= delta;
                    if (meteor.wait > 0) continue;
                    meteor.start.set((Math.random() - 0.5) * 16, 3 + Math.random() * 5, -8 - Math.random() * 4).multiplyScalar(radius).add(center);
                    meteor.direction.set(-(0.8 + Math.random() * 0.5), -(0.25 + Math.random() * 0.2), 0.2).multiplyScalar(radius * 6);
                    meteor.life = 1;
                    meteor.wait = 3 + Math.random() * 6;
                    continue;
                }

                meteor.life -= delta * 1.2;
                const head = meteor.start.clone().addScaledVector(meteor.direction, 1 - Math.max(0, meteor.life));
                const tail = head.clone().addScaledVector(meteor.direction, -0.2);
                meteor.geometry.attributes.position.setXYZ(0, head.x, head.y, head.z);
                meteor.geometry.attributes.position.setXYZ(1, tail.x, tail.y, tail.z);
                meteor.geometry.attributes.position.needsUpdate = true;
                meteor.line.material.opacity = Math.max(0, Math.sin(Math.max(0, meteor.life) * Math.PI)) * fade * 1.4;
            }

            if (flight.t < 0)
            {
                flight.wait -= delta;

                if (flight.wait <= 0)
                {
                    flight.t = 0;
                    rocket.visible = true;
                }
            }
            else
            {
                flight.t += delta / 18;
                flightPoint(flight.t, rocket.position);
                rocket.lookAt(flightPoint(Math.min(1, flight.t + 0.012), ahead));
                flame.scale.setScalar(0.3 + Math.random() * 0.1);
                flight.emitted += delta;

                if (flight.emitted > 0.08)
                {
                    flight.emitted = 0;
                    const puff = trail[flight.next++ % trail.length];
                    puff.item.position.copy(rocket.position).addScaledVector(ahead.sub(rocket.position).normalize(), -radius * 0.07);
                    puff.life = 1;
                    puff.item.visible = true;
                }

                if (flight.t >= 1)
                {
                    flight.t = -1;
                    flight.wait = 8 + Math.random() * 8;
                    rocket.visible = false;
                }
            }

            for (const puff of trail)
            {
                if (puff.life <= 0) continue;
                puff.life -= delta * 0.7;
                puff.item.material.opacity = Math.max(0, puff.life) * 0.4 * fade * 2;
                puff.item.scale.setScalar(radius * (0.03 + (1 - puff.life) * 0.12));
                if (puff.life <= 0) puff.item.visible = false;
            }
        }
    };
}
