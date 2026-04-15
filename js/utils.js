// ============ UTILITAIRES ============

// ── Calculs force ─────────────────────────────────────────────────────────────
function calc1RM(kg, reps) {
  if (!kg || !reps || kg <= 0 || reps <= 0) return 0;
  if (reps === 1) return kg;
  return kg * (1 + reps / 30); // Formule d'Epley
}

function getRankIdx(ratio, thresholds) {
  let idx = -1;
  for (let i = 0; i < thresholds.length; i++) {
    if (ratio >= thresholds[i]) idx = i;
  }
  return idx;
}

function getProgressInRank(ratio, thresholds, rankIdx) {
  if (rankIdx < 0)                         return ratio / thresholds[0];
  if (rankIdx >= thresholds.length - 1)    return 1;
  const low  = thresholds[rankIdx];
  const high = thresholds[rankIdx + 1];
  return (ratio - low) / (high - low);
}

// ── Historique ────────────────────────────────────────────────────────────────
function getBest1RM(rankKey) {
  let best = 0;
  state.history.forEach(h => {
    const found = findDayInfo(h.dayId);
    const day = found ? found.day : null;
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
      date: new Date(h.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}),
      kg:   parseFloat(h.sets[`${exId}_0`].kg)  || 0,
      reps: parseInt  (h.sets[`${exId}_0`].reps) || 0,
    }))
    .slice(-12);
}

// ── PR Detection ──────────────────────────────────────────────────────────────
function getBestKgBefore(exId, setIdx, beforeIdx) {
  let best = 0;
  for (let i = 0; i < beforeIdx; i++) {
    const s = state.history[i].sets[`${exId}_${setIdx}`];
    if (s) { const kg = parseFloat(s.kg) || 0; if (kg > best) best = kg; }
  }
  return best;
}

function detectPRs(entry, day) {
  const idx = state.history.length - 1;
  const prs = [];
  day.exercises.forEach(ex => {
    for (let i = 0; i < ex.sets; i++) {
      const s = entry.sets[`${ex.id}_${i}`];
      if (!s) continue;
      const kg = parseFloat(s.kg) || 0;
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

// ── Suggestions de progression ────────────────────────────────────────────────
function parseUpperReps(format) {
  const m = format.match(/(\d+)-(\d+)/);
  return m ? parseInt(m[2]) : null;
}

function getSuggestions(day) {
  const suggestions = {};
  day.exercises.forEach(ex => {
    const upper = parseUpperReps(ex.format);
    if (!upper) return;
    let allHit = false, anyData = false;
    for (let i = 0; i < ex.sets; i++) {
      const last = getLastPerf(ex.id, i);
      if (!last) { allHit = false; break; }
      anyData = true;
      if (parseInt(last.reps) < upper) { allHit = false; break; }
      allHit = true;
    }
    if (anyData && allHit) {
      const lastKg = parseFloat(getLastPerf(ex.id, 0).kg) || 0;
      suggestions[ex.id] = lastKg + 2.5;
    }
  });
  return suggestions;
}

// ── Streak hebdomadaire ───────────────────────────────────────────────────────
function getWeekKey(date) {
  const d   = new Date(date);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return d.toISOString().slice(0, 10);
}

function computeStreak() {
  if (!state.history.length) return 0;
  const weeks  = new Set(state.history.map(h => getWeekKey(h.date)));
  const sorted = [...weeks].sort().reverse();
  const thisWeek = getWeekKey(new Date());
  const lastWeek = getWeekKey(new Date(Date.now() - 7*24*3600*1000));
  if (sorted[0] !== thisWeek && sorted[0] !== lastWeek) return 0;
  let streak = 0;
  let cursor = new Date(sorted[0]);
  for (const w of sorted) {
    if (w === getWeekKey(cursor)) {
      streak++;
      cursor = new Date(cursor.getTime() - 7*24*3600*1000);
    } else break;
  }
  return streak;
}

// ── Utilitaires UI ────────────────────────────────────────────────────────────
function formatDate(iso) {
  return new Date(iso).toLocaleDateString('fr-FR', {weekday:'long', day:'2-digit', month:'long'});
}

function showToast(msg, type) {
  const t = document.getElementById('toast');

  // Icône selon le type
  const icons = { pr: '🏆', err: '⚠' };
  const labels = { pr: 'Record', err: 'Attention' };
  const iconText = labels[type] || 'Info';

  t.className = 'toast' + (type ? ' ' + type : '');
  t.innerHTML = `<span class="toast-icon">${iconText}</span><div class="toast-sep"></div><span class="toast-msg">${msg}</span>`;

  // Clear tout timer précédent
  if (t._timer) clearTimeout(t._timer);
  t.classList.add('show');
  t._timer = setTimeout(() => t.classList.remove('show'), 2800);
}
