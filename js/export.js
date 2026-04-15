// ============ EXPORT / IMPORT EXCEL ============

let importParsedSessions = [];

// ── Export ────────────────────────────────────────────────────────────────────
function exportToExcel() {
  if (typeof XLSX === 'undefined') { showToast('Export indisponible'); return; }
  const wb = XLSX.utils.book_new();

  // Feuille 1 : Séances
  const rows1 = [['Date','Jour','Programme','Exercice','Série','Charge (kg)','Répétitions','1RM estimé (kg)']];
  state.history.forEach(h => {
    const found = findDayInfo(h.dayId);
    const d = found ? found.day : null;
    if (!d) return;
    const dateStr = new Date(h.date).toLocaleDateString('fr-FR');
    d.exercises.forEach(ex => {
      for (let i = 0; i < ex.sets; i++) {
        const s = h.sets[`${ex.id}_${i}`];
        if (!s) continue;
        const kg   = parseFloat(s.kg)   || 0;
        const reps = parseInt  (s.reps) || 0;
        const rm   = kg>0&&reps>0 ? +(calc1RM(kg,reps).toFixed(1)) : '';
        rows1.push([dateStr, d.name, d.subtitle, ex.name, ex.topSet&&i===0?'TOP SET':`Série ${i+1}`, kg||'', reps||'', rm]);
      }
    });
  });
  const ws1 = XLSX.utils.aoa_to_sheet(rows1);
  ws1['!cols'] = [14,10,20,30,10,12,13,16].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws1, 'Séances');

  // Feuille 2 : Top Sets
  const topExercises = getActiveProgram().flatMap(d => d.exercises.filter(e => e.topSet).map(e => ({...e, dayName:d.name})));
  const rows2 = [['Exercice','Jour','Date','Charge (kg)','Répétitions','1RM estimé (kg)']];
  topExercises.forEach(ex => {
    state.history.forEach(h => {
      const s = h.sets[`${ex.id}_0`];
      if (!s) return;
      const kg   = parseFloat(s.kg)   || 0;
      const reps = parseInt  (s.reps) || 0;
      const rm   = kg>0&&reps>0 ? +(calc1RM(kg,reps).toFixed(1)) : '';
      rows2.push([ex.name, ex.dayName, new Date(h.date).toLocaleDateString('fr-FR'), kg||'', reps||'', rm]);
    });
  });
  const ws2 = XLSX.utils.aoa_to_sheet(rows2);
  ws2['!cols'] = [30,10,14,12,13,16].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws2, 'Top Sets');

  // Feuille 3 : Mesures corporelles
  const rows3 = [['Date','Poids (kg)','Bras (cm)','Poitrine (cm)','Taille (cm)']];
  state.bodyStats.forEach(b => {
    rows3.push([new Date(b.date).toLocaleDateString('fr-FR'), parseFloat(b.poids)||'', parseFloat(b.bras)||'', parseFloat(b.poitrine)||'', parseFloat(b.taille_cm)||'']);
  });
  const ws3 = XLSX.utils.aoa_to_sheet(rows3);
  ws3['!cols'] = [14,12,12,14,12].map(w => ({wch:w}));
  XLSX.utils.book_append_sheet(wb, ws3, 'Mesures corporelles');

  XLSX.writeFile(wb, `ponos-${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('Export Excel téléchargé');
}

// ── Import ────────────────────────────────────────────────────────────────────
function openImportModal() {
  importParsedSessions = [];
  document.getElementById('import-preview').style.display         = 'none';
  document.getElementById('import-confirm-btn').style.display     = 'none';
  document.getElementById('import-file-input').value              = '';
  document.getElementById('import-drop-zone').innerHTML = `
    <div class="drop-icon" style="font-size:24px;color:var(--text3)">↓</div>
    <div class="drop-title">Sélectionner un fichier Excel</div>
    <div class="drop-sub">Ou glisse-dépose ton fichier .xlsx ici</div>`;
  document.getElementById('import-modal').classList.remove('hidden');

  const zone = document.getElementById('import-drop-zone');
  zone.ondragover = e => { e.preventDefault(); zone.classList.add('dragover'); };
  zone.ondragleave = () => zone.classList.remove('dragover');
  zone.ondrop = e => {
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
  reader.onload = e => {
    try {
      const wb       = XLSX.read(e.target.result, { type:'array', cellDates:true });
      const shName   = wb.SheetNames.find(n => n.toLowerCase().includes('ance')) || wb.SheetNames[0];
      const rows     = XLSX.utils.sheet_to_json(wb.Sheets[shName], { defval:'' });
      const sessionMap = {};

      rows.forEach(row => {
        const dateRaw  = row['Date'] || '';
        const jourName = (row['Jour']      || '').trim();
        const exName   = (row['Exercice']  || '').trim();
        const setLabel = (row['Série']     || '').trim();
        const kg       = row['Charge (kg)'];
        const reps     = row['Répétitions'];
        if (!dateRaw || !jourName || !exName || (!kg && !reps)) return;

        // Chercher dans tous les programmes disponibles
        let day = PROGRAM.find(d => d.name.toLowerCase() === jourName.toLowerCase());
        if (!day) {
          for (const prog of (state.customPrograms || [])) {
            day = prog.days.find(d => d.name.toLowerCase() === jourName.toLowerCase());
            if (day) break;
          }
        }
        if (!day) return;
        const ex = day.exercises.find(e => e.name.toLowerCase() === exName.toLowerCase());
        if (!ex) return;

        let setIdx = 0;
        if (setLabel === 'TOP SET') setIdx = 0;
        else { const m = setLabel.match(/(\d+)/); setIdx = m ? parseInt(m[1])-1 : 0; }

        let isoDate;
        if (dateRaw instanceof Date) {
          isoDate = dateRaw.toISOString();
        } else {
          const parts = String(dateRaw).split('/');
          isoDate = parts.length === 3
            ? new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}T12:00:00`).toISOString()
            : new Date(dateRaw).toISOString();
        }
        if (!isoDate || isoDate === 'Invalid Date') return;

        const key = `${isoDate.slice(0,10)}|${day.id}`;
        if (!sessionMap[key]) sessionMap[key] = { dayId:day.id, date:isoDate, sets:{} };
        sessionMap[key].sets[`${ex.id}_${setIdx}`] = { kg:String(kg||'0'), reps:String(reps||'0') };
      });

      importParsedSessions = Object.values(sessionMap);

      if (!importParsedSessions.length) {
        document.getElementById('import-preview').style.display = 'block';
        document.getElementById('import-preview').innerHTML = '⚠️ Aucune séance reconnue dans ce fichier.';
        document.getElementById('import-confirm-btn').style.display = 'none';
        return;
      }

      const existingKeys = new Set(state.history.map(h => `${h.date.slice(0,10)}|${h.dayId}`));
      const newOnes = importParsedSessions.filter(s => !existingKeys.has(`${s.date.slice(0,10)}|${s.dayId}`));
      const dupOnes = importParsedSessions.length - newOnes.length;

      document.getElementById('import-drop-zone').innerHTML =
        `<div class="drop-icon">✅</div><div class="drop-title" style="color:var(--green)">${file.name}</div><div class="drop-sub">Fichier chargé avec succès</div>`;

      const prev = document.getElementById('import-preview');
      prev.style.display = 'block';
      prev.innerHTML = `<strong>${importParsedSessions.length}</strong> séance${importParsedSessions.length>1?'s':''} trouvée${importParsedSessions.length>1?'s':''}.<br>`
        + (newOnes.length ? `<strong style="color:var(--green)">${newOnes.length} nouvelle${newOnes.length>1?'s':''}</strong> à ajouter.<br>` : '')
        + (dupOnes        ? `<span style="color:var(--text3)">${dupOnes} déjà présente${dupOnes>1?'s':''} (ignorée${dupOnes>1?'s':''}).</span>` : '')
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
  state.history = [...state.history, ...toAdd].sort((a,b) => new Date(a.date)-new Date(b.date));
  saveState(); closeImportModal();
  showToast(`${toAdd.length} séance${toAdd.length>1?'s':''} importée${toAdd.length>1?'s':''} ✓`);
  render();
}
