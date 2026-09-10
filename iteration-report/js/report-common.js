// ============================================================
// Shared logic for the Design Iteration and Signal Strength Report
// - Builds the constant header/title/nav on every page (with a
//   gold rule line above AND below the title block)
// - Renders flexible content blocks: page-title, heading, text,
//   image, image-text, and 3D "viewer" blocks (reuses CADViewer
//   from cad_viewer.js, which must be loaded BEFORE this file).
// ============================================================

const REPORT_PAGES = [
    { id: 'purpose', label: 'Purpose and Data Analysis', href: 'index.html' },
    { id: 'combined', label: 'Combined Assembly and Video', href: 'combined-assembly-and-video.html' },
    { id: 'individual', label: 'Individual Part Iteration', href: 'individual-part-iteration.html' },
    { id: 'logic', label: 'Logic and Code Debugging', href: 'logic-and-code-debugging.html' }
];

function renderReportHeader(activeId) {
    const header = document.getElementById('site-header');
    if (!header) return;

    const navHtml = REPORT_PAGES.map(p => {
        const activeClass = p.id === activeId ? ' active' : '';
        return `<a class="report-nav-btn${activeClass}" href="${p.href}">${p.label}</a>`;
    }).join('');

    header.innerHTML = `
        <div class="report-title-rule"></div>
        <h1 class="report-title">Design Iteration and Signal Strength Report</h1>
        <p class="report-subtitle">Autonomous Pan-Tilt Tracking System by Amay Advani</p>
        <div class="report-title-rule-bottom"></div>
        <nav class="report-nav">${navHtml}</nav>
    `;
}

// blocks: array of objects, each one of:
//   { type: 'page-title', text: '...' }              -> plain centered title, NOT a card (use once, matching the nav button label)
//   { type: 'heading', text: '...' }                  -> sub-section heading, shown inside a card
//   { type: 'text', html: '<p>...</p>' }
//   { type: 'image', src, caption, align: 'full' (optional) }
//   { type: 'image-text', src, caption, text: '<p>...</p>', imageSide: 'left'|'right' }
//   { type: 'viewer', stlPath, label, colorSeed }
function renderReportContent(rootId, blocks) {
    const root = document.getElementById(rootId);
    if (!root) return;
    root.innerHTML = '';

    blocks.forEach((block, idx) => {

        if (block.type === 'page-title') {
            const titleEl = document.createElement('h2');
            titleEl.className = 'report-page-title';
            titleEl.textContent = block.text;
            root.appendChild(titleEl);
            return;
        }

        const section = document.createElement('section');
        section.className = 'report-block report-block-' + block.type;

        if (block.type === 'heading') {
            section.innerHTML = `<h2>${block.text}</h2>`;
            root.appendChild(section);

        } else if (block.type === 'text') {
            section.innerHTML = block.html;
            root.appendChild(section);

        } else if (block.type === 'image') {
            section.innerHTML = `
                <figure class="report-figure ${block.align || ''}">
                    <img src="${block.src}" alt="${block.caption || ''}">
                    ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                </figure>`;
            root.appendChild(section);

        } else if (block.type === 'image-text') {
            const sideClass = block.imageSide === 'right' ? 'image-right' : 'image-left';
            section.innerHTML = `
                <div class="report-split ${sideClass}">
                    <figure class="report-figure">
                        <img src="${block.src}" alt="${block.caption || ''}">
                        ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                    </figure>
                    <div class="report-split-text">${block.text}</div>
                </div>`;
            root.appendChild(section);

        } else if (block.type === 'viewer') {
            const viewerId = `report-viewer-${idx}-${Math.random().toString(36).slice(2)}`;
            section.innerHTML = `
                ${block.label ? `<h3 class="report-viewer-label">${block.label}</h3>` : ''}
                <div id="${viewerId}" class="report-viewer-canvas"></div>`;
            root.appendChild(section);

            setTimeout(() => {
                const container = document.getElementById(viewerId);
                if (!container) return;

                // NOTE: check `typeof CADViewer` here, NOT `window.CADViewer`.
                // A top-level `class CADViewer {...}` declaration does NOT attach
                // itself to the window object, so `window.CADViewer` is always
                // undefined even when cad_viewer.js loaded correctly.
                if (typeof CADViewer !== 'undefined') {
                    const viewer = new CADViewer(container, block.colorSeed ?? idx);
                    viewer.loadModel(block.stlPath);
                    setTimeout(() => window.dispatchEvent(new Event('viewerResize')), 100);
                } else {
                    console.error('CADViewer not found — make sure cad_viewer.js (and THREE/OrbitControls/STLLoader) load before report-common.js');
                }
            }, 50);
        }
    });
}
