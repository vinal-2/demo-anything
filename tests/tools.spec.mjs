import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateFlow } from '../tools/validate-flow.mjs';
import { importSteps, imageSize } from '../tools/import-steps.mjs';
import { wordsFromCharacters } from '../tools/make-voice.mjs';
import { redact } from '../tools/redact.mjs';
import { buildSite } from '../tools/build-site.mjs';
import { withHead } from '../tools/lib/site-meta.mjs';

const FIXTURE = 'tools/fixtures/capture-sample';
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'demo-anything-'));

// A copy of the example flow in a temporary flows/ folder, so tests can break it safely.
function copyExample() {
  const dir = path.join(tmp(), 'flows', 'example');
  fs.cpSync('flows/example', dir, { recursive: true });
  return dir;
}
const editFlow = (dir, change) => {
  const file = path.join(dir, 'flow.json');
  const flow = JSON.parse(fs.readFileSync(file, 'utf8'));
  change(flow);
  fs.writeFileSync(file, JSON.stringify(flow));
};

test('the example flow passes validation with no warnings', () => {
  const { errors, warnings } = validateFlow('flows/example');
  expect(errors).toEqual([]);
  expect(warnings).toEqual([]);
});

test('the validator reports broken flows clearly', () => {
  const dir = path.join(tmp(), 'flows', 'broken');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify({
    id: 'broken',
    name: 'Turning on email alerts',
    steps: [
      { type: 'image', src: 'assets/missing.png', voice: { script: 'Welcome to the API Catalog lesson about system environments and variables today.' } },
      { type: 'image', src: 'assets/missing.png', hotspot: { x: 1.4, y: 0.2 }, autoAdvance: false },
      { type: 'image', src: 'assets/missing.png', autoAdvance: false },
      { type: 'image', src: 'assets/missing.png', voice: { script: 'Welcome to the API Catalog lesson about system environments and variables today.' } },
      { type: 'cover' },
    ],
  }));
  const { errors, warnings } = validateFlow(dir);
  const all = errors.join('\n');
  expect(all).toContain('first step must be a cover');
  expect(all).toContain('last step must be an end card');
  expect(all).toContain('assets/missing.png" is missing');
  expect(all).toContain('hotspot x and y must be numbers from 0 to 1');
  expect(all).toContain('checkpoint has no hotspot');
  const w = warnings.join('\n');
  expect(w).toContain('same narration script');
  expect(w).toContain('shares no words with the flow name');
});

test('the validator flags a script copied from another flow', () => {
  const root = tmp();
  const make = (id, name, script) => {
    const dir = path.join(root, 'flows', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'flow.json'), JSON.stringify({
      id, name,
      steps: [{ type: 'cover', title: name }, { type: 'image', src: 'https://example.com/a.png', voice: { script } }, { type: 'end' }],
    }));
    return dir;
  };
  make('first', 'Turning on email alerts', 'Email alerts tell you by email when something in your workspace needs attention today.');
  const second = make('second', 'Inviting a user', 'Email alerts tell you by email when something in your workspace needs attention today.');
  const { warnings } = validateFlow(second);
  expect(warnings.join('\n')).toContain('identical to step 1 in flow "first"');
});

test('the validator refuses an image outside the flow folder', () => {
  const dir = copyExample();
  editFlow(dir, (flow) => { flow.steps[1].src = '../../secret.png'; });
  expect(validateFlow(dir).errors.join('\n')).toContain('must be inside the flow folder');
});

test('the validator refuses screenshots of different sizes', () => {
  const dir = copyExample();
  fs.copyFileSync('docs/assets/player.png', path.join(dir, 'assets', 'odd-size.png'));
  editFlow(dir, (flow) => { flow.steps[2].src = 'assets/odd-size.png'; });
  expect(validateFlow(dir).errors.join('\n')).toContain('Every screenshot in a flow must be the same size');
});

test('the validator refuses an aspect ratio that does not match the screenshots', () => {
  const dir = copyExample();
  editFlow(dir, (flow) => { flow.aspectRatio = 0.75; });
  expect(validateFlow(dir).errors.join('\n')).toContain('"aspectRatio" is 0.75 but the screenshots are 0.5625');
});

test('the validator checks narrators and their voice files', () => {
  const dir = copyExample();
  editFlow(dir, (flow) => {
    flow.narrators.push({ id: 'george', label: 'Again', provider: 'kokoro' }, { id: 'robot', provider: 'speakomatic' });
    flow.steps[1].voice.variants = { nobody: { audio: 'assets/v01.mp3' }, emma: { audio: 'assets/emma/missing.mp3' } };
    flow.steps[3].voice.variants = { emma: { audio: '../../outside.mp3' } };
  });
  const errors = validateFlow(dir).errors.join('\n');
  expect(errors).toContain('the id "george" is used twice');
  expect(errors).toContain('unknown provider "speakomatic"');
  expect(errors).toContain('voice variant "nobody" isn\'t one of the flow\'s narrators');
  expect(errors).toContain('emma audio "assets/emma/missing.mp3" is missing');
  expect(errors).toContain('emma audio "../../outside.mp3" must be inside the flow folder');
});

test('the validator catches identifying text anywhere in flow.json and masks it', () => {
  const dir = copyExample();
  const termsFile = path.join(dir, 'terms.txt');
  fs.writeFileSync(termsFile, '# my lab\nFabrikam-Lab\n');
  editFlow(dir, (flow) => {
    flow.steps[1].voice.script = 'Email jo.bloggs@contoso.com about tenant 3f2504e0-4f89-11d3-9a0c-0305e82c3301.';
    flow.steps[2].hotspot.label = 'Open fabrikam-lab.onmicrosoft.com';
    flow.steps[3].voice.script = 'The server at 81.2.69.160 talks to 10.0.1.4 and 192.168.1.20.';
    // A fake token, assembled at run time so secret scanners don't flag the test itself.
    const fakeJwt = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTY3ODkwIn0', 'c2lnbmF0dXJlLWhlcmUx'].join('.');
    flow.steps[7].buttons[1].href = `https://example.com/?t=${fakeJwt}`;
    flow.steps[0].subtitle = 'Key 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
  });
  const errors = validateFlow(dir, { termsFile }).errors.join('\n');
  expect(errors).toContain('Step 1 (image) voice.script: looks like an email address');
  expect(errors).toContain('Step 1 (image) voice.script: looks like a GUID');
  expect(errors).toContain('Step 2 (image) hotspot.label: looks like a Microsoft tenant name');
  expect(errors).toContain('Step 2 (image) hotspot.label: looks like one of your sensitive terms');
  expect(errors).toContain('Step 3 (image) voice.script: looks like a public IP address (81…0)');
  expect(errors).toContain('Step 7 (end) buttons[1].href: looks like a JSON web token');
  expect(errors).toContain('Step 0 (cover) subtitle: looks like a long hex key');
  expect(errors).not.toContain('10.0');
  expect(errors).not.toContain('192.168');
  expect(errors).not.toContain('jo.bloggs');
});

test('every published flow passes the sensitive-text check', () => {
  for (const id of ['example', 'mde-isolate-device']) expect(validateFlow(`flows/${id}`, { termsFile: null }).errors).toEqual([]);
});

test('the inside-the-flow-folder rule covers logo, background and music', () => {
  const dir = copyExample();
  editFlow(dir, (flow) => {
    flow.steps[0].logo = '../../../capture/raw/shots/01-home.png';
    flow.steps[0].bg = '../../secret.png';
    flow.backgroundMusic.src = '../music.mp3';
  });
  const errors = validateFlow(dir).errors.join('\n');
  expect(errors).toContain('logo "../../../capture/raw/shots/01-home.png" must be inside the flow folder');
  expect(errors).toContain('bg "../../secret.png" must be inside the flow folder');
  expect(errors).toContain('backgroundMusic "../music.mp3" must be inside the flow folder');
});

test('import-steps turns a capture into a valid flow with hotspots on the boxes', () => {
  const dir = path.join(tmp(), 'flows', 'imported');
  const flow = importSteps(FIXTURE, dir, { name: 'Turning on email alerts in Acme Admin' });
  expect(flow.steps[0].type).toBe('cover');
  expect(flow.steps[0].logoText).toBe('');
  expect(flow.steps.at(-1).type).toBe('end');
  expect(flow.aspectRatio).toBe(0.5625);

  const capture = JSON.parse(fs.readFileSync(path.join(FIXTURE, 'steps.json'), 'utf8'));
  const checkpoints = flow.steps.filter((s) => s.hotspot);
  expect(checkpoints).toHaveLength(capture.length);
  capture.forEach((entry, k) => {
    const { x, y, width, height } = entry.box;
    expect(checkpoints[k].hotspot.x).toBeCloseTo((x + width / 2) / 1600, 3);
    expect(checkpoints[k].hotspot.y).toBeCloseTo((y + height / 2) / 900, 3);
    expect(checkpoints[k].hotspot.label).toBe(entry.element);
  });
  expect(flow.steps[1].voice.script).toBe(capture[0].say);

  expect(validateFlow(dir).errors).toEqual([]);
  expect(() => importSteps(FIXTURE, dir, {})).toThrow(/already exists/);
});

// A raw capture made from the fixture, run through redact so it has a real manifest.
async function redactedCopy(change = () => {}) {
  const root = tmp();
  const raw = path.join(root, 'raw');
  fs.cpSync(FIXTURE, raw, { recursive: true });
  change(raw);
  const plan = Object.fromEntries(fs.readdirSync(path.join(raw, 'shots')).map((f) => [f, []]));
  fs.writeFileSync(path.join(raw, 'redact.json'), JSON.stringify(plan));
  const clean = path.join(root, 'clean');
  await redact({ rawDir: raw, cleanDir: clean });
  return clean;
}

test('import-steps refuses screenshots of different sizes', async () => {
  const clean = await redactedCopy((raw) => fs.copyFileSync('docs/assets/player.png', path.join(raw, 'shots', '02-settings.png')));
  expect(() => importSteps(clean, path.join(tmp(), 'flows', 'mixed'), {})).toThrow(/must be the same size/);
});

test('import-steps refuses a folder that was never redacted', () => {
  const capture = path.join(tmp(), 'capture');
  fs.cpSync(FIXTURE, capture, { recursive: true });
  fs.rmSync(path.join(capture, 'redaction.json'));
  expect(() => importSteps(capture, path.join(tmp(), 'flows', 'raw'), {})).toThrow(/has no redaction\.json.*npm run redact/);
});

test('import-steps refuses a screenshot that changed or appeared after redaction', async () => {
  const changed = await redactedCopy();
  fs.copyFileSync(path.join(FIXTURE, 'shots', '01-home.png'), path.join(changed, 'shots', '02-settings.png'));
  expect(() => importSteps(changed, path.join(tmp(), 'flows', 'changed'), {})).toThrow(/02-settings\.png changed after redaction/);

  const added = await redactedCopy();
  fs.copyFileSync(path.join(FIXTURE, 'shots', '01-home.png'), path.join(added, 'shots', '04-extra.png'));
  expect(() => importSteps(added, path.join(tmp(), 'flows', 'added'), {})).toThrow(/04-extra\.png isn't in redaction\.json/);
});

test('the site build publishes only the player and files each flow uses', async () => {
  const root = tmp();
  fs.cpSync('index.html', path.join(root, 'index.html'));
  fs.cpSync('player', path.join(root, 'player'), { recursive: true });
  fs.cpSync('flows/example', path.join(root, 'flows', 'example'), { recursive: true });
  fs.writeFileSync(path.join(root, 'flows', 'example', 'assets', 'draft-notes.txt'), 'private');
  fs.writeFileSync(path.join(root, 'flows', 'example', 'raw-capture.png'), 'private');
  const out = path.join(root, '_site');
  const published = await buildSite({ root, out, siteUrl: '' });

  expect(published).toContain('flows/example/flow.json');
  expect(published).toContain('flows/example/assets/01-home.png');
  expect(published).toContain('flows/example/assets/t01-open-notifications.webm');
  expect(published).toContain('flows/example/assets/emma/v01.mp3');
  expect(fs.existsSync(path.join(out, 'player', 'player.js'))).toBe(true);
  expect(fs.existsSync(path.join(out, 'flows', 'example', 'assets', 'draft-notes.txt'))).toBe(false);
  expect(fs.existsSync(path.join(out, 'flows', 'example', 'raw-capture.png'))).toBe(false);
  // No site address: no sitemap, and no tags that need a full address.
  expect(published).not.toContain('sitemap.xml');
  expect(fs.readFileSync(path.join(out, 'index.html'), 'utf8')).not.toContain('og:image');
});

test('the site build adds a page, share picture and sitemap entry for each demo', async () => {
  const root = tmp();
  fs.cpSync('index.html', path.join(root, 'index.html'));
  fs.cpSync('player', path.join(root, 'player'), { recursive: true });
  fs.cpSync('flows/example', path.join(root, 'flows', 'example'), { recursive: true });
  const out = path.join(root, '_site');
  const site = 'https://example.github.io/demo';
  const published = await buildSite({ root, out, siteUrl: site });
  const read = (rel) => fs.readFileSync(path.join(out, rel), 'utf8');

  expect(published).toEqual(expect.arrayContaining(['demos/example/index.html', 'demos/index.html', 'og/example.png', 'sitemap.xml']));
  expect(imageSize(path.join(out, 'og', 'example.png'))).toEqual({ width: 1200, height: 630 });

  const page = read('demos/example/index.html');
  expect(page).toContain('<meta name="demo-flow" content="example">');
  expect(page).toContain('<title>Example: turn on email alerts</title>');
  expect(page).toContain(`<link rel="canonical" href="${site}/demos/example/">`);
  expect(page).toContain(`<meta property="og:image" content="${site}/og/example.png">`);
  expect(page).toContain('src="../../player/player.js"');

  const home = read('index.html');
  expect(home).toContain('"@type":"SoftwareApplication"');
  expect(home).toContain(`<link rel="canonical" href="${site}/">`);
  expect(read('demos/index.html')).toContain('href="example/"');
  expect(read('sitemap.xml')).toContain(`<loc>${site}/demos/example/</loc>`);
  await expect(buildSite({ root, out, siteUrl: 'http://example.com' })).rejects.toThrow('https://');

  // The Search Console code goes on the home page only, and must be just the code.
  await buildSite({ root, out, siteUrl: site, googleVerification: 'abcDEF123_-xyz' });
  expect(read('index.html')).toContain('<meta name="google-site-verification" content="abcDEF123_-xyz">');
  expect(read('demos/example/index.html')).not.toContain('google-site-verification');
  await expect(buildSite({ root, out, siteUrl: site, googleVerification: '"><script>' })).rejects.toThrow('content=');
});

test('page titles and descriptions are inserted literally, even with $ patterns', () => {
  const html = '<head><title>x</title><meta name="description" content="y"></head>';
  const out = withHead(html, { title: "Costs $& and $' less", description: 'Save $` and $1 today', extra: '<meta name="e" content="$&">' });
  expect(out).toContain("<title>Costs $&amp; and $' less</title>");
  expect(out).toContain('<meta name="description" content="Save $` and $1 today">');
  expect(out).toContain('<meta name="e" content="$&">');
});

test('image sizes are read from PNG headers', () => {
  expect(imageSize('flows/example/assets/01-home.png')).toEqual({ width: 1600, height: 900 });
  expect(imageSize(`${FIXTURE}/shots/01-home.png`)).toEqual({ width: 1600, height: 900 });
});

test('character timings become word timings', () => {
  const chars = 'Hi there you'.split('');
  const starts = chars.map((_c, k) => k * 0.1);
  expect(wordsFromCharacters(chars, starts)).toEqual([
    { t: 0, word: 'Hi' }, { t: 0.3, word: 'there' }, { t: 0.9, word: 'you' },
  ]);
});
