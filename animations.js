/* ============================================================
   animations.js – Feuerwehr Grafrath Gerätekunde
   Ansichts-Wechsel mit synchronem Bild + Hotspot-Erscheinen
   ============================================================ */

const VIEW_IMAGES = {
    left:  { src: 'assets/links.png',  alt: 'Linke Seite' },
    back:  { src: 'assets/hinten.png', alt: 'Heck' },
    right: { src: 'assets/rechts.png', alt: 'Rechte Seite' },
};

const HOTSPOT_GROUPS = {
    left:  () => document.getElementById('hotspots-left'),
    back:  () => document.getElementById('hotspots-back'),
    right: () => document.getElementById('hotspots-right'),
};

// Verhindert gleichzeitige Animationen
let viewSwitching = false;

/* ── Alle Hotspot-Gruppen ausblenden ───────────────────────── */
function hideAllHotspotGroups() {
    Object.values(HOTSPOT_GROUPS).forEach(fn => {
        const g = fn();
        g.classList.remove('hs-visible');
        g.classList.add('hs-hidden');
        g.style.display = 'none';
    });
}

/* ── Hotspots einer Gruppe gestaffelt einblenden ───────────── */
function animateHotspotsIn(group) {
    group.style.display = 'block';
    group.classList.remove('hs-hidden');

    // Kurze Verzögerung damit display:block greift
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            group.classList.add('hs-visible');

            const hotspots = group.querySelectorAll('.compartment-hotspot');
            hotspots.forEach((h, i) => {
                // Zweiten Ring einfügen falls noch nicht da
                if (!h.querySelector('.hs-ring2')) {
                    const ring = document.createElement('span');
                    ring.className = 'hs-ring2';
                    h.appendChild(ring);
                }

                // Pop-Animation zurücksetzen und neu starten
                h.classList.remove('hs-pop');
                void h.offsetWidth; // reflow
                h.style.animationDelay = `${i * 0.09}s`;
                h.classList.add('hs-pop');
            });
        });
    });
}

/* ── Hauptfunktion: Ansicht wechseln ───────────────────────── */
function switchView(view) {
    if (viewSwitching) return;
    viewSwitching = true;

    const img   = document.getElementById('vehicleViewImage');
    const stage = document.querySelector('.vehicle-stage');

    // ── Phase 1: Altes Bild + Hotspots ausblenden (300ms) ──
    img.classList.remove('view-visible');
    img.classList.add('view-leaving');
    stage.classList.add('switching');
    hideAllHotspotGroups();

    setTimeout(() => {
        // ── Phase 2: Neues Bild laden ───────────────────────
        const viewData = VIEW_IMAGES[view];
        img.classList.remove('view-leaving');
        img.classList.add('view-entering');
        img.src = viewData.src;
        img.alt = viewData.alt;

        const onLoaded = () => {
            // ── Phase 3: Bild + Hotspots gleichzeitig einblenden
            requestAnimationFrame(() => {
                img.classList.remove('view-entering');
                img.classList.add('view-visible');
                stage.classList.remove('switching');

                const activeGroup = HOTSPOT_GROUPS[view]();
                animateHotspotsIn(activeGroup);
            });

            viewSwitching = false;
        };

        // Falls Bild schon im Cache → sofort, sonst onload
        if (img.complete && img.naturalWidth > 0) {
            onLoaded();
        } else {
            img.onload  = onLoaded;
            img.onerror = () => { viewSwitching = false; };
        }
    }, 280);
}

/* ── Erste Ansicht beim Öffnen des Fahrzeug-Screens ─────────── */
function initVehicleView(view = 'left') {
    const img   = document.getElementById('vehicleViewImage');
    const stage = document.querySelector('.vehicle-stage');

    hideAllHotspotGroups();
    img.classList.remove('view-visible', 'view-entering', 'view-leaving');

    const viewData = VIEW_IMAGES[view];
    img.src = viewData.src;
    img.alt = viewData.alt;

    const onLoaded = () => {
        requestAnimationFrame(() => {
            img.classList.add('view-visible');
            stage.classList.remove('switching');
            const activeGroup = HOTSPOT_GROUPS[view]();
            animateHotspotsIn(activeGroup);
        });
    };

    if (img.complete && img.naturalWidth > 0) {
        onLoaded();
    } else {
        img.onload = onLoaded;
    }
}

/* ── Screen-Wechsel Animation ───────────────────────────────── */
function animateScreenTransition(fromId, toId, onMidpoint) {
    const fromEl = fromId ? document.getElementById(fromId) : null;
    const toEl   = document.getElementById(toId);

    if (fromEl) {
        fromEl.classList.add('slide-out');
        setTimeout(() => {
            fromEl.classList.remove('active', 'slide-out');
            if (onMidpoint) onMidpoint();
            toEl.classList.add('active', 'slide-in');
            setTimeout(() => toEl.classList.remove('slide-in'), 400);
        }, 220);
    } else {
        if (onMidpoint) onMidpoint();
        toEl.classList.add('active', 'slide-in');
        setTimeout(() => toEl.classList.remove('slide-in'), 400);
    }
}
