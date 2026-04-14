// ============ STATE ============
const STORAGE_KEY = 'muscu-recomp-v3';
let state = {
  bodyWeight: 95,
  dayIdx: 0,
  current: {},
  history: [],
  bodyStats: [],
  activeEx: null,
  view: 'workout'
};

// ============ INDEXEDDB STORAGE ============
const DB_NAME = 'tracker-muscu-db';
const DB_VERSION = 1;
const STORE_NAME = 'state';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) {
        d.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror = () => reject(req.error);
  });
}

async function idbGet(key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE_NAME, 'readwrite');
    const req = tx.objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Migrate localStorage → IndexedDB on first run
async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      await idbSet(STORAGE_KEY, saved);
      localStorage.removeItem(STORAGE_KEY);
      console.log('Migration localStorage → IndexedDB OK');
    }
  } catch(e) {}
}

async function loadState() {
  await migrateFromLocalStorage();
  try {
    const saved = await idbGet(STORAGE_KEY);
    if (saved) Object.assign(state, saved);
  } catch(e) {
    // Fallback localStorage si IndexedDB indispo
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch(e2) {}
  }
  if (!state.current) state.current = {};
  if (!state.history) state.history = [];
  if (!state.bodyStats) state.bodyStats = [];
  if (!state.veloSessions) state.veloSessions = [];
}

function saveState() {
  const data = {
    bodyWeight: state.bodyWeight,
    current: state.current,
    history: state.history,
    bodyStats: state.bodyStats,
    veloSessions: state.veloSessions,
  };
  // IndexedDB async (non-bloquant)
  idbSet(STORAGE_KEY, data).catch(() => {
    // Fallback localStorage
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  });
}

// ============ HELPERS ============
function calc1RM(kg, reps) {
  if (!kg || !reps || kg <= 0 || reps <= 0) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30); // Epley
}

function getRankIdx(ratio, thresholds) {
  let idx = -1;
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) idx = i;
  }
  return idx;
}

function getProgressInRank(ratio, thresholds, rankIdx) {
  if (rankIdx < 0) return ratio / thresholds[0];
  if (rankIdx >= thresholds.length - 1) return 1;
  const low = thresholds[rankIdx];
  const high = thresholds[rankIdx + 1];
  return (ratio - low) / (high - low);
}

function getBest1RM(rankKey) {
  let best = 0;
  state.history.forEach(h => {
    const day = PROGRAM.find(d => d.id === h.dayId);
    if (!day) return;
    day.exercises.forEach(ex => {
      if (ex.rankKey !== rankKey) return;
      for (let i = 0; i < ex.sets; i++) {
        const s = h.sets[`${ex.id}_${i}`];
        if (s) {
          const rm = calc1RM(parseFloat(s.kg), parseInt(s.reps));
          if (rm > best) best = rm;
        }
      }
    });
  });
  return best;
}

function getLastPerf(exId, setIdx) {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const s = state.history[i].sets[`${exId}_${setIdx}`];
    if (s) return s;
  }
  return null;
}

function getTopSetHistory(exId) {
  return state.history
    .filter(h => h.sets[`${exId}_0`])
    .map(h => ({
      date: new Date(h.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'2-digit'}),
      kg: parseFloat(h.sets[`${exId}_0`].kg)||0,
      reps: parseInt(h.sets[`${exId}_0`].reps)||0,
    }))
    .slice(-12);
}

function showToast(msg, type) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast' + (type ? ' ' + type : '');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2600);
}

// ---- PR DETECTION ----
// Returns best kg for a given exercise+set across all history BEFORE a given entry index
function getBestKgBefore(exId, setIdx, beforeIdx) {
  let best = 0;
  for (let i = 0; i < beforeIdx; i++) {
    const s = state.history[i].sets[`${exId}_${setIdx}`];
    if (s) { const kg = parseFloat(s.kg)||0; if (kg > best) best = kg; }
  }
  return best;
}

function getBestRmBefore(exId, setIdx, beforeIdx) {
  let best = 0;
  for (let i = 0; i < beforeIdx; i++) {
    const s = state.history[i].sets[`${exId}_${setIdx}`];
    if (s) { const rm = calc1RM(parseFloat(s.kg)||0, parseInt(s.reps)||0); if (rm > best) best = rm; }
  }
  return best;
}

// Returns list of PR strings for a freshly pushed entry (last in history)
function detectPRs(entry, day) {
  const idx = state.history.length - 1;
  const prs = [];
  day.exercises.forEach(ex => {
    for (let i = 0; i < ex.sets; i++) {
      const s = entry.sets[`${ex.id}_${i}`];
      if (!s) continue;
      const kg = parseFloat(s.kg)||0;
      const reps = parseInt(s.reps)||0;
      if (!kg) continue;
      const prevBestKg = getBestKgBefore(ex.id, i, idx);
      if (prevBestKg > 0 && kg > prevBestKg) {
        const label = ex.topSet && i === 0 ? 'Top Set' : `S${i+1}`;
        prs.push(`${ex.name.split(' ').slice(0,2).join(' ')} ${label}: ${kg}kg (+${(kg-prevBestKg).toFixed(1)}kg)`);
      }
    }
  });
  return prs;
}

// ---- SUGGESTIONS ----
// Parse upper bound of rep range from format string e.g. "3×6-8" → 8, "3×10-12" → 12
function parseUpperReps(format) {
  const m = format.match(/(\d+)-(\d+)/);
  return m ? parseInt(m[2]) : null;
}

// For each exercise in a day, check if last session hit upper rep range on all sets → suggest +2.5kg
function getSuggestions(day) {
  const suggestions = {};
  day.exercises.forEach(ex => {
    const upper = parseUpperReps(ex.format);
    if (!upper) return;
    let allHit = false;
    let anyData = false;
    for (let i = 0; i < ex.sets; i++) {
      const last = getLastPerf(ex.id, i);
      if (!last) { allHit = false; break; }
      anyData = true;
      const reps = parseInt(last.reps)||0;
      if (reps < upper) { allHit = false; break; }
      allHit = true;
    }
    if (anyData && allHit) {
      const lastKg = parseFloat(getLastPerf(ex.id, 0).kg)||0;
      suggestions[ex.id] = lastKg + 2.5;
    }
  });
  return suggestions;
}

// ---- STREAK ----
function getWeekKey(date) {
  const d = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function computeStreak() {
  if (!state.history.length) return 0;
  const weeks = new Set(state.history.map(h => getWeekKey(h.date)));
  const sorted = [...weeks].sort().reverse();
  const thisWeek = getWeekKey(new Date());
  const lastWeek = getWeekKey(new Date(Date.now() - 7*24*3600*1000));
  if (sorted[0] !== thisWeek && sorted[0] !== lastWeek) return 0;
  let streak = 0;
  let cursor = new Date(sorted[0]);
  for (const w of sorted) {
    if (w === getWeekKey(cursor)) { streak++; cursor = new Date(cursor.getTime() - 7*24*3600*1000); }
    else break;
  }
  return streak;
}


function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR',{weekday:'long',day:'2-digit',month:'long'});
}

// ============ RENDER ============
function render() {
  renderNav();
  renderWorkout();
  renderRank();
  renderProgress();
  renderBody();
  renderHistory();

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + state.view).classList.add('active');
}

function renderNav() {
  const tabs = [
    {id:'workout',icon:'<img src="icons/seance.png" alt="">',label:'Séance'},
    {id:'rank',icon:'<img src="icons/rang.png" alt="">',label:'Rang'},
    {id:'progress',icon:'<img src="icons/progres.png" alt="">',label:'Progrès'},
    {id:'body',icon:'<img src="icons/corps.png" alt="">',label:'Corps'},
    {id:'history',icon:'<img src="icons/historique.png" alt="">',label:'Historique'},
  ];
  document.getElementById('nav').innerHTML = tabs.map(t =>
    `<button class="${state.view===t.id?'active':''}" onclick="setView('${t.id}')">
      <span class="icon">${t.icon}</span><span class="label">${t.label}</span>
    </button>`
  ).join('');
}

function setView(v) { state.view = v; render(); }

// ---- WORKOUT ----
function renderWorkout() {
  const day = PROGRAM[state.dayIdx];
  let html = '<h2 class="page-title">Séance</h2>';

  // Streak banner
  const streak = computeStreak();
  if (streak >= 2) {
    const flames = streak >= 8 ? '🔥🔥🔥' : streak >= 4 ? '🔥🔥' : '🔥';
    html += `<div class="streak-banner">
      <div class="streak-num">${streak}</div>
      <div>
        <div class="streak-label">${flames} Semaine${streak>1?'s':''} d'affilée</div>
        <div class="streak-sub">Continue comme ça, ne brise pas ta série !</div>
      </div>
    </div>`;
  }

  // PR banners from last session
  if (state._lastPRs && state._lastPRs.length) {
    state._lastPRs.forEach((pr, idx) => {
      html += `<div class="pr-banner" onclick="openPRCelebrate(${idx})">
        <div class="pr-icon">🏆</div>
        <div>
          <div class="pr-text">Nouveau record !</div>
          <div class="pr-sub">${pr}</div>
        </div>
        <div class="pr-tap">Voir →</div>
      </div>`;
    });
  }

  // Day selector
  html += '<div class="day-sel">';
  PROGRAM.forEach((d, i) => {
    const active = state.dayIdx === i;
    html += `<button class="day-btn${active?' active':''}" style="--active-color:${d.accent}15;--active-accent:${d.accent}" onclick="selectDay(${i})">
      <div class="day-name">${d.name}</div><div class="day-when">${d.when}</div>
    </button>`;
  });
  html += '</div>';

  html += `<div class="warrior-section">${day.subtitle}</div>`;

  // Compute suggestions for this day
  const suggestions = getSuggestions(day);

  // Exercises — always show all info, tap to open inputs, swipe for gif panel
  day.exercises.forEach(ex => {
    const isOpen = state.activeEx === ex.id;
    const lastPerf = getLastPerf(ex.id, 0);
    const sugg = suggestions[ex.id];
    let tagHtml = '';
    if (ex.topSet) tagHtml = '<span class="tag tag-top">TOP SET</span>';
    if (ex.superset) tagHtml = '<span class="tag tag-ss">SUPERSET</span>';
    if (ex.dropSet) tagHtml = '<span class="tag tag-drop">DROP SET</span>';
    if (sugg) tagHtml += `<span class="suggestion-tag">↑ Essaie ${sugg}kg</span>`;

    html += `<div class="card ex-card${isOpen?' open':''}" style="--ex-accent:${day.accent}" data-exid="${ex.id}" onclick="toggleEx('${ex.id}')">
      <div class="ex-header">
        <div style="flex:1">${tagHtml}
          <div class="ex-name">${ex.name}</div>
          <div class="ex-format">${ex.format}</div>
          ${lastPerf ? `<div class="ex-prev" style="text-align:left;margin-top:3px">Préc: <strong style="color:${day.accent}">${lastPerf.kg}kg×${lastPerf.reps}</strong></div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div class="ex-arrow">${isOpen?'▾':'▸'}</div>
        </div>
      </div>`;

    if (isOpen) {
      html += '<div class="sets-area">';
      for (let i = 0; i < ex.sets; i++) {
        const prev = getLastPerf(ex.id, i);
        const isTop = ex.topSet && i === 0;
        const kgKey = `${ex.id}_${i}_kg`;
        const repsKey = `${ex.id}_${i}_reps`;

        // Smart suggestion logic
        let sugKg = prev ? prev.kg : '';
        let sugReps = prev ? prev.reps : '';

        if (ex.topSet && i > 0) {
          // Back-off set: if top set is filled, suggest ~85%
          const topKg = parseFloat(state.current[`${ex.id}_0_kg`]);
          const topReps = parseInt(state.current[`${ex.id}_0_reps`]);
          if (topKg > 0) {
            sugKg = (Math.round((topKg * 0.85) / 2.5) * 2.5).toFixed(1).replace('.0','');
          }
          if (topReps > 0) {
            sugReps = Math.min(topReps + 2, 8);
          }
          // Fall back to prev if nothing
          if (!sugKg && prev) sugKg = prev.kg;
          if (!sugReps && prev) sugReps = prev.reps;
        } else if (!ex.topSet && i > 0) {
          // Non-top-set: suggest same as previous set in this session
          const prevSetKg = state.current[`${ex.id}_${i-1}_kg`];
          const prevSetReps = state.current[`${ex.id}_${i-1}_reps`];
          if (prevSetKg) sugKg = prevSetKg;
          if (prevSetReps) sugReps = prevSetReps;
        }

        html += `<div class="set-row">
          <div class="set-label${isTop?' top':''}">${isTop?'TOP':`Série ${i+1}`}</div>
          <div class="input-wrap">
            <input type="number" inputmode="decimal" placeholder="${sugKg||'kg'}"
              value="${state.current[kgKey]||''}"
              onclick="event.stopPropagation()"
              oninput="event.stopPropagation();updateSet('${kgKey}',this.value);onSetInput('${ex.id}',${i},'${kgKey}','${repsKey}',${ex.topSet||false},'${ex.rankKey||''}')">
            <span class="unit">kg</span>
          </div>
          <div class="input-wrap">
            <input type="number" inputmode="numeric" placeholder="${sugReps||'reps'}"
              value="${state.current[repsKey]||''}"
              onclick="event.stopPropagation()"
              oninput="event.stopPropagation();updateSet('${repsKey}',this.value);onSetInput('${ex.id}',${i},'${kgKey}','${repsKey}',${ex.topSet||false},'${ex.rankKey||''}')">
            <span class="unit">reps</span>
          </div>
        </div>`;
        // Live 1RM for top sets
        if (ex.topSet && i === 0) {
          const curKg = parseFloat(state.current[kgKey])||0;
          const curReps = parseInt(state.current[repsKey])||0;
          let rmHtml = '';
          if (curKg > 0 && curReps > 0) {
            const rm = calc1RM(curKg, curReps);
            const bw = state.bodyWeight || 95;
            const ratio = rm / bw;
            const rk = ex.rankKey ? getRankIdx(ratio, STANDARDS[ex.rankKey].thresholds) : -1;
            const rkObj = rk >= 0 ? RANKS[rk] : null;
            const rkCls = rkObj ? rkObj.cls : '';
            rmHtml = `<span class="live-1rm ${rkCls}" style="background:${rkObj ? 'rgba(255,255,255,0.06)' : 'transparent'};color:var(--text2)">
              1RM: ${rm.toFixed(1)}kg · ${ratio.toFixed(2)}×BW ${rkObj ? rkObj.icon + ' ' + rkObj.name : ''}
            </span>`;
          }
          html += `<div id="live1rm-${ex.id}" style="margin:-4px 0 6px 56px">${rmHtml}</div>`;
        }
      }
      html += '</div>';
    }
    html += '</div>';
  });

  // Finish button
  html += `<button class="btn-primary" style="background:${day.accent}" onclick="finishSession('${day.id}')">Terminer la séance ✓</button>`;

  // Tractions reminder
  html += `<div class="card" style="margin-top:10px;border-left:2px solid rgba(194,59,59,0.4);padding-left:12px;font-size:12px;color:var(--text3)">
    <div style="font-family:'Cinzel',serif;font-size:9px;font-weight:700;color:rgba(194,59,59,0.6);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px">Ordre supplémentaire</div>
    2×3-5 tractions négatives (5s descente) en fin de séance. Alterner avec dips.
  </div>`;

  // Cycling button
  html += `<button class="velo-btn" onclick="openVeloModal()">🚴 Ajouter une sortie vélo</button>`;

  // Basic Fit battle button
  html += `<button class="basicfit-btn" onclick="openBasicFit()">⚔️ Aller au champ de bataille</button>`;

  document.getElementById('page-workout').innerHTML = html;

  // Swipe gauche sur les cartes d'exo pour ouvrir le panneau info
  document.querySelectorAll('.ex-card').forEach(card => {
    const exId = card.getAttribute('data-exid');
    if (!exId) return;
    let startX = 0, startY = 0, tracking = false;

    card.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      // Swipe gauche prononcé et plus horizontal que vertical
      if (dx < -40 && dy < Math.abs(dx) * 0.6) {
        tracking = false;
        openInfoModal(exId);
      }
    }, { passive: true });

    card.addEventListener('touchend', () => { tracking = false; }, { passive: true });
  });
}

function selectDay(i) { state.dayIdx = i; state.activeEx = null; state._lastPRs = null; render(); }
function toggleEx(id) { state.activeEx = state.activeEx === id ? null : id; render(); }
function updateSet(key, val) { state.current[key] = val; saveState(); }

// ---- REST TIMER ----
let restTimerInterval = null;
let restTimerEnd = 0;
let restTimerDuration = 0;

function getRestDuration(exId) {
  for (const day of PROGRAM) {
    for (const ex of day.exercises) {
      if (ex.id === exId) {
        if (ex.topSet) return 180; // 3 min
        if (ex.superset) return 90; // 1:30
        if (ex.dropSet) return 90;
        // Check format for rep range hints
        const f = ex.format;
        if (f.includes('6-8') || f.includes('6-10')) return 150; // 2:30
        if (f.includes('8-10') || f.includes('10-12')) return 120; // 2 min
        return 90; // 1:30 default for isolation
      }
    }
  }
  return 120;
}

function onSetInput(exId, setIdx, kgKey, repsKey, isTopSet, rankKey) {
  // Start session timer on first input
  if (!state._sessionActive) startSession();

  // Check if both kg and reps are filled for this set
  const kg = state.current[kgKey];
  const reps = state.current[repsKey];
  if (kg && reps && parseFloat(kg) > 0 && parseInt(reps) > 0) {
    const duration = getRestDuration(exId);
    startRestTimer(duration, exId);
    // Input flash micro-interaction
    document.querySelectorAll(`input[oninput*="'${kgKey}'"], input[oninput*="'${repsKey}'"]`).forEach(inp => {
      inp.classList.remove('input-flash');
      void inp.offsetWidth; // force reflow
      inp.classList.add('input-flash');
    });
  }

  // Live 1RM update (without re-render to keep focus)
  if (isTopSet && setIdx === 0 && rankKey) {
    const el = document.getElementById('live1rm-' + exId);
    if (el) {
      const k = parseFloat(state.current[kgKey]) || 0;
      const r = parseInt(state.current[repsKey]) || 0;
      if (k > 0 && r > 0) {
        const rm = calc1RM(k, r);
        const bw = state.bodyWeight || 95;
        const ratio = rm / bw;
        const rk = getRankIdx(ratio, STANDARDS[rankKey].thresholds);
        const rkObj = rk >= 0 ? RANKS[rk] : null;
        el.innerHTML = `<span class="live-1rm ${rkObj?rkObj.cls:''}" style="background:${rkObj?'rgba(255,255,255,0.06)':'transparent'};color:var(--text2)">
          1RM: ${rm.toFixed(1)}kg · ${ratio.toFixed(2)}×BW ${rkObj ? rkObj.icon+' '+rkObj.name : ''}
        </span>`;
      } else {
        el.innerHTML = '';
      }
    }

    // Update back-off set placeholders dynamically
    const topKg = parseFloat(state.current[kgKey]) || 0;
    const topReps = parseInt(state.current[repsKey]) || 0;
    if (topKg > 0) {
      const sugKg = (Math.round((topKg * 0.85) / 2.5) * 2.5).toFixed(1).replace('.0','');
      const sugReps = topReps > 0 ? Math.min(topReps + 2, 8) : '';
      // Find the exercise to know how many sets
      for (const day of PROGRAM) {
        for (const ex of day.exercises) {
          if (ex.id === exId) {
            for (let s = 1; s < ex.sets; s++) {
              const kgInput = document.querySelector(`input[oninput*="'${exId}_${s}_kg'"]`);
              const repsInput = document.querySelector(`input[oninput*="'${exId}_${s}_reps'"]`);
              if (kgInput && !kgInput.value) kgInput.placeholder = sugKg;
              if (repsInput && !repsInput.value && sugReps) repsInput.placeholder = sugReps;
            }
          }
        }
      }
    }
  }

  // For non-top-set exercises: update next set placeholders
  if (!isTopSet && kg) {
    const nextKgInput = document.querySelector(`input[oninput*="'${exId}_${setIdx+1}_kg'"]`);
    if (nextKgInput && !nextKgInput.value) nextKgInput.placeholder = kg;
  }
  if (!isTopSet && reps) {
    const nextRepsInput = document.querySelector(`input[oninput*="'${exId}_${setIdx+1}_reps'"]`);
    if (nextRepsInput && !nextRepsInput.value) nextRepsInput.placeholder = reps;
  }
}

function startRestTimer(duration, exId) {
  // Don't restart if already running for same duration
  if (restTimerInterval) clearInterval(restTimerInterval);

  restTimerDuration = duration;
  restTimerEnd = Date.now() + duration * 1000;

  const el = document.getElementById('rest-timer');
  const timeEl = document.getElementById('rest-timer-time');
  const fillEl = document.getElementById('rest-timer-fill');
  const labelEl = document.getElementById('rest-timer-label');
  const day = PROGRAM[state.dayIdx];

  el.classList.add('active');
  fillEl.style.background = day ? day.accent : 'var(--blue)';
  labelEl.textContent = `Repos — ${Math.floor(duration/60)}:${(duration%60).toString().padStart(2,'0')}`;

  restTimerInterval = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((restTimerEnd - Date.now()) / 1000));
    const min = Math.floor(remaining / 60);
    const sec = remaining % 60;
    timeEl.textContent = `${min}:${sec.toString().padStart(2,'0')}`;
    timeEl.style.color = remaining <= 5 ? 'var(--green)' : 'var(--text)';

    const pct = ((duration - remaining) / duration) * 100;
    fillEl.style.width = pct + '%';

    if (remaining <= 0) {
      clearInterval(restTimerInterval);
      restTimerInterval = null;
      timeEl.textContent = 'GO !';
      timeEl.style.color = 'var(--green)';
      fillEl.style.width = '100%';
      // Vibrate if available
      if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
      // Auto-hide after 3s
      setTimeout(() => {
        el.classList.remove('active');
      }, 3000);
    }
  }, 250);
}

function skipRestTimer() {
  if (restTimerInterval) clearInterval(restTimerInterval);
  restTimerInterval = null;
  document.getElementById('rest-timer').classList.remove('active');
}

// ---- SESSION TIMER ----
let sessionInterval = null;
let sessionStart = 0;
let wakeLock = null;

function startSession() {
  if (state._sessionActive) return;
  state._sessionActive = true;
  sessionStart = Date.now();

  document.getElementById('session-bar').classList.add('active');

  sessionInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStart) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;
    document.getElementById('session-time').textContent =
      `${min.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`;
  }, 1000);

  // Request wake lock
  requestWakeLock();
}

function stopSession() {
  state._sessionActive = false;
  if (sessionInterval) clearInterval(sessionInterval);
  sessionInterval = null;
  document.getElementById('session-bar').classList.remove('active');
  releaseWakeLock();
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch(e) { console.log('Wake Lock non disponible'); }
}

function releaseWakeLock() {
  if (wakeLock) {
    wakeLock.release();
    wakeLock = null;
  }
}

// Re-acquire wake lock when page becomes visible again
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state._sessionActive) {
    requestWakeLock();
  }
});

function finishSession(dayId) {
  const day = PROGRAM.find(d => d.id === dayId);
  const entry = { dayId, date: new Date().toISOString(), sets: {} };
  let hasData = false;

  day.exercises.forEach(ex => {
    for (let i = 0; i < ex.sets; i++) {
      const kg = state.current[`${ex.id}_${i}_kg`];
      const reps = state.current[`${ex.id}_${i}_reps`];
      if (kg || reps) {
        entry.sets[`${ex.id}_${i}`] = { kg: kg||'0', reps: reps||'0' };
        hasData = true;
      }
    }
  });

  if (!hasData) { showToast('Saisis au moins une série !'); return; }

  // Stop timers
  stopSession();
  skipRestTimer();

  // Clear current
  day.exercises.forEach(ex => {
    for (let i = 0; i < ex.sets; i++) {
      delete state.current[`${ex.id}_${i}_kg`];
      delete state.current[`${ex.id}_${i}_reps`];
    }
  });

  state.history.push(entry);
  state.activeEx = null;

  // Detect PRs before saving
  const prs = detectPRs(entry, day);

  saveState();

  if (prs.length) {
    state._lastPRs = prs;
  }

  // Show victory overlay
  const elapsed = sessionStart > 0 ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
  showVictory(day, entry, elapsed, prs);

  render();
}

function showVictory(day, entry, elapsedSec, prs) {
  const overlay = document.getElementById('victory-overlay');
  if (!overlay) return;

  // Compute stats
  const sets = Object.keys(entry.sets).length;
  const exosCompleted = new Set(Object.keys(entry.sets).map(k => k.split('_')[0])).size;
  const min = Math.floor(elapsedSec / 60);
  const sec = elapsedSec % 60;
  const timeStr = elapsedSec > 0 ? `${min}:${sec.toString().padStart(2,'0')}` : '—';

  // Volume: sum kg * reps for all sets
  let vol = 0;
  Object.values(entry.sets).forEach(s => {
    const kg = parseFloat(s.kg)||0;
    const reps = parseInt(s.reps)||0;
    vol += kg * reps;
  });

  // Apply accent color
  const accent = day.accent;
  // Extract RGB components for CSS var
  const hex = accent.replace('#','');
  const r = parseInt(hex.substr(0,2),16);
  const g = parseInt(hex.substr(2,2),16);
  const b = parseInt(hex.substr(4,2),16);

  overlay.style.setProperty('--victory-accent', accent);
  overlay.style.setProperty('--va-rgb', `${r},${g},${b}`);

  document.getElementById('victory-day').textContent = day.name.toUpperCase() + ' — ' + day.subtitle.toUpperCase();
  document.getElementById('victory-sets').textContent = sets;
  document.getElementById('victory-exos').textContent = exosCompleted;
  document.getElementById('victory-time').textContent = timeStr;
  document.getElementById('victory-vol').textContent = vol > 0 ? vol.toLocaleString('fr-FR') + ' kg' : '—';

  overlay.classList.remove('hidden', 'out');
  overlay.classList.add('in');

  // If PRs, show PR toast after a delay
  if (prs && prs.length) {
    setTimeout(() => {
      showToast(`🏆 ${prs.length} PR${prs.length>1?'s':''} battu${prs.length>1?'s':''} !`, 'pr');
    }, 600);
  }
}

function closeVictory() {
  const overlay = document.getElementById('victory-overlay');
  if (!overlay) return;
  overlay.classList.remove('in');
  overlay.classList.add('out');
  setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('out');
    // Show PR celebration if needed
    if (state._lastPRs && state._lastPRs.length) {
      openPRCelebrate(0);
    }
  }, 350);
}

// ---- RANK ----
function renderRank() {
  let html = '<h2 class="page-title">Rang</h2>';

  // Weight banner
  html += `<div class="weight-banner">
    <span style="font-size:14px;font-weight:700;color:#000">Poids actuel</span>
    <input type="number" inputmode="decimal" value="${state.bodyWeight||''}" placeholder="kg"
      onchange="updateWeight(this.value)">
    <span style="font-size:13px;color:rgba(0,0,0,0.6);font-weight:600">kg</span>
  </div>`;

  const bw = state.bodyWeight || 95;
  let totalRankIdx = 0;
  let rankCount = 0;

  // Per-exercise rank
  Object.keys(STANDARDS).forEach(key => {
    const std = STANDARDS[key];
    const best1RM = getBest1RM(key);
    const ratio = bw > 0 ? best1RM / bw : 0;
    const rankIdx = getRankIdx(ratio, std.thresholds);
    const progress = getProgressInRank(ratio, std.thresholds, rankIdx);
    const rank = rankIdx >= 0 ? RANKS[rankIdx] : null;
    const nextRank = rankIdx < RANKS.length - 1 ? RANKS[rankIdx + 1] : null;
    const nextThreshold = rankIdx < std.thresholds.length - 1 ? std.thresholds[rankIdx + 1] : null;
    const nextKg = nextThreshold ? (nextThreshold * bw).toFixed(1) : null;

    if (rankIdx >= 0) { totalRankIdx += rankIdx; rankCount++; }

    html += `<div class="rank-card ${rank?rank.cls:'rank-bronze'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${std.name}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">1RM estimé: <strong style="color:var(--text)">${best1RM>0?best1RM.toFixed(1)+'kg':'—'}</strong> · Ratio: <strong style="color:var(--text)">${ratio>0?ratio.toFixed(2)+'×BW':'—'}</strong></div>
        </div>
        ${rank ? `<div class="rank-badge">${rank.icon} ${rank.name}</div>` : '<div class="rank-badge" style="background:rgba(255,255,255,0.05);color:#555">Non classé</div>'}
      </div>
      <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.min(Math.max(progress*100,2),100)}%"></div></div>
      ${nextRank && nextKg ? `<div style="font-size:10px;color:var(--text3)">Prochain: ${nextRank.icon} ${nextRank.name} → ${nextKg}kg (${(nextThreshold).toFixed(2)}×BW)</div>` : ''}
    </div>`;
  });

  // Overall rank
  const overallIdx = rankCount > 0 ? Math.floor(totalRankIdx / rankCount) : -1;
  const overallRank = overallIdx >= 0 ? RANKS[overallIdx] : null;

  // Calculate overall progress to next rank
  let overallProgress = 0;
  if (rankCount > 0) {
    let totalProg = 0;
    Object.keys(STANDARDS).forEach(key => {
      const std = STANDARDS[key];
      const best = getBest1RM(key);
      const ratio = bw > 0 ? best / bw : 0;
      const rIdx = getRankIdx(ratio, std.thresholds);
      totalProg += getProgressInRank(ratio, std.thresholds, rIdx);
    });
    overallProgress = totalProg / Object.keys(STANDARDS).length;
  }

  const ringR = 58;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOffset = ringCirc * (1 - Math.min(overallProgress, 1));

  if (overallRank) {
    const overallHtml = `<div class="overall-rank ${overallRank.cls}">
      <div class="progress-ring-wrap">
        <svg class="progress-ring" width="140" height="140" viewBox="0 0 140 140">
          <circle class="progress-ring-bg" cx="70" cy="70" r="${ringR}"/>
          <circle class="progress-ring-fill" cx="70" cy="70" r="${ringR}" stroke="var(--rc)" stroke-dasharray="${ringCirc}" stroke-dashoffset="${ringOffset}"/>
        </svg>
        <div class="progress-ring-center">
          <div class="rank-icon">${overallRank.icon}</div>
        </div>
      </div>
      <div class="rank-name" style="color:var(--rc)">${overallRank.name}</div>
      <div class="rank-sub">Rang global · ${Math.round(overallProgress * 100)}% vers le suivant</div>
    </div>`;
    html = overallHtml + html;
  } else {
    html = `<div class="overall-rank rank-bronze">
      <div class="progress-ring-wrap">
        <svg class="progress-ring" width="140" height="140" viewBox="0 0 140 140">
          <circle class="progress-ring-bg" cx="70" cy="70" r="${ringR}"/>
        </svg>
        <div class="progress-ring-center">
          <div class="rank-icon">🎯</div>
        </div>
      </div>
      <div class="rank-name" style="color:var(--text3)">Non classé</div>
      <div class="rank-sub">Termine quelques séances pour débloquer ton rang</div>
    </div>` + html;
  }

  // Rank legend
  html += `<div class="card" style="margin-top:14px">
    <div style="font-size:13px;font-weight:700;color:var(--yellow);margin-bottom:10px">Échelle des rangs — Bench (ratio 1RM/BW)</div>
    <div style="display:flex;flex-direction:column;gap:4px">`;
  RANKS.forEach((r, i) => {
    html += `<div style="display:flex;align-items:center;gap:8px;font-size:12px">
      <span style="width:24px;text-align:center">${r.icon}</span>
      <span style="width:80px;font-weight:600;color:var(--text)">${r.name}</span>
      <span style="color:var(--text3)">${STANDARDS.bench.thresholds[i]}× BW → ${(STANDARDS.bench.thresholds[i]*bw).toFixed(0)}kg</span>
    </div>`;
  });
  html += '</div></div>';

  // Methodology
  html += `<div class="card" style="margin-top:8px">
    <div style="font-size:12px;color:var(--text3);line-height:1.6">
      <strong style="color:var(--text2)">Méthode :</strong> Le 1RM est estimé via la formule d'Epley (charge × (1 + reps/30)). Le ratio 1RM/poids de corps est comparé à des standards de force reconnus, adaptés par exercice. Le rang global est la moyenne de tes 3 top sets.
    </div>
  </div>`;

  document.getElementById('page-rank').innerHTML = html;
}

function updateWeight(val) {
  state.bodyWeight = parseFloat(val) || 0;
  saveState();
  render();
}

// ---- PROGRESS ----
let progressOpenDay = null; // null = collapsed, 'A'/'B'/'C' = open

function toggleProgressDay(dayId) {
  progressOpenDay = progressOpenDay === dayId ? null : dayId;
  renderProgress();
  document.getElementById('page-progress').classList.add('active');
}

function getExerciseHistory(exId, sets) {
  const results = [];
  state.history.forEach(h => {
    let bestKg = 0, bestReps = 0, best1RM = 0, totalVol = 0, hasData = false;
    for (let s = 0; s < sets; s++) {
      const set = h.sets[`${exId}_${s}`];
      if (!set) continue;
      hasData = true;
      const kg = parseFloat(set.kg) || 0;
      const reps = parseInt(set.reps) || 0;
      totalVol += kg * reps;
      const rm = calc1RM(kg, reps);
      if (rm > best1RM) { best1RM = rm; bestKg = kg; bestReps = reps; }
    }
    if (hasData) {
      results.push({
        date: new Date(h.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        bestKg, bestReps, best1RM, totalVol
      });
    }
  });
  return results.slice(-12);
}

function renderLineChart(data, valueKey, color, gradId, unit) {
  if (!data.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0">Aucune donnée</div>';
  const vals = data.map(d => d[valueKey]);
  const chartH = 85, chartW = 320, padX = 8, padTop = 18, padBot = 4;
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const usableH = chartH - padTop - padBot, usableW = chartW - padX * 2;

  const points = data.map((d, i) => ({
    x: data.length === 1 ? chartW / 2 : padX + (i / (data.length - 1)) * usableW,
    y: padTop + usableH - ((d[valueKey] - minV) / range) * usableH,
    v: d[valueKey]
  }));

  let linePath = '', areaPath = '';
  if (points.length > 1) {
    linePath = `M${points[0].x},${points[0].y}`;
    areaPath = `M${points[0].x},${chartH - padBot}L${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += `L${points[i].x},${points[i].y}`;
      areaPath += `L${points[i].x},${points[i].y}`;
    }
    areaPath += `L${points[points.length - 1].x},${chartH - padBot}Z`;
  }

  let svg = `<svg class="chart-svg" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="height:${chartH}px">
    <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>`;

  for (let g = 0; g <= 3; g++) {
    const gy = padTop + (usableH / 3) * g;
    svg += `<line x1="${padX}" y1="${gy}" x2="${chartW - padX}" y2="${gy}" stroke="var(--border)" stroke-width="0.5"/>`;
  }

  if (points.length > 1) {
    svg += `<path d="${areaPath}" fill="url(#${gradId})"/>`;
    svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  points.forEach((p, i) => {
    const isLast = i === points.length - 1;
    if (isLast) svg += `<circle cx="${p.x}" cy="${p.y}" r="8" fill="${color}" opacity="0.15"/>`;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${isLast ? 5 : 3.5}" fill="${isLast ? color : 'var(--card)'}" stroke="${color}" stroke-width="2"/>`;
    const ly = p.y - 10 < 12 ? p.y + 16 : p.y - 10;
    const label = unit === 'kg' ? Math.round(p.v * 10) / 10 : Math.round(p.v);
    svg += `<text x="${p.x}" y="${ly}" text-anchor="middle" fill="${isLast ? color : 'var(--text3)'}" font-size="${isLast ? 11 : 9}" font-weight="${isLast ? 700 : 500}" font-family="Space Grotesk,system-ui">${label}</text>`;
  });

  svg += '</svg>';
  svg += '<div class="chart-labels">';
  data.forEach(d => { svg += `<span>${d.date}</span>`; });
  svg += '</div>';

  if (data.length > 1) {
    const diff = vals[vals.length - 1] - vals[0];
    const col = diff >= 0 ? 'var(--green)' : 'var(--red)';
    svg += `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px">
      <span style="color:var(--text3)">Départ: <strong style="color:var(--text2)">${vals[0].toFixed(1)}</strong></span>
      <span style="color:var(--text3)">Actuel: <strong style="color:${color}">${vals[vals.length - 1].toFixed(1)}</strong></span>
      <span style="color:${col};font-weight:700">${diff >= 0 ? '+' : ''}${diff.toFixed(1)}</span>
    </div>`;
  }

  return svg;
}

function renderExerciseDetail(ex, accent) {
  const hist = getExerciseHistory(ex.id, ex.sets);
  let html = '';
  html += `<div style="font-size:14px;font-weight:700;color:${accent};margin-bottom:4px">${ex.name}</div>`;
  html += `<div style="font-size:11px;color:var(--text3);margin-bottom:10px">${ex.format}</div>`;

  if (!hist.length) {
    html += '<div style="font-size:12px;color:var(--text3);padding:4px 0">Aucune donnée encore</div>';
    return html;
  }

  const bestRM = Math.max(...hist.map(h => h.best1RM));
  const bestKg = Math.max(...hist.map(h => h.bestKg));
  const lastVol = hist[hist.length - 1].totalVol;

  html += `<div style="display:flex;gap:6px;margin-bottom:10px">
    <div style="flex:1;padding:8px;background:var(--bg);border-radius:8px;text-align:center">
      <div style="font-size:16px;font-weight:800;color:${accent}">${bestKg.toFixed(1)}<span style="font-size:10px;font-weight:600">kg</span></div>
      <div style="font-size:9px;color:var(--text3)">Charge max</div>
    </div>
    <div style="flex:1;padding:8px;background:var(--bg);border-radius:8px;text-align:center">
      <div style="font-size:16px;font-weight:800;color:var(--cyan)">${bestRM.toFixed(1)}<span style="font-size:10px;font-weight:600">kg</span></div>
      <div style="font-size:9px;color:var(--text3)">1RM estimé</div>
    </div>
    <div style="flex:1;padding:8px;background:var(--bg);border-radius:8px;text-align:center">
      <div style="font-size:16px;font-weight:800;color:#F97316">${lastVol > 1000 ? (lastVol / 1000).toFixed(1) + 't' : lastVol + 'kg'}</div>
      <div style="font-size:9px;color:var(--text3)">Vol. dernière</div>
    </div>
  </div>`;

  html += `<div style="font-size:11px;font-weight:600;color:var(--text2);margin-bottom:4px">Charge max par séance</div>`;
  html += renderLineChart(hist, 'bestKg', accent, `pg-${ex.id}-kg`, 'kg');

  if (hist.length >= 2) {
    html += `<div style="font-size:11px;font-weight:600;color:var(--text2);margin:12px 0 4px">Volume par séance</div>`;
    html += renderLineChart(hist, 'totalVol', '#F97316', `pg-${ex.id}-vol`, 'vol');
  }

  return html;
}

function renderProgress() {
  let html = '<h2 class="page-title">Progrès</h2>';

  // Streak card
  const streak = computeStreak();
  const streakColor = streak >= 8 ? 'var(--red)' : streak >= 4 ? 'var(--yellow)' : 'var(--purple)';
  const flames = streak >= 8 ? '🔥🔥🔥' : streak >= 4 ? '🔥🔥' : streak >= 2 ? '🔥' : '⬜';
  html += `<div class="card" style="margin-bottom:14px;display:flex;align-items:center;gap:14px">
    <div style="font-size:40px;font-weight:800;color:${streakColor};line-height:1">${streak}</div>
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text)">${flames} Semaine${streak !== 1 ? 's' : ''} de streak</div>
      <div style="font-size:11px;color:var(--text3);margin-top:2px">${streak === 0 ? 'Commence ta première séance !' : streak === 1 ? 'Premier pas, continue !' : 'Belle régularité, continue !'}</div>
    </div>
  </div>`;

  // Heatmap
  html += renderHeatmap();

  // ===== BIG 3 LIFTS — compact row =====
  const big3 = [
    { exId: 'a1', label: 'Bench', accent: '#C23B3B', sets: 3 },
    { exId: 'b1', label: 'OHP', accent: '#2D7DD2', sets: 4 },
    { exId: 'a2', label: 'Row', accent: '#A78BFA', sets: 3 },
  ];

  html += '<div style="display:flex;gap:6px;margin:16px 0 20px">';
  big3.forEach(lift => {
    const hist = getExerciseHistory(lift.exId, lift.sets);
    const last = hist.length ? hist[hist.length - 1] : null;
    const bestRM = hist.length ? Math.max(...hist.map(h => h.best1RM)) : 0;

    html += `<div class="card" style="flex:1;text-align:center;padding:10px 6px;border-top:3px solid ${lift.accent}">
      <div style="font-size:11px;font-weight:700;color:${lift.accent};margin-bottom:6px">${lift.label}</div>
      ${last
        ? `<div style="font-size:18px;font-weight:800;color:var(--text);line-height:1">${last.bestKg}×${last.bestReps}</div>
           <div style="font-size:10px;color:var(--text3);margin-top:4px">1RM: <strong style="color:var(--cyan)">${bestRM.toFixed(0)}kg</strong></div>`
        : '<div style="font-size:12px;color:var(--text3)">—</div>'
      }
    </div>`;
  });
  html += '</div>';

  // ===== DETAILED PER-DAY — collapsible =====
  html += '<h2 class="page-title" style="margin-top:20px">Détail par séance</h2>';

  PROGRAM.forEach(d => {
    const isOpen = progressOpenDay === d.id;
    const count = state.history.filter(h => h.dayId === d.id).length;

    html += `<div class="card" style="margin-bottom:8px;cursor:pointer;border-left:3px solid ${d.accent}" onclick="toggleProgressDay('${d.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:14px;font-weight:700;color:${d.accent}">${d.name} — ${d.subtitle}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">${count} séances · ${d.exercises.length} exercices</div>
        </div>
        <div style="font-size:18px;color:${isOpen ? d.accent : 'var(--text3)'};transition:0.15s">${isOpen ? '▾' : '▸'}</div>
      </div>
    </div>`;

    if (isOpen) {
      d.exercises.forEach(ex => {
        html += `<div class="card" style="margin-bottom:8px;margin-left:8px;border-left:2px solid ${d.accent}30;animation:setsSlide 0.25s ease">`;
        html += renderExerciseDetail(ex, d.accent);
        html += '</div>';
      });
    }
  });

  // Vélo stats
  if (state.veloSessions && state.veloSessions.length) {
    const totalKm = state.veloSessions.reduce((a, v) => a + (v.distance || 0), 0);
    const totalMin = state.veloSessions.reduce((a, v) => a + (v.duration || 0), 0);
    const totalH = Math.floor(totalMin / 60);
    const remMin = totalMin % 60;
    html += `<div class="card" style="margin-bottom:6px;border-left:3px solid var(--yellow);margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:13px;font-weight:600;color:var(--yellow)">🚴 Vélo</span>
        <span style="font-size:20px;font-weight:800;color:var(--yellow)">${state.veloSessions.length}</span>
      </div>
      <div style="font-size:11px;color:var(--text3)">sorties · ${totalKm.toFixed(0)} km · ${totalH}h${remMin > 0 ? remMin + 'min' : ''}</div>
    </div>`;
  }

  document.getElementById('page-progress').innerHTML = html;
}

// ---- BODY ----
function renderBody() {
  let html = '<h2 class="page-title">Suivi corporel</h2>';
  html += '<p class="info-text" style="margin-bottom:10px">Mesure-toi chaque semaine, même jour, le matin à jeun.</p>';
  html += '<div class="warrior-section">Mensurations</div>';

  state.bodyStats.forEach((entry, idx) => {
    const dateStr = new Date(entry.date).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric'});
    html += `<div class="card" style="margin-bottom:8px">
      <div style="font-size:11px;color:var(--yellow);font-weight:600;margin-bottom:8px">${dateStr}</div>
      <div class="stat-grid">
        ${['poids:Poids (kg)','bras:Tour de bras (cm)','poitrine:Poitrine (cm)','taille_cm:Tour de taille (cm)'].map(f => {
          const [key, label] = f.split(':');
          return `<div class="stat-field"><label>${label}</label>
            <input type="number" inputmode="decimal" value="${entry[key]||''}" placeholder="—"
              onchange="updateBody(${idx},'${key}',this.value)"></div>`;
        }).join('')}
      </div>
    </div>`;
  });

  html += `<button class="btn-primary" style="background:var(--yellow)" onclick="addBodyStat()">+ Nouvelle mesure</button>`;

  // Evolution charts
  if (state.bodyStats.length >= 2) {
    const metrics = [
      { key: 'poids', label: 'Poids (kg)', color: 'var(--yellow)', hex: '#E4A229', goodDir: 'context' },
      { key: 'bras', label: 'Tour de bras (cm)', color: 'var(--purple)', hex: '#8B5CF6', goodDir: 'up' },
      { key: 'poitrine', label: 'Poitrine (cm)', color: 'var(--blue)', hex: '#2D7DD2', goodDir: 'up' },
      { key: 'taille_cm', label: 'Tour de taille (cm)', color: 'var(--red)', hex: '#C23B3B', goodDir: 'down' },
    ];

    metrics.forEach(m => {
      const entries = state.bodyStats.filter(b => b[m.key]).map(b => ({
        val: parseFloat(b[m.key]),
        date: new Date(b.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
      }));
      if (entries.length < 2) return;

      const vals = entries.map(e => e.val);
      const minV = Math.min(...vals);
      const maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const diff = vals[vals.length - 1] - vals[0];
      const good = m.goodDir === 'down' ? diff < 0 : m.goodDir === 'up' ? diff > 0 : true;

      const chartH = 80;
      const chartW = 320;
      const padX = 8;
      const padTop = 16;
      const padBot = 4;
      const usableH = chartH - padTop - padBot;
      const usableW = chartW - padX * 2;

      const points = entries.map((e, i) => {
        const x = entries.length === 1 ? chartW / 2 : padX + (i / (entries.length - 1)) * usableW;
        const y = padTop + usableH - ((e.val - minV) / range) * usableH;
        return { x, y, val: e.val };
      });

      let linePath = `M${points[0].x},${points[0].y}`;
      let areaPath = `M${points[0].x},${chartH - padBot}L${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        linePath += `L${points[i].x},${points[i].y}`;
        areaPath += `L${points[i].x},${points[i].y}`;
      }
      areaPath += `L${points[points.length - 1].x},${chartH - padBot}Z`;

      html += `<div class="card" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <span style="font-size:13px;font-weight:700;color:${m.color}">${m.label}</span>
          <span style="font-size:12px;font-weight:700;color:${good ? 'var(--green)' : 'var(--red)'}">${diff > 0 ? '+' : ''}${diff.toFixed(1)}</span>
        </div>
        <svg class="chart-svg" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="height:${chartH}px">
          <defs>
            <linearGradient id="bgrad-${m.key}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="${m.hex}" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="${m.hex}" stop-opacity="0"/>
            </linearGradient>
          </defs>`;

      // Grid
      for (let g = 0; g <= 3; g++) {
        const gy = padTop + (usableH / 3) * g;
        html += `<line x1="${padX}" y1="${gy}" x2="${chartW - padX}" y2="${gy}" stroke="var(--border)" stroke-width="0.5"/>`;
      }

      // Area + line
      html += `<path d="${areaPath}" fill="url(#bgrad-${m.key})"/>`;
      html += `<path d="${linePath}" fill="none" stroke="${m.hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

      // Points
      points.forEach((p, i) => {
        const isLast = i === points.length - 1;
        const r = isLast ? 4.5 : 3;
        if (isLast) {
          html += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="${m.hex}" opacity="0.15"/>`;
        }
        html += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${isLast ? m.hex : 'var(--card)'}" stroke="${m.hex}" stroke-width="1.5"/>`;
        html += `<text x="${p.x}" y="${p.y - 8 < 10 ? p.y + 14 : p.y - 8}" text-anchor="middle" fill="${isLast ? m.hex : 'var(--text3)'}" font-size="${isLast ? 10 : 8}" font-weight="${isLast ? 700 : 500}" font-family="Space Grotesk,system-ui">${p.val}</text>`;
      });

      html += '</svg>';
      html += '<div class="chart-labels">';
      entries.forEach(e => { html += `<span>${e.date}</span>`; });
      html += '</div>';

      // Min/max summary
      html += `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px">
        <span style="color:var(--text3)">Min: <strong style="color:var(--text2)">${minV.toFixed(1)}</strong></span>
        <span style="color:var(--text3)">Actuel: <strong style="color:${m.color}">${vals[vals.length - 1].toFixed(1)}</strong></span>
        <span style="color:var(--text3)">Max: <strong style="color:var(--text2)">${maxV.toFixed(1)}</strong></span>
      </div>`;

      html += '</div>';
    });
  }

  document.getElementById('page-body').innerHTML = html;
}

function addBodyStat() {
  state.bodyStats.push({ date: new Date().toISOString(), poids:'', bras:'', poitrine:'', taille_cm:'' });
  saveState(); render();
}

function updateBody(idx, key, val) {
  state.bodyStats[idx][key] = val;
  if (key === 'poids' && val) { state.bodyWeight = parseFloat(val); }
  saveState();
}

// ---- HISTORY ----
function renderHistory() {
  let html = '<h2 class="page-title">Historique</h2><div class="warrior-section">Campagnes passées</div><div class="hist-hint">Maintenir pour modifier</div>';

  // Merge muscu, velo and body stats into a unified timeline
  const allEntries = [];
  state.history.forEach((h, i) => allEntries.push({ type: 'muscu', data: h, idx: i }));
  if (state.veloSessions) {
    state.veloSessions.forEach((v, i) => allEntries.push({ type: 'velo', data: v, idx: i }));
  }
  if (state.bodyStats) {
    state.bodyStats.forEach((b, i) => allEntries.push({ type: 'body', data: b, idx: i }));
  }
  allEntries.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

  if (!allEntries.length) {
    html += `<div class="card" style="text-align:center;padding:24px">
      
      <div style="font-size:13px;color:var(--text3)">Aucune activité enregistrée</div>
      <div style="font-size:11px;color:#444;margin-top:4px">Termine ta première séance pour la voir ici</div>
    </div>`;
    html += `<button class="btn-import" onclick="openImportModal()">Charger depuis Excel</button>`;
  } else {
    html += `<button class="btn-export" onclick="exportToExcel()">
      Exporter tout en Excel
    </button>`;
    html += `<button class="btn-import" onclick="openImportModal()">Charger depuis Excel</button>`;

    allEntries.forEach(entry => {
      if (entry.type === 'muscu') {
        const h = entry.data;
        const i = entry.idx;
        const d = PROGRAM.find(p => p.id === h.dayId);
        if (!d) return;
        const setCount = Object.keys(h.sets).length;
        html += `<div class="hist-card hist-card--warrior" style="--hc-accent:${d.accent}" data-hist-action="openEditSession(${i})">
          <div class="hist-card-header">
            <div>
              <div class="hist-card-title" style="color:${d.accent}">${d.name}</div>
              <div class="hist-card-sub">${d.subtitle}</div>
              <div class="hist-card-date">${formatDate(h.date)}</div>
            </div>
            <div class="hist-card-count">
              <span class="hist-card-count-num" style="color:${d.accent}">${setCount}</span>
              <span class="hist-card-count-label">séries</span>
            </div>
          </div>
          <div class="hist-tags">
            ${d.exercises.map(ex => {
              const s = h.sets[`${ex.id}_0`];
              if (!s) return '';
              return `<span class="hist-tag">${ex.name.split(' ').slice(0,2).join(' ')} ${s.kg}kg×${s.reps}</span>`;
            }).join('')}
          </div>
        </div>`;
      } else if (entry.type === 'velo') {
        const v = entry.data;
        const vi = entry.idx;
        const typeLabels = { endurance: 'Endurance', long: 'Sortie longue', recup: 'Récup' };
        html += `<div class="hist-card hist-card--warrior" style="--hc-accent:var(--yellow)" data-hist-action="openEditVelo(${vi})">
          <div class="hist-card-header">
            <div>
              <div class="hist-card-title" style="color:var(--yellow)">Vélo — ${typeLabels[v.type] || v.type}</div>
              <div class="hist-card-date">${formatDate(v.date)}</div>
            </div>
            <div class="hist-card-count">
              ${v.distance ? `<span class="hist-card-count-num" style="color:var(--yellow)">${v.distance}</span><span class="hist-card-count-label">km</span>` : ''}
              ${v.duration ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${v.duration} min</div>` : ''}
            </div>
          </div>
        </div>`;
      } else if (entry.type === 'body') {
        const b = entry.data;
        const bi = entry.idx;
        const vals = [];
        if (b.poids) vals.push(`${b.poids}kg`);
        if (b.bras) vals.push(`bras ${b.bras}cm`);
        if (b.poitrine) vals.push(`poit. ${b.poitrine}cm`);
        if (b.taille_cm) vals.push(`taille ${b.taille_cm}cm`);
        html += `<div class="hist-card hist-card--warrior" style="--hc-accent:var(--purple)" data-hist-action="openEditBodyStat(${bi})">
          <div class="hist-card-header">
            <div>
              <div class="hist-card-title" style="color:var(--purple)">Mesure corporelle</div>
              <div class="hist-card-date">${formatDate(b.date)}</div>
            </div>
            <div class="hist-card-count">
              ${b.poids ? `<span class="hist-card-count-num" style="color:var(--purple)">${b.poids}</span><span class="hist-card-count-label">kg</span>` : ''}
            </div>
          </div>
          ${vals.length ? `<div class="hist-tags">${vals.map(v => `<span class="hist-tag">${v}</span>`).join('')}</div>` : ''}
        </div>`;
      }
    });

    html += `<button class="btn-outline" onclick="resetHistory()">Réinitialiser l'historique</button>`;
  }

  document.getElementById('page-history').innerHTML = html;
  initHistSwipe();
}

// ---- EDIT SESSION ----
let editingIdx = null;
let editSets = {};

function initHistSwipe() {
  document.querySelectorAll('[data-hist-action]').forEach(card => {
    const action = card.getAttribute('data-hist-action');
    let pressTimer = null;
    let startY = 0;
    let cancelled = false;

    card.addEventListener('touchstart', e => {
      startY = e.touches[0].clientY;
      cancelled = false;
      card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
      pressTimer = setTimeout(() => {
        if (!cancelled) {
          card.style.transform = 'scale(0.97)';
          card.style.opacity = '0.75';
          setTimeout(() => {
            card.style.transform = '';
            card.style.opacity = '';
            eval(action);
          }, 120);
        }
      }, 500);
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dy > 12) {
        cancelled = true;
        clearTimeout(pressTimer);
        card.style.transform = '';
        card.style.opacity = '';
      }
    }, { passive: true });

    card.addEventListener('touchend', () => {
      cancelled = true;
      clearTimeout(pressTimer);
      card.style.transform = '';
      card.style.opacity = '';
    }, { passive: true });

    card.addEventListener('touchcancel', () => {
      cancelled = true;
      clearTimeout(pressTimer);
      card.style.transform = '';
      card.style.opacity = '';
    }, { passive: true });

    // Desktop support (right-click / long mousedown)
    let mouseTimer = null;
    card.addEventListener('mousedown', () => {
      mouseTimer = setTimeout(() => { eval(action); }, 500);
    });
    card.addEventListener('mouseup', () => clearTimeout(mouseTimer));
    card.addEventListener('mouseleave', () => clearTimeout(mouseTimer));
    card.addEventListener('contextmenu', e => { e.preventDefault(); eval(action); });
  });
}

// ---- EDIT VELO SESSION ----
function openEditVelo(idx) {
  const v = state.veloSessions[idx];
  if (!v) return;

  document.getElementById('edit-modal-title').textContent = `Modifier — Sortie vélo du ${formatDate(v.date)}`;

  const typeLabels = { endurance: 'Endurance', long: 'Sortie longue', recup: 'Récupération' };
  let body = `<div class="velo-input-row">
    <div class="velo-field"><label>Distance (km)</label>
      <input type="number" inputmode="decimal" id="edit-velo-distance" value="${v.distance||''}"></div>
    <div class="velo-field"><label>Durée (min)</label>
      <input type="number" inputmode="numeric" id="edit-velo-duration" value="${v.duration||''}"></div>
  </div>
  <div class="velo-input-row">
    <div class="velo-field"><label>Type</label>
      <select id="edit-velo-type">
        <option value="endurance" ${v.type==='endurance'?'selected':''}>Endurance</option>
        <option value="long" ${v.type==='long'?'selected':''}>Sortie longue</option>
        <option value="recup" ${v.type==='recup'?'selected':''}>Récupération</option>
      </select>
    </div>
  </div>`;

  document.getElementById('edit-modal-body').innerHTML = body;
  document.getElementById('edit-modal-save').setAttribute('onclick', `saveEditVelo(${idx})`);
  const delBtn = document.getElementById('edit-modal-delete');
  delBtn.style.display = 'block';
  delBtn.setAttribute('onclick', `deleteVeloSession(${idx})`);
  document.getElementById('edit-modal').classList.remove('hidden');
}

function saveEditVelo(idx) {
  state.veloSessions[idx].distance = parseFloat(document.getElementById('edit-velo-distance').value) || 0;
  state.veloSessions[idx].duration = parseInt(document.getElementById('edit-velo-duration').value) || 0;
  state.veloSessions[idx].type = document.getElementById('edit-velo-type').value;
  saveState();
  closeEditModal();
  showToast('Sortie vélo modifiée ✓');
  render();
}

function openEditSession(idx) {
  editingIdx = idx;
  const h = state.history[idx];
  const d = PROGRAM.find(p => p.id === h.dayId);
  if (!d) return;
  editSets = JSON.parse(JSON.stringify(h.sets)); // deep copy

  document.getElementById('edit-modal-title').textContent = `Modifier — ${d.name} · ${formatDate(h.date)}`;

  let body = '';
  d.exercises.forEach(ex => {
    body += `<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:${d.accent};margin-bottom:6px">${ex.name}</div>`;
    for (let i = 0; i < ex.sets; i++) {
      const key = `${ex.id}_${i}`;
      const s = editSets[key] || {kg:'', reps:''};
      const isTop = ex.topSet && i === 0;
      body += `<div class="set-row">
        <div class="set-label${isTop?' top':''}" style="--ex-accent:${d.accent}">${isTop?'TOP':`S${i+1}`}</div>
        <div class="input-wrap">
          <input type="number" inputmode="decimal" placeholder="kg" value="${s.kg||''}"
            oninput="updateEditSet('${key}','kg',this.value)">
          <span class="unit">kg</span>
        </div>
        <div class="input-wrap">
          <input type="number" inputmode="numeric" placeholder="reps" value="${s.reps||''}"
            oninput="updateEditSet('${key}','reps',this.value)">
          <span class="unit">reps</span>
        </div>
      </div>`;
    }
    body += '</div>';
  });

  document.getElementById('edit-modal-body').innerHTML = body;
  document.getElementById('edit-modal-save').setAttribute('onclick', 'saveEditSession()');
  const delBtn = document.getElementById('edit-modal-delete');
  delBtn.style.display = 'block';
  delBtn.setAttribute('onclick', `deleteSession(${idx})`);
  document.getElementById('edit-modal').classList.remove('hidden');
}

function updateEditSet(key, field, val) {
  if (!editSets[key]) editSets[key] = {kg:'', reps:''};
  editSets[key][field] = val;
  // Remove entry if both empty
  if (!editSets[key].kg && !editSets[key].reps) delete editSets[key];
}

function saveEditSession() {
  if (editingIdx === null) return;
  // Deep copy to avoid reference issues
  state.history[editingIdx].sets = JSON.parse(JSON.stringify(editSets));
  saveState();
  closeEditModal();
  showToast('Séance modifiée ✓');
  render();
}

function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('edit-modal-delete').style.display = 'none';
  editingIdx = null;
  editingBodyIdx = null;
  editSets = {};
}

function deleteSession(idx) {
  const h = state.history[idx];
  const d = PROGRAM.find(p => p.id === h.dayId);
  const label = d ? `${d.name} du ${formatDate(h.date)}` : 'cette séance';
  if (confirm(`Supprimer ${label} ? Cette action est irréversible.`)) {
    closeEditModal();
    state.history.splice(idx, 1);
    saveState();
    showToast('Séance supprimée');
    render();
  }
}

function deleteVeloSession(idx) {
  const v = state.veloSessions[idx];
  const label = v ? `sortie vélo du ${formatDate(v.date)}` : 'cette sortie';
  if (confirm(`Supprimer ${label} ?`)) {
    closeEditModal();
    state.veloSessions.splice(idx, 1);
    saveState();
    showToast('Sortie vélo supprimée');
    render();
  }
}

// ---- BODY STAT EDIT/DELETE FROM HISTORY ----
let editingBodyIdx = null;

function openEditBodyStat(idx) {
  editingBodyIdx = idx;
  const b = state.bodyStats[idx];
  if (!b) return;

  document.getElementById('edit-modal-title').textContent = `Modifier — Mesure du ${formatDate(b.date)}`;

  let body = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="stat-field"><label>Poids (kg)</label>
      <input type="number" inputmode="decimal" id="edit-body-poids" value="${b.poids||''}" placeholder="—"></div>
    <div class="stat-field"><label>Tour de bras (cm)</label>
      <input type="number" inputmode="decimal" id="edit-body-bras" value="${b.bras||''}" placeholder="—"></div>
    <div class="stat-field"><label>Poitrine (cm)</label>
      <input type="number" inputmode="decimal" id="edit-body-poitrine" value="${b.poitrine||''}" placeholder="—"></div>
    <div class="stat-field"><label>Tour de taille (cm)</label>
      <input type="number" inputmode="decimal" id="edit-body-taille" value="${b.taille_cm||''}" placeholder="—"></div>
  </div>`;

  document.getElementById('edit-modal-body').innerHTML = body;
  document.getElementById('edit-modal-save').setAttribute('onclick', 'saveEditBodyStat()');
  const delBtn2 = document.getElementById('edit-modal-delete');
  delBtn2.style.display = 'block';
  delBtn2.setAttribute('onclick', `deleteBodyStat(${idx})`);
  document.getElementById('edit-modal').classList.remove('hidden');
}

function saveEditBodyStat() {
  if (editingBodyIdx === null) return;
  state.bodyStats[editingBodyIdx].poids = document.getElementById('edit-body-poids').value;
  state.bodyStats[editingBodyIdx].bras = document.getElementById('edit-body-bras').value;
  state.bodyStats[editingBodyIdx].poitrine = document.getElementById('edit-body-poitrine').value;
  state.bodyStats[editingBodyIdx].taille_cm = document.getElementById('edit-body-taille').value;
  if (state.bodyStats[editingBodyIdx].poids) {
    state.bodyWeight = parseFloat(state.bodyStats[editingBodyIdx].poids);
  }
  editingBodyIdx = null;
  saveState();
  closeEditModal();
  showToast('Mesure modifiée ✓');
  render();
}

function deleteBodyStat(idx) {
  const b = state.bodyStats[idx];
  const label = b ? `mesure du ${formatDate(b.date)}` : 'cette mesure';
  if (confirm(`Supprimer ${label} ?`)) {
    closeEditModal();
    state.bodyStats.splice(idx, 1);
    saveState();
    showToast('Mesure supprimée');
    render();
  }
}

// ---- EXPORT EXCEL ----
function exportToExcel() {
  if (typeof XLSX === 'undefined') { showToast('Export indisponible'); return; }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Séances
  const rows1 = [['Date', 'Jour', 'Programme', 'Exercice', 'Série', 'Charge (kg)', 'Répétitions', '1RM estimé (kg)']];
  state.history.forEach(h => {
    const d = PROGRAM.find(p => p.id === h.dayId);
    if (!d) return;
    const dateStr = new Date(h.date).toLocaleDateString('fr-FR');
    d.exercises.forEach(ex => {
      for (let i = 0; i < ex.sets; i++) {
        const s = h.sets[`${ex.id}_${i}`];
        if (!s) continue;
        const kg = parseFloat(s.kg) || 0;
        const reps = parseInt(s.reps) || 0;
        const rm = kg > 0 && reps > 0 ? +(calc1RM(kg, reps).toFixed(1)) : '';
        const label = ex.topSet && i === 0 ? 'TOP SET' : `Série ${i+1}`;
        rows1.push([dateStr, d.name, d.subtitle, ex.name, label, kg||'', reps||'', rm]);
      }
    });
  });
  const ws1 = XLSX.utils.aoa_to_sheet(rows1);
  ws1['!cols'] = [14,10,20,30,10,12,13,16].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, 'Séances');

  // Sheet 2: Top Sets progression
  const topExercises = PROGRAM.flatMap(d => d.exercises.filter(e => e.topSet).map(e => ({...e, dayName: d.name})));
  const rows2 = [['Exercice', 'Jour', 'Date', 'Charge (kg)', 'Répétitions', '1RM estimé (kg)']];
  topExercises.forEach(ex => {
    const hist = getTopSetHistory(ex.id);
    // Need full dates, re-fetch
    state.history.forEach(h => {
      const s = h.sets[`${ex.id}_0`];
      if (!s) return;
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps) || 0;
      const rm = kg > 0 && reps > 0 ? +(calc1RM(kg, reps).toFixed(1)) : '';
      rows2.push([ex.name, ex.dayName, new Date(h.date).toLocaleDateString('fr-FR'), kg||'', reps||'', rm]);
    });
  });
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2['!cols'] = [30,10,14,12,13,16].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, 'Top Sets');

  // Sheet 3: Mesures corporelles
  const rows3 = [['Date', 'Poids (kg)', 'Bras (cm)', 'Poitrine (cm)', 'Taille (cm)']];
  state.bodyStats.forEach(b => {
    rows3.push([
      new Date(b.date).toLocaleDateString('fr-FR'),
      parseFloat(b.poids)||'', parseFloat(b.bras)||'',
      parseFloat(b.poitrine)||'', parseFloat(b.taille_cm)||''
    ]);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3['!cols'] = [14,12,12,14,12].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws3, 'Mesures corporelles');

  const filename = `tracker-muscu-${new Date().toISOString().slice(0,10)}.xlsx`;
  XLSX.writeFile(wb, filename);
  showToast('Export Excel téléchargé');
}


// ---- PR CELEBRATION ----
const PR_GIFS = [
  'gifs/felicitation-pd.gif'
];

function openPRCelebrate(prIdx) {
  const pr = state._lastPRs[prIdx];
  if (!pr) return;

  // Pick a random GIF
  const gifSrc = PR_GIFS[Math.floor(Math.random() * PR_GIFS.length)];

  document.getElementById('pr-celebrate-gif').innerHTML =
    `<img src="${gifSrc}" alt="Celebration" onerror="this.parentElement.innerHTML='<div style=\\'display:flex;align-items:center;justify-content:center;height:100%;font-size:80px\\'>🏆</div>'">`;
  document.getElementById('pr-celebrate-title').textContent = '🔥 NOUVEAU RECORD !';
  document.getElementById('pr-celebrate-detail').textContent = pr;
  document.getElementById('pr-celebrate').classList.remove('hidden');

  // Launch confetti
  launchConfetti();
}

function closePRCelebrate() {
  document.getElementById('pr-celebrate').classList.add('hidden');
  const canvas = document.getElementById('pr-confetti');
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function launchConfetti() {
  const canvas = document.getElementById('pr-confetti');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#FFD700', '#FF6B6B', '#4ECDC4', '#A78BFA', '#F97316', '#06B6D4', '#DC2626', '#34D399'];
  const particles = [];

  for (let i = 0; i < 120; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: -20 - Math.random() * canvas.height * 0.5,
      w: 4 + Math.random() * 6,
      h: 8 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * 360,
      rotSpeed: (Math.random() - 0.5) * 12,
      opacity: 1,
    });
  }

  let frame = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let alive = false;

    particles.forEach(p => {
      if (p.opacity <= 0) return;
      alive = true;
      p.x += p.vx;
      p.vy += 0.08;
      p.y += p.vy;
      p.rot += p.rotSpeed;
      if (frame > 60) p.opacity -= 0.008;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot * Math.PI / 180);
      ctx.globalAlpha = Math.max(0, p.opacity);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    frame++;
    if (alive && frame < 300 && !document.getElementById('pr-celebrate').classList.contains('hidden')) {
      requestAnimationFrame(animate);
    }
  }
  requestAnimationFrame(animate);
}


// ---- EXERCISE INFO MODAL ----
function findExercise(exId) {
  for (const day of PROGRAM) {
    for (const ex of day.exercises) {
      if (ex.id === exId) return { ex, day };
    }
  }
  return null;
}

function openInfoModal(exId) {
  const found = findExercise(exId);
  if (!found || !found.ex.info) return;
  const { ex, day } = found;
  const info = ex.info;

  let gifHtml = '';
  if (info.gif) {
    gifHtml = `<div class="info-gif-container">
      <img src="${info.gif}" alt="${ex.name}" onerror="this.parentElement.innerHTML='<div class=\\'gif-placeholder\\'>GIF non trouvé</div>'">
    </div>`;
  }

  let execHtml = '';
  if (info.execution && info.execution.length) {
    execHtml = `<div class="info-section">
      <div class="info-section-title" style="color:${day.accent}"><span class="dot" style="background:${day.accent}"></span>Exécution</div>
      ${info.execution.map(p => `<div class="info-point">${p}</div>`).join('')}
    </div>`;
  }

  let whyHtml = '';
  if (info.interet) {
    whyHtml = `<div class="info-section">
      <div class="info-section-title" style="color:var(--blue)"><span class="dot" style="background:var(--blue)"></span>Pourquoi cet exercice</div>
      <div class="info-why">${info.interet}</div>
    </div>`;
  }

  document.getElementById('swipe-panel-title').innerHTML =
    `${ex.name}<br><span style="font-size:11px;color:${day.accent};font-weight:600">${day.name} · ${ex.format}</span>`;
  document.getElementById('swipe-panel-body').innerHTML = gifHtml + execHtml + whyHtml;

  requestAnimationFrame(() => {
    document.getElementById('swipe-overlay').classList.add('open');
    document.getElementById('swipe-panel').classList.add('open');
  });
}

function closeInfoModal() {
  const panel = document.getElementById('swipe-panel');
  document.getElementById('swipe-overlay').classList.remove('open');
  panel.classList.remove('open');
  panel.style.transform = '';
  document.getElementById('swipe-overlay').style.background = '';
}

// Init swipe-to-close once at startup
(function initSwipeToClose() {
  const panel = document.getElementById('swipe-panel');
  let startX = 0, startY = 0, isDragging = false;

  panel.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    panel.style.transition = 'none';
  }, { passive: true });

  panel.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = Math.abs(e.touches[0].clientY - startY);
    if (dy > 30 && Math.abs(dx) < dy) return;
    if (dx > 0) {
      panel.style.transform = `translateX(${dx}px)`;
      const progress = Math.min(dx / panel.offsetWidth, 1);
      document.getElementById('swipe-overlay').style.background =
        `rgba(0,0,0,${0.6 * (1 - progress)})`;
    }
  }, { passive: true });

  panel.addEventListener('touchend', (e) => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    panel.style.transition = '';
    if (dx > panel.offsetWidth * 0.35) {
      closeInfoModal();
    } else {
      panel.style.transform = 'translateX(0)';
      document.getElementById('swipe-overlay').style.background = '';
    }
  }, { passive: true });
})();


function resetHistory() {
  if (confirm('Supprimer tout l\'historique (muscu, vélo et mesures) ? Cette action est irréversible.')) {
    state.history = [];
    state.veloSessions = [];
    state.bodyStats = [];
    saveState(); showToast('Historique supprimé'); render();
  }
}

// ---- IMPORT EXCEL ----
let importParsedSessions = [];

function openImportModal() {
  importParsedSessions = [];
  document.getElementById('import-preview').style.display = 'none';
  document.getElementById('import-confirm-btn').style.display = 'none';
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-drop-zone').innerHTML = `
    <div class="drop-icon" style="font-size:24px;color:var(--text3)">↓</div>
    <div class="drop-title">Sélectionner un fichier Excel</div>
    <div class="drop-sub">Ou glisse-dépose ton fichier .xlsx ici</div>`;
  document.getElementById('import-modal').classList.remove('hidden');

  // Drag & drop
  const zone = document.getElementById('import-drop-zone');
  zone.ondragover = (e) => { e.preventDefault(); zone.classList.add('dragover'); };
  zone.ondragleave = () => zone.classList.remove('dragover');
  zone.ondrop = (e) => {
    e.preventDefault(); zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) processImportFile(file);
  };
}

function closeImportModal() {
  document.getElementById('import-modal').classList.add('hidden');
  importParsedSessions = [];
}

function handleImportFile(input) {
  const file = input.files[0];
  if (file) processImportFile(file);
}

function processImportFile(file) {
  if (typeof XLSX === 'undefined') { showToast('Bibliothèque XLSX indisponible'); return; }
  if (!file.name.match(/\.xlsx?$/i)) { showToast('Fichier non supporté — utilise un .xlsx'); return; }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array', cellDates: true });

      // Read "Séances" sheet
      const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('ance') || n.toLowerCase().includes('s\u00e9ance')) || wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // Group rows by date + day name → rebuild history entries
      const sessionMap = {}; // key: "date|dayId"

      rows.forEach(row => {
        // Columns: Date, Jour, Programme, Exercice, Série, Charge (kg), Répétitions
        const dateRaw = row['Date'] || '';
        const jourName = (row['Jour'] || '').trim();
        const exName = (row['Exercice'] || '').trim();
        const setLabel = (row['Série'] || '').trim();
        const kg = row['Charge (kg)'];
        const reps = row['Répétitions'];

        if (!dateRaw || !jourName || !exName || (!kg && !reps)) return;

        // Find day in PROGRAM by name
        const day = PROGRAM.find(d => d.name.toLowerCase() === jourName.toLowerCase());
        if (!day) return;

        // Find exercise
        const ex = day.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
        if (!ex) return;

        // Determine set index
        let setIdx = 0;
        if (setLabel === 'TOP SET') setIdx = 0;
        else {
          const m = setLabel.match(/(\d+)/);
          setIdx = m ? parseInt(m[1]) - 1 : 0;
        }

        // Parse date (dd/mm/yyyy or JS Date)
        let isoDate;
        if (dateRaw instanceof Date) {
          isoDate = dateRaw.toISOString();
        } else {
          const parts = String(dateRaw).split('/');
          if (parts.length === 3) {
            isoDate = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T12:00:00`).toISOString();
          } else {
            isoDate = new Date(dateRaw).toISOString();
          }
        }
        if (!isoDate || isoDate === 'Invalid Date') return;

        const key = `${isoDate.slice(0,10)}|${day.id}`;
        if (!sessionMap[key]) {
          sessionMap[key] = { dayId: day.id, date: isoDate, sets: {} };
        }
        const setKey = `${ex.id}_${setIdx}`;
        sessionMap[key].sets[setKey] = { kg: String(kg||'0'), reps: String(reps||'0') };
      });

      importParsedSessions = Object.values(sessionMap);

      if (!importParsedSessions.length) {
        document.getElementById('import-preview').style.display = 'block';
        document.getElementById('import-preview').innerHTML = '⚠️ Aucune séance reconnue dans ce fichier. Vérifie qu\'il s\'agit d\'un export de ce tracker.';
        document.getElementById('import-confirm-btn').style.display = 'none';
        return;
      }

      // Preview
      const existingKeys = new Set(state.history.map(h => `${h.date.slice(0,10)}|${h.dayId}`));
      const newOnes = importParsedSessions.filter(s => !existingKeys.has(`${s.date.slice(0,10)}|${s.dayId}`));
      const dupOnes = importParsedSessions.length - newOnes.length;

      const zone = document.getElementById('import-drop-zone');
      zone.innerHTML = `<div class="drop-icon">✅</div><div class="drop-title" style="color:var(--green)">${file.name}</div><div class="drop-sub">Fichier chargé avec succès</div>`;

      const prev = document.getElementById('import-preview');
      prev.style.display = 'block';
      prev.innerHTML = `<strong>${importParsedSessions.length}</strong> séance${importParsedSessions.length>1?'s':''} trouvée${importParsedSessions.length>1?'s':''} dans le fichier.<br>`
        + (newOnes.length ? `<strong style="color:var(--green)">${newOnes.length} nouvelle${newOnes.length>1?'s':''}</strong> à ajouter.<br>` : '')
        + (dupOnes ? `<span style="color:var(--text3)">${dupOnes} déjà présente${dupOnes>1?'s':''} (ignorée${dupOnes>1?'s':''}).</span>` : '')
        + (newOnes.length === 0 ? '<br><em>Toutes les séances sont déjà dans l\'historique.</em>' : '');

      document.getElementById('import-confirm-btn').style.display = newOnes.length ? 'block' : 'none';

    } catch(err) {
      showToast('Erreur lors de la lecture du fichier');
      console.error(err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function confirmImport() {
  if (!importParsedSessions.length) return;
  const existingKeys = new Set(state.history.map(h => `${h.date.slice(0,10)}|${h.dayId}`));
  const toAdd = importParsedSessions.filter(s => !existingKeys.has(`${s.date.slice(0,10)}|${s.dayId}`));
  if (!toAdd.length) { closeImportModal(); return; }

  // Merge & sort by date
  state.history = [...state.history, ...toAdd].sort((a,b) => new Date(a.date) - new Date(b.date));
  saveState();
  closeImportModal();
  showToast(`${toAdd.length} séance${toAdd.length>1?'s':''} importée${toAdd.length>1?'s':''} ✓`);
  render();
}

function openBasicFit() {
  const ua = navigator.userAgent;
  const isAndroid = /Android/i.test(ua);
  const isIOS     = /iPhone|iPad|iPod/i.test(ua);

  // Liens universels — fiables sur tous les appareils.
  // Sur Android : ouvre le Play Store, puis "Ouvrir" si l'app est installée.
  // Sur iOS     : tente le schéma direct, sinon App Store.
  const IOS_STORE = 'https://apps.apple.com/fr/app/basic-fit/id1048254718';
  const AND_STORE = 'https://play.google.com/store/apps/details?id=com.basicfit.trainingApp';

  if (isAndroid) {
    // Intent URI avec le bon package → ouvre l'app directement
    window.location.href = 'intent://#Intent;package=com.basicfit.trainingApp;end';
    // Fallback : si l'app n'est pas installée, Play Store au bout de 2s
    setTimeout(() => {
      if (!document.hidden) window.location.href = AND_STORE;
    }, 2000);
  }
  else if (isIOS) {
    window.location.href = 'basicfit://';
    setTimeout(() => {
      if (!document.hidden) window.location.href = IOS_STORE;
    }, 1500);
  }
  else {
    window.location.href = AND_STORE;
  }
}

function openVeloModal() {
  document.getElementById('velo-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('velo-distance').value = '';
  document.getElementById('velo-duration').value = '';
  document.getElementById('velo-type').value = 'endurance';
  document.getElementById('velo-modal').classList.remove('hidden');
}

function closeVeloModal() {
  document.getElementById('velo-modal').classList.add('hidden');
}

function saveVeloSession() {
  const distance = parseFloat(document.getElementById('velo-distance').value) || 0;
  const duration = parseInt(document.getElementById('velo-duration').value) || 0;
  const type = document.getElementById('velo-type').value;
  const dateVal = document.getElementById('velo-date').value;

  if (!distance && !duration) { showToast('Remplis au moins la distance ou la durée'); return; }

  const entry = {
    date: dateVal ? new Date(dateVal + 'T12:00:00').toISOString() : new Date().toISOString(),
    distance,
    duration,
    type,
  };

  if (!state.veloSessions) state.veloSessions = [];
  state.veloSessions.push(entry);
  saveState();
  closeVeloModal();
  showToast(`Sortie vélo enregistrée ! ${distance}km`);
  render();
}


// ---- HEATMAP ----
let heatmapOffset = 0;

function shiftHeatmap(dir) {
  heatmapOffset += dir;
  if (heatmapOffset > 0) heatmapOffset = 0;
  render();
}

function renderHeatmap() {
  const today = new Date();
  const weeksToShow = 12;
  const dayColors = { 'A': 'var(--red)', 'B': 'var(--blue)', 'C': 'var(--green)' };
  const veloColor = 'var(--yellow)';

  const sessionMap = {};
  state.history.forEach(h => {
    const dateKey = h.date.slice(0, 10);
    if (!sessionMap[dateKey]) sessionMap[dateKey] = { muscu: [], velo: false };
    sessionMap[dateKey].muscu.push(h.dayId);
  });
  if (state.veloSessions) {
    state.veloSessions.forEach(v => {
      const dateKey = v.date.slice(0, 10);
      if (!sessionMap[dateKey]) sessionMap[dateKey] = { muscu: [], velo: false };
      sessionMap[dateKey].velo = true;
    });
  }

  // End date shifts by offset
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + heatmapOffset * weeksToShow * 7);

  // Find Monday of the week containing endDate
  const endDow = endDate.getDay() || 7; // Sunday=7
  const endMonday = new Date(endDate);
  endMonday.setDate(endDate.getDate() - endDow + 1);

  // Start from (weeksToShow - 1) weeks before that Monday
  const startDate = new Date(endMonday);
  startDate.setDate(endMonday.getDate() - (weeksToShow - 1) * 7);

  const weeks = [];
  const monthLabels = [];
  let lastMonth = -1;
  let firstDate = null, lastDate = null;

  for (let w = 0; w < weeksToShow; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + w * 7 + d);
      const key = cellDate.toISOString().slice(0, 10);
      const data = sessionMap[key] || { muscu: [], velo: false };
      const isFuture = cellDate > today;
      week.push({ date: cellDate, key, ...data, isFuture });
      if (!firstDate) firstDate = new Date(cellDate);
      lastDate = new Date(cellDate);
      if (d === 0) {
        const m = cellDate.getMonth();
        if (m !== lastMonth) {
          monthLabels.push({ week: w, label: cellDate.toLocaleDateString('fr-FR', { month: 'short' }) });
          lastMonth = m;
        }
      }
    }
    weeks.push(week);
  }

  const periodLabel = firstDate && lastDate
    ? `${firstDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'short'})} — ${lastDate.toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}`
    : '';

  let html = `<div class="card heatmap">
    <div class="heatmap-nav">
      <button class="heatmap-nav-btn" onclick="event.stopPropagation();shiftHeatmap(-1)">‹</button>
      <div style="text-align:center">
        <div class="heatmap-title" style="margin:0">Activité</div>
        <div class="heatmap-nav-label">${periodLabel}</div>
      </div>
      <button class="heatmap-nav-btn" onclick="event.stopPropagation();shiftHeatmap(1)" ${heatmapOffset >= 0 ? 'disabled' : ''}>›</button>
    </div>`;

  html += '<div class="heatmap-wrap">';
  html += '<div class="heatmap-months">';
  let lastWeekIdx = -1;
  monthLabels.forEach(ml => {
    const offset = ml.week - (lastWeekIdx + 1);
    if (offset > 0) html += `<div style="flex:0 0 ${offset * 17}px"></div>`;
    html += `<div class="heatmap-month" style="flex:0 0 ${17}px">${ml.label}</div>`;
    lastWeekIdx = ml.week;
  });
  html += '</div>';

  html += '<div class="heatmap-grid">';
  html += '<div class="heatmap-day-labels">';
  ['L','','M','','V','','D'].forEach(l => {
    html += `<div class="heatmap-day-label">${l}</div>`;
  });
  html += '</div>';

  html += '<div class="heatmap-weeks">';
  weeks.forEach(week => {
    html += '<div class="heatmap-week">';
    week.forEach(cell => {
      let bg = 'var(--border)';
      let border = '';
      if (cell.isFuture) {
        bg = 'transparent';
        border = 'border:1px solid var(--border);';
      } else if (cell.muscu.length > 0 && cell.velo) {
        const muscuCol = dayColors[cell.muscu[0]] || 'var(--green)';
        bg = `linear-gradient(135deg, ${muscuCol} 50%, ${veloColor} 50%)`;
      } else if (cell.muscu.length >= 2) {
        bg = 'var(--purple)';
      } else if (cell.muscu.length === 1) {
        bg = dayColors[cell.muscu[0]] || 'var(--green)';
      } else if (cell.velo) {
        bg = veloColor;
      }
      const isToday = cell.key === today.toISOString().slice(0, 10);
      const todayBorder = isToday ? 'border:1.5px solid #fff;' : '';
      html += `<div class="heatmap-cell" style="background:${bg};${border}${todayBorder}"></div>`;
    });
    html += '</div>';
  });
  html += '</div></div></div>';

  html += `<div style="display:flex;gap:10px;align-items:center;justify-content:center;margin-top:12px;font-size:10px;color:var(--text3);flex-wrap:wrap">
    <span>Repos</span><div class="heatmap-cell" style="width:11px;height:11px"></div>
    <span>Jour A</span><div class="heatmap-cell" style="width:11px;height:11px;background:var(--red)"></div>
    <span>Jour B</span><div class="heatmap-cell" style="width:11px;height:11px;background:var(--blue)"></div>
    <span>Jour C</span><div class="heatmap-cell" style="width:11px;height:11px;background:var(--green)"></div>
    <span>Vélo</span><div class="heatmap-cell" style="width:11px;height:11px;background:var(--yellow)"></div>
  </div>`;

  html += '</div>';
  return html;
}


// ---- WEEKLY RECAP ----
function checkWeeklyRecap() {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon
  if (dayOfWeek !== 1) return; // Only show on Monday

  const lastRecapKey = 'lastRecapShown';
  const thisMonday = getWeekKey(now);
  try {
    const lastShown = localStorage.getItem(lastRecapKey);
    if (lastShown === thisMonday) return; // Already shown this week
    localStorage.setItem(lastRecapKey, thisMonday);
  } catch(e) {}

  // Calculate last week stats
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekKey = getWeekKey(lastWeekStart);

  const weekSessions = state.history.filter(h => getWeekKey(h.date) === lastWeekKey);
  const weekVelo = (state.veloSessions||[]).filter(v => getWeekKey(v.date) === lastWeekKey);

  if (!weekSessions.length && !weekVelo.length) return; // No activity last week

  // Calculate total kg lifted
  let totalKg = 0;
  weekSessions.forEach(h => {
    Object.values(h.sets).forEach(s => {
      const kg = parseFloat(s.kg) || 0;
      const reps = parseInt(s.reps) || 0;
      totalKg += kg * reps;
    });
  });

  const veloKm = weekVelo.reduce((a,v) => a + (v.distance||0), 0);

  // Count PRs from last week
  let prCount = 0;
  weekSessions.forEach(h => {
    const idx = state.history.indexOf(h);
    const day = PROGRAM.find(d => d.id === h.dayId);
    if (day && idx > 0) {
      const prs = detectPRs(h, day);
      prCount += prs.length;
    }
  });

  // Build recap
  let recapHtml = `<div class="recap-title">Recap de la semaine</div>
    <div class="recap-sub">Semaine du ${lastWeekStart.toLocaleDateString('fr-FR',{day:'2-digit',month:'long'})}</div>
    <div class="recap-stats">
      <div class="recap-stat">
        <div class="recap-stat-val" style="color:var(--red)">${weekSessions.length}</div>
        <div class="recap-stat-label">Séances muscu</div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-val" style="color:var(--yellow)">${veloKm > 0 ? veloKm.toFixed(0) + 'km' : weekVelo.length}</div>
        <div class="recap-stat-label">${veloKm > 0 ? 'km vélo' : 'Sorties vélo'}</div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-val" style="color:var(--blue)">${totalKg > 1000 ? (totalKg/1000).toFixed(1)+'t' : totalKg.toFixed(0)+'kg'}</div>
        <div class="recap-stat-label">Volume total</div>
      </div>
      <div class="recap-stat">
        <div class="recap-stat-val" style="color:${prCount > 0 ? 'var(--green)' : 'var(--text3)'}">${prCount}</div>
        <div class="recap-stat-label">PRs battus</div>
      </div>
    </div>
    <button class="btn-primary" style="background:var(--purple);margin-top:0" onclick="closeRecap()">C'est parti pour cette semaine 💪</button>`;

  document.getElementById('recap-box').innerHTML = recapHtml;
  document.getElementById('recap-overlay').classList.remove('hidden');
}

function closeRecap() {
  document.getElementById('recap-overlay').classList.add('hidden');
}


// ============ INIT ============
(async () => {
  await loadState();
  render();
  
  // Weekly recap on Monday
  setTimeout(() => checkWeeklyRecap(), 500);

  // Demander le stockage persistant (Android Chrome)
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    console.log('Stockage persistant:', granted ? 'accordé' : 'refusé');
  }

  // Enregistrer le Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker enregistré');
    } catch(e) {
      console.warn('Service Worker non disponible (mode fichier local)');
    }
  }
})();
