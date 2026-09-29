/**
 * DewuClaw SSO 用户菜单 — 原生 JS UI 封装
 *
 * 依赖：sso-core.js（引入 SSOCore）、user-menu.css
 *
 * 使用方式：
 *   1. HTML <head> 中依次引入：
 *      <link rel="stylesheet" href="./user-menu.css">
 *      <!-- SDK 仅限企业平台后缀加载，否则复用以下条件加载片段 -->
 *      <!-- <script> if (window.SSOCore && SSOCore.isPlatformHost()) { var s = document.createElement('script'); s.src = 'https://cdn-jumper.dewu.com/sdk-linker/sso.js'; document.head.appendChild(s); } </script> -->
 *      <script src="./sso-core.js"></script>
 *      <script src="./user-menu.js"></script>
 *   2. 页面加载后挂载：
 *      DCUUserMenu.mount('#dcu-mount');
 *
 * 使用 SSOCore 的统一探测认证流程。
 */

var DCUUserMenu = (function (SSOCore) {
  'use strict';

  var menuListeners = new WeakMap();

  // ── DOM 工具 ────────────────────────────────────────────────────────

  function el(tag, props, children) {
    var node = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      if (k === 'className') node.className = props[k];
      else if (k === 'text') node.textContent = props[k];
      else if (k === 'html') node.innerHTML = props[k];
      else node.setAttribute(k, props[k]);
    });
    if (children) [].concat(children).forEach(function (c) { c && node.appendChild(c); });
    return node;
  }

  function avatarEl(user, size) {
    var cls = size === 'lg' ? 'dcu-profile-avatar' : 'dcu-avatar';
    var fbCls = size === 'lg' ? 'dcu-profile-avatar-fallback' : 'dcu-avatar-fallback';

    if (user && user.avatar) {
      var img = el('img', { className: cls, src: user.avatar, alt: SSOCore.getDisplayName(user) });
      img.onerror = function () {
        var fb = el('span', { className: fbCls, text: SSOCore.getInitial(user) });
        img.parentNode && img.parentNode.replaceChild(fb, img);
      };
      return img;
    }
    return el('span', { className: fbCls, text: SSOCore.getInitial(user) });
  }

  // ── 构建下拉菜单 DOM ────────────────────────────────────────────────

  /**
   * 创建完整的用户菜单（触发按钮 + 下拉面板）
   * @param {Object|null} user - 用户信息对象
   * @param {Object} [opts]
   * @param {HTMLElement[]} [opts.extraItems] - 追加到退出前的受信任 DOM 节点
   * @returns {HTMLElement} .dcu-menu-wrap 容器
   */
  function createUserMenu(user, opts) {
    opts = opts || {};
    var displayName = SSOCore.getDisplayName(user);

    // ── 触发按钮 ──
    var triggerAvatar = avatarEl(user, 'sm');
    var triggerName = el('span', { className: 'dcu-trigger-name', text: displayName });
    var trigger = el('button', {
      className: 'dcu-trigger',
      'aria-haspopup': 'true',
      'aria-expanded': 'false',
      type: 'button',
    }, [triggerAvatar, triggerName]);

    // ── 下拉面板：用户信息卡片 ──
    var profileAvatar = avatarEl(user, 'lg');
    var profileName = el('div', { className: 'dcu-profile-name', text: SSOCore.getDisplayName(user) });
    var profileChildren = [profileName];

    if (user && user.username) {
      profileChildren.push(el('div', { className: 'dcu-profile-username', text: '@' + user.username }));
    }

    if (user && user.email) {
      profileChildren.push(el('div', { className: 'dcu-profile-email', text: user.email }));
    }

    var profileInfo = el('div', { className: 'dcu-profile-info' }, profileChildren);
    var profile = el('div', { className: 'dcu-profile' }, [profileAvatar, profileInfo]);

    // ── 下拉面板：菜单项 ──
    var menuItems = el('div', { className: 'dcu-menu-items' });

    var extraItemCount = 0;
    if (opts.extraItems && opts.extraItems.length) {
      opts.extraItems.forEach(function (item) {
        if (!item || item.nodeType !== 1) return;
        menuItems.appendChild(item);
        extraItemCount += 1;
      });
    }
    if (extraItemCount) {
      menuItems.appendChild(el('div', { className: 'dcu-menu-divider' }));
    }

    var logoutBtn = el('button', {
      className: 'dcu-menu-item dcu-danger',
      type: 'button',
      role: 'menuitem',
      text: '退出登录',
    });
    logoutBtn.addEventListener('click', function () { SSOCore.logout(); });
    menuItems.appendChild(logoutBtn);

    var dropdown = el('div', { className: 'dcu-dropdown', role: 'menu' }, [profile, menuItems]);
    var wrap = el('div', { className: 'dcu-menu-wrap' }, [trigger, dropdown]);

    // ── 开/关逻辑 ──
    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.contains('dcu-open');
      dropdown.classList.toggle('dcu-open', !isOpen);
      trigger.setAttribute('aria-expanded', String(!isOpen));
    });

    function handleDocumentClick(e) {
      if (!wrap.contains(e.target)) {
        dropdown.classList.remove('dcu-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    }

    function handleDocumentKeydown(e) {
      if (e.key === 'Escape') {
        dropdown.classList.remove('dcu-open');
        trigger.setAttribute('aria-expanded', 'false');
      }
    }

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('keydown', handleDocumentKeydown);
    menuListeners.set(wrap, {
      click: handleDocumentClick,
      keydown: handleDocumentKeydown,
    });

    return wrap;
  }

  // ── 挂载 ─────────────────────────────────────────────────────────────

  /**
   * 加载用户信息 → 创建菜单 → 挂载
   * @param {string|HTMLElement} target - CSS 选择器或 DOM 元素
   * @param {Object} [opts] - 同 createUserMenu 的 opts
   */
  function mount(target, opts) {
    opts = opts || {};
    var container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) {
      console.warn('[DCUUserMenu] mount: target not found:', target);
      return Promise.resolve();
    }

    var placeholder = el('span', { className: 'dcu-loading' }, [
      el('span', { className: 'dcu-loading-dot' }),
      el('span', { className: 'dcu-loading-dot' }),
      el('span', { className: 'dcu-loading-dot' }),
    ]);
    container.appendChild(placeholder);

    return SSOCore.loadUserInfo().then(function (user) {
      if (placeholder.parentNode) placeholder.parentNode.removeChild(placeholder);
      if (!user) return;
      var menu = createUserMenu(user, opts);
      container.appendChild(menu);
      return menu;
    });
  }

  /** 移除菜单关联的全局事件监听器 */
  function destroy(menu) {
    var listeners = menuListeners.get(menu);
    if (!listeners) return;
    document.removeEventListener('click', listeners.click);
    document.removeEventListener('keydown', listeners.keydown);
    menuListeners.delete(menu);
  }

  return {
    createUserMenu: createUserMenu,
    mount: mount,
    destroy: destroy,
  };
})(window.SSOCore);
