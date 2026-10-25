/* quotes.js — the quotes page: stacked quote blocks, each with an author section.
   Filter by author, jump to a random quote, copy a quote, link to a single one. */

(function () {
  'use strict';

  const { el, REDUCED } = Site;
  const bar = document.getElementById('qBar');
  const listEl = document.getElementById('qList');
  if (!bar || !listEl) return;

  const quotes = (window.QUOTES || []).filter(q => q && q.text).map((q, i) => ({
    n: i + 1,
    id: String(q.id || 'q' + (i + 1)),
    text: String(q.text).trim(),
    author: String(q.author || 'unknown').trim(),
    source: q.source ? String(q.source).trim() : ''
  }));

  let filter = '';
  const shown = () => (filter ? quotes.filter(q => q.author === filter) : quotes);

  function authors() {
    const m = new Map();
    quotes.forEach(q => m.set(q.author, (m.get(q.author) || 0) + 1));
    return Array.from(m);
  }

  function copyQuote(q, btn) {
    const txt = '“' + q.text + '” — ' + q.author + (q.source ? ', ' + q.source : '');
    const done = m => { btn.textContent = m; setTimeout(() => { btn.textContent = '[copy]'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(txt).then(() => done('[copied!]'), () => window.prompt('copy this quote:', txt));
    } else window.prompt('copy this quote:', txt);
  }

  function block(q) {
    return el('article', { class: 'qblock', id: q.id },
      el('div', { class: 'qhead' },
        el('span', { text: 'quote #' + String(q.n).padStart(2, '0') }),
        el('a', { class: 'qlink', href: '#' + q.id, text: '[link]' })),
      el('blockquote', { class: 'qbody' }, q.text),
      el('footer', { class: 'qauthor' },
        el('span', { class: 'k', text: 'author:' }),
        el('b', { class: 'qname', text: q.author }),
        q.source ? el('span', { class: 'qsrc', text: '— ' + q.source }) : null,
        el('span', { class: 'qact' },
          el('button', { type: 'button', class: 'linkbtn', onclick(e) { copyQuote(q, e.currentTarget); } }, '[copy]'))));
  }

  function flash(node) {
    node.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    node.classList.add('hl');
    setTimeout(() => node.classList.remove('hl'), 2200);
  }

  function randomQuote() {
    const pool = shown();
    if (!pool.length) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    const node = document.getElementById(q.id);
    if (!node) return;
    try { history.replaceState(null, '', '#' + encodeURIComponent(q.id)); } catch (e) { /* ignore */ }
    flash(node);
  }

  function render() {
    const chip = (label, val) => el('button', {
      type: 'button', class: 'fxbtn', 'aria-pressed': String(filter === val),
      onclick() { filter = val; render(); }
    }, label);

    bar.replaceChildren(
      chip('all (' + quotes.length + ')', ''),
      authors().map(([a, n]) => chip(a + ' (' + n + ')', a)),
      el('button', { type: 'button', class: 'fxbtn big', onclick: randomQuote }, 'random quote'));

    listEl.replaceChildren(...shown().map(block));
  }

  if (!quotes.length) {
    bar.hidden = true;
    listEl.append(el('p', null, '> no quotes yet.'),
      el('p', { class: 'small dim' }, '> add them to quotelist.js'));
    return;
  }

  render();

  function fromHash() {
    let id = '';
    try { id = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { id = ''; }
    const node = id && document.getElementById(id);
    if (node) flash(node);
  }
  window.addEventListener('hashchange', fromHash);
  fromHash();
}());
