/* ============================================================
   highscore.js – Feuerwehr Grafrath Gerätekunde
   Online-Highscore via Supabase
   ============================================================ */

const SUPABASE_URL = 'https://qywwucsfwqcvaedqqyxg.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF5d3d1Y3Nmd3FjdmFlZHFxeXhnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMTM3ODAsImV4cCI6MjA5Mjc4OTc4MH0.7vxagAtQuW-6oAFdvlHczVMoVeEOtBMBzJImu30y00o';

const HS_HEADERS = {
    'Content-Type': 'application/json',
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
};

/* ── Eintrag speichern ──────────────────────────────────────── */
async function saveHighscore(name, score, total) {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/highscores`, {
            method: 'POST',
            headers: { ...HS_HEADERS, 'Prefer': 'return=representation' },
            body: JSON.stringify({ name: name.trim(), score, total }),
        });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    } catch (e) {
        console.error('Highscore speichern fehlgeschlagen:', e);
        return null;
    }
}

/* ── Top-Einträge laden (Top 10, sortiert nach Score dann Datum) */
async function loadHighscores(limit = 10) {
    try {
        const url = `${SUPABASE_URL}/rest/v1/highscores`
            + `?select=name,score,total,created_at`
            + `&order=score.desc,created_at.asc`
            + `&limit=${limit}`;
        const res = await fetch(url, { headers: HS_HEADERS });
        if (!res.ok) throw new Error(await res.text());
        return await res.json();
    } catch (e) {
        console.error('Highscore laden fehlgeschlagen:', e);
        return [];
    }
}

/* ── Datum formatieren ──────────────────────────────────────── */
function formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

/* ── Medaille für Rang ──────────────────────────────────────── */
function getRankIcon(i) {
    return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}.`;
}

/* ── Highscore-UI rendern ───────────────────────────────────── */
async function renderHighscoreList(currentName, currentScore) {
    const list = document.getElementById('highscoreList');
    const status = document.getElementById('highscoreStatus');

    list.innerHTML = '';
    status.textContent = 'Lade Rangliste…';

    const entries = await loadHighscores(10);

    if (!entries.length) {
        status.textContent = 'Noch keine Einträge – sei der Erste!';
        return;
    }

    status.textContent = '';

    entries.forEach((entry, i) => {
        const isMe = entry.name === currentName && entry.score === currentScore;
        const pct  = Math.round((entry.score / entry.total) * 100);

        const row = document.createElement('div');
        row.className = 'hs-row' + (isMe ? ' hs-row-me' : '');
        row.innerHTML = `
            <div class="hs-rank">${getRankIcon(i)}</div>
            <div class="hs-info">
                <div class="hs-name">${escapeHtml(entry.name)}${isMe ? ' <span class="hs-you">Du</span>' : ''}</div>
                <div class="hs-meta">${entry.score}/${entry.total} Punkte · ${pct}% · ${formatDate(entry.created_at)}</div>
                <div class="hs-bar-wrap"><div class="hs-bar" style="width:${pct}%"></div></div>
            </div>
        `;
        list.appendChild(row);
    });
}

/* ── HTML escapen (Sicherheit) ──────────────────────────────── */
function escapeHtml(str) {
    return str.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ── Namens-Eingabe + Speichern ─────────────────────────────── */
async function submitHighscore() {
    const input  = document.getElementById('hsNameInput');
    const btn    = document.getElementById('hsSubmitBtn');
    const name   = input.value.trim();

    if (!name) {
        input.classList.add('hs-input-error');
        setTimeout(() => input.classList.remove('hs-input-error'), 600);
        return;
    }
    if (name.length > 30) {
        input.value = name.slice(0, 30);
        return;
    }

    btn.disabled   = true;
    btn.textContent = 'Speichern…';

    // Letzten Namen merken
    try { localStorage.setItem('hs_last_name', name); } catch(e) {}

    const saved = await saveHighscore(name, window._quizFinalScore, 10);

    if (saved) {
        // Eingabe-Bereich verstecken
        document.getElementById('hsInputWrap').style.display = 'none';
        document.getElementById('hsSavedMsg').style.display  = 'block';
        await renderHighscoreList(name, window._quizFinalScore);
    } else {
        btn.disabled   = false;
        btn.textContent = 'Eintragen';
        document.getElementById('hsSavedMsg').textContent = '⚠️ Fehler beim Speichern – bitte nochmal versuchen.';
        document.getElementById('hsSavedMsg').style.display = 'block';
    }
}

/* ── Wird von zeigeErgebnis() aufgerufen ────────────────────── */
function initHighscoreSection(score) {
    window._quizFinalScore = score;

    // Letzten Namen vorausfüllen
    try {
        const last = localStorage.getItem('hs_last_name');
        if (last) document.getElementById('hsNameInput').value = last;
    } catch(e) {}

    // Eingabe wieder einblenden (falls nochmal gespielt)
    document.getElementById('hsInputWrap').style.display = 'block';
    document.getElementById('hsSavedMsg').style.display  = 'none';
    const btn = document.getElementById('hsSubmitBtn');
    btn.disabled   = false;
    btn.textContent = 'Eintragen 🏆';

    // Rangliste schon vorab laden (ohne eigenen Eintrag markiert)
    renderHighscoreList(null, null);
}
