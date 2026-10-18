# IT runbooks

**Who it's for:** Service desks and system administrators.

## The problem

Runbooks for tasks such as resetting MFA or adding a user to a group drift from the real admin portal and are hard to follow under pressure.

## How Demo Anything helps

- Show each runbook as a step-by-step walkthrough of the real portal, captured read-only.
- New starters can rehearse a procedure without touching production.
- Keep runbooks in git so changes are reviewed, and CI checks every flow still plays.

## Steps

1. Pick a procedure, for example "reset a user's MFA".
2. Capture it in a test tenant.
3. Redact names and IDs.
4. Publish to your intranet as static files.

See [getting started](../getting-started.md) and [building flows with an agent](../agent-workflow.md)
for the details, and [redaction](../redaction.md) before you publish anything real.

## Try it

Play [Example: turn on email alerts](https://vinal-2.github.io/demo-anything/?flow=example) to see what a finished walkthrough looks like.
