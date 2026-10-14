## Problem 2 :  Database tables

**desk**
- Fields: date_today, notes
- Significance: Sets "today" for the shop, so agents know what is due or overdue.

**tickets**
- Fields: id, type, requester, subject, sku, size, qty, lease_id, invoice_id, status, notes, created_at
- Significance: the Boss reads each ticket and decides which agent handles it.

**inventory**
- Fields: sku, name, size, qty, location
- Significance: Inventory checks stock by SKU and size here to spot shortfalls.

**pricing**
- Fields: sku, unit_cost, list_price
- Significance: Accounting uses cost and price to check margins before approving a discount.

**vendors**
- Fields: id, name, specialty, lead_days
- Significance: Inventory uses it to pick who can restock and how long it will take.

**invoices**
- Fields: id, vendor_id, amount, due_date, status, description
- Significance: Accounting tracks unpaid bills here, and a vendor with an open invoice won't ship.

**leases**
- Fields: id, space_name, landlord, monthly_rent, next_due, notes
- Significance: Facilities uses it to know how much rent is owed and when.

**cash_accounts**
- Fields: name, balance, date
- Significance: Accounting checks the balance so a payment never takes it below zero.

**payments**
- Fields: id, kind, ref_id, amount, account, paid_at, approved_by
- Significance: The record of every human-approved payment. It gets a new row each time money goes out.

## Problem 3 : MCP Server Tools

**check_inventory_shortfall**
- Function: Given a product, size, and quantity, it shows how many are in stock, how many the shop is short, stock in other sizes, and the cost, price, and margin.
- Tables: inventory, pricing
- Unlocks: Ticket 103 (Yale AI Club wants 20 hoodies in size M with a bulk discount)
- Why: Only 8 are in stock, so it shows the shop is 12 short, and it shows the $36 per-unit margin that decides how much discount the shop can afford.

**get_vendor_status**
- Function: Shows each vendor's lead time and any unpaid invoices (with how many days overdue), and says whether that vendor can ship right now.
- Tables: vendors, invoices, desk
- Unlocks: Ticket 101 (customer needs a white tee in size S)
- Why: The tee is out of stock and Bulldog Print Co won't reprint it because invoice 501 ($840) is 3 days overdue, so this shows the invoice must be paid first and restock takes 5 days.

**get_lease_status**
- Function: Shows how much rent is owed on a lease, when it's due, how many days are left, and whether the cash balance can cover it. It does not pay anything.
- Tables: leases, cash_accounts, desk
- Unlocks: Ticket 102 (landlord says rent is due)
- Why: It shows $2,400 rent is due 9/02 (2 days away) and that checking has $3,400, so the rent can be paid without going negative once a human approves it.

## Problem 5 : Agent Team

Built with PydanticAI. Every agent uses gpt-6-luna through Portkey. Any agent can ask any other agent for help with the `ask_teammate` tool (full connectivity). Prompts are in `backend/prompts/`, exactly one per agent, and every agent also reads the shared rules in `backend/shop_rules.md`.

**Boss**
- Role: Reads each ticket, decides who works on it, makes the final call, and records the ticket status.
- MCP tools: get_ticket, list_open_tickets, get_cash_position, check_discount, update_ticket_status

**Inventory**
- Role: Checks stock by SKU and size, spots shortfalls, finds in-stock alternatives, and works out which vendor can restock and when.
- MCP tools: get_ticket, check_inventory_shortfall, list_inventory, get_vendor_status

**Accounting**
- Role: Watches cash and invoices, checks margins and discounts, and prepares payment and purchase-order requests for human approval.
- MCP tools: get_ticket, get_cash_position, get_vendor_status, get_lease_status, check_inventory_shortfall, check_discount, request_payment_approval, request_purchase_order

**Facilities**
- Role: Handles the shop space: the lease, rent due dates, and the landlord.
- MCP tools: get_ticket, get_lease_status, get_cash_position

**Customer Service**
- Role: Drafts messages to the person who raised the ticket. Drafts stay on the board; nothing is sent.
- MCP tools: get_ticket, check_inventory_shortfall, save_customer_draft

### MCP Tools

| Tool | Function | Tables | Used by |
|---|---|---|---|
| check_inventory_shortfall | Stock on hand, shortfall, other sizes, cost, price, and margin for a SKU and size | inventory, pricing, invoices, vendors | Inventory, Accounting, Customer Service |
| get_vendor_status | Each vendor's lead time, unpaid invoices, and whether it can ship | vendors, invoices, desk | Inventory, Accounting |
| get_lease_status | Rent owed, due date, days left, and whether cash covers it | leases, cash_accounts, invoices, desk | Accounting, Facilities |
| list_open_tickets | The queue of tickets that aren't resolved | tickets, desk | Boss |
| get_ticket | One ticket with its linked invoice, lease, stock, pricing, and board history | tickets, invoices, vendors, leases, inventory, pricing, desk, approval_requests, message_drafts, ticket_updates | Everyone |
| list_inventory | Every SKU and size, lowest stock first (optionally only at or below a quantity) | inventory | Inventory |
| get_cash_position | Balance, bills owed, rent coming due, pending requests, and cash left for new orders | cash_accounts, invoices, vendors, leases, payments, approval_requests, desk | Boss, Accounting, Facilities |
| check_discount | Tests a bulk discount against the owner's policy (10+ units up to 10%, 20+ up to 20%, at least 40% margin) | pricing | Boss, Accounting |
| request_payment_approval | Asks a human to approve paying an invoice or rent. Does not pay. | invoices, leases, cash_accounts, approval_requests, desk | Accounting |
| request_purchase_order | Asks a human to approve a restock order. Does not order. | vendors, inventory, pricing, invoices, cash_accounts, approval_requests, desk | Accounting |
| save_customer_draft | Saves a message to the ticket's requester. Does not send. | tickets, message_drafts, desk | Customer Service |
| update_ticket_status | Changes a ticket's status and logs why | tickets, approval_requests, ticket_updates, desk | Boss |
| decide_approval | **Human only.** Approves or rejects a request. Approving pays it, records the payment, lowers the balance, and marks the invoice paid or moves rent's due date forward. | approval_requests, payments, cash_accounts, invoices, leases, vendors, desk | No agent |
| reset_working_database | **Human only** (added in Problem 11). Copies the original database over the working copy for a clean run; the dashboard's Reset button calls it. | all tables (copied from `campus_customs.db`, which is only read) | No agent |

**Board tables:** `approval_requests`, `message_drafts`, and `ticket_updates` are created by the MCP server in the working copy the first time an agent writes to the board. They don't exist in the original database, so resetting removes them.

### Safety

**Guardrails for real customers and real money**
- **A human approves every payment.** Agents can only request a payment. The one tool that moves money (`decide_approval`) is hidden from every agent, refuses an agent's name as the approver, and is checked again before any tool call goes out.
- **No negative balances.** Payments are refused if they would take cash below $0, both when requested and when approved.
- **Payment priority is enforced in code.** Rent is set aside before invoices, and invoices before new orders, so an agent can't spend rent money on a restock.
- **Amounts come from the database.** Agents never type a payment amount; the tools look it up.
- **A vendor with an unpaid invoice can't be paid for a new order.** That order can't be approved until the invoice is.
- **Discounts are checked against policy.** `check_discount` enforces the tiers and the 40% margin floor, and the Boss can't record a discount it didn't check.
- **No outside contact.** Customer messages are saved as drafts for a human to send, and drafts never include cash, debts, costs, or margins.
- **Least privilege.** Each agent only sees the tools its role needs.
- **No impersonation and no stray writes.** The team overwrites "who did it" with the real agent's name and pins every write to the ticket being worked. Each override is logged as a `guardrail` event.
- **No duplicate requests.** A second request for the same bill returns the existing one.
- **Full audit trail.** Every step of every agent loop is appended to `output/audit_trail.json`: prompts, tool calls with arguments, results, delegations, retries, guardrail events, token usage, and final outputs. The file is never wiped.
- **The original database is protected.** The server refuses to run against `campus_customs.db` and never creates a database file.
- **No guessing.** Every tool result says what the database doesn't record, and agents must label inferences as inferences.

**Limits that keep token use in check**
- Per ticket run, shared by all agents: 40 model requests, 60 tool calls, and 200,000 tokens. The run stops if any limit is hit.
- At most 8 delegations per ticket, and at most 3 levels deep (Boss → A → B → C).
- An agent can't ask itself or anyone already in the chain, so delegation can't loop.
- Each model reply is capped at 2,000 tokens, and tools are called one at a time.
- Agents only see their own tools, so each request sends fewer tool descriptions.
- Tool results and model text are clipped to 1,500 characters in the audit trail so the file stays readable.

## Problem 7 : Backend Routes

FastAPI app in `backend/main.py`, started from `backend/` with `uvicorn main:app --reload --port 8000` (base URL http://localhost:8000).

- `GET /tickets`: lists the three tickets with their status and whether each is open or resolved.
- `GET /tickets/{ticket_id}`: one ticket with its linked invoice, lease, and stock, plus its board history (approval requests, drafts, status changes).
- `POST /tickets/{ticket_id}/run`: runs the agent team on that ticket in the background and returns a run ID right away (add `?wait=true` to wait for the result). Only one run at a time.
- `GET /runs/{run_id}`: whether a run is still going, finished, or failed, and the Boss's decision when it's done. `GET /runs` lists every run since the server started.
- `GET /events`: recent agent events from the audit trail, meaning what each agent said and which tools it used. Filter with `?ticket_id=`, `?run_id=`, or `?agent=`, and poll with `?after=<last id>` to get only new events.
- `GET /approvals`: the payment and purchase-order requests the agents prepared (`?status=pending` for only those waiting on a human).
- `POST /approvals/{request_id}/approve`: a human approves a request (body: `{"decided_by": "<name>"}`). This is the only route that moves cash: it records the payment, lowers the balance, and marks the invoice paid or moves rent forward a month.
- `POST /approvals/{request_id}/reject`: a human rejects a request. No money moves.
- `GET /cash`: the current checking balance from `cash_accounts`, plus money already promised to pending requests.
- `POST /tickets/{ticket_id}/resolve`: a human marks a ticket resolved (added in Problem 8). Refused while any of its requests still await approval. Approving or rejecting a ticket's last pending request also resolves it automatically.
- `POST /reset`: copies `campus_customs.db` over `campus_customs_new.db` for a fresh run. The audit trail is kept. Not allowed while a run is going.

Notes:
- All shop data comes through the MCP server, the same tools the agents use. Two read-only tools were added for the dashboard: `list_tickets` (all tickets, open or resolved) and `list_approval_requests`. No agent can see them.
- Approvals, rejections, and resets are also written to `output/audit_trail.json`, as `human_decision` and `db_reset` events.
- The API runs the MCP server in the same process (FastMCP's in-memory transport). On Windows, `uvicorn --reload` can't start subprocesses, so stdio won't work there.

## Problem 8 : Dashboard

React + Vite + TypeScript in `frontend/`, plain CSS. Start it from `frontend/` with `npm run dev` (http://localhost:5173). It calls the backend at http://localhost:8000. Full design notes are in `output/design.md`.

- **Layout:** tickets on the left; the five agents in a row with delegation lines, then the live conversation and the receipt in the middle; checking balance and approvals on the right.
- **Tickets:** all three, with status labels (Open, Agents working, Waiting on you, Needs you, Resolved), counts of pending approvals and drafts, and **Run agents** / **Mark resolved** buttons.
- **Watching agents:** each agent has its own color and icon. The working agent glows with typing dots, and arcs show who delegated to whom. The feed shows messages, tool calls (click to see results), handoffs, reports, guardrail events, and human decisions, indented by delegation level. It refreshes every 0.9s during a run.
- **Summary:** when a run ends, a receipt shows the Boss's decision, one line per agent with the tools it used, the money involved, and the next steps. It gets a **RESOLVED** stamp once the ticket is resolved.
- **Approvals:** each pending request shows the amount, the reason, which agent asked, and "Leaves $X in checking". Approving requires the human's name, which is saved as `payments.approved_by`.
- **Cash:** the checking balance counts down when a payment goes out. A bar splits it into rent set aside, awaiting approval, unpaid invoices, and free for new orders, and a ledger lists every payment.
- **Other:** a light/dark toggle, **Reset shop** (with confirmation), and a direct link to any ticket (`#ticket=101`).

## Problem 9 : Full Run and Final Harness

### Full run (all three tickets, from a fresh reset)
| | Ticket 101 | Ticket 102 | Ticket 103 |
|---|---|---|---|
| Delegations | Boss → Inventory, Boss → Accounting, Boss → Customer Service | Boss → Facilities → Accounting, Boss → Accounting | Boss → Inventory, Boss → Accounting → Inventory, Boss → Customer Service |
| Requests | #1 invoice #501 $840, #2 tee order $8 | #3 rent $2,400 | none |
| Human decision | Hanna approved #1 and #2 | Hanna approved #3 | marked resolved by a human |
| Tokens (about) | 98,400 | 74,100 | 112,100 |

Cash: **$3,400.00 → $152.00** (−$2,400 rent, −$840 invoice #501, −$8 tee order). This matches `cash_accounts` in the working database. Every agent step is in `output/audit_trail.json`, and the expected-vs-actual comparison and itemized cash are in `output/desk_tickets.html`.

Two problems came up during the run, and both are recorded in the audit trail:
- **API endpoint error.** The first attempt at ticket 101 stopped at the first model call: Portkey serves gpt-6-luna through Azure, which rejects tool calls on the Chat Completions endpoint. The agents now use the Responses API. Same model, same gateway.
- **Hung model request.** One attempt at ticket 103 stalled because a model request hung for over 9 minutes. Every model request now times out after 120 seconds, and the ticket was re-run. Nothing had been written.

### Tables
- **Original shop tables (9):** desk, tickets, inventory, pricing, vendors, invoices, leases, cash_accounts, payments. See Problem 2.
- **Board tables (3):** created by the MCP server in the working copy the first time anything is written to the board:
  - `approval_requests`: payments and purchase orders waiting on, approved by, or rejected by a human
  - `message_drafts`: customer messages saved for a human to send
  - `ticket_updates`: every status change, who made it, and why

### MCP tools (16)
| Group | Tools | Who can use them |
|---|---|---|
| Read | list_open_tickets, get_ticket, check_inventory_shortfall, list_inventory, get_vendor_status, get_lease_status, get_cash_position, check_discount | Agents, by role (see Problem 5) |
| Board writes (no money moves) | request_payment_approval, request_purchase_order, save_customer_draft, update_ticket_status | Accounting; Customer Service; Boss |
| Dashboard views | list_tickets, list_approval_requests | Backend only, never agents |
| Human only | decide_approval, reset_working_database | Backend approve/reject and reset routes only, never agents |

### Agents (5)
Boss, Inventory, Accounting, Facilities, and Customer Service, all on **gpt-6-luna through Portkey**, the only model in the code. Any agent can delegate to any other with `ask_teammate`. Roles, tools, and prompts are in Problem 5 and `backend/prompts/`.

**About "gpt-6-luna-global" in the audit trail:** every request the code sends asks for `gpt-6-luna` (`MODEL_NAME` in `backend/llm.py`), and that is the name logged on each `run_start` event. Portkey routes that request to Azure, and the replies come back labeled `gpt-6-luna-global`, Azure's name for the deployment that served it. That's the name logged on each `model_response` event. It is the same requested model, not a second model; no other model name appears anywhere in the code.

**Prompt update after the run:** after the Problem 9 run, a short "Shop rules for this role" section was added to each agent prompt in `backend/prompts/`. It restates the rules from `backend/shop_rules.md` that the role relies on, which every agent already read. The recorded outputs (`audit_trail.json`, `resolved_tickets.json`, and the Actual sections of `desk_tickets.html`) predate it. No agent has run since, and testing used scratch copies of the database and audit trail, so the audit trail contains only the real run.

### API routes (11)
Listed one per line in Problem 7: tickets, a single ticket, run, runs, events, approvals, approve, reject, resolve, cash, reset.

### Safety rules (final)
- **Only a human moves money.** Agents can only request a payment. `decide_approval` is hidden from every agent, refuses an agent's name as the approver, and is called only by the dashboard's approve route with the human's name.
- **No negative balances.** Payments are refused below $0, both when requested and when approved. The full run ended at $152.
- **Payment priority is enforced in the tools:** rent first, then overdue invoices, then new orders.
- **Vendors with unpaid invoices can't ship.** An order to such a vendor can't be approved until the invoice is paid.
- **Amounts come from the database**, never from the model.
- **Discounts are checked against policy** (10+ units up to 10%, 20+ up to 20%, at least a 40% margin) before they're offered.
- **Two-stage resolution.** A ticket is never marked resolved while its money is still waiting on a human. It resolves when the last request is decided, or by hand when nothing is pending.
- **No outside contact.** Customer messages are saved as drafts for a human to send.
- **Least privilege, no impersonation, no stray writes.** Each agent sees only its own tools, the team overwrites "who did it" with the real agent's name, and every write is pinned to the current ticket. Overrides are logged as `guardrail` events.
- **One run at a time**, and no reset while a run is going. Runs share the same cash.
- **The original database is protected.** The server refuses to run against `campus_customs.db`; reset only copies it over the working copy.
- **Everything is audited.** Every agent step, human decision, and reset is appended to `output/audit_trail.json`, which is never wiped.
- **Token and time limits:** per ticket, 40 model requests, 60 tool calls, and 200,000 tokens; 8 delegations at most 3 levels deep; 2,000 tokens per reply; 120 seconds per model request.
