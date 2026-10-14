"""Append-only audit trail at output/audit_trail.json.

The file is a JSON array that only ever grows: each event is appended and the
file is rewritten atomically, so a crash mid-write cannot truncate it. If the
file holds something that isn't a JSON array, it is moved aside (never deleted)
and a new array is started.
"""

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from models import AuditEvent

# CAMPUS_CUSTOMS_AUDIT can point elsewhere (e.g. for tests).
AUDIT_PATH = Path(os.environ.get(
    "CAMPUS_CUSTOMS_AUDIT", Path(__file__).resolve().parent.parent / "output" / "audit_trail.json"))
TEXT_LIMIT = 1500  # characters kept from any tool result or model text

_lock = threading.Lock()


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def clip(text: str | None) -> str | None:
    if text is None or len(text) <= TEXT_LIMIT:
        return text
    return text[:TEXT_LIMIT] + f"... [{len(text) - TEXT_LIMIT} more chars]"


def _load() -> list:
    if not AUDIT_PATH.exists() or not AUDIT_PATH.read_text(encoding="utf-8").strip():
        return []
    try:
        data = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        pass
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    AUDIT_PATH.rename(AUDIT_PATH.with_name(f"audit_trail.unreadable-{stamp}.json"))
    return []


def read_all() -> list[dict]:
    """Every entry in the trail, oldest first. Read-only: never moves or rewrites the file."""
    with _lock:
        if not AUDIT_PATH.exists() or not AUDIT_PATH.read_text(encoding="utf-8").strip():
            return []
        try:
            data = json.loads(AUDIT_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return []
        return data if isinstance(data, list) else []


def append(event: AuditEvent) -> None:
    with _lock:
        AUDIT_PATH.parent.mkdir(parents=True, exist_ok=True)
        entries = _load()
        entries.append(event.model_dump(mode="json", exclude_none=True))
        tmp = AUDIT_PATH.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(entries, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp, AUDIT_PATH)
