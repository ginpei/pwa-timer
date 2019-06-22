interface AppPreferences {
  notificationEnabled: boolean;
}

interface TimerProps {
  onAlarm: () => void;
  onStart: (goalTime: number) => void;
  onStop: () => void;
  onTick: (remaining: number) => void;
}

interface TimerState {
  goalTime: number; // UNIX time
}

type ControllerMessage = {
  type: 'sw/install';
};

type ClientMessage = {
  type: 'sw/skipWaiting';
}
