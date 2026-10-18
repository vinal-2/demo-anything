// Text and timing helpers for narration. No I/O here, so every function is easy to test.

// Silence added before and after every narration file, in seconds.
export const PAD_SECONDS = 0.15;

// Pause weights, in "letters", added after a word that ends in punctuation.
const PAUSE_AFTER = { ',': 4, ';': 5, ':': 5, '.': 8, '!': 8, '?': 8 };
const MAX_WORDS = 30;
const r3 = (n) => Math.round(n * 1000) / 1000;

export const words = (text) => String(text || '').trim().split(/\s+/).filter(Boolean);

// Estimated word start times for audio that has no timings of its own.
// Each word is weighted by its length, plus a short pause after , . ; : ! ?
export function estimateTimings(text, durationSec, { lead = PAD_SECONDS, tail = PAD_SECONDS } = {}) {
  const list = words(text);
  if (!list.length) return [];
  const weights = list.map((w) => {
    const letters = w.replace(/[^\p{L}\p{N}]/gu, '').length;
    const pause = PAUSE_AFTER[w.at(-1)] || 0;
    return { speak: Math.max(2, letters), pause };
  });
  // The last word's pause runs into the tail silence, so it doesn't take speaking time.
  const units = weights.reduce((sum, w, k) => sum + w.speak + (k < weights.length - 1 ? w.pause : 0), 0);
  const speaking = Math.max(0.1, durationSec - lead - tail);
  const perUnit = speaking / units;
  let at = lead;
  return list.map((word, k) => {
    const timing = { t: r3(at), word };
    at += (weights[k].speak + weights[k].pause) * perUnit;
    return timing;
  });
}

// Replaces whole words or phrases with how they should be said. Longest keys first, so
// "LAB-WS22-01" wins over "LAB". Only the text sent to the voice changes, never the captions.
export function applyLexicon(text, lexicon = {}) {
  const keys = Object.keys(lexicon).filter(Boolean).sort((a, b) => b.length - a.length);
  if (!keys.length) return String(text);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}])(?:${escaped.join('|')})(?![\\p{L}\\p{N}])`, 'gu');
  return String(text).replace(pattern, (match) => lexicon[match]);
}

// Moves timings from the words that were spoken back onto the words in the caption.
// Same number of words: matched by position. Otherwise: proportionally through the list.
export function mapTimings(originalText, spokenTimings) {
  const original = words(originalText);
  if (!original.length || !spokenTimings?.length) return [];
  if (spokenTimings.length === original.length) {
    return original.map((word, k) => ({ t: spokenTimings[k].t, word }));
  }
  const last = spokenTimings.length - 1;
  let previous = 0;
  return original.map((word, k) => {
    const j = original.length === 1 ? 0 : Math.round((k * last) / (original.length - 1));
    const t = Math.max(previous, spokenTimings[j].t);
    previous = t;
    return { t, word };
  });
}

// Adds an offset (for example the lead-in silence) to provider timings.
export const shiftTimings = (timings, seconds) => timings.map(({ t, word }) => ({ t: r3(t + seconds), word }));

// Problems that make a script read badly aloud, each with a suggested rewrite.
export function checkScript(script) {
  const text = String(script || '').trim();
  const issues = [];
  const count = words(text).length;
  if (count > MAX_WORDS) issues.push(`${count} words; keep it to ${MAX_WORDS} or fewer, or split it into two steps`);
  if (/[()[\]{}]/.test(text)) issues.push('brackets: say it as part of the sentence instead');
  if (/[/\\]/.test(text)) issues.push('slashes: use "or" or "and"');
  const symbols = [...new Set(text.match(/[&%#@*+=<>|~^_]/g) || [])];
  if (symbols.length) issues.push(`symbols ${symbols.join(' ')}: spell them out`);
  if (/\b(?:e\.g\.|i\.e\.|etc\.)/i.test(text)) issues.push('abbreviations like e.g. and etc.: write "for example" or "and so on"');
  if (!issues.length) return null;
  return { issues, suggestion: suggestRewrite(text, count) };
}

function suggestRewrite(text, count) {
  let out = text
    .replace(/\s*\(([^)]*)\)/g, ', $1,')
    .replace(/\s*\[([^\]]*)\]/g, ', $1,')
    .replace(/\s*&\s*/g, ' and ')
    .replace(/(\d)\s*%/g, '$1 per cent')
    .replace(/\s*\+\s*/g, ' plus ')
    .replace(/\s*=\s*/g, ' equals ')
    .replace(/\s*@\s*/g, ' at ')
    .replace(/#(\d)/g, 'number $1')
    .replace(/\b(\w+)\s*\/\s*(\w+)\b/g, '$1 or $2')
    .replace(/\be\.g\./gi, 'for example')
    .replace(/\bi\.e\./gi, 'that is')
    .replace(/\betc\./gi, 'and so on')
    .replace(/[{}<>|~^_*\\]/g, ' ')
    .replace(/,\s*,/g, ',')
    .replace(/,\s*([.!?])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
  if (count > MAX_WORDS) {
    const list = words(out);
    const middle = Math.floor(list.length / 2);
    let split = list.findIndex((w, k) => k >= middle - 6 && /[,;]$/.test(w));
    if (split < 0) split = middle;
    const first = list.slice(0, split + 1).join(' ').replace(/[,;]$/, '.');
    const rest = list.slice(split + 1).join(' ');
    out = `${first} ${rest.charAt(0).toUpperCase()}${rest.slice(1)}`;
  }
  return out;
}
