/* HIGHWAY HEROES Service Worker
 *
 * 缓存策略（修复子路径 + 无 hash 资源 stale 问题）：
 *   - 导航请求（HTML）：network-first，失败回退缓存 —— 每次刷新都能拿到新版本；
 *   - /assets/*（Vite 产物，内容哈希不变）：cache-first，作为唯一 immutable 缓存；
 *   - 其余资源（models/music/audio/textures/items/social/icons，无哈希且会随部署更新）：
 *     network-first —— 优先进网络，成功即更新缓存，失败才回退缓存。
 *     这样每次部署后模型/音乐/贴图都能拿到最新，不再命中旧缓存。
 *
 * 所有匹配均基于 registration.scope（子路径安全），不使用写死的根绝对路径。
 */
const VERSION = 'v2';
const PREFIX = `hh-${VERSION}`;

const SCOPE_PATH = new URL(self.registration.scope).pathname; // 形如 /see-apps/{appName}/
const inScope = (url) => url.origin === self.location.origin && url.pathname.startsWith(SCOPE_PATH);

const openCache = () => caches.open(PREFIX);

async function stash(request, response) {
  if (response && response.ok) {
    const copy = response.clone();
    try {
      await (await openCache()).put(request, copy);
    } catch (_) {
      /* 写入缓存失败不影响请求结果 */
    }
  }
}

async function networkFirst(request) {
  try {
    const response = await fetch(request);
    await stash(request, response);
    return response;
  } catch (err) {
    const cached = await (await openCache()).match(request);
    if (cached) return cached;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await (await openCache()).match(request);
  if (cached) return cached;
  const response = await fetch(request);
  await stash(request, response);
  return response;
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('hh-') && k !== PREFIX).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (!inScope(new URL(request.url))) return;

  // 导航请求（HTML）：网络优先，回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Vite 产物（/assets/*，内容哈希文件名）：唯一采用 cache-first 的 immutable 资源
  if (new URL(request.url).pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 其余资源（模型/音乐/音频/贴图/道具/图标/分享图）：网络优先，保证部署后是最新内容
  event.respondWith(networkFirst(request));
});