# Developer docs and API consoles

**Who it's for:** Developer relations teams and technical writers.

## The problem

Getting-started guides for dashboards and API consoles are long lists of screenshots that readers lose their place in.

## How Demo Anything helps

- Replace a wall of screenshots with an interactive tour of the console: create a key, set a webhook, read the logs.
- Flows are JSON in your docs repository, reviewed in pull requests like any other docs change.
- Never publish a real key: `validate` fails on tokens and long keys in the text, and redaction hides them in images.

## Steps

1. Capture the console in a demo account.
2. Use `"style": "solid"` to block out keys.
3. Commit the flow next to your docs.
4. Link it from the relevant page.

See [getting started](../getting-started.md) and [building flows with an agent](../agent-workflow.md)
for the details, and [redaction](../redaction.md) before you publish anything real.

## Try it

Play [Example: turn on email alerts](https://vinal-2.github.io/demo-anything/?flow=example) to see what a finished walkthrough looks like.
