/* ============================================================
   时间容器 · Navidrome 迷你播放器
   数据：Navidrome (Subsonic API)，播放「博客背景音乐」歌单
   认证：enc:hex 编码密码（请务必使用博客专用只读账号）
   行为：不自动播放，访客点击才放；localStorage 记忆曲目与音量
   ============================================================ */
(function () {
  var cfg = window.__TC_NAVIDROME__;
  var el = document.getElementById('tc-player');
  if (!el) return;
  if (!cfg || !cfg.baseUrl || !cfg.playlistId || !cfg.username || !cfg.password) {
    el.classList.add('hidden');
    return;
  }

  var playBtn = document.getElementById('tc-play');
  var prevBtn = document.getElementById('tc-prev');
  var nextBtn = document.getElementById('tc-next');
  var volEl = document.getElementById('tc-vol');
  var trackEl = document.getElementById('tc-track');
  var iconPlay = document.getElementById('tc-icon-play');
  var iconPause = document.getElementById('tc-icon-pause');

  /* UTF-8 安全的 hex 编码（Subsonic enc: 认证） */
  function hexEncode(str) {
    var bytes = new TextEncoder().encode(String(str));
    var h = '';
    for (var i = 0; i < bytes.length; i++) { h += bytes[i].toString(16).padStart(2, '0'); }
    return h;
  }

  var base = String(cfg.baseUrl).replace(/\/+$/, '') + '/rest/';
  function authQuery(extra) {
    var q = 'u=' + encodeURIComponent(cfg.username) +
            '&p=' + encodeURIComponent('enc:' + hexEncode(cfg.password)) +
            '&v=1.16.1&c=time-capsule&f=json';
    return extra ? q + '&' + extra : q;
  }

  var audio = new Audio();
  audio.preload = 'none';
  var tracks = [];
  var idx = 0;

  function save(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  function setIcon(playing) {
    if (iconPlay) iconPlay.style.display = playing ? 'none' : '';
    if (iconPause) iconPause.style.display = playing ? '' : 'none';
  }

  function renderTrack() {
    if (!tracks.length) return;
    var t = tracks[idx];
    trackEl.textContent = (t.title || '未知曲目') + (t.artist ? ' · ' + t.artist : '');
    trackEl.title = trackEl.textContent;
  }

  function loadTrack(i, autoplay) {
    if (!tracks.length) return;
    idx = ((i % tracks.length) + tracks.length) % tracks.length;
    save('tc-track-idx', String(idx));
    renderTrack();
    audio.src = base + 'stream.view?' + authQuery('id=' + encodeURIComponent(tracks[idx].id));
    if (autoplay) { play(); } else { setIcon(false); }
  }

  function play() {
    audio.play().then(function () { setIcon(true); }).catch(function () { setIcon(false); });
  }
  function pause() { audio.pause(); setIcon(false); }

  /* 事件 */
  if (playBtn) playBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!tracks.length) return;
    if (audio.paused) { if (!audio.src) loadTrack(idx, true); else play(); } else { pause(); }
  });
  if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); if (tracks.length) loadTrack(idx + 1, !audio.paused); });
  if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); if (tracks.length) loadTrack(idx - 1, !audio.paused); });
  if (volEl) volEl.addEventListener('input', function () {
    audio.volume = volEl.value / 100;
    save('tc-volume', volEl.value);
  });
  audio.addEventListener('ended', function () { loadTrack(idx + 1, true); });
  audio.addEventListener('play', function () { setIcon(true); });
  audio.addEventListener('pause', function () { setIcon(false); });

  /* 恢复音量 */
  var savedVol = read('tc-volume');
  if (savedVol !== null && volEl) { volEl.value = savedVol; audio.volume = savedVol / 100; }
  else { audio.volume = 0.8; }

  /* 拉取歌单 */
  trackEl.textContent = '博客背景音乐 · 加载中…';
  var listUrl = base + 'getPlaylist.view?' + authQuery('id=' + encodeURIComponent(cfg.playlistId));
  console.log('[时间容器] 拉取歌单 →', cfg.baseUrl, '歌单 ID:', cfg.playlistId);
  fetch(listUrl)
    .then(function (r) { if (!r.ok) { throw new Error('HTTP ' + r.status); } return r.json(); })
    .then(function (data) {
      var resp = data && data['subsonic-response'];
      if (!resp) { throw new Error('响应格式异常'); }
      if (resp.status !== 'ok') { throw new Error('Subsonic 错误 ' + (resp.error && resp.error.code) + '：' + (resp.error && resp.error.message)); }
      if (!resp.playlist) { throw new Error('未取到歌单'); }
      tracks = resp.playlist.entry || [];
      if (!tracks.length) { console.warn('[时间容器] 歌单为空'); el.classList.add('hidden'); return; }
      console.log('[时间容器] 歌单已加载，共 ' + tracks.length + ' 首');
      var savedIdx = parseInt(read('tc-track-idx') || '0', 10);
      idx = (isNaN(savedIdx) || savedIdx >= tracks.length) ? 0 : savedIdx;
      renderTrack();
      setIcon(false);
      /* 预载当前曲源但不播放 */
      audio.src = base + 'stream.view?' + authQuery('id=' + encodeURIComponent(tracks[idx].id));
      if (cfg.autoplay === true || cfg.autoplay === 'true') { play(); }
    })
    .catch(function (err) {
      console.error('[时间容器] 歌单加载失败：', err && err.message, '\n可能原因：① Navidrome 未开 CORS ② 博客是 HTTPS 而 Navidrome 是 HTTP（混合内容被拦）③ 账号或歌单 ID 有误');
      trackEl.textContent = '音乐服务未连接';
      el.title = '无法连接 Navidrome（按 F12 看 Console 有具体原因）';
      setIcon(false);
    });
})();
