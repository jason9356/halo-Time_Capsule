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
  var SX = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];

  function ganzhi(y) {
    return TG[(y - 4) % 10] + DZ[(y - 4) % 12] + '年（' + SX[(y - 4) % 12] + '年）';
  }

  function ensureChrome() {
    var bar = document.getElementById('tc-progress');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'tc-progress';
      document.body.appendChild(bar);
    }
    var btn = document.getElementById('tc-backtop');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'tc-backtop';
      btn.textContent = '回';
      btn.title = '回到顶部';
      document.body.appendChild(btn);
      btn.addEventListener('click', function () {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  }

  function updateProgress() {
    var h = document.documentElement;
    var max = h.scrollHeight - h.clientHeight;
    var bar = document.getElementById('tc-progress');
    if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max * 100) : 0) + '%';
  }

  function updateBacktop() {
    var btn = document.getElementById('tc-backtop');
    if (btn) btn.classList.toggle('tc-show', window.scrollY > 500);
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
    img.src = '/themes/time-capsule/assets/img/seal.png';
    img.alt = '时间容器';
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
