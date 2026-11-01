/* Codee — 모션 */
(function () {
  'use strict';

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var onChange = function (mq, fn) {
    if (mq.addEventListener) mq.addEventListener('change', fn);
    else if (mq.addListener) mq.addListener(fn);
  };

  // Glass Icon(Originkit glass-icon) 설정 — 화면 정중앙, 무대 높이 78% · 너비 84% 안에서 가장 크게
  var RING_H = 0.78;
  var RING_W = 0.84;
  var GLASS = {
    shape: 'Torus',
    depth: 32,
    speed: 32,
    direction: 'Clockwise',
    background: '#0B0C0E',
    glass: { tint: '#FFFFFF', chromatic: 25, frost: 18 },
    size: function (w, h) { return (Math.min(RING_H * h, RING_W * w) / Math.max(h, 1)) * 100; },
    orient: { angleX: 100, angleY: 0, angleZ: 0, offsetX: 0, offsetY: 0 },
    initialYaw: 0.6,
    initialPitch: -0.85,
    maxDpr: 2
  };

  // 고리 한가운데의 Codee — 배경판에 그려 유리가 굴절시킨다(false면 HTML 글자를 위에 그대로 둔다)
  var WORDMARK_IN_GLASS = true;
  var WORD = 'Codee';
  var WORD_SCALE = 0.28;     // 글자 크기 = 고리 지름 × 0.28 (layout.css .hero__title과 같은 값)
  var WORD_TRACK = -0.065;   // 자간 = 글자 크기 × -0.065 (tokens.css --tracking-display)
  var WORD_FONT = '"IBM Plex Sans KR", "IBM Plex Sans", system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif';
  var wordReady = false;

  var PREF_KEY = 'codee.heroMotionPaused';
  var readPaused = function () {
    try { return window.localStorage.getItem(PREF_KEY) === '1'; } catch (e) { return false; }
  };
  var savePaused = function (paused) {
    try { window.localStorage.setItem(PREF_KEY, paused ? '1' : '0'); } catch (e) { /* noop */ }
  };

  function drawWordmark(ctx, cx, cy, r) {
    var size = r * 2 * WORD_SCALE;
    var track = WORD_TRACK * size;
    ctx.save();
    ctx.font = '500 ' + size.toFixed(1) + 'px ' + WORD_FONT;
    ctx.fillStyle = '#EDEEF0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    var native = 'letterSpacing' in ctx;
    if (native) ctx.letterSpacing = track.toFixed(2) + 'px';
    var m = ctx.measureText(WORD);
    var asc = m.actualBoundingBoxAscent || size * 0.72;
    var desc = m.actualBoundingBoxDescent || 0;
    var y = cy + (asc - desc) / 2;
    if (native) {
      var left = m.actualBoundingBoxLeft || 0;
      var right = m.actualBoundingBoxRight || m.width;
      ctx.fillText(WORD, cx - (right - left) / 2, y);
    } else {
      var chars = WORD.split('');
      var widths = chars.map(function (c) { return ctx.measureText(c).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + track * (chars.length - 1);
      var x = cx - total / 2;
      chars.forEach(function (c, i) { ctx.fillText(c, x, y); x += widths[i] + track; });
    }
    ctx.restore();
  }

  function frameInset() {
    var frame = document.querySelector('.hero__frame');
    var stage = document.querySelector('[data-glass-stage]');
    if (!frame || !stage) return 24;
    return Math.max(16, frame.getBoundingClientRect().left - stage.getBoundingClientRect().left);
  }

  function drawPlate(ctx, w, h, info) {
    var dpr = info.dpr;
    var cx = info.cx;
    var cy = info.cy;
    var r = info.r;
    var TAU = Math.PI * 2;

    ctx.fillStyle = '#0B0C0E';
    ctx.fillRect(0, 0, w, h);

    var glow = ctx.createRadialGradient(cx, cy, r * 0.2, cx, cy, r * 2.3);
    glow.addColorStop(0, 'rgba(237, 238, 240, 0.10)');
    glow.addColorStop(0.5, 'rgba(237, 238, 240, 0.035)');
    glow.addColorStop(1, 'rgba(237, 238, 240, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    var step = 28 * dpr;
    var half = step / 2;
    var dot = 1 * dpr;
    for (var y = half; y < h; y += step) {
      for (var x = half; x < w; x += step) {
        var d = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy)) / (r * 2.2);
        var a = 0.14 + 0.32 * Math.exp(-d * d * 2.4);
        ctx.fillStyle = 'rgba(237, 238, 240, ' + a.toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(x, y, dot, 0, TAU);
        ctx.fill();
      }
    }

    ctx.lineWidth = Math.max(1, dpr);
    ctx.strokeStyle = 'rgba(237, 238, 240, 0.26)';
    ctx.setLineDash([2 * dpr, 7 * dpr]);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 1.3, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);

    // 다리 선: 고리와 Codee를 가로지르고, 양 끝은 히어로 틀(꺾쇠) 가장자리에서 멈춘다
    var reach = r * 2.1;
    var inset = frameInset() * dpr;
    var x0 = Math.max(inset, cx - reach);
    var x1 = Math.min(w - inset, cx + reach);
    ctx.strokeStyle = 'rgba(237, 238, 240, 0.42)';
    ctx.beginPath();
    ctx.moveTo(x0, cy);
    ctx.lineTo(x1, cy);
    ctx.stroke();

    [x0, x1].forEach(function (nx) {
      ctx.fillStyle = '#0B0C0E';
      ctx.strokeStyle = 'rgba(237, 238, 240, 0.8)';
      ctx.lineWidth = 1.25 * dpr;
      ctx.beginPath();
      ctx.arc(nx, cy, 5 * dpr, 0, TAU);
      ctx.fill();
      ctx.stroke();
    });

    if (WORDMARK_IN_GLASS && wordReady) drawWordmark(ctx, cx, cy, r);
  }

  function initGlass() {
    var hero = document.querySelector('[data-hero]');
    var stage = document.querySelector('[data-glass-stage]');
    var canvas = document.querySelector('[data-glass-canvas]');
    var grab = document.querySelector('[data-glass-grab]');
    var toggle = document.querySelector('[data-motion-toggle]');
    if (!stage || !canvas) return;

    var setState = function (state) { stage.setAttribute('data-motion-state', state); };
    var live = false;

    // 모바일(720px 이하): 고리 중심을 헤더 높이의 절반만큼 올려 처음 연 화면(헤더 포함) 한가운데에 둔다 — layout.css --ring-lift와 같은 값
    var mobileMq = window.matchMedia('(max-width: 720px)');
    var headerEl = document.querySelector('.site-header');
    var liftOffset = function (h) {
      var lift = mobileMq.matches && headerEl ? headerEl.offsetHeight / 2 : 0;
      return (lift * 200) / Math.max(h, 1); // glass offsetY(%) = 올릴 거리 ÷ 무대 높이의 절반 × 100
    };
    var curOffset = liftOffset(canvas.clientHeight);
    var markWord = function () {
      if (hero) hero.classList.toggle('is-wordmark-drawn', WORDMARK_IN_GLASS && wordReady && live);
    };
    var fail = function () {
      live = false;
      stage.classList.add('is-fallback');
      stage.classList.remove('is-live');
      markWord();
      setState('fallback');
      if (toggle) toggle.hidden = true;
      if (aura) aura.hidden = true;
    };

    if (!window.CodeeGlassIcon || !('ResizeObserver' in window)) { fail(); return; }

    // 칸 밖 빛 층 — 배경판의 빛 · 점선 원 · 밝은 점을 헤더 밑과 About 위쪽까지 이어 그린다(layout.css .page-aura)
    var aura = document.createElement('div');
    aura.className = 'page-aura';
    aura.setAttribute('aria-hidden', 'true');
    aura.hidden = true;
    aura.innerHTML = '<svg class="page-aura__ring" focusable="false"><circle></circle></svg>';
    document.body.insertBefore(aura, document.body.firstChild);
    var auraRing = aura.querySelector('circle');
    var placeAura = function (rect) {
      var box = stage.getBoundingClientRect();
      var x = box.left + window.pageXOffset + rect.x;
      var y = box.top + window.pageYOffset + rect.y;
      aura.style.setProperty('--aura-x', x.toFixed(1) + 'px');
      aura.style.setProperty('--aura-y', y.toFixed(1) + 'px');
      aura.style.setProperty('--aura-r', rect.r.toFixed(1) + 'px');
      auraRing.setAttribute('cx', x.toFixed(1));
      auraRing.setAttribute('cy', y.toFixed(1));
      auraRing.setAttribute('r', (rect.r * 1.3).toFixed(1));
      aura.hidden = false;
    };

    var layout = function (rect) {
      var want = liftOffset(rect.height);
      if (icon && Math.abs(want - curOffset) > 0.01) {
        curOffset = want;
        icon.setOptions({ orient: { offsetY: want } }); // 다시 layout이 불린다
        return;
      }
      placeAura(rect);
      if (hero) hero.style.setProperty('--ring-d', (rect.r * 2).toFixed(1) + 'px');
      if (!grab) return;
      grab.style.left = (rect.x - rect.r) + 'px';
      grab.style.top = (rect.y - rect.r) + 'px';
      grab.style.width = (rect.r * 2) + 'px';
      grab.style.height = (rect.r * 2) + 'px';
    };

    var options = {
      shape: GLASS.shape,
      depth: GLASS.depth,
      speed: GLASS.speed,
      direction: GLASS.direction,
      background: GLASS.background,
      glass: GLASS.glass,
      size: GLASS.size,
      orient: Object.assign({}, GLASS.orient, { offsetY: curOffset }),
      plate: drawPlate,
      reduced: reduce.matches,
      dragTarget: grab,
      initialYaw: GLASS.initialYaw,
      initialPitch: GLASS.initialPitch,
      maxDpr: GLASS.maxDpr,
      onLayout: layout,
      onFirstFrame: function () { live = true; stage.classList.add('is-live'); markWord(); },
      onFail: fail
    };

    var icon = null;
    try { icon = window.CodeeGlassIcon.createGlassIcon(canvas, options); } catch (e) { icon = null; }
    if (!icon) { fail(); return; }

    // 글꼴이 준비되면 배경판에 Codee를 그린다(못 받으면 2.5초 뒤 대체 글꼴로)
    if (WORDMARK_IN_GLASS) {
      var ready = function () {
        if (wordReady) return;
        wordReady = true;
        icon.setOptions({});
        markWord();
      };
      if (document.fonts && document.fonts.load) {
        document.fonts.load('500 100px "IBM Plex Sans KR"', WORD).then(ready, ready);
        window.setTimeout(ready, 2500);
      } else {
        ready();
      }
    }

    var report = function () {
      if (reduce.matches) setState('reduced');
      else if (!icon.playing) setState('paused');
      else setState('running');
    };
    var renderToggle = function () {
      if (!toggle) return;
      toggle.hidden = reduce.matches;
      var paused = !icon.playing;
      toggle.setAttribute('data-paused', String(paused));
      toggle.setAttribute('aria-label', paused
        ? (toggle.getAttribute('data-label-play') || '배경 모션 재생')
        : (toggle.getAttribute('data-label-pause') || '배경 모션 정지'));
    };

    if (readPaused()) icon.pause();
    renderToggle();
    report();

    // 작업 화면(site.js work-viewer)이 열린 동안 유리 고리 루프를 멈추고, 닫으면 원래대로 — 저장된 정지 설정 · 버튼 표시는 그대로
    var heldByViewer = false;
    document.addEventListener('codee:viewer', function (event) {
      var opening = !!(event.detail && event.detail.open);
      if (opening && icon.playing) { heldByViewer = true; icon.pause(); }
      else if (!opening && heldByViewer) { heldByViewer = false; icon.play(); }
    });

    if (toggle) {
      toggle.addEventListener('click', function () {
        if (icon.playing) icon.pause(); else icon.play();
        savePaused(!icon.playing);
        renderToggle();
        report();
      });
    }
    onChange(reduce, function (event) {
      icon.setReduced(event.matches);
      renderToggle();
      report();
    });
  }

  var bands = window.matchMedia('(max-width: 1180px)');

  function initLinemap() {
    var map = document.querySelector('.linemap[data-motion]');
    if (!map) return;
    var LINE_DELAY = { m: 0, r: 400, d: 800 };
    var DRAW = 1200;
    var STEP = 240;
    var FADE = 160;
    var EASE = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
    var observer = null;
    var animations = [];
    var done = false;

    var finish = function (reason) {
      if (done) return;
      done = true;
      if (observer) observer.disconnect();
      observer = null;
      animations.forEach(function (a) { a.cancel(); });
      animations = [];
      map.classList.remove('is-ready');
      map.setAttribute('data-motion-state', 'done');
    };
    var fade = function (el, delay) {
      if (!el) return;
      animations.push(el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: FADE, delay: delay, easing: 'ease-out', fill: 'both' }));
    };

    var play = function () {
      if (done) return;
      if (reduce.matches) { finish('reduced-motion'); return; }
      map.setAttribute('data-motion-state', 'running');
      var wide = !bands.matches;
      ['m', 'r', 'd'].forEach(function (line) {
        var base = LINE_DELAY[line];
        var group = map.querySelector('.linemap__line.line-' + line);
        if (wide) {
          var paths = map.querySelectorAll('.linemap__path.line-' + line + (line === 'd' ? ', .linemap__path.line-d-inner' : ''));
          Array.prototype.forEach.call(paths, function (path) {
            animations.push(path.animate([{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: DRAW, delay: base, easing: EASE, fill: 'both' }));
          });
          fade(group && group.querySelector('.linemap__tag'), base);
          fade(map.querySelector('.segment-hidden.line-' + line), base + DRAW);
        }
        var items = group ? group.querySelectorAll('.linemap__stations > li') : [];
        Array.prototype.forEach.call(items, function (li, i) {
          var delay = base + i * STEP;
          fade(li, delay);
          var id = li.getAttribute('data-station');
          if (wide && id) fade(map.querySelector('[data-mark="' + id + '"]'), delay);
        });
      });
      Promise.all(animations.map(function (a) { return a.finished; }))
        .then(function () { finish('completed'); })
        .catch(function () { finish('animation-cancelled'); });
    };

    var supported = 'IntersectionObserver' in window && typeof Element.prototype.animate === 'function';
    if (reduce.matches) { finish('reduced-motion'); return; }
    if (!supported) { finish('unsupported'); return; }

    map.classList.add('is-ready');
    map.setAttribute('data-motion-state', 'waiting');
    var enough = function (r) {
      if (!r.isIntersecting) return false;
      var view = r.rootBounds ? r.rootBounds.height : window.innerHeight;
      return r.intersectionRatio >= 0.4 || r.intersectionRect.height >= view * 0.4;
    };
    observer = new IntersectionObserver(function (records) {
      if (!records.some(enough)) return;
      observer.disconnect();
      observer = null;
      window.requestAnimationFrame(play);
    }, { threshold: Array.from({ length: 41 }, function (_, i) { return i / 100; }) });
    observer.observe(map);
    onChange(reduce, function (event) { if (event.matches) finish('reduced-motion'); });
    onChange(bands, function () { finish('layout-change'); });
  }

  initGlass();
  initLinemap();
})();
