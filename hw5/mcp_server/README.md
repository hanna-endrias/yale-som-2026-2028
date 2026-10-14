# Campus Customs MCP Server

## Purpose
This MCP server is the single source of shop facts for the Campus Customs agent team
(Boss, Inventory, Accounting, Facilities, Customer Service). Agents call these tools
instead of guessing, so every answer comes from the database, and every change to the
shop goes through here too. The backend has no second set of shop tools.

Agents can read data, save customer drafts, and request approvals. **Only a human can
approve a payment or order**, using `decide_approval`, which the agent team never sees.

## Database
- Uses **`data/campus_customs_new.db`**, the working copy of the shop database.
- Read tools open it read-only. Write tools open it read-write but never create a file.
  If the file is missing, the server raises an error.
- The original `data/campus_customs.db` is never written. The server refuses to start if pointed at it, and
  only `reset_working_database` reads it, to copy it over the working copy.
- "Today" for all date math is `desk.date_today`, not the computer's clock.
- The first board write creates three extra tables in the working copy:
  `approval_requests`, `message_drafts`, and `ticket_updates`.

## Tools

### Read
| Tool | Inputs | What it returns |
|---|---|---|
| `list_open_tickets` | none | Every ticket that isn't resolved, oldest first |
| `get_ticket` | `ticket_id` | The ticket plus its linked invoice, lease, stock, pricing, and board history |
| `check_inventory_shortfall` | `sku`, `size`, `qty_needed` | Stock on hand, units short, other sizes, cost, price, margin, and invoices that mention the SKU |
| `list_inventory` | `max_qty` (optional) | Every SKU and size, lowest stock first |
| `get_vendor_status` | `vendor_id` (optional) | Lead time, open invoices with days overdue, and whether each vendor can ship |
| `get_lease_status` | `lease_id` | Rent, next due date, days until due, and whether cash covers rent alone and rent plus open invoices |
| `get_cash_position` | `account` (default `checking`) | Balance, open invoices, rent due within 30 days, pending requests, payments made, and cash available for new orders |
| `check_discount` | `sku`, `qty`, `discount_pct` (optional) | Whether an offer fits the discount policy, the maximum allowed, the unit price, the total, and the margin |

### Board writes (no money moves)
| Tool | Inputs | What it does |
|---|---|---|
| `request_payment_approval` | `kind` (`invoice`/`rent`), `ref_id`, `ticket_id`, `requested_by`, `reason` | Creates a pending request. The amount comes from the database. Refused if it would break the $0 floor or the payment priority. |
| `request_purchase_order` | `vendor_id`, `sku`, `size`, `qty`, `ticket_id`, `requested_by`, `reason` | Creates a pending restock request costing qty × unit_cost. Refused if unaffordable (returns `max_affordable_qty`). Flagged if the vendor is blocked by an unpaid invoice. |
| `save_customer_draft` | `ticket_id`, `subject`, `body`, `drafted_by` | Saves a draft to the ticket's requester. Never sends it. |
| `update_ticket_status` | `ticket_id`, `status`, `note`, `updated_by` | Changes the status and logs why. Can't mark a ticket resolved while requests are pending. |

### Dashboard views (read-only, not given to agents)
| Tool | Inputs | What it returns |
|---|---|---|
| `list_tickets` | none | Every ticket, open or resolved, with `is_open` and counts of pending approvals and drafts |
| `list_approval_requests` | `status` (optional: `pending`/`approved`/`rejected`) | Approval requests, newest first |

### Human only
| Tool | Inputs | What it does |
|---|---|---|
| `decide_approval` | `request_id`, `decision` (`approve`/`reject`), `decided_by`, `note` | Approving pays it in one transaction: checks the balance stays at or above $0, adds a `payments` row, lowers `cash_accounts.balance`, and marks the invoice paid or moves the lease's `next_due` forward a month. A purchase order can't be approved while its vendor has an unpaid invoice. Agent names are refused as `decided_by`. |
| `reset_working_database` | none | Copies the original `data/campus_customs.db` over the working copy for a clean run (the dashboard's Reset button). The original is only read; board tables are cleared because the original doesn't have them. Refuses if the working path points at the original. |

Every tool returns `found: false` with an error message if the ticket, SKU, vendor, lease,
or request doesn't exist.

## Shop policy built into the tools
- **Cash floor:** $0. No request or payment may take the balance negative.
- **Payment priority:** rent due within 30 days, then overdue vendor invoices, then new purchase orders.
- **Discounts:** fewer than 10 units get none; 10–19 units up to 10% off; 20 or more up to 20% off; never below a 40% margin over cost.
- **Vendors:** a vendor with an open unpaid invoice won't ship, so a new order to it can't be approved.

## Keeping agents honest
- Results include `data_notes` saying what the database does **not** record, so agents label guesses as guesses.
- The database has no vendor-to-SKU link. Tools surface the only real evidence (invoice
  descriptions that mention a SKU) and say it's a hint, not a fact.
- The server sends these rules as MCP instructions, which every connected client reads.

## Running
```
.venv/Scripts/python mcp_server/server.py
```
The agent team in `backend/team.py` starts this server itself over stdio when run from the
command line. The FastAPI backend (`backend/main.py`) loads it in-process instead, because
`uvicorn --reload` on Windows can't start subprocesses. Claude Code connects through `.mcp.json`.
