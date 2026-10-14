"""Data types for the Campus Customs agent team.

The Field descriptions are sent to the model as part of each agent's output
schema, so they double as instructions for what to put in each field.
"""

from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, Field

AgentName = Literal["boss", "inventory", "accounting", "facilities", "customer_service"]
AGENT_NAMES: tuple[AgentName, ...] = ("boss", "inventory", "accounting", "facilities", "customer_service")

TicketStatus = Literal["in_progress", "waiting_on_approval", "needs_human", "resolved"]


# ---------------------------------------------------------------------------
# What agents return
# ---------------------------------------------------------------------------

class Finding(BaseModel):
    """One fact an agent relies on, with the tool it came from."""

    fact: str = Field(description="What this is, e.g. 'Size M hoodies on hand'.")
    value: str = Field(description="The value exactly as the tool returned it, e.g. '8'.")
    source: str = Field(description="The MCP tool that returned it, e.g. 'check_inventory_shortfall'.")


class SpecialistReport(BaseModel):
    """What Inventory, Accounting, Facilities, and Customer Service hand back."""

    agent: AgentName = Field(description="Your own agent name.")
    task: str = Field(description="The request you were given, in one line.")
    summary: str = Field(description="Your answer in 1-3 plain sentences.")
    findings: list[Finding] = Field(description="Facts from tools that support the answer.")
    recommendation: str = Field(description="What you recommend the team does next, or '' if nothing.")
    actions_taken: list[str] = Field(
        default_factory=list,
        description="Board writes you made, e.g. 'Created approval request #2 for rent ($2400)'. Empty if none.",
    )
    approval_request_ids: list[int] = Field(default_factory=list, description="IDs of approval requests you created.")
    draft_ids: list[int] = Field(default_factory=list, description="IDs of customer drafts you saved.")
    blockers: list[str] = Field(default_factory=list, description="Anything stopping the work.")
    inferences: list[str] = Field(
        default_factory=list,
        description="Anything you concluded that no tool stated directly, labeled as an inference.",
    )
    needs_human: bool = Field(default=False, description="True if a human must decide something you cannot.")


class Assignment(BaseModel):
    agent: AgentName
    task: str = Field(description="What the Boss asked this agent to do.")
    outcome: str = Field(description="What the agent reported back, in one line.")


class DiscountDecision(BaseModel):
    sku: str
    qty: int = Field(description="Units the discount applies to.")
    list_price: float
    discount_pct: float = Field(description="Percent off list price. 0 means no discount.")
    unit_price: float
    order_total: float
    checked_with_tool: bool = Field(description="True only if check_discount returned allowed=true for this offer.")


class TicketDecision(BaseModel):
    """The Boss's final call on one ticket."""

    ticket_id: int
    ticket_type: str
    final_status: TicketStatus = Field(
        description="waiting_on_approval if any payment or order awaits a human; resolved only if nothing is pending."
    )
    decision: str = Field(description="The final call in 1-3 plain sentences a shop owner can act on.")
    rationale: str = Field(description="Why, citing the key numbers from the team's findings.")
    assignments: list[Assignment] = Field(description="Who worked on the ticket and what they found.")
    discount: DiscountDecision | None = Field(default=None, description="Only for discount / price-override tickets.")
    approval_request_ids: list[int] = Field(default_factory=list, description="Approval requests waiting on a human.")
    draft_ids: list[int] = Field(default_factory=list, description="Customer drafts saved for this ticket.")
    human_actions_needed: list[str] = Field(
        default_factory=list, description="Exactly what a human must do next, e.g. 'Approve request #1 (rent $2400)'."
    )
    inferences: list[str] = Field(default_factory=list, description="Conclusions not stated directly by a tool.")


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------

AuditEventType = Literal[
    "run_start",       # an agent was handed a task
    "model_response",  # the model replied: text and/or tool calls
    "tool_result",     # a tool returned (MCP or delegation)
    "tool_retry",      # a tool or output failed validation and the model was asked to retry
    "delegation",      # an agent asked a teammate (or was refused)
    "guardrail",       # the team overwrote or blocked a tool call (identity, ticket scope, human-only)
    "run_end",         # an agent finished with its structured output
    "error",           # a run stopped on an error or limit
    "human_decision",  # a person approved or rejected a request from the dashboard
    "db_reset",        # the working database was reset to the original
]


class AuditEvent(BaseModel):
    """One step of one agent loop (or one human/system action), appended to output/audit_trail.json."""

    timestamp: str
    run_id: str = Field(description="One ID per ticket run, shared by every agent in it.")
    ticket_id: int | None
    agent: AgentName | Literal["human", "system"]
    chain: list[AgentName] = Field(description="Who delegated to whom to reach this agent, starting with the first.")
    depth: int
    step: int = Field(description="Order of this event within the run.")
    event: AuditEventType
    model: str | None = None
    tool: str | None = None
    args: dict[str, Any] | None = None
    result: str | None = None
    text: str | None = None
    tool_calls: list[dict[str, Any]] | None = None
    usage: dict[str, int] | None = None
    output: dict[str, Any] | None = None
    error: str | None = None


# ---------------------------------------------------------------------------
# API (backend/main.py)
# ---------------------------------------------------------------------------

RunStatus = Literal["running", "done", "error"]


class RunRecord(BaseModel):
    """One agent-team run started from the API."""

    run_id: str
    ticket_id: int
    status: RunStatus
    started_at: str
    finished_at: str | None = None
    decision: TicketDecision | None = None
    error: str | None = None


class DecisionIn(BaseModel):
    """Body for approving or rejecting a request from the dashboard."""

    decided_by: str = Field(min_length=1, description="The human's name, recorded as payments.approved_by.")
    note: str = ""


# ---------------------------------------------------------------------------
# Agent team runtime (backend/team.py)
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class AgentSpec:
    """One role on the team: its name, the MCP tools it may use, and what it returns."""

    name: AgentName
    title: str
    purpose: str
    mcp_tools: frozenset[str]
    output_type: type[BaseModel]


@dataclass
class RunState:
    """Shared by every agent working one ticket."""

    run_id: str
    ticket_id: int | None
    model_name: str
    delegations: int = 0
    step: int = 0


@dataclass
class TeamDeps:
    """Per-agent context passed to tools and instructions."""

    team: Any  # the team.Team running this ticket (typed loosely to avoid a circular import)
    state: RunState
    agent: AgentName
    chain: tuple[AgentName, ...] = field(default_factory=tuple)

    @property
    def depth(self) -> int:
        return len(self.chain) - 1
