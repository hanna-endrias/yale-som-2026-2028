# User test: Malleable AI (2026-10-25)

**Who:** a co-founder of Malleable AI, who agreed to be quoted. The raw transcript and a photo from the session are kept locally and are not in the repo.

**Format:** about 15 minutes on a call. I shared my screen and drove the app while the co-founder chose the inputs and reacted. The steps follow [`../USER_TEST.md`](../USER_TEST.md), except for the timed "old way" task, which we skipped (see "What's missing" below).

## Today's way

Malleable AI is a boutique AI services firm. Its marketing is LinkedIn posts about new features and products, things the team has built, and roles it is hiring for. It uses no tools to measure the impact:

> "We don't really have any tools to capture the impact. And all of our marketing is just LinkedIn posts."

The firm recently rebranded its website, so the co-founder picked the last two months as the period to check.

## What we ran

| Step | Input | Result |
|---|---|---|
| Add tracker | "Malleable AI", description "ai services firm", search terms left to the agent | created |
| First fetch | Sep 1 – Oct 24, 2026, weekly (8 windows), criteria notes "branding, product launch" | **0 mentions**, about 1¾ min, $0.021 |
| Chat | "Where are people talking about us? Show the top sources and what each one is saying." | Said there were no stored mentions in that period, and did not make anything up |
| Chat → second fetch | "Can you do a fetch for Malleable AI in LinkedIn?" → same dates, weekly, "Include LinkedIn" in the notes | **0 mentions**, about 1½ min, $0.020 |

Total cost: about **$0.04** (two fetches at about $0.02 each, plus 5 chat turns at about $0.001 together). The tracker is saved as seed data in `db/fixtures/subjects/user-test-malleable-ai.json`.

## What we learned

1. **The product can't see where this business markets itself.** Hosted web search does not index LinkedIn posts, and Malleable has little web presence outside LinkedIn. Adding "Include LinkedIn" to the criteria didn't change that. The co-founder expected this: *"I don't think it's gonna be able to search LinkedIn with just basic web fetch."* This goes in **Limits**. Perspectives suits businesses that people talk about on the open web (press, Reddit, blogs, YouTube), not ones whose only channel is LinkedIn.
2. **It reported zero honestly.** With no data, the analyst said so instead of inventing sources. That is what the missing-data rule is meant to do.
3. **Asking for a fetch in chat took too many turns.** The analyst asked for cadence and criteria one at a time, so "do a fetch on LinkedIn" took 4 user messages to reach a fetch plan.
4. **UX feedback was positive.**
   - The chat side panel (Questions / Criteria / Fetches) helps because you can see which dates are already fetched before you ask.
   - *"I like the chat experience … there's just one simple screen to interact with."* Hiding raw tool calls made the chat "cleaner".
   - Moving the prompt library below trackers was the right call, and the co-founder liked light mode and the home dashboard.
   - I pointed out a bug during the demo: clicking an item on the home dashboard does not open its page.
5. **Product ideas from the owner.**
   - When a tracker finds nothing, suggest next steps, e.g. how to build a presence online, possibly using a marketing playbook as context.
   - Grow into an **all-in-one marketing assistant**: help run campaigns, then track how they land. *"We could help you execute the marketing campaign and track the results."*
6. **Barrier to adoption:** support for bring-your-own API keys (transcribed as "cloud API keys", most likely Claude). Today the app runs on the course's Portkey key.

## What's missing

- No timed "old way" baseline: we didn't run the 5-minute manual search, so there is no before/after time comparison.
- No answer was checked for accuracy, because there were no mentions to check.

## Caveat: possible bias

The tester knows me personally and had seen earlier versions of the app, so they are not an independent, arm's-length user. Some of their earlier suggestions were already built in, and they knew the session was for my class project. Treat the positive UX feedback as a signal of direction, not as validation. The findings that don't depend on opinion still hold: 0 mentions, LinkedIn out of reach, the cost, and the extra turns to reach a fetch plan. A test with users who have no tie to the project is still needed.
