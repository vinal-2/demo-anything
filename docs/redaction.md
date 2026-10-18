# Redaction

Screenshots of real systems leak more than you expect. Redact before you import.

## What to hide

- tenant, organisation and subscription names and IDs
- people's names, email addresses, UPNs and profile pictures
- public IP addresses, host names and device names
- keys, tokens, secrets, and URLs or IDs that contain them
- anything else that identifies a person, customer or organisation

Look at the corners: account menus, browser-like headers, notification toasts and
breadcrumbs often show the tenant or user.

## `redact.json`

Put it next to `shots/` and `steps.json` in the raw capture folder. It must list
**every** screenshot, using `[]` when there is nothing to hide. The tool refuses
to run if a screenshot is missing from the list, so none is skipped by accident.

```json
{
  "01-home.png": [
    { "x": 1180, "y": 12, "width": 260, "height": 28, "reason": "tenant name" },
    { "x": 1450, "y": 8, "width": 140, "height": 36, "reason": "signed-in user" }
  ],
  "02-settings.png": []
}
```

Values are screenshot pixels. `reason` is for you and reviewers; the tool ignores it.

- Every area grows by **8 px** on each side, so the edges of text are covered even if
  your box is a little short. Set `"pad": 12` (or `0`) on an area to change it.
- `"style": "solid"` paints an opaque block instead of blurring. Use it for IDs, keys
  and anything where even a blurred shape is too much.

## Run it

```bash
npm run preview -- capture/raw          # red dashed boxes show what will be hidden
npm run redact -- capture/raw capture/clean
```

Each area is pixelated and then blurred (or filled), so text inside it cannot be read.
The tool empties `capture/clean/shots/` first, so a renamed screenshot can't linger,
and re-encodes every image, so no hidden metadata survives. It copies `steps.json` and
writes `redaction.json`, a record of each cleaned file's SHA-256.

`npm run import` refuses a folder without `redaction.json`, or with a screenshot that
was added or changed after redaction, so unredacted images can't become a flow.

## Your own sensitive words

List words that must never appear in a published flow, one per line, in
`capture/sensitive-terms.txt` (git-ignored, so the list stays private): your tenant
or company name, lab device names, people's names. `npm run validate` fails if any of
them appears anywhere in `flow.json`. It also always fails on email addresses,
`*.onmicrosoft.com` names, GUIDs, public IP addresses and token-like strings. The
error names the step and field and only shows a masked hint of what it found.

## Check it

Open every image in `capture/clean/shots/`. If you can read anything you should
not, add an area and run the tool again. Only import from `capture/clean`.

`capture/` is git-ignored and never served by `npm start`. If identifying data
ever reaches a published flow, follow [SECURITY.md](../SECURITY.md).
