/* eslint-disable no-use-before-define */

import Timer from './Timer.js';

async function installServiceWorker () {
  try {
    await navigator.serviceWorker.register('/pwa-timer/service-worker.js');
  } catch (error) {
    console.error(error);
  }
}

/**
 * ```console
 * $ curl "${ENDPOINT_URL}" --request POST --header "TTL: 60" \
 * --header "Content-Length: 0" \
 * --header "Authorization: key=${SERVER_KEY}"
 * ```
 * @see https://developers.google.com/web/ilt/pwa/introduction-to-push-notifications#sending_a_push_message_using_firebase_cloud_messaging
 */
async function subscribePushService () {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (sub) {
    // eslint-disable-next-line no-console
    console.log('End point', sub.endpoint);
    return;
  }

  const newSub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
  });
  // eslint-disable-next-line no-console
  console.log('End point (new)', newSub.endpoint);
}

/**
 * @param {string} body
 */
function showNotification (body) {
  const title = 'PWA Timer';
  /** @type {NotificationOptions} */
  const options = {
    body,
    icon: '/pwa-timer/assets/gpui/icon-512.png',
  };
  // eslint-disable-next-line no-new
  new Notification(title, options);
}

/**
 * @param {string} key
 * @param {any} value
 */
function save (key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * @param {string} key
 */
function load (key) {
  const json = localStorage.getItem(key);
  if (json) {
    try {
      const state = JSON.parse(json);
      return state;
    } catch (error) {
      // ignore
    }
  }
  return null;
}

/**
 * @param {AppPreferences} preferences
 */
function saveAppPreferences (preferences) {
  save('appPreferences', preferences);
}

function loadAppPreferences () {
  /** @type {AppPreferences | null} */
  const appPreferences = load('appPreferences');
  return appPreferences || {
    notificationEnabled: false,
  };
}

/**
 * @param {TimerState} state
 */
function saveTimerState (state) {
  save('timerState', state);
}

function loadTimerState () {
  /** @type {TimerState | null} */
  const state = load('timerState');
  return state || { ...Timer.initialState };
}

/**
 * @param {HTMLInputElement} el
 * @param {boolean} enabled
 */
function turnNotification (el, enabled) {
  const { permission } = Notification;
  if (permission === 'granted') {
    // eslint-disable-next-line no-param-reassign
    el.checked = enabled;
    saveAppPreferences({
      notificationEnabled: enabled,
    });
  } else if (permission === 'denied') {
    // eslint-disable-next-line no-param-reassign
    el.checked = false;

    // eslint-disable-next-line no-alert
    window.alert(
      'You have denied push Notification. You have to update your decision.',
    );
  } else {
    // eslint-disable-next-line no-param-reassign
    el.checked = false;

    Notification.requestPermission((newPermission) => {
      if (newPermission === 'default') {
        // eslint-disable-next-line no-alert
        window.alert(
          'You may have to reload in order to update your decision.',
        );
      } else {
        turnNotification(el, enabled);
      }
    });
  }
}

/**
 * @param {Element} container
 * @param {string} name
 * @return {any}
 */
function findElement (container, name) {
  const el = container.querySelector(`[data-js="${name}"]`);
  if (!el) {
    throw new Error(`Element named ${name} is not found`);
  }
  return el;
}

/**
 * @param {HTMLDivElement} elCount
 * @param {number} remaining
 */
function renderCount (elCount, remaining) {
  if (remaining < 0 || !remaining) {
    // eslint-disable-next-line no-param-reassign
    elCount.textContent = '0:00';
    return;
  }

  const remainingSeconds = Math.ceil(remaining / 1000);
  const m = Math.floor(remainingSeconds / 60);
  const ss = `0${remainingSeconds % 60}`.slice(-2);
  const count = `${m}:${ss}`;
  if (elCount.textContent !== count) {
    // eslint-disable-next-line no-param-reassign
    elCount.textContent = count;
  }
}

/**
 * @param {HTMLAudioElement} elChime
 */
function ring (elChime) {
  stopRinging(elChime);
  elChime.play();
}

/**
 * @param {HTMLAudioElement} elChime
 */
function stopRinging (elChime) {
  elChime.pause();
  // eslint-disable-next-line no-param-reassign
  elChime.currentTime = 0;
}

/**
 * @param {number} ms
 */
function sleep (ms) {
  return new Promise((f) => setTimeout(f, ms));
}

async function main () {
  // sometimes accidentally open '/' while developing
  if (!window.location.pathname.startsWith('/pwa-timer/')) {
    window.location.replace('/pwa-timer/');
  }

  if (!navigator.serviceWorker) {
    throw new Error('Service worker is not supported');
  }

  const reg = await navigator.serviceWorker.ready;
  if (reg.waiting) {
    // eslint-disable-next-line no-console
    console.log('Updating to new version...');
    await sleep(500); // just in case when infinite loop occurs accidentally

    /** @type {ClientMessage} */
    const message = { type: 'sw/skipWaiting' };
    reg.waiting.postMessage(message);
    window.location.reload();

    return;
  }

  const timer = new Timer({
    onAlarm () {
      renderCount(elCount, 0);
      ring(elChime);

      if (appPreferences.notificationEnabled) {
        showNotification("It's time!");
      }
    },
    onStart (goalTime) {
      stopRinging(elChime);
      saveTimerState({ goalTime });
    },
    onStop () {
      stopRinging(elChime);
    },
    onTick (remaining) {
      renderCount(elCount, remaining);
    },
  });

  /** @type {HTMLButtonElement} */
  const elOpenAbout = findElement(document.body, 'openAbout');
  elOpenAbout.onclick = () => {
    window.location.href = './about.html';
  };

  /** @type {HTMLDivElement} */
  const elCount = findElement(document.body, 'count');

  /** @type {HTMLButtonElement} */
  const elTimer5sec = findElement(document.body, 'timer-5sec');
  elTimer5sec.onclick = () => {
    timer.start(5000);
  };

  /** @type {HTMLButtonElement} */
  const elTimer3min = findElement(document.body, 'timer-3min');
  elTimer3min.onclick = () => {
    timer.start(3 * 60 * 1000);
  };

  /** @type {HTMLButtonElement} */
  const elStop = findElement(document.body, 'stop');
  elStop.onclick = () => timer.stop();

  /** @type {HTMLInputElement} */
  const elNotificationEnabled = findElement(
    document.body,
    'notificationEnabled',
  );
  elNotificationEnabled.onclick = () => {
    turnNotification(
      elNotificationEnabled,
      elNotificationEnabled.checked,
    );
  };

  /** @type {HTMLAudioElement} */
  const elChime = document.createElement('audio');
  elChime.src = 'assets/vendor/nhk-creative-library/D0002011518_00000_A_001.m4a';

  navigator.serviceWorker.addEventListener('message', async (event) => {
    /** @type {ControllerMessage} */
    const message = event.data;
    switch (message.type) {
      case 'sw/install': {
        await navigator.serviceWorker.getRegistration();
        // ignore if it is the first one which has already taken control
        if (reg.waiting) {
          // eslint-disable-next-line no-alert
          const ok = window.confirm('New version is available. Reload now?');
          if (ok) {
            window.location.reload();
          }
        }
        break;
      }

      default: // do nothing
    }
  });

  const appPreferences = loadAppPreferences();
  elNotificationEnabled.checked = appPreferences.notificationEnabled;

  const timerState = loadTimerState();
  const remaining = timerState.goalTime - Date.now();
  if (remaining > 0) {
    timer.start(remaining);
  }

  // elNotificationEnabled.checked = message.preferences.notificationEnabled;
  findElement(document.body, 'app').hidden = false;

  try {
    await subscribePushService();
  } catch (error) {
    // error message is not rendered correctly on Chrome 75
    if (error instanceof DOMException) {
      console.error(`${error.code} ${error.message}`, error);
    } else {
      console.error(error);
    }
  }
}

installServiceWorker();
document.addEventListener('DOMContentLoaded', main);
