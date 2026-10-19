// Builds the folder GitHub Pages publishes: index.html, player/ and, for each flow, only
// flow.json and the files it actually uses. Anything else in a flow folder stays private.
// It also writes a page per demo (demos/<id>/), a share picture per demo (og/<id>.png),
// a list of demos (demos/) and sitemap.xml.
//   node tools/build-site.mjs [outDir]      (default _site)
// The site address comes from SITE_URL, else "homepage" in package.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findFlows } from './validate-flow.mjs';
import {
  OG_SIZE, escHtml, flowInfo, galleryPage, shareTags, sitemap, softwareJsonLd, withHead,
} from './lib/site-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FLOW = 'example';
const SITE_NAME = 'Demo Anything';
const GALLERY_DESCRIPTION = 'Interactive walkthroughs made with Demo Anything.';
const isRemote = (p) => /^(?:[a-z][a-z0-9+.-]*:)/i.test(p);

// Every local file a flow refers to, relative to its folder.
export function referencedFiles(flow) {
  const files = new Set(['flow.json']);
  const add = (p) => { if (typeof p === 'string' && p && !isRemote(p)) files.add(path.posix.normalize(p)); };
  for (const step of flow.steps || []) {
    (Array.isArray(step.src) ? step.src : [step.src]).forEach(add);
    add(step.logo);
    add(step.bg);
    add(step.voice?.audio);
    Object.values(step.voice?.variants || {}).forEach((v) => add(v?.audio));
  }
  add(flow.backgroundMusic?.src);
  return [...files].filter((f) => !f.startsWith('..') && !path.isAbsolute(f)).sort();
}

function readPackage(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

// "https://x.github.io/repo" -> "https://x.github.io/repo/". Only https addresses are used.
export function normaliseSiteUrl(url) {
  if (!url) return '';
  const u = new URL(url);
  if (u.protocol !== 'https:') throw new Error(`The site address must start with https:// (got ${url}).`);
  return u.href.endsWith('/') ? u.href : `${u.href}/`;
}

const repoUrl = (pkg) => {
  const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
  return url ? url.replace(/^git\+/, '').replace(/\.git$/, '') : '';
};

// The demo page is index.html with its own title and tags, pointing two folders up.
export function demoPage(template, info, siteUrl) {
  const html = template.replace(/(href|src)="player\//g, '$1="../../player/');
  return withHead(html, {
    title: info.title,
    description: info.description,
    extra: [
      `<meta name="demo-flow" content="${escHtml(info.id)}">`,
      shareTags({
        title: info.title,
        description: info.description,
        url: siteUrl && `${siteUrl}demos/${info.id}/`,
        image: siteUrl && info.image && `${siteUrl}${info.image}`,
      }),
    ].join('\n  '),
  });
}

async function writeShareImage(source, target) {
  await sharp(source)
    .resize(OG_SIZE.width, OG_SIZE.height, { fit: 'cover', position: 'top' })
    .png({ compressionLevel: 9 })
    .toFile(target);
}

function writeFile(out, rel, content, written) {
  const target = path.join(out, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  written.push(rel);
}

async function publishFlows(root, out, written) {
  const infos = [];
  for (const dir of findFlows(path.join(root, 'flows'))) {
    const id = path.basename(dir);
    const flow = JSON.parse(fs.readFileSync(path.join(dir, 'flow.json'), 'utf8'));
    for (const rel of referencedFiles(flow)) {
      const target = path.join(out, 'flows', id, rel);
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.copyFileSync(path.join(dir, rel), target);
      written.push(`flows/${id}/${rel}`);
    }
    const info = flowInfo(id, flow);
    if (info.shot) {
      const image = `og/${id}.png`;
      fs.mkdirSync(path.join(out, 'og'), { recursive: true });
      await writeShareImage(path.join(dir, info.shot), path.join(out, image));
      written.push(image);
      infos.push({ ...info, image });
    } else {
      infos.push({ ...info, image: null });
    }
  }
  return infos;
}

// The Google Search Console "HTML tag" code. It is public (it sits in the page), so it is
// a repository variable rather than a secret, and copies of this repo don't inherit it.
export function verificationTag(code) {
  if (!code) return '';
  if (!/^[A-Za-z0-9_-]{10,100}$/.test(code)) throw new Error('GOOGLE_SITE_VERIFICATION should be just the content="..." code from Search Console.');
  return `<meta name="google-site-verification" content="${code}">`;
}

export async function buildSite({ root = ROOT, out = path.join(ROOT, '_site'), siteUrl, googleVerification } = {}) {
  const pkg = readPackage(root);
  const site = normaliseSiteUrl(siteUrl ?? process.env.SITE_URL ?? pkg.homepage);
  const verification = verificationTag(googleVerification ?? process.env.GOOGLE_SITE_VERIFICATION);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(root, 'player'), path.join(out, 'player'), { recursive: true });
  const written = [];
  const infos = await publishFlows(root, out, written);

  const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const home = infos.find((d) => d.id === DEFAULT_FLOW) || infos[0];
  const description = pkg.description || template.match(/<meta name="description" content="([^"]*)">/)?.[1] || '';
  const homeTitle = `${SITE_NAME}: interactive walkthroughs from screenshots`;
  writeFile(out, 'index.html', withHead(template, {
    title: homeTitle,
    description,
    extra: [
      shareTags({ title: homeTitle, description, url: site, image: site && home?.image && `${site}${home.image}` }),
      softwareJsonLd({ name: SITE_NAME, description, url: site, repo: repoUrl(pkg) }),
      verification,
    ].filter(Boolean).join('\n  '),
  }), written);

  for (const info of infos) writeFile(out, `demos/${info.id}/index.html`, demoPage(template, info, site), written);
  const galleryTitle = `${SITE_NAME}: all demos`;
  writeFile(out, 'demos/index.html', galleryPage({
    title: galleryTitle,
    description: GALLERY_DESCRIPTION,
    demos: infos,
    head: shareTags({ title: galleryTitle, description: GALLERY_DESCRIPTION, url: site && `${site}demos/` }),
  }), written);

  // No robots.txt: a project site (user.github.io/repo/) isn't the domain root, so crawlers
  // would never read it. Submit sitemap.xml in Google Search Console instead.
  if (site) writeFile(out, 'sitemap.xml', sitemap([site, `${site}demos/`, ...infos.map((d) => `${site}demos/${d.id}/`)]), written);
  return written;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = path.resolve(process.argv[2] || path.join(ROOT, '_site'));
  const files = await buildSite({ out });
  console.log(`Built ${path.relative(process.cwd(), out) || out}: player/ and ${files.length} files.`);
}
