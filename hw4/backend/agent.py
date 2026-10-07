"""Campus Customs chat agent (PydanticAI), routed to OpenAI through Portkey.

main.py calls run_chat() from the POST /chat route, after loading the shopper, the page
they're on, and their saved history; it saves the new turn afterwards.
"""

import json
import logging
import os
import threading
import uuid
from contextlib import closing
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

# Hide PydanticAI's startup banner in the server log.
os.environ.setdefault("PYDANTIC_AI_NO_BANNER", "1")

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import ModelMessage, ModelRequest, ModelResponse, TextPart, UserPromptPart
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from models import AuditEntry, AuditToolCall, ChatResponse, HistoryMessage
from tools import (
    ChatDeps,
    category_counts,
    describe_categories,
    get_connection,
    get_product_info,
    get_stock,
    search_catalogue,
)

BACKEND_DIR = Path(__file__).resolve().parent
PROMPT_PATH = BACKEND_DIR / "prompts" / "prompt.md"
ENV_PATH = BACKEND_DIR.parent / ".env"

MODEL = "gpt-5.6-luna"
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"

# Append-only record of what the agent did on each /chat run.
# CAMPUS_CUSTOMS_AUDIT can point elsewhere (e.g. for tests).
AUDIT_PATH = Path(os.environ.get("CAMPUS_CUSTOMS_AUDIT", BACKEND_DIR.parent / "output" / "audit_trail.json"))
AUDIT_TEXT_LIMIT = 60  # characters kept from any argument or result

load_dotenv(ENV_PATH)
logger = logging.getLogger("campus_customs")


def make_client() -> AsyncOpenAI:
    """OpenAI-compatible client that sends requests through the Portkey gateway."""
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError(f"PORTKEY_API_KEY is missing; add it to {ENV_PATH}")
    return AsyncOpenAI(
        api_key=api_key,
        base_url=PORTKEY_BASE_URL,
        default_headers={"x-portkey-provider": "openai"},
    )


def load_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


def describe_context(deps: ChatDeps) -> str:
    """The per-message context block added after prompt.md: who the shopper is and
    which product page they're on. Built from trusted deps, never from chat text."""
    lines = ["# This conversation"]
    c = deps.customer
    if c is not None:
        lines.append(
            f"- You're helping {c.name} (first name: {c.first_name}, email: {c.email}). "
            "They are logged in; this identity comes from their login and is always correct."
        )
    else:
        lines.append("- The shopper is a guest (not logged in). You don't know their name.")
    p = deps.page_product
    if p is not None:
        colors = ", ".join(p.colors) if p.colors else "not listed in the catalogue"
        lines.append(
            f'- They are viewing the product page for "{p.name}" (colors: {colors}). '
            '"This", "it", or "this one" means this product.'
        )
    else:
        lines.append("- They are not on a product page right now.")
    # What the store sells, straight from the catalogue, so "what do you have?" and
    # "try something else" suggestions only name real categories.
    with closing(get_connection()) as conn:
        categories = describe_categories(category_counts(conn))
    lines.append(f"- What we carry (clothing only, nothing else): {categories}.")
    return "\n".join(lines)


def history_to_messages(rows: list[HistoryMessage]) -> list[ModelMessage]:
    """Turn saved chat rows into PydanticAI message history, oldest first.

    Assistant turns note which product cards were shown, so follow-ups like
    "how much is the second one?" have something to refer to.
    """
    messages: list[ModelMessage] = []
    for row in rows:
        if row.role == "user":
            messages.append(ModelRequest(parts=[UserPromptPart(content=row.content)]))
        else:
            text = row.content
            if row.products:
                text += "\n[Product cards shown: " + "; ".join(card.name for card in row.products) + "]"
            messages.append(ModelResponse(parts=[TextPart(content=text)]))
    return messages


@lru_cache(maxsize=1)
def get_agent() -> Agent[ChatDeps, str]:
    """Build the agent on first use, so the rest of the API runs even without an API key."""
    model = OpenAIChatModel(MODEL, provider=OpenAIProvider(openai_client=make_client()))
    # Tool names, docstrings and argument types are sent to the model so it knows
    # when and how to call them.
    agent = Agent(
        model,
        deps_type=ChatDeps,
        output_type=str,
        tools=[get_product_info, get_stock, search_catalogue],
    )

    # @agent.instructions (not @agent.system_prompt): PydanticAI sends instructions on
    # every run, even when message_history is passed. A system prompt is skipped when
    # there's history, so returning shoppers would lose prompt.md entirely.
    @agent.instructions
    def instructions(ctx: RunContext[ChatDeps]) -> str:
        # Re-read every run, so edits to prompt.md apply without restarting the server.
        return load_prompt() + "\n\n" + describe_context(ctx.deps)

    return agent


# ---------- Audit trail ----------

_audit_lock = threading.Lock()  # one read-modify-write at a time within this server


def _short(text: str) -> str:
    text = " ".join(str(text).split())
    return text if len(text) <= AUDIT_TEXT_LIMIT else text[: AUDIT_TEXT_LIMIT - 1] + "…"


def _short_args(args: dict) -> str:
    """Just the product name or query (plus size), never anything else."""
    parts = [str(args[k]) for k in ("name", "query") if args.get(k)]
    if args.get("size"):
        parts.append(f"size {args['size']}")
    return _short(", ".join(parts))


def _short_result(content: object) -> str:
    """The status plus one count -- never the product list or descriptions."""
    status = getattr(content, "status", None)
    if status is None:
        return _short(type(content).__name__)
    if getattr(content, "total_matches", None) is not None:
        return f"{status}, {content.total_matches} matches"
    if getattr(content, "total_quantity", None) is not None:
        return f"{status}, total stock {content.total_quantity}"
    return str(status)


def tool_calls_from(messages: list[ModelMessage]) -> list[AuditToolCall]:
    """Pair each tool call in this run with its result, in the order they happened."""
    results = {
        part.tool_call_id: part.content
        for msg in messages
        for part in msg.parts
        if part.part_kind == "tool-return"
    }
    return [
        AuditToolCall(
            tool=part.tool_name,
            args=_short_args(part.args_as_dict()),
            result=_short_result(results[part.tool_call_id]) if part.tool_call_id in results else "no result",
        )
        for msg in messages
        for part in msg.parts
        if part.part_kind == "tool-call"
    ]


def append_audit_entry(entry: AuditEntry) -> None:
    """Read the existing list, append this run's entry, and write it back.

    Never truncates: an empty or missing file starts a new list, and a file that isn't a
    valid JSON list is moved aside (kept, not deleted) before a new list is started. The
    write goes to a temp file that then replaces the real one, so a crash mid-write can't
    leave half-written JSON behind.
    """
    with _audit_lock:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        entries: list = []
        if AUDIT_PATH.exists() and AUDIT_PATH.stat().st_size > 0:
            try:
                entries = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
                if not isinstance(entries, list):
                    raise ValueError("audit trail is not a JSON list")
            except ValueError:
                backup = AUDIT_PATH.with_name(f"audit_trail.unreadable-{datetime.now(timezone.utc):%Y%m%dT%H%M%S}.json")
                AUDIT_PATH.replace(backup)
                logger.warning("Audit trail wasn't valid JSON; kept it as %s and started a new one", backup.name)
                entries = []
        entries.append(entry.model_dump())
        tmp = AUDIT_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(entries, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(AUDIT_PATH)


def _record_run(tool_calls: list[AuditToolCall], cards: int, error: Exception | None = None) -> None:
    if error is not None:
        stop_reason = "error"
    else:
        stop_reason = "completed" if tool_calls else "no_tools_used"
    entry = AuditEntry(
        run_id=uuid.uuid4().hex[:12],
        timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        stop_reason=stop_reason,
        tool_calls=tool_calls,
        cards_shown=cards,
        error_type=type(error).__name__ if error is not None else None,
    )
    try:
        append_audit_entry(entry)
    except Exception:
        # The audit log must never break the chat itself.
        logger.exception("Couldn't write the audit trail")


async def run_chat(message: str, deps: ChatDeps, history: list[HistoryMessage]) -> ChatResponse:
    """Run the agent for one message. main.py loads deps/history before and saves after;
    the model never reads or writes the database history itself. Every run -- guest or
    logged in, success or failure -- adds one entry to the audit trail."""
    try:
        result = await get_agent().run(message, deps=deps, message_history=history_to_messages(history))
    except Exception as exc:
        _record_run([], cards=0, error=exc)
        raise
    new_messages = result.new_messages()
    _record_run(tool_calls_from(new_messages), cards=len(deps.cards))
    # Did any tool come back empty-handed this turn? (Read from the tool results, so the
    # model doesn't have to report it.)
    not_found = any(
        getattr(part.content, "status", None) == "not_found"
        for msg in new_messages
        for part in msg.parts
        if part.part_kind == "tool-return"
    )
    return ChatResponse(reply=result.output, products=deps.cards, found_nothing=not_found and not deps.cards)
