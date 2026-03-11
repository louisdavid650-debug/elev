// Élev — Service Worker v3
const SW_VERSION = 'elev-sw-v3';

self.addEventListener('install', e => {
  console.log('[SW] Install', SW_VERSION);
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  console.log('[SW] Activate', SW_VERSION);
  e.waitUntil(self.clients.claim());
});

// ── Timer ──
// On utilise UNIQUEMENT setTimeout — pas d'interval qui tourne en boucle
// Le timer est lié à la SESSION : si l'app est fermée/rouverte, le timer est annulé
let restTimeout = null;
let restExName = '';
let restSessionId = null; // ID unique par session app

function clearRestTimer() {
  if (restTimeout) { clearTimeout(restTimeout); restTimeout = null; }
  restExName = '';
  restSessionId = null;
  console.log('[SW] Timer annulé');
}

async function fireRestDone(sessionId, exName) {
  // Vérifier que la session est toujours valide
  if (restSessionId !== sessionId) {
    console.log('[SW] Timer expiré mais session changée, ignoré');
    return;
  }
  restTimeout = null;
  restSessionId = null;

  console.log('[SW] Repos terminé');
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const visibleClient = clients.find(c => c.visibilityState === 'visible');

  if (visibleClient) {
    visibleClient.postMessage({ type: 'REST_DONE' });
  } else {
    try {
      await self.registration.showNotification("Élev — C'est reparti ! 💪", {
        body: exName ? `Reprends sur ${exName}` : 'Ton repos est terminé',
        icon: '/elev/apple-touch-icon.png',
        vibrate: [200, 100, 200, 100, 300],
        tag: 'rest-timer',
        renotify: true,
        requireInteraction: false,
        silent: false,
      });
    } catch(err) {
      clients.forEach(c => c.postMessage({ type: 'REST_DONE' }));
    }
  }
}

self.addEventListener('message', e => {
  const { type, payload } = e.data || {};

  if (type === 'START_REST_TIMER') {
    clearRestTimer();
    const { seconds, exName, sessionId } = payload;
    restExName = exName || '';
    restSessionId = sessionId;
    console.log('[SW] Timer démarré:', seconds, 's, session:', sessionId);
    restTimeout = setTimeout(() => fireRestDone(sessionId, exName), seconds * 1000);
  }

  if (type === 'CANCEL_REST_TIMER') {
    clearRestTimer();
  }

  // L'app envoie son sessionId au démarrage — si différent, annule le timer
  if (type === 'APP_STARTED') {
    const { sessionId } = payload;
    if (restSessionId && restSessionId !== sessionId) {
      console.log('[SW] Nouvelle session détectée, annulation timer résiduel');
      clearRestTimer();
    }
    e.source?.postMessage({ type: 'SW_READY', version: SW_VERSION });
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const c = clients.find(cl => cl.url.includes('elev'));
      if (c) return c.focus();
      return self.clients.openWindow('/elev/');
    })
  );
});
