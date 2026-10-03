/* Kshanam — shared behaviour for every page.
 *
 * Nothing here is required to read the site: css/base.css only applies its
 * JS-dependent states under the .js class that <head> sets, so with this file
 * blocked the pages render fully, the FAQ sits open and the navigation is a
 * plain list. Each block below also no-ops when its markup is absent, so one
 * file is safe to load everywhere.
 */
(function () {
  'use strict';

  var doc = document;
  var reduceMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- header: solid once the page has moved ---------- */

  (function header() {
    var el = doc.getElementById('site-header');
    if (!el) return;
    var ticking = false;
    function apply() {
      el.classList.toggle('is-stuck', window.scrollY > 8);
      ticking = false;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; window.requestAnimationFrame(apply); }
    }, { passive: true });
    apply();
  })();

  /* ---------- mobile navigation ---------- */

  (function nav() {
    var header = doc.getElementById('site-header');
    var toggle = header && header.querySelector('.nav-toggle');
    var panel = doc.getElementById('site-nav');
    if (!header || !toggle || !panel) return;

    function setOpen(open) {
      header.classList.toggle('is-open', open);
      doc.body.classList.toggle('nav-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.querySelector('.nav-toggle-label').textContent = open ? 'Close' : 'Menu';
    }

    toggle.addEventListener('click', function () {
      setOpen(toggle.getAttribute('aria-expanded') !== 'true');
    });

    // Following a link inside the panel navigates; on a same-page anchor
    // nothing would otherwise close the panel over the content.
    panel.addEventListener('click', function (e) {
      if (e.target.closest('a')) setOpen(false);
    });

    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && header.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    // Rotating to a wide viewport leaves the panel styles behind; drop the
    // open state so the desktop navigation is not stuck behind a scroll lock.
    window.addEventListener('resize', function () {
      if (window.innerWidth > 860 && header.classList.contains('is-open')) setOpen(false);
    });
  })();

  /* ---------- scroll reveal ---------- */

  (function reveal() {
    var items = [].slice.call(doc.querySelectorAll('[data-reveal]'));
    if (!items.length) return;

    function showAll() {
      items.forEach(function (el) { el.classList.add('is-revealed'); });
    }
    if (reduceMotion || !('IntersectionObserver' in window)) { showAll(); return; }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        // Siblings that come into view together cascade rather than all
        // arriving on the same frame.
        var group = el.parentNode ? [].slice.call(
          el.parentNode.querySelectorAll(':scope > [data-reveal]')) : [];
        var i = group.indexOf(el);
        el.style.transitionDelay = (i > 0 ? Math.min(i, 5) * 80 : 0) + 'ms';
        el.classList.add('is-revealed');
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

    items.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- gallery filters ---------- */

  (function filters() {
    var bar = doc.querySelector('.gallery-filters');
    var gallery = doc.getElementById('gallery');
    if (!bar || !gallery) return null;

    var buttons = [].slice.call(bar.querySelectorAll('.filter'));
    var shots = [].slice.call(gallery.querySelectorAll('.shot'));
    var valid = {};
    buttons.forEach(function (b) { valid[b.getAttribute('data-filter')] = true; });

    function apply(value, scroll) {
      if (!valid[value]) value = 'all';
      buttons.forEach(function (b) {
        var on = b.getAttribute('data-filter') === value;
        b.classList.toggle('is-active', on);
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      shots.forEach(function (fig) {
        var show = value === 'all' || fig.getAttribute('data-collection') === value;
        fig.hidden = !show;
      });
      if (scroll) {
        gallery.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
      }
      return value;
    }

    bar.addEventListener('click', function (e) {
      var btn = e.target.closest('.filter');
      if (!btn) return;
      var value = apply(btn.getAttribute('data-filter'), false);
      // Keep the address bar shareable without adding a history entry per click.
      var hash = value === 'all' ? ' ' : '#' + value;
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', value === 'all'
          ? location.pathname + location.search
          : hash);
      }
    });

    function fromHash(scroll) {
      var value = (location.hash || '').replace('#', '');
      if (value && valid[value]) apply(value, scroll);
    }
    fromHash(true);
    window.addEventListener('hashchange', function () { fromHash(true); });
  })();

  /* ---------- lightbox ---------- */

  (function lightbox() {
    var links = [].slice.call(doc.querySelectorAll('.shot-link'));
    if (!links.length) return;

    var box, imgEl, capEl, countEl, closeBtn, index = -1, lastFocus = null;

    function sequence() {
      // Only what is on screen: a filtered-out photograph should not appear
      // when paging through the ones that are.
      return links.filter(function (a) {
        var fig = a.closest('.shot');
        return !(fig && fig.hidden);
      });
    }

    function build() {
      box = doc.createElement('div');
      box.className = 'lightbox';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      box.setAttribute('aria-label', 'Photograph viewer');
      box.innerHTML =
        '<button type="button" class="lightbox-btn lightbox-close" aria-label="Close viewer">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5l14 14M19 5L5 19"/></svg></button>' +
        '<button type="button" class="lightbox-btn lightbox-prev" aria-label="Previous photograph">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 4l-8 8 8 8"/></svg></button>' +
        '<button type="button" class="lightbox-btn lightbox-next" aria-label="Next photograph">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4l8 8-8 8"/></svg></button>' +
        '<figure><img alt="" /><figcaption></figcaption></figure>' +
        '<p class="lightbox-count" aria-hidden="true"></p>';
      doc.body.appendChild(box);

      imgEl = box.querySelector('img');
      capEl = box.querySelector('figcaption');
      countEl = box.querySelector('.lightbox-count');
      closeBtn = box.querySelector('.lightbox-close');

      closeBtn.addEventListener('click', close);
      box.querySelector('.lightbox-prev').addEventListener('click', function () { step(-1); });
      box.querySelector('.lightbox-next').addEventListener('click', function () { step(1); });
      box.addEventListener('click', function (e) {
        if (e.target === box) close();
      });
    }

    function show(i) {
      var list = sequence();
      if (!list.length) return;
      index = (i + list.length) % list.length;
      var a = list[index];
      var src = a.getAttribute('href');
      var caption = a.getAttribute('data-caption') || '';
      var inner = a.querySelector('img');

      imgEl.setAttribute('src', src);
      imgEl.setAttribute('alt', inner ? inner.getAttribute('alt') : caption);
      if (inner) {
        imgEl.setAttribute('width', inner.getAttribute('width'));
        imgEl.setAttribute('height', inner.getAttribute('height'));
      }
      capEl.textContent = caption;
      countEl.textContent = (index + 1) + ' / ' + list.length;
      box.classList.toggle('is-single', list.length < 2);
    }

    function step(delta) { show(index + delta); }

    function open(i) {
      if (!box) build();
      lastFocus = doc.activeElement;
      show(i);
      doc.body.classList.add('lightbox-open');
      box.classList.add('is-open');
      closeBtn.focus();
    }

    function close() {
      if (!box) return;
      box.classList.remove('is-open');
      doc.body.classList.remove('lightbox-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        // Let a modified click open the file in a new tab, as any link would.
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        open(sequence().indexOf(a));
      });
    });

    doc.addEventListener('keydown', function (e) {
      if (!box || !box.classList.contains('is-open')) return;
      if (e.key === 'Escape') { e.preventDefault(); close(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
      else if (e.key === 'Tab') {
        // Keep focus inside the dialog while it is the only thing on screen.
        var focusable = [].slice.call(
          box.querySelectorAll('button:not([hidden])')).filter(function (b) {
            return b.offsetParent !== null;
          });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  })();

  /* ---------- FAQ accordion ---------- */

  (function faq() {
    var questions = [].slice.call(doc.querySelectorAll('.faq-question'));
    if (!questions.length) return;

    function panelOf(btn) { return doc.getElementById(btn.getAttribute('aria-controls')); }

    questions.forEach(function (btn) {
      var panel = panelOf(btn);
      if (!panel) return;
      btn.addEventListener('click', function () {
        var open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', open ? 'false' : 'true');
        panel.style.maxHeight = open ? '' : panel.scrollHeight + 'px';
      });
    });

    // An open answer's natural height changes when the text reflows.
    var t;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        questions.forEach(function (btn) {
          if (btn.getAttribute('aria-expanded') !== 'true') return;
          var panel = panelOf(btn);
          if (panel) { panel.style.maxHeight = 'none'; panel.style.maxHeight = panel.scrollHeight + 'px'; }
        });
      }, 150);
    });
  })();

  /* ---------- enquiry form ---------- */

  (function enquiry() {
    var form = doc.getElementById('enquiry');
    if (!form) return;

    var status = form.querySelector('.form-status');
    var mailto = form.getAttribute('data-mailto');

    // A package link (contact.html?package=full-wedding) should arrive with
    // the right occasion already chosen and say what it is about.
    var params = new URLSearchParams(location.search);
    var pkg = params.get('package');
    if (pkg) {
      var map = {
        'wedding-day': 'Wedding',
        'full-wedding': 'Wedding',
        'portraits': 'Portrait sitting',
        'editorial': 'Editorial or brand'
      };
      var occasion = form.querySelector('#occasion');
      if (occasion && map[pkg]) {
        [].slice.call(occasion.options).forEach(function (o) {
          if (o.text === map[pkg]) occasion.value = o.value || o.text;
        });
      }
      var note = doc.querySelector('[data-package-note]');
      if (note) {
        note.textContent = 'Enquiring about: ' + pkg.replace(/-/g, ' ') + '.';
        note.hidden = false;
      }
    }

    function fieldOf(input) { return input.closest('.field'); }

    function setError(input, message) {
      var field = fieldOf(input);
      if (!field) return;
      field.classList.toggle('has-error', !!message);
      var slot = field.querySelector('.field-error');
      if (slot) slot.textContent = message || '';
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }

    function validate() {
      var problems = [];
      var checks = [
        ['name', function (v) { return v.length >= 2; }, 'Please tell us what to call you.'],
        ['email', function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v); }, 'That email address does not look right.'],
        ['message', function (v) { return v.length >= 10; }, 'A line or two about the day is enough to start.']
      ];
      checks.forEach(function (c) {
        var input = form.querySelector('#' + c[0]);
        if (!input) return;
        var ok = c[1](input.value.trim());
        setError(input, ok ? '' : c[2]);
        if (!ok) problems.push(input);
      });
      return problems;
    }

    ['name', 'email', 'message'].forEach(function (id) {
      var input = form.querySelector('#' + id);
      if (!input) return;
      input.addEventListener('blur', function () {
        if (input.value.trim()) validate();
      });
      input.addEventListener('input', function () {
        if (fieldOf(input).classList.contains('has-error')) validate();
      });
    });

    form.addEventListener('submit', function (e) {
      var problems = validate();
      if (problems.length) {
        e.preventDefault();
        status.textContent = 'Please check the highlighted fields.';
        problems[0].focus();
        return;
      }
      status.textContent = '';

      // With no form endpoint configured (see FORM_ENDPOINT in build.py) the
      // enquiry is handed to the visitor's mail client instead of being
      // silently dropped by a form that posts nowhere.
      if (mailto && !form.getAttribute('action')) {
        e.preventDefault();
        var get = function (id) {
          var el = form.querySelector('#' + id);
          return el ? el.value.trim() : '';
        };
        var body = [
          'Name: ' + get('name'),
          'Email: ' + get('email'),
          'Occasion: ' + get('occasion'),
          'Date: ' + get('dates'),
          'Where: ' + get('place'),
          '',
          get('message')
        ].join('\n');
        window.location.href = 'mailto:' + mailto +
          '?subject=' + encodeURIComponent('Enquiry from the website: ' + get('occasion')) +
          '&body=' + encodeURIComponent(body);
        status.textContent = 'Opening your mail app with the enquiry ready to send. ' +
          'If nothing happens, write to ' + mailto + ' directly.';
      }
    });
  })();
})();
