const REPORT_PAGES = [
    { id: 'purpose', label: 'Purpose and Data Analysis', href: 'index.html' },
    { id: 'combined', label: 'Assembly and Video', href: 'combined-assembly-and-video.html' },
    { id: 'individual', label: 'CAD Iteration', href: 'individual-part-iteration.html' },
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
        <h1 class="report-title">Autonomous Pan-Tilt Tracking System</h1>
        <p class="report-subtitle">Design Iteration and Signal Strength Report by Amay Advani</p>
        <div class="report-title-rule-bottom"></div>
        <nav class="report-nav">${navHtml}</nav>
    `;
}


// blocks: array of objects, each one of:
//   { type: 'page-title', text: '...' }
//   { type: 'heading', text: '...' }
//   { type: 'text', html: '<p>...</p>' }
//   { type: 'bullets', heading: 'Purpose', items: ['...', '...'] }
//   { type: 'image', src, caption, align: 'full' (optional) }
//   { type: 'image-text', src, caption, text: '<p>...</p>', imageSide: 'left'|'right' }
//   { type: 'image-grid', featureFirst: true/false, images: [{ src, alt, caption }, ...] }  -> multiple photos, justified row
//   { type: 'code', label: 'optional title', code: 'raw C++ code as a string' }  -> syntax-highlighted via Prism.js
//   { type: 'video', src, caption }                    -> direct .mp4 file, e.g. '../vids/demo.mp4'
//   { type: 'video-embed', embedUrl, caption }          -> YouTube/Drive iframe embed URL
//   { type: 'viewer', stlPath, label, colorSeed, color (optional hex, overrides colorSeed) }  -> shows a "click and drag to rotate" hint until first interaction
//   { type: 'csv-table', label: 'optional title', src: '...csv path' }  -> fetches CSV and renders a scrollable table
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


        } else if (block.type === 'bullets') {
            const itemsHtml = block.items.map(item => `<li>${item}</li>`).join('');
            section.innerHTML = `
                ${block.heading ? `<h3 class="report-subheading">${block.heading}</h3>` : ''}
                <ul class="report-bullets">${itemsHtml}</ul>`;
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


        } else if (block.type === 'image-grid') {
            const imagesHtml = block.images.map((img, i) => `
                <figure class="report-figure ${i === 0 && block.featureFirst ? 'grid-feature' : ''}">
                    <img src="${img.src}" alt="${img.alt || img.caption || ''}" loading="lazy">
                    ${img.caption ? `<figcaption>${img.caption}</figcaption>` : ''}
                </figure>`).join('');
            section.innerHTML = `<div class="report-image-grid">${imagesHtml}</div>`;
            root.appendChild(section);


        } else if (block.type === 'code') {
            const escaped = block.code
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
            section.innerHTML = `
                ${block.label ? `<h3 class="report-subheading">${block.label}</h3>` : ''}
                <pre class="report-code"><code class="language-cpp">${escaped}</code></pre>`;
            root.appendChild(section);

            setTimeout(() => {
                if (typeof Prism !== 'undefined') Prism.highlightAll();
            }, 0);


        } else if (block.type === 'video') {
            section.innerHTML = `
                <figure class="report-figure report-video-figure">
                    <video controls preload="metadata" width="100%">
                        <source src="${block.src}" type="video/mp4">
                        Your browser does not support embedded video.
                    </video>
                    ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                </figure>`;
            root.appendChild(section);


        } else if (block.type === 'video-embed') {
            section.innerHTML = `
                <figure class="report-figure report-video-figure">
                    <div class="report-video-embed-wrap">
                        <iframe src="${block.embedUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                    </div>
                    ${block.caption ? `<figcaption>${block.caption}</figcaption>` : ''}
                </figure>`;
            root.appendChild(section);


        } else if (block.type === 'viewer') {
            const viewerId = `report-viewer-${idx}-${Math.random().toString(36).slice(2)}`;
            section.innerHTML = `
                ${block.label ? `<h3 class="report-viewer-label">${block.label}</h3>` : ''}
                <div id="${viewerId}" class="report-viewer-canvas">
                    <div class="report-viewer-hint">Click and drag to rotate</div>
                </div>`;
            root.appendChild(section);


            setTimeout(() => {
                const container = document.getElementById(viewerId);
                if (!container) return;

                const hint = container.querySelector('.report-viewer-hint');
                const dismissHint = () => {
                    if (hint) hint.classList.add('hidden');
                };
                container.addEventListener('mousedown', dismissHint, { once: true });
                container.addEventListener('touchstart', dismissHint, { once: true });


                if (typeof CADViewer !== 'undefined') {
                    const viewer = new CADViewer(container, block.colorSeed ?? idx, block.color ?? null);
                    viewer.loadModel(block.stlPath);
                    setTimeout(() => window.dispatchEvent(new Event('viewerResize')), 100);
                } else {
                    console.error('CADViewer not found — make sure cad_viewer.js (and THREE/OrbitControls/STLLoader) load before report-common.js');
                }
            }, 50);


        } else if (block.type === 'csv-table') {
            const tableId = `report-csv-${idx}-${Math.random().toString(36).slice(2)}`;
            section.innerHTML = `
                ${block.label ? `<h3 class="report-subheading">${block.label}</h3>` : ''}
                <div class="report-csv-wrap" id="${tableId}">Loading data…</div>`;
            root.appendChild(section);

            fetch(block.src)
                .then(res => res.text())
                .then(text => {
                    const rows = text.trim().split('\n').map(r => r.split(','));
                    const header = rows[0];
                    const body = rows.slice(1);
                    const tableHtml = `
                        <table class="report-csv-table">
                            <thead><tr>${header.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                            <tbody>${body.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
                        </table>`;
                    document.getElementById(tableId).innerHTML = tableHtml;
                })
                .catch(() => {
                    document.getElementById(tableId).innerHTML = `<p>Could not load ${block.src}.</p>`;
                });
        }
    });
}