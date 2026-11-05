/**
 * 音乐胶囊
 * 结构与交互对齐参考站 blog.anheyu.com 的 MusicPlayer 组件：
 *   上一首 / 播放暂停 / 下一首 / 音量（竖向滑块弹窗）/ 播放列表（抽屉）
 * 音频能力仍由 meting-js（APlayer）提供，原生播放器 DOM 被 CSS 隐藏，
 * 这里只做状态同步与交互转发。
 */
(function () {
  "use strict";

  var root = document.getElementById("nav-music");
  if (!root) return;

  var capsule = root.querySelector(".musicCapsuleContainer");
  if (!capsule) return;

  var cover = capsule.querySelector(".albumCover");
  var collapsedInfo = capsule.querySelector(".collapsedInfo");
  var collapsedTitle = capsule.querySelector(".collapsedTitle");
  var songTitle = capsule.querySelector(".songTitle");
  var songInfo = capsule.querySelector(".songInfo");
  var lyricsContainer = capsule.querySelector(".lyricsContainer");
  var lyricsContent = capsule.querySelector(".lyricsContent");
  var progressBar = capsule.querySelector(".progressOverlay");
  var controls = capsule.querySelector(".musicControls");
  var volumeBtn = capsule.querySelector(".controlVolume");
  var volumePopup = document.getElementById("vmVolumePopup");
  var volumeRange = document.getElementById("vmVolumeRange");
  var volumeFill = document.getElementById("vmVolumeFill");
  var playlist = document.getElementById("vmPlaylist");
  var playlistContent = document.getElementById("vmPlaylistContent");
  var playlistClose = document.getElementById("vmPlaylistClose");
  var playlistTitle = playlist && playlist.querySelector(".playlistTitle");

  var DEFAULT_COLOR = "rgba(57,57,57,1)";
  var ap = null;
  var lyricLines = [];
  var currentLine = -1;
  var lastTrack = "";
  var hoverTimer = null;
  var lastVolume = 0.7;

  /* ---------------- 工具 ---------------- */

  function safe(fn) {
    try {
      return fn();
    } catch (e) {
      return undefined;
    }
  }

  function setDominantColor(url) {
    var set = function (color) {
      capsule.style.setProperty("--dominant-color", color);
      // 播放列表抽屉是胶囊的兄弟节点，变量要挂到 #nav-music 上才能继承
      root.style.setProperty("--dominant-color", color);
    };
    if (!url) {
      set(DEFAULT_COLOR);
      return;
    }
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      var color = safe(function () {
        var canvas = document.createElement("canvas");
        canvas.width = canvas.height = 8;
        var ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, 8, 8);
        var data = ctx.getImageData(0, 0, 8, 8).data;
        var r = 0, g = 0, b = 0, n = 0;
        for (var i = 0; i < data.length; i += 4) {
          r += data[i];
          g += data[i + 1];
          b += data[i + 2];
          n++;
        }
        if (!n) return null;
        // 整体压暗，保证白色文字始终可读
        var k = 0.62;
        return (
          "rgba(" +
          Math.round((r / n) * k) + "," +
          Math.round((g / n) * k) + "," +
          Math.round((b / n) * k) +
          ",1)"
        );
      });
      capsule.style.setProperty("--dominant-color", color || DEFAULT_COLOR);
      root.style.setProperty("--dominant-color", color || DEFAULT_COLOR);
    };
    img.onerror = function () {
      set(DEFAULT_COLOR);
    };
    img.src = url;
  }

  /* ---------------- 展开 / 收起 ---------------- */

  function setExpanded(flag) {
    capsule.classList.toggle("expanded", !!flag);
    songInfo.classList.toggle("visible", !!flag);
    if (collapsedInfo) collapsedInfo.classList.toggle("hidden", !!flag);
    if (!flag) {
      controls.classList.remove("visible");
      closeVolume();
      closePlaylist();
    }
  }

  /* ---------------- 歌词 ---------------- */

  function renderLyrics() {
    lyricLines = [];
    currentLine = -1;
    lyricsContent.innerHTML = "";
    lyricsContent.style.transform = "translateY(0)";

    var parsed = getLyricPairs();
    if (!parsed.length) {
      var empty = document.createElement("div");
      empty.className = "lyricLine upcoming";
      var t = document.createElement("div");
      t.className = "lyricText";
      t.textContent = "纯音乐，请欣赏";
      empty.appendChild(t);
      lyricsContent.appendChild(empty);
      return;
    }

    var frag = document.createDocumentFragment();
    for (var i = 0; i < parsed.length; i++) {
      var item = parsed[i];
      var text = String(item[1] || "").trim();
      var row = document.createElement("div");
      row.className = "lyricLine upcoming";
      var span = document.createElement("div");
      span.className = "lyricText";
      span.textContent = text || "…";
      row.appendChild(span);
      frag.appendChild(row);
      lyricLines.push({ time: Number(item[0]) || 0, el: row, textEl: span });
    }
    lyricsContent.appendChild(frag);
    markScrolling();
  }

  // 参考站对超出容器宽度的歌词做横向往返滚动
  function markScrolling() {
    var w = lyricsContainer ? lyricsContainer.clientWidth : 0;
    if (!w) return;
    for (var i = 0; i < lyricLines.length; i++) {
      var el = lyricLines[i].textEl;
      if (!el) continue;
      el.classList.remove("textScrolling");
      el.style.removeProperty("--scroll-duration");
      var tw = el.scrollWidth;
      if (tw > w + 4) {
        var dur = Math.max(4, Math.round((tw - w) / 18) + 4);
        el.style.setProperty("--scroll-duration", dur + "s");
        el.classList.add("textScrolling");
      }
    }
  }

  function getLyricPairs() {
    var lrc = safe(function () {
      return ap && ap.lrc;
    });
    if (!lrc) return [];

    var sources = [lrc.current, lrc.parsed];
    for (var s = 0; s < sources.length; s++) {
      var src = sources[s];
      if (!src || !src.length) continue;

      if (Array.isArray(src[0]) && src[0].length === 2 && !Array.isArray(src[0][0])) {
        return normalizePairs(src);
      }

      var list = [];
      for (var i = 0; i < src.length; i++) {
        var it = src[i];
        if (!it) continue;
        if (Array.isArray(it)) {
          if (Array.isArray(it[0])) list = list.concat(it);
          else if (it.length === 2) list.push(it);
        } else if (typeof it === "object" && it.content !== undefined) {
          list.push([it.time, it.content]);
        }
      }
      var out = normalizePairs(list);
      if (out.length) return out;
    }
    return [];
  }

  function normalizePairs(list) {
    var out = [];
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) continue;
      var t = Number(list[i][0]);
      var c = list[i][1];
      if (!isFinite(t) || c === undefined || c === null) continue;
      if (!String(c).trim()) continue;
      out.push([t, String(c)]);
    }
    out.sort(function (a, b) {
      return a[0] - b[0];
    });
    return out;
  }

  function syncLyrics() {
    if (!ap || !ap.audio || !lyricLines.length) return;
    var t = ap.audio.currentTime || 0;
    var idx = -1;
    for (var i = 0; i < lyricLines.length; i++) {
      if (lyricLines[i].time <= t + 0.15) idx = i;
      else break;
    }
    if (idx === currentLine) return;
    currentLine = idx;
    for (var j = 0; j < lyricLines.length; j++) {
      lyricLines[j].el.className =
        "lyricLine " + (j < idx ? "passed" : j === idx ? "current" : "upcoming");
    }
    // 当前行固定在顶部，下一行自然出现在下方
    lyricsContent.style.transform =
      "translateY(" + (idx > 0 ? -idx * 20 : 0) + "px)";
  }

  function syncProgress() {
    if (!ap || !ap.audio) return;
    var d = ap.audio.duration;
    var c = ap.audio.currentTime;
    if (!d || !isFinite(d)) {
      progressBar.style.width = "0%";
      return;
    }
    progressBar.style.width = ((c / d) * 100).toFixed(2) + "%";
  }

  function syncTrack() {
    if (!ap || !ap.list) return;
    var audio = ap.list.audios[ap.list.index];
    if (!audio) return;

    var name = audio.name || "音乐胶囊";
    var key = name + "|" + (audio.url || "");
    if (collapsedTitle) collapsedTitle.textContent = name;
    if (songTitle) songTitle.textContent = name;
    if (cover && audio.pic) cover.style.backgroundImage = "url(" + audio.pic + ")";

    if (key !== lastTrack) {
      lastTrack = key;
      setDominantColor(audio.pic);
      renderLyrics();
      markActivePlaylistItem();
    }
  }

  function syncPlaying(playing) {
    capsule.classList.toggle("playing", !!playing);
    if (cover) cover.classList.toggle("playing", !!playing);
    setExpanded(!!playing);
    if (playing) {
      var retry = 0;
      (function tick() {
        if (!lyricLines.length) renderLyrics();
        if (lyricLines.length || ++retry > 10) {
          markScrolling();
          return;
        }
        setTimeout(tick, 700);
      })();
    }
  }

  /* ---------------- 音量弹窗 ---------------- */

  function openVolume() {
    if (!volumePopup || !volumeBtn) return;
    closePlaylist();
    var r = volumeBtn.getBoundingClientRect();
    volumePopup.style.left = r.left + r.width / 2 + "px";
    volumePopup.style.bottom = window.innerHeight - r.top + 10 + "px";
    volumePopup.classList.add("open");
    syncVolumeUI();
  }

  function closeVolume() {
    if (volumePopup) volumePopup.classList.remove("open");
  }

  function toggleVolume() {
    if (!volumePopup) return;
    if (volumePopup.classList.contains("open")) closeVolume();
    else openVolume();
  }

  function syncVolumeUI() {
    if (!ap || !volumeRange) return;
    var v = safe(function () {
      return ap.volume();
    });
    if (typeof v !== "number") v = lastVolume;
    var pct = Math.round(v * 100);
    volumeRange.value = String(pct);
    if (volumeFill) volumeFill.style.height = pct + "%";
    if (volumeBtn) volumeBtn.classList.toggle("is-muted", pct === 0);
  }

  function applyVolume(pct) {
    var v = Math.max(0, Math.min(100, Number(pct) || 0)) / 100;
    if (v > 0) lastVolume = v;
    if (ap) ap.volume(v);
    if (volumeFill) volumeFill.style.height = Math.round(v * 100) + "%";
    if (volumeBtn) volumeBtn.classList.toggle("is-muted", v === 0);
  }

  /* ---------------- 播放列表抽屉 ---------------- */

  function buildPlaylist() {
    if (!playlistContent) return;
    var audios = safe(function () {
      return ap.list.audios;
    });
    if (!audios || !audios.length) {
      playlistContent.innerHTML = '<div class="playlistItem"><div class="itemContent"><span class="itemTitle">歌单加载中…</span></div></div>';
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < audios.length; i++) {
      var a = audios[i] || {};
      var item = document.createElement("div");
      item.className = "playlistItem";
      item.setAttribute("data-index", String(i));

      var idx = document.createElement("span");
      idx.className = "itemIndex";
      idx.textContent = String(i + 1);

      var indicator = document.createElement("div");
      indicator.className = "playIndicator";
      var bars = document.createElement("div");
      bars.className = "playBars";
      for (var b = 0; b < 4; b++) {
        var bar = document.createElement("div");
        bar.className = "playBar";
        bars.appendChild(bar);
      }
      indicator.appendChild(bars);

      var content = document.createElement("div");
      content.className = "itemContent";
      var title = document.createElement("span");
      title.className = "itemTitle";
      title.textContent = a.name || "未知曲目";
      var artist = document.createElement("span");
      artist.className = "itemArtist";
      artist.textContent = a.artist || "";
      content.appendChild(title);
      if (a.artist) content.appendChild(artist);

      item.appendChild(idx);
      item.appendChild(indicator);
      item.appendChild(content);
      frag.appendChild(item);
    }
    playlistContent.innerHTML = "";
    playlistContent.appendChild(frag);
    if (playlistTitle) playlistTitle.textContent = "播放列表 (" + audios.length + ")";
    markActivePlaylistItem();
  }

  function markActivePlaylistItem() {
    if (!playlistContent || !ap || !ap.list) return;
    var items = playlistContent.querySelectorAll(".playlistItem");
    var cur = ap.list.index;
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle("active", Number(items[i].getAttribute("data-index")) === cur);
    }
  }

  function openPlaylist() {
    if (!playlist) return;
    closeVolume();
    buildPlaylist();
    playlist.classList.add("open");
  }

  function closePlaylist() {
    if (playlist) playlist.classList.remove("open");
  }

  function togglePlaylist() {
    if (!playlist) return;
    if (playlist.classList.contains("open")) closePlaylist();
    else openPlaylist();
  }

  /* ---------------- 交互绑定 ---------------- */

  capsule.addEventListener("click", function (e) {
    if (e.target.closest(".controlBtn")) return;
    if (!ap) {
      if (window.anzhiyu && anzhiyu.musicToggle) anzhiyu.musicToggle();
      return;
    }
    ap.toggle();
  });

  capsule.addEventListener("mouseenter", function () {
    if (!capsule.classList.contains("expanded")) return;
    clearTimeout(hoverTimer);
    controls.classList.add("visible");
  });

  capsule.addEventListener("mouseleave", function () {
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(function () {
      controls.classList.remove("visible");
      closeVolume();
    }, 260);
  });

  // 音量弹窗内操作时不要触发离开收起
  if (volumePopup) {
    volumePopup.addEventListener("mouseenter", function () {
      clearTimeout(hoverTimer);
    });
    volumePopup.addEventListener("mouseleave", function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(function () {
        if (!controls.matches(":hover")) closeVolume();
      }, 260);
    });
  }

  if (volumeRange) {
    volumeRange.addEventListener("input", function () {
      applyVolume(this.value);
    });
    volumeRange.addEventListener("change", function () {
      applyVolume(this.value);
    });
  }

  controls.addEventListener("click", function (e) {
    var btn = e.target.closest(".controlBtn");
    if (!btn || !ap) return;
    e.stopPropagation();

    if (btn.classList.contains("controlPrev")) ap.skipBack();
    else if (btn.classList.contains("controlNext")) ap.skipForward();
    else if (btn.classList.contains("playPauseBtn")) ap.toggle();
    else if (btn.classList.contains("controlVolume")) toggleVolume();
    else if (btn.classList.contains("controlPlaylist")) togglePlaylist();
  });

  if (playlistContent) {
    playlistContent.addEventListener("click", function (e) {
      var item = e.target.closest(".playlistItem");
      if (!item || !ap) return;
      var i = Number(item.getAttribute("data-index"));
      if (!isFinite(i)) return;
      ap.list.switch(i);
      ap.play();
      markActivePlaylistItem();
      closePlaylist();
    });
  }

  if (playlistClose) {
    playlistClose.addEventListener("click", function (e) {
      e.stopPropagation();
      closePlaylist();
    });
  }

  // 点击空白处收起弹层
  document.addEventListener("click", function (e) {
    if (!root.contains(e.target)) {
      closeVolume();
      closePlaylist();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeVolume();
      closePlaylist();
    }
  });

  /* ---------------- 启动 ---------------- */

  function bind() {
    ap = getPlayer();
    if (!ap) return false;

    ap.on("play", function () {
      syncPlaying(true);
    });
    ap.on("pause", function () {
      syncPlaying(false);
    });
    ap.on("listswitch", function () {
      syncTrack();
      syncLyrics();
      syncProgress();
      markActivePlaylistItem();
    });
    ap.on("loadeddata", function () {
      renderLyrics();
      markScrolling();
    });

    if (ap.audio) {
      ap.audio.addEventListener("timeupdate", function () {
        if (!lyricLines.length) renderLyrics();
        syncLyrics();
        syncProgress();
      });
      ap.audio.addEventListener("volumechange", function () {
        syncVolumeUI();
      });
    }

    syncTrack();
    syncPlaying(!(ap.audio && ap.audio.paused));
    syncProgress();
    syncVolumeUI();
    return true;
  }

  function getPlayer() {
    var meting = root.querySelector("meting-js");
    return meting && meting.aplayer ? meting.aplayer : null;
  }

  var tries = 0;
  (function wait() {
    if (bind()) return;
    if (++tries > 100) return; // 最多等约 30s
    setTimeout(wait, 300);
  })();
})();
