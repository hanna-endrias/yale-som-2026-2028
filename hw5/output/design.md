# Campus Customs Agent Desk: Design Decisions

The dashboard (`frontend/`, React + Vite + TypeScript, plain CSS) is where a human picks a ticket,
watches the five agents work it, and signs off on any money. It talks to the FastAPI backend at
http://localhost:8000 and starts with `npm run dev` (http://localhost:5173).

## Goals
1. **Make the agents readable.** You should be able to tell who is talking, what they're doing, and who asked them, at a glance.
2. **Make money feel real.** Cash only goes out in this shop, so every approval should feel like signing a check.
3. **Make "done" trustworthy.** A ticket that looks finished must actually be finished.

## Layout: command center with an agent stage
Three columns, chosen over an "agent stage only" layout or a kanban board:

| Left | Center | Right |
|---|---|---|
| **Tickets**: the three tickets with status labels and a "Run agents" button on the selected one | **Agent stage** (the five agents in a row) above the **live conversation** for the selected ticket, then the **receipt** when the run ends | **Checking** balance and budget bar, then **Needs your approval** |

**Why:** the whole loop (pick a ticket, watch, approve, see cash drop) fits on one screen without switching
views. The agent stage from the "agent stage" layout sits on top of the conversation, so you get the fun of
watching characters light up without giving up the full history. The kanban option made status the hero, but
watching the agents is the point of this desk, so status became colored labels on the ticket cards instead.
On narrower screens the right column moves below the other two, and on phones everything stacks.

## How agents read differently
Each agent has its own color and icon, used everywhere it appears (stage, feed, receipt, approvals):

| Agent | Color | Icon | Why |
|---|---|---|---|
| Boss | Navy | Briefcase | The shop's brand color, the one in charge |
| Inventory | Teal | Box | Stockroom |
| Accounting | Green | Ledger | Money |
| Facilities | Amber | Building | The shop space |
| Customer Service | Coral | Chat bubble | A warm, human-facing voice |
| You (human) | Purple | Person | Clearly not an agent |

- **The stage shows state, not just identity.** Agents who haven't joined the run are dimmed and desaturated. The working agent's avatar glows and shows typing dots. An agent that handed off work shows "Waiting on a teammate". An agent that's finished gets a green check and "Reported back".
- **Delegation lines.** Each handoff draws an arc from one avatar to another (Boss → Facilities → Accounting). The arc becomes a dashed, moving line while either end is working, so you can see the request travel through the team.
- **The conversation looks like a thread.** Each message is a card with the agent's colored left edge, name, icon, and time. Replies from delegated agents are indented one step per delegation level, so the chain is visible in the layout itself.
- **Different kinds of activity look different:**
  - *Agent messages:* plain cards.
  - *Tool calls:* small expandable labels under the message (wrench icon, tool name in a code font, arguments). Click one to see the raw tool result, which is the evidence behind each claim.
  - *Handoffs:* dashed "From → To" cards with the request text. Refused handoffs (e.g. a delegation loop) turn amber.
  - *Reports back:* cards tinted in the agent's color, with "Reported back" / "Made the call" and the actions taken.
  - *Guardrail events* (an agent's identity or ticket overwritten) are purple shield lines, *retries* amber, *errors* red.
  - *Human decisions* are purple lines ("You · Hanna approved request #1"), so people and agents never blur together.
- **Typography carries voice:** a serif (Fraunces) for the shop name, ticket subjects, and the Boss's decision; a clean sans-serif (Inter) for the UI; a monospace font (JetBrains Mono) for tool names, SKUs, and receipt lines.

## Resolved tickets: two stages
We kept the safety rule from Problem 5: **a ticket is never resolved while its money is still waiting on a human.**
Otherwise a ticket could look done while, say, rent sat unapproved and was paid late.

1. **The run finishes.** The ticket label becomes "Waiting on you" (or "Needs you") and a **receipt** appears: the Boss's decision and reasoning, one line per agent with the tools they used, the money involved, your next steps, and tokens used. A "Agents done · N awaiting you" ribbon shows what's left.
2. **You decide the last pending request.** The backend marks the ticket resolved automatically. A green **RESOLVED** rubber stamp drops onto the receipt, the ticket gets a "Resolved" label with a check, and a toast confirms it. Tickets with nothing pending can be closed with **Mark resolved**, which the backend refuses if anything is still pending.

Older runs stay viewable from a run picker, and any run from before the last database reset is labeled **Before reset** so stale results are never mistaken for current ones.

## Cash
- **A till display.** The checking balance is a large serif number that counts down smoothly when money goes out. A red "−$840" floats up and fades beside it, so you see the payment leave.
- **A budget bar for what's already spoken for.** The balance is split into four colored segments, with exact amounts in the legend:
  *Set aside for rent* (amber) · *Awaiting your approval* (blue) · *Unpaid invoices* (red) · *Free for new orders* (green).
  This makes the shop's real constraint visible: of $3,400, only **$160** is free once rent and the overdue invoice are covered.
- **A ledger** under the bar lists every payment with who approved it.

## Approvals styled like checks
- Each pending request is a card with a light diagonal pattern, like a blank check: what it is, the amount in large type, the requesting agent's reason in quotes, which agent asked, a link to its ticket, and **"Leaves $X in checking"** so you know the result before you approve. It turns red if the payment would overdraw.
- **Purchase orders blocked by an unpaid vendor invoice** say so on the card ("Bulldog Print Co won't ship until invoice #501 is paid. Approve that first."), and the backend refuses them too.
- **You sign with your name.** "Approving as" in the top bar is required (it's recorded as `payments.approved_by`) and remembered between visits. Approve is the one filled button on each card; Reject sits next to it as a quieter secondary button.

## Creative touches that make it enjoyable
- **The agents feel like characters:** glowing avatars, typing dots, "Waiting on a teammate", and moving delegation lines make a run fun to watch.
- **The receipt and stamp:** the Boss's decision prints as a shop receipt with a torn top edge and dashed dividers, and resolving a ticket stamps it.
- **Money moves visibly:** the balance counts down, the drop amount floats away, and the budget bar segments shift.
- **Two themes, both deliberate.** Light mode is warm paper and navy ink, like a shop counter. Dark mode is a deep navy desk with brighter agent colors. A sun/moon toggle switches them, it starts from your system setting, and your choice is remembered.
- **Small affordances:** toasts confirm every action in plain language ("Paid $840. Checking is now $2,560."); a "Live" pill pulses during a run; the feed auto-scrolls while agents work.

## Live updates and safety
- The board polls the backend: every 0.9s for new events while a run is going, every 3s otherwise. New events also refresh tickets, cash, and approvals.
- **One run at a time.** Runs share the same cash, so other tickets' Run buttons are disabled during a run and the backend returns 409 if two start at once.
- **Reset shop** asks for confirmation, is disabled during a run, and keeps the audit trail.
- If the backend is down, a banner explains exactly how to start it.

## Accessibility
- Tickets and buttons work with the keyboard and have visible focus rings; icon-only buttons have labels.
- The feed and balance are announced to screen readers when they change.
- All animation is turned off for people who set "reduce motion" in their system settings.
- Every color is a theme variable, so both themes keep readable contrast.

## What we decided against
- **Sound.** We considered a cash-register "cha-ching", but the shop never takes money in, so there was no natural moment for it.
- **Kanban columns.** They showed status well but hid the agent conversation in a drawer.
- **A UI library or Tailwind.** Plain CSS with variables was enough for this look, keeps dependencies minimal, and matches the hw4 setup.
