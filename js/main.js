// ============ INIT ============
(async () => {
  await loadState();
  render();

  // Récap hebdomadaire (lundi uniquement)
  setTimeout(() => checkWeeklyRecap(), 500);

  // Stockage persistant (Android Chrome)
  if (navigator.storage && navigator.storage.persist) {
    const granted = await navigator.storage.persist();
    console.log('Stockage persistant:', granted ? 'accordé' : 'refusé');
  }

  // Service Worker
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
      console.log('Service Worker enregistré');
    } catch(e) {
      console.warn('Service Worker non disponible');
    }
  }
})();
