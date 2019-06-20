/* eslint-disable no-use-before-define */
/// <reference path="./node_modules/typescript/lib/lib.es2015.d.ts" />
/// <reference path="./node_modules/typescript/lib/lib.webworker.d.ts" />
/// <reference path="./types/index.d.ts" />

const pathBase = '/pwa-timer/';

const cachePaths = [
  'offline.html',
];

/** @type {AppPreferences} */
const preferences = {
  notificationEnabled: false,
};

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

  const p = getCache()
    .then((cache) => cache.addAll(cachePaths.map((v) => `${pathBase}${v}`)))
    .then(() => sw.clients.claim());
  event.waitUntil(p);
}

/**
 * @param {FetchEvent} event
 */
function onFetch (event) {
  const { pathname } = new URL(event.request.url);
  if (!pathname.startsWith(pathBase)) {
    return;
  }

  event.respondWith(fetch(event.request).catch(async () => {
    const cache = await getCache();
    const res = await cache.match(`${pathBase}offline.html`);
    if (res) {
      return res;
    }

    return new Response('Not found');
  }));
}

function getCache () {
  return caches.open('pwa-pomodoro');
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
 */
function showNotification (sw) {
  const title = 'PWA Timer';
  /** @type {NotificationOptions} */
  const options = {
    body: "It's time!",
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
              showNotification(sw);
            }
          },
        );
        postMessageToClients(sw, { type: 'timer/start' });
        break;
      }

      case 'timer/stop': {
        stopTimer(sw);
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

// eslint-disable-next-line no-restricted-globals
main(self);
