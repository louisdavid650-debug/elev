// Élev — Service Worker v1
// Gère les timers de repos en arrière-plan + notifications push

const SW_VERSION = 'elev-sw-v1';

self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(self.clients.claim());
});

// ── Timer de repos en arrière-plan ──
let restTimerTimeout = null;

self.addEventListener('message', e => {
  const { type, payload } = e.data || {};

  if (type === 'START_REST_TIMER') {
    // Annule un timer précédent si existant
    if (restTimerTimeout) {
      clearTimeout(restTimerTimeout);
      restTimerTimeout = null;
    }
    const { seconds, exName } = payload;
    restTimerTimeout = setTimeout(async () => {
      restTimerTimeout = null;
      // Vérifie si l'app est au premier plan
      const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const isFocused = clients.some(c => c.focused || c.visibilityState === 'visible');
      if (!isFocused) {
        // App en arrière-plan ou écran verrouillé → notification native
        self.registration.showNotification('Élev — Repos terminé 💪', {
          body: exName ? `Reprends sur ${exName}` : "C'est reparti !",
          icon: '/elev/elev-icon.png',
          badge: '/elev/elev-icon.png',
          vibrate: [200, 100, 200, 100, 200],
          tag: 'rest-timer',
          renotify: true,
          requireInteraction: false,
          silent: false,
        });
      } else {
        // App au premier plan → message à l'app pour playBeep()
        clients.forEach(c => c.postMessage({ type: 'REST_DONE' }));
      }
    }, seconds * 1000);
  }

  if (type === 'CANCEL_REST_TIMER') {
    if (restTimerTimeout) {
      clearTimeout(restTimerTimeout);
      restTimerTimeout = null;
    }
  }
});

// Clic sur la notification → ouvre/focus l'app
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
