// Captions shown over the stage.
// With word timings, the current word follows the audio. Without them, the player feeds an
// estimated word index. Either way the text is shown in chunks that fit on two lines: 12 words
// on a full-size player, fewer on small ones (the player sets this with setChunk).

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function createCaptions(overlay) {
  const box = document.createElement('div');
  box.className = 'dp-captions';
  box.hidden = true;
  box.setAttribute('aria-hidden', 'true');

  // Screen readers get each chunk once, not every word update.
  const live = document.createElement('div');
  live.className = 'dp-sr';
  live.setAttribute('aria-live', 'polite');

  overlay.append(box, live);

  let words = [];
  let timings = null;
  let enabled = true;
  let chunkSize = 12;
  let lastIdx = -2;
  let lastChunk = -1;

  function render(idx) {
    if (!words.length) {
      box.hidden = true;
      return;
    }
    if (idx === lastIdx) return;
    lastIdx = idx;
    const anchor = Math.max(0, Math.min(words.length - 1, idx));
    const chunk = Math.floor(anchor / chunkSize);
    const start = chunk * chunkSize;
    const end = Math.min(words.length, start + chunkSize);
    const html = words.slice(start, end).map((w, k) => {
      const n = start + k;
      const cls = n < idx ? '' : n === idx ? 'w-on' : 'w-f';
      return cls ? `<span class="${cls}">${esc(w)}</span>` : esc(w);
    }).join(' ');
    box.innerHTML = `<span class="dp-cap">${html}</span>`;
    box.hidden = !enabled;
    if (chunk !== lastChunk) {
      lastChunk = chunk;
      live.textContent = enabled ? words.slice(start, end).join(' ') : '';
    }
  }

  return {
    get count() { return words.length; },
    get hasTimings() { return !!timings; },
    load(script, wordTimings) {
      timings = Array.isArray(wordTimings) && wordTimings.length ? wordTimings : null;
      words = timings
        ? timings.map((t) => String(t.word))
        : String(script || '').trim().split(/\s+/).filter(Boolean);
      lastIdx = -2;
      lastChunk = -1;
      render(-1);
    },
    setEnabled(on) {
      enabled = !!on;
      if (!enabled) live.textContent = '';
      box.hidden = !enabled || !words.length;
      if (enabled && words.length) { const i = lastIdx; lastIdx = -2; render(i); }
    },
    setChunk(n) {
      const size = Math.max(3, Math.round(n));
      if (size === chunkSize) return;
      chunkSize = size;
      const i = lastIdx;
      lastIdx = -2;
      lastChunk = -1;
      if (words.length) render(i === -2 ? -1 : i);
    },
    setWord(idx) { render(Math.max(-1, Math.min(words.length - 1, idx))); },
    setTime(t) {
      if (!timings) return;
      let idx = -1;
      for (let k = 0; k < timings.length; k += 1) {
        if (timings[k].t <= t) idx = k; else break;
      }
      render(idx);
    },
    finish() { render(words.length - 1); },
    clear() {
      words = [];
      timings = null;
      lastIdx = -2;
      lastChunk = -1;
      box.hidden = true;
      box.innerHTML = '';
      live.textContent = '';
    },
  };
}
