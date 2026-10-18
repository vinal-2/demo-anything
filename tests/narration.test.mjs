import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { applyLexicon, checkScript, estimateTimings, mapTimings, shiftTimings } from '../tools/lib/narration.mjs';
import { parseArgs, resolveNarrator } from '../tools/make-voice.mjs';

describe('choosing the narrator', () => {
  const flow = { narrator: { provider: 'kokoro', voice: 'bf_emma', speed: 1.1 } };
  const env = { TTS_PROVIDER: 'google', GOOGLE_TTS_VOICE: 'en-GB-Chirp3-HD-Aoede', TTS_SPEED: '0.9' };

  test('the flow wins over the environment', () => {
    assert.deepEqual(resolveNarrator(flow, {}, env), { provider: 'kokoro', voice: 'bf_emma', speed: 1.1 });
  });

  test('flags win over the flow', () => {
    const opts = parseArgs(['flows/x', '--provider', 'google', '--speed', '1.2', '--only', '3']);
    assert.equal(opts.only, 3);
    assert.deepEqual(resolveNarrator(flow, opts, env), { provider: 'google', voice: 'en-GB-Chirp3-HD-Aoede', speed: 1.2 });
  });

  test('the environment is used last, then the provider default', () => {
    assert.deepEqual(resolveNarrator({}, {}, env), { provider: 'google', voice: 'en-GB-Chirp3-HD-Aoede', speed: 0.9 });
    assert.deepEqual(resolveNarrator({}, { provider: 'kokoro' }, {}), { provider: 'kokoro', voice: 'bm_george', speed: 1 });
    assert.equal(resolveNarrator({}, {}, {}).provider, 'browser');
  });

  test('refuses an unknown provider or option', () => {
    assert.throws(() => resolveNarrator({}, { provider: 'azure' }, {}), /Unknown provider "azure"/);
    assert.throws(() => parseArgs(['--speedy']), /Unknown option --speedy/);
  });
});

describe('estimateTimings', () => {
  test('starts after the lead-in silence and stays inside the audio', () => {
    const timings = estimateTimings('Open the device page.', 2.3);
    assert.equal(timings.length, 4);
    assert.equal(timings[0].t, 0.15);
    assert.ok(timings.at(-1).t < 2.3 - 0.15);
    assert.deepEqual(timings.map((x) => x.word), ['Open', 'the', 'device', 'page.']);
  });

  test('gives longer words more time', () => {
    const [a, b, c] = estimateTimings('a isolation b', 3, { lead: 0, tail: 0 });
    assert.ok(c.t - b.t > b.t - a.t, 'the long word should last longer than the short one');
  });

  test('adds a pause after a comma', () => {
    const plain = estimateTimings('one two three four', 3, { lead: 0, tail: 0 });
    const comma = estimateTimings('one two, three four', 3, { lead: 0, tail: 0 });
    const gap = (list) => list[2].t - list[1].t;
    assert.ok(gap(comma) > gap(plain), 'the word after a comma should start later');
  });

  test('returns nothing for an empty script', () => {
    assert.deepEqual(estimateTimings('   ', 3), []);
  });
});

describe('applyLexicon', () => {
  const lexicon = { 'LAB-WS22-01': 'lab W S twenty-two oh one', MDE: 'M D E', LAB: 'lab' };

  test('replaces whole words and prefers the longest match', () => {
    assert.equal(applyLexicon('Open LAB-WS22-01 in MDE.', lexicon), 'Open lab W S twenty-two oh one in M D E.');
  });

  test('leaves words that only contain a key alone', () => {
    assert.equal(applyLexicon('MDEX and LABS stay as they are', lexicon), 'MDEX and LABS stay as they are');
  });

  test('does nothing without a lexicon', () => {
    assert.equal(applyLexicon('Open MDE', {}), 'Open MDE');
  });
});

describe('mapTimings', () => {
  test('matches by position when the word counts are the same', () => {
    const spoken = [{ t: 0.1, word: 'open' }, { t: 0.5, word: 'mde' }];
    assert.deepEqual(mapTimings('Open MDE.', spoken), [{ t: 0.1, word: 'Open' }, { t: 0.5, word: 'MDE.' }]);
  });

  test('maps proportionally when the lexicon changed the word count', () => {
    const original = 'Open LAB-WS22-01 now';
    const spoken = applyLexicon(original, { 'LAB-WS22-01': 'lab W S twenty-two oh one' });
    const spokenTimings = spoken.split(' ').map((word, k) => ({ t: k * 0.4, word }));
    const mapped = mapTimings(original, spokenTimings);
    assert.deepEqual(mapped.map((x) => x.word), ['Open', 'LAB-WS22-01', 'now']);
    assert.equal(mapped[0].t, 0);
    assert.equal(mapped[2].t, spokenTimings.at(-1).t);
    assert.ok(mapped[1].t > mapped[0].t && mapped[1].t < mapped[2].t);
  });

  test('never lets a word start before the one before it', () => {
    const mapped = mapTimings('a b c d e', [{ t: 0, word: 'a' }, { t: 1, word: 'b' }]);
    mapped.slice(1).forEach((x, k) => assert.ok(x.t >= mapped[k].t));
  });

  test('shiftTimings adds the lead-in', () => {
    assert.deepEqual(shiftTimings([{ t: 0.2, word: 'Hi' }], 0.15), [{ t: 0.35, word: 'Hi' }]);
  });
});

describe('checkScript', () => {
  test('passes a short, plain script', () => {
    assert.equal(checkScript('Open the device page from the inventory.'), null);
  });

  test('flags brackets, slashes and symbols with a rewrite', () => {
    const result = checkScript('Pick Full (recommended) and/or Selective & add 100% of tags.');
    assert.equal(result.issues.length, 3);
    assert.equal(result.suggestion, 'Pick Full, recommended, and or or Selective and add 100 per cent of tags.');
  });

  test('flags a script over 30 words and suggests splitting it', () => {
    const long = `${'word '.repeat(16)}then, ${'more '.repeat(16)}`.trim();
    const result = checkScript(long);
    assert.match(result.issues[0], /^33 words/);
    assert.match(result.suggestion, /then\. More/);
  });
});
