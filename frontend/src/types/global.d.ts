export {};

declare global {
  interface Window {
    SSOCore?: {
      isPlatformHost(): boolean;
      loadUserInfo(): Promise<unknown>;
      getDisplayName(user: unknown): string;
      getInitial(user: unknown): string;
      logout(): Promise<void>;
    };
    DCUUserMenu?: {
      mount(target: string | HTMLElement, opts?: unknown): Promise<unknown>;
    };
    __RACE_DEBUG__?: {
      setCamera(mode: 'chase' | 'hood' | 'side' | 'orbit' | 'far'): void;
      jumpTo(progress: number): void;
      start(): void;
      pause(): void;
      resume(): void;
      setState(state: string): void;
      setPostprocess(enabled: boolean): void;
      setWeather(mode: 'sunny' | 'rain' | 'snow' | 'storm'): void;
      getState(): {
        progress: number;
        lateral: number;
        speed: number;
        state: string;
        rank: number;
        lap: number;
        countdown: number;
        fps: number;
        camPos: [number, number, number];
        camPitch: number;
        camLook: [number, number, number];
        bikeY: number;
        upY: number;
        tanY: number;
        slope: number;
        renderCalls: number;
        renderTris: number;
      };
    };
  }
}
