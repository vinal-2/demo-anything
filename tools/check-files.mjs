#!/usr/bin/env node
// Fails if git tracks a file that must never be committed. CI runs this first.
//   - capture/ holds unredacted screenshots
//   - agent and editor settings change what an agent or editor does for whoever opens
//     the repo
//   - plugin parts other than the skill could run code when someone installs the plugin
//   - symbolic links could publish or serve files from outside the repository
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Claude Code plugin parts that run code or change an agent's settings. A folder ends in "/".
export const PLUGIN_PARTS = ['hooks/', '.mcp.json', '.lsp.json', 'bin/', 'monitors/', 'settings.json',
  'commands/', 'agents/', 'workflows/', 'output-styles/', 'themes/', 'scripts/'];
const NEVER = ['capture/', '.claude/', '.mcp.json', '.vscode/', '.devcontainer/'];
const PLUGIN_FILES = ['plugin/.claude-plugin/plugin.json', 'plugin/skills/demo-anything/SKILL.md'];
const SYMLINK_MODE = '120000';

const matches = (file, part) => (part.endsWith('/') ? file.startsWith(part) : file === part);

function reason(mode, file) {
  if (mode === SYMLINK_MODE) return 'a symbolic link; commit the file itself';
  if (NEVER.some((p) => matches(file, p))) return 'never committed (raw captures, agent or editor settings)';
  if (PLUGIN_PARTS.some((p) => matches(file, p))) return 'a plugin part; the plugin ships only its skill';
  if (file.startsWith('plugin/') && !PLUGIN_FILES.includes(file)) return 'not part of the plugin; plugin/ holds only plugin.json and the skill';
  return null;
}

// Takes the output of `git ls-files -s -z` and returns [{ file, why }] for each refused path.
export function blockedFiles(lsFiles) {
  return lsFiles.split('\0').filter(Boolean).flatMap((entry) => {
    const tab = entry.indexOf('\t');
    const mode = entry.slice(0, entry.indexOf(' '));
    const file = entry.slice(tab + 1);
    const why = reason(mode, file);
    return why ? [{ file, why }] : [];
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const found = blockedFiles(execFileSync('git', ['ls-files', '-s', '-z'], { encoding: 'utf8' }));
  if (found.length) {
    console.log('::error::These files must not be committed:');
    for (const { file, why } of found) console.log(`  ${file}: ${why}`);
    process.exit(1);
  }
  console.log('No blocked files or symbolic links.');
}
