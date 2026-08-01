/* 时间容器 · 雅集增强（兼容软跳转：#tc-page 替换后需重新浮现） */
(function () {
  'use strict';

  document.documentElement.classList.add('tc-js');

  var io = null;
  var SELECTOR = [
    '.stream-item',
    '.cat-card',
    '.featured-item',
    '.book-item',
    '.moment-card',
    '.timeline-item',
    '.archive-item',
    '.rel-item'
  ].join(',');

  var TG = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
  var DZ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];

  function ganzhi(y) {
    return TG[(y - 4) % 10] + DZ[(y - 4) % 12];
  }

  var MOUNTAIN_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" preserveAspectRatio="xMidYMax slice">'
    + '<path fill="currentColor" opacity="0.04" d="M0,224 C80,198 160,172 260,186 C360,200 420,156 520,148 C620,140 700,178 800,170 C900,162 980,132 1080,140 C1180,148 1280,180 1360,172 C1400,168 1420,174 1440,178 L1440,320 L0,320 Z"/>'
    + '<path fill="currentColor" opacity="0.06" d="M0,258 C100,238 180,218 280,232 C380,246 440,204 560,196 C680,188 740,224 860,214 C980,204 1060,176 1160,188 C1260,200 1340,226 1440,218 L1440,320 L0,320 Z"/>'
    + '<path fill="currentColor" opacity="0.09" d="M0,282 C120,268 200,252 320,262 C440,272 520,240 640,236 C760,232 840,258 960,250 C1080,242 1180,222 1280,234 C1360,242 1400,256 1440,252 L1440,320 L0,320 Z"/>'
    + '<path fill="currentColor" opacity="0.025" d="M0,296 C200,292 400,298 600,294 C800,290 1000,296 1200,293 C1350,291 1400,295 1440,294 L1440,320 L0,320 Z"/>'
    + '</svg>';

  function ensureChrome() {
    var bar = document.getElementById('tc-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tc-progress';
      document.body.appendChild(bar);
    }
    var nav = document.getElementById('tc-float-nav');
    if (!nav) {
      nav = document.createElement('div');
      nav.id = 'tc-float-nav';
      var btn = document.createElement('button');
      btn.id = 'tc-backtop';
      btn.type = 'button';
      btn.textContent = '回';
      btn.title = '回到顶部';
      btn.setAttribute('aria-label', '回到顶部');
      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      var home = document.createElement('a');
      home.id = 'tc-backhome';
      home.href = '/';
      home.textContent = '家';
      home.title = '回到首页';
      home.setAttribute('aria-label', '回到首页');
      nav.appendChild(btn);
      nav.appendChild(home);
      document.body.appendChild(nav);
    }
    var mtn = document.getElementById('tc-mountains');
    if (!mtn) {
      mtn = document.createElement('div');
      mtn.id = 'tc-mountains';
      mtn.setAttribute('aria-hidden', 'true');
      mtn.innerHTML = MOUNTAIN_SVG;
      document.body.appendChild(mtn);
    }
  }

  function updateProgress() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var bar = document.getElementById('tc-progress');
    if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max * 100) : 0) + '%';
  }

  function updateBacktop() {
    var nav = document.getElementById('tc-float-nav');
    if (nav) nav.classList.toggle('tc-show', window.scrollY > 500);
  }

  function revealIn(root) {
    var scope = root || document;
    var targets = scope.querySelectorAll(SELECTOR);
    if (!targets.length) return;

    if (!('IntersectionObserver' in window)) {
      Array.prototype.forEach.call(targets, function (t) { t.classList.add('tc-visible'); });
      return;
    }

    if (io) io.disconnect();
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target;
        var siblings = el.parentNode ? el.parentNode.children : [];
        var idx = Array.prototype.indexOf.call(siblings, el);
        setTimeout(function () { el.classList.add('tc-visible'); }, Math.min(Math.max(idx, 0) * 40, 240));
        io.unobserve(el);
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    Array.prototype.forEach.call(targets, function (t) {
      t.classList.remove('tc-visible');
      io.observe(t);
    });

    /* 兜底：软跳转后若观察未触发，避免内容永久透明 */
    setTimeout(function () {
      Array.prototype.forEach.call(targets, function (t) {
        if (!t.classList.contains('tc-visible')) t.classList.add('tc-visible');
      });
    }, 900);
  }

  function decorateDates(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll('.stream-date'), function (el) {
      if (el.querySelector('.tc-lunar')) return;
      var y = new Date().getFullYear();
      var span = document.createElement('span');
      span.className = 'tc-lunar';
      span.textContent = ganzhi(y);
      el.appendChild(span);
    });

    Array.prototype.forEach.call(scope.querySelectorAll('.page-desc'), function (el) {
      if (el.querySelector('.tc-ganzhi-inline')) return;
      var m = (el.textContent || '').match(/(\d{4})/);
      if (!m) return;
      var span = document.createElement('span');
      span.className = 'tc-ganzhi-inline';
      span.style.cssText = 'color:var(--accent);font-family:var(--serif);margin-left:8px;font-size:14px;';
      span.textContent = ganzhi(parseInt(m[1], 10));
      el.appendChild(span);
    });
  }

  function decorateColophon(root) {
    var scope = root || document;
    var postContent = scope.querySelector('.post-content');
    if (!postContent) return;
    if (postContent.parentNode.querySelector('.tc-colophon')) return;

    var colophon = document.createElement('div');
    colophon.className = 'tc-colophon';
    var img = document.createElement('img');
    img.className = 'tc-colophon-seal';
    /* 落款用简洁「時」小印；顶栏大印留给门楣 */
    img.src = '/themes/time-capsule/assets/img/seal-mark.png';
    img.alt = '時';
    var txt = document.createElement('div');
    txt.className = 'tc-colophon-text';
    txt.innerHTML = '<span class="tc-ganzhi">' + ganzhi(new Date().getFullYear()) + '</span> 识于时间容器';
    colophon.appendChild(img);
    colophon.appendChild(txt);
    postContent.parentNode.insertBefore(colophon, postContent.nextSibling);
  }

  function refresh(root) {
    ensureChrome();
    var scope = root || document.getElementById('tc-page') || document;
    revealIn(scope);
    decorateDates(scope);
    decorateColophon(scope);
    updateProgress();
    updateBacktop();
  }

  ensureChrome();
  window.addEventListener('scroll', function () {
    updateProgress();
    updateBacktop();
  }, { passive: true });

  refresh(document);

  /* 供 player.js 软跳转后调用 */
  window.__TC_ENHANCE_REFRESH__ = function () {
    refresh(document.getElementById('tc-page') || document);
  };
})();
