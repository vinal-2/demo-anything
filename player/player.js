// Plays a flow: a cover card, one screenshot per step with a hotspot to click, then an end card.
// Open /?flow=<id> to play a flow, or / to list every flow in flows/index.json.

const FLOW_ID = /^[a-z0-9][a-z0-9-]*$/;
const app = document.getElementById('app');
let onKey = null;

document.addEventListener('keydown', (event) => onKey?.(event));

main().catch((err) => {
  if (err.status === 404) showMessage('Flow not found', 'Check the flow name in the address bar.');
  else showMessage('Something went wrong', err.message);
});

async function main() {
  const id = new URLSearchParams(location.search).get('flow');
  if (!id) return showIndex(await loadJson('flows/index.json'));
  if (!FLOW_ID.test(id)) return showMessage('Flow not found', 'Flow names use lower-case letters, numbers and dashes.');
  play(await loadJson(`flows/${id}/flow.json`));
}

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error(`Could not load ${url} (${res.status})`), { status: res.status });
  return res.json();
}

function play(flow) {
  const base = `flows/${flow.id}/`;
  const total = flow.steps.length;
  let index = 0;

  const next = () => (index < total - 1 ? showStep(index + 1) : showEnd());
  const back = () => (index > 0 ? showStep(index - 1) : showCover());

  function showCover() {
    onKey = null;
    render(el('section', { class: 'card', 'data-testid': 'cover' },
      el('h1', {}, flow.cover.title),
      el('p', { class: 'subtitle' }, flow.cover.subtitle ?? ''),
      el('p', { class: 'meta' }, `${total} steps`),
      button('Start', () => showStep(0), { class: 'primary', 'data-testid': 'start' })));
  }

  function showStep(i) {
    index = i;
    const step = flow.steps[i];
    const { width, height } = flow.imageSize;
    const { x, y, width: w, height: h, label } = step.hotspot;
    const pct = (value, of) => `${(Number(value) / of) * 100}%`;

    const hotspot = button(el('span', { class: 'tip' }, label), next, {
      class: (Number(y) + Number(h)) / height > 0.85 ? 'hotspot tip-above' : 'hotspot',
      'data-testid': 'hotspot',
      'aria-label': `${label}: go to the next step`,
      style: `left:${pct(x, width)};top:${pct(y, height)};width:${pct(w, width)};height:${pct(h, height)}`,
    });

    render(el('section', { class: 'step', 'data-testid': 'step' },
      el('header', { class: 'bar' },
        el('span', { class: 'count', 'data-testid': 'step-count' }, `Step ${i + 1} of ${total}`),
        el('span', { class: 'screen' }, step.screen ?? '')),
      el('div', { class: 'stage', style: `--ratio:${Number(flow.aspectRatio)}` },
        el('img', { src: base + step.image, alt: `Screenshot: ${step.screen ?? `step ${i + 1}`}`, 'data-testid': 'screenshot' }),
        hotspot),
      el('div', { class: 'narration' },
        el('div', {},
          el('p', { class: 'say' }, step.say ?? ''),
          step.why ? el('p', { class: 'why' }, `Why it matters: ${step.why}`) : ''),
        el('nav', {},
          button('Back', back),
          button(i === total - 1 ? 'Finish' : 'Next', next, { class: 'primary' })))));

    if (i + 1 < total) new Image().src = base + flow.steps[i + 1].image;
    onKey = (event) => {
      if (event.key === 'ArrowRight') next();
      if (event.key === 'ArrowLeft') back();
    };
  }

  function showEnd() {
    onKey = null;
    render(el('section', { class: 'card', 'data-testid': 'end' },
      el('h1', {}, flow.end?.title ?? 'All done'),
      el('p', {}, flow.end?.text ?? `You have finished "${flow.name}".`),
      el('nav', {},
        button('Start again', showCover, { class: 'primary', 'data-testid': 'restart' }),
        el('a', { href: './' }, 'All demos'))));
  }

  showCover();
}

function showIndex(flows) {
  render(el('section', { class: 'card', 'data-testid': 'index' },
    el('h1', {}, 'Demos'),
    flows.length
      ? el('ul', {}, ...flows.map((f) => el('li', {}, el('a', { href: `?flow=${encodeURIComponent(f.id)}` }, f.name))))
      : el('p', {}, 'No demos yet. See the README to make one.')));
}

function showMessage(title, text) {
  onKey = null;
  render(el('section', { class: 'card', 'data-testid': 'message' }, el('h1', {}, title), el('p', {}, text),
    el('a', { href: './' }, 'All demos')));
}

// Swaps in a new view and moves keyboard and screen-reader focus to its heading.
function render(node) {
  app.replaceChildren(node);
  const heading = node.querySelector('h1, [data-testid="step-count"]');
  if (heading) {
    heading.tabIndex = -1;
    heading.focus();
  }
}

function button(content, onClick, attrs = {}) {
  const node = el('button', { type: 'button', ...attrs }, content);
  node.addEventListener('click', onClick);
  return node;
}

// Builds an element. Text is always added as text, never as HTML.
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, value);
  node.append(...children);
  return node;
}
