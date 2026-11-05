/* ==========================================================================
   黑胶唱片音乐馆 · 播放器
   交互与参考站 https://blog.anheyu.com/music 对齐：
   - 封面主色驱动背景（背景图 + 光晕 + 遮罩变量 + 封面描边）
   - 歌词逐行高亮并居中滚动
   - 顺序 / 单曲 / 随机三种循环
   - 竖向音量滑块
   - 右侧播放列表抽屉
   ========================================================================== */
(function () {
  "use strict";

  var root = document.getElementById("vinyl-music");
  if (!root) return;

  /* 歌单接口：多节点按顺序尝试，任一可用即停止。
     公共 Meting 服务经常限流，单节点很容易整页空白。 */
  var API_LIST = [
    "https://api.qijieya.cn/meting/",
    "https://api.injahow.cn/meting/"
  ];
  var PLAYLIST_ID = "8152976493";
  var SERVER = "netease";

  function $(id) {
    return document.getElementById(id);
  }

  var audio = $("vmAudio");
  var bg = $("vmBg");
  var aura = $("vmAura");
  var overlay = $("vmOverlay");
  var artworkBtn = $("vmArtworkBtn");
  var needle = $("vmNeedle");
  var rotate = $("vmRotate");
  var cover = $("vmCover");
  var coverBlur = $("vmCoverBlur");
  var titleEl = $("vmTitle");
  var lyricsBox = $("vmLyrics");
  var lyricsInner = $("vmLyricsInner");
  var curEl = $("vmCur");
  var durEl = $("vmDur");
  var progress = $("vmProgress");
  var fill = $("vmFill");
  var bufferEl = $("vmBuffer");
  var thumb = $("vmThumb");
  var playBtn = $("vmPlay");
  var prevBtn = $("vmPrev");
  var nextBtn = $("vmNext");
  var loopBtn = $("vmLoop");
  var refreshBtn = $("vmRefresh");
  var volumeBtn = $("vmVolumeBtn");
  var volumeBox = $("vmVolume");
  var volumeRange = $("vmVolumeRange");
  var listBtn = $("vmListBtn");
  var mount = $("vmPlaylistMount");
  var playlistClose = $("vmPlaylistClose");
  var listBody = $("vmListBody");
  var countEl = $("vmCount");
  var backdrop = $("vmPlaylistBackdrop");

  var songs = [];
  var currentIndex = -1;
  var lyricLines = [];
  var currentLyricIndex = -1;
  var loopMode = 0; // 0 顺序 1 单曲 2 随机
  var isDragging = false;
  var lrcCache = {};
  var colorCache = {};

  /* ---------- 图标（lucide，与参考站同一套） ---------- */
  var SVG_HEAD =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" ' +
    'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">';

  var ICON = {
    play: SVG_HEAD + '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>',
    pause: SVG_HEAD + '<rect x="6" y="4" width="4" height="16" rx="2"/><rect x="14" y="4" width="4" height="16" rx="2"/></svg>',
    volume2: SVG_HEAD + '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>',
    volumeX: SVG_HEAD + '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>',
    order: SVG_HEAD + '<path d="M11 5h10"/><path d="M11 12h10"/><path d="M11 19h10"/><path d="M4 4h1v5"/><path d="M4 9h2"/><path d="M6.5 20H3.4c0-1 2.6-1.925 2.6-3.5a1.5 1.5 0 0 0-2.6-1.02"/></svg>',
    single: SVG_HEAD + '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/><path d="M11 10h1v4"/></svg>',
    shuffle: SVG_HEAD + '<path d="m18 14 4 4-4 4"/><path d="m18 2 4 4-4 4"/><path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22"/><path d="M2 6h1.972a4 4 0 0 1 3.6 2.2"/><path d="M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45"/></svg>'
  };

  var LOOP_TITLES = ["顺序播放", "单曲循环", "随机播放"];
  var LOOP_ICONS = [ICON.order, ICON.single, ICON.shuffle];

  /* ---------- 工具 ---------- */
  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    var m = Math.floor(sec / 60);
    var s = Math.floor(sec % 60);
    return m + ":" + (s < 10 ? "0" + s : s);
  }

  function parseLrc(text) {
    var out = [];
    if (!text) return out;
    var lines = text.split(/\r?\n/);
    var re = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      var times = [];
      var m;
      re.lastIndex = 0;
      while ((m = re.exec(line)) !== null) {
        var min = parseInt(m[1], 10);
        var sec = parseInt(m[2], 10);
        var ms = m[3] ? parseInt((m[3] + "00").slice(0, 3), 10) : 0;
        times.push(min * 60 + sec + ms / 1000);
      }
      var content = line.replace(re, "").trim();
      if (!content) continue;
      for (var j = 0; j < times.length; j++) {
        out.push({ time: times[j], text: content });
      }
    }
    out.sort(function (a, b) {
      return a.time - b.time;
    });
    return out;
  }

  /* ---------- 封面主色 ----------
     参考站把主色写进背景色、光晕渐变、遮罩变量和封面描边，
     这里同样从封面图取平均色（跨域取不到就退回中性灰）。 */
  function applyColor(rgb) {
    var r = rgb[0], g = rgb[1], b = rgb[2];
    var solid = "rgb(" + r + "," + g + "," + b + ")";
    var rgba = function (a) {
      return "rgba(" + r + "," + g + "," + b + "," + a + ")";
    };

    bg.style.backgroundColor = solid;
    overlay.style.setProperty("--music-overlay-soft", rgba(0.48));
    overlay.style.setProperty("--music-overlay-accent", rgba(0.72));
    overlay.style.setProperty("--music-overlay-shadow", "rgba(0,0,0,0.46)");

    aura.style.backgroundImage =
      "radial-gradient(circle at 20% 18%, " + rgba(0.72) + " 0%, rgba(0,0,0,0) 50%)," +
      "radial-gradient(circle at 82% 80%, " + rgba(0.48) + " 0%, rgba(0,0,0,0) 56%)," +
      "linear-gradient(145deg, " + rgba(0.44) + " 0%, rgba(0,0,0,0) 62%)," +
      "linear-gradient(325deg, " + rgba(0.28) + " 6%, rgba(0,0,0,0) 65%)";

    cover.style.borderColor = rgba(0.7);
    lyricsBox.style.setProperty("--dominant-color", "rgba(" + r + "," + g + "," + b + ",1)");
  }

  function extractColor(url, cb) {
    if (!url) {
      cb(null);
      return;
    }
    if (colorCache[url]) {
      cb(colorCache[url]);
      return;
    }
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      var rgb = null;
      try {
        var c = document.createElement("canvas");
        c.width = 32;
        c.height = 32;
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, 32, 32);
        var d = ctx.getImageData(0, 0, 32, 32).data;
        /* 参考站取的是「出现最多的颜色」而不是平均值：
           平均值会把暗部拉亮，背景氛围就不对了。这里按 32 级量化后取众数桶。 */
        var hist = {};
        var best = null;
        for (var i = 0; i < d.length; i += 4) {
          var key = (d[i] >> 5) + "," + (d[i + 1] >> 5) + "," + (d[i + 2] >> 5);
          var h = hist[key];
          if (!h) {
            h = hist[key] = { n: 0, r: 0, g: 0, b: 0 };
          }
          h.n++;
          h.r += d[i];
          h.g += d[i + 1];
          h.b += d[i + 2];
          if (!best || h.n > best.n) best = h;
        }
        if (best && best.n) {
          rgb = [Math.round(best.r / best.n), Math.round(best.g / best.n), Math.round(best.b / best.n)];
          colorCache[url] = rgb;
        }
      } catch (e) {
        rgb = null;
      }
      cb(rgb);
    };
    img.onerror = function () {
      cb(null);
    };
    img.src = url;
  }

  function setBackground(url) {
    if (!url) return;
    bg.style.backgroundImage = 'url("' + url + '")';
    extractColor(url, function (rgb) {
      applyColor(rgb || [32, 32, 32]);
    });
  }

  /* ---------- 播放列表 ---------- */
  function renderList() {
    listBody.innerHTML = "";
    countEl.textContent = songs.length + " 首";
    var frag = document.createDocumentFragment();
    songs.forEach(function (song, i) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "songItem";
      item.dataset.index = i;

      var num = document.createElement("span");
      num.className = "songNumber";
      num.innerHTML = '<span class="number">' + (i + 1 < 10 ? "0" + (i + 1) : i + 1) + "</span>";

      var content = document.createElement("div");
      content.className = "songContent";

      var meta = document.createElement("div");
      meta.className = "songMeta";
      var t = document.createElement("div");
      t.className = "songTitle";
      t.textContent = song.name || "未知歌曲";
      var a = document.createElement("div");
      a.className = "songArtist";
      a.textContent = song.artist || "未知歌手";
      meta.appendChild(t);
      meta.appendChild(a);

      var art = document.createElement("div");
      art.className = "songArtwork";
      if (song.pic) {
        var im = document.createElement("img");
        im.alt = "";
        im.loading = "lazy";
        im.src = song.pic;
        art.appendChild(im);
      } else {
        art.innerHTML = '<div class="songArtworkPlaceholder">♪</div>';
      }

      content.appendChild(meta);
      content.appendChild(art);
      item.appendChild(num);
      item.appendChild(content);

      item.addEventListener("click", function () {
        playAt(i);
        closePlaylist();
      });
      frag.appendChild(item);
    });
    listBody.appendChild(frag);
  }

  function markCurrent() {
    var items = listBody.querySelectorAll(".songItem");
    for (var i = 0; i < items.length; i++) {
      var on = Number(items[i].dataset.index) === currentIndex;
      items[i].classList.toggle("isActive", on);
      var num = items[i].querySelector(".songNumber");
      if (!num) continue;
      if (on) {
        num.innerHTML =
          '<span class="songPlayingIndicator"><span class="songWaveAnimation">' +
          '<span class="songWaveBar"></span><span class="songWaveBar"></span><span class="songWaveBar"></span>' +
          "</span></span>";
      } else {
        var idx = Number(items[i].dataset.index);
        num.innerHTML = '<span class="number">' + (idx + 1 < 10 ? "0" + (idx + 1) : idx + 1) + "</span>";
      }
    }
  }

  /* ---------- 歌词 ---------- */
  function centerLyrics(target) {
    var boxH = lyricsBox.clientHeight;
    if (!boxH || !target) return;
    var top = target.offsetTop + target.offsetHeight / 2 - boxH / 2;
    lyricsBox.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
  }

  function renderLyrics(lines) {
    lyricsInner.innerHTML = "";
    lyricsInner.style.paddingTop = "";
    lyricsInner.style.paddingBottom = "";
    if (!lines.length) {
      var empty = document.createElement("div");
      empty.className = "lyricItem noLyrics";
      var et = document.createElement("div");
      et.className = "lyricText";
      et.textContent = "纯音乐 / 暂无歌词";
      empty.appendChild(et);
      lyricsInner.appendChild(empty);
      return;
    }
    var pad = Math.max(120, Math.round(lyricsBox.clientHeight / 2));
    lyricsInner.style.paddingTop = pad + "px";
    lyricsInner.style.paddingBottom = pad + "px";

    var frag = document.createDocumentFragment();
    lines.forEach(function (line, i) {
      var p = document.createElement("div");
      p.className = "lyricItem isUpcoming";
      p.dataset.index = i;
      var t = document.createElement("div");
      t.className = "lyricText";
      t.textContent = line.text;
      p.appendChild(t);
      p.addEventListener("click", function () {
        if (audio.duration) audio.currentTime = line.time;
      });
      frag.appendChild(p);
    });
    lyricsInner.appendChild(frag);
    currentLyricIndex = -1;
    syncLyrics(audio.currentTime || 0);
  }

  function syncLyrics(time) {
    if (!lyricLines.length) return;
    var idx = -1;
    for (var i = 0; i < lyricLines.length; i++) {
      if (time >= lyricLines[i].time - 0.15) idx = i;
      else break;
    }
    if (idx < 0) idx = 0;
    if (idx === currentLyricIndex) return;
    currentLyricIndex = idx;

    var items = lyricsInner.querySelectorAll(".lyricItem");
    for (var j = 0; j < items.length; j++) {
      items[j].classList.remove("isCurrent", "isPassed", "isUpcoming");
      if (j === idx) items[j].classList.add("isCurrent");
      else if (j < idx) items[j].classList.add("isPassed");
      else items[j].classList.add("isUpcoming");
    }
    centerLyrics(items[idx]);
  }

  function loadLyric(song) {
    lyricLines = [];
    currentLyricIndex = -1;
    if (!song.lrc) {
      renderLyrics([]);
      return;
    }
    if (lrcCache[song.lrc]) {
      lyricLines = lrcCache[song.lrc];
      renderLyrics(lyricLines);
      return;
    }
    var url = song.lrc;
    fetch(url)
      .then(function (r) {
        return r.text();
      })
      .then(function (text) {
        var lines = parseLrc(text);
        lrcCache[url] = lines;
        if (songs[currentIndex] && songs[currentIndex].lrc === url) {
          lyricLines = lines;
          renderLyrics(lines);
        }
      })
      .catch(function () {
        renderLyrics([]);
      });
  }

  /* ---------- 播放 ---------- */
  function playAt(index, autoplay) {
    if (index < 0 || index >= songs.length) return;
    currentIndex = index;
    var song = songs[index];

    titleEl.textContent = (song.name || "未知歌曲") + (song.artist ? " - " + song.artist : "");
    artworkBtn.setAttribute("aria-label", "播放 " + (song.name || ""));

    if (song.pic) {
      cover.src = song.pic;
      coverBlur.src = song.pic;
    }
    setBackground(song.pic);

    audio.src = song.url;
    audio.load();
    if (autoplay !== false) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    }

    loadLyric(song);
    markCurrent();
  }

  function togglePlay() {
    if (!audio.src) {
      if (songs.length) playAt(0);
      return;
    }
    if (audio.paused) {
      var p = audio.play();
      if (p && p.catch) p.catch(function () {});
    } else {
      audio.pause();
    }
  }

  function nextIndex(auto) {
    if (!songs.length) return -1;
    if (loopMode === 1 && auto) return currentIndex;
    if (loopMode === 2) {
      var r = currentIndex;
      while (r === currentIndex && songs.length > 1) r = Math.floor(Math.random() * songs.length);
      return r;
    }
    return (currentIndex + 1) % songs.length;
  }

  function prevIndex() {
    if (!songs.length) return -1;
    return (currentIndex - 1 + songs.length) % songs.length;
  }

  /* ---------- 音频事件 ---------- */
  audio.addEventListener("play", function () {
    artworkBtn.classList.add("isPlaying");
    needle.classList.add("needlePlaying");
    playBtn.innerHTML = ICON.pause;
    playBtn.setAttribute("aria-label", "暂停");
    markCurrent();
  });

  audio.addEventListener("pause", function () {
    artworkBtn.classList.remove("isPlaying");
    needle.classList.remove("needlePlaying");
    playBtn.innerHTML = ICON.play;
    playBtn.setAttribute("aria-label", "播放");
  });

  audio.addEventListener("ended", function () {
    var n = nextIndex(true);
    if (n >= 0) playAt(n);
  });

  audio.addEventListener("timeupdate", function () {
    if (isDragging) return;
    var d = audio.duration || 0;
    var c = audio.currentTime || 0;
    var pct = d ? (c / d) * 100 : 0;
    fill.style.width = pct + "%";
    thumb.style.left = pct + "%";
    thumb.classList.toggle("show", c > 0);
    curEl.textContent = fmtTime(c);
    syncLyrics(c);
  });

  audio.addEventListener("loadedmetadata", function () {
    durEl.textContent = fmtTime(audio.duration);
  });

  audio.addEventListener("progress", function () {
    if (audio.buffered.length && audio.duration) {
      var end = audio.buffered.end(audio.buffered.length - 1);
      bufferEl.style.width = (end / audio.duration) * 100 + "%";
      bufferEl.classList.add("hasContent");
    }
  });

  audio.addEventListener("error", function () {
    if (!audio.src) return;
    curEl.textContent = "加载失败";
  });

  /* ---------- 控制 ---------- */
  artworkBtn.addEventListener("click", togglePlay);
  playBtn.addEventListener("click", togglePlay);

  nextBtn.addEventListener("click", function () {
    var n = nextIndex(false);
    if (n >= 0) playAt(n);
  });

  prevBtn.addEventListener("click", function () {
    var n = prevIndex();
    if (n >= 0) playAt(n);
  });

  loopBtn.addEventListener("click", function () {
    loopMode = (loopMode + 1) % 3;
    loopBtn.setAttribute("aria-label", LOOP_TITLES[loopMode]);
    loopBtn.innerHTML = LOOP_ICONS[loopMode];
    audio.loop = loopMode === 1;
  });

  refreshBtn.addEventListener("click", function () {
    lrcCache = {};
    colorCache = {};
    loadPlaylist(0, true);
  });

  /* 进度条拖动 */
  function seekByEvent(e) {
    var rect = progress.getBoundingClientRect();
    var x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
    var ratio = Math.max(0, Math.min(1, x / rect.width));
    if (audio.duration) {
      audio.currentTime = ratio * audio.duration;
      fill.style.width = ratio * 100 + "%";
      thumb.style.left = ratio * 100 + "%";
      curEl.textContent = fmtTime(audio.currentTime);
      syncLyrics(audio.currentTime);
    }
  }

  progress.addEventListener("mousedown", function (e) {
    isDragging = true;
    progress.classList.add("dragging");
    thumb.classList.add("show");
    seekByEvent(e);
    e.preventDefault();
  });
  document.addEventListener("mousemove", function (e) {
    if (isDragging) seekByEvent(e);
  });
  document.addEventListener("mouseup", function () {
    if (isDragging) {
      isDragging = false;
      progress.classList.remove("dragging");
    }
  });
  progress.addEventListener(
    "touchstart",
    function (e) {
      isDragging = true;
      progress.classList.add("dragging");
      thumb.classList.add("show");
      seekByEvent(e);
    },
    { passive: true }
  );
  progress.addEventListener(
    "touchmove",
    function (e) {
      if (isDragging) seekByEvent(e);
    },
    { passive: true }
  );
  progress.addEventListener("touchend", function () {
    isDragging = false;
    progress.classList.remove("dragging");
  });

  /* 音量：竖向滑块 */
  function syncVolumeIcon() {
    volumeBtn.innerHTML = audio.volume === 0 || audio.muted ? ICON.volumeX : ICON.volume2;
  }
  volumeBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    volumeBox.classList.toggle("show");
  });
  volumeRange.addEventListener("input", function () {
    audio.muted = false;
    audio.volume = Number(volumeRange.value) / 100;
    syncVolumeIcon();
  });
  document.addEventListener("click", function (e) {
    if (!volumeBox.contains(e.target) && e.target !== volumeBtn) {
      volumeBox.classList.remove("show");
    }
  });

  /* ---------- 播放列表抽屉 ---------- */
  function openPlaylist() {
    mount.classList.add("is-open");
  }
  function closePlaylist() {
    mount.classList.remove("is-open");
  }
  listBtn.addEventListener("click", function () {
    mount.classList.contains("is-open") ? closePlaylist() : openPlaylist();
  });
  playlistClose.addEventListener("click", closePlaylist);
  if (backdrop) backdrop.addEventListener("click", closePlaylist);

  /* ---------- 键盘 ---------- */
  document.addEventListener("keydown", function (e) {
    var tag = (e.target.tagName || "").toLowerCase();
    if (tag === "input" || tag === "textarea") return;
    if (e.code === "Escape") {
      closePlaylist();
      return;
    }
    if (e.code === "Space") {
      e.preventDefault();
      togglePlay();
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      var n = nextIndex(false);
      if (n >= 0) playAt(n);
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      var p = prevIndex();
      if (p >= 0) playAt(p);
    } else if (e.code === "ArrowUp") {
      e.preventDefault();
      audio.volume = Math.min(1, audio.volume + 0.1);
      volumeRange.value = Math.round(audio.volume * 100);
      syncVolumeIcon();
    } else if (e.code === "ArrowDown") {
      e.preventDefault();
      audio.volume = Math.max(0, audio.volume - 0.1);
      volumeRange.value = Math.round(audio.volume * 100);
      syncVolumeIcon();
    }
  });

  /* 窗口尺寸变化：重算歌词留白与居中 */
  var resizeTimer;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!lyricLines.length) return;
      var pad = Math.max(120, Math.round(lyricsBox.clientHeight / 2));
      lyricsInner.style.paddingTop = pad + "px";
      lyricsInner.style.paddingBottom = pad + "px";
      currentLyricIndex = -1;
      syncLyrics(audio.currentTime || 0);
    }, 200);
  });

  /* ---------- 初始化 ---------- */
  audio.volume = 0.7;
  volumeRange.value = "70";
  syncVolumeIcon();
  loopBtn.innerHTML = LOOP_ICONS[0];

  function loadPlaylist(i, force) {
    if (i >= API_LIST.length) {
      titleEl.textContent = "歌单加载失败";
      root.classList.add("noSong");
      return;
    }
    var url =
      API_LIST[i] + "?server=" + SERVER + "&type=playlist&id=" + PLAYLIST_ID + "&r=" + Math.random();

    fetch(url)
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (!Array.isArray(data) || !data.length) throw new Error("empty playlist");
        songs = data;
        root.classList.remove("noSong");
        renderList();
        playAt(0, false);
      })
      .catch(function () {
        loadPlaylist(i + 1, force);
      });
  }

  loadPlaylist(0);
})();
