// ============ HISTORIQUE ============

let editingIdx     = null;
let editingBodyIdx = null;
let editSets       = {};

function renderHistory() {
  let html = '<h2 class="page-title">Historique</h2>'
           + '<div class="warrior-section">Campagnes passées</div>'
           + '<div class="hist-hint">← Glisser pour modifier</div>';

  const allEntries = [];
  state.history.forEach    ((h, i) => allEntries.push({ type:'muscu', data:h, idx:i }));
  (state.veloSessions||[]) .forEach((v, i) => allEntries.push({ type:'velo',  data:v, idx:i }));
  (state.bodyStats||[])    .forEach((b, i) => allEntries.push({ type:'body',  data:b, idx:i }));
  allEntries.sort((a, b) => new Date(b.data.date) - new Date(a.data.date));

  if (!allEntries.length) {
    html += `<div class="card" style="text-align:center;padding:24px">
      <div style="font-size:13px;color:var(--text3)">Aucune activité enregistrée</div>
      <div style="font-size:11px;color:#444;margin-top:4px">Termine ta première séance pour la voir ici</div>
    </div>`;
    html += `<button class="btn-import" onclick="openImportModal()">Charger depuis Excel</button>`;
  } else {
    html += `<button class="btn-export" onclick="exportToExcel()">Exporter tout en Excel</button>`;
    html += `<button class="btn-import" onclick="openImportModal()">Charger depuis Excel</button>`;

    allEntries.forEach(entry => {
      if (entry.type === 'muscu') {
        const h = entry.data, i = entry.idx;
        const found = findDayInfo(h.dayId);
        if (!found) return;
        const d = found.day;
        const setCount = Object.keys(h.sets).length;
        html += `<div class="hist-card hist-card--warrior" style="--hc-accent:${d.accent}" data-hist-action="openEditSession(${i})">
          <div class="hist-card-header">
            <div>
              <div class="hist-card-title"  style="color:${d.accent}">${d.name}</div>
              <div class="hist-card-sub">${d.subtitle}</div>
              <div class="hist-card-date">${formatDate(h.date)}</div>
            </div>
            <div class="hist-card-count">
              <span class="hist-card-count-num"   style="color:${d.accent}">${setCount}</span>
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
      }

      else if (entry.type === 'velo') {
        const v = entry.data, vi = entry.idx;
        const typeLabels = { endurance:'Endurance', long:'Sortie longue', recup:'Récup' };
        html += `<div class="hist-card hist-card--warrior" style="--hc-accent:var(--yellow)" data-hist-action="openEditVelo(${vi})">
          <div class="hist-card-header">
            <div>
              <div class="hist-card-title" style="color:var(--yellow)">Vélo — ${typeLabels[v.type]||v.type}</div>
              <div class="hist-card-date">${formatDate(v.date)}</div>
            </div>
            <div class="hist-card-count">
              ${v.distance ? `<span class="hist-card-count-num" style="color:var(--yellow)">${v.distance}</span><span class="hist-card-count-label">km</span>` : ''}
              ${v.duration ? `<div style="font-size:10px;color:var(--text3);margin-top:2px">${v.duration} min</div>` : ''}
            </div>
          </div>
        </div>`;
      }

      else if (entry.type === 'body') {
        const b = entry.data, bi = entry.idx;
        const vals = [];
        if (b.poids)    vals.push(`${b.poids}kg`);
        if (b.bras)     vals.push(`bras ${b.bras}cm`);
        if (b.poitrine) vals.push(`poit. ${b.poitrine}cm`);
        if (b.taille_cm)vals.push(`taille ${b.taille_cm}cm`);
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

// ── Long-press ────────────────────────────────────────────────────────────────
function initHistSwipe() {
  document.querySelectorAll('[data-hist-action]').forEach(card => {
    const action = card.getAttribute('data-hist-action');
    let startX = 0, startY = 0, tracking = false, fired = false;

    card.addEventListener('touchstart', e => {
      startX   = e.touches[0].clientX;
      startY   = e.touches[0].clientY;
      tracking = true;
      fired    = false;
      card.style.transition = '';
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!tracking || fired) return;
      const dx = e.touches[0].clientX - startX;
      const dy = Math.abs(e.touches[0].clientY - startY);

      // Annuler si scroll vertical
      if (dy > Math.abs(dx) * 0.8 && dy > 8) { tracking = false; return; }

      // Suivre le doigt visuellement
      if (dx < 0) {
        card.style.transform = `translateX(${Math.max(dx * 0.4, -40)}px)`;
      }

      // Seuil atteint
      if (dx < -55) {
        fired    = true;
        tracking = false;
        card.style.transition = 'transform 0.2s cubic-bezier(0.4,0,0.2,1), opacity 0.2s';
        card.style.transform  = 'translateX(-12px)';
        card.style.opacity    = '0.7';
        setTimeout(() => {
          card.style.transform = '';
          card.style.opacity   = '';
          card.style.transition = '';
          eval(action);
        }, 180);
      }
    }, { passive: true });

    const reset = () => {
      if (fired) return;
      tracking = false;
      card.style.transition = 'transform 0.25s ease';
      card.style.transform  = '';
      card.style.opacity    = '';
    };
    card.addEventListener('touchend',    reset, { passive: true });
    card.addEventListener('touchcancel', reset, { passive: true });

    // Desktop : clic droit
    card.addEventListener('contextmenu', e => { e.preventDefault(); eval(action); });
  });
}

// ── Édition séance muscu ──────────────────────────────────────────────────────
function openEditSession(idx) {
  editingIdx = idx;
  const h = state.history[idx];
  const found = findDayInfo(h.dayId);
  if (!found) return;
  const d = found.day;
  editSets = JSON.parse(JSON.stringify(h.sets));

  document.getElementById('edit-modal-title').textContent = `Modifier — ${d.name} · ${formatDate(h.date)}`;
  let body = '';
  d.exercises.forEach(ex => {
    body += `<div style="margin-bottom:12px">
      <div style="font-size:12px;font-weight:700;color:${d.accent};margin-bottom:6px">${ex.name}</div>`;
    for (let i = 0; i < ex.sets; i++) {
      const key   = `${ex.id}_${i}`;
      const s     = editSets[key] || {kg:'', reps:''};
      const isTop = ex.topSet && i === 0;
      body += `<div class="set-row">
        <div class="set-label${isTop?' top':''}" style="--ex-accent:${d.accent}">${isTop?'TOP':`S${i+1}`}</div>
        <div class="input-wrap">
          <input type="number" inputmode="decimal" placeholder="kg" value="${s.kg||''}" oninput="updateEditSet('${key}','kg',this.value)">
          <span class="unit">kg</span>
        </div>
        <div class="input-wrap">
          <input type="number" inputmode="numeric" placeholder="reps" value="${s.reps||''}" oninput="updateEditSet('${key}','reps',this.value)">
          <span class="unit">reps</span>
        </div>
      </div>`;
    }
    body += '</div>';
  });

  document.getElementById('edit-modal-body').innerHTML = body;
  document.getElementById('edit-modal-save').setAttribute('onclick', 'saveEditSession()');
  const delBtn = document.getElementById('edit-modal-delete');
  delBtn.setAttribute('onclick', `deleteSession(${idx})`);
  delBtn.style.display = 'block';
  document.getElementById('edit-modal').classList.remove('hidden');
}

function updateEditSet(key, field, val) {
  if (!editSets[key]) editSets[key] = {kg:'', reps:''};
  editSets[key][field] = val;
  if (!editSets[key].kg && !editSets[key].reps) delete editSets[key];
}

function saveEditSession() {
  if (editingIdx === null) return;
  state.history[editingIdx].sets = JSON.parse(JSON.stringify(editSets));
  saveState(); closeEditModal(); showToast('Séance modifiée ✓'); render();
}

function deleteSession(idx) {
  const h = state.history[idx];
  const d = PROGRAM.find(p => p.id === h.dayId);
  const label = d ? `${d.name} du ${formatDate(h.date)}` : 'cette séance';
  if (confirm(`Supprimer ${label} ? Cette action est irréversible.`)) {
    closeEditModal();
    state.history.splice(idx, 1);
    saveState(); showToast('Séance supprimée'); render();
  }
}

// ── Édition sortie vélo ───────────────────────────────────────────────────────
function openEditVelo(idx) {
  const v = state.veloSessions[idx];
  if (!v) return;
  document.getElementById('edit-modal-title').textContent = `Modifier — Sortie vélo du ${formatDate(v.date)}`;
  document.getElementById('edit-modal-body').innerHTML = `
    <div class="velo-input-row">
      <div class="velo-field"><label>Distance (km)</label><input type="number" inputmode="decimal" id="edit-velo-distance" value="${v.distance||''}"></div>
      <div class="velo-field"><label>Durée (min)</label><input type="number" inputmode="numeric" id="edit-velo-duration" value="${v.duration||''}"></div>
    </div>
    <div class="velo-input-row">
      <div class="velo-field"><label>Type</label>
        <select id="edit-velo-type">
          <option value="endurance" ${v.type==='endurance'?'selected':''}>Endurance</option>
          <option value="long"      ${v.type==='long'     ?'selected':''}>Sortie longue</option>
          <option value="recup"     ${v.type==='recup'    ?'selected':''}>Récupération</option>
        </select>
      </div>
    </div>`;
  document.getElementById('edit-modal-save').setAttribute('onclick', `saveEditVelo(${idx})`);
  const delBtn = document.getElementById('edit-modal-delete');
  delBtn.setAttribute('onclick', `deleteVeloSession(${idx})`);
  delBtn.style.display = 'block';
  document.getElementById('edit-modal').classList.remove('hidden');
}

function saveEditVelo(idx) {
  state.veloSessions[idx].distance = parseFloat(document.getElementById('edit-velo-distance').value) || 0;
  state.veloSessions[idx].duration = parseInt  (document.getElementById('edit-velo-duration').value) || 0;
  state.veloSessions[idx].type     = document.getElementById('edit-velo-type').value;
  saveState(); closeEditModal(); showToast('Sortie vélo modifiée ✓'); render();
}

function deleteVeloSession(idx) {
  const v = state.veloSessions[idx];
  if (confirm(`Supprimer sortie vélo du ${formatDate(v.date)} ?`)) {
    closeEditModal(); state.veloSessions.splice(idx, 1); saveState(); showToast('Sortie vélo supprimée'); render();
  }
}

// ── Édition mesure corporelle ─────────────────────────────────────────────────
function openEditBodyStat(idx) {
  editingBodyIdx = idx;
  const b = state.bodyStats[idx];
  if (!b) return;
  document.getElementById('edit-modal-title').textContent = `Modifier — Mesure du ${formatDate(b.date)}`;
  document.getElementById('edit-modal-body').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div class="stat-field"><label>Poids (kg)</label><input type="number" inputmode="decimal" id="edit-body-poids"    value="${b.poids   ||''}" placeholder="—"></div>
      <div class="stat-field"><label>Tour de bras (cm)</label><input type="number" inputmode="decimal" id="edit-body-bras"     value="${b.bras    ||''}" placeholder="—"></div>
      <div class="stat-field"><label>Poitrine (cm)</label><input type="number" inputmode="decimal" id="edit-body-poitrine" value="${b.poitrine||''}" placeholder="—"></div>
      <div class="stat-field"><label>Tour de taille (cm)</label><input type="number" inputmode="decimal" id="edit-body-taille"  value="${b.taille_cm||''}" placeholder="—"></div>
    </div>`;
  document.getElementById('edit-modal-save').setAttribute('onclick', 'saveEditBodyStat()');
  const delBtn = document.getElementById('edit-modal-delete');
  delBtn.setAttribute('onclick', `deleteBodyStat(${idx})`);
  delBtn.style.display = 'block';
  document.getElementById('edit-modal').classList.remove('hidden');
}

function saveEditBodyStat() {
  if (editingBodyIdx === null) return;
  const b = state.bodyStats[editingBodyIdx];
  b.poids     = document.getElementById('edit-body-poids').value;
  b.bras      = document.getElementById('edit-body-bras').value;
  b.poitrine  = document.getElementById('edit-body-poitrine').value;
  b.taille_cm = document.getElementById('edit-body-taille').value;
  if (b.poids) state.bodyWeight = parseFloat(b.poids);
  editingBodyIdx = null;
  saveState(); closeEditModal(); showToast('Mesure modifiée ✓'); render();
}

function deleteBodyStat(idx) {
  const b = state.bodyStats[idx];
  if (confirm(`Supprimer mesure du ${formatDate(b.date)} ?`)) {
    closeEditModal(); state.bodyStats.splice(idx, 1); saveState(); showToast('Mesure supprimée'); render();
  }
}

// ── Modal partagée ────────────────────────────────────────────────────────────
function closeEditModal() {
  document.getElementById('edit-modal').classList.add('hidden');
  document.getElementById('edit-modal-delete').style.display = 'none';
  editingIdx = editingBodyIdx = null;
  editSets   = {};
}

function resetHistory() {
  if (confirm('Supprimer tout l\'historique (muscu, vélo et mesures) ? Cette action est irréversible.')) {
    state.history = []; state.veloSessions = []; state.bodyStats = [];
    saveState(); showToast('Historique supprimé'); render();
  }
}
