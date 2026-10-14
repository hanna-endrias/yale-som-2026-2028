"""The Campus Customs agent team: Boss, Inventory, Accounting, Facilities, Customer Service.

How a ticket is worked:
1. The Boss is handed a ticket ID and runs its agent loop (model -> tools -> model ...).
2. Every agent has the same ask_teammate tool, so any agent can delegate to any other
   (full connectivity). A delegated agent runs its own loop and returns a structured report.
3. Shop facts and every write go through the campus-customs MCP server. Each agent only
   sees the MCP tools its role needs; no agent can see decide_approval, so money only
   moves when a human approves.
4. Every step of every loop is appended to output/audit_trail.json.

Run from the project root:
    .venv/Scripts/python backend/team.py 101          # one ticket
    .venv/Scripts/python backend/team.py --all        # every open ticket
"""

import asyncio
import json
import os
import sys
import uuid
from pathlib import Path
from typing import Any

os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from fastmcp import Client
from fastmcp.client.transports import StdioTransport
from pydantic import BaseModel
from pydantic_ai import Agent, ModelRetry, ModelSettings, RunContext
from pydantic_ai.mcp import CallToolFunc, MCPToolset
from pydantic_ai.messages import RetryPromptPart, TextPart, ToolCallPart, ToolReturnPart
from pydantic_ai.models import Model
from pydantic_ai.usage import RunUsage, UsageLimits

import audit
from llm import MODEL_NAME, make_model
from models import (AGENT_NAMES, AgentName, AgentSpec, AuditEvent, RunState, SpecialistReport, TeamDeps,
                    TicketDecision)

BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
PROMPTS_DIR = BACKEND_DIR / "prompts"            # exactly one prompt file per agent
SHOP_RULES = BACKEND_DIR / "shop_rules.md"       # the rules every agent shares
MCP_SERVER = PROJECT_ROOT / "mcp_server" / "server.py"

# --- Token and loop limits -------------------------------------------------
MAX_DELEGATION_DEPTH = 3          # boss -> A -> B -> C at most
MAX_DELEGATIONS_PER_TICKET = 8    # total ask_teammate calls in one ticket run
USAGE_LIMITS = UsageLimits(       # shared by every agent in one ticket run
    request_limit=40,
    tool_calls_limit=60,
    total_tokens_limit=200_000,
)
# timeout: a model request that hangs fails after 120s instead of freezing the whole run
MODEL_SETTINGS = ModelSettings(max_tokens=2_000, parallel_tool_calls=False, timeout=120)

# --- Who may use which MCP tools (least privilege) -------------------------
READ_TOOLS = {"get_ticket"}
HUMAN_ONLY_TOOLS = {"decide_approval", "reset_working_database"}
IDENTITY_ARG = {  # board-writing tools and the argument that records who did it
    "request_payment_approval": "requested_by",
    "request_purchase_order": "requested_by",
    "save_customer_draft": "drafted_by",
    "update_ticket_status": "updated_by",
}
TICKET_SCOPED_TOOLS = set(IDENTITY_ARG)


SPECS: dict[AgentName, AgentSpec] = {
    "boss": AgentSpec(
        "boss", "Boss",
        "Reads each ticket, decides who works on it, and makes the final call.",
        frozenset(READ_TOOLS | {"list_open_tickets", "get_cash_position", "check_discount", "update_ticket_status"}),
        TicketDecision,
    ),
    "inventory": AgentSpec(
        "inventory", "Inventory",
        "Checks stock by SKU and size, spots shortfalls, and finds which vendor can restock and when.",
        frozenset(READ_TOOLS | {"check_inventory_shortfall", "list_inventory", "get_vendor_status"}),
        SpecialistReport,
    ),
    "accounting": AgentSpec(
        "accounting", "Accounting",
        "Watches cash and invoices, checks margins and discounts, and prepares payments or "
        "purchase orders for human approval.",
        frozenset(READ_TOOLS | {"get_cash_position", "get_vendor_status", "get_lease_status",
                                "check_inventory_shortfall", "check_discount",
                                "request_payment_approval", "request_purchase_order"}),
        SpecialistReport,
    ),
    "facilities": AgentSpec(
        "facilities", "Facilities",
        "Handles the shop space: leases, rent, and the landlord.",
        frozenset(READ_TOOLS | {"get_lease_status", "get_cash_position"}),
        SpecialistReport,
    ),
    "customer_service": AgentSpec(
        "customer_service", "Customer Service",
        "Drafts messages to customers and other requesters. Drafts stay on the board; nothing is sent.",
        frozenset(READ_TOOLS | {"check_inventory_shortfall", "save_customer_draft"}),
        SpecialistReport,
    ),
}
assert set(SPECS) == set(AGENT_NAMES)
assert not any(spec.mcp_tools & HUMAN_ONLY_TOOLS for spec in SPECS.values())


# --- Run state ---------------------------------------------------------------

def new_run_id() -> str:
    return uuid.uuid4().hex[:12]


def _log(deps: TeamDeps, event: str, **fields: Any) -> None:
    deps.state.step += 1
    audit.append(AuditEvent(
        timestamp=audit.now(),
        run_id=deps.state.run_id,
        ticket_id=deps.state.ticket_id,
        agent=deps.agent,
        chain=list(deps.chain),
        depth=deps.depth,
        step=deps.state.step,
        event=event,
        **fields,
    ))


def _as_text(value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, BaseModel):
        return value.model_dump_json()
    try:
        return json.dumps(value, default=str)
    except TypeError:
        return str(value)


def _usage(u: Any) -> dict[str, int] | None:
    if u is None:
        return None
    out = {k: getattr(u, k, 0) or 0 for k in ("input_tokens", "output_tokens")}
    return out if any(out.values()) else None


# --- Delegation: the tool every agent shares --------------------------------

async def ask_teammate(ctx: RunContext[TeamDeps], teammate: AgentName, request: str) -> str:
    """Hand a focused task to another agent and get their structured report back.

    Any agent can ask any other agent. Use it when the answer needs data or a
    decision that belongs to another role. Write a specific, self-contained
    request: include the ticket ID, SKUs, sizes, quantities, and amounts they
    need, and say exactly what you want back. You cannot ask yourself, an agent
    already in the current delegation chain, or go deeper than the depth limit.
    """
    deps = ctx.deps
    state = deps.state
    refusal = None
    if teammate == deps.agent:
        refusal = "You cannot delegate to yourself."
    elif teammate in deps.chain:
        refusal = (f"{teammate} is already part of this request chain ({' -> '.join(deps.chain)}), so asking "
                   "them would loop. Finish with what you have and report back.")
    elif deps.depth + 1 > MAX_DELEGATION_DEPTH:
        refusal = f"Delegation depth limit ({MAX_DELEGATION_DEPTH}) reached. Finish with what you have."
    elif state.delegations >= MAX_DELEGATIONS_PER_TICKET:
        refusal = f"Delegation budget for this ticket ({MAX_DELEGATIONS_PER_TICKET}) is used up. Finish now."

    _log(deps, "delegation", tool="ask_teammate", args={"teammate": teammate, "request": request},
         result=refusal or "accepted")
    if refusal:
        return "REFUSED: " + refusal

    state.delegations += 1
    report = await deps.team.run_agent(teammate, request, state=state, chain=deps.chain, usage=ctx.usage)
    return report.model_dump_json()


# --- The team ----------------------------------------------------------------

class Team:
    def __init__(self, model: Model | None = None, *, mcp_client: Client | None = None,
                 mcp_env: dict[str, str] | None = None):
        """mcp_client lets the API pass an in-process MCP connection; by default the
        MCP server is started as a subprocess over stdio."""
        self.model = model if model is not None else make_model()
        self.model_name = getattr(self.model, "model_name", MODEL_NAME)
        if mcp_client is None:
            env = {**os.environ, **(mcp_env or {})}
            transport = StdioTransport(command=sys.executable, args=[str(MCP_SERVER)], env=env, cwd=str(PROJECT_ROOT))
            mcp_client = Client(transport)
        self.mcp = MCPToolset(
            mcp_client,
            process_tool_call=self._guard_tool_call,
            max_retries=2,
        )
        self.agents = {name: self._build(spec) for name, spec in SPECS.items()}

    @staticmethod
    async def _guard_tool_call(ctx: RunContext[TeamDeps], call_tool: CallToolFunc, name: str,
                               args: dict[str, Any]) -> Any:
        """Last check before any MCP call leaves the team.

        Agents can't impersonate each other or write to a ticket they weren't
        given: identity arguments are overwritten with the calling agent's name,
        and ticket-scoped writes are pinned to the ticket being worked.
        """
        deps = ctx.deps
        if name in HUMAN_ONLY_TOOLS:
            _log(deps, "guardrail", tool=name, args=args, result="blocked: human-only tool")
            raise ModelRetry(f"{name} is for humans only.")
        forced = {}
        if name in IDENTITY_ARG:
            forced[IDENTITY_ARG[name]] = deps.agent
        if name in TICKET_SCOPED_TOOLS and deps.state.ticket_id is not None:
            forced["ticket_id"] = deps.state.ticket_id
        changed = {k: {"asked": args.get(k), "used": v} for k, v in forced.items() if args.get(k) != v}
        if changed:
            _log(deps, "guardrail", tool=name, args=changed, result="arguments overwritten")
        return await call_tool(name, {**args, **forced})

    def _build(self, spec: AgentSpec) -> Agent[TeamDeps, Any]:
        allowed = spec.mcp_tools
        agent = Agent(
            self.model,
            name=spec.name,
            deps_type=TeamDeps,
            output_type=spec.output_type,
            toolsets=[self.mcp.filtered(lambda ctx, tool_def: tool_def.name in allowed)],
            tools=[ask_teammate],
            model_settings=MODEL_SETTINGS,
            retries=2,
        )

        @agent.instructions
        def instructions(ctx: RunContext[TeamDeps]) -> str:
            # Re-read every run so prompt edits apply without restarting anything.
            rules = SHOP_RULES.read_text(encoding="utf-8")
            role = (PROMPTS_DIR / f"{spec.name}.md").read_text(encoding="utf-8")
            return "\n\n".join([rules, role, self._context(ctx.deps)])

        if spec.output_type is TicketDecision:
            @agent.output_validator
            def check_decision(ctx: RunContext[TeamDeps], out: TicketDecision) -> TicketDecision:
                d = out.discount
                if d is not None and d.discount_pct > 0 and not d.checked_with_tool:
                    raise ModelRetry("Run check_discount for this exact offer before deciding a discount.")
                if out.final_status == "resolved" and out.approval_request_ids:
                    raise ModelRetry("A ticket with approval requests waiting on a human is not resolved; "
                                     "use waiting_on_approval.")
                return out
        else:
            @agent.output_validator
            def check_report(ctx: RunContext[TeamDeps], out: SpecialistReport) -> SpecialistReport:
                out.agent = ctx.deps.agent
                return out

        return agent

    def _context(self, deps: TeamDeps) -> str:
        roster = "\n".join(
            f"- {s.name}: {s.purpose}" + (" (you)" if s.name == deps.agent else "") for s in SPECS.values())
        chain = " -> ".join(deps.chain)
        left = MAX_DELEGATION_DEPTH - deps.depth
        return (
            "# This run\n"
            f"- You are the {SPECS[deps.agent].title} agent (`{deps.agent}`).\n"
            f"- Ticket being worked: {deps.state.ticket_id}. Board writes are recorded against this ticket.\n"
            f"- Delegation chain: {chain}. You may delegate {left} more level(s) down; "
            f"agents already in the chain cannot be asked again.\n"
            f"- Delegations left for this ticket: {MAX_DELEGATIONS_PER_TICKET - deps.state.delegations}.\n"
            f"# Your teammates (ask any of them with ask_teammate)\n{roster}"
        )

    async def run_agent(self, name: AgentName, task: str, *, state: RunState,
                        chain: tuple[AgentName, ...] = (), usage: RunUsage | None = None) -> Any:
        """Run one agent's loop on a task, logging every step to the audit trail."""
        deps = TeamDeps(team=self, state=state, agent=name, chain=(*chain, name))
        _log(deps, "run_start", model=state.model_name, text=task)
        try:
            async with self.agents[name].iter(task, deps=deps, usage=usage, usage_limits=USAGE_LIMITS) as run:
                async for node in run:
                    self._log_node(deps, node)
        except Exception as e:
            _log(deps, "error", error=f"{type(e).__name__}: {e}")
            raise
        result = run.result
        _log(deps, "run_end", output=result.output.model_dump(mode="json"), usage=_usage(result.usage))
        return result.output

    @staticmethod
    def _log_node(deps: TeamDeps, node: Any) -> None:
        if Agent.is_call_tools_node(node):
            resp = node.model_response
            text = "\n".join(p.content for p in resp.parts if isinstance(p, TextPart)).strip()
            calls = [{"tool": p.tool_name, "args": p.args_as_dict()} for p in resp.parts
                     if isinstance(p, ToolCallPart)]
            _log(deps, "model_response", model=resp.model_name, text=audit.clip(text) or None,
                 tool_calls=calls or None, usage=_usage(resp.usage))
        elif Agent.is_model_request_node(node):
            for part in node.request.parts:
                if isinstance(part, ToolReturnPart):
                    _log(deps, "tool_result", tool=part.tool_name, result=audit.clip(_as_text(part.content)))
                elif isinstance(part, RetryPromptPart):
                    _log(deps, "tool_retry", tool=part.tool_name, result=audit.clip(_as_text(part.content)))

    async def _mcp_call(self, name: str, args: dict[str, Any]) -> dict:
        result = await self.mcp.client.call_tool(name, args)
        return result.structured_content or {}

    async def work_ticket(self, ticket_id: int, run_id: str | None = None) -> TicketDecision:
        """Have the Boss work one ticket end to end, then make sure its status is recorded."""
        state = RunState(run_id=run_id or new_run_id(), ticket_id=ticket_id, model_name=self.model_name)
        task = (f"Work ticket {ticket_id}. Read it with get_ticket, bring in the teammates it needs, "
                "make the final call, update the ticket status, and return your TicketDecision.")
        async with self.mcp:
            decision: TicketDecision = await self.run_agent("boss", task, state=state)
            current = (await self._mcp_call("get_ticket", {"ticket_id": ticket_id})).get("ticket", {})
            if current.get("status") != decision.final_status:
                await self._mcp_call("update_ticket_status", {
                    "ticket_id": ticket_id, "status": decision.final_status,
                    "note": decision.decision, "updated_by": "boss"})
        return decision

    async def open_ticket_ids(self) -> list[int]:
        async with self.mcp:
            data = await self._mcp_call("list_open_tickets", {})
        return [t["id"] for t in data.get("tickets", [])]


async def _main(argv: list[str]) -> None:
    if not argv:
        print(__doc__)
        return
    team = Team()
    ids = await team.open_ticket_ids() if argv == ["--all"] else [int(a) for a in argv]
    for ticket_id in ids:
        decision = await team.work_ticket(ticket_id)
        print(decision.model_dump_json(indent=2))


if __name__ == "__main__":
    asyncio.run(_main(sys.argv[1:]))
