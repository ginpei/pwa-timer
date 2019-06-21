/* eslint-disable no-use-before-define */

async function installServiceWorker () {
  try {
    await navigator.serviceWorker.register('/pwa-timer/service-worker.js');
  } catch (error) {
    console.error(error);
  }
}

/**
 * @returns {Promise<ServiceWorker>}
 */
async function getController () {
  const reg = await navigator.serviceWorker.ready;
  const controller = reg.active;
  if (!controller) {
    throw new Error('Failed to obtain active controller');
  }

  return controller;
}

/**
 * @param {ClientMessage} message
 */
async function postMessageToController (message) {
  const controller = await getController();
  controller.postMessage(message);
}

async function installNewController () {
  const reg = await navigator.serviceWorker.ready;
  const newController = reg.waiting;
  if (!newController) {
    throw new Error('No controller is waiting');
  }

  /** @type {ClientMessage} */
  const message = { type: 'sw/skipWaiting' };
  newController.postMessage(message);
  window.location.reload();
}

/**
 * @param {number} duration
 */
function startTimer (duration) {
  postMessageToController({
    duration,
    type: 'timer/start',
  });
}

function stopTimer () {
  postMessageToController({
    type: 'timer/stop',
  });
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
    postMessageToController({
      notificationEnabled: enabled,
      type: 'preferences/notificationEnabled',
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

/** @type {HTMLDivElement} */
const elCount = findElement(document.body, 'count');

/**
 * @param {number} remaining
 */
function renderCount (remaining) {
  if (remaining < 0 || !remaining) {
    elCount.textContent = '0:00';
    return;
  }

  const remainingSeconds = Math.ceil(remaining / 1000);
  const m = Math.floor(remainingSeconds / 60);
  const ss = `0${remainingSeconds % 60}`.slice(-2);
  const count = `${m}:${ss}`;
  if (elCount.textContent !== count) {
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
  // sometimes accidentaly open '/' while developing
  if (!window.location.pathname.startsWith('/pwa-timer/')) {
    window.location.replace('/pwa-timer/');
  }

  if (!navigator.serviceWorker) {
    throw new Error('Service worker is not supported');
  }

  const reg = await navigator.serviceWorker.ready;
  if (reg.waiting) {
    await sleep(500); // just in case
    installNewController();
    return;
  }

  /** @type {HTMLButtonElement} */
  const elOpenAbout = findElement(document.body, 'openAbout');
  elOpenAbout.onclick = () => {
    window.location.href = './about.html';
  };

  /** @type {HTMLButtonElement} */
  const elTimer5sec = findElement(document.body, 'timer-5sec');
  elTimer5sec.onclick = () => {
    startTimer(5000);
  };

  /** @type {HTMLButtonElement} */
  const elTimer3min = findElement(document.body, 'timer-3min');
  elTimer3min.onclick = () => {
    startTimer(3 * 60 * 1000);
  };

  /** @type {HTMLButtonElement} */
  const elStop = findElement(document.body, 'stop');
  elStop.onclick = () => stopTimer();

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
        // eslint-disable-next-line no-alert
        const ok = window.confirm('New version is available. Reload now?');
        if (ok) {
          await installNewController();
        }
        break;
      }

      case 'timer/tick': {
        renderCount(message.remaining);
        break;
      }

      case 'timer/alarm': {
        renderCount(0);
        ring(elChime);
        break;
      }

      case 'timer/start': {
        stopRinging(elChime);
        break;
      }

      case 'timer/stop': {
        stopRinging(elChime);
        break;
      }

      case 'timer/status': {
        if (message.running) {
          renderCount(message.remaining);
        }
        elNotificationEnabled.checked = message.preferences.notificationEnabled;
        findElement(document.body, 'app').hidden = false;
        break;
      }

      default: // do nothing
    }
  });

  try {
    postMessageToController({ type: 'timer/requestStatus' });
  } catch (error) {
    console.error(error);
  }
}

installServiceWorker();
document.addEventListener('DOMContentLoaded', main);
