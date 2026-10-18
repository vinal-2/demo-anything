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

Values are screenshot pixels. Make each area generous: the whole text plus a few
pixels around it. `reason` is for you and reviewers; the tool ignores it.

## Run it

```bash
npm run preview -- capture/raw          # red dashed boxes show what will be hidden
npm run redact -- capture/raw capture/clean
```

Each area is pixelated and then blurred, so text inside it cannot be read. The rest
of the image is unchanged. `steps.json` is copied to the clean folder.

## Check it

Open every image in `capture/clean/shots/`. If you can read anything you should
not, add an area and run the tool again. Only import from `capture/clean`.

`capture/` is git-ignored and never served by `npm start`. If identifying data
ever reaches a published flow, follow [SECURITY.md](../SECURITY.md).
