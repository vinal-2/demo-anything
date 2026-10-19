// Interactive demo player.
// Loads flows/<id>/flow.json and plays it as a guided walkthrough:
// cover -> playing(step) -> waiting(step) -> ... -> end.
//
// URL options (query string or bare hash tokens, so it also works where only #tokens reach the page):
//   ?flow=<id>   which flow to load (default "example")
//   ?embed       hide the outer page margin, for <iframe> embedding
//   ?edit        authoring mode (also #edit)

import { createHotspot } from './hotspot.js';
import { createCaptions } from './captions.js';

const DEFAULT_FLOW = 'example';
const BADGE_URL = 'https://github.com/vinal-2/demo-anything';
const SPEEDS = [1, 1.25, 1.5, 2];
const SECONDS_PER_WORD = 0.35;
const MIN_NARRATION = 2.5;

const ICONS = {
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
  next: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1"/><path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"/>',
  reload: '<path d="M20 12a8 8 0 1 1-2.34-5.66"/><path d="M20 4v5h-5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/>',
  voice: '<path d="M12 3a3 3 0 0 0-3 3v5a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3z"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0"/><path d="M12 17.5V21"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>',
  mute: '<path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9.5l5 5"/><path d="M22 9.5l-5 5"/>',
  cc: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M10.5 10.2a2.5 2.5 0 1 0 0 3.6"/><path d="M17 10.2a2.5 2.5 0 1 0 0 3.6"/>',
  expand: '<path d="M4 9V4h5"/><path d="M20 9V4h-5"/><path d="M4 15v5h5"/><path d="M20 15v5h-5"/>',
  collapse: '<path d="M9 4v5H4"/><path d="M15 4v5h5"/><path d="M9 20v-5H4"/><path d="M15 20v-5h5"/>',
  play: '<path d="M8 5.5v13l11-6.5z" fill="currentColor"/>',
  pause: '<path d="M7.5 5h3v14h-3z" fill="currentColor"/><path d="M13.5 5h3v14h-3z" fill="currentColor"/>',
};
const ico = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${ICONS[name]}</svg>`;

// Our own pointer drawing. The tip is at (4, 2.5) in a 24-unit box.
const CURSOR_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 2.5l15.5 8.3-6.8 1.9-3.5 6.7z" fill="#111827" stroke="#FFFFFF" stroke-width="1.6" stroke-linejoin="round"/></svg>';
const CURSOR_TIP = { x: 4 / 24, y: 2.5 / 24 };

export const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Escape, then turn [text](https://...) into links. Only https and in-page "#" links are allowed.
function inlineMarkdown(text) {
  return esc(text).replace(/\[([^\]]+)\]\(((?:https:\/\/|#)[^\s)]*)\)/g, (_m, label, href) => {
    const external = /^https:/i.test(href);
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
  });
}

function hexToRgb(hex) {
  const m = String(hex || '').trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (!m) return '14, 103, 108';
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const wordCount = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;
const fmt = (sec) => {
  const s = Math.max(0, Math.round(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
const srcList = (src) => (Array.isArray(src) ? src : [src]).filter(Boolean);
const srcKey = (step) => srcList(step.src).join('|');

const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement || null;

function readPref(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch { return fallback; }
}
function writePref(key, on) {
  try { localStorage.setItem(key, on ? '1' : '0'); } catch { /* storage unavailable */ }
}

// ---------- Boot ----------

const params = new URLSearchParams(location.search);
const hashTokens = location.hash.replace(/^#/, '').split(/[&,]/).filter(Boolean);
// A page can also name its flow in <meta name="demo-flow"> (the per-demo pages do).
const metaFlow = document.querySelector('meta[name="demo-flow"]')?.getAttribute('content');
const flowId = (params.get('flow') || metaFlow || DEFAULT_FLOW).replace(/[^a-z0-9_-]/gi, '') || DEFAULT_FLOW;
const isEdit = params.has('edit') || hashTokens.includes('edit');
const isEmbed = params.has('embed') || hashTokens.includes('embed');
if (isEmbed) document.documentElement.classList.add('embed');

const app = document.getElementById('app');
if (app) boot(app);

async function boot(root) {
  // flows/ sits next to player/, so a page in any folder (like demos/<id>/) finds it.
  const base = new URL(`../flows/${flowId}/`, import.meta.url).href;
  const name = `flows/${flowId}/flow.json`;
  let flow;
  try {
    const res = await fetch(`${base}flow.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`the server answered ${res.status}`);
    flow = await res.json();
  } catch (err) {
    root.innerHTML = `<div class="dp-error" role="alert">Couldn't load <code>${esc(name)}</code>: ${esc(err.message)}.
      Check the flow name, and serve this folder over HTTP (for example <code>npx serve .</code>) rather than opening index.html as a file.</div>`;
    return;
  }
  if (!Array.isArray(flow.steps) || !flow.steps.length) {
    root.innerHTML = `<div class="dp-error" role="alert"><code>${esc(name)}</code> has no steps.</div>`;
    return;
  }
  if (isEdit) {
    const { mountEditor } = await import('./editor.js');
    mountEditor(root, flow, base);
    return;
  }
  document.title = flow.name || document.title;
  mountPlayer(root, flow, base);
}

// ---------- Player ----------

export function mountPlayer(root, flow, base) {
  const steps = flow.steps;
  const lastIndex = steps.length - 1;
  const firstContent = (() => {
    const k = steps.findIndex((s) => s.type !== 'cover');
    return k < 0 ? 0 : k;
  })();
  const theme = { brand: '#0E676C', brandText: '#FFFFFF', hotspot: '#D06A12', ...(flow.theme || {}) };
  const ratio = Number(flow.aspectRatio) > 0 ? Number(flow.aspectRatio) : 0.5625;
  const showNav = flow.showBackNextButtons !== false;
  const keyboardNav = flow.keyboardNav !== false;
  const name = flow.name || 'Interactive demo';
  const resolve = (p) => (!p ? '' : /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(p) ? p : base + p);
  const synth = 'speechSynthesis' in window ? window.speechSynthesis : null;

  // Narrators the viewer can switch between. The first owns voice.audio and voice.timings;
  // the others live in voice.variants[id]. A narrator with provider "browser" uses speech.
  const narrators = (Array.isArray(flow.narrators) ? flow.narrators : [])
    .filter((n) => n && /^[a-z0-9-]+$/i.test(String(n.id || '')));
  const voiceKey = `dp.voice.${flowId}`;
  const savedVoice = (() => { try { return localStorage.getItem(voiceKey); } catch { return null; } })();
  const initialVoice = narrators.some((n) => n.id === savedVoice) ? savedVoice : (narrators[0] ? narrators[0].id : null);
  const voiceMenu = narrators.length > 1 ? `
          <div class="dp-menu-wrap">
            <button type="button" class="dp-ico" data-act="voice" aria-label="Narrator voice" aria-haspopup="menu" aria-expanded="false">${ico('voice')}</button>
            <div class="dp-menu" role="menu" aria-label="Narrator voice" hidden>
              ${narrators.map((n) => `<button type="button" role="menuitemradio" aria-checked="${n.id === initialVoice}" data-act="voice-pick" data-voice="${esc(n.id)}">${esc(n.label || n.id)}</button>`).join('')}
            </div>
          </div>` : '';

  root.innerHTML = `
    <div class="dp no-controls" role="region" aria-label="Interactive demo: ${esc(name)}" tabindex="-1">
      <div class="dp-bar">
        <div class="dp-bar-left">
          <span class="dp-lights" aria-hidden="true"><i></i><i></i><i></i></span>
          <button type="button" class="dp-ico" data-act="back" aria-label="Previous step"${showNav ? '' : ' hidden'}>${ico('back')}</button>
          <button type="button" class="dp-ico" data-act="next" aria-label="Next step"${showNav ? '' : ' hidden'}>${ico('next')}</button>
        </div>
        <div class="dp-url">
          ${ico('link')}
          <span class="dp-url-text" title="${esc(name)}">${esc(name)}</span>
          <button type="button" class="dp-ico" data-act="restart" aria-label="Restart the demo">${ico('reload')}</button>
        </div>
        <div class="dp-bar-right">${voiceMenu}
          <div class="dp-menu-wrap">
            <button type="button" class="dp-ico" data-act="lang" aria-label="Language" aria-haspopup="menu" aria-expanded="false">${ico('globe')}</button>
            <div class="dp-menu" role="menu" hidden>
              <button type="button" role="menuitemradio" aria-checked="true" data-act="lang-en">English</button>
            </div>
          </div>
          <button type="button" class="dp-ico" data-act="sound" aria-label="Sound" aria-pressed="true">${ico('sound')}</button>
          <button type="button" class="dp-ico" data-act="cc" aria-label="Captions" aria-pressed="true">${ico('cc')}</button>
          <button type="button" class="dp-ico" data-act="fullscreen" aria-label="Full screen">${ico('expand')}</button>
        </div>
      </div>
      <div class="dp-viewport">
        <div class="dp-stage">
          <div class="dp-layers"></div>
          <div class="dp-overlay">
            <div class="dp-cursor" hidden>${CURSOR_SVG}</div>
            <div class="dp-hint" hidden></div>
            <div class="dp-controls">
              <button type="button" class="dp-ico" data-act="play" aria-label="Pause">${ico('pause')}</button>
              <span class="dp-time">00:00 / 00:00</span>
              <div class="dp-segs"></div>
              <button type="button" class="dp-ico dp-speed" data-act="speed" aria-label="Playback speed: 1×">1×</button>
            </div>
            <div class="dp-sr" aria-live="polite" data-role="status"></div>
          </div>
        </div>
      </div>
    </div>`;

  const dp = root.querySelector('.dp');
  const stage = dp.querySelector('.dp-stage');
  const layersEl = dp.querySelector('.dp-layers');
  const overlay = dp.querySelector('.dp-overlay');
  const cursorEl = dp.querySelector('.dp-cursor');
  const hintEl = dp.querySelector('.dp-hint');
  const controls = dp.querySelector('.dp-controls');
  const timeEl = dp.querySelector('.dp-time');
  const segsEl = dp.querySelector('.dp-segs');
  const statusEl = dp.querySelector('[data-role="status"]');
  const btn = (act) => dp.querySelector(`[data-act="${act}"]`);
  const menus = [...dp.querySelectorAll('.dp-menu')];

  dp.style.setProperty('--brand', theme.brand);
  dp.style.setProperty('--brand-rgb', hexToRgb(theme.brand));
  dp.style.setProperty('--brand-text', theme.brandText);
  dp.style.setProperty('--hot', theme.hotspot || theme.brand);
  dp.style.setProperty('--ar-num', String(1 / ratio));
  if (flow.font && flow.font !== 'Inter') dp.style.fontFamily = `"${flow.font}", system-ui, sans-serif`;
  dp.dataset.total = String(steps.length);

  const hotspot = createHotspot(overlay, { onActivate: ({ keyboard }) => { st.kbd = keyboard; goNext(); } });
  // Keep the hotspot and tooltip above the cursor but below captions and controls.
  overlay.insertBefore(hotspot.el, hintEl);
  const captions = createCaptions(overlay);

  const st = {
    i: 0,
    mode: 'cover',
    sound: readPref('dp.sound', true),
    cc: readPref('dp.cc', true),
    voice: initialVoice,
    rate: 1,
    paused: false,
    progress: 0,
    started: false,
    kbd: false,
    cursor: null, // { layer, target } of the last cursor target
    hs: null, // { step, layer } of the visible hotspot
  };

  const media = new Set(); // audio/video elements that play in the current step
  let ttsActive = false;
  let bgMusic = null;

  // The step's narration for the chosen narrator: its audio and timings, falling back to
  // the default narrator when a variant hasn't been made.
  function voiceFor(step) {
    const v = step.voice || {};
    if (!st.voice || !narrators.length || st.voice === narrators[0].id) return v;
    const chosen = narrators.find((n) => n.id === st.voice);
    if (chosen && chosen.provider === 'browser') return { ...v, audio: null, timings: [] };
    const alt = v.variants && v.variants[st.voice];
    return alt && alt.audio ? { ...v, audio: alt.audio, timings: alt.timings || [] } : v;
  }

  // ---------- Durations and the timeline ----------

  function narrationEstimate(step) {
    const v = voiceFor(step);
    if (!v || !v.script) return 0;
    if (Array.isArray(v.timings) && v.timings.length) return v.timings[v.timings.length - 1].t + 0.6;
    return Math.max(MIN_NARRATION, wordCount(v.script) * SECONDS_PER_WORD);
  }
  function baseDuration(step) {
    if (step.type === 'video') {
      const clip = Math.max(0, (Number(step.end) || 0) - (Number(step.start) || 0));
      return Math.max(clip, narrationEstimate(step));
    }
    if (step.type === 'image') {
      if (step.voice && step.voice.script) return narrationEstimate(step);
      if (!step.hotspot && step.autoAdvance !== false) return MIN_NARRATION;
    }
    return 0;
  }
  const durations = steps.map(baseDuration);
  const contentSteps = steps.map((s, k) => k).filter((k) => steps[k].type !== 'cover' && steps[k].type !== 'end');
  const prefix = (i) => contentSteps.filter((k) => k < i).reduce((sum, k) => sum + durations[k], 0);
  const total = () => contentSteps.reduce((sum, k) => sum + durations[k], 0);

  function buildSegments() {
    segsEl.innerHTML = contentSteps.map((k, n) =>
      `<button type="button" class="dp-seg" tabindex="-1" data-seg-step="${k}" style="--w:${Math.max(1, durations[k]).toFixed(2)}" aria-label="Go to step ${n + 1}"></button>`).join('')
      + '<span class="dp-scrub" aria-hidden="true"></span>';
  }
  buildSegments();
  const scrub = () => segsEl.querySelector('.dp-scrub');

  function updateTimeline() {
    const step = steps[st.i];
    const t = total();
    let elapsed = 0;
    if (step.type === 'end') elapsed = t;
    else if (step.type !== 'cover') elapsed = prefix(st.i) + Math.min(st.progress, durations[st.i]);
    timeEl.textContent = `${fmt(elapsed)} / ${fmt(t)}`;

    let scrubLeft = 0;
    segsEl.querySelectorAll('.dp-seg').forEach((seg) => {
      const k = Number(seg.dataset.segStep);
      let fill = 0;
      if (step.type === 'end' || k < st.i) fill = 1;
      else if (k === st.i) {
        fill = durations[k] > 0 ? Math.min(1, st.progress / durations[k]) : (st.mode === 'waiting' ? 1 : 0);
      }
      seg.style.setProperty('--fill', `${(fill * 100).toFixed(1)}%`);
      if (k === st.i || (step.type === 'end' && k === contentSteps[contentSteps.length - 1])) {
        scrubLeft = seg.offsetLeft + fill * seg.offsetWidth;
      }
    });
    const dot = scrub();
    if (dot) dot.style.left = `${scrubLeft}px`;
  }
  function setProgress(t) {
    st.progress = t;
    updateTimeline();
  }
  function setDuration(k, seconds) {
    if (!(seconds > 0) || Math.abs(durations[k] - seconds) < 0.05) return;
    durations[k] = seconds;
    const seg = segsEl.querySelector(`[data-seg-step="${k}"]`);
    if (seg) seg.style.setProperty('--w', Math.max(1, seconds).toFixed(2));
    updateTimeline();
  }

  // ---------- Per-step run: timers and listeners that end when the step ends ----------

  let run = null;
  function newRun() {
    if (run) run.stop();
    const r = {
      alive: true,
      fns: [],
      add(fn) { this.fns.push(fn); },
      later(fn, ms) {
        const id = setTimeout(() => { if (r.alive) fn(); }, ms);
        this.fns.push(() => clearTimeout(id));
      },
      stop() {
        this.alive = false;
        this.fns.splice(0).forEach((fn) => { try { fn(); } catch { /* ignore */ } });
      },
    };
    run = r;
    return r;
  }

  // A clock that counts step time, honours pause and speed, and can end at a limit.
  function clock(r, onTick) {
    let elapsed = 0;
    let last = performance.now();
    let raf = 0;
    const c = { limit: Infinity, done: null, get elapsed() { return elapsed; }, stop() { c.limit = -1; c.done = null; } };
    const frame = (now) => {
      if (!r.alive || c.limit < 0) return;
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      if (!st.paused) elapsed += dt * st.rate;
      onTick(elapsed);
      if (elapsed >= c.limit) {
        const done = c.done;
        c.limit = -1;
        c.done = null;
        if (done) done();
        return;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    r.add(() => cancelAnimationFrame(raf));
    return c;
  }

  function stopSound() {
    if (synth) { try { synth.cancel(); } catch { /* ignore */ } }
    ttsActive = false;
    media.forEach((m) => { try { m.pause(); } catch { /* ignore */ } });
    media.clear();
  }

  // ---------- Audio cache and preloading ----------

  const audioCache = new Map();
  function getAudio(src) {
    if (audioCache.has(src)) return audioCache.get(src);
    const a = new Audio();
    a.preload = 'auto';
    a.src = src;
    a.addEventListener('loadedmetadata', () => {
      steps.forEach((s, k) => {
        const audio = voiceFor(s).audio;
        if (audio && resolve(audio) === src && Number.isFinite(a.duration)) {
          setDuration(k, Math.max(a.duration, s.type === 'video' ? baseDuration(s) : 0));
        }
      });
    });
    audioCache.set(src, a);
    return a;
  }
  const imageCache = new Map();
  function preload(i) {
    for (let k = i + 1; k <= Math.min(lastIndex, i + 2); k += 1) {
      const s = steps[k];
      if (s.type === 'image') {
        srcList(s.src).forEach((src) => {
          const url = resolve(src);
          if (imageCache.has(url)) return;
          const img = new Image();
          img.decoding = 'async';
          img.src = url;
          imageCache.set(url, img);
        });
      }
      const audio = voiceFor(s).audio;
      if (audio && st.sound) getAudio(resolve(audio));
    }
  }

  // ---------- Narration ----------

  function pickVoice() {
    try {
      const voices = synth.getVoices();
      return voices.find((v) => /en-GB/i.test(v.lang) && /natural|neural|online/i.test(v.name))
        || voices.find((v) => /en-GB/i.test(v.lang))
        || voices.find((v) => /^en/i.test(v.lang))
        || null;
    } catch { return null; }
  }
  const wordIndexAt = (script, charIndex) => wordCount(script.slice(0, Math.max(0, charIndex)));

  // Plays a step's voice (mp3, browser speech, or silent timing) and calls onEnd once.
  // Video steps pass trackProgress: false because the clip drives the timeline there.
  function narrate(step, r, onEnd, opts = {}) {
    const track = opts.trackProgress !== false;
    const v = voiceFor(step);
    const script = String(v.script || '').trim();
    captions.load(script, v.timings);
    captions.setEnabled(st.cc);
    if (!script) { onEnd(); return; }

    const est = narrationEstimate(step);
    const n = captions.count;
    let finished = false;
    let mode = 'clock';
    let boundarySeen = false;

    const fin = () => {
      if (finished || !r.alive) return;
      finished = true;
      ttsActive = false;
      c.stop();
      captions.finish();
      onEnd();
    };
    const c = clock(r, (t) => {
      if (mode === 'audio') return;
      if (track) setProgress(Math.min(t, durations[st.i] || est));
      if (mode === 'clock') {
        if (captions.hasTimings) captions.setTime(t); else captions.setWord(Math.floor((t / est) * n));
      } else if (mode === 'tts') {
        if (!boundarySeen) captions.setWord(Math.floor((t / est) * n));
        if (t > est * 2.5 + 4) { try { synth.cancel(); } catch { /* ignore */ } fin(); } // safety net
      }
    });
    const silent = () => {
      mode = 'clock';
      ttsActive = false;
      if (c.elapsed >= est) { fin(); return; }
      c.limit = est;
      c.done = fin;
    };

    if (!st.sound) { silent(); return; }

    if (v.audio) {
      mode = 'audio';
      const a = getAudio(resolve(v.audio));
      const dur = () => (Number.isFinite(a.duration) && a.duration > 0 ? a.duration : est);
      const onTime = () => {
        if (track) setProgress(a.currentTime);
        if (captions.hasTimings) captions.setTime(a.currentTime);
        else captions.setWord(Math.floor((a.currentTime / dur()) * n));
      };
      // timeupdate fires only about four times a second, so captions would trail the voice
      // by up to a word. Update on every frame while playing; timeupdate stays as the
      // fallback for background tabs, where frames pause.
      let frame = 0;
      const everyFrame = () => {
        if (!a.paused) onTime();
        frame = requestAnimationFrame(everyFrame);
      };
      frame = requestAnimationFrame(everyFrame);
      const cleanup = () => {
        cancelAnimationFrame(frame);
        a.removeEventListener('timeupdate', onTime);
        a.removeEventListener('ended', onEnded);
        a.removeEventListener('error', onError);
        try { a.pause(); } catch { /* ignore */ }
        media.delete(a);
      };
      const onEnded = () => { cleanup(); fin(); };
      const onError = () => { cleanup(); if (!finished && r.alive) silent(); };
      a.addEventListener('timeupdate', onTime);
      a.addEventListener('ended', onEnded);
      a.addEventListener('error', onError);
      r.add(cleanup);
      try { a.currentTime = 0; } catch { /* not seekable yet */ }
      a.playbackRate = st.rate;
      media.add(a);
      const p = a.play();
      if (p && p.catch) p.catch(() => { if (r.alive && !finished) { cleanup(); silent(); } });
      return;
    }

    if (synth) {
      mode = 'tts';
      let startedSpeaking = false;
      const u = new SpeechSynthesisUtterance(script);
      u.rate = Math.min(2, st.rate);
      const voice = pickVoice();
      if (voice) { u.voice = voice; u.lang = voice.lang; } else { u.lang = 'en-GB'; }
      u.onstart = () => { startedSpeaking = true; };
      u.onboundary = (e) => {
        if (!r.alive || (e.name && e.name !== 'word')) return;
        boundarySeen = true;
        captions.setWord(wordIndexAt(script, e.charIndex));
      };
      u.onend = () => { if (r.alive && mode === 'tts') fin(); };
      u.onerror = () => {
        if (!r.alive || finished || mode !== 'tts') return;
        if (startedSpeaking) fin(); else silent();
      };
      r.add(() => { try { synth.cancel(); } catch { /* ignore */ } });
      // No voices, blocked speech, or a stalled engine: fall back to silent timing.
      r.later(() => {
        if (!startedSpeaking && !finished && mode === 'tts') {
          try { synth.cancel(); } catch { /* ignore */ }
          silent();
        }
      }, 1500);
      try { synth.cancel(); } catch { /* ignore */ }
      ttsActive = true;
      r.later(() => {
        try { synth.speak(u); } catch { silent(); }
      }, 60);
      return;
    }

    silent();
  }

  // ---------- Layers ----------

  function altFor(i) {
    const step = steps[i];
    if (step.alt) return step.alt;
    if (step.voice && step.voice.script) return step.voice.script;
    for (let k = i - 1; k >= 0; k -= 1) {
      if (srcKey(steps[k]) !== srcKey(step)) break;
      if (steps[k].voice && steps[k].voice.script) return steps[k].voice.script;
    }
    if (step.hotspot && step.hotspot.label) return `Screen with the next control: ${step.hotspot.label}`;
    return `Step ${i} screen`;
  }

  function mediaLayer(i) {
    const step = steps[i];
    const current = layersEl.lastElementChild;
    if (step.type === 'image' && current && current.dataset.kind === 'image'
      && current.dataset.src === srcKey(step) && !current.dataset.leaving) {
      const img = current.querySelector('img');
      if (img) img.alt = altFor(i);
      return current;
    }
    const layer = document.createElement('div');
    layer.className = 'dp-layer';
    layer.dataset.kind = step.type;
    layer.dataset.src = srcKey(step);
    if (step.type === 'video') {
      const sources = srcList(step.src).map((src) => {
        const ext = (src.split('?')[0].split('.').pop() || '').toLowerCase();
        const type = { webm: 'video/webm', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', ogv: 'video/ogg' }[ext];
        return `<source src="${esc(resolve(src))}"${type ? ` type="${type}"` : ''}>`;
      }).join('');
      layer.innerHTML = `<video playsinline preload="auto" muted aria-label="${esc(altFor(i))}">${sources}</video>`;
    } else {
      layer.innerHTML = `<img alt="${esc(altFor(i))}" decoding="async" draggable="false" src="${esc(resolve(srcList(step.src)[0]))}">`;
    }
    return layer;
  }

  function cardLayer(i) {
    const step = steps[i];
    const isEnd = step.type === 'end';
    const cover = steps.find((s) => s.type === 'cover') || {};
    const logo = step.logo || cover.logo;
    const logoText = step.logoText || cover.logoText || '';
    const bg = step.bg ? resolve(step.bg) : '';
    const title = step.title || (isEnd ? 'Thank you for watching!' : name);
    let actions;
    if (isEnd) {
      const buttons = Array.isArray(step.buttons) && step.buttons.length ? step.buttons : [{ text: 'Replay', action: 'restart' }];
      actions = buttons.map((b, n) => {
        const cls = n === 0 ? 'dp-cta' : 'dp-cta secondary';
        if (b.action === 'url' && b.href) {
          const href = String(b.href);
          // https, in-page and same-site links only; anything else becomes a dead link.
          const safe = /^(https:\/\/|#|\/(?!\/)|\.\/)/i.test(href) ? href : '#';
          const external = /^https:/i.test(safe);
          return `<a class="${cls}" href="${esc(safe)}"${external ? ' target="_blank" rel="noopener"' : ''}>${esc(b.text || 'Open')}</a>`;
        }
        return `<button type="button" class="${cls}" data-act="replay">${esc(b.text || 'Replay')}</button>`;
      }).join('');
    } else {
      actions = `<button type="button" class="dp-cta" data-act="start">${esc(step.buttonText || 'Get Started')}</button>`;
    }
    const layer = document.createElement('div');
    layer.className = 'dp-layer dp-card';
    layer.dataset.kind = step.type;
    layer.innerHTML = `
      <div class="dp-card-bg${bg ? ' has-image' : ''}"></div>
      <span class="dp-blob a" aria-hidden="true"></span><span class="dp-blob b" aria-hidden="true"></span>
      <div class="dp-card-body${step.align === 'center' ? ' center' : ''}">
        ${logo || logoText ? `<div class="dp-logo-row">${logo ? `<img class="dp-logo" src="${esc(resolve(logo))}" alt="">` : '<span class="dp-logo-dot" aria-hidden="true"></span>'}${logoText ? `<span class="dp-wordmark">${esc(logoText)}</span>` : ''}</div>` : ''}
        <h2 class="dp-card-title">${esc(title)}</h2>
        ${step.subtitle ? `<p class="dp-card-sub">${inlineMarkdown(step.subtitle)}</p>` : ''}
        <div class="dp-card-actions">${actions}</div>
      </div>
      ${isEnd && flow.showBadge === true ? `<a class="dp-made" href="${BADGE_URL}" target="_blank" rel="noopener">Made with Demo Anything<span class="dp-sr"> (opens in a new tab)</span></a>` : ''}`;
    // Set through the DOM so an unusual file name can't break out of the style value.
    if (bg) layer.querySelector('.dp-card-bg').style.backgroundImage = `url(${JSON.stringify(bg)})`;
    return layer;
  }

  function showLayer(layer) {
    if (layer.parentNode !== layersEl) layersEl.appendChild(layer);
    Array.from(layersEl.children).forEach((child) => {
      if (child === layer || child.dataset.leaving) return;
      // Don't strand keyboard focus on a button that is about to disappear.
      if (child.contains(document.activeElement)) dp.focus({ preventScroll: true });
      child.dataset.leaving = '1';
      child.classList.remove('on');
      const v = child.querySelector('video');
      if (v) { try { v.pause(); } catch { /* ignore */ } }
      setTimeout(() => child.remove(), 220);
    });
    if (!layer.classList.contains('on')) {
      void layer.offsetWidth; // let the browser see opacity 0 first, so it fades
      layer.classList.add('on');
    }
  }

  function layerReady(layer) {
    const img = layer.querySelector('img');
    if (img) {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      return new Promise((res) => {
        img.addEventListener('load', res, { once: true });
        img.addEventListener('error', res, { once: true });
      });
    }
    const vid = layer.querySelector('video');
    if (vid) {
      if (vid.readyState >= 1) return Promise.resolve();
      return new Promise((res) => {
        const done = () => res();
        vid.addEventListener('loadedmetadata', done, { once: true });
        vid.addEventListener('error', done, { once: true });
        const sources = vid.querySelectorAll('source');
        if (sources.length) sources[sources.length - 1].addEventListener('error', done, { once: true });
        setTimeout(done, 2500);
      });
    }
    return Promise.resolve();
  }

  // Map a 0–1 point on the screenshot to pixels inside the stage, allowing for letterboxing.
  function mapPoint(layer, pt) {
    const W = stage.clientWidth;
    const H = stage.clientHeight;
    const m = layer && layer.querySelector('img, video');
    const nw = m ? (m.naturalWidth || m.videoWidth || 0) : 0;
    const nh = m ? (m.naturalHeight || m.videoHeight || 0) : 0;
    if (!nw || !nh) return { x: pt.x * W, y: pt.y * H };
    const s = Math.min(W / nw, H / nh);
    const w = nw * s;
    const h = nh * s;
    return { x: (W - w) / 2 + pt.x * w, y: (H - h) / 2 + pt.y * h };
  }

  // ---------- Hotspot, hint and cursor ----------

  function placeHotspot() {
    if (!st.hs) return;
    const pos = mapPoint(st.hs.layer, st.hs.step.hotspot);
    hotspot.show(st.hs.step.hotspot, pos, { w: stage.clientWidth, h: stage.clientHeight });
  }
  function hideHotspot() {
    st.hs = null;
    // Park focus on the player rather than letting it fall to the page when a focused hotspot hides.
    if (document.activeElement === hotspot.el) dp.focus({ preventScroll: true });
    hotspot.hide();
  }
  // Move focus for keyboard users only when it isn't sitting on some other control they chose.
  function focusIsFree() {
    const ae = document.activeElement;
    return !ae || ae === document.body || ae === dp || ae === hotspot.el;
  }
  function showHint() {
    const touch = dp.classList.contains('narrow') || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    hintEl.textContent = touch ? 'Tap the pulsing dot to continue' : 'Click the pulsing dot to continue';
    // Keep the hint away from the hotspot: at the top normally, at the bottom when the dot is high up.
    const high = st.hs && st.hs.step.hotspot && st.hs.step.hotspot.y < 0.25;
    hintEl.classList.toggle('low', !!high);
    hintEl.hidden = false;
  }
  function hideHint() { hintEl.hidden = true; }

  function cursorPixels(point) {
    const w = cursorEl.offsetWidth || 22;
    const nudge = Math.max(4, 8 * (stage.clientWidth / 1150));
    return { x: point.x + nudge - CURSOR_TIP.x * w, y: point.y + nudge - CURSOR_TIP.y * w };
  }
  function setCursor(point, animate) {
    const p = cursorPixels(point);
    if (!animate) cursorEl.style.transition = 'none';
    cursorEl.style.transform = `translate(${p.x}px, ${p.y}px)`;
    if (!animate) { void cursorEl.offsetWidth; cursorEl.style.transition = ''; }
  }
  function hideCursor() {
    cursorEl.hidden = true;
    st.cursor = null;
  }
  // The cursor glides to this step's hotspot, or to the next step's hotspot on the same screen.
  function moveCursorFor(i, layer) {
    const step = steps[i];
    let target = step.hotspot;
    const nextStep = steps[i + 1];
    if (!target && nextStep && nextStep.hotspot && nextStep.type === 'image' && srcKey(nextStep) === srcKey(step)) {
      target = nextStep.hotspot;
    }
    if (!target) return;
    const point = mapPoint(layer, target);
    if (cursorEl.hidden) {
      cursorEl.hidden = false;
      setCursor({ x: point.x - stage.clientWidth * 0.08, y: point.y + stage.clientHeight * 0.12 }, false);
    }
    requestAnimationFrame(() => setCursor(point, true));
    st.cursor = { layer, target };
  }

  // ---------- Modes and controls ----------

  function setMode(mode) {
    st.mode = mode;
    dp.dataset.mode = mode;
    const playBtn = btn('play');
    const pausedLike = mode === 'paused';
    playBtn.innerHTML = ico(pausedLike ? 'play' : 'pause');
    playBtn.setAttribute('aria-label', pausedLike ? 'Play' : 'Pause');
    playBtn.disabled = !(mode === 'playing' || mode === 'paused');
    if (pausedLike) dp.classList.add('controls-on');
  }

  let hideTimer = 0;
  function showControls() {
    if (dp.classList.contains('no-controls')) return;
    dp.classList.add('controls-on');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (st.mode === 'paused' || controls.contains(document.activeElement)) return;
      dp.classList.remove('controls-on');
    }, 2000);
  }

  function updateNav() {
    btn('back').disabled = st.i <= 0;
    btn('next').disabled = st.i >= lastIndex;
  }
  function updateToggles() {
    const sound = btn('sound');
    // The label stays fixed; aria-pressed tells screen readers whether it is on.
    sound.setAttribute('aria-pressed', String(st.sound));
    sound.innerHTML = ico(st.sound ? 'sound' : 'mute');
    const cc = btn('cc');
    cc.setAttribute('aria-pressed', String(st.cc));
  }
  function updateSpeed() {
    const s = btn('speed');
    s.textContent = `${st.rate}×`;
    s.setAttribute('aria-label', `Playback speed: ${st.rate}×`);
  }

  function post(type, detail) {
    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type, flow: flow.id || flowId, ...detail }, '*'); } catch { /* ignore */ }
    }
  }

  function startMusic() {
    const music = flow.backgroundMusic;
    if (!music || !music.src) return;
    if (!bgMusic) {
      bgMusic = new Audio(resolve(music.src));
      bgMusic.loop = true;
      bgMusic.volume = Math.max(0, Math.min(1, Number(music.volume) || 0.1));
    }
    if (st.sound && !st.paused) { const p = bgMusic.play(); if (p && p.catch) p.catch(() => {}); }
  }
  function pauseMusic() { if (bgMusic) bgMusic.pause(); }

  // ---------- The state machine ----------

  function goNext() { if (st.i < lastIndex) enterStep(st.i + 1); }
  function goBack() { if (st.i > 0) enterStep(st.i - 1); }

  function enterStep(target) {
    const i = Math.max(0, Math.min(lastIndex, target));
    const r = newRun();
    stopSound();
    st.paused = false;
    st.i = i;
    st.progress = 0;
    hideHotspot();
    hideHint();
    captions.clear();
    const step = steps[i];
    dp.dataset.step = String(i);
    dp.dataset.type = step.type;
    updateNav();
    preload(i);
    post('demo:step', { index: i, total: steps.length, stepType: step.type });

    if (step.type === 'cover' || step.type === 'end' || !['image', 'video'].includes(step.type)) {
      const isEnd = step.type === 'end';
      setMode(isEnd ? 'end' : 'cover');
      dp.classList.add('no-controls');
      dp.classList.remove('controls-on');
      hideCursor();
      const layer = cardLayer(i);
      showLayer(layer);
      statusEl.textContent = isEnd ? 'End of the demo.' : '';
      if (isEnd) { pauseMusic(); post('demo:complete', { total: steps.length }); }
      if (st.kbd && focusIsFree()) { const first = layer.querySelector('.dp-cta'); if (first) first.focus({ preventScroll: true }); }
      updateTimeline();
      return;
    }

    dp.classList.remove('no-controls');
    if (st.started) startMusic();
    const n = contentSteps.indexOf(i) + 1;
    statusEl.textContent = `Step ${n} of ${contentSteps.length}`;
    const layer = mediaLayer(i);
    showLayer(layer);
    updateTimeline();

    if (step.type === 'video') {
      hideCursor();
      setMode('playing');
      playVideoStep(step, r, layer);
      return;
    }

    const hasVoice = !!(step.voice && step.voice.script);
    setMode(hasVoice || (!step.hotspot && step.autoAdvance !== false) ? 'playing' : 'waiting');
    layerReady(layer).then(() => {
      if (!r.alive) return;
      moveCursorFor(i, layer);
      if (hasVoice) {
        narrate(step, r, () => afterPlay(step, r, layer));
      } else if (step.hotspot) {
        enterWaiting(step, r, layer);
      } else if (step.autoAdvance !== false) {
        const c = clock(r, (t) => setProgress(Math.min(t, MIN_NARRATION)));
        c.limit = MIN_NARRATION;
        c.done = goNext;
      } else {
        enterWaiting(step, r, layer);
      }
    });
  }

  function afterPlay(step, r, layer) {
    if (!r.alive) return;
    if (step.hotspot) enterWaiting(step, r, layer);
    else if (step.autoAdvance !== false) goNext();
    else enterWaiting(step, r, layer);
  }

  function enterWaiting(step, r, layer) {
    setMode('waiting');
    st.progress = durations[st.i];
    updateTimeline();
    if (step.hotspot) {
      st.hs = { step, layer };
      placeHotspot();
      if (st.kbd && focusIsFree()) hotspot.el.focus({ preventScroll: true });
      r.later(showHint, 4000);
    }
    const after = Number(step.autoAdvanceAfterMs);
    if (after > 0) r.later(goNext, after);
  }

  function playVideoStep(step, r, layer) {
    const vid = layer.querySelector('video');
    const start = Number(step.start) || 0;
    const end = step.end != null && Number(step.end) > start ? Number(step.end) : null;
    const clipLength = end != null ? end - start : null;
    let videoDone = false;
    let voiceDone = !(step.voice && step.voice.script);

    const join = () => {
      if (!videoDone || !voiceDone || !r.alive) return;
      afterPlay(step, r, layer);
    };
    const finishVideo = () => {
      if (videoDone) return;
      videoDone = true;
      try { vid.pause(); } catch { /* ignore */ }
      media.delete(vid);
      join();
    };

    vid.muted = step.muted !== false;
    vid.playbackRate = st.rate;
    const onTime = () => {
      if (videoDone) return;
      setProgress(Math.max(0, vid.currentTime - start));
      if (end != null && vid.currentTime >= end - 0.04) finishVideo();
    };
    const onErr = () => finishVideo();
    vid.addEventListener('timeupdate', onTime);
    vid.addEventListener('ended', finishVideo);
    vid.addEventListener('error', onErr);
    const sources = vid.querySelectorAll('source');
    const lastSource = sources[sources.length - 1];
    if (lastSource) lastSource.addEventListener('error', onErr);
    r.add(() => {
      vid.removeEventListener('timeupdate', onTime);
      vid.removeEventListener('ended', finishVideo);
      vid.removeEventListener('error', onErr);
      if (lastSource) lastSource.removeEventListener('error', onErr);
      try { vid.pause(); } catch { /* ignore */ }
      media.delete(vid);
    });

    const begin = () => {
      if (!r.alive || videoDone) return;
      try { vid.currentTime = start; } catch { /* ignore */ }
      vid.playbackRate = st.rate;
      media.add(vid);
      if (st.paused) return;
      const p = vid.play();
      if (p && p.catch) p.catch(() => finishVideo());
    };
    if (vid.readyState >= 1) begin();
    else vid.addEventListener('loadedmetadata', begin, { once: true });

    // Safety net: a clip that never loads or stalls still lets the flow continue.
    // Without an end time the limit follows the clip's real length once it is known.
    const guard = clock(r, () => {});
    guard.limit = (clipLength != null ? clipLength : 8) + 4;
    guard.done = () => finishVideo();
    if (clipLength == null) {
      vid.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(vid.duration) && guard.limit > 0) guard.limit = Math.max(0, vid.duration - start) + 4;
      }, { once: true });
    }

    if (!voiceDone) {
      narrate(step, r, () => { voiceDone = true; join(); }, { trackProgress: false });
    } else {
      captions.clear();
    }
  }

  function togglePause() {
    if (st.mode === 'playing') {
      st.paused = true;
      setMode('paused');
      media.forEach((m) => { try { m.pause(); } catch { /* ignore */ } });
      if (ttsActive && synth) { try { synth.pause(); } catch { /* ignore */ } }
      pauseMusic();
    } else if (st.mode === 'paused') {
      st.paused = false;
      setMode('playing');
      media.forEach((m) => { const p = m.play(); if (p && p.catch) p.catch(() => {}); });
      if (ttsActive && synth) { try { synth.resume(); } catch { /* ignore */ } }
      startMusic();
      showControls();
    }
  }

  function closeMenu() {
    menus.forEach((m) => { m.hidden = true; });
    dp.querySelectorAll('[aria-haspopup="menu"]').forEach((b) => b.setAttribute('aria-expanded', 'false'));
  }
  // Opens the menu next to a toggle button (or closes it if it is already open).
  function toggleMenu(toggle) {
    const m = toggle.nextElementSibling;
    const open = m.hidden;
    closeMenu();
    m.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    if (open) (m.querySelector('[aria-checked="true"]') || m.querySelector('button')).focus();
  }
  function chooseVoice(id) {
    if (!narrators.some((n) => n.id === id)) return;
    st.voice = id;
    try { localStorage.setItem(voiceKey, id); } catch { /* storage unavailable */ }
    dp.querySelectorAll('[data-act="voice-pick"]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.voice === id)));
    // Durations follow the chosen narrator's timings; real lengths arrive as audio loads.
    steps.forEach((s, k) => { durations[k] = baseDuration(s); });
    buildSegments();
    updateTimeline();
    // Restart the current line so it plays in the new voice, then announce the change
    // (restarting a step announces the step, so this has to come second).
    if (st.mode === 'playing' || st.mode === 'paused') enterStep(st.i);
    const chosen = narrators.find((n) => n.id === id);
    statusEl.textContent = `Narrator: ${chosen.label || chosen.id}`;
  }

  function act(name, el, event) {
    if (event) st.kbd = event.detail === 0;
    switch (name) {
      case 'start':
        st.started = true;
        if (synth) {
          // Speaking inside the click unlocks speech on browsers that need a user gesture.
          try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; synth.speak(u); } catch { /* ignore */ }
        }
        startMusic();
        enterStep(firstContent);
        break;
      case 'next':
        if (st.mode === 'cover') { act('start'); break; }
        goNext();
        break;
      case 'back': goBack(); break;
      case 'restart': enterStep(st.started ? firstContent : 0); break;
      case 'replay': enterStep(firstContent); break;
      case 'play': togglePause(); break;
      case 'speed': {
        const k = SPEEDS.indexOf(st.rate);
        st.rate = SPEEDS[(k + 1) % SPEEDS.length];
        media.forEach((m) => { m.playbackRate = st.rate; });
        updateSpeed();
        break;
      }
      case 'sound':
        st.sound = !st.sound;
        writePref('dp.sound', st.sound);
        updateToggles();
        if (st.sound) startMusic(); else pauseMusic();
        // Restart the current step so its narration follows the new setting.
        if (st.mode === 'playing' || st.mode === 'paused') enterStep(st.i);
        break;
      case 'cc':
        st.cc = !st.cc;
        writePref('dp.cc', st.cc);
        captions.setEnabled(st.cc);
        updateToggles();
        break;
      case 'fullscreen':
        if (fullscreenElement()) {
          const exit = document.exitFullscreen || document.webkitExitFullscreen;
          if (exit) Promise.resolve(exit.call(document)).catch(() => {});
        } else {
          const enter = dp.requestFullscreen || dp.webkitRequestFullscreen;
          if (enter) Promise.resolve(enter.call(dp)).catch(() => {});
        }
        break;
      case 'lang':
      case 'voice':
        toggleMenu(el);
        break;
      case 'lang-en': closeMenu(); btn('lang').focus(); break;
      case 'voice-pick':
        closeMenu();
        btn('voice').focus();
        chooseVoice(el.dataset.voice);
        break;
      default: break;
    }
  }

  // ---------- Events ----------

  dp.addEventListener('click', (e) => {
    const target = e.target.closest('[data-act]');
    if (target && dp.contains(target)) {
      e.stopPropagation();
      act(target.dataset.act, target, e);
      return;
    }
    const seg = e.target.closest('[data-seg-step]');
    if (seg) {
      st.kbd = false;
      enterStep(Number(seg.dataset.segStep));
      return;
    }
    if (!e.target.closest('.dp-menu-wrap')) closeMenu();
  });

  stage.addEventListener('click', (e) => {
    if (e.target.closest('.dp-hs, .dp-controls, [data-act], a')) return;
    if (st.mode === 'waiting' && hotspot.visible) {
      hotspot.nudge();
    } else if (st.mode === 'playing' || st.mode === 'paused') {
      showControls();
    }
  });
  stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') showControls(); });
  stage.addEventListener('touchstart', showControls, { passive: true });
  controls.addEventListener('focusin', showControls);

  document.addEventListener('click', (e) => { if (!dp.contains(e.target)) closeMenu(); });

  document.addEventListener('keydown', (e) => {
    const openMenu = menus.find((m) => !m.hidden);
    if (e.key === 'Escape') {
      if (openMenu) { closeMenu(); openMenu.previousElementSibling.focus(); }
      return;
    }
    // Up and Down move through an open menu's items.
    if (openMenu && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && openMenu.contains(e.target)) {
      e.preventDefault();
      const items = [...openMenu.querySelectorAll('button')];
      const k = items.indexOf(e.target);
      items[(k + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
      return;
    }
    if (!keyboardNav || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable="true"], .dp-menu')) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      st.kbd = true;
      if (st.mode === 'cover') act('start'); else goNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      st.kbd = true;
      goBack();
    } else if (e.key === ' ' || e.code === 'Space') {
      if (t && t.closest && t.closest('button, a, summary')) return; // let Space press the focused control
      e.preventDefault();
      if (st.mode === 'cover') { st.kbd = true; act('start'); } else togglePause();
    }
  });

  const onFullscreen = () => {
    const on = fullscreenElement() === dp;
    const fs = btn('fullscreen');
    fs.innerHTML = ico(on ? 'collapse' : 'expand');
    fs.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  };
  document.addEventListener('fullscreenchange', onFullscreen);
  document.addEventListener('webkitfullscreenchange', onFullscreen);
  // iPhone Safari can't put a page element in full screen, so don't offer a button that does nothing.
  if (!dp.requestFullscreen && !dp.webkitRequestFullscreen) btn('fullscreen').hidden = true;

  const relayout = () => {
    const w = stage.clientWidth;
    dp.style.setProperty('--u', String(Math.max(0.2, w / 1150)));
    dp.classList.toggle('narrow', dp.clientWidth < 640);
    // Fewer words per caption on small players, so a caption stays within two lines.
    captions.setChunk(w >= 760 ? 12 : w >= 520 ? 8 : 5);
    if (st.hs) placeHotspot();
    if (st.cursor && !cursorEl.hidden) setCursor(mapPoint(st.cursor.layer, st.cursor.target), false);
    updateTimeline();
  };
  if (typeof ResizeObserver === 'function') new ResizeObserver(relayout).observe(stage);
  else window.addEventListener('resize', relayout);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);

  if (synth && typeof synth.getVoices === 'function') {
    try { synth.getVoices(); } catch { /* voices load later in some browsers */ }
  }

  updateToggles();
  updateSpeed();
  relayout();
  enterStep(0);
}
