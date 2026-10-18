// Authoring mode (?edit or #edit).
// Pick a step, click the screenshot to place its hotspot, edit the text, then export flow.json.

const TYPES = ['cover', 'image', 'video', 'end'];

const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const srcList = (src) => (Array.isArray(src) ? src : [src]).filter(Boolean);
const round4 = (n) => Math.round(n * 10000) / 10000;

export function mountEditor(root, flow, base) {
  document.documentElement.classList.add('editing');
  const data = JSON.parse(JSON.stringify(flow));
  const steps = data.steps;
  const previews = new Map(); // dropped files not yet copied into assets/: src -> object URL
  const flowId = data.id || base.split('/').filter(Boolean).pop();
  const ratio = Number(data.aspectRatio) > 0 ? Number(data.aspectRatio) : 0.5625;
  let sel = Math.min(1, steps.length - 1);
  let deleteArmed = false;
  let deleteTimer = 0;

  const resolve = (p) => previews.get(p) || (!p ? '' : /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(p) ? p : base + p);
  const playerHref = (() => {
    const u = new URL(location.href);
    u.searchParams.delete('edit');
    u.hash = '';
    return u.pathname + u.search;
  })();

  document.title = `Edit: ${data.name || flowId}`;
  root.innerHTML = `
    <div class="ed">
      <header class="ed-head">
        <div>
          <div class="ed-kicker">Authoring mode · ${esc(flowId)}</div>
          <h1 class="ed-title">${esc(data.name || flowId)}</h1>
        </div>
        <div class="ed-actions">
          <a class="ed-btn" href="${esc(playerHref)}">Open player</a>
          <button type="button" class="ed-btn" data-ed="copy">Copy to clipboard</button>
          <button type="button" class="ed-btn primary" data-ed="export">Export flow.json</button>
        </div>
      </header>
      <p class="ed-msg" role="status" hidden></p>
      <div class="ed-body">
        <aside class="ed-list" aria-label="Steps"><ol></ol></aside>
        <section class="ed-main">
          <div class="ed-canvas" style="--ar-num:${1 / ratio}" aria-label="Screenshot. Click to place the hotspot."></div>
          <div class="ed-fields"></div>
        </section>
      </div>
      <details class="ed-json">
        <summary>flow.json preview</summary>
        <textarea readonly spellcheck="false" aria-label="flow.json"></textarea>
      </details>
    </div>`;

  const listEl = root.querySelector('.ed-list ol');
  const canvas = root.querySelector('.ed-canvas');
  const fields = root.querySelector('.ed-fields');
  const jsonEl = root.querySelector('.ed-json textarea');
  const msgEl = root.querySelector('.ed-msg');

  let msgTimer = 0;
  function say(text, kind = 'ok') {
    msgEl.textContent = text;
    msgEl.className = `ed-msg${kind === 'warn' ? ' warn' : ''}`;
    msgEl.hidden = false;
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => { msgEl.hidden = true; }, kind === 'warn' ? 12000 : 5000);
  }

  const json = () => `${JSON.stringify(data, null, 2)}\n`;

  // ---------- Step list ----------

  function summary(s) {
    if (s.type === 'cover' || s.type === 'end') return s.title || (s.type === 'end' ? 'Thank you for watching!' : 'Cover');
    if (s.voice && s.voice.script) return s.voice.script;
    if (s.hotspot) return s.hotspot.label ? `Click: ${s.hotspot.label}` : 'Click to continue';
    return srcList(s.src)[0] || 'No screen yet';
  }
  function badge(s) {
    if (s.type === 'image' && s.autoAdvance === false && !s.hotspot && !s.autoAdvanceAfterMs) return ['problem', 'no hotspot'];
    if (s.type === 'image' && s.hotspot && !(s.voice && s.voice.script)) return ['checkpoint', 'checkpoint'];
    if (s.type === 'image' && s.voice && s.voice.script) return ['', s.hotspot ? 'narration + click' : 'narration'];
    return ['', s.type];
  }

  function renderList() {
    listEl.innerHTML = steps.map((s, k) => {
      const [cls, text] = badge(s);
      return `<li><button type="button" class="ed-item${k === sel ? ' sel' : ''}" data-index="${k}"${k === sel ? ' aria-current="true"' : ''}>
        <span class="ed-num">${k}</span><span class="ed-sum">${esc(summary(s))}</span><span class="ed-type ${cls}">${esc(text)}</span>
      </button></li>`;
    }).join('');
  }

  // ---------- Canvas ----------

  function contentRect() {
    const m = canvas.querySelector('img, video');
    const W = canvas.clientWidth;
    const H = canvas.clientHeight;
    const nw = m ? (m.naturalWidth || m.videoWidth || 0) : 0;
    const nh = m ? (m.naturalHeight || m.videoHeight || 0) : 0;
    if (!nw || !nh) return { left: 0, top: 0, width: W, height: H };
    const sc = Math.min(W / nw, H / nh);
    return { left: (W - nw * sc) / 2, top: (H - nh * sc) / 2, width: nw * sc, height: nh * sc };
  }

  function drawCross() {
    canvas.querySelectorAll('.ed-cross').forEach((el) => el.remove());
    const s = steps[sel];
    if (!s || !s.hotspot) return;
    const r = contentRect();
    const cross = document.createElement('div');
    cross.className = 'ed-cross';
    cross.style.left = `${r.left + s.hotspot.x * r.width}px`;
    cross.style.top = `${r.top + s.hotspot.y * r.height}px`;
    cross.innerHTML = '<span></span>';
    canvas.appendChild(cross);
  }

  function renderCanvas() {
    const s = steps[sel];
    canvas.innerHTML = '';
    if (s.type === 'image' || s.type === 'video') {
      const src = srcList(s.src)[0];
      if (!src) {
        canvas.innerHTML = '<div class="ed-empty">Drop a screenshot here, or type its file name in Source.</div>';
        return;
      }
      canvas.innerHTML = s.type === 'video'
        ? `<video muted playsinline preload="metadata" src="${esc(resolve(src))}"></video>`
        : `<img alt="" src="${esc(resolve(src))}">`;
      const m = canvas.firstElementChild;
      m.addEventListener('load', drawCross);
      m.addEventListener('loadedmetadata', drawCross);
      m.addEventListener('error', () => say(`Couldn't load ${src}. Check the file is in flows/${flowId}/assets/.`, 'warn'));
      drawCross();
    } else {
      const bg = s.bg ? resolve(s.bg) : '';
      canvas.innerHTML = `${bg ? `<img alt="" src="${esc(bg)}">` : ''}<div class="ed-empty">${s.type === 'cover' ? 'Cover card' : 'End card'}. Edit its text below. Drop an image here to use it as the background.</div>`;
    }
  }

  // ---------- Fields ----------

  const field = (label, control, wide = false) => `<label class="ed-field${wide ? ' wide' : ''}">${esc(label)}${control}</label>`;
  const text = (key, value, attrs = '') => `<input type="text" data-f="${key}" value="${esc(value)}"${attrs}>`;
  const num = (key, value) => `<input type="number" step="0.1" min="0" data-f="${key}" value="${value ?? ''}">`;
  const check = (key, label, on) => `<label class="ed-field ed-check"><input type="checkbox" data-f="${key}"${on ? ' checked' : ''}>${esc(label)}</label>`;

  function renderFields() {
    const s = steps[sel];
    const parts = [];
    parts.push(field('Type', `<select data-f="type">${TYPES.map((t) => `<option value="${t}"${t === s.type ? ' selected' : ''}>${t}</option>`).join('')}</select>`));
    if (s.type === 'image' || s.type === 'video') {
      parts.push(field(s.type === 'video' ? 'Source (comma-separate fallbacks)' : 'Source', text('src', srcList(s.src).join(', '))));
      if (s.type === 'video') {
        parts.push(field('Start (seconds)', num('start', s.start ?? 0)));
        parts.push(field('End (seconds)', num('end', s.end ?? '')));
        parts.push(check('muted', 'Mute the clip', s.muted !== false));
      }
      parts.push(field('Narration script', `<textarea data-f="script">${esc((s.voice && s.voice.script) || '')}</textarea>`, true));
      parts.push(field('Hotspot label (tooltip)', text('label', (s.hotspot && s.hotspot.label) || '', s.hotspot ? '' : ' disabled placeholder="Place a hotspot first"')));
      if (s.hotspot) {
        // Typed coordinates, for keyboard users and fine adjustment.
        const coord = (key, value) => `<input type="number" step="0.001" min="0" max="1" data-f="${key}" value="${value}">`;
        parts.push(field('Hotspot x (0 = left, 1 = right)', coord('hx', s.hotspot.x)));
        parts.push(field('Hotspot y (0 = top, 1 = bottom)', coord('hy', s.hotspot.y)));
      }
      parts.push(check('autoAdvance', 'Continue automatically', s.autoAdvance !== false));
      parts.push(`<p class="ed-note">${s.hotspot
        ? 'Click the screenshot to move the hotspot, or type its position above.'
        : 'No hotspot. Click the screenshot to add one.'}${s.voice && s.voice.audio ? ' This step has a generated voice file; run make-voice again after changing the script.' : ''}</p>`);
      parts.push(`<div class="ed-row">
        ${s.hotspot ? '<button type="button" class="ed-btn" data-ed="remove-hs">Remove hotspot</button>' : ''}
        ${s.type === 'image' && s.voice && s.voice.script ? '<button type="button" class="ed-btn" data-ed="dup">Duplicate as checkpoint</button>' : ''}
        <button type="button" class="ed-btn" data-ed="up"${sel <= 0 ? ' disabled' : ''}>Move up</button>
        <button type="button" class="ed-btn" data-ed="down"${sel >= steps.length - 1 ? ' disabled' : ''}>Move down</button>
        <button type="button" class="ed-btn danger" data-ed="delete">Delete step</button>
      </div>`);
    } else {
      parts.push(field('Title', text('title', s.title || '')));
      if (s.type === 'cover') parts.push(field('Button text', text('buttonText', s.buttonText || 'Get Started')));
      parts.push(field('Subtitle (supports [link text](https://…))', text('subtitle', s.subtitle || ''), true));
      parts.push(`<div class="ed-row">
        <button type="button" class="ed-btn" data-ed="up"${sel <= 0 ? ' disabled' : ''}>Move up</button>
        <button type="button" class="ed-btn" data-ed="down"${sel >= steps.length - 1 ? ' disabled' : ''}>Move down</button>
        <button type="button" class="ed-btn danger" data-ed="delete">Delete step</button>
      </div>`);
    }
    fields.innerHTML = parts.join('');
    deleteArmed = false;
  }

  function renderJson() { jsonEl.value = json(); }
  function renderAll() {
    renderList();
    renderCanvas();
    renderFields();
    renderJson();
  }

  function select(k) {
    sel = Math.max(0, Math.min(steps.length - 1, k));
    renderAll();
  }

  // ---------- Editing ----------

  fields.addEventListener('input', (e) => {
    const el = e.target.closest('[data-f]');
    if (!el) return;
    const s = steps[sel];
    const key = el.dataset.f;
    const value = el.type === 'checkbox' ? el.checked : el.value;
    switch (key) {
      case 'type':
        s.type = value;
        if ((value === 'image' || value === 'video') && !s.src) s.src = '';
        renderAll();
        return;
      case 'src': {
        const list = String(value).split(',').map((x) => x.trim()).filter(Boolean);
        s.src = s.type === 'video' && list.length > 1 ? list : (list[0] || '');
        renderCanvas();
        break;
      }
      case 'script':
        if (String(value).trim()) {
          s.voice = { audio: null, timings: [], ...(s.voice || {}), script: value };
        } else {
          delete s.voice;
        }
        break;
      case 'label':
        if (s.hotspot) s.hotspot.label = value;
        break;
      case 'hx':
      case 'hy': {
        const n = Number(value);
        if (!s.hotspot || value === '' || !Number.isFinite(n)) break;
        s.hotspot[key === 'hx' ? 'x' : 'y'] = round4(Math.max(0, Math.min(1, n)));
        delete s.hotspot.target;
        drawCross();
        break;
      }
      case 'autoAdvance': s.autoAdvance = !!value; break;
      case 'muted': s.muted = !!value; break;
      case 'start':
      case 'end':
        if (value === '') delete s[key]; else s[key] = Number(value);
        break;
      default:
        s[key] = value;
    }
    renderList();
    renderJson();
  });
  fields.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ed]');
    if (!b || b.disabled) return;
    const s = steps[sel];
    switch (b.dataset.ed) {
      case 'remove-hs':
        s.hotspot = null;
        renderAll();
        break;
      case 'dup': {
        const checkpoint = { type: 'image', src: s.src, hotspot: s.hotspot ? { ...s.hotspot } : null, autoAdvance: false };
        s.hotspot = null;
        s.autoAdvance = true;
        steps.splice(sel + 1, 0, checkpoint);
        select(sel + 1);
        say(checkpoint.hotspot
          ? `Added a checkpoint as step ${sel}. It keeps the hotspot you had placed.`
          : `Added a checkpoint as step ${sel}. Click the screenshot to place its hotspot.`);
        break;
      }
      case 'up':
        if (sel > 0) { [steps[sel - 1], steps[sel]] = [steps[sel], steps[sel - 1]]; select(sel - 1); }
        break;
      case 'down':
        if (sel < steps.length - 1) { [steps[sel + 1], steps[sel]] = [steps[sel], steps[sel + 1]]; select(sel + 1); }
        break;
      case 'delete':
        if (!deleteArmed) {
          deleteArmed = true;
          b.textContent = 'Click again to delete';
          clearTimeout(deleteTimer);
          deleteTimer = setTimeout(() => { deleteArmed = false; b.textContent = 'Delete step'; }, 3000);
          break;
        }
        if (steps.length <= 1) { say("A flow needs at least one step, so this one can't be deleted.", 'warn'); break; }
        steps.splice(sel, 1);
        select(Math.min(sel, steps.length - 1));
        say('Step deleted.');
        break;
      default: break;
    }
  });

  canvas.addEventListener('click', (e) => {
    const s = steps[sel];
    if (s.type !== 'image' && s.type !== 'video') return;
    if (!canvas.querySelector('img, video')) return;
    const box = canvas.getBoundingClientRect();
    const r = contentRect();
    const x = (e.clientX - box.left - canvas.clientLeft - r.left) / r.width;
    const y = (e.clientY - box.top - canvas.clientTop - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) { say('Click inside the screenshot to place the hotspot.', 'warn'); return; }
    const prev = s.hotspot || { size: 40, style: 'pulsating', label: '' };
    s.hotspot = { ...prev, x: round4(x), y: round4(y) };
    delete s.hotspot.target; // a hand-placed hotspot no longer follows the generated placeholder position
    drawCross();
    renderList();
    renderFields();
    renderJson();
  });

  listEl.addEventListener('click', (e) => {
    const item = e.target.closest('[data-index]');
    if (item) select(Number(item.dataset.index));
  });

  // ---------- Drag an image onto a step ----------

  function useFile(k, file) {
    if (!file) return;
    const isImage = /^image\//.test(file.type);
    const isVideo = /^video\//.test(file.type);
    if (!isImage && !isVideo) { say(`${file.name} isn't an image or video file.`, 'warn'); return; }
    const src = `assets/${file.name}`;
    previews.set(src, URL.createObjectURL(file));
    const s = steps[k];
    if (s.type === 'cover' || s.type === 'end') s.bg = src;
    else s.src = src;
    select(k);
    say(`Step ${k} now uses ${file.name}. Copy the file into flows/${flowId}/assets/ before you ship the flow.`, 'warn');
  }
  const allowDrop = (e) => {
    if (!e.dataTransfer || !Array.from(e.dataTransfer.types || []).includes('Files')) return false;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    return true;
  };
  listEl.addEventListener('dragover', (e) => {
    const item = e.target.closest('[data-index]');
    if (!item || !allowDrop(e)) return;
    listEl.querySelectorAll('.drop').forEach((el) => el.classList.remove('drop'));
    item.classList.add('drop');
  });
  listEl.addEventListener('dragleave', (e) => {
    const item = e.target.closest('[data-index]');
    if (item) item.classList.remove('drop');
  });
  listEl.addEventListener('drop', (e) => {
    const item = e.target.closest('[data-index]');
    if (!item) return;
    e.preventDefault();
    item.classList.remove('drop');
    useFile(Number(item.dataset.index), e.dataTransfer.files[0]);
  });
  canvas.addEventListener('dragover', (e) => { if (allowDrop(e)) canvas.classList.add('drop'); });
  canvas.addEventListener('dragleave', () => canvas.classList.remove('drop'));
  canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    canvas.classList.remove('drop');
    useFile(sel, e.dataTransfer.files[0]);
  });

  // ---------- Export and copy ----------

  root.querySelector('[data-ed="export"]').addEventListener('click', () => {
    const blob = new Blob([json()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flow.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    say(`Saving flow.json. Put it in flows/${flowId}/, replacing the old one. If nothing downloads (some embedded views block downloads), use Copy to clipboard.`);
  });

  root.querySelector('[data-ed="copy"]').addEventListener('click', () => {
    const fallback = () => {
      root.querySelector('.ed-json').open = true;
      jsonEl.focus();
      jsonEl.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { ok = false; }
      say(ok ? 'Copied flow.json to the clipboard.' : 'Copying was blocked here. The JSON is selected below; press Ctrl+C (or Cmd+C) to copy it.', ok ? 'ok' : 'warn');
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(json()).then(() => say('Copied flow.json to the clipboard.'), fallback);
    } else {
      fallback();
    }
  });

  if (typeof ResizeObserver === 'function') new ResizeObserver(drawCross).observe(canvas);
  renderAll();
}
