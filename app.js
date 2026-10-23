/* app.js — the argument tree.
   The URL hash is the single source of truth: #veganism/ethical/name-the-trait */

(function () {
  'use strict';

  const { el, pref, vmark, truncate } = Site;

  const GLYPH = { topic: '#', category: '/', argument: '+', objection: '!', reply: '<' };

  // ---------- state ----------
  let showObjections = pref.get('objections', true);
  const userOpen = new Set();    // branches the reader opened by hand
  const userClosed = new Set();  // branches the reader collapsed by hand

  // ---------- helpers ----------
  function hashToPath() {
    let raw = '';
    try { raw = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { raw = ''; }
    return raw ? raw.split('/') : [];
  }

  function findNode(path) {
    let node = TREE;
    for (const id of path) {
      node = (node.children || []).find(c => c.id === id);
      if (!node) return null;
    }
    return node;
  }

  const isCounter = n => n.type === 'objection' || n.type === 'reply';
  const visibleKids = n => (n.children || []).filter(c => showObjections || !isCounter(c));

  function countInside(node) {
    let n = 0;
    for (const c of visibleKids(node)) n += 1 + countInside(c);
    return n;
  }

  function tally(node, into) {
    for (const c of node.children || []) {
      into[c.type] = (into[c.type] || 0) + 1;
      tally(c, into);
    }
    return into;
  }

  function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

  // turn bare URLs in body text into links (built as DOM nodes, never as HTML)
  function linkify(text) {
    const frag = document.createDocumentFragment();
    const re = /https?:\/\/[^\s<>"')]+/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      let url = m[0], trail = '';
      const t = url.match(/[.,;:!?]+$/);
      if (t) { trail = t[0]; url = url.slice(0, -trail.length); }
      frag.append(text.slice(last, m.index));
      frag.append(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', text: url }));
      if (trail) frag.append(trail);
      last = m.index + m[0].length;
    }
    frag.append(text.slice(last));
    return frag;
  }

  // ---------- sidebar ----------
  function isOpen(key, ancestors) {
    if (userClosed.has(key)) return false;
    return userOpen.has(key) || ancestors.has(key);
  }

  function buildList(node, parent, current, ancestors) {
    const ul = el('ul');
    for (const child of visibleKids(node)) {
      const path = parent.concat(child.id);
      const key = path.join('/');
      const kids = visibleKids(child);
      const open = kids.length > 0 && isOpen(key, ancestors);
      const selected = key === current.join('/');

      const row = el('div', { class: 'trow' });
      if (kids.length) {
        row.append(el('button', {
          type: 'button', class: 'caret',
          'aria-expanded': String(open),
          'aria-label': (open ? 'collapse ' : 'expand ') + child.title,
          text: open ? '▾' : '▸',
          onclick() {
            if (open) { userOpen.delete(key); userClosed.add(key); }
            else { userClosed.delete(key); userOpen.add(key); }
            renderSidebar(hashToPath());
          }
        }));
      } else {
        row.append(el('span', { class: 'caret-pad' }));
      }

      const link = el('a', { class: 'tlink', href: '#' + key, 'aria-current': selected ? 'page' : false },
        el('span', { class: 'tg', 'aria-hidden': 'true', text: GLYPH[child.type] || '·' }),
        el('span', { class: 'sr-only', text: (child.type || 'node') + ': ' }),
        child.title,
        child.verdict ? [' ', vmark(child.verdict)] : null,
        kids.length && !open ? el('span', { class: 'count', text: '(' + countInside(child) + ')' }) : null
      );
      row.append(link);

      const li = el('li', { class: 't-' + child.type }, row);
      if (open) li.append(buildList(child, path, current, ancestors));
      ul.append(li);
    }
    return ul;
  }

  function renderSidebar(current) {
    const box = document.getElementById('sidebar');
    if (!box) return;
    const keep = box.scrollTop;
    const ancestors = new Set(current.map((_, i) => current.slice(0, i + 1).join('/')));
    const list = buildList(TREE, [], current, ancestors);
    list.classList.add('tree');
    box.replaceChildren(list);
    box.scrollTop = keep;

    // keep the selected row visible inside the sidebar (without moving the page)
    const sel = box.querySelector('[aria-current="page"]');
    if (sel) {
      const top = sel.offsetTop - box.offsetTop;
      if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 40) {
        box.scrollTop = Math.max(0, top - box.clientHeight / 3);
      }
    }
  }

  // ---------- content ----------
  function copyLink(btn) {
    const url = location.href;
    const done = msg => { btn.textContent = msg; setTimeout(() => { btn.textContent = '[copy link]'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => done('[copied!]'), () => window.prompt('copy this link:', url));
    } else {
      window.prompt('copy this link:', url);
    }
  }

  function kidList(node, path) {
    const kids = visibleKids(node);
    if (!kids.length) return null;
    return el('section', { class: 'kids' },
      el('h3', { class: 'lbl', text: 'in this section:' }),
      el('ul', { class: 'kidlist' }, kids.map(c => {
        const inside = countInside(c);
        return el('li', null,
          el('a', { class: 'kid t-' + c.type, href: '#' + path.concat(c.id).join('/') },
            el('span', { class: 'kid-title' },
              el('span', { class: 'tg', 'aria-hidden': 'true', text: GLYPH[c.type] || '·' }),
              el('span', { class: 'sr-only', text: (c.type || 'node') + ': ' }),
              c.title,
              c.verdict ? [' ', vmark(c.verdict)] : null,
              inside ? el('span', { class: 'count', text: '(' + inside + ' inside)' }) : null),
            c.summary ? el('span', { class: 'kid-sum', text: truncate(c.summary, 180) }) : null));
      })));
  }

  function renderContent(path) {
    const box = document.getElementById('pageContent');
    if (!box) return;
    const node = path.length ? findNode(path) : TREE;

    if (!node) {
      box.replaceChildren(
        el('h2', { class: 'node-title', text: 'no such node' }),
        el('p', null, '> nothing lives at #' + path.join('/') + ' (yet). '),
        el('a', { href: '#' }, '[back to the start]'));
      return;
    }

    // breadcrumb
    const crumbs = el('ol', { class: 'crumbs' },
      el('li', null, path.length ? el('a', { href: '#' }, 'tree') : el('span', { 'aria-current': 'page', text: 'tree' })));
    path.forEach((id, i) => {
      const n = findNode(path.slice(0, i + 1));
      const label = n ? n.title : id;
      const last = i === path.length - 1;
      crumbs.append(el('li', null, last
        ? el('span', { 'aria-current': 'page', text: label })
        : el('a', { href: '#' + path.slice(0, i + 1).join('/'), text: label })));
    });

    const out = [el('nav', { 'aria-label': 'breadcrumb' }, crumbs),
                 el('h2', { class: 'node-title', text: path.length ? node.title : 'worldview' })];

    if (path.length) {
      // meta box
      const counts = tally(node, {});
      const inside = [];
      if (counts.argument) inside.push(plural(counts.argument, 'argument'));
      if (counts.objection) inside.push(plural(counts.objection, 'objection'));
      if (counts.reply) inside.push(plural(counts.reply, 'reply').replace('replys', 'replies'));
      if (counts.category) inside.push(plural(counts.category, 'section'));

      const copyBtn = el('button', { type: 'button', class: 'linkbtn', onclick(e) { copyLink(e.currentTarget); } }, '[copy link]');
      out.push(el('div', { class: 'mini meta' },
        el('div', { class: 'k', text: 'type:' }), el('div', { text: node.type || 'node' }),
        node.verdict ? [el('div', { class: 'k', text: 'verdict:' }), el('div', null, vmark(node.verdict), ' ' + node.verdict)] : null,
        el('div', { class: 'k', text: 'inside:' }), el('div', { text: inside.length ? inside.join(', ') : 'nothing further' }),
        el('div', { class: 'k', text: 'link:' }), el('div', null, '#' + path.join('/') + ' ', copyBtn)));

      if (node.summary) {
        out.push(el('p', { class: 'tldr' }, el('b', { text: 'summary: ' }), node.summary));
      }

      const paras = Array.isArray(node.body)
        ? node.body
        : String(node.body || '').split(/\n{2,}/);
      const clean = paras.map(p => String(p).trim()).filter(Boolean);
      if (clean.length) {
        out.push(el('hr'), el('div', { class: 'body-text' }, clean.map(p => el('p', null, linkify(p)))));
      }
    } else {
      out.push(el('p', { class: 'tldr' }, '> pick a branch in the tree, or try a ',
        el('a', { href: '#', onclick(e) { e.preventDefault(); randomNode(); } }, '[random node]'), '.'));
    }

    const kids = kidList(node, path);
    if (kids) out.push(el('hr'), kids);

    box.replaceChildren(...out);
  }

  function randomNode() {
    const all = Site.ALL;
    if (!all.length) return;
    location.hash = all[Math.floor(Math.random() * all.length)].path.join('/');
  }

  // ---------- routing ----------
  function route(opts) {
    const path = hashToPath();
    // make sure the branch you navigated into is visible in the sidebar
    path.forEach((_, i) => userClosed.delete(path.slice(0, i + 1).join('/')));

    renderSidebar(path);
    renderContent(path);

    const node = path.length ? findNode(path) : TREE;
    document.title = (path.length && node ? node.title + ' — ' : '') + 'worldview';
    Site.setStatus(path, path.length && node ? node.title : null);

    if (!(opts && opts.keepScroll)) {
      const box = document.getElementById('pageContent');
      if (box) box.scrollTop = 0;
    }
  }

  window.addEventListener('hashchange', () => route());

  // objections toggle (lives in the tree cell)
  const toggle = document.getElementById('toggleObjections');
  if (toggle) {
    const label = () => {
      toggle.textContent = showObjections ? 'hide objections' : 'show objections';
      toggle.setAttribute('aria-pressed', String(!showObjections));
    };
    toggle.addEventListener('click', () => {
      showObjections = !showObjections;
      pref.set('objections', showObjections);
      label();
      route({ keepScroll: true });
    });
    label();
  }

  route();
}());
