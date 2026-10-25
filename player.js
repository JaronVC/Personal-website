/* player.js — retro/cyber footer music player.
   - autoplays on entry (browsers block sound until the first click/key/tap,
     so if blocked it starts on your very first interaction)
   - remembers track, position, volume, mute and pause state across pages
   - playlist = music.js (everyone) + files added through the LIST panel
     (stored in this browser via IndexedDB) */

(function () {
  'use strict';

  if (window.__wvPlayer) return;          // never build two players
  const bar = document.getElementById('fxbar');
  if (!bar || !window.Site) return;
  window.__wvPlayer = true;
  const { el } = Site;

  // load our own stylesheet so style.css doesn't need to change
  document.head.append(el('link', { rel: 'stylesheet', href: 'player.css' }));

  // ---------- storage ----------
  const store = {
    get(k, d) { try { const v = localStorage.getItem('wv_' + k); return v === null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('wv_' + k, String(v)); } catch (e) { /* ignore */ } }
  };

  const DB = 'wv_music';
  function openDb() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore('f', { keyPath: 'id', autoIncrement: true });
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  async function dbAll() {
    try {
      const db = await openDb();
      return await new Promise(res => {
        const q = db.transaction('f').objectStore('f').getAll();
        q.onsuccess = () => res(q.result || []);
        q.onerror = () => res([]);
      });
    } catch (e) { return []; }
  }
  async function dbAdd(file) {
    const db = await openDb();
    return new Promise((res, rej) => {
      const tx = db.transaction('f', 'readwrite');
      tx.objectStore('f').add({ name: file.name, blob: file });
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  }
  async function dbClear() {
    try {
      const db = await openDb();
      await new Promise(res => {
        const tx = db.transaction('f', 'readwrite');
        tx.objectStore('f').clear();
        tx.oncomplete = res; tx.onerror = res;
      });
    } catch (e) { /* ignore */ }
  }

  // ---------- tracks ----------
  const nameOf = s => decodeURIComponent(String(s).split('/').pop())
    .replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');

  const fileTracks = (window.PLAYLIST || []).filter(t => t && t.src).map(t => {
    const title = t.title || nameOf(t.src);
    return { title, src: t.src, key: 'F:' + title, local: false };
  });
  let localTracks = [];
  let tracks = fileTracks.slice();
  let idx = 0;

  const toLocal = r => ({
    title: nameOf(r.name), src: URL.createObjectURL(r.blob),
    key: 'L:' + nameOf(r.name), local: true
  });

  // ---------- audio state ----------
  const audio = new Audio();
  audio.preload = 'auto';
  let vol = parseFloat(store.get('mp_vol', '0.6'));
  if (isNaN(vol)) vol = 0.6;
  let muted = store.get('mp_muted', 'false') === 'true';
  let wantPlay = store.get('mp_play', 'true') !== 'false';
  let blocked = false;
  let errors = 0;
  audio.volume = vol;
  audio.muted = muted;

  // ---------- UI ----------
  const fmt = s => {
    if (!isFinite(s)) s = 0;
    s = Math.floor(s);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  const eq = el('span', { class: 'mp-eq', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'), el('i'), el('i'));
  const titleSpan = el('span');
  const marq = el('span', { class: 'mp-marq' }, titleSpan);
  const timeEl = el('span', { class: 'mp-time', text: '00:00' });
  const lcd = el('div', { class: 'mp-lcd', role: 'status', 'aria-live': 'off' }, eq, marq, timeEl);

  const bPrev = el('button', { type: 'button', class: 'mp-btn', 'aria-label': 'previous track', title: 'previous', text: '|◄' });
  const bPlay = el('button', { type: 'button', class: 'mp-btn big', 'aria-label': 'play', title: 'play / pause', text: '►' });
  const bNext = el('button', { type: 'button', class: 'mp-btn', 'aria-label': 'next track', title: 'next', text: '►|' });
  const bSnd = el('button', { type: 'button', class: 'mp-btn', title: 'sound on / off', 'aria-pressed': 'false' });
  const vslider = el('input', {
    type: 'range', class: 'mp-vol', min: '0', max: '100', step: '1',
    value: String(Math.round(vol * 100)), 'aria-label': 'volume'
  });
  const bList = el('button', { type: 'button', class: 'mp-btn', title: 'playlist / add music', 'aria-expanded': 'false', text: 'LIST' });

  const listBox = el('ol', { class: 'mp-list' });
  const fileInput = el('input', { type: 'file', accept: 'audio/*', multiple: 'multiple', hidden: 'hidden' });
  const bAdd = el('button', { type: 'button', class: 'mp-btn', text: '+ ADD FILES' });
  const bClear = el('button', { type: 'button', class: 'mp-btn', text: 'CLEAR ADDED' });
  const panel = el('div', { class: 'mp-panel', hidden: 'hidden' },
    el('div', { class: 'mp-ph' }, el('b', { class: 'slate', text: '> playlist' })),
    listBox,
    el('div', { class: 'mp-pa' }, bAdd, bClear, fileInput),
    el('p', { class: 'mp-tip dim', text: 'added files stay in this browser only. for everyone: put files in /music and list them in music.js' })
  );

  const root = el('div', { class: 'mp', role: 'group', 'aria-label': 'music player' },
    lcd, bPrev, bPlay, bNext, bSnd, vslider, bList, panel);
  bar.append(root);

  function fitMarquee() {
    marq.classList.remove('scroll');
    if (titleSpan.scrollWidth > marq.clientWidth + 1) {
      marq.style.setProperty('--d', Math.max(8, titleSpan.textContent.length * 0.35) + 's');
      marq.classList.add('scroll');
    }
  }

  function render() {
    const t = tracks[idx];
    let text;
    if (!tracks.length) text = 'no tracks :: open LIST to add';
    else if (blocked && wantPlay) text = '>> click anywhere to start << ' + t.title;
    else text = (idx + 1) + '/' + tracks.length + ' ' + t.title;
    if (titleSpan.textContent !== text) { titleSpan.textContent = text; fitMarquee(); }

    const playing = !audio.paused && !audio.ended;
    root.classList.toggle('playing', playing);
    root.classList.toggle('blocked', blocked && wantPlay);
    bPlay.textContent = playing ? '❚❚' : '►';
    bPlay.setAttribute('aria-label', playing ? 'pause' : 'play');
    bSnd.textContent = muted || vol === 0 ? 'SND:OFF' : 'SND:ON';
    bSnd.setAttribute('aria-pressed', String(muted || vol === 0));
    timeEl.textContent = fmt(audio.currentTime);
    renderList();
  }

  function renderList() {
    if (panel.hidden) return;
    listBox.replaceChildren(...tracks.map((t, i) =>
      el('li', null, el('button', {
        type: 'button', class: 'mp-row' + (i === idx ? ' on' : ''),
        'aria-current': i === idx ? 'true' : false,
        onclick() { go(i); }
      }, (i === idx ? '► ' : '  ') + t.title + (t.local ? ' [local]' : ''))))
    );
    if (!tracks.length) listBox.replaceChildren(el('li', { class: 'dim', text: '(empty)' }));
    bClear.hidden = !localTracks.length;
  }

  // ---------- playback ----------
  function tryPlay() {
    if (!tracks.length || !wantPlay || window.WVMusicHold) { render(); return Promise.resolve(); }
    return audio.play().then(() => { blocked = false; render(); }, () => { blocked = true; render(); });
  }

  function select(i, startAt) {
    idx = i;
    const t = tracks[i];
    store.set('mp_key', t.key);
    store.set('mp_time', 0);
    audio.src = t.src;
    if (startAt > 0) {
      audio.addEventListener('loadedmetadata', () => {
        if (!isFinite(audio.duration) || startAt < audio.duration - 1) {
          try { audio.currentTime = startAt; } catch (e) { /* ignore */ }
        }
      }, { once: true });
    }
    render();
  }

  function go(i) {
    if (!tracks.length) return;
    i = (i + tracks.length) % tracks.length;
    wantPlay = true; store.set('mp_play', true);
    select(i, 0);
    tryPlay();
  }

  bPlay.addEventListener('click', () => {
    if (!tracks.length) return;
    if (audio.paused) { wantPlay = true; store.set('mp_play', true); tryPlay(); }
    else { wantPlay = false; store.set('mp_play', false); audio.pause(); }
  });
  bPrev.addEventListener('click', () => { if (audio.currentTime > 3) { audio.currentTime = 0; } else go(idx - 1); });
  bNext.addEventListener('click', () => go(idx + 1));
  bSnd.addEventListener('click', () => {
    if (vol === 0) { vol = 0.6; audio.volume = vol; vslider.value = '60'; store.set('mp_vol', vol); muted = false; }
    else muted = !muted;
    audio.muted = muted; store.set('mp_muted', muted); render();
  });
  vslider.addEventListener('input', () => {
    vol = vslider.value / 100;
    audio.volume = vol;
    if (vol > 0 && muted) { muted = false; audio.muted = false; store.set('mp_muted', false); }
    store.set('mp_vol', vol); render();
  });

  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('playing', () => { errors = 0; blocked = false; render(); });
  audio.addEventListener('ended', () => go(idx + 1));
  audio.addEventListener('error', () => {
    if (tracks.length > 1 && errors < tracks.length) { errors++; go(idx + 1); }
    else { titleSpan.textContent = 'error :: cannot play this file'; marq.classList.remove('scroll'); }
  });
  let lastSec = -1;
  audio.addEventListener('timeupdate', () => {
    const s = Math.floor(audio.currentTime);
    if (s !== lastSec) { lastSec = s; timeEl.textContent = fmt(s); store.set('mp_time', audio.currentTime.toFixed(1)); }
  });
  window.addEventListener('pagehide', () => store.set('mp_time', audio.currentTime.toFixed(1)));
  window.addEventListener('resize', fitMarquee);

  // browsers refuse sound before a user gesture: start on the first one
  const unlock = e => {
    if (root.contains(e.target)) return;
    if (blocked && wantPlay) tryPlay();
    if (!blocked) ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.removeEventListener(ev, unlock, true));
  };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, unlock, true));

  // ---------- playlist panel ----------
  bList.addEventListener('click', () => {
    panel.hidden = !panel.hidden;
    bList.setAttribute('aria-expanded', String(!panel.hidden));
    renderList();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !panel.hidden) { panel.hidden = true; bList.setAttribute('aria-expanded', 'false'); bList.focus(); }
  });
  document.addEventListener('pointerdown', e => {
    if (!panel.hidden && !root.contains(e.target)) { panel.hidden = true; bList.setAttribute('aria-expanded', 'false'); }
  });

  bAdd.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []).filter(f => /^audio\//.test(f.type) || /\.(mp3|ogg|oga|wav|m4a|aac|flac|opus|webm)$/i.test(f.name));
    fileInput.value = '';
    if (!files.length) return;
    const firstTitle = 'L:' + nameOf(files[0].name);
    let stored = true;
    for (const f of files) {
      try { await dbAdd(f); } catch (e) { stored = false; localTracks.push(toLocal({ name: f.name, blob: f })); }
    }
    if (stored) localTracks = (await dbAll()).map(toLocal);
    tracks = fileTracks.concat(localTracks);
    const i = tracks.findIndex(t => t.key === firstTitle);
    go(i < 0 ? 0 : i);
  });
  bClear.addEventListener('click', async () => {
    const curKey = tracks[idx] && tracks[idx].key;
    await dbClear();
    localTracks = [];
    tracks = fileTracks.slice();
    if (curKey && curKey.startsWith('L:')) {
      audio.pause();
      if (tracks.length) select(0, 0); else { audio.removeAttribute('src'); idx = 0; }
    } else idx = Math.max(0, tracks.findIndex(t => t.key === curKey));
    render();
  });

  // lets the videos page silence the music while a clip plays
  let ducked = false;
  window.WVMusic = {
    pause() { if (!audio.paused) { ducked = true; audio.pause(); } },
    resume() { ducked = false; if (wantPlay && audio.paused && !window.WVMusicHold) tryPlay(); }
  };

  // ---------- go ----------
  render();
  (async function init() {
    localTracks = (await dbAll()).map(toLocal);
    tracks = fileTracks.concat(localTracks);
    if (!tracks.length) { render(); return; }
    const key = store.get('mp_key', '');
    let i = tracks.findIndex(t => t.key === key);
    const resume = i >= 0 ? parseFloat(store.get('mp_time', '0')) || 0 : 0;
    if (i < 0) i = 0;
    select(i, resume);
    tryPlay();
  }());
}());
