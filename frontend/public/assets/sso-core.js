/** DewuClaw SSO 核心逻辑 — 独立探测 Token、接口和登录触发条件。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.SSOCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var LOGIN_GUARD_KEY = 'dcu-sso-login-started';
  var TOKEN_RELOGIN_GUARD_KEY = 'dcu-sso-token-relogin-attempted';
  var TOKEN_STORAGE_KEY = 'dcu-sso-token';
  // 防循环标记有效期：超过该时长（毫秒）视为过期，允许重新跳转登录，
  // 避免内置浏览器（wry WebView）等场景下残留 guard 导致永久卡死。
  var LOGIN_GUARD_TTL = 5 * 60 * 1000; // 5 分钟
  var SSO_AUTH_URL = 'https://ep-copilot.shizhuang-inc.com/h5/sso/dewuclaw-sso.html';
  var SSO_SDK_URL = 'https://cdn-jumper.dewu.com/sdk-linker/sso.js';
  var SSO_USERINFO_URL = 'https://sso.shizhuang-inc.com/api/v1/h5/cas/user/infoNoSensitive';
  var tokenSource = null;
  var userInfoInflight = null;

  function win() { return typeof window !== 'undefined' ? window : {}; }

  // URLSearchParams polyfill：兼容旧版 WebKit（wry 内置浏览器/低版本 macOS）
  // 仅在全局缺失时注入最小实现，避免影响现代浏览器
  function ensureURLSearchParams() {
    if (typeof URLSearchParams !== 'undefined') return;
    var g = (typeof window !== 'undefined') ? window : globalThis;
    function URLSearchParamsPolyfill(init) {
      this._map = {};
      if (typeof init === 'string' && init.length > 0) {
        var pairs = init.replace(/^\?/, '').split('&');
        for (var i = 0; i < pairs.length; i++) {
          if (!pairs[i]) continue;
          var kv = pairs[i].split('=');
          var k = decodeURIComponent(kv[0] || '');
          var v = kv.length > 1 ? decodeURIComponent(kv[1]) : '';
          this.append(k, v);
        }
      }
    }
    URLSearchParamsPolyfill.prototype.append = function (k, v) {
      if (!this._map[k]) this._map[k] = [];
      this._map[k].push(String(v));
    };
    URLSearchParamsPolyfill.prototype.get = function (k) {
      var arr = this._map[k];
      return arr && arr.length ? arr[0] : null;
    };
    URLSearchParamsPolyfill.prototype.delete = function (k) { delete this._map[k]; };
    URLSearchParamsPolyfill.prototype.toString = function () {
      var parts = [];
      for (var k in this._map) {
        if (!Object.prototype.hasOwnProperty.call(this._map, k)) continue;
        var arr = this._map[k];
        for (var i = 0; i < arr.length; i++) {
          parts.push(encodeURIComponent(k) + '=' + encodeURIComponent(arr[i]));
        }
      }
      return parts.join('&');
    };
    g.URLSearchParams = URLSearchParamsPolyfill;
  }
  ensureURLSearchParams();

  function getCookie(name) {
    var m = (typeof document !== 'undefined' ? document.cookie : '')
      .match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }

  // ─────────────────────────────────────────────────────────────────────
  // Token 获取：平台 Cookie 或本地 URL/localStorage 回调
  // ─────────────────────────────────────────────────────────────────────

  function getToken() {
    var w = win();
    var loc = w.location || {};
    tokenSource = null;
    // 未知域名不参与认证，避免误读其他应用的 Token。
    if (!isLocalhost(w) && !isPlatformHost(w)) return null;

    // 企业平台只信任平台注入的 Cookie；缺失时由 SDK 负责登录。
    if (isPlatformHost(w)) {
      var platformToken = getCookieToken();
      if (platformToken) {
        tokenSource = 'cookie';
        return platformToken;
      }
      return null;
    }

    // 1. URL 参数（SSO 回调携带）—— 两种模式都优先
    // 正常格式：?agent_id=default&accessToken=xxx
    // 兼容格式：/index.html&accessToken=xxx（授权页把 & 追加到无 query 的 URL 末尾）
    var urlToken = null;
    var href = loc.href || '';
    var full = (loc.search || '') + (loc.hash || '');
    var params = new URLSearchParams(full);
    urlToken = params.get('accessToken');
    if (!urlToken) {
      // 兜底：正则从整个 URL 中提取 accessToken=xxx 的值
      var m = href.match(/[?&]accessToken=([^&#]+)/);
      if (m) urlToken = decodeURIComponent(m[1]);
    }
    if (urlToken) {
      tokenSource = 'url';
      // 本地回调必须缓存到当前 origin。
      if (isLocalhost(w)) {
        try { w.localStorage.setItem(TOKEN_STORAGE_KEY, urlToken); } catch (e) {}
      }
      clearLoginGuard();                               // 回调回来，清除防循环标记
      // 从 URL 清除 token（两种格式都处理）
      if (w.history && w.history.replaceState) {
        try {
          var clean = (loc.href || '').replace(/([?&])accessToken=[^&#]*/, function (m, prefix) {
            return prefix === '?' ? '?' : '';
          }).replace(/[?&]accessToken=[^&#]*/, '');
          if (clean !== (loc.href || '')) {
            w.history.replaceState(null, '', clean);
          } else {
            // 兜底：URLSearchParams 清理
            params.delete('accessToken');
            var qs = params.toString();
            var clean2 = (loc.pathname || '/') + (qs ? '?' + qs : '') + (loc.hash || '');
            w.history.replaceState(null, '', clean2);
          }
        } catch (e) {}
      }
      return urlToken;
    }

    // localhost 只使用 URL/localStorage；页面 Cookie 不作为默认 Token 来源。
    if (isLocalhost(w)) {
      var localStored = null;
      try { localStored = w.localStorage.getItem(TOKEN_STORAGE_KEY); } catch (e) {}
      if (localStored) {
        tokenSource = 'localStorage';
        return localStored;
      }
      return null;
    }

    return null;
  }

  function getCookieToken() {
    return getCookie('accessToken') || getCookie('prod_accessToken') || getCookie('t1_accessToken') || null;
  }

  function isLocalhost(w) {
    var hostname = ((w.location || {}).hostname || '').toLowerCase();
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  function isPlatformHost(w) {
    w = w || win();
    var hostname = ((w.location || {}).hostname || '').toLowerCase();
    return hostname === 'dewu-inc.com' || hostname.endsWith('.dewu-inc.com') ||
      hostname === 'shizhuang-inc.net' || hostname.endsWith('.shizhuang-inc.net');
  }

  // ─────────────────────────────────────────────────────────────────────
  // 登录防循环
  // ─────────────────────────────────────────────────────────────────────

  function loginGuard() {
    var storage = win().sessionStorage;
    var val = storage && storage.getItem(LOGIN_GUARD_KEY);
    if (!val) return false;
    // 旧格式没有时间信息，按过期处理，避免残留 guard 永久阻止登录。
    if (!/^\d{13}$/.test(val)) {
      clearLoginGuard();
      return false;
    }
    var ts = parseInt(val, 10);
    // 超过 TTL 视为过期，自动清除，允许重新跳转
    if (Date.now() - ts > LOGIN_GUARD_TTL) {
      clearLoginGuard();
      return false;
    }
    return true;
  }

  function markLoginStarted() {
    var storage = win().sessionStorage;
    if (storage) storage.setItem(LOGIN_GUARD_KEY, String(Date.now()));
  }

  function clearLoginGuard() {
    var storage = win().sessionStorage;
    if (storage) storage.removeItem(LOGIN_GUARD_KEY);
  }

  function tokenReloginAttempted() {
    var storage = win().sessionStorage;
    return !!(storage && storage.getItem(TOKEN_RELOGIN_GUARD_KEY));
  }

  function markTokenReloginAttempted() {
    var storage = win().sessionStorage;
    if (storage) storage.setItem(TOKEN_RELOGIN_GUARD_KEY, '1');
  }

  function clearTokenReloginGuard() {
    var storage = win().sessionStorage;
    if (storage) storage.removeItem(TOKEN_RELOGIN_GUARD_KEY);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 跳转 SSO 登录
  // SDK 仅在企业平台后缀可用；本地/未知环境不加载 SDK
  // ─────────────────────────────────────────────────────────────────────

  function beginLogin(force) {
    var w = win();
    // 本地授权页自己处理 guard，避免先标记后被本地分支拦截。
    if (isLocalhost(w)) return beginLocalBrowserLogin(force);
    if (!force && loginGuard()) return false;
    markLoginStarted();
    // 平台域名优先使用 SDK；SDK 尚未加载时由核心逻辑补加载。
    if (isPlatformHost(w)) {
      if (w.multisso && typeof w.multisso.ssoLogin === 'function') {
        try {
          w.multisso.ssoLogin();
          return true;
        } catch (e) { /* SDK 异常，继续尝试加载 */ }
      }
      if (ensurePlatformSdk(w)) return true;
    }

    // 平台 Cookie 可能通过刷新重新注入；guard 防止重复刷新。
    if (tokenSource === 'cookie' || getCookieToken()) {
      try {
        if (w.location && w.location.reload) { w.location.reload(); return true; }
      } catch (e3) { /* 刷新失败，继续尝试授权页 */ }
    }

    clearLoginGuard();
    return false;
  }

  function buildLocalLoginUrl(w) {
    var loc = (w || win()).location || {};
    var origin = loc.origin || ((loc.protocol && loc.host) ? loc.protocol + '//' + loc.host : '');
    var path = loc.pathname || '/';
    var search = loc.search || '?';
    var hash = loc.hash || '';
    var returnUrl = origin + path + search + hash;
    return SSO_AUTH_URL + '?ep_redirect_uri=' + encodeURIComponent(returnUrl);
  }

  function beginLocalBrowserLogin(force) {
    var w = win();
    if (!isLocalhost(w)) return false;
    if (tokenReloginAttempted()) return false;
    if (!force && loginGuard()) return false;
    markLoginStarted();
    var loginUrl = buildLocalLoginUrl(w);
    var loc = w.location || {};
    try {
      if (loc.assign) { loc.assign(loginUrl); return true; }
    } catch (e) {}
    try {
      if (loc) { loc.href = loginUrl; return true; }
    } catch (e2) {}
    clearLoginGuard();
    return false;
  }

  function ensurePlatformSdk(w) {
    if (!isPlatformHost(w) || typeof document === 'undefined') return false;
    var scripts = document.getElementsByTagName ? document.getElementsByTagName('script') : [];
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src === SSO_SDK_URL) {
        scripts[i].addEventListener && scripts[i].addEventListener('load', function () {
          try { if (w.multisso && w.multisso.ssoLogin) w.multisso.ssoLogin(); } catch (e) {}
        }, { once: true });
        return true;
      }
    }
    var script = document.createElement && document.createElement('script');
    if (!script) return false;
    script.src = SSO_SDK_URL;
    script.onload = function () {
      try { if (w.multisso && w.multisso.ssoLogin) w.multisso.ssoLogin(); } catch (e) { clearLoginGuard(); }
    };
    script.onerror = function () { clearLoginGuard(); };
    (document.head || document.documentElement).appendChild(script);
    return true;
  }

  function isMiaodaHost(w) { return isPlatformHost(w); }

  // ─────────────────────────────────────────────────────────────────────
  // 用户信息归一化
  // ─────────────────────────────────────────────────────────────────────

  function normalizeUser(raw) {
    if (!raw) return null;
    return {
      username: raw.username || raw.loginName || '',
      realname: raw.realname || raw.realName || raw.name || '',
      avatar: raw.avatar || raw.avatarUrl || raw.avatar_url || raw.headImgUrl ||
        raw.head_img_url || raw.headUrl || raw.head_url || raw.portrait || '',
      email: raw.email || '',
      openLarkId: raw.openLarkId || raw.open_lark_id || '',
    };
  }

  function parseUserBody(body) {
    if (!body) return null;
    // SSO 用户信息接口 token 失效码
    if (body.code === 305 || body.code === 401) return { _tokenExpired: true };
    // 提取数据层：兼容 {status:100, data:{...}} / {data:{...}} / 直接对象
    var data;
    if (body.status === 100) data = body.data;
    else if (body.data && typeof body.data === 'object') data = body.data;
    else data = body;
    var user = normalizeUser(data);
    return user && (user.username || user.realname) ? user : null;
  }

  // ─────────────────────────────────────────────────────────────────────
  // 用户信息加载：先同源，再跨域降级
  // ─────────────────────────────────────────────────────────────────────

  function tryUserInfo(url, token) {
    return fetch(url, { headers: { accessToken: token } })
      .then(function (r) {
        if (!r.ok) return { httpStatus: r.status };
        return r.json().then(function (body) {
          return { httpStatus: r.status, body: body };
        }).catch(function () {
          return { httpStatus: r.status, invalidJson: true };
        });
      })
      .catch(function () { return { networkError: true }; });
  }

  function loadUserInfo() {
    if (userInfoInflight) return userInfoInflight;
    var request = loadUserInfoInternal();
    userInfoInflight = request.then(function (user) {
      userInfoInflight = null;
      return user;
    }, function (error) {
      userInfoInflight = null;
      throw error;
    });
    return userInfoInflight;
  }

  function loadUserInfoInternal() {
    var w = win();
    if (isLocalhost(w)) {
      var localToken = getToken();
      if (!localToken) {
        beginLocalBrowserLogin(true);
        return Promise.resolve(null);
      }
      return loadUserInfoFromToken(localToken, [SSO_USERINFO_URL]);
    }
    var token = getToken();
    if (!token) {
      // 仅受支持环境触发登录；未知域名保持静默。
      if (isPlatformHost(w)) beginLogin(true);
      return Promise.resolve(null);
    }

    return loadUserInfoFromToken(token);
  }

  function loadUserInfoFromToken(token, endpoints) {
    endpoints = endpoints || ['/api/v2/admin/me', SSO_USERINFO_URL];
    function attempt(index) {
      return tryUserInfo(endpoints[index], token).then(function (response) {
        var result = parseUserBody(response.body);
        if (result && result._tokenExpired || response.httpStatus === 401) {
          clearTokenAndRelogin();
          return null;
        }
        if (result) {
          clearLoginGuard();
          clearTokenReloginGuard();
          return result;
        }
        // 同源接口不可用时尝试跨域接口；最终失败不自动制造登录循环。
        if (index + 1 < endpoints.length && response.httpStatus !== 403) {
          return attempt(index + 1);
        }
        clearLoginGuard();
        return null;
      });
    }
    return attempt(0);
  }

  function clearTokenAndRelogin() {
    var w = win();
    var source = tokenSource;
    try { w.localStorage.removeItem(TOKEN_STORAGE_KEY); } catch (e) {}
    if (isLocalhost(w)) {
      if (tokenReloginAttempted()) {
        clearLoginGuard();
        return;
      }
      clearLoginGuard();
      if (beginLocalBrowserLogin(true)) markTokenReloginAttempted();
      return;
    }
    // Cookie 可能属于平台共享登录态，不直接删除；刷新让平台重新注入。
    if (source === 'cookie' || getCookieToken()) {
      beginLogin(false);
      return;
    }
    clearLoginGuard();
    // token 失效：强制跳转重新登录，绕过可能残留的防循环 guard
    beginLogin(true);
  }

  // ─────────────────────────────────────────────────────────────────────
  // 退出（渐进式清理）— 仅退出当前应用，不登出整个企业 SSO
  //   1. 清 localStorage（本地缓存 token）
  //   2. 清 sessionStorage guard
  //   3. 尝试本地后端退出（有本地后端时）
  //   4. 尝试 SDK removeToken（仅清当前应用 token，不调 ssoLogout）
  //   5. 兜底刷新页面
  // ─────────────────────────────────────────────────────────────────────

  function logout() {
    var w = win();
    userInfoInflight = null;
    try { w.localStorage.removeItem(TOKEN_STORAGE_KEY); } catch (e) {}
    clearLoginGuard();
    clearTokenReloginGuard();
    // 尝试本地后端退出
    var p = fetch('/api/dcu-sso/logout', { method: 'POST', credentials: 'same-origin' })
      .catch(function () {});
    // 只清当前应用的 token Cookie（removeToken），不调 ssoLogout（避免全平台登出）
    try {
      if (w.multisso && typeof w.multisso.removeToken === 'function') {
        w.multisso.removeToken();
      }
    } catch (e) {}
    return p.then(function () {
      if (w.location && w.location.reload) w.location.reload();
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // 工具函数
  // ─────────────────────────────────────────────────────────────────────

  function getDisplayName(user) {
    return user ? (user.realname || user.username || '') : '';
  }

  function getInitial(user) {
    var name = getDisplayName(user);
    return name ? name.charAt(0).toUpperCase() : '?';
  }

  return {
    getToken: getToken,
    beginLogin: beginLogin,
    beginLocalBrowserLogin: beginLocalBrowserLogin,
    loadUserInfo: loadUserInfo,
    getDisplayName: getDisplayName,
    getInitial: getInitial,
    logout: logout,
    isPlatformHost: isPlatformHost,
    isMiaodaHost: isMiaodaHost,
  };
});
