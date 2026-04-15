// ============ PROGRÈS ============

let progressOpenDay = null;
let heatmapOffset   = 0;

function toggleProgressDay(dayId) {
  progressOpenDay = progressOpenDay === dayId ? null : dayId;
  renderProgress();
  document.getElementById('page-progress').classList.add('active');
}

function shiftHeatmap(dir) {
  heatmapOffset += dir;
  if (heatmapOffset > 0) heatmapOffset = 0;
  render();
}

// ── Historique d'un exercice ──────────────────────────────────────────────────
function getExerciseHistory(exId, sets) {
  const results = [];
  state.history.forEach(h => {
    let bestKg = 0, bestReps = 0, best1RM = 0, totalVol = 0, hasData = false;
    for (let s = 0; s < sets; s++) {
      const set = h.sets[`${exId}_${s}`];
      if (!set) continue;
      hasData = true;
      const kg   = parseFloat(set.kg)   || 0;
      const reps = parseInt  (set.reps) || 0;
      totalVol += kg * reps;
      const rm = calc1RM(kg, reps);
      if (rm > best1RM) { best1RM = rm; bestKg = kg; bestReps = reps; }
    }
    if (hasData) results.push({
      date: new Date(h.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'}),
      bestKg, bestReps, best1RM, totalVol
    });
  });
  return results.slice(-12);
}

// ── Graphe linéaire ───────────────────────────────────────────────────────────
function renderLineChart(data, valueKey, color, gradId, unit) {
  if (!data.length) return '<div style="font-size:12px;color:var(--text3);padding:8px 0">Aucune donnée</div>';

  const vals   = data.map(d => d[valueKey]);
  const chartH = 85, chartW = 320, padX = 8, padTop = 18, padBot = 4;
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;
  const usableH = chartH - padTop - padBot, usableW = chartW - padX * 2;

  const points = data.map((d, i) => ({
    x: data.length === 1 ? chartW/2 : padX + (i/(data.length-1)) * usableW,
    y: padTop + usableH - ((d[valueKey]-minV)/range) * usableH,
    v: d[valueKey]
  }));

  let linePath = '', areaPath = '';
  if (points.length > 1) {
    linePath  = `M${points[0].x},${points[0].y}`;
    areaPath  = `M${points[0].x},${chartH-padBot}L${points[0].x},${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      linePath += `L${points[i].x},${points[i].y}`;
      areaPath += `L${points[i].x},${points[i].y}`;
    }
    areaPath += `L${points[points.length-1].x},${chartH-padBot}Z`;
  }

  let svg = `<svg class="chart-svg" viewBox="0 0 ${chartW} ${chartH}" preserveAspectRatio="none" style="height:${chartH}px">
    <defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"   stop-color="${color}" stop-opacity="0.25"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>`;

  for (let g = 0; g <= 3; g++) {
    const gy = padTop + (usableH/3)*g;
    svg += `<line x1="${padX}" y1="${gy}" x2="${chartW-padX}" y2="${gy}" stroke="var(--border)" stroke-width="0.5"/>`;
  }

  if (points.length > 1) {
    svg += `<path d="${areaPath}" fill="url(#${gradId})"/>`;
    svg += `<path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
  }

  points.forEach((p, i) => {
    const isLast = i === points.length - 1;
    if (isLast) svg += `<circle cx="${p.x}" cy="${p.y}" r="8" fill="${color}" opacity="0.15"/>`;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${isLast?5:3.5}" fill="${isLast?color:'var(--card)'}" stroke="${color}" stroke-width="2"/>`;
    const ly    = p.y - 10 < 12 ? p.y + 16 : p.y - 10;
    const label = unit === 'kg' ? Math.round(p.v*10)/10 : Math.round(p.v);
    svg += `<text x="${p.x}" y="${ly}" text-anchor="middle" fill="${isLast?color:'var(--text3)'}" font-size="${isLast?11:9}" font-weight="${isLast?700:500}" font-family="Space Grotesk,system-ui">${label}</text>`;
  });

  svg += '</svg>';
  svg += '<div class="chart-labels">';
  data.forEach(d => { svg += `<span>${d.date}</span>`; });
  svg += '</div>';

  if (data.length > 1) {
    const diff = vals[vals.length-1] - vals[0];
    const col  = diff >= 0 ? 'var(--green)' : 'var(--red)';
    svg += `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px">
      <span style="color:var(--text3)">Départ: <strong style="color:var(--text2)">${vals[0].toFixed(1)}</strong></span>
      <span style="color:var(--text3)">Actuel: <strong style="color:${color}">${vals[vals.length-1].toFixed(1)}</strong></span>
      <span style="color:${col};font-weight:700">${diff>=0?'+':''}${diff.toFixed(1)}</span>
    </div>`;
  }
  return svg;
}

// ── Détail d'un exercice ──────────────────────────────────────────────────────
function renderExerciseDetail(ex, accent) {
  const hist = getExerciseHistory(ex.id, ex.sets);
  let html = '';
  html += `<div style="font-size:14px;font-weight:700;color:${accent};margin-bottom:4px">${ex.name}</div>`;
  html += `<div style="font-size:11px;color:var(--text3);margin-bottom:10px">${ex.format}</div>`;
  if (!hist.length) {
    html += '<div style="font-size:12px;color:var(--text3);padding:4px 0">Aucune donnée encore</div>';
    return html;
  }
  const bestRM  = Math.max(...hist.map(h => h.best1RM));
  const bestKg  = Math.max(...hist.map(h => h.bestKg));
  const lastVol = hist[hist.length-1].totalVol;

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
      <div style="font-size:16px;font-weight:800;color:#F97316">${lastVol>1000?(lastVol/1000).toFixed(1)+'t':lastVol+'kg'}</div>
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

// ── Page Progrès ──────────────────────────────────────────────────────────────
function renderProgress() {
  let html = '<h2 class="page-title">Progrès</h2>';

  // ── Statistiques globales en haut ──────────────────────────────────────────
  const streak    = computeStreak();
  const totalSess = state.history.length;
  let   totalVol  = 0;
  state.history.forEach(h => {
    Object.values(h.sets).forEach(s => {
      totalVol += (parseFloat(s.kg)||0) * (parseInt(s.reps)||0);
    });
  });
  const volStr = totalVol >= 1000000
    ? (totalVol/1000000).toFixed(1) + 't'
    : totalVol >= 1000
    ? (totalVol/1000).toFixed(0) + 'k'
    : totalVol.toFixed(0);

  html += `<div class="prog-stats-grid">
    <div class="prog-stat-cell">
      <div class="prog-stat-val" style="color:var(--red)">${streak}</div>
      <div class="prog-stat-label">Semaines</div>
    </div>
    <div class="prog-stat-sep"></div>
    <div class="prog-stat-cell">
      <div class="prog-stat-val" style="color:var(--text)">${totalSess}</div>
      <div class="prog-stat-label">Séances</div>
    </div>
    <div class="prog-stat-sep"></div>
    <div class="prog-stat-cell">
      <div class="prog-stat-val" style="color:var(--yellow)">${volStr}</div>
      <div class="prog-stat-label">Volume kg</div>
    </div>
  </div>`;

  // ── Activité ──────────────────────────────────────────────────────────────
  html += '<div class="warrior-section">Activité</div>';
  html += renderHeatmap();

  // ── Top lifts ─────────────────────────────────────────────────────────────
  html += '<div class="warrior-section" style="margin-top:20px">Top lifts</div>';
  const prog = getActiveProgram();
  const topExos = prog.flatMap(d => d.exercises.filter(e => e.topSet).map(e => ({...e, accent: d.accent})));

  if (topExos.length) {
    html += '<div class="prog-top-lifts">';
    topExos.forEach(ex => {
      const hist  = getExerciseHistory(ex.id, ex.sets);
      const last  = hist.length ? hist[hist.length-1] : null;
      const bestRM = hist.length ? Math.max(...hist.map(h => h.best1RM)) : 0;
      const trend  = hist.length >= 2
        ? hist[hist.length-1].best1RM - hist[hist.length-2].best1RM
        : 0;
      const trendColor = trend > 0 ? 'var(--green)' : trend < 0 ? 'var(--red)' : 'var(--text3)';
      const trendStr   = trend > 0 ? `+${trend.toFixed(1)}` : trend < 0 ? trend.toFixed(1) : '—';

      html += `<div class="prog-top-lift-card" style="border-left:3px solid ${ex.accent}">
        <div class="prog-top-lift-name" style="color:${ex.accent}">${ex.name.split(' ').slice(0,3).join(' ')}</div>
        <div class="prog-top-lift-row">
          <div>
            <div class="prog-top-lift-val">${last ? last.bestKg + '<span style="font-size:10px">kg×' + last.bestReps + '</span>' : '—'}</div>
            <div class="prog-top-lift-sub">Dernière séance</div>
          </div>
          <div style="text-align:right">
            <div class="prog-top-lift-rm">${bestRM > 0 ? bestRM.toFixed(0) + 'kg' : '—'}</div>
            <div class="prog-top-lift-sub">1RM max</div>
          </div>
          <div style="text-align:right;min-width:36px">
            <div style="font-size:13px;font-weight:700;color:${trendColor}">${trendStr}</div>
            <div class="prog-top-lift-sub">Tendance</div>
          </div>
        </div>
      </div>`;
    });
    html += '</div>';
  }

  // ── Détail par jour ────────────────────────────────────────────────────────
  html += '<div class="warrior-section" style="margin-top:20px">Détail par exercice</div>';
  prog.forEach(d => {
    const isOpen = progressOpenDay === d.id;
    const count  = state.history.filter(h => h.dayId === d.id).length;
    html += `<div class="card" style="margin-bottom:6px;cursor:pointer;border-left:3px solid ${d.accent}" onclick="toggleProgressDay('${d.id}')">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-family:'Cinzel',serif;font-size:11px;font-weight:700;color:${d.accent};letter-spacing:0.06em;text-transform:uppercase">${d.name}</div>
          <div style="font-size:10px;color:var(--text3);margin-top:2px">${count} séance${count!==1?'s':''} · ${d.exercises.length} exercices</div>
        </div>
        <div style="font-size:16px;color:${isOpen?d.accent:'var(--text3)'};transition:0.15s">${isOpen?'▾':'▸'}</div>
      </div>
    </div>`;
    if (isOpen) {
      d.exercises.forEach(ex => {
        html += `<div class="card" style="margin-bottom:6px;margin-left:8px;border-left:2px solid ${d.accent}35;animation:setsSlide 0.25s ease">`;
        html += renderExerciseDetail(ex, d.accent);
        html += '</div>';
      });
    }
  });

  // ── Vélo ───────────────────────────────────────────────────────────────────
  if (state.veloSessions && state.veloSessions.length) {
    const totalKm  = state.veloSessions.reduce((a, v) => a+(v.distance||0), 0);
    const totalMin = state.veloSessions.reduce((a, v) => a+(v.duration||0), 0);
    const totalH   = Math.floor(totalMin/60);
    const remMin   = totalMin % 60;
    html += `<div class="warrior-section" style="margin-top:16px">Vélo</div>
    <div class="prog-top-lift-card" style="border-left:3px solid var(--yellow)">
      <div class="prog-top-lift-row">
        <div>
          <div class="prog-top-lift-val" style="color:var(--yellow)">${state.veloSessions.length}</div>
          <div class="prog-top-lift-sub">Sorties</div>
        </div>
        <div>
          <div class="prog-top-lift-val">${totalKm.toFixed(0)}<span style="font-size:10px">km</span></div>
          <div class="prog-top-lift-sub">Distance</div>
        </div>
        <div>
          <div class="prog-top-lift-val">${totalH}<span style="font-size:10px">h${remMin>0?remMin+'m':''}</span></div>
          <div class="prog-top-lift-sub">Durée</div>
        </div>
      </div>
    </div>`;
  }

  document.getElementById('page-progress').innerHTML = html;
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function renderHeatmap() {
  const today      = new Date();
  const weeksToShow = 12;
  const dayColors  = { A:'var(--red)', B:'var(--blue)', C:'var(--green)' };
  const veloColor  = 'var(--yellow)';

  const sessionMap = {};
  state.history.forEach(h => {
    const k = h.date.slice(0,10);
    if (!sessionMap[k]) sessionMap[k] = { muscu:[], velo:false };
    sessionMap[k].muscu.push(h.dayId);
  });
  (state.veloSessions||[]).forEach(v => {
    const k = v.date.slice(0,10);
    if (!sessionMap[k]) sessionMap[k] = { muscu:[], velo:false };
    sessionMap[k].velo = true;
  });

  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + heatmapOffset * weeksToShow * 7);
  const endDow    = endDate.getDay() || 7;
  const endMonday = new Date(endDate);
  endMonday.setDate(endDate.getDate() - endDow + 1);
  const startDate = new Date(endMonday);
  startDate.setDate(endMonday.getDate() - (weeksToShow-1)*7);

  const weeks = [], monthLabels = [];
  let lastMonth = -1, firstDate = null, lastDate = null;

  for (let w = 0; w < weeksToShow; w++) {
    const week = [];
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startDate);
      cellDate.setDate(startDate.getDate() + w*7 + d);
      const key  = cellDate.toISOString().slice(0,10);
      const data = sessionMap[key] || { muscu:[], velo:false };
      const isFuture = cellDate > today;
      week.push({ date:cellDate, key, ...data, isFuture });
      if (!firstDate) firstDate = new Date(cellDate);
      lastDate = new Date(cellDate);
      if (d === 0) {
        const m = cellDate.getMonth();
        if (m !== lastMonth) {
          monthLabels.push({ week:w, label:cellDate.toLocaleDateString('fr-FR',{month:'short'}) });
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
      <button class="heatmap-nav-btn" onclick="event.stopPropagation();shiftHeatmap(1)" ${heatmapOffset>=0?'disabled':''}>›</button>
    </div>
    <div class="heatmap-wrap">
    <div class="heatmap-months">`;

  let lastWeekIdx = -1;
  monthLabels.forEach(ml => {
    const off = ml.week - (lastWeekIdx+1);
    if (off > 0) html += `<div style="flex:0 0 ${off*17}px"></div>`;
    html += `<div class="heatmap-month" style="flex:0 0 ${17}px">${ml.label}</div>`;
    lastWeekIdx = ml.week;
  });
  html += '</div><div class="heatmap-grid"><div class="heatmap-day-labels">';
  ['L','','M','','V','','D'].forEach(l => { html += `<div class="heatmap-day-label">${l}</div>`; });
  html += '</div><div class="heatmap-weeks">';

  weeks.forEach(week => {
    html += '<div class="heatmap-week">';
    week.forEach(cell => {
      let bg = 'var(--border)', border = '';
      if      (cell.isFuture)               { bg = 'transparent'; border = 'border:1px solid var(--border);'; }
      else if (cell.muscu.length>0 && cell.velo) {
        const mc = dayColors[cell.muscu[0]] || 'var(--green)';
        bg = `linear-gradient(135deg, ${mc} 50%, ${veloColor} 50%)`;
      }
      else if (cell.muscu.length >= 2)     bg = 'var(--purple)';
      else if (cell.muscu.length === 1)    bg = dayColors[cell.muscu[0]] || 'var(--green)';
      else if (cell.velo)                  bg = veloColor;
      const isToday     = cell.key === today.toISOString().slice(0,10);
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
  </div></div>`;
  return html;
}
