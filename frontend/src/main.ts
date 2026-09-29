import './styles/main.css';
import { Game } from './core/Game';
import { preloadBikeForms, loadedBikeForms, BikeAssetLoadError } from './entities/bikeAssets';
import { preloadRiderCharacter, RiderAssetLoadError } from './entities/CharacterAsset';
import { preloadEngineSamples } from './audio/engineSamples';
import { preloadWeatherSamples } from './audio/weatherSamples';
import { preloadWrapTextures } from './render/wrapTextures';
import { preloadItemSprites } from './items/itemSprites';

const loadingEl = document.getElementById('loading');
const barEl = loadingEl?.querySelector<HTMLElement>('.loading-bar span') ?? null;
const statusEl = loadingEl?.querySelector<HTMLElement>('.loading-status') ?? null;
const retryEl = loadingEl?.querySelector<HTMLButtonElement>('.loading-retry') ?? null;

const BIKE_FORMS = ['bonneville', 'dt1', 'flh'] as const;

function setStatus(text: string): void {
  if (statusEl) statusEl.textContent = text;
}

function setProgress(ratio: number): void {
  if (barEl) barEl.style.width = `${Math.round(ratio * 100)}%`;
}

function setFailed(err: unknown): void {
  const label = err instanceof BikeAssetLoadError
    ? `加载失败：${err.file}`
    : err instanceof RiderAssetLoadError
      ? '加载失败：车手捏脸模型'
      : '加载失败';
  setStatus(label);
  if (retryEl) retryEl.hidden = false;
  console.error('[boot] 资源预加载失败：', err);
}

function hideLoading(): void {
  if (!loadingEl) return;
  loadingEl.style.transition = 'opacity 0.4s ease';
  loadingEl.style.opacity = '0';
  setTimeout(() => loadingEl.remove(), 500);
}

/** 检测 WebGL2 是否可用（Three.js r168 只支持 WebGL2，无 WebGL1 回退） */
function isWebGL2Available(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

/** WebGL2 不可用时给出明确提示，避免黑屏无响应 */
function setWebGLUnsupported(): void {
  if (statusEl) {
    statusEl.textContent = '当前浏览器不支持 WebGL2，无法渲染游戏。请改用系统自带 Chrome / Safari 打开。';
  }
  if (barEl) barEl.style.width = '100%';
  if (retryEl) retryEl.hidden = true;
  console.error('[boot] 当前浏览器不支持 WebGL2');
}

function startGame(): void {
  void new Game();
  hideLoading();
  // 引擎采样 / 天气采样后台加载，就绪后自动从程序化音切换到采样；失败则回退
  void preloadEngineSamples();
  void preloadWeatherSamples();
}

async function loadBikes(): Promise<void> {
  const total = BIKE_FORMS.length;
  const already = loadedBikeForms().length;
  let done = Math.min(already, total);
  setProgress(done / total);
  // 并发加载，但进度按已就绪数量推进；失败会向上抛出（不再缓存空模型）。
  await Promise.all(
    BIKE_FORMS.map(async (form) => {
      await preloadBikeForms([form]);
      done += 1;
      setProgress(done / total);
      setStatus(`加载车辆模型 ${done}/${total}`);
    }),
  );
}

async function loadRider(): Promise<void> {
  setStatus('加载车手捏脸模型…');
  await preloadRiderCharacter();
}

async function loadWraps(): Promise<void> {
  try {
    await preloadWrapTextures();
  } catch (err) {
    // 车衣贴图加载失败不阻断启动：选车台切换车衣时 getWrapTexture 会明确报错，
    // 这里仅打印警告，游戏其余功能不受影响。
    console.warn('[boot] 车衣纹理加载失败（车衣预览将不可用）：', err);
  }
}

async function loadItemSprites(): Promise<void> {
  try {
    await preloadItemSprites();
  } catch (err) {
    // 道具图集加载失败不阻断启动：比赛中道具会退化为不可见，但不影响游戏流程。
    console.warn('[boot] 道具图集加载失败（道具图标将不可用）：', err);
  }
}

async function boot(): Promise<void> {
  if (retryEl) retryEl.hidden = true;
  setProgress(0);
  setStatus('加载车辆模型…');

  // WebGL2 不可用时直接提示，避免黑屏卡死在加载屏
  if (!isWebGL2Available()) {
    setWebGLUnsupported();
    return;
  }

  try {
    await Promise.all([loadBikes(), loadRider(), loadWraps(), loadItemSprites()]);
    startGame();
  } catch (err) {
    setFailed(err);
  }
}

if (retryEl) retryEl.addEventListener('click', () => void boot());

// SSO 用户菜单：登录后显示头像 + 姓名，点击下拉可退出登录。
// sso-core / user-menu 由 index.html 以普通 <script> 引入并挂载到 window。
function mountUserMenu(): void {
  const mount = document.getElementById('dcu-mount');
  if (!mount) return;
  window.DCUUserMenu?.mount(mount).catch(() => {
    /* SSO 不可用（如未知域名）时静默，不影响游戏 */
  });
}
if (document.readyState === 'complete') {
  mountUserMenu();
} else {
  window.addEventListener('load', mountUserMenu);
}

// PWA 缓存（仅生产环境注册）
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* Service Worker 注册失败不影响游戏 */
    });
  });
}

void boot();