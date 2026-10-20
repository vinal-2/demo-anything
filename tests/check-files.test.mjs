// CI's first step refuses files that must never be committed: raw captures, agent and
// editor settings, plugin parts other than the skill, and symbolic links.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import { blockedFiles, PLUGIN_PARTS } from '../tools/check-files.mjs';

// Lines as `git ls-files -s -z` prints them: "<mode> <object> <stage>\t<path>", NUL-separated.
const OBJECT = '0123456789abcdef0123456789abcdef01234567';
const listing = (entries) => entries.map(([mode, file]) => `${mode} ${OBJECT} 0\t${file}`).join('\0') + '\0';
const blocked = (entries) => blockedFiles(listing(entries)).map((b) => b.file);

test('a tracked symbolic link is refused', () => {
  assert.deepEqual(blocked([
    ['100644', 'flows/example/flow.json'],
    ['120000', 'flows/example/assets/02-settings.png'],
  ]), ['flows/example/assets/02-settings.png']);
});

test('raw captures and agent or editor settings are refused', () => {
  assert.deepEqual(blocked([
    ['100644', 'capture/raw/01.png'],
    ['100644', '.claude/settings.json'],
    ['100644', '.vscode/settings.json'],
    ['100644', '.devcontainer/devcontainer.json'],
  ]), ['capture/raw/01.png', '.claude/settings.json', '.vscode/settings.json', '.devcontainer/devcontainer.json']);
});

test('every plugin part is refused at the root and inside plugin/', () => {
  const sample = (part) => (part.endsWith('/') ? `${part}x.json` : part);
  const root = PLUGIN_PARTS.map(sample);
  const inPlugin = PLUGIN_PARTS.map((part) => `plugin/${sample(part)}`);
  const entries = [...root, ...inPlugin].map((file) => ['100644', file]);
  assert.deepEqual(blocked(entries), [...root, ...inPlugin]);
  for (const part of ['hooks/', '.mcp.json', '.lsp.json', 'bin/', 'monitors/', 'settings.json', 'commands/', 'agents/', 'workflows/', 'output-styles/', 'themes/', 'scripts/']) {
    assert.ok(PLUGIN_PARTS.includes(part), `${part} is blocked`);
  }
});

test('plugin/ may hold only its manifest and the skill', () => {
  assert.deepEqual(blocked([
    ['100644', 'plugin/.claude-plugin/plugin.json'],
    ['100644', 'plugin/skills/demo-anything/SKILL.md'],
    ['100644', 'plugin/skills/other/SKILL.md'],
    ['100644', 'plugin/README.md'],
  ]), ['plugin/skills/other/SKILL.md', 'plugin/README.md']);
});

test('ordinary files with similar names are allowed', () => {
  assert.deepEqual(blocked([
    ['100644', '.github/workflows/ci.yml'],
    ['100644', 'docs/agents.md'],
    ['100644', 'tools/bin-helper.mjs'],
    ['100644', 'flows/example/hooks.png'],
    ['100755', 'tools/serve.mjs'],
  ]), []);
});

test('this repository passes the check', () => {
  assert.deepEqual(blockedFiles(execFileSync('git', ['ls-files', '-s', '-z'], { encoding: 'utf8' })), []);
});
