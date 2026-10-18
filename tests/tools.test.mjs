import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, test } from 'node:test';
import { importSteps } from '../tools/import-steps.mjs';
import { validateFlow } from '../tools/validate-flow.mjs';

const EXAMPLE = join(import.meta.dirname, '..', 'flows', 'example');
let work;

before(async () => {
  work = await mkdtemp(join(tmpdir(), 'demo-anything-'));
});
after(async () => {
  await rm(work, { recursive: true, force: true });
});

async function copyOfExample(name) {
  const flows = join(work, name, 'flows');
  await cp(EXAMPLE, join(flows, 'example'), { recursive: true });
  await writeFile(join(flows, 'index.json'), JSON.stringify([{ id: 'example', name: 'Example' }]));
  return join(flows, 'example');
}

async function editFlow(flowDir, change) {
  const file = join(flowDir, 'flow.json');
  const flow = JSON.parse(await readFile(file, 'utf8'));
  change(flow);
  await writeFile(file, JSON.stringify(flow));
}

describe('validate-flow', () => {
  test('the example flow passes with no warnings', async () => {
    const result = await validateFlow(await copyOfExample('clean'));
    assert.deepEqual(result, { errors: [], warnings: [] });
  });

  test('a hotspot outside the screenshot is an error', async () => {
    const flowDir = await copyOfExample('outside');
    await editFlow(flowDir, (flow) => { flow.steps[0].hotspot.x = flow.imageSize.width - 10; });
    const { errors } = await validateFlow(flowDir);
    assert.deepEqual(errors, ['step 1: hotspot sits outside the screenshot']);
  });

  test('a wrong aspect ratio is an error', async () => {
    const flowDir = await copyOfExample('ratio');
    await editFlow(flowDir, (flow) => { flow.aspectRatio = 0.75; });
    const { errors } = await validateFlow(flowDir);
    assert.match(errors[0], /^aspectRatio: is 0.75/);
  });

  test('an image path outside the flow folder is an error', async () => {
    const flowDir = await copyOfExample('escape');
    await editFlow(flowDir, (flow) => { flow.steps[0].image = '../../secret.png'; });
    const { errors } = await validateFlow(flowDir);
    assert.match(errors[0], /must be inside the flow folder/);
  });

  test('missing subtitle and label are warnings, not errors', async () => {
    const flowDir = await copyOfExample('warnings');
    await editFlow(flowDir, (flow) => {
      flow.cover.subtitle = '';
      flow.steps[1].hotspot.label = '';
    });
    const { errors, warnings } = await validateFlow(flowDir);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, ['cover: subtitle is empty', 'step 2: hotspot label is empty']);
  });
});

describe('import-steps', () => {
  async function makeCapture(name, steps) {
    const captureDir = join(work, name, 'capture');
    await mkdir(join(captureDir, 'shots'), { recursive: true });
    await cp(join(EXAMPLE, 'shots', '01-home.png'), join(captureDir, 'shots', '01-home.png'));
    await cp(join(EXAMPLE, 'shots', '02-settings.png'), join(captureDir, 'shots', '02-settings.png'));
    await writeFile(join(captureDir, 'steps.json'), JSON.stringify(steps));
    return captureDir;
  }
  const entry = (step, box = { x: 10, y: 10, width: 100, height: 40 }) => ({
    step, screen: `Screen ${step}`, element: `Button ${step}`, box, why: 'Because', say: 'Click the button.',
  });

  test('builds a flow that only needs a subtitle to pass', async () => {
    const captureDir = await makeCapture('import-ok', [entry(2), entry(1)]);
    const flowDir = join(work, 'import-ok', 'flows', 'my-flow');
    const flow = await importSteps({ captureDir, flowDir, name: 'My flow' });

    assert.deepEqual(flow.steps.map((s) => s.image), ['shots/01-home.png', 'shots/02-settings.png']);
    assert.equal(flow.aspectRatio, flow.imageSize.height / flow.imageSize.width);
    assert.equal(flow.steps[0].hotspot.label, 'Button 1');
    const index = JSON.parse(await readFile(join(work, 'import-ok', 'flows', 'index.json'), 'utf8'));
    assert.deepEqual(index, [{ id: 'my-flow', name: 'My flow' }]);

    const { errors, warnings } = await validateFlow(flowDir);
    assert.deepEqual(errors, []);
    assert.deepEqual(warnings, ['cover: subtitle is empty']);
  });

  test('refuses to overwrite a flow without --force', async () => {
    const captureDir = await makeCapture('import-twice', [entry(1)]);
    const flowDir = join(work, 'import-twice', 'flows', 'twice');
    await importSteps({ captureDir, flowDir, name: 'Twice' });
    await assert.rejects(importSteps({ captureDir, flowDir, name: 'Twice' }), /already exists/);
    await importSteps({ captureDir, flowDir, name: 'Twice', force: true });
  });

  test('stops when a step has no screenshot', async () => {
    const captureDir = await makeCapture('import-missing', [entry(1), entry(3)]);
    const flowDir = join(work, 'import-missing', 'flows', 'missing');
    await assert.rejects(importSteps({ captureDir, flowDir, name: 'Missing' }), /no screenshot for step 3/);
  });

  test('stops when a box value is not a number', async () => {
    const captureDir = await makeCapture('import-box', [entry(1, { x: '10', y: 0, width: 5, height: 5 })]);
    const flowDir = join(work, 'import-box', 'flows', 'box');
    await assert.rejects(importSteps({ captureDir, flowDir, name: 'Box' }), /box\.x must be a number/);
  });
});
