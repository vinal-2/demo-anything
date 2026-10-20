// Symbolic links inside flows/ could publish or serve a file from anywhere (for example an
// unredacted screenshot of the same size). validate, build-site and the local server must
// all refuse them.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { validateFlow } from '../tools/validate-flow.mjs';
import { buildSite } from '../tools/build-site.mjs';
import { resolveServed } from '../tools/serve.mjs';

// A site root with index.html, player/ and a copy of the example flow, plus a same-size
// PNG in a folder outside flows/ (standing in for an unredacted capture).
function site() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-anything-link-'));
  fs.cpSync('index.html', path.join(root, 'index.html'));
  fs.cpSync('player', path.join(root, 'player'), { recursive: true });
  fs.cpSync('flows/example', path.join(root, 'flows', 'example'), { recursive: true });
  fs.mkdirSync(path.join(root, 'private'));
  fs.copyFileSync('tools/fixtures/capture-sample/shots/02-settings.png', path.join(root, 'private', 'secret.png'));
  return root;
}

// Windows only lets administrators (or Developer Mode) create file symlinks.
function trySymlink(target, link, type, t) {
  try {
    fs.symlinkSync(target, link, type);
    return true;
  } catch (err) {
    if (err.code === 'EPERM') { t.skip('this system needs extra rights to create symlinks; CI runs this test'); return false; }
    throw err;
  }
}

test('a flow file that is a symlink to a same-size PNG elsewhere is refused', async (t) => {
  const root = site();
  const shot = path.join(root, 'flows', 'example', 'assets', '02-settings.png');
  fs.rmSync(shot);
  if (!trySymlink(path.join(root, 'private', 'secret.png'), shot, 'file', t)) return;

  const { errors } = validateFlow(path.join(root, 'flows', 'example'));
  assert.ok(errors.some((e) => e.includes('"assets/02-settings.png" is a symbolic link')), errors.join('\n'));
  await assert.rejects(buildSite({ root, out: path.join(root, '_site'), siteUrl: '' }), /symbolic link/);
  assert.equal(await resolveServed('/flows/example/assets/02-settings.png', root), null);
});

test('a linked folder inside a flow is refused, and served files are real paths', async () => {
  const root = site();
  const assets = path.join(root, 'flows', 'example', 'assets');
  const moved = path.join(root, 'private', 'assets');
  fs.renameSync(assets, moved);
  // A junction needs no extra rights on Windows; elsewhere it is an ordinary folder symlink.
  fs.symlinkSync(moved, assets, 'junction');

  const { errors } = validateFlow(path.join(root, 'flows', 'example'));
  assert.ok(errors.some((e) => e.includes('"assets" is a symbolic link')), errors.join('\n'));
  await assert.rejects(buildSite({ root, out: path.join(root, '_site'), siteUrl: '' }), /symbolic link/);
  assert.equal(await resolveServed('/flows/example/assets/01-home.png', root), null);

  // Control: an ordinary file is still served, and paths outside the site never are.
  assert.equal(await resolveServed('/flows/example/flow.json', root), fs.realpathSync(path.join(root, 'flows', 'example', 'flow.json')));
  assert.equal(await resolveServed('/private/secret.png', root), null);
});
