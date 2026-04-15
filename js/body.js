// ============ SUIVI CORPOREL ============

function renderBody() {
  let html = '<h2 class="page-title">Suivi corporel</h2>';
  html += '<p class="info-text" style="margin-bottom:10px">Mesure-toi chaque semaine, même jour, le matin à jeun.</p>';
  html += '<div class="warrior-section">Mensurations</div>';

  state.bodyStats.forEach((entry, idx) => {
    const dateStr = new Date(entry.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'long', year:'numeric'});
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

  // Graphes d'évolution
  if (state.bodyStats.length >= 2) {
    const metrics = [
      { key:'poids',     label:'Poids (kg)',          color:'var(--yellow)', hex:'#E4A229', goodDir:'context' },
      { key:'bras',      label:'Tour de bras (cm)',   color:'var(--purple)', hex:'#8B5CF6', goodDir:'up'      },
      { key:'poitrine',  label:'Poitrine (cm)',        color:'var(--blue)',   hex:'#2D7DD2', goodDir:'up'      },
      { key:'taille_cm', label:'Tour de taille (cm)', color:'var(--red)',    hex:'#C23B3B', goodDir:'down'    },
    ];

    metrics.forEach(m => {
      const entries = state.bodyStats.filter(b => b[m.key]).map(b => ({
        val:  parseFloat(b[m.key]),
        date: new Date(b.date).toLocaleDateString('fr-FR', {day:'2-digit', month:'2-digit'})
      }));
      if (entries.length < 2) return;

      const vals  = entries.map(e => e.val);
      const minV  = Math.min(...vals), maxV = Math.max(...vals);
      const range = maxV - minV || 1;
      const diff  = vals[vals.length-1] - vals[0];
      const good  = m.goodDir === 'down' ? diff < 0 : m.goodDir === 'up' ? diff > 0 : true;

      const cH = 80, cW = 320, pX = 8, pT = 16, pB = 4;
      const uH = cH - pT - pB, uW = cW - pX * 2;

      const points = entries.map((e, i) => ({
        x: entries.length===1 ? cW/2 : pX + (i/(entries.length-1))*uW,
        y: pT + uH - ((e.val-minV)/range)*uH,
        val: e.val
      }));

      let linePath = `M${points[0].x},${points[0].y}`;
      let areaPath = `M${points[0].x},${cH-pB}L${points[0].x},${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        linePath += `L${points[i].x},${points[i].y}`;
        areaPath += `L${points[i].x},${points[i].y}`;
      }
      areaPath += `L${points[points.length-1].x},${cH-pB}Z`;

      html += `<div class="card" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:6px">
          <span style="font-size:13px;font-weight:700;color:${m.color}">${m.label}</span>
          <span style="font-size:12px;font-weight:700;color:${good?'var(--green)':'var(--red)'}">${diff>0?'+':''}${diff.toFixed(1)}</span>
        </div>
        <svg class="chart-svg" viewBox="0 0 ${cW} ${cH}" preserveAspectRatio="none" style="height:${cH}px">
          <defs>
            <linearGradient id="bgrad-${m.key}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stop-color="${m.hex}" stop-opacity="0.2"/>
              <stop offset="100%" stop-color="${m.hex}" stop-opacity="0"/>
            </linearGradient>
          </defs>`;

      for (let g = 0; g <= 3; g++) {
        const gy = pT + (uH/3)*g;
        html += `<line x1="${pX}" y1="${gy}" x2="${cW-pX}" y2="${gy}" stroke="var(--border)" stroke-width="0.5"/>`;
      }
      html += `<path d="${areaPath}" fill="url(#bgrad-${m.key})"/>`;
      html += `<path d="${linePath}" fill="none" stroke="${m.hex}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
      points.forEach((p, i) => {
        const isLast = i === points.length-1;
        if (isLast) html += `<circle cx="${p.x}" cy="${p.y}" r="7" fill="${m.hex}" opacity="0.15"/>`;
        html += `<circle cx="${p.x}" cy="${p.y}" r="${isLast?4.5:3}" fill="${isLast?m.hex:'var(--card)'}" stroke="${m.hex}" stroke-width="1.5"/>`;
        html += `<text x="${p.x}" y="${p.y-8<10?p.y+14:p.y-8}" text-anchor="middle" fill="${isLast?m.hex:'var(--text3)'}" font-size="${isLast?10:8}" font-weight="${isLast?700:500}" font-family="Space Grotesk,system-ui">${p.val}</text>`;
      });
      html += '</svg>';
      html += '<div class="chart-labels">';
      entries.forEach(e => { html += `<span>${e.date}</span>`; });
      html += '</div>';
      html += `<div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px">
        <span style="color:var(--text3)">Min: <strong style="color:var(--text2)">${minV.toFixed(1)}</strong></span>
        <span style="color:var(--text3)">Actuel: <strong style="color:${m.color}">${vals[vals.length-1].toFixed(1)}</strong></span>
        <span style="color:var(--text3)">Max: <strong style="color:var(--text2)">${maxV.toFixed(1)}</strong></span>
      </div></div>`;
    });
  }

  document.getElementById('page-body').innerHTML = html;
}

function addBodyStat() {
  state.bodyStats.push({ date:new Date().toISOString(), poids:'', bras:'', poitrine:'', taille_cm:'' });
  saveState(); render();
}

function updateBody(idx, key, val) {
  state.bodyStats[idx][key] = val;
  if (key === 'poids' && val) state.bodyWeight = parseFloat(val);
  saveState();
}
