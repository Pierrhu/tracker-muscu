// ============ GESTION DES PROGRAMMES ============

const DEFAULT_PROGRAM_ID = 'default';

// ── Accès au programme actif ──────────────────────────────────────────────────

function getActiveProgram() {
  if (!state.activeProgramId || state.activeProgramId === DEFAULT_PROGRAM_ID) {
    return PROGRAM;
  }
  const custom = (state.customPrograms || []).find(p => p.id === state.activeProgramId);
  return custom ? custom.days : PROGRAM;
}

function getActiveProgramMeta() {
  if (!state.activeProgramId || state.activeProgramId === DEFAULT_PROGRAM_ID) {
    return { id: DEFAULT_PROGRAM_ID, name: 'Programme Ponos', isDefault: true, days: PROGRAM };
  }
  return (state.customPrograms || []).find(p => p.id === state.activeProgramId)
      || { id: DEFAULT_PROGRAM_ID, name: 'Programme Ponos', isDefault: true, days: PROGRAM };
}

function setActiveProgram(id) {
  state.activeProgramId = id;
  // Réinitialiser dayIdx si le nouveau programme a moins de jours
  const prog = getActiveProgram();
  if (state.dayIdx >= prog.length) state.dayIdx = 0;
  state.activeEx = null;
  saveState();
}

// ── Retrouver un jour depuis son ID (pour l'historique) ───────────────────────

function findDayInfo(dayId) {
  // Programme par défaut
  const d = PROGRAM.find(d => d.id === dayId);
  if (d) return { day: d, programName: 'Programme Ponos' };
  // Programmes custom
  for (const prog of (state.customPrograms || [])) {
    const day = prog.days.find(d => d.id === dayId);
    if (day) return { day, programName: prog.name };
  }
  return null;
}

// ── Bibliothèque d'exercices (pour le picker) ─────────────────────────────────

// Mapping ID exercice → groupe musculaire
const MUSCLE_GROUPS = {
  a1:'Pectoraux', a2:'Dos', a3:'Pectoraux', a4:'Dos', a5:'Épaules', a6:'Bras',
  b1:'Épaules',   b2:'Dos', b3:'Dos',       b4:'Épaules', b5:'Épaules',
  c1:'Pectoraux', c2:'Dos', c3:'Pectoraux', c4:'Épaules', c5:'Épaules', c6:'Bras',
};

const MUSCLE_ORDER = ['Pectoraux', 'Dos', 'Épaules', 'Bras'];

function getExerciseLibrary() {
  const lib = [];
  const seen = new Set();
  PROGRAM.forEach(day => {
    day.exercises.forEach(ex => {
      if (!seen.has(ex.id)) {
        seen.add(ex.id);
        lib.push({
          ...ex,
          _muscle: MUSCLE_GROUPS[ex.id] || 'Autre',
          _accent: day.accent,
        });
      }
    });
  });
  // Trier par ordre musculaire défini
  lib.sort((a, b) => {
    const ia = MUSCLE_ORDER.indexOf(a._muscle);
    const ib = MUSCLE_ORDER.indexOf(b._muscle);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  return lib;
}

// ── CRUD programmes custom ────────────────────────────────────────────────────

function generateId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
}

function createCustomProgram(data) {
  if (!state.customPrograms) state.customPrograms = [];
  const prog = {
    id:        generateId(),
    name:      data.name      || 'Nouveau programme',
    objective: data.objective || 'force',
    days:      data.days      || [],
    createdAt: new Date().toISOString(),
  };
  state.customPrograms.push(prog);
  saveState();
  return prog;
}

function updateCustomProgram(id, data) {
  if (!state.customPrograms) return;
  const idx = state.customPrograms.findIndex(p => p.id === id);
  if (idx < 0) return;
  Object.assign(state.customPrograms[idx], data);
  saveState();
}

function deleteCustomProgram(id) {
  if (!state.customPrograms) return;
  state.customPrograms = state.customPrograms.filter(p => p.id !== id);
  // Si on supprime le programme actif → revenir au défaut
  if (state.activeProgramId === id) setActiveProgram(DEFAULT_PROGRAM_ID);
  saveState();
}
