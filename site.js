/* site.js — shared page chrome: header, mascot, side nav, toggle bar.
   Needs data.js loaded first (for the topic links and the random-node box). */

(function () {
  'use strict';

  // ---------- edit these ----------
  const SITE = {
    name: "Jaron's personal w(o)e(r)b(l)s(d)(v)i)t(e(w) ",
        pages: {
      home:  { text: 'every belief has to show its work',
               frames: ['(o_o)', '(o_O)', '(o_o)', '(-_-)'] },
      tree:  { text: 'pick a branch, read the argument, then read the objection',
               frames: ['  |  ', ' \\|  ', ' \\|/ ', '\\\\|//'] },
      about: { text: 'the person behind the arguments',
               frames: ['(._.)', '(.-.)', '(.o.)', '(.-.)'] }
    },
    nav: [['home', 'index.html'], ['tree', 'tree.html'], ['about', 'about.html']]
  };

  const MOTH = [
    ['  \\\\    //  ', ' .-\\\\()//-. ', '(__/ || \\__)', '    \\/    '],
    ['   \\\\  //   ', '  ._\\\\//_.  ', ' (__/||\\__) ', '     \\/     ']
  ];

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---------- tiny helpers ----------
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v);
    }
    kids.flat().forEach(k => { if (k != null && k !== false) e.append(k); });
    return e;
  }

  const pref = {
    get(k, d) {
      try { const v = localStorage.getItem('wv_' + k); return v === null ? !!d : v === 'true'; }
      catch (e) { return !!d; }
    },
    set(k, v) { try { localStorage.setItem('wv_' + k, String(v)); } catch (e) { /* ignore */ } }
  };

  // ---------- tree helpers (shared with home + nav) ----------
  function flatten(node, path, out) {
    (node.children || []).forEach(c => {
      const p = path.concat(c.id);
      out.push({ path: p, node: c });
      flatten(c, p, out);
    });
    return out;
  }
  const ALL = typeof TREE !== 'undefined' ? flatten(TREE, [], []) : [];

  const VERDICT = {
    accepted:   { mark: '[+]', cls: 'v-ok' },
    unresolved: { mark: '[?]', cls: 'v-warn' },
    rejected:   { mark: '[x]', cls: 'v-bad' }
  };

  function vmark(verdict) {
    const v = VERDICT[verdict];
    if (!v) return null;
    const f = document.createDocumentFragment();
    f.append(el('span', { class: 'vmark ' + v.cls, 'aria-hidden': 'true', title: verdict, text: v.mark }),
             el('span', { class: 'sr-only', text: ' ' + verdict }));
    return f;
  }

  function truncate(s, n) {
    s = String(s || '');
    return s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s;
  }

  // ---------- header + mascot ----------
  const page = document.body.dataset.page || 'home';
  const cfg = SITE.pages[page] || SITE.pages.home;

  function buildHeader() {
    const top = document.getElementById('topbar');
    if (!top) return;
    top.append(
      el('h1', { class: 'logo' },
        el('a', { href: 'index.html' }, el('span', { id: 'rainbow', text: SITE.name })),
        ' ', el('span', { class: 'glyph', 'aria-hidden': 'true', text: '∴' })),
      el('div', { class: 'mini' },
        el('div', { id: 'smiley', 'aria-hidden': 'true', text: cfg.frames[0] }),
        el('div', { id: 'pathbar', text: page === 'home' ? '~/' : '~/' + page }),
        el('div', { class: 'k', text: 'now:' }),
        el('div', { id: 'nowline', class: 'slate', text: cfg.text })
      )
    );

    if (!REDUCED) {
      let i = 0;
      setInterval(() => {
        i = (i + 1) % cfg.frames.length;
        document.getElementById('smiley').textContent = cfg.frames[i];
      }, 500);
    }
  }

  function buildMascot() {
    const cell = document.getElementById('mascot');
    if (!cell) return;
    const pre = el('pre', { id: 'moth', 'aria-hidden': 'true', text: MOTH[0].join('\n') });
    cell.append(el('a', { href: 'index.html', title: 'moth :> (home)', 'aria-label': 'home' }, pre));
    if (!REDUCED) {
      let i = 0;
      setInterval(() => {
        i = (i + 1) % MOTH.length;
        pre.textContent = MOTH[i].join('\n');
      }, 600);
    }
  }

  // ---------- side nav ----------
  function buildNav() {
    const nav = document.getElementById('navigation');
    if (!nav) return;

    const pages = el('div', { class: 'navgrid' }, SITE.nav.map(([label, href]) =>
      el('a', { class: 'btn' + (label === page ? ' on' : ''), href, 'aria-current': label === page ? 'page' : false, text: label })));

    const topics = el('div', { class: 'topiclist' },
      (typeof TREE !== 'undefined' ? TREE.children : []).map(t =>
        el('a', { class: 'btn left', href: 'tree.html#' + t.id }, '> ' + t.id)));

    const box = el('div', { class: 'rand' });
    function roll() {
      if (!ALL.length) return;
      const i = Math.floor(Math.random() * ALL.length);
      const { path, node } = ALL[i];
      box.replaceChildren(
        el('b', { class: 'slate', text: 'node #' + (i + 1) + '/' + ALL.length }),
        el('p', { class: 'small', text: '> ' + node.title }),
        el('p', { class: 'small dim', text: truncate(node.summary, 85) }),
        el('a', { href: 'tree.html#' + path.join('/') }, '[read]'),
        ' ',
        el('button', { type: 'button', class: 'linkbtn', onclick: roll }, '[reroll]')
      );
    }
    roll();

    nav.append(
      el('h2', { class: 'lbl', text: 'pages:' }), pages,
      el('hr'),
      el('h2', { class: 'lbl', text: 'topics:' }), topics,
      el('hr'),
      el('h2', { class: 'lbl', text: 'random:' }), box,
      el('hr'),
    );
  }

  // ---------- fx bar (buttons are wired up in fx.js) ----------
  function buildFxBar() {
    const bar = document.getElementById('fxbar');
    if (!bar) return;
    bar.append(el('div', { class: 'row' },
      el('button', { type: 'button', class: 'fxbtn', id: 'toggleTime', 'aria-pressed': 'false', text: 'toggle clock' }),
      el('button', { type: 'button', class: 'fxbtn', id: 'toggleRain', 'aria-pressed': 'false', text: 'toggle rain' }),
      el('button', { type: 'button', class: 'fxbtn', id: 'toggleTrail', 'aria-pressed': 'false', text: 'toggle ∴' }),
      el('a', { class: 'fxbtn', href: 'mailto:JaronVC@proton.me', text: 'email' }),
      el('button', { type: 'button', class: 'fxbtn', id: 'toggleInvert', 'aria-pressed': 'false', text: 'toggle 🌑' }),
      el('span', { id: 'systemClock', hidden: 'hidden' })
    ));
  }

  buildHeader();
  buildMascot();
  buildNav();
  buildFxBar();

  // ---------- public API ----------
  window.Site = {
    el, pref, ALL, VERDICT, vmark, truncate, REDUCED,
    // called by the tree page whenever the selected node changes
    setStatus(pathParts, nowText) {
      const p = document.getElementById('pathbar');
      const n = document.getElementById('nowline');
      if (p) p.textContent = '~/' + (pathParts && pathParts.length ? pathParts.join('/') : 'tree');
      if (n) n.textContent = nowText || cfg.text;
    }
  };
}());