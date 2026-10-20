# Cover the whole source

Many walkthroughs teach from a source: a vendor's how-to guide, a help-centre article
or a training video. A walkthrough like that must cover **at least everything in its
source**: every section, step and path of the guide, and every point its video makes.
If it skips the hard parts, it ends up worth less than the document it was meant to
replace. Aim for a walkthrough that works alongside the guide and video, and goes
further where it can.

## Keep a coverage checklist

The checklist is your quality gate. The flow isn't finished until every line is
ticked.

1. **List the sources.** The guide, its video, and any page the guide sends readers to
   for a step.
2. **Give every item an ID.**
   - `G1`, `G2` … for the guide: each section, step, note, warning, choice and branch
     ("for servers, do this instead")
   - `V1`, `V2` … for each point the video makes
   - `X1`, `X2` … for anything extra you add
3. **Plan a step for each item** before you capture. A long source can be split into
   several flows (parts); note which part covers which items.
4. **Tick an item only when a step's narration or screenshot really covers it**, once
   the flow is built. Read the sources once more at the end to catch anything missed.
5. **Note what changed.** Where the source is out of date (old product names, moved
   menus), follow what the app shows today and say what changed.

Template:

| # | Source item | Step(s) | Done |
| --- | --- | --- | --- |
| G1 | Step 1: check the requirements | 2-4 | [x] |
| G2 | Note: servers need a different package | 9 | [x] |
| V1 | Video: where the onboarding package is downloaded | 6 | [x] |
| X1 | Extra: the permissions you need | 3 | [x] |

Keep it in `capture/coverage.md` while you work (`capture/` is git-ignored), and paste
the finished table into your pull request.

## Writing the content

- **Paraphrase.** Never copy the source's text or transcribe its video. Link to them
  instead, for example from the end card.
- **Check every fact** against the current version of the source.
- **Cover every branch.** If the guide offers a choice, show or say each option.
- **Add steps, not long sentences.** Keep each step's narration to one or two short
  sentences.

The [agent skill](../plugin/skills/demo-anything/SKILL.md) follows this when you give
it the links to the source; see [agent-workflow.md](agent-workflow.md).
