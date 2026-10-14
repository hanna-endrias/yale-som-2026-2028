# Campus Customs Multi-Agent Operations

An agent team that runs the Campus Customs shop board. Open tickets (customer orders, rent,
unpaid bills, discount requests) are worked by five PydanticAI agents (**Boss, Inventory,
Accounting, Facilities, Customer Service**) that can delegate to each other. Every shop fact
comes from an **MCP server** over the shop database, a **FastAPI backend** runs the team and
records every step, and a **React board** lets a person watch the agents work and approve
any payment. Money only moves when a human approves it.

All agents use **gpt-6-luna through Portkey**, and no other model.

## What's inside

```
hw5/
|-- AI_prompts.md            # my prompts for each problem
|-- requirements.txt         # Python packages
|-- .env.example             # copy to .env and add PORTKEY_API_KEY
|-- .gitignore
|-- .mcp.json                # lets Claude Code connect to the MCP server
|-- README.md
|-- data/
|   |-- campus_customs.db        # the ORIGINAL shop database (never written)
|   `-- campus_customs_new.db    # the WORKING copy everything reads and writes
|-- mcp_server/
|   |-- server.py            # all 16 MCP tools (shop facts, board writes, human-only actions)
|   `-- README.md            # what each tool does
|-- frontend/                # React + Vite + TypeScript board (the "agent desk")
|-- backend/
|   |-- main.py              # FastAPI routes the board calls
|   |-- models.py            # all data types
|   |-- team.py              # the five agents, delegation, guardrails, limits
|   |-- llm.py               # the one model: gpt-6-luna via Portkey
|   |-- audit.py             # appends every agent step to output/audit_trail.json
|   |-- shop_rules.md        # rules every agent follows
|   `-- prompts/             # exactly one prompt per agent
|       |-- boss.md
|       |-- inventory.md
|       |-- accounting.md
|       |-- facilities.md
|       `-- customer_service.md
`-- output/
    |-- harness.md           # tables, MCP tools, agents, routes, dashboard, safety rules
    |-- mcp_smoke.json       # Problem 4: each MCP tool tested from Claude Code
    |-- desk_tickets.html    # expected vs. actual per ticket, cash, reflection
    |-- design.md            # dashboard design decisions
    |-- resolved_tickets.json
    |-- resolved_board.html  # screenshots of the board for each resolved ticket
    |-- audit_trail.json     # every agent step, human decision, and reset (append-only)
    `-- github_url.txt
```

The Problem 5 instructions let the backend layout vary as long as the five roles are clear, so
`team.py`, `llm.py`, `audit.py`, and `shop_rules.md` sit next to `main.py` and `models.py`.
None of them touch the database; only the MCP server does.

## What you need

- Python 3.12 or newer (built and tested on 3.14)
- Node.js 20 or newer (includes npm)
- A Portkey API key with access to `gpt-6-luna`

## 0. Get the code

This project lives in the `hw5/` folder of the repo:

```bash
git clone https://github.com/hanna-endrias/yale-som-2026-2028.git
```

```bash
cd yale-som-2026-2028/hw5
```

All the steps below run from this `hw5/` folder unless a step says otherwise.

## 1. Install (first time only)

Create a virtual environment:

```bash
python -m venv .venv
```

Activate it. Windows (PowerShell):

```bash
.venv\Scripts\Activate.ps1
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install the Python packages:

```bash
pip install -r requirements.txt
```

Install the board's packages:

```bash
npm --prefix frontend install
```

Add your API key. Copy `.env.example` to `.env` and fill it in:

```
PORTKEY_API_KEY=your-real-key
```

The board, tickets, cash, and approvals all work without a key; only running the agents needs it.

## 2. Make a clean working copy of the database

The shop data comes in `data/campus_customs.db`. That file is the **original** and is never
changed. Everything (the MCP server, the agents, the board) works on a copy,
`data/campus_customs_new.db`. Copy the original over the working copy whenever you want a clean run.

Windows (PowerShell):

```bash
Copy-Item data\campus_customs.db data\campus_customs_new.db -Force
```

macOS / Linux:

```bash
cp data/campus_customs.db data/campus_customs_new.db
```

A clean copy starts with checking at **$3,400**, and tickets 101, 102, and 103 open. Once the
backend is running (step 4) you can also reset from the board; see step 6.

## 3. Start the MCP server

`mcp_server/server.py` is the only code that reads or writes the shop database. It talks over
MCP's standard stdio transport, so it's started by whatever connects to it:

- **The FastAPI backend** (step 4) loads it automatically, so you don't need to start it separately for the board.
- **Claude Code** starts it from `.mcp.json` when you open this folder. Approve the `campus-customs` server when asked, and its tools become available in chat.
  - **Note:** `.mcp.json` is set up for **Windows**. It runs `.venv/Scripts/python.exe`, where Windows puts Python in a virtual environment. On **macOS / Linux**, change `"command"` in `.mcp.json` to `".venv/bin/python"`. The board, backend, and command-line runner work on every platform without this change.
- **The agent team from the command line** (step 6, option B) starts it for each run.

To start it by itself (for example, to check that it launches), with the virtual environment active:

```bash
python mcp_server/server.py
```

It starts and waits for an MCP client; press Ctrl+C to stop it. `mcp_server/README.md` lists all 16 tools.

## 4. Start the FastAPI backend (port 8000)

In a new terminal, activate the virtual environment (step 1), then go into `backend/`:

```bash
cd backend
```

```bash
uvicorn main:app --reload --port 8000
```

The API runs at http://localhost:8000, and http://localhost:8000/docs lists every route. The
routes are summarized in `output/harness.md` (Problem 7). The backend accepts calls from the
board at http://localhost:5173.

## 5. Start the React board (port 5173)

In another terminal, go into `frontend/`:

```bash
cd frontend
```

```bash
npm run dev
```

The board opens at http://localhost:5173. It shows the three tickets, the five agents, the
live feed, the checking balance, and the approvals waiting on you.

## 6. Full three-ticket run

**Reset first.** Before a full run, restore the original data so the run starts clean. Use any one of these:

- the **Reset shop** button at the top of the board (it asks to confirm), or
- `POST http://localhost:8000/reset`, or
- the copy command from step 2 (stop the backend first).

Check that the board shows **$3,400.00** in checking and all three tickets as **Open**. The
audit trail is never reset; it keeps every run.

**A. From the board (recommended)**

1. Type your name next to **Approving as**. It's saved as the approver on every payment.
2. Select **ticket 101** and press **Run agents**. Watch the agents work in the feed. Only one
   ticket runs at a time, because runs share the same cash. Then do **102** and **103**.
3. When a run finishes, its receipt shows the Boss's decision, and any payment or purchase
   order appears under **Needs your approval**. Approve rent first, then overdue invoices,
   then purchase orders. The balance drops with each approval.
4. A ticket resolves automatically when you decide its last pending request. If a ticket has
   nothing to approve, press **Mark resolved**.

**B. From the command line** (no board needed; still needs the backend's virtual environment):

```bash
python backend/team.py --all
```

This runs every open ticket in order and prints each decision. Approvals still happen on the board
(or through `POST /approvals/{id}/approve`), because no agent can approve money.

## Outputs

| File | What it holds |
|---|---|
| `output/audit_trail.json` | Every agent step (messages, tool calls, delegations, token usage), every human decision, and every reset. It's only ever appended to. |
| `output/desk_tickets.html` | Opens with a double-click. Expected vs. actual for each ticket, the itemized cash, and my reflection. |
| `output/resolved_tickets.json` | For each ticket: final status, outcome, each agent's contribution, and human approvals. |
| `output/resolved_board.html` | Opens with a double-click. A screenshot of the board for each resolved ticket. |
| `output/harness.md` | Tables, MCP tools, agents, API routes, dashboard, and safety rules. |
| `output/design.md` | Dashboard design decisions. |
| `output/mcp_smoke.json` | Each MCP tool tested from Claude Code and checked against the database. |

## Safety rules, in short

- **Only a human moves money.** Agents can only *request* a payment or purchase order. The tools that pay (`decide_approval`) and reset (`reset_working_database`) are hidden from every agent.
- **No negative balance.** Payments are refused if they would take checking below $0.
- **Rent first,** then overdue invoices, then new orders. A vendor with an unpaid invoice can't be paid for a new order.
- **No outside contact.** Customer messages are saved as drafts for a person to send.
- **The original database is never written,** and every step is audited.
- **Token and time limits per ticket:** 40 model requests, 60 tool calls, 200,000 tokens, 8 delegations, and 120 seconds per model request.

## Troubleshooting

- **PowerShell won't run `Activate.ps1`:** run `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` once.
- **The board says it can't reach the backend:** start the backend (step 4) and keep that terminal open.
- **`PORTKEY_API_KEY is missing`:** add the key to `.env` in the `hw5/` folder (step 1), then restart the backend.
- **A run says another run is still going:** wait for it to finish. Only one ticket runs at a time.
- **Port 8000 or 5173 is busy:** stop the other program using it, or close the old terminal running the backend or board.
