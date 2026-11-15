// Keeps the 3D views smooth on modest computers: a quick check at start, and a watchdog that turns effects down
// if frames stay slow. Decoration is dropped first; the map, route and terrain always stay.
export function lowPower()
{
    const memory = navigator.deviceMemory || 8;
    const cores = navigator.hardwareConcurrency || 8;
    return memory <= 4 || cores <= 4 || matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Calls onDowngrade(level) when more than half of the last `frames` frames took longer than `limitMs`. Levels 1 and 2.
export function createGovernor(onDowngrade, { limitMs = 36, frames = 90 } = {})
{
    let last = 0, slow = 0, count = 0, level = 0;

    return {
        get level() { return level; },
        tick(now)
        {
            const delta = now - last;
            last = now;

            if (delta <= 0 || delta > 1000) return;

            count++;
            if (delta > limitMs) slow++;

            if (count >= frames)
            {
                const mostlySlow = slow / count > 0.5;
                count = 0;
                slow = 0;
                if (mostlySlow && level < 2) onDowngrade(++level);
            }
        }
    };
}
