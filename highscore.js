/* ============================================================
   highscore.js – Feuerwehr Grafrath Gerätekunde
   Kumulativer Highscore via Supabase
   - Pro Spieler nur 1 Eintrag
   - Prozentsatz über ALLE gespielten Fragen
   - Passt sich automatisch an wenn neue Fragen hinzugefügt werden
   ============================================================ */

const SUPABASE_URL = 'https://qywwucsfwqcvaedqqyxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5d3d1Y3Nmd3FjdmFlZHFxeXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTM3ODAsImV4cCI6MjA5Mjc4OTc4MH0.7vxagAtQuW-6oAFdvlHczVMoVeEOtBMBzJImu30y00o';

const HS_HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
};

/* ── Gesamtanzahl Fragen dynamisch aus dem Pool lesen ───────── 
   alleQuizFragen wird in index.html definiert.
   So passt sich die Berechnung automatisch an neue Fragen an.   */
function getPoolSize() {
    return (typeof alleQuizFragen !== 'undefined') ? alleQuizFragen.length : 20;
}

/* ── Spieler anhand Name laden ──────────────────────────────── */
async function loadPlayer(name) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/highscores`
            + `?name=eq.${encodeURIComponent(name)}`
            + `&limit=1`;
        const res = await fetch(url, { headers: HS_HEADERS });
        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();
        return data[0] || null;
    } catch (e) {
        console.error('Spieler laden fehlgeschlagen:', e);
        return null;
    }
}

/* ── Eintrag speichern oder aktualisieren ───────────────────── */
async function saveHighscore(name, score) {
    const quizSize = 10; // Fragen pro Runde – immer 10
    try {
        const existing = await loadPlayer(name);

        if (existing) {
            const newCorrect = existing.total_correct + score;
            const newPlayed  = existing.total_played  + quizSize;
            const newRounds  = existing.rounds + 1;
            const newBest    = Math.max(existing.best_score, score);

            const res = await fetch(
                `${SUPABASE_URL}/rest/v1/highscores?name=eq.${encodeURIComponent(name)}`,
                {
                    method: 'PATCH',
                    headers: { ...HS_HEADERS, 'Prefer': 'return=representation' },
                    body: JSON.stringify({
                        total_correct: newCorrect,
                        total_played:  newPlayed,
                        rounds:        newRounds,
                        best_score:    newBest,
                        pool_size:     getPoolSize(),
                        updated_at:    new Date().toISOString(),
                    }),
                }
            );
            if (!res.ok) throw new Error(await res.text());
            return await res.json();

        } else {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/highscores`, {
                method: 'POST',
                headers: { ...HS_HEADERS, 'Prefer': 'return=representation' },
                body: JSON.stringify({
                    name:          name.trim(),
                    total_correct: score,
                    total_played:  quizSize,
                    rounds:        1,
                    best_score:    score,
                    pool_size:     getPoolSize(),
                    updated_at:    new Date().toISOString(),
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            return await res.json();
        }
    } catch (e) {
        console.error('Highscore speichern fehlgeschlagen:', e);
        return null;
    }
}

/* ── Top 10 laden ───────────────────────────────────────────── */
async function loadHighscores(limit = 10) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/highscores`
            + `?select=name,total_correct,total_played,rounds,best_score,pool_size,updated_at`
            + `&order=total_correct.desc,best_score.desc,updated_at.asc`
            + `&limit=${limit}`;
        const res = await fetch(url, { headers: HS_HEADERS });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    } catch (e) {
        console.error('Highscore laden fehlgeschlagen:', e);
        return [];
    }
}

/* ── Hilfsfunktionen ────────────────────────────────────────── */
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function getRankIcon(i) {
    return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
}

function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c =>
        ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c])
    );
}

/* ── Rangliste rendern ──────────────────────────────────────── */
async function renderHighscoreList(currentName) {
    const list   = document.getElementById('highscoreList');
    const status = document.getElementById('highscoreStatus');

    list.innerHTML     = '';
    status.textContent = 'Lade Rangliste…';

    const entries  = await loadHighscores(10);
    const poolNow  = getPoolSize(); // aktueller Pool zum Zeitpunkt der Anzeige

    if (!entries.length) {
        status.textContent = 'Noch keine Einträge – sei der Erste!';
        return;
    }

    status.textContent = '';

    // Info-Zeile: Wie viele Fragen gibt es aktuell?
    const infoBar = document.createElement('div');
    infoBar.className = 'hs-pool-info';
    infoBar.textContent = `📚 Aktuell ${poolNow} Fragen im Pool`;
    list.appendChild(infoBar);

    entries.forEach((entry, i) => {
        const isMe = currentName &&
            entry.name.toLowerCase() === currentName.toLowerCase();

        /* Gesamt-Prozentsatz:
           Wieviel % hat der Spieler von ALLEN gespielten Fragen richtig?
           Dieser Wert steigt/fällt mit jeder Runde und spiegelt
           die echte Trefferquote über alle Runden wider.             */
        const gesamtPct = entry.total_played > 0
            ? Math.round((entry.total_correct / entry.total_played) * 100)
            : 0;

        /* Pool-Abdeckung:
           Hochgerechnet: Wenn der Spieler so weitermacht –
           wie viele der aktuellen Pool-Fragen beherrscht er?
           Wird mit dem aktuellen Pool verglichen, damit sich
           der Balken automatisch anpasst wenn Fragen dazukommen. */
        const poolAbdeckung = Math.min(100, gesamtPct);

        const row = document.createElement('div');
        row.className = 'hs-row' + (isMe ? ' hs-row-me' : '');
        row.innerHTML = `
            <div class="hs-rank">${getRankIcon(i)}</div>
            <div class="hs-info">
                <div class="hs-name">
                    ${escapeHtml(entry.name)}
                    ${isMe ? '<span class="hs-you">Du</span>' : ''}
                </div>
                <div class="hs-meta-grid">
                    <div class="hs-stat">
                        <span class="hs-stat-val">${gesamtPct}%</span>
                        <span class="hs-stat-lbl">Trefferquote</span>
                    </div>
                    <div class="hs-stat">
                        <span class="hs-stat-val">${entry.total_correct}<span class="hs-stat-sub"> / ${entry.total_played}</span></span>
                        <span class="hs-stat-lbl">Fragen richtig</span>
                    </div>
                    <div class="hs-stat">
                        <span class="hs-stat-val">${entry.best_score}<span class="hs-stat-sub"> / 10</span></span>
                        <span class="hs-stat-lbl">Bestes Quiz</span>
                    </div>
                    <div class="hs-stat">
                        <span class="hs-stat-val">${entry.rounds}×</span>
                        <span class="hs-stat-lbl">Gespielt</span>
                    </div>
                </div>
                <div class="hs-bar-wrap">
                    <div class="hs-bar" style="width:${poolAbdeckung}%"></div>
                    <div class="hs-bar-label">${gesamtPct}% von ${poolNow} Fragen</div>
                </div>
            </div>
        `;
        list.appendChild(row);
    });
}

/* ── Eintragen-Button ───────────────────────────────────────── */
async function submitHighscore() {
    const input = document.getElementById('hsNameInput');
    const btn   = document.getElementById('hsSubmitBtn');
    const name  = input.value.trim();

    if (!name) {
        input.classList.add('hs-input-error');
        setTimeout(() => input.classList.remove('hs-input-error'), 600);
        return;
    }
    if (name.length > 30) { input.value = name.slice(0, 30); return; }

    btn.disabled    = true;
    btn.textContent = 'Speichern…';

    try { localStorage.setItem('hs_last_name', name); } catch(e) {}

    const saved = await saveHighscore(name, window._quizFinalScore);

    if (saved) {
        document.getElementById('hsInputWrap').style.display = 'none';
        document.getElementById('hsSavedMsg').style.display  = 'block';
        await renderHighscoreList(name);
    } else {
        btn.disabled    = false;
        btn.textContent = 'Eintragen 🏆';
        const msg = document.getElementById('hsSavedMsg');
        msg.textContent   = '⚠️ Fehler beim Speichern – bitte nochmal versuchen.';
        msg.style.display = 'block';
    }
}

/* ── Init ───────────────────────────────────────────────────── */
function initHighscoreSection(score) {
    window._quizFinalScore = score;

    try {
        const last = localStorage.getItem('hs_last_name');
        if (last) document.getElementById('hsNameInput').value = last;
    } catch(e) {}

    document.getElementById('hsInputWrap').style.display = 'block';
    document.getElementById('hsSavedMsg').style.display  = 'none';
    const btn = document.getElementById('hsSubmitBtn');
    btn.disabled    = false;
    btn.textContent = 'Eintragen 🏆';

    renderHighscoreList(null);
}
