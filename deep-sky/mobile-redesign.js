/* ============================================================
   交互页移动端 UI 重设计 · JS 结构桥接
   作用：把现有 DOM 元素在运行时重排成设计稿结构
   原则：不删除、不重写任何原有控件与交互函数，只做「包裹 / 移动 / 补标题」
   ============================================================ */
(function () {
  'use strict';

  function isMobile() {
    return window.matchMedia('(max-width: 760px)').matches ||
      (window.matchMedia('(hover: none) and (pointer: coarse)').matches);
  }
  if (!isMobile()) return;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  function init() {
    var sidebar = $('#left-sidebar');
    if (!sidebar || sidebar.dataset.redesigned === '1') return;

    /* ---------- 1. 顶部标题区：拖动条 + 英文副标题 + 场景定制 + 关闭 ---------- */
    var header = document.createElement('div');
    header.id = 'set-header';
    header.innerHTML =
      '<div class="grab"></div>' +
      '<div class="ph"><div class="ttl"><small>SCENE CUSTOMIZATION</small>场景定制</div>' +
      '<button class="x" type="button" aria-label="关闭设置">✕</button></div>';
    sidebar.insertBefore(header, sidebar.firstChild);
    $('.x', header).addEventListener('click', function (e) {
      e.stopPropagation();
      if (typeof window.__sheet === 'function') window.__sheet(false);
      else if (typeof window.toggleUI === 'function') window.toggleUI();
    });

    /* ---------- 2. 找到两个面板 ---------- */
    var panels = $$(':scope > .top-left-panel, :scope > .glass-panel', sidebar)
      .filter(function (p) { return p !== header; });
    var panelSetting = panels.find(function (p) { return /场景定制/.test(p.textContent); });
    var panelControl = panels.find(function (p) { return /交互中控/.test(p.textContent); });

    /* ---------- 3. 场景定制面板：重排成设计稿分区 ---------- */
    if (panelSetting) {
      // 移除原来的主标题（顶部已由 header 接管）
      var oldMain = $('.ui-title-main', panelSetting);
      if (oldMain) oldMain.style.display = 'none';

      // 分区顺序：祝福语录 → 字体风格 → 粒子控制 → 背景音乐
      // 用 flex order 不改变 DOM（保住全部 onclick 绑定）
      panelSetting.style.display = 'flex';
      panelSetting.style.flexDirection = 'column';

      // 定位各控件
      var subTitles = $$('.ui-title-sub', panelSetting);
      var byText = function (t) {
        return subTitles.find(function (s) { return s.textContent.trim().indexOf(t) >= 0; });
      };
      var fontLabel = byText('字体风格');
      var scrollBox = $('.particle-scroll-container', panelSetting);

      // 字体风格：把 <select> 换成胶囊组（select 隐藏但保留，值同步）
      var fontSelect = $('#font-select');
      if (fontLabel && fontSelect && !$('#font-pills')) {
        var pills = document.createElement('div');
        pills.id = 'font-pills';
        pills.className = 'rd-pills';
        $$('option', fontSelect).forEach(function (opt) {
          var pill = document.createElement('button');
          pill.type = 'button';
          pill.className = 'rd-pill' + (opt.selected ? ' on' : '');
          pill.textContent = opt.textContent;
          pill.addEventListener('click', function (e) {
            e.stopPropagation();
            fontSelect.value = opt.value;
            $$('.rd-pill', pills).forEach(function (p) { p.classList.remove('on'); });
            pill.classList.add('on');
            if (typeof window.updateTextConfig === 'function') window.updateTextConfig();
            else fontSelect.dispatchEvent(new Event('change', { bubbles: true }));
          });
          pills.appendChild(pill);
        });
        fontSelect.style.display = 'none';
        fontSelect.parentNode.insertBefore(pills, fontSelect.nextSibling);
      }

      // 粒子滑杆：给每个 control-row 补数值显示（保留原 input 的 oninput）
      if (scrollBox) {
        $$('.control-row', scrollBox).forEach(function (row) {
          var slider = $('input[type=range]', row);
          var label = $('.control-label', row);
          if (!slider || !label || $('.rd-val', row)) return;
          var val = document.createElement('span');
          val.className = 'rd-val';
          val.textContent = slider.value;
          slider.parentNode.insertBefore(val, slider.nextSibling);
          var sync = function () { val.textContent = slider.value; };
          slider.addEventListener('input', sync);
          slider.addEventListener('change', sync);
        });
      }

      // 祝福语录的两个 input 是独立行，标记为 stack 避免被压扁
      $$('.control-row', panelSetting).forEach(function (row) {
        var slider = $('input[type=range]', row);
        var label = $('.control-label', row);
        // 只给「label + range」结构加 rd-val；其余标记 stack
        if (!slider || !label) row.classList.add('rd-stack');
        else if (label.textContent.trim().length > 5) label.classList.add('long-label');
      });

      // 交互中控里的「旋转速度 (散开)」标签较长
      if (panelControl) {
        $$('.control-label', panelControl).forEach(function (label) {
          if (label.textContent.trim().length > 5) label.classList.add('long-label');
        });
      }
    }

    /* ---------- 4. 交互中控面板：形态切换改为 3 大按钮 ---------- */
    if (panelControl) {
      var oldMain2 = $('.ui-title-main', panelControl);
      if (oldMain2) oldMain2.style.display = 'none';

      var grid = $('.interaction-grid', panelControl);
      var grabBtn = $$('button.elegant-btn', panelControl).find(function (b) {
        return /抓取照片/.test(b.textContent);
      });
      if (grid && grabBtn && !$('#rd-grab-btn')) {
        // 给已有两个按钮加图标
        var icons = ['✊', '✋'];
        $$('button', grid).forEach(function (b, i) {
          if ($('.ic', b)) return;
          var ic = document.createElement('span');
          ic.className = 'ic';
          ic.textContent = icons[i] || '✨';
          b.insertBefore(ic, b.firstChild);
        });
        // 新建第三个「抓图」大按钮，调用原有全局函数（不复制内联 onclick，避免重复触发）
        var grab = document.createElement('button');
        grab.type = 'button';
        grab.id = 'rd-grab-btn';
        grab.className = 'elegant-btn';
        grab.innerHTML = '<span class="ic">🤏</span>抓图';
        grab.addEventListener('click', function () {
          if (typeof window.triggerPhotoGrab === 'function') window.triggerPhotoGrab();
        });
        grid.appendChild(grab);
        grabBtn.style.display = 'none';
      }
    }

    /* ---------- 5. 资源管理面板：补英文副标题 ---------- */
    var bottom = $('.bottom-left-panel');
    if (bottom) {
      var mgrMain = $('.ui-title-main', bottom);
      if (mgrMain && !$('small', mgrMain)) {
        var small = document.createElement('small');
        small.textContent = 'RESOURCE MANAGER';
        small.style.cssText = 'display:block;font-size:9px;letter-spacing:.22em;color:var(--accent-gold);margin-bottom:5px;font-weight:500;';
        mgrMain.insertBefore(small, mgrMain.firstChild);
      }
    }

    /* ---------- 6. 照片管理：补计数副标题（不干扰 JS 插入的照片网格） ---------- */
    var mgrTitle = $('.manager-title');
    if (mgrTitle && !$('#photo-count')) {
      var count = document.createElement('div');
      count.id = 'photo-count';
      count.style.cssText = 'font-size:11px;color:#8fa6d8;font-weight:400;letter-spacing:.05em;margin-top:8px;';
      count.textContent = '点击照片可聚焦 · 长按可删除';
      mgrTitle.appendChild(count);
    }

    sidebar.dataset.redesigned = '1';
  }

  // DOM 就绪后执行；若 UI 由异步 init 生成，用轮询兜底
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 80); });
  } else {
    setTimeout(init, 80);
  }
  var tryCount = 0;
  var timer = setInterval(function () {
    tryCount++;
    var sidebar = $('#left-sidebar');
    if ((sidebar && sidebar.dataset.redesigned === '1') || tryCount > 40) {
      clearInterval(timer);
      return;
    }
    init();
  }, 250);
})();
