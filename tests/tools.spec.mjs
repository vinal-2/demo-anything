import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { validateFlow } from '../tools/validate-flow.mjs';
import { importSteps, imageSize } from '../tools/import-steps.mjs';
import { wordsFromCharacters } from '../tools/make-voice.mjs';

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

test('import-steps refuses screenshots of different sizes', () => {
  const capture = path.join(tmp(), 'capture');
  fs.cpSync(FIXTURE, capture, { recursive: true });
  fs.copyFileSync('docs/assets/player.png', path.join(capture, 'shots', '02-settings.png'));
  expect(() => importSteps(capture, path.join(tmp(), 'flows', 'mixed'), {})).toThrow(/must be the same size/);
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
