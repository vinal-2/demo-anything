# Security and SOC training

**Who it's for:** Blue teams, managed security providers and anyone onboarding SOC analysts.

## The problem

Analysts learn consoles such as Microsoft Defender or Sentinel by watching long screen recordings, or by practising in production. Recordings go out of date, are hard to search, and often show tenant names, user emails and IP addresses.

## How Demo Anything helps

- Capture a **sandbox tenant** with the agent skill: it stays read-only and screenshots response buttons without pressing them.
- Redaction is enforced: areas are padded and blurred or filled, import refuses unredacted screenshots, and `validate` fails on emails, tenant IDs and public IPs.
- Analysts click through at their own pace, with narration and captions, and can replay a single step.
- Embed a walkthrough in your learning platform and track completion through the player's progress events.

## Steps

1. Sign in to your sandbox in a dedicated Chrome profile.
2. Ask your agent to build the flow, for example "isolate a device".
3. Add your tenant and lab names to `capture/sensitive-terms.txt`.
4. Validate, test and publish.

See [getting started](../getting-started.md) and [building flows with an agent](../agent-workflow.md)
for the details, and [redaction](../redaction.md) before you publish anything real.

## Try it

Play [Isolating a device in Microsoft Defender for Endpoint](https://vinal-2.github.io/demo-anything/?flow=mde-isolate-device) to see what a finished walkthrough looks like.
