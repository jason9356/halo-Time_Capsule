/* 时间容器 · 明暗切换 */
(function () {
  function bind() {
    var btn = document.getElementById('theme-toggle');
    if (!btn || btn.__tcBound) return;
    btn.__tcBound = true;
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme');
      var sysDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      var next;
      if (cur === 'dark') next = 'light';
      else if (cur === 'light') next = 'dark';
      else next = sysDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('tc-theme', next); } catch (e) {}
    });
  }
  bind();
  window.__TC_BIND_THEME__ = bind;
})();
