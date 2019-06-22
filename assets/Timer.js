export default class Timer {
  /**
   * @param {TimerProps} props
   */
  constructor (props) {
    this._props = props;
    /** @type {() => void} */
    this._stopTimer = () => undefined;
    this._goalTime = 0;
  }

  /**
   * @param {number} duration
   */
  start (duration) {
    this._startTimer(
      duration,
      () => this._emitTick(),
      () => this._emitAlarm(),
    );
    this._emitStart();
  }

  stop () {
    this._stopTimer();
    this._emitTick();
    this._emitStop();
  }

  getStatus () {
    const running = this._goalTime !== 0;
    const remaining = running ? this._goalTime - Date.now() : 0;
    return {
      remaining,
      running,
    };
  }

  /**
   * @param {number} duration
   * @param {() => void} onTick
   * @param {() => void} onAlarm
   */
  _startTimer (duration, onTick, onAlarm) {
    this._stopTimer();
    this._goalTime = Date.now() + duration;

    const tm = setInterval(() => {
      const now = Date.now();
      if (now < this._goalTime) {
        onTick();
      } else {
        this._stopTimer();
        onAlarm();
      }
    }, 16);

    this._stopTimer = () => {
      clearInterval(tm);
      this._goalTime = 0;
    };
  }

  _emitStart () {
    this._props.onStart(this._goalTime);
  }

  _emitStop () {
    this._props.onStop();
  }

  _emitAlarm () {
    this._props.onAlarm();
  }

  _emitTick () {
    const remaining = this._goalTime - Date.now();
    this._props.onTick(remaining);
  }
}

/** @type {Readonly<TimerState>} */
Timer.initialState = Object.freeze({
  goalTime: 0,
});
