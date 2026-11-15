// Cards lean a few degrees toward the pointer. Skipped for touch screens and reduced motion.
const TARGETS = ".metric-card, .layer-btn, .route-item, .home-card, .home-stat";
const MAX_DEGREES = 6;

export function enableCardTilt()
{
    if (matchMedia("(prefers-reduced-motion: reduce), (pointer: coarse)").matches)
    {
        return;
    }

    document.addEventListener("pointermove", event =>
    {
        const card = event.target.closest?.(TARGETS);

        if (!card)
        {
            return;
        }

        const box = card.getBoundingClientRect();
        const x = (event.clientX - box.left) / box.width - 0.5;
        const y = (event.clientY - box.top) / box.height - 0.5;
        card.style.setProperty("--ry", (x * MAX_DEGREES * 2).toFixed(2) + "deg");
        card.style.setProperty("--rx", (-y * MAX_DEGREES * 2).toFixed(2) + "deg");
    });

    document.addEventListener("pointerout", event =>
    {
        const card = event.target.closest?.(TARGETS);

        if (card && !card.contains(event.relatedTarget))
        {
            card.style.removeProperty("--rx");
            card.style.removeProperty("--ry");
        }
    });
}
