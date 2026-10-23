/* home.js — fills the topic list and the diagnostics box from data.js,
   so they can never drift out of date. */

(function () {
  'use strict';

  const { el, vmark, truncate, ALL } = Site;

  // topics
  const list = document.getElementById('homeTopics');
  if (list) {
    TREE.children.forEach(t => {
      list.append(el('li', null,
        el('b', null, el('a', { href: 'tree.html#' + t.id, text: '[' + t.id + ']' })),
        t.verdict ? [' ', vmark(t.verdict)] : null,
        t.summary ? el('span', { class: 'why', text: truncate(t.summary, 120) }) : null));
    });
  }

  // diagnostics
  const diag = document.getElementById('diag');
  if (diag) {
    const by = { type: {}, verdict: {} };
    let drafts = 0;
    ALL.forEach(({ node }) => {
      by.type[node.type] = (by.type[node.type] || 0) + 1;
      if (node.verdict) by.verdict[node.verdict] = (by.verdict[node.verdict] || 0) + 1;
      if (/draft/.test(node.id) || /\(draft/i.test(node.title)) drafts++;
    });
    const n = k => by.type[k] || 0;
    const v = k => by.verdict[k] || 0;
    const lines = [
      ['topics', TREE.children.length],
      ['nodes mapped', ALL.length],
      ['arguments / objections / replies', n('argument') + ' / ' + n('objection') + ' / ' + n('reply')],
      ['accepted / unresolved / rejected', v('accepted') + ' / ' + v('unresolved') + ' / ' + v('rejected')],
      ['drafts still to write', drafts]
    ];
    lines.forEach(([k, val]) => {
      diag.append(el('p', { class: 'sm2' }, '> ' + k + ': ', el('b', { class: 'date', text: String(val) })));
    });
  }

  // random node link
  const rnd = document.getElementById('homeRandom');
  if (rnd) {
    rnd.addEventListener('click', e => {
      e.preventDefault();
      const pick = ALL[Math.floor(Math.random() * ALL.length)];
      location.href = 'tree.html#' + pick.path.join('/');
    });
  }
}());
