// The Claude Code plugin is installed from plugin/ only, so installing it never copies the
// rest of the repository, and it carries nothing but the skill.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';

const files = (dir) => fs.readdirSync(dir, { recursive: true, withFileTypes: true })
  .filter((d) => !d.isDirectory())
  .map((d) => path.relative(dir, path.join(d.parentPath ?? d.path, d.name)).split(path.sep).join('/'))
  .sort();

test('the plugin folder holds only its manifest and the skill', () => {
  assert.deepEqual(files('plugin'), ['.claude-plugin/plugin.json', 'skills/demo-anything/SKILL.md']);
});

test('the marketplace installs the plugin from plugin/, with matching name and version', () => {
  const market = JSON.parse(fs.readFileSync('.claude-plugin/marketplace.json', 'utf8'));
  const manifest = JSON.parse(fs.readFileSync('plugin/.claude-plugin/plugin.json', 'utf8'));
  const entry = market.plugins.find((p) => p.name === manifest.name);
  assert.ok(entry, 'marketplace lists the plugin');
  assert.equal(entry.source, './plugin');
  assert.equal(entry.version, manifest.version);
  assert.deepEqual(fs.readdirSync('.claude-plugin').sort(), ['marketplace.json']);
});

test('no plugin component sits at the repository root', () => {
  const blocked = ['hooks', '.mcp.json', '.lsp.json', 'bin', 'monitors', 'settings.json', 'commands', 'agents', 'workflows', 'output-styles', 'themes', 'scripts', 'skills'];
  assert.deepEqual(blocked.filter((p) => fs.existsSync(p)), []);
});
