// Keep controls mounted so folding a panel never loses unsaved inputs or listeners.
export function mountWorkspaceDisclosures(root)
{
    const targets = [
        ...root.querySelectorAll('.sidebar-left .panel-section:has(.panel-title-row)'),
        ...root.querySelectorAll('.bottom-area')
    ];

    for (const [index, section] of targets.entries())
    {
        const header = section.querySelector('.panel-title-row, .bottom-section-header');
        const label = header?.querySelector('.section-label');
        if (!header || !label) continue;
        const title = label.textContent.trim();
        const body = document.createElement('div');
        body.id = 'workspace-panel-body-' + index;
        body.className = 'workspace-panel-body';
        for (const child of [...section.children])
        {
            if (child !== header) body.append(child);
        }
        section.append(body);
        section.classList.add('workspace-disclosure');
        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'workspace-panel-toggle';
        toggle.textContent = title;
        toggle.setAttribute('aria-controls', body.id);
        label.replaceWith(toggle);
        let expanded = title !== 'MAP DATA';
        function render()
        {
            body.hidden = !expanded;
            toggle.setAttribute('aria-expanded', String(expanded));
            section.classList.toggle('workspace-folded', !expanded);
            window.dispatchEvent(new Event('resize'));
        }
        toggle.addEventListener('click', () => { expanded = !expanded; render(); });
        render();
    }
}
