// Finds text that should never be published in a flow: emails, tenant names and IDs,
// public IP addresses, tokens and keys, plus any of your own sensitive terms.
import fs from 'node:fs';

const PATTERNS = [
  ['an email address', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi],
  ['a Microsoft tenant name', /\b[\w-]+\.onmicrosoft\.com\b/gi],
  ['a GUID (tenant, object or subscription ID)', /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['a JSON web token', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ['a long hex key', /\b[0-9a-f]{32,}\b/gi],
  ['a long base64 key', /(?<![A-Za-z0-9+/])[A-Za-z0-9+/]{40,}={0,2}(?![A-Za-z0-9+/])/g],
];

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;

// Private, loopback, link-local, carrier-grade NAT and documentation ranges are fine to show.
export function isPublicIPv4(ip) {
  const p = ip.split('.').map(Number);
  if (p.some((n) => n > 255)) return false;
  const [a, b, c] = p;
  if (a === 10 || a === 127 || a === 0 || a >= 224) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 169 && b === 254) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if ((a === 192 && b === 0 && c === 2) || (a === 198 && b === 51 && c === 100) || (a === 203 && b === 0 && c === 113)) return false;
  return true;
}

// One term per line; blank lines and lines starting with # are ignored. The file is optional.
export function loadTerms(file) {
  if (!file || !fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/).map((t) => t.trim()).filter((t) => t && !t.startsWith('#'));
}

// Shows only enough of a match to find it, so a secret is never printed in full.
const mask = (s) => (s.length <= 4 ? '…' : `${s.slice(0, 2)}…${s.slice(-1)}`);

// Problems in one string: [{ kind, hint }].
export function findSensitive(text, terms = []) {
  const s = String(text);
  const hits = [];
  for (const [kind, pattern] of PATTERNS) {
    for (const m of s.matchAll(pattern)) hits.push({ kind, hint: mask(m[0]) });
  }
  for (const m of s.matchAll(IPV4)) if (isPublicIPv4(m[0])) hits.push({ kind: 'a public IP address', hint: mask(m[0]) });
  const lower = s.toLowerCase();
  for (const term of terms) if (lower.includes(term.toLowerCase())) hits.push({ kind: 'one of your sensitive terms', hint: mask(term) });
  return hits;
}

// Every string in a value, with a readable path such as "voice.script" or "buttons[1].href".
// Hashes and word timings are skipped: hashes are ours, and timings repeat the script.
export function* strings(value, at = '') {
  if (typeof value === 'string') { yield [at, value]; return; }
  if (Array.isArray(value)) { for (const [k, v] of value.entries()) yield* strings(v, `${at}[${k}]`); return; }
  if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k === 'hash' || k === 'timings') continue;
      yield* strings(v, at ? `${at}.${k}` : k);
    }
  }
}
