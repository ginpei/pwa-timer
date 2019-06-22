/* eslint-disable no-use-before-define */

const pathBase = '/pwa-timer/';

const cachePaths = [
  'manifest.json',
  'index.html',
  'about.html',
  'assets/gpui/basics.css',
  'assets/gpui/icon-192.png',
  'assets/gpui/icon-512.png',
  'assets/vendor/nhk-creative-library/D0002011518_00000_A_001.m4a',
  'assets/script.js',
  'assets/style.css',
];
const outerCachePaths = [
  'https://fonts.googleapis.com/css?family=Share+Tech+Mono&display=swap',
  'https://fonts.gstatic.com/s/sharetechmono/v8/J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2',
];

/** @type {AppPreferences} */
const preferences = {
  notificationEnabled: false,
};

/** @type {() => void} */
let stopTimer = () => undefined;
let goalTime = 0;

/**
 * @param {ExtendableEvent} event
 * @param {ServiceWorkerGlobalScope} sw
 */
async function onInstall (event, sw) {
  // eslint-disable-next-line no-console
  console.log('[SW] install');

  const clients = await sw.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => {
    /** @type {ControllerMessage} */
    const message = { type: 'sw/install' };
    client.postMessage(message);
  });
}

/**
 * @param {ExtendableEvent} event
 * @param {ServiceWorkerGlobalScope} sw
 */
function onActivate (event, sw) {
  // eslint-disable-next-line no-console
  console.log('[SW] activate');

  // TODO avoid 206 somehow
  const p = getCache()
    .then((cache) => cache.addAll(cachePaths.map((v) => `${pathBase}${v}`).concat(outerCachePaths)))
    .then(() => sw.clients.claim())
    .catch((error) => console.error(error));
  event.waitUntil(p);
}

/**
 * @param {RequestInfo} request
 */
async function getCachedResponse (request) {
  const cache = await getCache();
  const res = await cache.match(request);
  if (!res) {
    throw new Error(`Failed to load cache: "${String(request)}"`);
  }

  return res;
}

/**
 * @param {FetchEvent} event
 */
function onFetch (event) {
  const sUrl = event.request.url;
  const url = new URL(sUrl);
  if (
    url.protocol === globalThis.location.protocol
    && url.host === globalThis.location.host
    && url.pathname.startsWith(pathBase)
  ) {
    const pathname = url.pathname === pathBase
      ? `${pathBase}index.html`
      : url.pathname;
    event.respondWith(
      getCachedResponse(pathname)
        .catch((error) => {
          console.error(error);
          return fetch(pathname);
        }),
    );
    return;
  }

  if (outerCachePaths.includes(sUrl)) {
    event.respondWith(
      getCachedResponse(sUrl)
        .catch((error) => {
          console.error(error);
          return fetch(sUrl);
        }),
    );
  }
}

/**
 * @param {PushEvent} event
 * @param {ServiceWorkerGlobalScope} sw
 */
function onPush (event, sw) {
  const p = showNotification(sw, 'Pushed!');
  event.waitUntil(p);
}

function getCache () {
  return caches.open('pwa-timer');
}

/**
 * @param {number} duration
 * @param {() => void} onTick
 * @param {() => void} onAlarm
 */
function startTimer (duration, onTick, onAlarm) {
  stopTimer();
  goalTime = Date.now() + duration;

  const tm = setInterval(() => {
    const now = Date.now();
    if (now < goalTime) {
      onTick();
    } else {
      stopTimer();
      onAlarm();
    }
  }, 16);

  stopTimer = () => {
    clearInterval(tm);
    goalTime = 0;
  };
}

/**
 * @param {ServiceWorkerGlobalScope} sw
 */
function ringAlarm (sw) {
  postMessageToClients(sw, {
    type: 'timer/alarm',
  });
}

/**
 * @param {ServiceWorkerGlobalScope} sw
 */
function tick (sw) {
  const remaining = goalTime - Date.now();
  postMessageToClients(sw, {
    remaining,
    type: 'timer/tick',
  });
}

/**
 * @param {ServiceWorkerGlobalScope} sw
 * @param {string} body
 */
function showNotification (sw, body) {
  const title = 'PWA Timer';
  /** @type {NotificationOptions} */
  const options = {
    body,
    icon: '/pwa-timer/assets/gpui/icon-512.png',
  };
  sw.registration.showNotification(title, options);
}

/**
 * @param {ServiceWorkerGlobalScope} sw
 */
function getClients (sw) {
  return sw.clients.matchAll();
}

/**
 * @param {ServiceWorkerGlobalScope} sw
 * @param {ControllerMessage} message
 */
async function postMessageToClients (sw, message) {
  const clients = await getClients(sw);

  clients.forEach((client) => {
    client.postMessage(message);
  });
}

/**
 * @param {ServiceWorkerGlobalScope} sw
 */
function main (sw) {
  sw.addEventListener('install', (event) => onInstall(event, sw));
  sw.addEventListener('activate', (event) => onActivate(event, sw));
  sw.addEventListener('fetch', (event) => onFetch(event));
  sw.addEventListener('push', (event) => onPush(event, sw));
  sw.addEventListener('message', async (event) => {
    /** @type {ClientMessage} */
    const message = event.data;

    switch (message.type) {
      case 'sw/skipWaiting': {
        sw.skipWaiting();
        break;
      }

      case 'timer/requestStatus': {
        const running = goalTime !== 0;
        const remaining = running ? goalTime - Date.now() : 0;
        postMessageToClients(sw, {
          preferences,
          remaining,
          running,
          type: 'timer/status',
        });
        break;
      }

      case 'timer/start': {
        startTimer(
          message.duration,
          () => tick(sw),
          () => {
            ringAlarm(sw);

            if (preferences.notificationEnabled) {
              showNotification(sw, "It's time!");
            }
          },
        );
        postMessageToClients(sw, { type: 'timer/start' });
        break;
      }

      case 'timer/stop': {
        stopTimer();
        tick(sw);
        postMessageToClients(sw, { type: 'timer/stop' });
        break;
      }

      case 'preferences/notificationEnabled': {
        preferences.notificationEnabled = message.notificationEnabled;
        break;
      }

      default: // do nothing;
    }
  });
}

// @ts-ignore
// eslint-disable-next-line no-restricted-globals
main(self);
