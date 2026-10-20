// Builds the folder GitHub Pages publishes: index.html, player/ and, for each flow, only
// flow.json and the files it actually uses. It refuses to build if any flow fails
// validation (unsafe file types, web addresses, unused files and so on).
// It also writes a page per demo (demos/<id>/), a share picture per demo (og/<id>.png),
// a list of demos (demos/) and sitemap.xml.
//   node tools/build-site.mjs [outDir]      (default _site)
// The site address comes from SITE_URL, else the GitHub Pages address of the repository
// being built (on GitHub Actions), else "homepage" in package.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { findFlows, linkedFlowFolders, validateFlow } from './validate-flow.mjs';
import { referencedFiles } from './lib/flow-files.mjs';
import {
  OG_SIZE, escHtml, flowInfo, galleryPage, shareTags, sitemap, softwareJsonLd, withHead,
} from './lib/site-meta.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_FLOW = 'example';
const SITE_NAME = 'Demo Anything';
const GALLERY_DESCRIPTION = 'Interactive walkthroughs made with Demo Anything.';

export { referencedFiles };

// Stops the build before anything is written if a flow has validation errors, or a flow
// folder is itself a symbolic link.
function assertPublishable(flowsRoot, dirs) {
  const problems = [
    ...linkedFlowFolders(flowsRoot).map((link) => `flows/${link} is a symbolic link`),
    ...dirs.flatMap((dir) => validateFlow(dir).errors.map((e) => `${path.basename(dir)}: ${e}`)),
  ];
  if (problems.length) throw new Error(`Not publishing: fix these flow errors first.\n- ${problems.join('\n- ')}`);
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

// The GitHub Pages address of a repository given as "owner/name".
export function pagesUrlFor(repository) {
  const [owner, name] = String(repository || '').split('/');
  if (!owner || !name) return '';
  const host = `${owner.toLowerCase()}.github.io`;
  return name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
}

// Which address and repository the site belongs to. On GitHub Actions the repository
// being built wins over package.json, so a fork or template copy never claims the
// original project's address. SITE_URL (a repository variable) covers custom domains.
function siteIdentity(pkg, env, siteUrl) {
  const repository = env.GITHUB_REPOSITORY || '';
  return {
    site: normaliseSiteUrl(siteUrl ?? (env.SITE_URL || pagesUrlFor(repository) || pkg.homepage)),
    repo: repository ? `https://github.com/${repository}` : repoUrl(pkg),
  };
}

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

async function publishFlows(dirs, out, written) {
  const infos = [];
  for (const dir of dirs) {
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

export async function buildSite({
  root = ROOT, out = path.join(ROOT, '_site'), siteUrl, googleVerification, env = process.env,
} = {}) {
  const pkg = readPackage(root);
  const { site, repo } = siteIdentity(pkg, env, siteUrl);
  const verification = verificationTag(googleVerification ?? env.GOOGLE_SITE_VERIFICATION);
  const dirs = findFlows(path.join(root, 'flows'));
  assertPublishable(path.join(root, 'flows'), dirs);
  fs.rmSync(out, { recursive: true, force: true });
  fs.mkdirSync(out, { recursive: true });
  fs.cpSync(path.join(root, 'player'), path.join(out, 'player'), { recursive: true });
  const written = [];
  const infos = await publishFlows(dirs, out, written);

  const template = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const home = infos.find((d) => d.id === DEFAULT_FLOW) || infos[0];
  const description = pkg.description || template.match(/<meta name="description" content="([^"]*)">/)?.[1] || '';
  const homeTitle = `${SITE_NAME}: interactive walkthroughs from screenshots`;
  writeFile(out, 'index.html', withHead(template, {
    title: homeTitle,
    description,
    extra: [
      shareTags({ title: homeTitle, description, url: site, image: site && home?.image && `${site}${home.image}` }),
      softwareJsonLd({ name: SITE_NAME, description, url: site, repo }),
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
