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

## Development and tests

| Package | Used for | Licence |
| --- | --- | --- |
| [@playwright/test](https://github.com/microsoft/playwright) | Browser tests | Apache-2.0 |
| Chromium (downloaded by `npx playwright install chromium`) | Browser for the tests | BSD-3-Clause and others; see the Chromium credits |

The player in `index.html` and `player/` uses no third-party code and is what
GitHub Pages publishes.

## Products shown in demos

Screenshots of third-party products in `flows/` show those products as they looked
when captured. Product names, logos and interfaces belong to their owners. See the
[Licence section of the README](README.md#licence) and
[DISCLAIMER.md](DISCLAIMER.md).
