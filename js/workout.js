// ============ SÉANCE ============

function renderWorkout() {
  const day = getActiveProgram()[state.dayIdx];
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

  // Banners PR de la dernière séance
  if (state._lastPRs && state._lastPRs.length) {
    state._lastPRs.forEach((pr, idx) => {
      html += `<div class="pr-banner" onclick="openPRCelebrate(${idx})">
        <div class="pr-icon">🏆</div>
        <div><div class="pr-text">Nouveau record !</div><div class="pr-sub">${pr}</div></div>
        <div class="pr-tap">Voir →</div>
      </div>`;
    });
  }

  // Sélecteur de jour
  html += '<div class="day-sel">';
  getActiveProgram().forEach((d, i) => {
    const active = state.dayIdx === i;
    html += `<button class="day-btn${active?' active':''}" style="--active-color:${d.accent}15;--active-accent:${d.accent}" onclick="selectDay(${i})">
      <div class="day-name">${d.name}</div><div class="day-when">${d.when}</div>
    </button>`;
  });
  html += '</div>';
  html += `<div class="warrior-section">${day.subtitle}</div>`;

  const suggestions = getSuggestions(day);

  // Exercices
  day.exercises.forEach(ex => {
    const isOpen   = state.activeEx === ex.id;
    const lastPerf = getLastPerf(ex.id, 0);
    const sugg     = suggestions[ex.id];
    let tagHtml = '';
    if (ex.topSet)   tagHtml  = '<span class="tag tag-top">TOP SET</span>';
    if (ex.superset) tagHtml  = '<span class="tag tag-ss">SUPERSET</span>';
    if (ex.dropSet)  tagHtml  = '<span class="tag tag-drop">DROP SET</span>';
    if (sugg)        tagHtml += `<span class="suggestion-tag">↑ Essaie ${sugg}kg</span>`;

    html += `<div class="card ex-card${isOpen?' open':''}" style="--ex-accent:${day.accent}" data-exid="${ex.id}" onclick="toggleEx('${ex.id}')">
      <div class="ex-header">
        <div style="flex:1">${tagHtml}
          <div class="ex-name">${ex.name}</div>
          <div class="ex-format">${ex.format}${ex.restTime ? ' <span style="color:var(--text3);font-size:10px">· Repos ' + (ex.restTime >= 60 ? Math.floor(ex.restTime/60) + 'min' : ex.restTime + 's') + '</span>' : ''}</div>
          ${lastPerf ? `<div class="ex-prev" style="text-align:left;margin-top:3px">Préc: <strong style="color:${day.accent}">${lastPerf.kg}kg×${lastPerf.reps}</strong></div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px">
          <div class="ex-arrow">${isOpen?'▾':'▸'}</div>
        </div>
      </div>`;

    if (isOpen) {
      html += '<div class="sets-area">';
      for (let i = 0; i < ex.sets; i++) {
        const prev    = getLastPerf(ex.id, i);
        const isTop   = ex.topSet && i === 0;
        const kgKey   = `${ex.id}_${i}_kg`;
        const repsKey = `${ex.id}_${i}_reps`;
        let sugKg = prev ? prev.kg : '';
        let sugReps = prev ? prev.reps : '';

        if (ex.topSet && i > 0) {
          const topKg   = parseFloat(state.current[`${ex.id}_0_kg`]);
          const topReps = parseInt  (state.current[`${ex.id}_0_reps`]);
          if (topKg   > 0) sugKg   = (Math.round((topKg * 0.85) / 2.5) * 2.5).toFixed(1).replace('.0','');
          if (topReps > 0) sugReps = Math.min(topReps + 2, 8);
          if (!sugKg   && prev) sugKg   = prev.kg;
          if (!sugReps && prev) sugReps = prev.reps;
        } else if (!ex.topSet && i > 0) {
          const prevSetKg   = state.current[`${ex.id}_${i-1}_kg`];
          const prevSetReps = state.current[`${ex.id}_${i-1}_reps`];
          if (prevSetKg)   sugKg   = prevSetKg;
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

        if (ex.topSet && i === 0) {
          const curKg   = parseFloat(state.current[kgKey])   || 0;
          const curReps = parseInt  (state.current[repsKey]) || 0;
          let rmHtml = '';
          if (curKg > 0 && curReps > 0) {
            const rm    = calc1RM(curKg, curReps);
            const bw    = state.bodyWeight || 95;
            const ratio = rm / bw;
            const rk    = ex.rankKey ? getRankIdx(ratio, STANDARDS[ex.rankKey].thresholds) : -1;
            const rkObj = rk >= 0 ? RANKS[rk] : null;
            rmHtml = `<span class="live-1rm ${rkObj?rkObj.cls:''}" style="background:${rkObj?'rgba(255,255,255,0.06)':'transparent'};color:var(--text2)">
              1RM: ${rm.toFixed(1)}kg · ${ratio.toFixed(2)}×BW ${rkObj ? rkObj.icon+' '+rkObj.name : ''}
            </span>`;
          }
          html += `<div id="live1rm-${ex.id}" style="margin:-4px 0 6px 56px">${rmHtml}</div>`;
        }
      }
      html += '</div>';
    }
    html += '</div>';
  });

  // Bouton terminer
  html += `<button class="btn-primary" style="background:${day.accent}" onclick="finishSession('${day.id}')">Terminer la séance ✓</button>`;

  // Rappel tractions
  html += `<div class="card" style="margin-top:10px;border-left:2px solid rgba(194,59,59,0.4);padding-left:12px;font-size:12px;color:var(--text3)">
    <div style="font-family:'Cinzel',serif;font-size:9px;font-weight:700;color:rgba(194,59,59,0.6);letter-spacing:0.2em;text-transform:uppercase;margin-bottom:4px">Ordre supplémentaire</div>
    2×3-5 tractions négatives (5s descente) en fin de séance. Alterner avec dips.
  </div>`;

  html += `<button class="velo-btn"     onclick="openVeloModal()">🚴 Ajouter une sortie vélo</button>`;
  html += `<button class="basicfit-btn" onclick="openBasicFit()">⚔️ Aller au champ de bataille</button>`;

  document.getElementById('page-workout').innerHTML = html;

  // Swipe gauche pour ouvrir le panneau info
  document.querySelectorAll('.ex-card').forEach(card => {
    const exId = card.getAttribute('data-exid');
    if (!exId) return;
    let startX = 0, startY = 0, tracking = false;
    card.addEventListener('touchstart', e => {
      startX = e.touches[0].clientX; startY = e.touches[0].clientY; tracking = true;
    }, { passive: true });
    card.addEventListener('touchmove', e => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx < -40 && dy < Math.abs(dx) * 0.6) { tracking = false; openInfoModal(exId); }
    }, { passive: true });
    card.addEventListener('touchend', () => { tracking = false; }, { passive: true });
  });
}

function selectDay(i)  { state.dayIdx = i; state.activeEx = null; state._lastPRs = null; state._lastTimerSet = null; render(); }
function toggleEx(id)  { state.activeEx = state.activeEx === id ? null : id; render(); }
function updateSet(key, val) { state.current[key] = val; saveState(); }

// ── Logique input + 1RM live ──────────────────────────────────────────────────
function onSetInput(exId, setIdx, kgKey, repsKey, isTopSet, rankKey) {
  if (!state._sessionActive) startSession();

  const kg   = state.current[kgKey];
  const reps = state.current[repsKey];
  if (kg && reps && parseFloat(kg) > 0 && parseInt(reps) > 0) {
    // Ne pas relancer le timer si déjà actif (évite reset à chaque frappe)
    const setKey = `${exId}_${setIdx}`;
    if (!state._lastTimerSet || state._lastTimerSet !== setKey) {
      state._lastTimerSet = setKey;
      startRestTimer(getRestDuration(exId));
    }
    document.querySelectorAll(`input[oninput*="'${kgKey}'"], input[oninput*="'${repsKey}'"]`).forEach(inp => {
      inp.classList.remove('input-flash');
      void inp.offsetWidth;
      inp.classList.add('input-flash');
    });
  }

  if (isTopSet && setIdx === 0 && rankKey) {
    const el = document.getElementById('live1rm-' + exId);
    if (el) {
      const k = parseFloat(state.current[kgKey])   || 0;
      const r = parseInt  (state.current[repsKey]) || 0;
      if (k > 0 && r > 0) {
        const rm    = calc1RM(k, r);
        const bw    = state.bodyWeight || 95;
        const ratio = rm / bw;
        const rk    = getRankIdx(ratio, STANDARDS[rankKey].thresholds);
        const rkObj = rk >= 0 ? RANKS[rk] : null;
        el.innerHTML = `<span class="live-1rm ${rkObj?rkObj.cls:''}" style="background:${rkObj?'rgba(255,255,255,0.06)':'transparent'};color:var(--text2)">
          1RM: ${rm.toFixed(1)}kg · ${ratio.toFixed(2)}×BW ${rkObj ? rkObj.icon+' '+rkObj.name : ''}
        </span>`;
      } else { el.innerHTML = ''; }
    }
    const topKg   = parseFloat(state.current[kgKey])   || 0;
    const topReps = parseInt  (state.current[repsKey]) || 0;
    if (topKg > 0) {
      const sugKg   = (Math.round((topKg * 0.85) / 2.5) * 2.5).toFixed(1).replace('.0','');
      const sugReps = topReps > 0 ? Math.min(topReps + 2, 8) : '';
      for (const day of getActiveProgram()) {
        for (const ex of day.exercises) {
          if (ex.id !== exId) continue;
          for (let s = 1; s < ex.sets; s++) {
            const kgInp   = document.querySelector(`input[oninput*="'${exId}_${s}_kg'"]`);
            const repsInp = document.querySelector(`input[oninput*="'${exId}_${s}_reps'"]`);
            if (kgInp   && !kgInp.value)   kgInp.placeholder   = sugKg;
            if (repsInp && !repsInp.value && sugReps) repsInp.placeholder = sugReps;
          }
        }
      }
    }
  }

  if (!isTopSet && kg) {
    const nextKg = document.querySelector(`input[oninput*="'${exId}_${setIdx+1}_kg'"]`);
    if (nextKg && !nextKg.value) nextKg.placeholder = kg;
  }
  if (!isTopSet && reps) {
    const nextReps = document.querySelector(`input[oninput*="'${exId}_${setIdx+1}_reps'"]`);
    if (nextReps && !nextReps.value) nextReps.placeholder = reps;
  }
}

// ── Terminer la séance ────────────────────────────────────────────────────────
function finishSession(dayId) {
  const day   = getActiveProgram().find(d => d.id === dayId);
  const entry = { dayId, date: new Date().toISOString(), sets: {} };
  let hasData = false;

  day.exercises.forEach(ex => {
    for (let i = 0; i < ex.sets; i++) {
      const kg   = state.current[`${ex.id}_${i}_kg`];
      const reps = state.current[`${ex.id}_${i}_reps`];
      if (kg || reps) {
        entry.sets[`${ex.id}_${i}`] = { kg: kg||'0', reps: reps||'0' };
        hasData = true;
      }
    }
  });

  if (!hasData) { showToast('Saisis au moins une série !'); return; }

  stopSession();
  skipRestTimer();

  day.exercises.forEach(ex => {
    for (let i = 0; i < ex.sets; i++) {
      delete state.current[`${ex.id}_${i}_kg`];
      delete state.current[`${ex.id}_${i}_reps`];
    }
  });

  state.history.push(entry);
  state.activeEx = null;
  state._lastTimerSet = null;

  const prs = detectPRs(entry, day);
  if (prs.length) state._lastPRs = prs;
  saveState();

  const elapsed = sessionStart > 0 ? Math.floor((Date.now() - sessionStart) / 1000) : 0;
  showVictory(day, entry, elapsed, prs);
  render();
}

// ── Victory overlay ───────────────────────────────────────────────────────────
function showVictory(day, entry, elapsedSec, prs) {
  const overlay = document.getElementById('victory-overlay');
  if (!overlay) return;

  const sets          = Object.keys(entry.sets).length;
  const exosCompleted = new Set(Object.keys(entry.sets).map(k => k.split('_')[0])).size;
  const min           = Math.floor(elapsedSec / 60);
  const sec           = elapsedSec % 60;
  const timeStr       = elapsedSec > 0 ? `${min}:${sec.toString().padStart(2,'0')}` : '—';

  let vol = 0;
  Object.values(entry.sets).forEach(s => {
    vol += (parseFloat(s.kg)||0) * (parseInt(s.reps)||0);
  });

  const hex = day.accent.replace('#','');
  const r   = parseInt(hex.substr(0,2), 16);
  const g   = parseInt(hex.substr(2,2), 16);
  const b   = parseInt(hex.substr(4,2), 16);

  overlay.style.setProperty('--victory-accent', day.accent);
  overlay.style.setProperty('--va-rgb', `${r},${g},${b}`);
  document.getElementById('victory-day').textContent  = day.name.toUpperCase() + ' — ' + day.subtitle.toUpperCase();
  document.getElementById('victory-sets').textContent = sets;
  document.getElementById('victory-exos').textContent = exosCompleted;
  document.getElementById('victory-time').textContent = timeStr;
  document.getElementById('victory-vol').textContent  = vol > 0 ? vol.toLocaleString('fr-FR') + ' kg' : '—';

  overlay.classList.remove('hidden', 'out');
  overlay.classList.add('in');

  if (prs && prs.length) {
    setTimeout(() => showToast(`🏆 ${prs.length} PR${prs.length>1?'s':''} battu${prs.length>1?'s':''} !`, 'pr'), 600);
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
    if (state._lastPRs && state._lastPRs.length) openPRCelebrate(0);
  }, 350);
}
