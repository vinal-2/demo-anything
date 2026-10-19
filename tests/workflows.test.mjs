// Guards the GitHub Actions workflows: pinned actions, no stored credentials, and the
// smallest permissions. Plain text checks, so no YAML library is needed.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const DIR = '.github/workflows';
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
  assert.match(ci, /\.claude\/\|\\\.mcp\\\.json/);
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
