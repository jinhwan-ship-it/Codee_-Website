/* Codee — 사이트 기본 동작 */
(function () {
  'use strict';

  // 이 파일이 있는 폴더(국 · 영 상대 경로 모두) — 처음 열 때만 불러오는 스크립트의 주소에 쓴다
  var scriptBase = ((document.currentScript && document.currentScript.src) || '').replace(/[^/]*$/, '');

  /* ---------- 헤더 바탕 — 첫 화면 위에서는 투명, 첫 화면을 지나거나 메뉴가 열리면 반투명(.is-solid) ---------- */
  var header = document.querySelector('[data-header]');
  var heroEl = document.querySelector('[data-hero]');
  var syncHeader = function () {};
  if (header && !heroEl) header.classList.add('is-solid');
  if (header && heroEl) {
    var headerTick = false;
    var heroLow = heroEl.querySelectorAll('.hero__lead, .hero__links, .motion-toggle');
    var applyHeader = function () {
      headerTick = false;
      var menuOpen = !!document.querySelector('[data-menu].is-open');
      // 첫 화면 아래쪽 글자 · 버튼이 헤더에 닿는 순간부터 불투명 — 헤더 글자와 겹쳐 보이지 않게
      var edge = header.offsetHeight;
      var reached = heroEl.getBoundingClientRect().bottom <= edge;
      Array.prototype.forEach.call(heroLow, function (el) {
        if (el.getClientRects().length && el.getBoundingClientRect().top <= edge) reached = true;
      });
      header.classList.toggle('is-solid', menuOpen || reached);
    };
    syncHeader = function () {
      if (headerTick) return;
      headerTick = true;
      window.requestAnimationFrame(applyHeader);
    };
    window.addEventListener('scroll', syncHeader, { passive: true });
    window.addEventListener('resize', syncHeader);
    applyHeader();
  }

  /* ---------- 모바일 메뉴 ---------- */
  var menuToggle = document.querySelector('[data-menu-toggle]');
  var menu = document.querySelector('[data-menu]');
  if (menuToggle && menu) {
    var menuLabel = menuToggle.querySelector('.menu-toggle__label');
    var setMenu = function (open) {
      menuToggle.setAttribute('aria-expanded', String(open));
      menu.classList.toggle('is-open', open);
      syncHeader();
      if (menuLabel) {
        menuLabel.textContent = open
          ? (menuToggle.getAttribute('data-label-close') || '닫기')
          : (menuToggle.getAttribute('data-label-open') || '메뉴');
      }
    };
    menuToggle.addEventListener('click', function () {
      setMenu(menuToggle.getAttribute('aria-expanded') !== 'true');
    });
    menu.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuToggle.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuToggle.focus();
      }
    });
    var wide = window.matchMedia('(min-width: 721px)');
    var onWide = function (event) { if (event.matches) setMenu(false); };
    if (wide.addEventListener) wide.addEventListener('change', onWide);
    else if (wide.addListener) wide.addListener(onWide);
  }

  /* ---------- How I Work 단계 탭 ---------- */
  var tablist = document.querySelector('[data-tabs]');
  if (tablist) {
    var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
    var flow = tablist.closest('[data-flow]');
    var select = function (index, focus) {
      tabs.forEach(function (tab, i) {
        var selected = i === index;
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        tab.classList.toggle('is-passed', i < index);
        if (panel) {
          if (selected && panel.hidden) {
            panel.hidden = false;
            panel.classList.remove('is-entering');
            void panel.offsetWidth;
            panel.classList.add('is-entering');
          } else if (!selected) {
            panel.hidden = true;
            panel.classList.remove('is-entering');
          }
        }
      });
      if (flow) flow.style.setProperty('--flow-progress', String(index / (tabs.length - 1)));
      if (focus) tabs[index].focus();
    };
    tabs.forEach(function (tab, i) {
      tab.addEventListener('click', function () { select(i, false); });
      tab.addEventListener('keydown', function (event) {
        var next = null;
        var vertical = window.matchMedia('(max-width: 720px)').matches;
        if (event.key === 'ArrowRight' || (vertical && event.key === 'ArrowDown')) next = (i + 1) % tabs.length;
        else if (event.key === 'ArrowLeft' || (vertical && event.key === 'ArrowUp')) next = (i - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        if (next === null) return;
        event.preventDefault();
        select(next, true);
      });
    });
    // 탭을 바꿔도 아래 내용이 들썩이지 않게: 패널 영역 높이를 가장 긴 패널에 맞춘다
    var panelBox = document.querySelector('.flow-panels');
    var fitPanels = function () {
      if (!panelBox) return;
      var max = 0;
      tabs.forEach(function (tab) {
        var panel = document.getElementById(tab.getAttribute('aria-controls'));
        if (!panel) return;
        var was = panel.hidden;
        panel.hidden = false;
        max = Math.max(max, panel.offsetHeight);
        panel.hidden = was;
      });
      panelBox.style.minHeight = max ? max + 'px' : '';
    };
    var fitTimer = 0;
    window.addEventListener('resize', function () { window.clearTimeout(fitTimer); fitTimer = window.setTimeout(fitPanels, 150); });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitPanels);
    fitPanels();
    var initial = tabs.findIndex(function (tab) { return tab.getAttribute('aria-selected') === 'true'; });
    select(initial < 0 ? 0 : initial, false);
    tabs.forEach(function (tab) {
      var panel = document.getElementById(tab.getAttribute('aria-controls'));
      if (panel) panel.classList.remove('is-entering');
    });
  }

  /* ---------- Selected Work 스와이프 스택 (Originkit Swipe Stack 값을 바닐라로) ---------- */
  (function () {
    var stack = document.querySelector('[data-stack]');
    var stage = stack ? stack.closest('[data-stack-stage]') : null;
    if (stack && stage) {
      var items = Array.prototype.slice.call(stack.children);
      var count = items.length;
      var order = items.map(function (_, i) { return i; });
      var nav = stage.querySelector('[data-stack-nav]');
      var current = stage.querySelector('[data-stack-current]');
      var status = stage.querySelector('[data-stack-status]');
      var THRESHOLD = 50;   // swipeThreshold
      var ELASTIC = 0.7;    // dragElastic
      var TILT_START = 0;   // tiltAngleStart
      var cssNum = function (name) { return parseFloat(window.getComputedStyle(stage).getPropertyValue(name)) || 0; };
      var pad = function (v) { return (v < 10 ? '0' : '') + v; };

      var layout = function () {
        var unit = Math.max(1, stack.offsetWidth / cssNum('--card-w')); // 디자인 1px의 실제 크기(1440 이하 = 1)
        var xOffset = cssNum('--stack-x') * unit;
        var tilt = cssNum('--stack-tilt');
        order.forEach(function (k, i) {
          var t = count > 1 ? i / (count - 1) : 0;
          var card = items[k];
          card.style.zIndex = String(count - i);
          card.style.transform =
            'translate3d(' + (t * xOffset).toFixed(1) + 'px,' + (-i * 8 * unit).toFixed(1) + 'px,' + (-i * 10 * unit).toFixed(1) + 'px)' +
            ' scale(' + (1 - i * 0.05).toFixed(3) + ')' +
            ' rotate(' + (TILT_START + t * (tilt - TILT_START)).toFixed(2) + 'deg)';
          card.classList.toggle('is-top', i === 0);
        });
        if (current) current.textContent = pad(order[0] + 1);
      };
      var announce = function () {
        var title = items[order[0]].querySelector('.work-card__title');
        if (status && title) status.textContent = title.textContent;
      };
      var next = function () { order.push(order.shift()); layout(); };
      var prev = function () { order.unshift(order.pop()); layout(); };
      var toFront = function (k) {
        var guard = count;
        while (order[0] !== k && guard--) order.push(order.shift());
        layout();
      };
      var focusTop = function () {
        var link = items[order[0]].querySelector('a, button');
        if (link) link.focus({ preventScroll: true });
      };

      // 끌기: 맨 위 카드만. 5px 넘게 움직이면 끌기로 보고 링크 클릭을 막는다.
      var drag = null;
      var suppressClick = false;
      stack.addEventListener('pointerdown', function (event) {
        suppressClick = false; // 터치 스와이프 · 스크롤 뒤에는 click이 오지 않아 남아 있을 수 있다 — 새 손가락마다 지움
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        var card = event.target.closest('.work-card');
        if (!card) return;
        var k = items.indexOf(card);
        if (k !== order[0]) {
          // 뒤 카드를 누르면 앞으로 — 끌기 대신 쓸 수 있는 한 번 누르기
          event.preventDefault();
          suppressClick = true;
          toFront(k);
          announce();
          return;
        }
        drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0, card: card, moved: false };
      });
      stack.addEventListener('pointermove', function (event) {
        if (!drag || event.pointerId !== drag.id) return;
        drag.dx = event.clientX - drag.x;
        drag.dy = event.clientY - drag.y;
        if (!drag.moved && Math.sqrt(drag.dx * drag.dx + drag.dy * drag.dy) > 5) {
          drag.moved = true;
          try { drag.card.setPointerCapture(drag.id); } catch (e) { /* noop */ }
          drag.card.classList.add('is-dragging');
          drag.card.style.zIndex = '1000';
        }
        if (drag.moved) {
          drag.card.style.transform = 'translate3d(' + (drag.dx * ELASTIC).toFixed(1) + 'px,' + (drag.dy * ELASTIC).toFixed(1) + 'px,0) scale(1.05) rotate(' + TILT_START + 'deg)';
        }
      });
      var endDrag = function (event) {
        if (!drag || (event && event.pointerId !== drag.id)) return;
        var d = drag;
        drag = null;
        if (!d.moved) return;
        suppressClick = true;
        d.card.classList.remove('is-dragging');
        if (Math.sqrt(d.dx * d.dx + d.dy * d.dy) > THRESHOLD) { next(); announce(); }
        else layout();
      };
      stack.addEventListener('pointerup', endDrag);
      stack.addEventListener('pointercancel', endDrag);
      stack.addEventListener('click', function (event) {
        // 키보드 · 스크립트 click(detail 0)은 끌기와 무관하므로 막지 않는다
        if (suppressClick && event.detail) { event.preventDefault(); event.stopPropagation(); }
        suppressClick = false;
      }, true);
      stack.addEventListener('dragstart', function (event) { event.preventDefault(); });

      // 키보드: 카드 링크에 초점이 가면 그 카드를 앞으로, 좌우 화살표로 넘기기
      stack.addEventListener('focusin', function (event) {
        var card = event.target.closest('.work-card');
        var k = items.indexOf(card);
        if (k > -1 && k !== order[0]) toFront(k);
      });
      stack.addEventListener('keydown', function (event) {
        if (event.key === 'ArrowRight') { event.preventDefault(); next(); announce(); focusTop(); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); prev(); announce(); focusTop(); }
      });

      var prevBtn = stage.querySelector('[data-stack-prev]');
      var nextBtn = stage.querySelector('[data-stack-next]');
      if (prevBtn) prevBtn.addEventListener('click', function () { prev(); announce(); });
      if (nextBtn) nextBtn.addEventListener('click', function () { next(); announce(); });
      if (nav) nav.hidden = false;

      var stackTimer = 0;
      window.addEventListener('resize', function () { window.clearTimeout(stackTimer); stackTimer = window.setTimeout(layout, 120); });
      layout();
      window.requestAnimationFrame(function () { window.requestAnimationFrame(function () { stack.classList.add('is-ready'); }); });
    }
  })();

  /* ---------- 작업 화면(work-viewer) — 카드를 누르면 여는 전체 화면. 피치덱이 있으면 원스크롤 뷰어, 없으면 "Still Loading" ---------- */
  (function () {
    var viewers = {};
    Array.prototype.forEach.call(document.querySelectorAll('[data-viewer]'), function (el) {
      viewers[el.getAttribute('data-viewer')] = el;
    });
    if (!Object.keys(viewers).length) return;

    // 피치덱이 없는 화면의 가운데 모션 — 처음 열 때 불러오고(첫 로드에는 받지 않음), 열 때마다 mount, 닫을 때 destroy
    var MOTION = { src: 'origami-loop.js', api: 'CodeeOrigamiLoop', distance: 8 };
    var PREF_KEY = 'codee.heroMotionPaused'; // motion.js 첫 화면 정지 버튼과 같은 설정
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var heroPaused = function () { try { return window.localStorage.getItem(PREF_KEY) === '1'; } catch (e) { return false; } };
    var loaders = {};
    var load = function (src) {
      if (!loaders[src]) {
        loaders[src] = new Promise(function (resolve, reject) {
          var tag = document.createElement('script');
          tag.src = scriptBase + src;
          tag.onload = resolve;
          tag.onerror = function () { delete loaders[src]; tag.remove(); reject(); };
          document.head.appendChild(tag);
        });
      }
      return loaders[src];
    };

    var root = document.documentElement;
    var active = null;
    var focusables = function (el) {
      return Array.prototype.filter.call(el.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'), function (n) {
        return !n.disabled && n.getClientRects().length > 0;
      });
    };

    var openViewer = function (slug, opts) {
      var el = viewers[slug];
      if (!el || active) return;
      opts = opts || {};
      var still = reduce.matches || heroPaused();
      var state = { slug: slug, el: el, trigger: opts.trigger || null, pushed: false, motion: null, inert: [] };
      active = state;

      // 뒤 페이지: 스크롤 잠금(스크롤바 폭만큼 메워 들썩임 없이) + inert
      root.style.setProperty('--viewer-gap', Math.max(0, window.innerWidth - root.clientWidth) + 'px');
      root.classList.add('is-viewer-open');
      Array.prototype.forEach.call(document.body.children, function (n) {
        if (n === el || n.tagName === 'SCRIPT' || n.hasAttribute('inert')) return;
        n.setAttribute('inert', '');
        state.inert.push(n);
      });

      el.classList.toggle('is-instant', still);
      el.hidden = false;
      el.scrollTop = 0;
      if (!still) void el.offsetWidth;
      el.classList.add('is-open');
      // 덱은 덱에 초점을 둬 바로 화살표 · PgDn으로 넘긴다(닫기는 고정 위치라 거기서는 스크롤되지 않음)
      var deck = el.querySelector('.work-viewer__deck');
      var focusFirst = deck || el.querySelector('[data-viewer-close]');
      if (deck && opts.fromHash) {
        // #주소로 바로 들어온 때는 아직 입력이 없으니 테두리 없이 초점만 — 초점이 옮겨 가면 원래대로
        deck.setAttribute('data-quiet-focus', '');
        deck.addEventListener('blur', function () { deck.removeAttribute('data-quiet-focus'); }, { once: true });
      }
      if (focusFirst) focusFirst.focus({ preventScroll: true });

      if (opts.fromHash) {
        state.pushed = false;
      } else {
        window.history.pushState({ viewer: slug }, '', '#' + slug);
        state.pushed = true;
      }
      document.dispatchEvent(new CustomEvent('codee:viewer', { detail: { open: true, slug: slug } }));

      var stage = el.querySelector('[data-viewer-stage]');
      if (stage) {
        load(MOTION.src).then(function () {
          var api = window[MOTION.api];
          if (active !== state || !api) return;
          // WebGL을 못 쓰면 null — 모션 자리는 비우고 Still Loading만(레이아웃 그대로)
          state.motion = api.mount(stage, { distance: MOTION.distance, still: reduce.matches || heroPaused() });
        }, function () { /* 못 불러오면 모션 없이 */ });
      }
    };

    // 열린 채로 동작 줄이기를 켜거나 끄면 그 자리에서 정지 장면 ↔ 움직임으로 다시 그린다
    var remountMotion = function () {
      if (!active) return;
      var still = reduce.matches || heroPaused();
      active.el.classList.toggle('is-instant', still);
      var stage = active.el.querySelector('[data-viewer-stage]');
      var api = window[MOTION.api];
      if (!stage || !active.motion || !api) return;
      active.motion.destroy();
      active.motion = api.mount(stage, { distance: MOTION.distance, still: still });
    };
    if (reduce.addEventListener) reduce.addEventListener('change', remountMotion);

    var closeViewer = function (fromHistory) {
      var state = active;
      if (!state) return;
      active = null;
      var el = state.el;
      if (state.motion) { state.motion.destroy(); state.motion = null; }

      var instant = el.classList.contains('is-instant');
      el.classList.remove('is-open');
      var hide = function () { if (active !== state && !el.classList.contains('is-open')) el.hidden = true; };
      if (instant) hide();
      else window.setTimeout(hide, parseFloat(window.getComputedStyle(el).transitionDuration) * 1000 || 0);

      state.inert.forEach(function (n) { n.removeAttribute('inert'); });
      root.classList.remove('is-viewer-open');
      root.style.removeProperty('--viewer-gap');
      var back = state.trigger || document.querySelector('[data-viewer-open="' + state.slug + '"]');
      if (back) back.focus({ preventScroll: true });
      document.dispatchEvent(new CustomEvent('codee:viewer', { detail: { open: false, slug: state.slug } }));

      if (!fromHistory) {
        // 연 뒤 생긴 기록은 되돌리고, #주소로 바로 들어왔으면 주소만 지워 사이트 밖으로 나가지 않는다
        if (state.pushed) window.history.back();
        else window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    };

    document.addEventListener('click', function (event) {
      var opener = event.target.closest('[data-viewer-open]');
      if (opener) { event.preventDefault(); openViewer(opener.getAttribute('data-viewer-open'), { trigger: opener }); return; }
      if (active && event.target.closest('[data-viewer-close]')) closeViewer(false);
    });
    document.addEventListener('keydown', function (event) {
      if (!active) return;
      if (event.key === 'Escape') { event.preventDefault(); closeViewer(false); return; }
      if (event.key !== 'Tab') return;
      // 초점은 화면 안에서만 돈다
      var list = focusables(active.el);
      if (!list.length) { event.preventDefault(); return; }
      var first = list[0], last = list[list.length - 1];
      if (event.shiftKey && (document.activeElement === first || !active.el.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !active.el.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    });
    window.addEventListener('popstate', function () {
      var slug = window.location.hash.slice(1);
      if (active && slug !== active.slug) closeViewer(true);
      if (!active && viewers[slug]) openViewer(slug, { fromHash: true });
    });
    var startSlug = window.location.hash.slice(1);
    if (viewers[startSlug]) openViewer(startSlug, { fromHash: true });
  })();

  /* ---------- About 사진 커버플로 ---------- */
  (function () {
    var gallery = document.querySelector('[data-gallery]');
    if (gallery) {
      var cards = Array.prototype.slice.call(gallery.querySelectorAll('[data-gallery-card]'));
      var n = cards.length;
      var active = 0;
      var place = function () {
        cards.forEach(function (card, i) {
          var o = i - active;
          if (o > n / 2) o -= n;
          if (o < -n / 2) o += n;
          card.setAttribute('data-pos', String(Math.max(-2, Math.min(2, o))));
        });
      };
      var go = function (step) { active = (active + step + n) % n; place(); };
      cards.forEach(function (card, i) {
        card.addEventListener('click', function () {
          if (swiped) { swiped = false; return; }
          if (i !== active) { active = i; place(); }
        });
      });
      var startX = null;
      var swiped = false;
      gallery.addEventListener('pointerdown', function (event) { swiped = false; startX = event.clientX; });
      gallery.addEventListener('pointerup', function (event) {
        if (startX === null) return;
        var dx = event.clientX - startX;
        startX = null;
        if (Math.abs(dx) > 40) { swiped = true; go(dx < 0 ? 1 : -1); }
      });
      gallery.addEventListener('pointercancel', function () { startX = null; });
      if (n) place();
    }
  })();

  /* ---------- 이미지 자리 ---------- */
  Array.prototype.forEach.call(document.querySelectorAll('img[data-slot]'), function (img) {
    var holder = img.closest('[data-thumb]');
    if (!holder) return;
    var empty = function () { holder.classList.add('is-empty'); };
    var filled = function () { holder.classList.remove('is-empty'); };
    if (img.complete) {
      if (img.naturalWidth === 0) empty(); else filled();
    }
    img.addEventListener('error', empty);
    img.addEventListener('load', filled);
  });

  /* ---------- 현재 구역 표시(헤더 메뉴) ---------- */
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('[data-nav]'));
  if ('IntersectionObserver' in window && navLinks.length) {
    var byId = {};
    navLinks.forEach(function (link) { byId[link.getAttribute('href').slice(1)] = link; });
    var current = null;
    var observer = new IntersectionObserver(function (records) {
      records.forEach(function (record) {
        if (!record.isIntersecting) {
          if (current === record.target.id) { current = null; }
          return;
        }
        current = record.target.id;
      });
      navLinks.forEach(function (link) {
        link.classList.toggle('is-current', link.getAttribute('href') === '#' + current);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('main > section[id]').forEach(function (section) { observer.observe(section); });
  }
})();
