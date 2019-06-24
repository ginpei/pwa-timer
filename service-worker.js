/* eslint-disable no-use-before-define */

const pathBase = '/pwa-timer/';

const cacheFileNames = [
  'manifest.json',
  'index.html',
  'about.html',
  'assets/gpui/basics.css',
  'assets/gpui/icon-192.png',
  'assets/gpui/icon-512.png',
  'assets/vendor/nhk-creative-library/D0002011518_00000_A_001.m4a',
  'assets/main.js',
  'assets/style.css',
  'assets/Timer.js',
];
const outerCacheUrls = [
  'https://fonts.googleapis.com/css?family=Share+Tech+Mono&display=swap',
  'https://fonts.gstatic.com/s/sharetechmono/v8/J7aHnp1uDWRBEqV98dVQztYldFcLowEF.woff2',
];

/**
 * @param {ExtendableEvent} event
 * @param {ServiceWorkerGlobalScope} sw
 */
async function onInstall (event, sw) {
  // eslint-disable-next-line no-console
  console.log('[SW] install');

  const p = getCache()
    .then(async (cache) => {
      // TODO avoid 206 somehow
      const cacheUrls = cacheFileNames.map((v) => `${pathBase}${v}`)
        .concat(outerCacheUrls);
      await cache.addAll(cacheUrls);

      const clients = await sw.clients.matchAll({ includeUncontrolled: true });
      clients.forEach((client) => {
        /** @type {ControllerMessage} */
        const message = { type: 'sw/install' };
        client.postMessage(message);
      });
    })
    .catch((error) => {
      console.error(error);
      throw error;
    });
  event.waitUntil(p);
}

/**
 * @param {ExtendableEvent} event
 * @param {ServiceWorkerGlobalScope} sw
 */
function onActivate (event, sw) {
  // eslint-disable-next-line no-console
  console.log('[SW] activate');

  const p = sw.clients.claim()
    .catch((error) => {
      console.error(error);
      throw error;
    });
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

  if (outerCacheUrls.includes(sUrl)) {
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

      default: // do nothing;
    }
  });
}

// @ts-ignore
// eslint-disable-next-line no-restricted-globals
main(self);
