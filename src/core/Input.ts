export interface InputState {
  throttle: boolean;
  brake: boolean;
  steer: number;
  drift: boolean;
  boost: boolean;
  nitro: boolean;
}

export class Input {
  state: InputState = { throttle: false, brake: false, steer: 0, drift: false, boost: false, nitro: false };

  private keys = new Set<string>();
  private gamepadIndex = -1;
  private onStart: (() => void) | null = null;
  private onPause: (() => void) | null = null;

  constructor() {
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = -1;
    });
  }

  setStartHandler(handler: () => void): void {
    this.onStart = handler;
  }

  setPauseHandler(handler: () => void): void {
    this.onPause = handler;
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    const key = e.key.toLowerCase();
    if (down && ['enter', ' '].includes(key)) {
      e.preventDefault();
      if (this.onStart && (key === 'enter' || key === ' ')) this.onStart();
    }
    if (down && key === 'escape') this.onPause?.();
    if (down) this.keys.add(key);
    else this.keys.delete(key);
  }

  private readGamepad(): void {
    if (this.gamepadIndex < 0) return;
    const pad = navigator.getGamepads?.()[this.gamepadIndex];
    if (!pad) return;
    const ax = pad.axes[0] ?? 0;
    const throttle = pad.buttons[7]?.pressed ?? false;
    const brake = pad.buttons[6]?.pressed ?? false;
    const drift = pad.buttons[0]?.pressed ?? false;
    const boost = pad.buttons[3]?.pressed ?? false;
    if (Math.abs(ax) > 0.18) this.state.steer = ax;
    if (throttle) this.state.throttle = true;
    if (brake) this.state.brake = true;
    if (drift) this.state.drift = true;
    if (boost) this.state.boost = true;
  }

  poll(): void {
    const s = this.state;
    s.throttle = this.keys.has('w') || this.keys.has('arrowup');
    s.brake = this.keys.has('s') || this.keys.has('arrowdown');
    s.drift = this.keys.has(' ' ) || this.keys.has('x');
    s.boost = false;
    s.nitro = this.keys.has('q');
    let steer = 0;
    if (this.keys.has('a') || this.keys.has('arrowleft')) steer -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) steer += 1;
    s.steer = steer;
    this.readGamepad();
  }

  clear(): void {
    this.state.throttle = false;
    this.state.brake = false;
    this.state.steer = 0;
    this.state.drift = false;
    this.state.boost = false;
  }
}
