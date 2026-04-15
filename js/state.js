// ============ STATE ============
const STORAGE_KEY = 'muscu-recomp-v3';

let state = {
  bodyWeight: 95,
  dayIdx: 0,
  current: {},
  history: [],
  bodyStats: [],
  veloSessions: [],
  activeEx: null,
  view: 'workout',
  activeProgramId: 'default',
  customPrograms: [],
};

// ── IndexedDB ────────────────────────────────────────────────────────────────
const DB_NAME    = 'ponos-db';
const DB_VERSION = 1;
const STORE_NAME = 'state';
let db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (db) { resolve(db); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = e => {
      const d = e.target.result;
      if (!d.objectStoreNames.contains(STORE_NAME)) d.createObjectStore(STORE_NAME);
    };
    req.onsuccess = e => { db = e.target.result; resolve(db); };
    req.onerror   = ()  => reject(req.error);
  });
}

async function idbGet(key) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function idbSet(key, value) {
  const d = await openDB();
  return new Promise((resolve, reject) => {
    const req = d.transaction(STORE_NAME, 'readwrite').objectStore(STORE_NAME).put(value, key);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── Migration localStorage → IndexedDB ───────────────────────────────────────
async function migrateFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      await idbSet(STORAGE_KEY, JSON.parse(raw));
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch(e) {}
}

// ── Load / Save ───────────────────────────────────────────────────────────────
async function loadState() {
  await migrateFromLocalStorage();
  try {
    const saved = await idbGet(STORAGE_KEY);
    if (saved) Object.assign(state, saved);
  } catch(e) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) Object.assign(state, JSON.parse(raw));
    } catch(e2) {}
  }
  if (!state.current)      state.current      = {};
  if (!state.history)      state.history      = [];
  if (!state.bodyStats)    state.bodyStats    = [];
  if (!state.veloSessions)   state.veloSessions   = [];
  if (!state.customPrograms) state.customPrograms = [];
  if (!state.activeProgramId) state.activeProgramId = 'default';
}

function saveState() {
  const data = {
    bodyWeight:     state.bodyWeight,
    current:        state.current,
    history:        state.history,
    bodyStats:      state.bodyStats,
    veloSessions:   state.veloSessions,
    activeProgramId: state.activeProgramId,
    customPrograms:  state.customPrograms,
  };
  idbSet(STORAGE_KEY, data).catch(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch(e) {}
  });
}
