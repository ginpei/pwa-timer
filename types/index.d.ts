interface AppPreferences {
  notificationEnabled: boolean;
}

type ControllerMessage = {
  type: 'sw/install';
} | {
  type: 'timer/alarm';
} | {
  remaining: number;
  type: 'timer/tick';
} | {
  type: 'timer/start';
} | {
  type: 'timer/stop';
} | {
  preferences: AppPreferences;
  remaining: number;
  running: boolean;
  type: 'timer/status';
};

type ClientMessage = {
  type: 'sw/skipWaiting';
} | {
  type: 'timer/requestStatus';
} | {
  duration: number;
  type: 'timer/start';
} | {
  type: 'timer/stop';
} | {
  notificationEnabled: boolean;
  type: 'preferences/notificationEnabled';
}
