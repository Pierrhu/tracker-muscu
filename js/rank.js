// ============ RANG ============

function renderRank() {
  let html = '<h2 class="page-title">Rang</h2>';
  const bw = state.bodyWeight || 95;

  html += `<div class="weight-banner">
    <span style="font-size:14px;font-weight:700;color:#000">Poids actuel</span>
    <input type="number" inputmode="decimal" value="${state.bodyWeight||''}" placeholder="kg" onchange="updateWeight(this.value)">
    <span style="font-size:13px;color:rgba(0,0,0,0.6);font-weight:600">kg</span>
  </div>`;

  let totalRankIdx = 0, rankCount = 0;

  Object.keys(STANDARDS).forEach(key => {
    const std      = STANDARDS[key];
    const best1RM  = getBest1RM(key);
    const ratio    = bw > 0 ? best1RM / bw : 0;
    const rankIdx  = getRankIdx(ratio, std.thresholds);
    const progress = getProgressInRank(ratio, std.thresholds, rankIdx);
    const rank     = rankIdx >= 0 ? RANKS[rankIdx] : null;
    const nextRank = rankIdx < RANKS.length - 1 ? RANKS[rankIdx + 1] : null;
    const nextThr  = rankIdx < std.thresholds.length - 1 ? std.thresholds[rankIdx + 1] : null;
    const nextKg   = nextThr ? (nextThr * bw).toFixed(1) : null;

    if (rankIdx >= 0) { totalRankIdx += rankIdx; rankCount++; }

    html += `<div class="rank-card ${rank?rank.cls:'rank-bronze'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div>
          <div style="font-size:13px;font-weight:700;color:var(--text)">${std.name}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:2px">
            1RM estimé: <strong style="color:var(--text)">${best1RM>0?best1RM.toFixed(1)+'kg':'—'}</strong>
            · Ratio: <strong style="color:var(--text)">${ratio>0?ratio.toFixed(2)+'×BW':'—'}</strong>
          </div>
        </div>
        ${rank
          ? `<div class="rank-badge">${rank.icon} ${rank.name}</div>`
          : '<div class="rank-badge" style="background:rgba(255,255,255,0.05);color:#555">Non classé</div>'}
      </div>
      <div class="rank-bar-bg"><div class="rank-bar-fill" style="width:${Math.min(Math.max(progress*100,2),100)}%"></div></div>
      ${nextRank && nextKg ? `<div style="font-size:10px;color:var(--text3)">Prochain: ${nextRank.icon} ${nextRank.name} → ${nextKg}kg (${nextThr.toFixed(2)}×BW)</div>` : ''}
    </div>`;
  });

  // Rang global
  const overallIdx  = rankCount > 0 ? Math.floor(totalRankIdx / rankCount) : -1;
  const overallRank = overallIdx >= 0 ? RANKS[overallIdx] : null;
  let overallProgress = 0;
  if (rankCount > 0) {
    let totalProg = 0;
    Object.keys(STANDARDS).forEach(key => {
      const std   = STANDARDS[key];
      const best  = getBest1RM(key);
      const ratio = bw > 0 ? best / bw : 0;
      const rIdx  = getRankIdx(ratio, std.thresholds);
      totalProg  += getProgressInRank(ratio, std.thresholds, rIdx);
    });
    overallProgress = totalProg / Object.keys(STANDARDS).length;
  }

  const ringR    = 58;
  const ringCirc = 2 * Math.PI * ringR;
  const ringOff  = ringCirc * (1 - Math.min(overallProgress, 1));

  const overallHtml = overallRank
    ? `<div class="overall-rank ${overallRank.cls}">
        <div class="progress-ring-wrap">
          <svg class="progress-ring" width="140" height="140" viewBox="0 0 140 140">
            <circle class="progress-ring-bg" cx="70" cy="70" r="${ringR}"/>
            <circle class="progress-ring-fill" cx="70" cy="70" r="${ringR}" stroke="var(--rc)" stroke-dasharray="${ringCirc}" stroke-dashoffset="${ringOff}"/>
          </svg>
          <div class="progress-ring-center"><div class="rank-icon">${overallRank.icon}</div></div>
        </div>
        <div class="rank-name" style="color:var(--rc)">${overallRank.name}</div>
        <div class="rank-sub">Rang global · ${Math.round(overallProgress*100)}% vers le suivant</div>
      </div>`
    : `<div class="overall-rank rank-bronze">
        <div class="progress-ring-wrap">
          <svg class="progress-ring" width="140" height="140" viewBox="0 0 140 140">
            <circle class="progress-ring-bg" cx="70" cy="70" r="${ringR}"/>
          </svg>
          <div class="progress-ring-center"><div class="rank-icon">🎯</div></div>
        </div>
        <div class="rank-name" style="color:var(--text3)">Non classé</div>
        <div class="rank-sub">Termine quelques séances pour débloquer ton rang</div>
      </div>`;

  html = overallHtml + html;

  // Légende
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

  html += `<div class="card" style="margin-top:8px">
    <div style="font-size:12px;color:var(--text3);line-height:1.6">
      <strong style="color:var(--text2)">Méthode :</strong> Le 1RM est estimé via la formule d'Epley (charge × (1 + reps/30)).
      Le ratio 1RM/poids de corps est comparé à des standards reconnus, adaptés par exercice.
      Le rang global est la moyenne de tes 3 top sets.
    </div>
  </div>`;

  document.getElementById('page-rank').innerHTML = html;
}

function updateWeight(val) {
  state.bodyWeight = parseFloat(val) || 0;
  saveState();
  render();
}
