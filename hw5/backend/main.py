"""Campus Customs backend API for the agent dashboard.

Start it from the backend/ folder:
    uvicorn main:app --reload --port 8000

Shop data comes from the campus-customs MCP server, the same tools the agents use.
The server runs in this process over FastMCP's in-memory transport: uvicorn's
--reload mode on Windows can't start subprocesses, so stdio isn't an option here.
"""

import asyncio
import importlib.util
import json
import os
from contextlib import asynccontextmanager
from typing import Any, Literal

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from fastapi import FastAPI, HTTPException, Query, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastmcp import Client
from fastmcp.exceptions import ToolError

import audit
from models import AuditEvent, DecisionIn, RunRecord
from team import MCP_SERVER, Team, new_run_id



def _load_mcp_server():
    spec = importlib.util.spec_from_file_location("campus_customs_mcp", MCP_SERVER)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.mcp


MCP_SERVER_APP = _load_mcp_server()


class Shop:
    """The API's MCP connection plus bookkeeping for agent runs started from the dashboard."""

    def __init__(self) -> None:
        self.client: Client | None = None
        self.runs: dict[str, RunRecord] = {}
        self._tasks: set[asyncio.Task] = set()

    async def call(self, tool: str, args: dict[str, Any] | None = None) -> dict:
        try:
            result = await self.client.call_tool(tool, args or {})
        except ToolError as e:
            raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"MCP tool {tool} failed: {e}") from e
        return result.structured_content or {}

    def active_run(self) -> RunRecord | None:
        return next((r for r in self.runs.values() if r.status == "running"), None)

    def start(self, run: RunRecord) -> asyncio.Task:
        task = asyncio.create_task(self._execute(run))
        self._tasks.add(task)  # keep a reference so the task isn't garbage-collected
        task.add_done_callback(self._tasks.discard)
        return task

    @staticmethod
    async def _execute(run: RunRecord) -> None:
        try:
            team = Team(mcp_client=Client(MCP_SERVER_APP))
            run.decision = await team.work_ticket(run.ticket_id, run_id=run.run_id)
            run.status = "done"
        except Exception as e:  # recorded on the run and in the audit trail; never crashes the API
            run.status = "error"
            run.error = f"{type(e).__name__}: {e}"
        finally:
            run.finished_at = audit.now()


shop = Shop()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with Client(MCP_SERVER_APP) as client:
        shop.client = client
        yield


app = FastAPI(title="Campus Customs API", lifespan=lifespan)
app.add_middleware(  # let the Vite dashboard (another localhost port) call this API from the browser
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",  # if Vite picks another port
    allow_methods=["*"],
    allow_headers=["*"],
)


def _log(agent: Literal["human", "system"], event: str, ticket_id: int | None = None, **fields: Any) -> None:
    audit.append(AuditEvent(
        timestamp=audit.now(), run_id=f"{agent}-{new_run_id()}", ticket_id=ticket_id,
        agent=agent, chain=[], depth=0, step=0, event=event, **fields))


def _summary(e: dict) -> str:
    """One readable line per audit event, for the board."""
    kind, who = e.get("event"), e.get("agent")
    if kind == "run_start":
        return f"{who} started: {e.get('text', '')}"
    if kind == "model_response":
        calls = ", ".join(c["tool"] for c in e.get("tool_calls") or [])
        said = e.get("text") or ""
        return " | ".join(p for p in (said, f"calls {calls}" if calls else "") if p) or f"{who} replied"
    if kind == "tool_result":
        return f"{e.get('tool')} returned"
    if kind == "delegation":
        args = e.get("args") or {}
        verdict = "" if e.get("result") == "accepted" else f" (refused: {e.get('result')})"
        return f"asked {args.get('teammate')}: {args.get('request')}{verdict}"
    if kind == "run_end":
        return f"{who} finished"
    if kind in ("tool_retry", "guardrail", "error"):
        return f"{kind}: {e.get('tool') or ''} {e.get('result') or e.get('error') or ''}".strip()
    return e.get("result") or kind or ""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.get("/")
async def index() -> dict:
    """What this API is and which routes it has."""
    return {"service": "Campus Customs API",
            "routes": sorted({f"{', '.join(r.methods - {'HEAD'})} {r.path}" for r in app.routes
                              if getattr(r, "methods", None) and not r.path.startswith(("/docs", "/openapi", "/redoc"))})}


@app.get("/tickets")
async def list_tickets() -> dict:
    """Every ticket with its status and whether it is still open."""
    return await shop.call("list_tickets")


@app.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: int) -> dict:
    """One ticket with its linked data and board history (requests, drafts, status updates)."""
    data = await shop.call("get_ticket", {"ticket_id": ticket_id})
    if not data.get("found"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, data.get("error", "Ticket not found."))
    return data


@app.post("/tickets/{ticket_id}/run", status_code=status.HTTP_202_ACCEPTED)
async def run_ticket(ticket_id: int, response: Response,
                     wait: bool = Query(False, description="Wait for the run to finish instead of returning at once.")
                     ) -> RunRecord:
    """Run the agent team on one ticket. Returns at once; poll /runs/{run_id} and /events."""
    found = await shop.call("get_ticket", {"ticket_id": ticket_id})
    if not found.get("found"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, found.get("error", "Ticket not found."))
    busy = shop.active_run()
    if busy is not None:  # one run at a time: runs share the same cash and token budget
        raise HTTPException(status.HTTP_409_CONFLICT,
                            f"Run {busy.run_id} on ticket {busy.ticket_id} is still going. Try again when it finishes.")
    run = RunRecord(run_id=new_run_id(), ticket_id=ticket_id, status="running", started_at=audit.now())
    shop.runs[run.run_id] = run
    task = shop.start(run)
    if wait:
        await task
        response.status_code = status.HTTP_200_OK
    return run


@app.get("/runs")
async def list_runs() -> list[RunRecord]:
    """Agent runs started since the server came up, newest first."""
    return sorted(shop.runs.values(), key=lambda r: r.started_at, reverse=True)


@app.get("/runs/{run_id}")
async def get_run(run_id: str) -> RunRecord:
    """One run's status and, when done, the Boss's decision."""
    run = shop.runs.get(run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No run {run_id} since the server started.")
    return run


@app.get("/events")
async def recent_events(
    after: int = Query(-1, description="Only events with an id greater than this (for polling)."),
    limit: int = Query(100, ge=1, le=1000),
    ticket_id: int | None = None,
    run_id: str | None = None,
    agent: str | None = None,
) -> dict:
    """Recent audit-trail events: what each agent said and which tools it used."""
    entries = audit.read_all()
    picked = []
    for i, e in enumerate(entries):
        if i <= after or "event" not in e:
            continue
        if ticket_id is not None and e.get("ticket_id") != ticket_id:
            continue
        if run_id is not None and e.get("run_id") != run_id:
            continue
        if agent is not None and e.get("agent") != agent:
            continue
        picked.append({"id": i, "summary": _summary(e), **e})
    return {"latest_id": len(entries) - 1, "events": picked[-limit:]}


@app.get("/approvals")
async def list_approvals(status_: Literal["pending", "approved", "rejected"] | None = Query(None, alias="status")) -> dict:
    """Payment and purchase-order requests the agents prepared, newest first."""
    return await shop.call("list_approval_requests", {"status": status_})


async def _decide(request_id: int, decision: Literal["approve", "reject"], body: DecisionIn) -> dict:
    requests = (await shop.call("list_approval_requests"))["requests"]
    req = next((r for r in requests if r["id"] == request_id), None)
    if req is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No approval request {request_id}.")
    result = await shop.call("decide_approval", {
        "request_id": request_id, "decision": decision, "decided_by": body.decided_by, "note": body.note})
    _log("human", "human_decision", ticket_id=req["ticket_id"], tool="decide_approval",
         args={"request_id": request_id, "decision": decision, "decided_by": body.decided_by, "note": body.note},
         result=json.dumps(result))
    if not result.get("found"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, result.get("error", "Not found."))
    if not result.get("decided"):
        raise HTTPException(status.HTTP_409_CONFLICT, result.get("reason", "Request could not be decided."))
    resolved = await _resolve_if_clear(req["ticket_id"], body.decided_by,
                                       f"Last pending request (#{request_id}) {decision}d by {body.decided_by}.")
    cash = await shop.call("get_cash_position")
    return {"result": result, "balance": cash.get("balance"), "ticket_id": req["ticket_id"], "ticket_resolved": resolved}


async def _resolve_if_clear(ticket_id: int | None, who: str, note: str) -> bool:
    """Two-stage resolution: a ticket resolves once a human has decided its last pending request."""
    if ticket_id is None:
        return False
    data = await shop.call("get_ticket", {"ticket_id": ticket_id})
    if not data.get("found") or data["ticket"]["status"] == "resolved":
        return False
    if any(r["status"] == "pending" for r in data["board"]["approval_requests"]):
        return False
    update = await shop.call("update_ticket_status", {
        "ticket_id": ticket_id, "status": "resolved", "note": note, "updated_by": who})
    if update.get("updated"):
        _log("human", "human_decision", ticket_id=ticket_id, tool="update_ticket_status",
             args={"status": "resolved", "updated_by": who}, result=note)
    return bool(update.get("updated"))


@app.post("/approvals/{request_id}/approve")
async def approve(request_id: int, body: DecisionIn) -> dict:
    """A human approves a payment or purchase order. This is the only route that moves cash."""
    return await _decide(request_id, "approve", body)


@app.post("/approvals/{request_id}/reject")
async def reject(request_id: int, body: DecisionIn) -> dict:
    """A human rejects a payment or purchase order. No money moves."""
    return await _decide(request_id, "reject", body)


@app.post("/tickets/{ticket_id}/resolve")
async def resolve_ticket(ticket_id: int, body: DecisionIn) -> dict:
    """A human marks a ticket resolved. Refused while any of its requests still await approval."""
    data = await shop.call("get_ticket", {"ticket_id": ticket_id})
    if not data.get("found"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, data.get("error", "Ticket not found."))
    update = await shop.call("update_ticket_status", {
        "ticket_id": ticket_id, "status": "resolved", "note": body.note or f"Resolved by {body.decided_by}.",
        "updated_by": body.decided_by})
    if not update.get("updated"):
        raise HTTPException(status.HTTP_409_CONFLICT, update.get("reason", "Ticket could not be resolved."))
    _log("human", "human_decision", ticket_id=ticket_id, tool="update_ticket_status",
         args={"status": "resolved", "updated_by": body.decided_by}, result=body.note or "resolved")
    return update


@app.get("/cash")
async def cash() -> dict:
    """The current checking balance from cash_accounts, split the way the budget bar shows it."""
    data = await shop.call("get_cash_position", {"account": "checking"})
    if not data.get("found"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, data.get("error", "No checking account."))
    rent_reserve = sum(r["monthly_rent"] for r in data["rent_due_within_30_days"] if not r["payment_requested"])
    unrequested = sum(i["amount"] for i in data["open_invoices"] if not i["payment_requested"])
    return {
        **{k: data[k] for k in ("account", "balance", "as_of", "today", "pending_total", "available_for_new_orders")},
        "rent_reserve": round(rent_reserve, 2),
        "unpaid_invoices_not_requested": round(unrequested, 2),
        "open_invoices": data["open_invoices"],
        "payments_made": data["payments_made"],
    }


@app.post("/reset")
async def reset() -> dict:
    """Copy the original database over the working copy for a fresh run (via the MCP server). The audit trail is kept."""
    busy = shop.active_run()
    if busy is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, f"Run {busy.run_id} is still going; reset after it finishes.")
    result = await shop.call("reset_working_database")
    if not result.get("reset"):
        raise HTTPException(status.HTTP_409_CONFLICT, result.get("reason") or result.get("error", "Reset failed."))
    _log("system", "db_reset", result=f"Copied {result['copied_from']} over {result['copied_to']}.")
    return {"reset": True, "balance": result["balance"], "tickets": result["tickets"]}
