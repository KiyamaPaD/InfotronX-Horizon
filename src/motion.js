// Small, interruptible motion helpers. Every animation ends on the exact final value and is skipped for reduced motion.
export function prefersReducedMotion()
{
    return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function easeOutCubic(t)
{
    return 1 - Math.pow(1 - t, 3);
}

// Animates a number shown in `element` from its previous value to `value`, formatting every frame.
export function animateNumber(element, value, format, duration = 650)
{
    const previous = Number(element.dataset.motionValue);
    element.dataset.motionValue = String(value);

    if (!Number.isFinite(previous) || previous === value || prefersReducedMotion() || typeof requestAnimationFrame !== "function")
    {
        element.textContent = format(value);
        return;
    }

    const start = performance.now();
    const token = String(start);
    element.dataset.motionToken = token;

    const step = now =>
    {
        if (element.dataset.motionToken !== token)
        {
            return;
        }

        const t = Math.min(1, (now - start) / duration);
        element.textContent = format(t < 1 ? previous + (value - previous) * easeOutCubic(t) : value);

        if (t < 1)
        {
            requestAnimationFrame(step);
        }
    };

    requestAnimationFrame(step);
}
