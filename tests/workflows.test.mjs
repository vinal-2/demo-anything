// Guards the GitHub Actions workflows: pinned actions, no stored credentials, and the
// smallest permissions. Plain text checks, so no YAML library is needed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { PLUGIN_PARTS } from '../tools/check-files.mjs';

const DIR = '.github/workflows';
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
const workflows = fs.readdirSync(DIR).filter((f) => f.endsWith('.yml')).map((f) => ({
  name: f,
  text: fs.readFileSync(path.join(DIR, f), 'utf8'),
}));
const read = (name) => workflows.find((w) => w.name === name).text;

test('every action is pinned to a full commit SHA with its version noted', () => {
  for (const { name, text } of workflows) {
    for (const line of text.split('\n').filter((l) => /^\s*(-\s+)?uses:/.test(l))) {
      assert.match(line, /uses: [\w.-]+\/[\w./-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+\s*$/, `${name}: ${line.trim()}`);
    }
  }
});

test('every checkout drops its credentials', () => {
  for (const { name, text } of workflows) {
    const checkouts = (text.match(/uses: actions\/checkout@/g) || []).length;
    const dropped = (text.match(/persist-credentials: false/g) || []).length;
    assert.equal(dropped, checkouts, `${name}: ${checkouts} checkout(s), ${dropped} with persist-credentials: false`);
  }
});

test('CI keeps the required "test" job and has time limits', () => {
  const ci = read('ci.yml');
  assert.match(ci, /^ {2}test:$/m);
  assert.match(ci, /^ {2}dependency-review:$/m);
  assert.equal((ci.match(/timeout-minutes:/g) || []).length, 2);
  assert.match(ci, /npm ci --ignore-scripts/);
});

test('CI checks for blocked files and symbolic links before installing anything', () => {
  const ci = read('ci.yml');
  const check = ci.indexOf('run: node tools/check-files.mjs');
  assert.ok(check > 0, 'ci.yml runs tools/check-files.mjs');
  assert.ok(check < ci.indexOf('npm ci'), 'the check runs before npm ci');
});

test('plugin parts are labelled as agent instructions and owned by the maintainer', () => {
  const labels = fs.readFileSync('.github/labeler.yml', 'utf8');
  const agentLabel = labels.split(/^"touches: workflows":$/m)[0];
  const owners = fs.readFileSync('.github/CODEOWNERS', 'utf8');
  for (const part of [...PLUGIN_PARTS, 'plugin/']) {
    const glob = part.endsWith('/') ? `${part}**` : part;
    assert.match(agentLabel, new RegExp(`^ +- ${escape(glob)}$`, 'm'), `label covers ${glob}`);
    assert.match(owners, new RegExp(`^/${escape(part)} +@vinal-2$`, 'm'), `CODEOWNERS covers /${part}`);
  }
});

test('the labeler never checks out or runs pull request code', () => {
  const labeler = read('labeler.yml');
  const code = labeler.split('\n').filter((l) => !l.trim().startsWith('#')).join('\n');
  assert.match(labeler, /pull_request_target:/);
  assert.doesNotMatch(code, /actions\/checkout|run:|npm |npx /);
  assert.match(labeler, /^permissions: \{\}$/m);
  assert.match(labeler, /contents: read\s+pull-requests: write/);
  const config = fs.readFileSync('.github/labeler.yml', 'utf8');
  for (const label of ['touches: agent instructions', 'touches: workflows', 'touches: dependencies', 'touches: player/tools', 'flow']) {
    assert.match(config, new RegExp(`^"?${label.replace('/', '\\/')}"?:$`, 'm'), label);
  }
});

test('Pages starts with no permissions and only the deploy job can deploy', () => {
  const pages = read('pages.yml');
  assert.match(pages, /^permissions: \{\}$/m);
  const [build, deploy] = pages.split(/^ {2}deploy:$/m);
  assert.doesNotMatch(build, /pages: write|id-token: write/);
  assert.match(deploy, /pages: write/);
  assert.match(deploy, /id-token: write/);
  assert.doesNotMatch(deploy, /run:/, 'the deploy job must not run project code');
});

test('no workflow checks out a commit named by the triggering event', () => {
  for (const { name, text } of workflows) {
    assert.doesNotMatch(text, /ref:\s*\$\{\{[^}]*github\.event\./, `${name} checks out a ref from github.event`);
  }
  // Pages deploys only when main is still the commit CI tested.
  assert.match(read('pages.yml'), /needs\.build\.outputs\.tested == 'true'/);
});
