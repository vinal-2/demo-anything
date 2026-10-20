// Which link targets the player follows. Shared with tools/validate-flow.mjs, so a flow
// that validates never contains a link the player would drop.

// End-card buttons: https, in-page (#) or same-site (/path or ./path) links.
export const SAFE_BUTTON_HREF = /^(https:\/\/|#|\/(?!\/)|\.\/)/i;

// [text](href) links inside subtitles: https and in-page (#) links only.
export const SAFE_TEXT_HREF = /^(?:https:\/\/|#)/i;

// Every [text](href) link in a piece of text, whatever its target.
export function textLinks(text) {
  return [...String(text ?? '').matchAll(/\[([^\]]+)\]\(([^\s)]*)\)/g)].map((m) => ({ label: m[1], href: m[2] }));
}
