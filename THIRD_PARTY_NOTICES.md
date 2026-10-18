# Third-party notices

Demo Anything's own code is licensed under the [MIT licence](LICENSE). It uses the
packages below, which keep their own licences. Full licence texts ship inside each
package in `node_modules/` after `npm install`.

## Runtime

| Package | Used for | Licence |
| --- | --- | --- |
| [sharp](https://github.com/lovell/sharp) | Redaction, box previews, screenshot conversion | Apache-2.0 |
| [libvips](https://github.com/libvips/libvips) (prebuilt binaries installed with sharp) | Image processing inside sharp | LGPL-3.0-or-later |
| [@img/colour](https://github.com/lovell/colour) (installed with sharp) | Colour conversion inside sharp | MIT |

## Optional, for making narration

Not installed by `npm install`; add them only if you make narration.

| Package | Used for | Licence |
| --- | --- | --- |
| [kokoro-js](https://github.com/hexgrad/kokoro) and the Kokoro-82M model | Free local voice (`npm install kokoro-js`) | Apache-2.0 |
| [faster-whisper](https://github.com/SYSTRAN/faster-whisper) | Measured word timings with `--align` (`pip install faster-whisper`) | MIT |
| [FFmpeg](https://ffmpeg.org/) | Converting and normalising audio | LGPL or GPL, depending on the build |

Narration files in `flows/*/assets/v*.mp3` were made with Kokoro (`bm_george`).

## Development and tests

| Package | Used for | Licence |
| --- | --- | --- |
| [@playwright/test](https://github.com/microsoft/playwright) | Browser tests | Apache-2.0 |
| Chromium (downloaded by `npx playwright install chromium`) | Browser for the tests | BSD-3-Clause and others; see the Chromium credits |

## Player

The player in `index.html` and `player/` uses no third-party code and is what
GitHub Pages publishes. It loads one web font:

| Asset | Used for | Licence |
| --- | --- | --- |
| [Inter](https://rsms.me/inter/), served by [Google Fonts](https://fonts.google.com/specimen/Inter) | The player's text | SIL Open Font License 1.1 |

Loading it means each viewer's browser contacts Google's font servers. To avoid
that, remove the two Google Fonts lines from `index.html`; the player falls back to
the system font.

## Products shown in demos

Screenshots of third-party products in `flows/` show those products as they looked
when captured. Product names, logos and interfaces belong to their owners. See the
[Licence section of the README](README.md#licence) and
[DISCLAIMER.md](DISCLAIMER.md).
