/* videos.js — the videos page: one player with retro controls and a random-next button.
   Starts playing as soon as you open the page. The URL hash holds the current
   clip (videos.html#my-clip) so you can share it. */

(function () {
  'use strict';

  const { el, pref } = Site;
  const stage = document.getElementById('vidStage');
  if (!stage) return;

  const nameOf = s => decodeURIComponent(String(s).split('?')[0].split('/').pop())
    .replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
  const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const lsGet = (k, d) => { try { const v = localStorage.getItem('wv_' + k); return v === null ? d : v; } catch (e) { return d; } };
  const lsSet = (k, v) => { try { localStorage.setItem('wv_' + k, String(v)); } catch (e) { /* ignore */ } };
  const fmt = s => {
    if (!isFinite(s)) s = 0;
    s = Math.floor(s);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  };

  const seen = new Set();
  const vids = (window.VIDEOS || []).filter(v => v && v.src).map((v, i) => {
    const title = v.title || nameOf(v.src);
    let id = v.id || slug(title) || 'v' + (i + 1);
    while (seen.has(id)) id += '-' + (i + 1);
    seen.add(id);
    return { id, title, src: v.src, note: v.note || '' };
  });

  if (!vids.length) {
    stage.append(el('p', null, '> no videos yet.'),
      el('p', { class: 'small dim' }, '> put .mp4 files in the "videos" folder and list them in videolist.js'));
    return;
  }

  // ---------- build the player ----------
  const rt = (text, extra) => el('button', Object.assign({ type: 'button', class: 'rt-btn' }, extra || {}), text);

  const video = el('video', { playsinline: 'playsinline', preload: 'auto' });   // no native controls: ours are retro

  const bPlay = rt('►', { 'aria-label': 'play', title: 'play / pause (space)' });
  const seek = el('input', { type: 'range', class: 'rt-range vid-seek', min: '0', max: '1000', step: '1', value: '0', 'aria-label': 'seek' });
  const timeEl = el('span', { class: 'vid-time', text: '00:00 / 00:00' });
  const bMute = rt('SND:ON', { title: 'sound on / off (m)', 'aria-pressed': 'false' });
  const vslider = el('input', { type: 'range', class: 'rt-range vid-vol', min: '0', max: '100', step: '1', 'aria-label': 'volume' });
  const bFull = rt('FULL', { title: 'fullscreen (f)' });

  const bar = el('div', { class: 'vid-bar' }, bPlay, seek, timeEl, bMute, vslider, bFull);
  const player = el('div', { class: 'vid-player' }, el('div', { class: 'vid-screen' }, video), bar);

  const bPrev = rt('◄ PREV', { title: 'previous clip' });
  const bRand = rt('RANDOM NEXT ►', { class: 'rt-btn big', title: 'random next clip (r)' });
  const bAuto = rt('', { title: 'when a clip ends, jump to a random one' });
  const bLoop = rt('LOOP', { title: 'loop this clip' });
  const hint = el('p', { class: 'vid-hint', role: 'status', hidden: 'hidden' });

  const nowT = el('div');
  const noteT = el('div');
  const posT = el('div');
  const copyBtn = el('button', { type: 'button', class: 'linkbtn', onclick(e) { copyLink(e.currentTarget); } }, '[copy link]');

  stage.append(
    player,
    el('div', { class: 'vid-ctrl' }, bPrev, bRand, bAuto, bLoop),
    hint,
    el('div', { class: 'mini meta' },
      el('div', { class: 'k', text: 'now:' }), nowT,
      el('div', { class: 'k', text: 'note:' }), noteT,
      el('div', { class: 'k', text: 'clip:' }), posT)
  );

  // ---------- state ----------
  let current = -1;
  let bag = [];
  const back = [];
  let auto = pref.get('vid_auto', true);
  let looping = false;
  let errs = 0;
  let autoMuted = false;      // browser forced muted autoplay; first click gives sound
  let pending = false;        // browser blocked even muted autoplay; first click starts it
  let dragging = false;

  let vol = parseFloat(lsGet('vid_vol', '0.8'));
  if (isNaN(vol)) vol = 0.8;
  video.volume = vol;
  vslider.value = String(Math.round(vol * 100));

  const shuffle = a => {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  // shuffled "bag": every clip plays once before any repeats, never the same one twice in a row
  function draw() {
    if (vids.length < 2) return 0;
    if (!bag.length) bag = shuffle(vids.map((_, i) => i));
    let i = bag.pop();
    if (i === current) {
      if (!bag.length) bag = shuffle(vids.map((_, k) => k).filter(k => k !== current));
      else { bag.unshift(i); i = bag.pop(); }
    }
    return i;
  }

  function copyLink(btn) {
    const url = location.href;
    const done = m => { btn.textContent = m; setTimeout(() => { btn.textContent = '[copy link]'; }, 1500); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(() => done('[copied!]'), () => window.prompt('copy this link:', url));
    } else window.prompt('copy this link:', url);
  }

  // ---------- rendering ----------
  function renderPlay() {
    const playing = !video.paused && !video.ended;
    bPlay.textContent = playing ? '❚❚' : '►';
    bPlay.setAttribute('aria-label', playing ? 'pause' : 'play');
  }
  function renderSound() {
    const off = video.muted || video.volume === 0;
    bMute.textContent = off ? 'SND:OFF' : 'SND:ON';
    bMute.setAttribute('aria-pressed', String(off));
  }
  function renderTime() {
    const d = video.duration;
    timeEl.textContent = fmt(video.currentTime) + ' / ' + fmt(d);
    if (!dragging && isFinite(d) && d > 0) seek.value = String(Math.round(video.currentTime / d * 1000));
    seek.style.setProperty('--p', (seek.value / 10) + '%');
  }
  function renderButtons() {
    bAuto.textContent = 'AUTO-RANDOM: ' + (auto ? 'ON' : 'OFF');
    bAuto.setAttribute('aria-pressed', String(auto));
    bLoop.setAttribute('aria-pressed', String(looping));
    video.loop = looping;
    bPrev.disabled = !back.length;
  }
  function showHint(text) {
    hint.textContent = text || '';
    hint.hidden = !text;
  }

  // ---------- music: keep it quiet while a clip plays ----------
  let resumeTimer = 0;
  function releaseMusic() {
    window.WVMusicHold = false;
    if (window.WVMusic) WVMusic.resume();
  }
  window.WVMusicHold = true;    // we're about to autoplay, so the music waits

  // ---------- playback ----------
  function unmuteAuto() {
    if (!autoMuted) return;
    autoMuted = false;
    video.muted = false;
    showHint('');
  }

  function startPlayback() {
    window.WVMusicHold = true;
    video.play().catch(() => {
      // browsers refuse sound before a click: start muted, give sound on the first click
      autoMuted = true;
      video.muted = true;
      video.play().then(() => {
        showHint('> started muted (your browser blocks sound until you click). click anywhere for sound.');
      }).catch(() => {
        autoMuted = false;
        video.muted = false;
        pending = true;
        showHint('> press play (or click anywhere) to start.');
        releaseMusic();
      });
    });
  }

  function toggle() {
    if (autoMuted) { unmuteAuto(); if (!video.paused) return; }
    if (video.paused || video.ended) video.play().catch(() => {});
    else video.pause();
  }

  function load(i, play) {
    current = i;
    const v = vids[i];
    video.src = v.src;
    video.load();
    nowT.textContent = v.title;
    noteT.textContent = v.note || '—';
    posT.replaceChildren((i + 1) + '/' + vids.length + '  #' + v.id + '  ', copyBtn);
    try { history.replaceState(null, '', '#' + encodeURIComponent(v.id)); } catch (e) { /* ignore */ }
    document.title = v.title + ' — worldview';
    Site.setStatus(['videos', v.id], v.title);
    seek.value = '0';
    renderTime();
    renderButtons();
    if (play) startPlayback();
  }

  function go(i, play, remember) {
    if (remember && current >= 0 && current !== i) back.push(current);
    load(i, play);
  }

  // ---------- controls ----------
  bPlay.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  bRand.addEventListener('click', () => go(draw(), true, true));
  bPrev.addEventListener('click', () => { if (back.length) load(back.pop(), true); });
  bAuto.addEventListener('click', () => { auto = !auto; pref.set('vid_auto', auto); renderButtons(); });
  bLoop.addEventListener('click', () => { looping = !looping; renderButtons(); });

  bMute.addEventListener('click', () => {
    if (autoMuted) { unmuteAuto(); return; }
    if (video.volume === 0) { video.volume = 0.6; vslider.value = '60'; lsSet('vid_vol', 0.6); video.muted = false; }
    else video.muted = !video.muted;
  });
  vslider.addEventListener('input', () => {
    unmuteAuto();
    vol = vslider.value / 100;
    video.volume = vol;
    if (vol > 0) video.muted = false;
    lsSet('vid_vol', vol);
  });

  seek.addEventListener('pointerdown', () => { dragging = true; });
  seek.addEventListener('input', () => {
    const d = video.duration;
    if (isFinite(d) && d > 0) video.currentTime = seek.value / 1000 * d;
    renderTime();
  });
  ['change', 'pointerup', 'blur'].forEach(ev => seek.addEventListener(ev, () => { dragging = false; }));

  function fullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (player.requestFullscreen) player.requestFullscreen().catch(() => {});
    else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
  }
  bFull.addEventListener('click', fullscreen);

  video.addEventListener('play', () => {
    clearTimeout(resumeTimer);
    window.WVMusicHold = true;
    if (window.WVMusic) WVMusic.pause();
    renderPlay();
  });
  ['pause', 'ended'].forEach(ev => video.addEventListener(ev, () => {
    renderPlay();
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { if (video.paused) releaseMusic(); }, 600);
  }));
  video.addEventListener('playing', () => { errs = 0; renderPlay(); });
  video.addEventListener('timeupdate', renderTime);
  video.addEventListener('loadedmetadata', renderTime);
  video.addEventListener('durationchange', renderTime);
  video.addEventListener('volumechange', renderSound);
  video.addEventListener('ended', () => { if (auto) go(draw(), true, true); });
  video.addEventListener('error', () => {
    noteT.textContent = 'cannot play this file (' + vids[current].src + ')';
    if (auto && vids.length > 1 && errs < vids.length) { errs++; go(draw(), true, false); }
  });

  // first click/key anywhere outside the player: start (if blocked) or give sound
  const gesture = e => {
    if (player.contains(e.target)) return;
    if (pending && video.paused) { pending = false; showHint(''); video.play().catch(() => {}); }
    unmuteAuto();
  };
  ['pointerdown', 'keydown', 'touchend'].forEach(ev => document.addEventListener(ev, gesture, true));

  document.addEventListener('keydown', e => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target;
    if (t.closest && t.closest('input, textarea, select')) return;
    const onBtn = t.closest && t.closest('button, a');
    switch (e.key) {
      case 'r': go(draw(), true, true); break;
      case 'f': fullscreen(); break;
      case 'm': bMute.click(); break;
      case ' ': if (!onBtn) { e.preventDefault(); toggle(); } break;
      case 'ArrowLeft': video.currentTime = Math.max(0, video.currentTime - 5); break;
      case 'ArrowRight': video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 5); break;
      default: break;
    }
  });

  // ---------- start ----------
  function fromHash() {
    let id = '';
    try { id = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { id = ''; }
    return vids.findIndex(v => v.id === id);
  }
  window.addEventListener('hashchange', () => {
    const i = fromHash();
    if (i >= 0 && i !== current) go(i, true, true);
  });

  renderPlay();
  renderSound();
  const start = fromHash();
  load(start >= 0 ? start : draw(), true);     // autoplay on entry
}());
