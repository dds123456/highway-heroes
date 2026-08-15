export {};

declare global {
  interface Window {
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
