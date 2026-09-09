export interface InputState {
  throttle: boolean;
  brake: boolean;
  steer: number;
  drift: boolean;
  boost: boolean;
  nitro: boolean;
  useItem: boolean;
}

/** 菜单/界面的语义动作：输入层只产生动作，由 HUD/ScreenManager 决定含义 */
export type UIInputAction = 'up' | 'down' | 'left' | 'right' | 'confirm' | 'back';

/**
 * Xbox 标准手柄按键常量。
 * A=0 B=1 X=2 Y=3 LB=4 RB=5 LT=6 RT=7 Back=8 Start=9
 */
const BUTTON = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LT: 6,
  RT: 7,
  START: 9,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

const DEADZONE = 0.18;

export class Input {
  state: InputState = { throttle: false, brake: false, steer: 0, drift: false, boost: false, nitro: false, useItem: false };
  readonly isTouch = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
  uiAction: UIInputAction | null = null;

  private keys = new Set<string>();
  private gamepadIndex = -1;
  private prevPadButtons: boolean[] = [];
  private onStart: (() => void) | null = null;
  private onPause: (() => void) | null = null;
  private onBack: (() => void) | null = null;
  private onHelp: (() => void) | null = null;
  private touch = { left: false, right: false, brake: false, drift: false, nitro: false };
  private itemQueued = false;

  constructor() {
    window.addEventListener('keydown', (e) => this.handleKey(e, true));
    window.addEventListener('keyup', (e) => this.handleKey(e, false));
    window.addEventListener('blur', () => this.keys.clear());
    window.addEventListener('gamepadconnected', (e) => {
      this.gamepadIndex = e.gamepad.index;
      this.prevPadButtons = [];
    });
    window.addEventListener('gamepaddisconnected', () => {
      this.gamepadIndex = -1;
      this.prevPadButtons = [];
    });
    if (this.isTouch) this.buildTouchControls();
  }

  setStartHandler(handler: () => void): void {
    this.onStart = handler;
  }

  setPauseHandler(handler: () => void): void {
    this.onPause = handler;
  }

  setBackHandler(handler: () => void): void {
    this.onBack = handler;
  }

  setHelpHandler(handler: () => void): void {
    this.onHelp = handler;
  }

  private handleKey(e: KeyboardEvent, down: boolean): void {
    // 赛车操作使用 event.code（物理键位），避免非 QWERTY / 输入法布局导致 WASD 位置错乱。
    const code = e.code;

    // 文本输入控件内不拦截，仍按浏览器默认处理。
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
    if (target?.closest('button, summary') && (code === 'Enter' || code === 'Space')) return;

    if (down && code === 'Enter') {
      e.preventDefault();
      this.onStart?.();
    }
    if (down && (code === 'Escape' || code === 'KeyP')) this.onPause?.();
    if (down && (code === 'KeyH' || code === 'F1')) this.onHelp?.();
    // 道具为「按下沿」触发，只登记一次
    if (down && (code === 'KeyE' || code === 'KeyJ')) this.itemQueued = true;
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  private pressedOnce(index: number, buttons: readonly GamepadButton[]): boolean {
    const now = Boolean(buttons[index]?.pressed);
    const prev = Boolean(this.prevPadButtons[index]);
    return now && !prev;
  }

  private readGamepad(): void {
    this.uiAction = null;
    if (this.gamepadIndex < 0) return;
    const pad = navigator.getGamepads?.()[this.gamepadIndex];
    if (!pad) return;

    const buttons = pad.buttons;
    // 记录上一帧按钮状态，供 pressedOnce 判断上升沿
    const snapshot: boolean[] = [];
    for (let i = 0; i < buttons.length; i++) snapshot.push(Boolean(buttons[i]?.pressed));

    const axis = pad.axes[0] ?? 0;
    let steer = 0;
    if (Math.abs(axis) > DEADZONE) steer = axis;
    if (buttons[BUTTON.DPAD_LEFT]?.pressed) steer = -1;
    if (buttons[BUTTON.DPAD_RIGHT]?.pressed) steer = 1;
    if (steer !== 0) this.state.steer = steer;

    if (buttons[BUTTON.RT]?.pressed) this.state.throttle = true;
    if (buttons[BUTTON.LT]?.pressed) this.state.brake = true;
    if (buttons[BUTTON.A]?.pressed) this.state.drift = true;
    if (buttons[BUTTON.Y]?.pressed) this.state.nitro = true;
    // 道具：按下沿触发一次
    if (this.pressedOnce(BUTTON.X, buttons)) this.itemQueued = true;
    if (this.pressedOnce(BUTTON.START, buttons)) this.onPause?.();
    if (this.pressedOnce(BUTTON.B, buttons)) this.onBack?.();

    // 菜单导航语义动作
    if (this.pressedOnce(BUTTON.DPAD_UP, buttons)) this.uiAction = 'up';
    else if (this.pressedOnce(BUTTON.DPAD_DOWN, buttons)) this.uiAction = 'down';
    else if (this.pressedOnce(BUTTON.DPAD_LEFT, buttons)) this.uiAction = 'left';
    else if (this.pressedOnce(BUTTON.DPAD_RIGHT, buttons)) this.uiAction = 'right';
    else if (this.pressedOnce(BUTTON.A, buttons)) this.uiAction = 'confirm';
    else if (this.pressedOnce(BUTTON.B, buttons)) this.uiAction = 'back';

    this.prevPadButtons = snapshot;
  }

  poll(): void {
    const s = this.state;
    s.drift = this.keys.has('Space') || this.keys.has('KeyX') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    s.nitro = this.keys.has('KeyQ');
    s.useItem = this.itemQueued;
    this.itemQueued = false;

    if (this.isTouch) {
      s.throttle = !this.touch.brake;
      s.brake = this.touch.brake;
      s.drift = s.drift || this.touch.drift;
      s.nitro = s.nitro || this.touch.nitro;
      s.steer = (this.touch.left ? -1 : 0) + (this.touch.right ? 1 : 0);
    } else {
      s.throttle = this.keys.has('KeyW') || this.keys.has('ArrowUp');
      s.brake = this.keys.has('KeyS') || this.keys.has('ArrowDown');
      let steer = 0;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer += 1;
      s.steer = steer;
    }
    this.readGamepad();
  }

  clear(): void {
    this.state.throttle = false;
    this.state.brake = false;
    this.state.steer = 0;
    this.state.drift = false;
    this.state.boost = false;
    this.state.nitro = false;
    this.state.useItem = false;
    this.uiAction = null;
    this.touch.left = this.touch.right = this.touch.brake = this.touch.drift = this.touch.nitro = false;
  }

  private buildTouchControls(): void {
    const root = document.createElement('div');
    root.id = 'touch-controls';

    const bind = (btn: HTMLElement, on: () => void, off?: () => void): void => {
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        btn.setPointerCapture?.(e.pointerId);
        on();
      });
      const release = (): void => off?.();
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('pointerleave', release);
    };

    const steerL = document.createElement('button');
    steerL.className = 'tbtn tbtn-steer';
    steerL.textContent = '◀';
    bind(steerL, () => (this.touch.left = true), () => (this.touch.left = false));

    const steerR = document.createElement('button');
    steerR.className = 'tbtn tbtn-steer';
    steerR.textContent = '▶';
    bind(steerR, () => (this.touch.right = true), () => (this.touch.right = false));

    const brake = document.createElement('button');
    brake.className = 'tbtn tbtn-brake';
    brake.textContent = '刹';
    bind(brake, () => (this.touch.brake = true), () => (this.touch.brake = false));

    const drift = document.createElement('button');
    drift.className = 'tbtn tbtn-drift';
    drift.textContent = '漂移';
    bind(drift, () => (this.touch.drift = true), () => (this.touch.drift = false));

    const nitro = document.createElement('button');
    nitro.className = 'tbtn tbtn-nitro';
    nitro.textContent = '氮气';
    bind(nitro, () => (this.touch.nitro = true), () => (this.touch.nitro = false));

    const item = document.createElement('button');
    item.className = 'tbtn tbtn-item';
    item.textContent = '道具';
    bind(item, () => (this.itemQueued = true));

    const left = document.createElement('div');
    left.className = 'tcluster tcluster-left';
    left.append(steerL, steerR);

    const right = document.createElement('div');
    right.className = 'tcluster tcluster-right';
    right.append(item, nitro, drift, brake);

    root.append(left, right);
    document.body.appendChild(root);
  }
}
