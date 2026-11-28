/* 移动端底部导航（杂志编辑风设计稿）
   只在 ≤768px 注入；4 项：首页 / 分类 / 交互 / 我的
   当前页高亮基于路径；不改动主题任何 JS 或 DOM
   用多次重试，避免被主题 Pjax/懒加载脚本清理掉 */
(function () {
  // 不要在脚本加载时一次性判断就退出：窗口缩放 / Pjax 切页后需要动态同步
  var items = [
    { label: '首页', href: '/', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', match: function (p) { return p === '/' || /^\/index\.html$/.test(p) || /\/\d{4}\/\d{2}\/\d{2}\//.test(p); } },
    { label: '分类', href: '/categories/', icon: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z', match: function (p) { return /categories|tags|archives/.test(p); } },
    { label: '交互', href: '/interactive/', icon: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z', match: function (p) { return /interactive|deep-sky|christmas-tree/.test(p); } },
    { label: '我的', href: '/about/', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 3.6-6 8-6s8 2 8 6', match: function (p) { return /about|link|music|album/.test(p); } }
  ];

  // 高亮必须每次都按「当前」路径重算，不能只在 build 时算一次
  // （主题 Pjax 切页后 URL 变了，但脚本不会重新执行）
  function updateActive() {
    var nav = document.querySelector('.ed-mobile-nav');
    if (!nav) return;
    var path = location.pathname;
    var links = nav.querySelectorAll('a');
    for (var i = 0; i < links.length; i++) {
      var it = items[i];
      if (it && it.match(path)) links[i].classList.add('on');
      else links[i].classList.remove('on');
    }
  }

  function build() {
    if (document.querySelector('.ed-mobile-nav')) { updateActive(); return true; }
    if (!document.body) return false;
    var nav = document.createElement('nav');
    nav.className = 'ed-mobile-nav';
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = it.href;
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + it.icon + '"/></svg><span>' + it.label + '</span>';
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    updateActive();
    return true;
  }

  function remove() {
    var nav = document.querySelector('.ed-mobile-nav');
    if (nav) nav.remove();
    document.body.classList.remove('has-ed-mobile-nav');
  }

  // 沉浸式页面：不注入底部导航（播放器按钮会被导航遮挡）
  // 音乐馆是主题全屏 Aplayer，底部有自己的播放控制条，导航多余
  function isExcluded() {
    var p = location.pathname;
    if (/\/music\/?$/.test(p)) return true;                    // 音乐馆路径
    if (document.body && document.body.getAttribute('data-type') === 'music') return true; // 主题标记
    return false;
  }

  // 根据当前宽度同步：窄屏注入，宽屏移除（解决窗口放大后导航残留的问题）
  function sync() {
    if (window.innerWidth <= 768 && !isExcluded()) {
      document.body.classList.add('has-ed-mobile-nav');
      build();
    } else {
      remove();
    }
  }

  // 立即 + DOMContentLoaded + 多次延时重试（主题脚本可能重写 body）
  sync();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync);
  [100, 400, 1000, 2000].forEach(function (t) { setTimeout(sync, t); });

  // 窗口尺寸变化时同步（PC 放大/缩小、浏览器缩放）
  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(sync, 120);
  });

  // Pjax 切页后重新同步（主题用 pjax:complete，也兼容 pjax:success / 通用事件）
  function onPjax() { setTimeout(sync, 80); }
  ['pjax:complete', 'pjax:success', 'page:loaded'].forEach(function (evt) {
    document.addEventListener(evt, onPjax);
  });
  // 兜底：监听 popstate（浏览器前进后退）
  window.addEventListener('popstate', onPjax);
})();
