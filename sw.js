// Élev — Service Worker v2
const SW_VERSION = 'elev-sw-v2';

self.addEventListener('install', e => {
  console.log('[SW] Install', SW_VERSION);
  clearRestTimer(); // Annule tout timer de l'ancienne instance
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activate', SW_VERSION);
  // Annule tout timer résiduel d'une ancienne instance
  clearRestTimer();
  e.waitUntil(self.clients.claim());
});

// ── Timer de repos ──
let restTimer = null;

function clearRestTimer() {
  if (restTimer?.checkInterval) clearInterval(restTimer.checkInterval);
  if (restTimer?.backupTimeout) clearTimeout(restTimer.backupTimeout);
  restTimer = null;
}

async function fireRestDone(exName) {
  console.log('[SW] Repos terminé');
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visibleClient = clients.find(c => c.visibilityState === 'visible');

  if (visibleClient) {
    visibleClient.postMessage({ type: 'REST_DONE' });
  } else {
    try {
      await self.registration.showNotification("Élev — C'est reparti ! 💪", {
        body: exName ? `Reprends sur ${exName}` : 'Ton repos est terminé',
        icon: '/elev/elev-icon.png',
        badge: '/elev/elev-icon.png',
        vibrate: [200, 100, 200, 100, 300],
        tag: 'rest-timer',
        renotify: true,
        requireInteraction: false,
        silent: false,
      });
    } catch(err) {
      console.warn('[SW] Notification échouée:', err);
      clients.forEach(c => c.postMessage({ type: 'REST_DONE' }));
    }
  }
}

self.addEventListener('message', e => {
  const { type, payload } = e.data || {};

  if (type === 'START_REST_TIMER') {
    clearRestTimer();
    const { seconds, exName } = payload;
    const endsAt = Date.now() + seconds * 1000;
    console.log('[SW] Timer lancé:', seconds, 's');

    // Interval de vérification toutes les 500ms (plus robuste que setTimeout seul sur iOS)
    const checkInterval = setInterval(async () => {
      if (Date.now() >= endsAt) {
        clearRestTimer();
        await fireRestDone(exName);
      }
    }, 500);

    // setTimeout de backup
    const backupTimeout = setTimeout(async () => {
      if (restTimer) {
        clearRestTimer();
        await fireRestDone(exName);
      }
    }, seconds * 1000 + 300);

    restTimer = { endsAt, exName, checkInterval, backupTimeout };
  }

  if (type === 'CANCEL_REST_TIMER') {
    clearRestTimer();
  }

  if (type === 'PING') {
    e.source?.postMessage({ type: 'PONG', version: SW_VERSION });
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const elevClient = clients.find(c => c.url.includes('elev'));
      if (elevClient) return elevClient.focus();
      return self.clients.openWindow('/elev/');
    })
  );
});
