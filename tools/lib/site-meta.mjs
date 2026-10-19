// Page titles, share tags and search files for the published site (see tools/build-site.mjs).

const OG_SIZE = { width: 1200, height: 630 };

export const escHtml = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The title, description and first screenshot of a flow.
export function flowInfo(id, flow) {
  const steps = Array.isArray(flow.steps) ? flow.steps : [];
  const cover = steps.find((s) => s.type === 'cover') || {};
  const shot = steps.find((s) => s.type === 'image' && typeof s.src === 'string');
  const title = flow.name || cover.title || id;
  return {
    id,
    title,
    description: flow.description || cover.subtitle || `An interactive walkthrough: ${title}.`,
    shot: shot ? shot.src : null,
  };
}

// Canonical link, Open Graph and Twitter tags. Tags that need a full address are left out
// when the site address is unknown.
export function shareTags({ title, description, url, image }) {
  const tags = [
    `<meta property="og:type" content="website">`,
    `<meta property="og:title" content="${escHtml(title)}">`,
    `<meta property="og:description" content="${escHtml(description)}">`,
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">`,
  ];
  if (url) tags.push(`<link rel="canonical" href="${escHtml(url)}">`, `<meta property="og:url" content="${escHtml(url)}">`);
  if (image) {
    tags.push(
      `<meta property="og:image" content="${escHtml(image)}">`,
      `<meta property="og:image:width" content="${OG_SIZE.width}">`,
      `<meta property="og:image:height" content="${OG_SIZE.height}">`,
    );
  }
  return tags.join('\n  ');
}

// Structured data so search engines can tell this is free software.
export function softwareJsonLd({ name, description, url, repo }) {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name,
    description,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any (runs in a web browser)',
    license: 'https://opensource.org/licenses/MIT',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    ...(url ? { url } : {}),
    ...(repo ? { sameAs: [repo] } : {}),
  };
  // "<" is escaped so the JSON can never close the script tag early.
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

// Sets the title and description of an HTML page and adds tags before </head>.
// Replacer functions, so "$&" or "$'" in a title is inserted as text, not a pattern.
export function withHead(html, { title, description, extra = '' }) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/, () => `<title>${escHtml(title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${escHtml(description)}">`)
    .replace('</head>', () => `  ${extra}\n</head>`);
}

// demos/index.html: one card per demo, linking to demos/<id>/.
export function galleryPage({ title, description, demos, head = '' }) {
  const cards = demos.map((d) => `
      <li class="card">
        <a href="${escHtml(d.id)}/">
          ${d.image ? `<img src="../${escHtml(d.image)}" alt="" width="1200" height="630" loading="lazy">` : ''}
          <span class="name">${escHtml(d.title)}</span>
          <span class="desc">${escHtml(d.description)}</span>
        </a>
      </li>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(description)}">
  <link rel="icon" href="data:,">
  ${head}
  <style>
    :root { --bg: #F4F5F7; --fg: #111827; --muted: #4B5563; --card: #FFFFFF; --line: #E5E7EB; --brand: #0E676C; }
    @media (prefers-color-scheme: dark) {
      :root:not([data-theme="light"]) { --bg: #0F1215; --fg: #E5E7EB; --muted: #9CA3AF; --card: #171B20; --line: #2A3038; --brand: #5EC4C9; color-scheme: dark; }
    }
    :root[data-theme="dark"] { --bg: #0F1215; --fg: #E5E7EB; --muted: #9CA3AF; --card: #171B20; --line: #2A3038; --brand: #5EC4C9; color-scheme: dark; }
    body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
    main { box-sizing: border-box; max-width: 1100px; margin: 0 auto; padding: 32px 16px 48px; }
    h1 { margin: 0 0 4px; font-size: 28px; }
    p { margin: 0 0 24px; color: var(--muted); }
    a { color: var(--brand); }
    ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 20px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); }
    .card a { display: flex; flex-direction: column; height: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; color: inherit; text-decoration: none; }
    .card a:hover, .card a:focus-visible { border-color: var(--brand); outline: none; }
    .card img { display: block; width: 100%; height: auto; border-bottom: 1px solid var(--line); }
    .name { padding: 14px 16px 4px; font-weight: 600; }
    .desc { padding: 0 16px 16px; color: var(--muted); font-size: 14px; }
  </style>
</head>
<body>
  <main>
    <h1>${escHtml(title)}</h1>
    <p>${escHtml(description)} <a href="../">Home</a></p>
    <ul>${cards}
    </ul>
  </main>
</body>
</html>
`;
}

export function sitemap(urls) {
  const items = urls.map((u) => `  <url><loc>${escHtml(u)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</urlset>\n`;
}

export { OG_SIZE };
