/* 移动端底部导航（杂志编辑风设计稿）
   只在 ≤768px 注入；4 项：首页 / 分类 / 交互 / 我的
   当前页高亮基于路径；不改动主题任何 JS 或 DOM
   用多次重试，避免被主题 Pjax/懒加载脚本清理掉 */
(function () {
  if (window.innerWidth > 768) return;

  var path = location.pathname;
  var items = [
    { label: '首页', href: '/', icon: 'M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z', match: function (p) { return p === '/' || /^\/index\.html$/.test(p) || /\/\d{4}\/\d{2}\/\d{2}\//.test(p); } },
    { label: '分类', href: '/categories/', icon: 'M4 5h7v7H4zM13 5h7v7h-7zM4 14h7v5H4zM13 14h7v5h-7z', match: function (p) { return /categories|tags|archives/.test(p); } },
    { label: '交互', href: '/interactive/', icon: 'M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z', match: function (p) { return /interactive|deep-sky|christmas-tree/.test(p); } },
    { label: '我的', href: '/about/', icon: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c0-4 3.6-6 8-6s8 2 8 6', match: function (p) { return /about|link|music|album/.test(p); } }
  ];

  function build() {
    if (document.querySelector('.ed-mobile-nav')) return true;
    if (!document.body) return false;
    var nav = document.createElement('nav');
    nav.className = 'ed-mobile-nav';
    items.forEach(function (it) {
      var a = document.createElement('a');
      a.href = it.href;
      if (it.match(path)) a.className = 'on';
      a.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="' + it.icon + '"/></svg><span>' + it.label + '</span>';
      nav.appendChild(a);
    });
    document.body.appendChild(nav);
    return true;
  }

  // 立即 + DOMContentLoaded + 多次延时重试（主题脚本可能重写 body）
  build();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build);
  [100, 400, 1000, 2000].forEach(function (t) { setTimeout(build, t); });
})();
