/* ============================================================
   时间容器 · 全站听乐（悬浮条 + 首页大卡，软跳转不断歌）
   ============================================================ */
(function () {
  if (window.__TC_PLAYER__) return;
  window.__TC_PLAYER__ = true;

  var raw = window.__TC_NAVIDROME__ || {};
  function clean(v) {
    if (v == null) return '';
    var s = String(v).trim();
    if (!s || s === 'null' || s === 'undefined') return '';
    return s;
  }
  var cfg = {
    baseUrl: clean(raw.baseUrl).replace(/\/+$/, ''),
    username: clean(raw.username),
    password: clean(raw.password),
    playlistId: clean(raw.playlistId),
    autoplay: raw.autoplay === true || raw.autoplay === 'true'
  };

  var dock = document.getElementById('tc-dock');
  if (!dock) return;

  function qsAll(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }
  function setText(sel, text) {
    qsAll('[data-tc="' + sel + '"]').forEach(function (n) { n.textContent = text; });
  }
  function setHtmlHidden(sel, hidden) {
    qsAll('[data-tc="' + sel + '"]').forEach(function (n) { n.hidden = !!hidden; });
  }

  function showError(msg) {
    qsAll('[data-tc="error"]').forEach(function (n) {
      n.hidden = false;
      n.textContent = msg;
    });
    setText('track', '音乐服务未连接');
    setText('artist', '见说明');
    console.error('[时间容器]', msg);
  }

  if (!cfg.baseUrl || !cfg.playlistId) {
    showError('主题设置缺少 Navidrome 地址或歌单 ID。');
    return;
  }
  if (!cfg.username || !cfg.password) {
    showError('主题设置缺少用户名或密码（重载主题配置后需重新填写）。');
    return;
  }

  function hexEncode(str) {
    var bytes = new TextEncoder().encode(String(str));
    var h = '';
    for (var i = 0; i < bytes.length; i++) h += bytes[i].toString(16).padStart(2, '0');
    return h;
  }

  var base = cfg.baseUrl + '/rest/';
  function authQuery(extra) {
    var q = 'u=' + encodeURIComponent(cfg.username) +
            '&p=' + encodeURIComponent('enc:' + hexEncode(cfg.password)) +
            '&v=1.16.1&c=time-capsule&f=json';
    return extra ? q + '&' + extra : q;
  }
  function streamUrl(id) {
    return base + 'stream.view?' + authQuery(
      'id=' + encodeURIComponent(id) + '&format=mp3&maxBitRate=320'
    );
  }
  function coverUrl(coverId, size) {
    if (!coverId) return '';
    return base + 'getCoverArt.view?' + authQuery('id=' + encodeURIComponent(coverId) + '&size=' + (size || 300));
  }

  var audio = new Audio();
  audio.preload = 'metadata';
  var tracks = [];
  var idx = 0;
  var wantPlay = false;
  var resumeAt = 0;
  var lastPersist = 0;

  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function persistNow() {
    save('tc-track-idx', String(idx));
    save('tc-playing', wantPlay && !audio.paused ? '1' : '0');
    save('tc-current-time', String(audio.currentTime || 0));
    if (arguments.length && typeof arguments[0] === 'number') {
      /* no-op placeholder */
    }
  }

  function setIcon(playing) {
    qsAll('[data-tc="icon-play"]').forEach(function (n) { n.style.display = playing ? 'none' : ''; });
    qsAll('[data-tc="icon-pause"]').forEach(function (n) { n.style.display = playing ? '' : 'none'; });
    dock.classList.toggle('is-playing', !!playing);
    qsAll('[data-tc-home-panel]').forEach(function (n) { n.classList.toggle('is-playing', !!playing); });
    document.body.classList.toggle('tc-has-dock', true);
  }

  function fmtTime(sec) {
    if (!isFinite(sec) || sec < 0) return '0:00';
    sec = Math.floor(sec);
    var m = Math.floor(sec / 60);
    var s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function padNum(n) { return (n < 10 ? '0' : '') + n; }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function setCover(coverId) {
    var url = coverUrl(coverId, 400);
    var thumb = coverUrl(coverId, 96);
    qsAll('[data-tc="cover"]').forEach(function (img) {
      var isDock = img.classList.contains('tc-dock-cover');
      var src = isDock ? thumb : url;
      var fallback = img.parentNode && img.parentNode.querySelector('[data-tc="cover-fallback"]');
      if (!src) {
        img.removeAttribute('src');
        img.style.display = 'none';
        if (fallback) fallback.style.display = '';
        return;
      }
      img.onload = function () {
        img.style.display = '';
        if (fallback) fallback.style.display = 'none';
      };
      img.onerror = function () {
        img.style.display = 'none';
        if (fallback) fallback.style.display = '';
      };
      img.alt = (tracks[idx] && tracks[idx].album) || '专辑封面';
      img.src = src;
    });
  }

  function renderNow() {
    if (!tracks.length) return;
    var t = tracks[idx];
    setText('track', t.title || '未知曲目');
    setText('artist', t.artist || '未知艺人');
    setText('album', t.album || '');
    setCover(t.coverArt || t.id);
    if (t.duration) setText('dur', fmtTime(t.duration));
  }

  function renderList() {
    qsAll('[data-tc="tracklist"]').forEach(function (listEl) {
      listEl.innerHTML = '';
      tracks.forEach(function (t, i) {
        var li = document.createElement('li');
        li.className = 'listening-item' + (i === idx ? ' is-current' : '');
        li.setAttribute('role', 'button');
        li.tabIndex = 0;
        li.setAttribute('data-tc-track-i', String(i));
        var thumb = coverUrl(t.coverArt || t.id, 80);
        li.innerHTML =
          '<span class="lthumb">' +
            (thumb ? '<img src="' + escapeHtml(thumb) + '" alt="" loading="lazy" />' : '<span class="lthumb-ph">♪</span>') +
          '</span>' +
          '<span class="lmain">' +
            '<span class="lt">' + escapeHtml(t.title || '未知曲目') + '</span>' +
            '<span class="la">' + escapeHtml((t.artist || '') + (t.album ? ' · ' + t.album : '')) + '</span>' +
          '</span>' +
          '<span class="ln">' + padNum(i + 1) + '</span>';
        listEl.appendChild(li);
      });
    });
  }

  function highlightList() {
    qsAll('[data-tc="tracklist"] .listening-item').forEach(function (item) {
      var i = parseInt(item.getAttribute('data-tc-track-i'), 10);
      item.classList.toggle('is-current', i === idx);
    });
  }

  function play() {
    wantPlay = true;
    save('tc-playing', '1');
    var p = audio.play();
    if (p && p.then) {
      p.then(function () { setIcon(true); }).catch(function () {
        setIcon(false);
        save('tc-playing', '0');
      });
    }
  }
  function pause() {
    wantPlay = false;
    save('tc-playing', '0');
    persistNow();
    audio.pause();
    setIcon(false);
  }

  function loadTrack(i, autoplay, seekTo) {
    if (!tracks.length) return;
    idx = ((i % tracks.length) + tracks.length) % tracks.length;
    save('tc-track-idx', String(idx));
    renderNow();
    highlightList();
    wantPlay = !!autoplay;
    qsAll('[data-tc="progress"]').forEach(function (n) { n.style.width = '0%'; });
    setText('cur', '0:00');
    audio.src = streamUrl(tracks[idx].id);
    audio.load();
    var target = seekTo > 0 ? seekTo : 0;
    var onReady = function () {
      audio.removeEventListener('canplay', onReady);
      if (target > 0 && isFinite(audio.duration) && target < audio.duration - 1) {
        try { audio.currentTime = target; } catch (e) {}
      }
      if (wantPlay) play();
    };
    audio.addEventListener('canplay', onReady);
    if (autoplay) play();
    else setIcon(false);
  }

  /* 事件委托：首页大卡软跳转后仍可用 */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-tc-action]');
    if (btn) {
      var act = btn.getAttribute('data-tc-action');
      if (act === 'toggle') {
        if (!tracks.length) return;
        if (audio.paused) {
          if (!audio.src) loadTrack(idx, true);
          else play();
        } else pause();
        return;
      }
      if (act === 'next' && tracks.length) { loadTrack(idx + 1, true); return; }
      if (act === 'prev' && tracks.length) { loadTrack(idx - 1, true); return; }
      if (act === 'toggle-list') {
        var sheet = document.getElementById('tc-dock-sheet');
        if (sheet) sheet.hidden = !sheet.hidden;
        dock.classList.toggle('is-open', sheet && !sheet.hidden);
        return;
      }
    }
    var item = e.target.closest('[data-tc-track-i]');
    if (item) {
      var i = parseInt(item.getAttribute('data-tc-track-i'), 10);
      if (!isNaN(i)) loadTrack(i, true);
    }
  });

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || el.getAttribute('data-tc') !== 'vol') return;
    audio.volume = el.value / 100;
    save('tc-volume', el.value);
    qsAll('[data-tc="vol"]').forEach(function (n) {
      if (n !== el) n.value = el.value;
    });
  });

  audio.addEventListener('ended', function () {
    if (tracks.length > 1) loadTrack(idx + 1, true);
    else if (tracks.length === 1) loadTrack(0, true);
  });
  audio.addEventListener('play', function () { setIcon(true); save('tc-playing', '1'); });
  audio.addEventListener('pause', function () {
    if (!wantPlay) setIcon(false);
    persistNow();
  });
  audio.addEventListener('timeupdate', function () {
    setText('cur', fmtTime(audio.currentTime));
    if (audio.duration) {
      var pct = Math.min(100, (audio.currentTime / audio.duration) * 100) + '%';
      qsAll('[data-tc="progress"]').forEach(function (n) { n.style.width = pct; });
    }
    var now = Date.now();
    if (now - lastPersist > 2000) {
      lastPersist = now;
      persistNow();
    }
  });
  audio.addEventListener('loadedmetadata', function () {
    setText('dur', fmtTime(audio.duration));
  });
  audio.addEventListener('error', function () {
    console.warn('[时间容器] 曲目流加载失败');
    if (tracks.length > 1 && wantPlay) loadTrack(idx + 1, true);
  });

  window.addEventListener('pagehide', persistNow);
  window.addEventListener('beforeunload', persistNow);

  var savedVol = read('tc-volume');
  if (savedVol !== null) {
    audio.volume = savedVol / 100;
    qsAll('[data-tc="vol"]').forEach(function (n) { n.value = savedVol; });
  } else audio.volume = 0.8;

  setText('track', '正在读取歌单…');
  setText('artist', cfg.baseUrl.replace(/^https?:\/\//, ''));

  var listUrl = base + 'getPlaylist.view?' + authQuery('id=' + encodeURIComponent(cfg.playlistId));
  fetch(listUrl)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (data) {
      var resp = data && data['subsonic-response'];
      if (!resp) throw new Error('响应不是 Subsonic JSON');
      if (resp.status !== 'ok') {
        throw new Error('认证/歌单错误 ' + (resp.error && resp.error.code) + '：' + (resp.error && resp.error.message));
      }
      if (!resp.playlist) throw new Error('未取到歌单，请核对歌单 ID');
      var entry = resp.playlist.entry || [];
      tracks = Array.isArray(entry) ? entry : [entry];
      if (!tracks.length) {
        setText('track', '歌单为空');
        setText('artist', '去 Navidrome 加几首歌');
        return;
      }
      setHtmlHidden('error', true);
      var savedIdx = parseInt(read('tc-track-idx') || '0', 10);
      idx = (isNaN(savedIdx) || savedIdx >= tracks.length) ? 0 : savedIdx;
      resumeAt = parseFloat(read('tc-current-time') || '0') || 0;
      var wasPlaying = read('tc-playing') === '1';
      renderList();
      renderNow();
      highlightList();
      setIcon(false);
      var shouldPlay = wasPlaying || cfg.autoplay;
      loadTrack(idx, shouldPlay, resumeAt);
    })
    .catch(function (err) {
      var tip = (err && err.message) || '未知错误';
      if (/Failed to fetch|NetworkError|Load failed/i.test(tip)) {
        showError('无法连接音乐服务。请把地址改为 https://blog.xybkwd.top/tc-music 后保存并刷新。');
        return;
      }
      showError(tip + ' · 核对：地址、用户名密码、歌单 ID');
    });

  /* ---------- 软跳转：只换 #tc-page，dock/audio 常驻 ---------- */
  var navigating = false;

  function sameOriginNav(url) {
    try {
      var u = new URL(url, location.href);
      if (u.origin !== location.origin) return false;
      if (u.pathname.indexOf('/console') === 0) return false;
      if (/\.(xml|zip|pdf|jpg|jpeg|png|gif|webp|mp3|mp4)$/i.test(u.pathname)) return false;
      return true;
    } catch (e) { return false; }
  }

  function runInlineScripts(root) {
    qsAll('script', root).forEach(function (old) {
      var s = document.createElement('script');
      if (old.src) {
        s.src = old.src;
        s.async = false;
      } else {
        s.textContent = old.textContent;
      }
      Array.prototype.forEach.call(old.attributes, function (a) {
        if (a.name !== 'src') s.setAttribute(a.name, a.value);
      });
      old.parentNode.replaceChild(s, old);
    });
  }

  function afterPageSwap() {
    /* 首页大卡可能新插入：补绘列表与当前曲 */
    if (tracks.length) {
      renderList();
      renderNow();
      highlightList();
      setIcon(!audio.paused);
      var vol = read('tc-volume');
      if (vol !== null) qsAll('[data-tc="vol"]').forEach(function (n) { n.value = vol; });
    }
    if (window.__TC_BIND_THEME__) window.__TC_BIND_THEME__();
    /* 雅集浮现/干支：enhance.js 只在首屏执行，软跳转后必须重跑 */
    if (window.__TC_ENHANCE_REFRESH__) window.__TC_ENHANCE_REFRESH__();
    window.scrollTo(0, 0);
  }

  function navigate(href, push) {
    if (navigating) {
      location.href = href;
      return;
    }
    navigating = true;
    persistNow();
    document.body.classList.add('tc-navigating');
    fetch(href, { credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'TCSoftNav' } })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html');
        var next = doc.getElementById('tc-page');
        var cur = document.getElementById('tc-page');
        if (!next || !cur) {
          location.href = href;
          return;
        }
        var nextHtml = (next.innerHTML || '').replace(/\s+/g, ' ').trim();
        if (nextHtml.length < 40) {
          location.href = href;
          return;
        }
        cur.innerHTML = next.innerHTML;
        runInlineScripts(cur);
        document.title = doc.title || document.title;
        var theme = doc.documentElement.getAttribute('data-theme');
        if (theme) document.documentElement.setAttribute('data-theme', theme);
        if (push !== false) history.pushState({ tc: 1 }, '', href);
        afterPageSwap();
      })
      .catch(function () { location.href = href; })
      .finally(function () {
        navigating = false;
        document.body.classList.remove('tc-navigating');
      });
  }

  document.addEventListener('click', function (e) {
    if (e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest('a[href]');
    if (!a) return;
    if (a.target && a.target !== '_self') return;
    if (a.hasAttribute('download')) return;
    if (a.closest('#tc-dock')) return;
    var href = a.href;
    if (!sameOriginNav(href)) return;
    var u = new URL(href, location.href);
    if (u.hash && u.pathname === location.pathname && u.search === location.search) return;
    e.preventDefault();
    navigate(href, true);
  });

  window.addEventListener('popstate', function () {
    navigate(location.href, false);
  });

  /* 首页大卡软跳转后出现时，由 afterPageSwap 重绘 */
  window.__TC_PLAYER_REFRESH__ = afterPageSwap;
})();
