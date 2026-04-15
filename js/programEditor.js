// ============ PAGE PROGRAMMES & ÉDITEUR ============

// ── État de l'éditeur ─────────────────────────────────────────────────────────
let editorData = null; // programme en cours de création/édition
let editorStep = 1;    // 1 = Identité, 2 = Jours, 3 = Exercices
let editorDayTab = 0;  // onglet actif dans l'étape 3
let pickerOpen = false;
let pickerTargetDayIdx = 0;

const ACCENT_PRESETS = [
  '#C23B3B', '#2D7DD2', '#1A9E8F', '#E4A229',
  '#8B5CF6', '#F97316', '#06B6D4', '#EC4899',
];

const OBJECTIVE_LABELS = {
  force:   'Force',
  volume:  'Volume',
  mixte:   'Force & Volume',
};

// ── Rendu de la page Programmes ───────────────────────────────────────────────
function renderPrograms() {
  const activeId  = state.activeProgramId || DEFAULT_PROGRAM_ID;
  const customs   = state.customPrograms  || [];
  const allProgs  = [
    { id: DEFAULT_PROGRAM_ID, name: 'Programme Ponos', objective: 'force', days: PROGRAM, isDefault: true },
    ...customs,
  ];

  let html = '<h2 class="page-title">Programmes</h2>';
  html += '<div class="warrior-section">Missions disponibles</div>';
  html += '<div class="hist-hint" style="margin:0 0 14px">← Glisser pour modifier</div>';

  allProgs.forEach(prog => {
    const isActive = prog.id === activeId;
    html += `<div class="prog-card${isActive?' prog-card--active':''}" data-prog-id="${prog.id}" onclick="activateProgram('${prog.id}')">`;

    // Badge actif
    if (isActive) {
      html += `<div class="prog-active-badge">
        <svg width="10" height="10" viewBox="0 0 10 10"><path d="M5 1L9 3L9 6Q9 9 5 10Q1 9 1 6L1 3Z" fill="none" stroke="currentColor" stroke-width="1"/></svg>
        EN COURS
      </div>`;
    }

    // Nom + objectif
    html += `<div class="prog-card-header">
      <div class="prog-card-name">${prog.name.toUpperCase()}</div>
      <div class="prog-card-meta">${OBJECTIVE_LABELS[prog.objective] || prog.objective} · ${prog.days.length} jour${prog.days.length > 1 ? 's' : ''}</div>
    </div>`;

    // Jours (pastilles colorées)
    html += '<div class="prog-day-dots">';
    prog.days.forEach(day => {
      html += `<div class="prog-day-dot" style="background:${day.accent}">
        <span class="prog-day-dot-label">${day.name.replace('Jour ','').charAt(0)}</span>
      </div>`;
    });
    html += '</div>';

    // Noms des jours
    html += '<div class="prog-day-names">';
    prog.days.forEach(day => {
      html += `<span class="prog-day-name" style="color:${day.accent}">${day.name}</span>`;
    });
    html += '</div>';

    // Estimation de durée
    const estTime = estimateSessionTime(prog.days);
    if (estTime) {
      html += `<div class="prog-est-time">⏱ ${estTime} estimé par séance</div>`;
    }

    html += '</div>';
  });

  // Bouton créer
  html += `<div class="prog-create-btn" onclick="openProgramEditor(null)">
    <div class="prog-create-icon">＋</div>
    <div class="prog-create-label">Nouvelle mission</div>
  </div>`;

  document.getElementById('page-programs').innerHTML = html;
  initProgramLongPress();
}

function estimateSessionTime(days) {
  if (!days || !days.length) return null;
  // Moyenne sur les jours
  let totalSec = 0;
  days.forEach(day => {
    let daySec = 0;
    (day.exercises || []).forEach(ex => {
      const rest = ex.restTime || 90;
      const sets = ex.sets || 3;
      // ~40s par série + temps de repos
      daySec += sets * (40 + rest);
    });
    // Ajouter ~10min d'échauffement
    daySec += 600;
    totalSec += daySec;
  });
  const avgSec = totalSec / days.length;
  const min    = Math.round(avgSec / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min/60)}h${min%60 > 0 ? (min%60)+'min' : ''}`;
}

function activateProgram(id) {
  setActiveProgram(id);
  renderPrograms();
  // Flash visuel de confirmation
  showToast(id === DEFAULT_PROGRAM_ID ? 'Programme Ponos activé' : 'Programme activé');
}

// Long-press pour éditer/supprimer
function initProgramLongPress() {
  document.querySelectorAll('.prog-card[data-prog-id]').forEach(card => {
    const id = card.getAttribute('data-prog-id');

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
      if (dy > Math.abs(dx) * 0.8 && dy > 8) { tracking = false; return; }
      if (dx < 0) card.style.transform = `translateX(${Math.max(dx * 0.4, -36)}px)`;
      if (dx < -55) {
        fired = true; tracking = false;
        card.style.transition = 'transform 0.2s ease, opacity 0.2s';
        card.style.transform  = 'translateX(-10px)';
        card.style.opacity    = '0.65';
        setTimeout(() => {
          card.style.transform = '';
          card.style.opacity   = '';
          card.style.transition = '';
          openProgramMenu(id);
        }, 180);
      }
    }, { passive: true });

    const reset = () => {
      if (fired) return;
      tracking = false;
      card.style.transition = 'transform 0.2s ease';
      card.style.transform  = '';
      card.style.opacity    = '';
    };
    card.addEventListener('touchend',    reset, { passive: true });
    card.addEventListener('touchcancel', reset, { passive: true });
    card.addEventListener('contextmenu', e => { e.preventDefault(); openProgramMenu(id); });
  });
}

function openProgramMenu(id) {
  // Afficher des boutons d'action inline sur la carte
  const existing = document.getElementById('prog-actions-' + id);
  if (existing) { existing.remove(); return; }

  // Fermer tous les autres menus ouverts
  document.querySelectorAll('.prog-action-strip').forEach(el => el.remove());

  const isDefault = id === DEFAULT_PROGRAM_ID;
  const strip = document.createElement('div');
  strip.id        = 'prog-actions-' + id;
  strip.className = 'prog-action-strip';
  strip.innerHTML = isDefault
    ? `
    <button class="prog-action-btn prog-action-edit" onclick="openProgramEditor('${id}');document.getElementById('prog-actions-${id}')?.remove()">
      ✎ Modifier (copie)
    </button>`
    : `
    <button class="prog-action-btn prog-action-edit" onclick="openProgramEditor('${id}');document.getElementById('prog-actions-${id}')?.remove()">
      ✎ Modifier
    </button>
    <button class="prog-action-btn prog-action-del" onclick="confirmDeleteProgram('${id}')">
      ✕ Supprimer
    </button>
  `;

  // Insérer après la carte correspondante
  const card = document.querySelector(`[data-prog-id='${id}']`);
  if (card) {
    card.insertAdjacentElement('afterend', strip);
    // Auto-fermer si clic ailleurs
    setTimeout(() => {
      document.addEventListener('touchstart', function dismiss(e) {
        if (!strip.contains(e.target) && !card.contains(e.target)) {
          strip.remove();
          document.removeEventListener('touchstart', dismiss);
        }
      }, { passive: true });
    }, 100);
  }
}

function confirmDeleteProgram(id) {
  // Fermer le menu d'actions
  document.getElementById('prog-actions-' + id)?.remove();

  // Trouver le nom du programme
  const prog = (state.customPrograms || []).find(p => p.id === id);
  const name = prog ? prog.name : 'ce programme';

  if (!confirm(`Supprimer "${name}" ?\nCette action est irréversible.`)) return;

  deleteCustomProgram(id);
  renderPrograms();
  showToast('Programme supprimé');
}

// ── Éditeur de programme ──────────────────────────────────────────────────────

function openProgramEditor(id) {
  editorStep   = 1;
  editorDayTab = 0;
  pickerOpen   = false;

  if (id) {
    if (id === DEFAULT_PROGRAM_ID) {
      // Édition du programme par défaut — on prépare une copie custom
      editorData = JSON.parse(JSON.stringify({
        id:        null, // sera créé à la sauvegarde
        name:      'Programme Ponos',
        objective: 'force',
        days:      PROGRAM,
        _fromDefault: true,
      }));
    } else {
      // Édition d'un programme custom existant — deep copy
      const existing = (state.customPrograms || []).find(p => p.id === id);
      editorData = JSON.parse(JSON.stringify(existing));
    }
  } else {
    // Nouveau programme
    editorData = {
      id:        null,
      name:      '',
      objective: 'force',
      days:      [
        { id: 'new-day-0', name: 'Jour A', when: 'Lundi',    accent: ACCENT_PRESETS[0], subtitle: '', exercises: [] },
        { id: 'new-day-1', name: 'Jour B', when: 'Mercredi', accent: ACCENT_PRESETS[1], subtitle: '', exercises: [] },
        { id: 'new-day-2', name: 'Jour C', when: 'Vendredi', accent: ACCENT_PRESETS[2], subtitle: '', exercises: [] },
      ],
    };
  }

  renderEditorOverlay();
}

function renderEditorOverlay() {
  // Créer ou réutiliser l'overlay
  let overlay = document.getElementById('editor-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'editor-overlay';
    document.body.appendChild(overlay);
  }

  const stepLabels = ['Identité', 'Jours', 'Exercices'];
  const dots = stepLabels.map((l, i) =>
    `<div class="editor-step-dot ${editorStep === i+1 ? 'active' : editorStep > i+1 ? 'done' : ''}"></div>`
  ).join('');

  overlay.className = 'editor-overlay';
  overlay.innerHTML = `
    <div class="editor-header">
      <button class="editor-close" onclick="closeEditor()">✕</button>
      <div class="editor-phase">
        <div class="editor-phase-label">PHASE ${editorStep}/3</div>
        <div class="editor-phase-name">${stepLabels[editorStep-1].toUpperCase()}</div>
      </div>
      <div class="editor-step-dots">${dots}</div>
    </div>

    <div class="editor-body" id="editor-body">
      ${editorStep === 1 ? renderEditorStep1() : ''}
      ${editorStep === 2 ? renderEditorStep2() : ''}
      ${editorStep === 3 ? renderEditorStep3() : ''}
    </div>

    <div class="editor-footer">
      ${editorStep > 1
        ? '<button class="editor-btn editor-btn-prev" onclick="editorPrev()">← Précédent</button>'
        : '<div></div>'}
      ${editorStep < 3
        ? '<button class="editor-btn editor-btn-next" onclick="editorNext()">Suivant →</button>'
        : '<button class="editor-btn editor-btn-save" onclick="editorSave()">✓ Enregistrer</button>'}
    </div>
  `;

  // Animer l'entrée
  requestAnimationFrame(() => overlay.classList.add('open'));
}

// ── Étape 1 : Identité ────────────────────────────────────────────────────────
function renderEditorStep1() {
  const objectives = [
    { id:'force',  label:'Force',   icon:'⚡' },
    { id:'volume', label:'Volume',  icon:'🔥' },
    { id:'mixte',  label:'Mixte',   icon:'⚔️' },
  ];

  const dayCounts = [1,2,3,4,5,6];

  return `
    <div class="editor-field">
      <div class="editor-field-label">Nom du programme</div>
      <input class="editor-input" type="text" placeholder="ex: Push Pull Legs"
        value="${editorData.name}"
        oninput="editorData.name = this.value">
    </div>

    <div class="editor-field">
      <div class="editor-field-label">Objectif</div>
      <div class="editor-radio-row">
        ${objectives.map(o => `
          <button class="editor-radio ${editorData.objective === o.id ? 'active' : ''}"
            onclick="editorData.objective='${o.id}'; document.querySelectorAll('.editor-radio').forEach(b=>b.classList.remove('active')); this.classList.add('active')">
            ${o.icon} ${o.label}
          </button>`).join('')}
      </div>
    </div>

    <div class="editor-field">
      <div class="editor-field-label">Nombre de jours</div>
      <div class="editor-day-count-row">
        ${dayCounts.map(n => `
          <button class="editor-day-count-btn ${editorData.days.length === n ? 'active' : ''}"
            onclick="setEditorDayCount(${n})">
            ${n}
          </button>`).join('')}
      </div>
    </div>
  `;
}

function setEditorDayCount(n) {
  const current = editorData.days.length;
  if (n > current) {
    // Ajouter des jours
    const names = ['Jour A','Jour B','Jour C','Jour D','Jour E','Jour F'];
    const whens  = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
    for (let i = current; i < n; i++) {
      editorData.days.push({
        id:       `new-day-${generateId()}`,
        name:     names[i] || `Jour ${i+1}`,
        when:     whens[i] || '',
        accent:   ACCENT_PRESETS[i % ACCENT_PRESETS.length],
        subtitle: '',
        exercises:[],
      });
    }
  } else if (n < current) {
    editorData.days = editorData.days.slice(0, n);
  }
  document.querySelectorAll('.editor-day-count-btn').forEach((b, i) => {
    b.classList.toggle('active', i+1 === n);
  });
  // Re-render field
  renderEditorOverlay();
}

// ── Étape 2 : Configuration des jours ────────────────────────────────────────
function renderEditorStep2() {
  return editorData.days.map((day, i) => `
    <div class="editor-day-config">
      <div class="editor-day-config-header" style="border-left:3px solid ${day.accent}">
        <div class="editor-day-config-num" style="color:${day.accent}">Jour ${i+1}</div>
      </div>

      <div class="editor-field-row">
        <div class="editor-field editor-field--half">
          <div class="editor-field-label">Nom</div>
          <input class="editor-input" type="text" value="${day.name}" placeholder="Push"
            oninput="editorData.days[${i}].name = this.value">
        </div>
        <div class="editor-field editor-field--half">
          <div class="editor-field-label">Jour de la semaine</div>
          <input class="editor-input" type="text" value="${day.when}" placeholder="Lundi"
            oninput="editorData.days[${i}].when = this.value">
        </div>
      </div>

      <div class="editor-field">
        <div class="editor-field-label">Sous-titre</div>
        <input class="editor-input" type="text" value="${day.subtitle}" placeholder="ex: Force poussée"
          oninput="editorData.days[${i}].subtitle = this.value">
      </div>

      <div class="editor-field">
        <div class="editor-field-label">Couleur</div>
        <div class="editor-color-row">
          ${ACCENT_PRESETS.map(c => `
            <button class="editor-color-swatch ${day.accent === c ? 'active' : ''}"
              style="background:${c}"
              onclick="editorData.days[${i}].accent='${c}'; document.querySelectorAll('.editor-day-config:nth-child(${i+1}) .editor-color-swatch').forEach(b=>b.classList.remove('active')); this.classList.add('active'); this.closest('.editor-day-config').querySelector('.editor-day-config-header').style.borderColor='${c}'; this.closest('.editor-day-config').querySelector('.editor-day-config-num').style.color='${c}'">
            </button>`).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

// ── Étape 3 : Exercices ───────────────────────────────────────────────────────
function renderEditorStep3() {
  const day = editorData.days[editorDayTab];
  if (!day) return '';

  const tabs = editorData.days.map((d, i) => `
    <button class="editor-day-tab ${editorDayTab === i ? 'active' : ''}"
      style="${editorDayTab === i ? `color:${d.accent};border-bottom:2px solid ${d.accent}` : ''}"
      onclick="editorDayTab=${i}; renderEditorBody()">
      ${d.name}
    </button>`).join('');

  const exos = (day.exercises || []).map((ex, ei) => `
    <div class="editor-ex-row">
      <div class="editor-ex-info">
        <div class="editor-ex-name">${ex.name}</div>
        <div class="editor-ex-meta">${ex.format} · ${ex.sets} série${ex.sets > 1 ? 's' : ''}
          ${ex.topSet ? ' · <span style="color:var(--red)">TOP</span>' : ''}
          ${ex.superset ? ' · <span style="color:var(--purple)">SS</span>' : ''}
        </div>
      </div>
      <button class="editor-ex-del" onclick="removeEditorEx(${editorDayTab}, ${ei})">✕</button>
    </div>
  `).join('');

  return `
    <div class="editor-day-tabs">${tabs}</div>

    <div id="editor-exos-list">
      ${exos || '<div class="editor-ex-empty">Aucun exercice — ajoutes-en ci-dessous</div>'}
    </div>

    <div class="editor-add-ex-btns">
      <button class="editor-add-ex-btn" onclick="openExPicker(${editorDayTab})">
        + Depuis la bibliothèque
      </button>
      <button class="editor-add-ex-btn editor-add-ex-btn--secondary" onclick="openCustomExForm(${editorDayTab})">
        + Exercice personnalisé
      </button>
    </div>

    ${pickerOpen       ? renderExPicker()  : ''}
    ${customExFormOpen ? renderCustomExForm() : ''}
    ${pendingExConfig  ? renderExConfig()  : ''}
  `;
}

function renderEditorBody() {
  document.getElementById('editor-body').innerHTML =
    editorStep === 1 ? renderEditorStep1() :
    editorStep === 2 ? renderEditorStep2() :
    renderEditorStep3();
}

// ── Picker bibliothèque ───────────────────────────────────────────────────────
function openExPicker(dayIdx) {
  pickerOpen       = true;
  pickerTargetDayIdx = dayIdx;
  renderEditorBody();
}

function closeExPicker() {
  pickerOpen = false;
  renderEditorBody();
}

function renderExPicker() {
  const lib = getExerciseLibrary();
  const groups = {};
  lib.forEach(ex => {
    if (!groups[ex._muscle]) groups[ex._muscle] = [];
    groups[ex._muscle].push(ex);
  });

  // Couleurs par groupe musculaire
  const muscleColors = {
    'Pectoraux':'#C23B3B', 'Dos':'#2D7DD2',
    'Épaules':'#1A9E8F', 'Bras':'#8B5CF6', 'Autre':'#888'
  };

  let html = `<div class="ex-picker-overlay" onclick="closeExPicker()">
    <div class="ex-picker" onclick="event.stopPropagation()">
      <div class="ex-picker-header">
        <div class="ex-picker-title">Bibliothèque</div>
        <button class="ex-picker-close" onclick="closeExPicker()">✕</button>
      </div>
      <div class="ex-picker-list">`;

  Object.entries(groups).forEach(([groupName, exos]) => {
    const col = muscleColors[groupName] || '#888';
    html += `<div class="ex-picker-group" style="color:${col};border-left:2px solid ${col};padding-left:10px">${groupName}</div>`;
    exos.forEach(ex => {
      html += `<div class="ex-picker-item" onclick="addLibraryEx(${pickerTargetDayIdx}, '${ex.id}')">
        <div>
          <div class="ex-picker-item-name">${ex.name}</div>
          <div class="ex-picker-item-meta">${ex.format}</div>
        </div>
        <div class="ex-picker-item-add" style="background:rgba(${col.replace('#','').match(/.{2}/g).map(h=>parseInt(h,16)).join(',')},0.15);color:${col}">+</div>
      </div>`;
    });
  });

  html += '</div></div></div>';
  return html;
}

// ── État du configurateur d'exercice ─────────────────────────────────────────
let pendingExConfig = null; // { name, dayIdx, rankKey, info, isCustom }
let exConfigSets    = 3;
let exConfigType    = 'normal'; // normal | topset | superset | dropset
let exConfigFormat  = '8-10';
let exConfigCustomFormat = '';
let exConfigRest    = 90; // secondes

const REST_PRESETS = [
  { label:'30s',   val:30  },
  { label:'1min',  val:60  },
  { label:'1:30',  val:90  },
  { label:'2min',  val:120 },
  { label:'2:30',  val:150 },
  { label:'3min',  val:180 },
];

const REP_PRESETS = [
  { label:'3-5',   val:'3-5'   },
  { label:'5-6',   val:'5-6'   },
  { label:'6-8',   val:'6-8'   },
  { label:'8-10',  val:'8-10'  },
  { label:'10-12', val:'10-12' },
  { label:'12-15', val:'12-15' },
  { label:'15-20', val:'15-20' },
];

const EX_TYPES = [
  { id:'normal',   label:'Normal',   desc:'Séries classiques' },
  { id:'topset',   label:'Top Set',  desc:'1 set max + back-off' },
  { id:'superset', label:'Superset', desc:'Enchaîné avec le suivant' },
  { id:'dropset',  label:'Drop Set', desc:'Réduction de charge' },
];

function addLibraryEx(dayIdx, exId) {
  const lib = getExerciseLibrary();
  const ex  = lib.find(e => e.id === exId);
  if (!ex) return;

  pendingExConfig = {
    name:    ex.name,
    dayIdx,
    rankKey: ex.rankKey || '',
    info:    ex.info    || null,
    isCustom: false,
  };
  exConfigSets   = ex.sets     || 3;
  exConfigType   = ex.topSet ? 'topset' : ex.superset ? 'superset' : ex.dropSet ? 'dropset' : 'normal';
  exConfigFormat = ex.format ? (ex.format.match(/(\d+-\d+)/) || ['','8-10'])[1] : '8-10';
  exConfigCustomFormat = '';
  exConfigRest   = ex.restTime || (ex.topSet ? 180 : ex.superset ? 60 : 90);
  pickerOpen = false;
  renderEditorBody();
}

// ── Formulaire exercice custom (saisie nom) ───────────────────────────────────
let customExFormOpen = false;
let customExFormDay  = 0;

function openCustomExForm(dayIdx) {
  customExFormOpen = true;
  customExFormDay  = dayIdx;
  pendingExConfig  = null;
  renderEditorBody();
}

function closeCustomExForm() {
  customExFormOpen = false;
  renderEditorBody();
}

function renderCustomExForm() {
  if (!customExFormOpen) return '';
  return `<div class="custom-ex-form">
    <div class="editor-field-label" style="margin-bottom:8px">Nom de l'exercice</div>
    <input class="editor-input" id="cex-name" type="text" placeholder="ex: Squat barre" autofocus>
    <div class="editor-field-row" style="margin-top:12px;gap:8px">
      <button class="editor-btn editor-btn-prev" style="flex:1" onclick="closeCustomExForm()">Annuler</button>
      <button class="editor-btn editor-btn-next" style="flex:1" onclick="openCustomExConfig(${customExFormDay})">Suivant →</button>
    </div>
  </div>`;
}

function openCustomExConfig(dayIdx) {
  const name = document.getElementById('cex-name')?.value?.trim();
  if (!name) { showToast('Donne un nom à l\'exercice'); return; }
  pendingExConfig  = { name, dayIdx, rankKey: '', info: null, isCustom: true };
  exConfigSets     = 3;
  exConfigType     = 'normal';
  exConfigFormat   = '8-10';
  exConfigCustomFormat = '';
  exConfigRest     = 90;
  customExFormOpen = false;
  renderEditorBody();
}

// ── Configurateur (commun bibliothèque + custom) ──────────────────────────────
function renderExConfig() {
  if (!pendingExConfig) return '';

  const types = EX_TYPES.map(t =>
    `<button class="ex-config-type-btn ${exConfigType === t.id ? 'active' : ''}"
      onclick="exConfigType='${t.id}';renderEditorBody()">
      <div class="ex-config-type-label">${t.label}</div>
      <div class="ex-config-type-desc">${t.desc}</div>
    </button>`
  ).join('');

  const presets = REP_PRESETS.map(r =>
    `<button class="ex-config-rep-btn ${exConfigFormat === r.val && !exConfigCustomFormat ? 'active' : ''}"
      onclick="exConfigFormat='${r.val}';exConfigCustomFormat='';renderEditorBody()">
      ${r.label}
    </button>`
  ).join('');

  // Format final selon le type
  let formatHint = '';
  if (exConfigType === 'topset')   formatHint = `Top set ${exConfigCustomFormat||exConfigFormat} + back-off`;
  else if (exConfigType === 'superset') formatHint = `${exConfigSets}×${exConfigCustomFormat||exConfigFormat} (SS)`;
  else if (exConfigType === 'dropset')  formatHint = `${exConfigSets}×(${exConfigCustomFormat||exConfigFormat}+${exConfigCustomFormat||exConfigFormat})`;
  else                             formatHint = `${exConfigSets}×${exConfigCustomFormat||exConfigFormat}`;

  return `<div class="ex-config-panel">
    <div class="ex-config-name">${pendingExConfig.name}</div>
    <div class="ex-config-preview">${formatHint}</div>

    <div class="editor-field-label" style="margin-top:16px">Type de série</div>
    <div class="ex-config-types">${types}</div>

    <div class="editor-field-label" style="margin-top:14px">Nombre de séries</div>
    <div class="ex-config-sets-row">
      <button class="ex-config-sets-btn" onclick="exConfigSets=Math.max(1,exConfigSets-1);renderEditorBody()">−</button>
      <div class="ex-config-sets-val">${exConfigSets}</div>
      <button class="ex-config-sets-btn" onclick="exConfigSets=Math.min(8,exConfigSets+1);renderEditorBody()">+</button>
    </div>

    <div class="editor-field-label" style="margin-top:14px">Répétitions</div>
    <div class="ex-config-rep-presets">${presets}</div>
    <input class="editor-input ex-config-custom-input" type="text"
      placeholder="Ou saisir manuellement (ex: 5, 3-5, 12…)"
      value="${exConfigCustomFormat}"
      oninput="exConfigCustomFormat=this.value;exConfigFormat='custom'">

    <div class="editor-field-label" style="margin-top:14px">Temps de repos</div>
    <div class="ex-config-rep-presets">
      ${REST_PRESETS.map(r =>
        `<button class="ex-config-rep-btn ${exConfigRest === r.val ? 'active' : ''}"
          onclick="exConfigRest=${r.val};renderEditorBody()">
          ${r.label}
        </button>`).join('')}
    </div>

    <div class="editor-field-row" style="margin-top:16px;gap:8px">
      <button class="editor-btn editor-btn-prev" style="flex:1"
        onclick="pendingExConfig=null;renderEditorBody()">Annuler</button>
      <button class="editor-btn editor-btn-save" style="flex:1"
        onclick="confirmAddEx()">+ Ajouter</button>
    </div>
  </div>`;
}

function confirmAddEx() {
  if (!pendingExConfig) return;
  const reps   = exConfigCustomFormat || exConfigFormat;
  const sets   = exConfigSets;
  const type   = exConfigType;

  // Construire le format lisible
  let format;
  if (type === 'topset')   format = `Top set ${reps} + ${sets-1>0?sets-1+'×'+reps:'back-off'}`;
  else if (type === 'superset') format = `${sets}×${reps}`;
  else if (type === 'dropset')  format = `${sets}×(${reps}+${reps})`;
  else                     format = `${sets}×${reps}`;

  editorData.days[pendingExConfig.dayIdx].exercises.push({
    id:       generateId(),
    name:     pendingExConfig.name,
    format,
    sets,
    topSet:   type === 'topset',
    superset: type === 'superset',
    dropSet:  type === 'dropset',
    rankKey:  pendingExConfig.rankKey || '',
    info:     pendingExConfig.info    || null,
    restTime: exConfigRest,
  });

  pendingExConfig = null;
  renderEditorBody();
}

function saveCustomEx(dayIdx) {
  // Kept for backwards compat — unused
  const name   = document.getElementById('cex-name')?.value?.trim();
  const format = '3×8-10';
  const sets   = 3;
  if (!name) { showToast('Donne un nom à l\'exercice'); return; }

  editorData.days[dayIdx].exercises.push({
    id:       generateId(),
    name,
    format,
    sets,
    topSet:   false,
    superset: false,
    dropSet:  false,
    rankKey:  '',
    info:     null,
  });
  customExFormOpen = false;
  renderEditorBody();
}

function removeEditorEx(dayIdx, exIdx) {
  editorData.days[dayIdx].exercises.splice(exIdx, 1);
  renderEditorBody();
}

// ── Navigation entre étapes ───────────────────────────────────────────────────
function editorNext() {
  if (editorStep === 1) {
    if (!editorData.name.trim()) { showToast('Donne un nom au programme'); return; }
  }
  editorStep++;
  renderEditorOverlay();
  document.getElementById('editor-body').scrollTop = 0;
}

function editorPrev() {
  editorStep--;
  renderEditorOverlay();
}

function editorSave() {
  // Validation
  const hasExos = editorData.days.every(d => d.exercises.length > 0);
  if (!hasExos) {
    showToast('Ajoute au moins 1 exercice par jour');
    return;
  }

  if (editorData.id && !editorData._fromDefault) {
    // Mise à jour d'un programme custom existant
    updateCustomProgram(editorData.id, editorData);
  } else {
    // Création (nouveau programme ou copie modifiée du programme par défaut)
    const prog = createCustomProgram(editorData);
    setActiveProgram(prog.id);
  }
  closeEditor();
  setView('programs');
  renderPrograms();
  showToast(editorData?._fromDefault ? 'Copie du programme enregistrée ✓' : 'Programme enregistré ✓');
}

function closeEditor() {
  const overlay = document.getElementById('editor-overlay');
  if (overlay) {
    overlay.classList.remove('open');
    overlay.classList.add('closing');
    setTimeout(() => { overlay.remove(); }, 350);
  }
  editorData       = null;
  pickerOpen       = false;
  customExFormOpen = false;
}
