"""Campus Customs MCP server.

Shared tools for the Campus Customs agent team (Boss, Inventory, Accounting,
Facilities, Customer Service). Every tool works on the working copy
data/campus_customs_new.db; the original data/campus_customs.db is never opened.

Three kinds of tools:
- Read tools open the database read-only.
- Board tools write drafts, approval requests, and ticket status updates.
  None of them move money or contact anyone.
- decide_approval is for humans only. It is the single place money leaves the
  shop, and the agent team is never given access to it.
"""

import os
import shutil
import sqlite3
from contextlib import closing
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal

from fastmcp import FastMCP

PROJECT_ROOT = Path(__file__).resolve().parent.parent
# CAMPUS_CUSTOMS_DB can point at a scratch copy for tests.
DB_PATH = Path(os.environ.get("CAMPUS_CUSTOMS_DB", PROJECT_ROOT / "data" / "campus_customs_new.db"))
ORIGINAL_DB = PROJECT_ROOT / "data" / "campus_customs.db"  # only ever read, by reset_working_database
if DB_PATH.name == "campus_customs.db":
    raise RuntimeError("Refusing to run against the original campus_customs.db; use the working copy.")

AGENT_NAMES = {"boss", "inventory", "accounting", "facilities", "customer_service"}
TICKET_STATUSES = ("open", "in_progress", "waiting_on_approval", "needs_human", "resolved")

# Shop policy (owner's decisions): bulk discount tiers as (min qty, max % off),
# a margin floor no discount may break, and the cash floor for any payment.
DISCOUNT_TIERS = [(20, 20.0), (10, 10.0)]
MIN_MARGIN_PCT = 40.0
CASH_FLOOR = 0.0
RENT_WINDOW_DAYS = 30  # rent due within this many days is reserved before other spending

NO_SUPPLIER_LINK = (
    "The database does not record which vendor supplies which SKU. Vendor "
    "specialty and invoice descriptions are hints only; say so instead of "
    "stating a supplier as fact."
)

mcp = FastMCP(
    "campus-customs",
    instructions=(
        "Tools over the Campus Customs shop database. "
        "'Today' is desk.date_today (returned as 'today'), not the real date. "
        "Report only values the tools return. Many results have a 'data_notes' "
        "list describing what the database does not record; when you rely on "
        "an inference, label it as one. Agents can read data, save drafts, and "
        "request approvals, but no agent tool pays, orders, or contacts anyone: "
        "money only moves when a human approves a request."
    ),
)

BOARD_SCHEMA = """
CREATE TABLE IF NOT EXISTS approval_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL,            -- invoice | rent | purchase_order
    ticket_id INTEGER,
    ref_id INTEGER,                -- invoices.id, leases.id, or vendors.id
    sku TEXT, size TEXT, qty INTEGER,
    amount REAL NOT NULL,
    account TEXT NOT NULL,
    reason TEXT,
    requested_by TEXT NOT NULL,
    shop_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
    decided_by TEXT, decided_at TEXT, decision_note TEXT,
    payment_id INTEGER
);
CREATE TABLE IF NOT EXISTS message_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    recipient TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    drafted_by TEXT NOT NULL,
    shop_date TEXT NOT NULL,
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
);
CREATE TABLE IF NOT EXISTS ticket_updates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    old_status TEXT, new_status TEXT NOT NULL,
    note TEXT,
    updated_by TEXT NOT NULL,
    shop_date TEXT NOT NULL,
    created_at TEXT NOT NULL
);
"""


def _check_db() -> None:
    if not DB_PATH.exists():
        raise FileNotFoundError(
            f"Working database not found at {DB_PATH}. "
            "Copy data/campus_customs.db to data/campus_customs_new.db first."
        )


def _connect() -> sqlite3.Connection:
    """Open the working-copy database read-only. Fails if the file is missing."""
    _check_db()
    # mode=ro: SQLite refuses every write and will not create a new file.
    con = sqlite3.connect(f"{DB_PATH.as_uri()}?mode=ro", uri=True)
    con.row_factory = sqlite3.Row
    return con


def _connect_write() -> sqlite3.Connection:
    """Open the working copy for writing (never creates a file) and ensure board tables exist."""
    _check_db()
    con = sqlite3.connect(f"{DB_PATH.as_uri()}?mode=rw", uri=True)
    con.row_factory = sqlite3.Row
    con.executescript(BOARD_SCHEMA)
    return con


def _today(con: sqlite3.Connection) -> date:
    """The shop's "today" comes from desk.date_today, never the system clock."""
    row = con.execute("SELECT date_today FROM desk").fetchone()
    return date.fromisoformat(row["date_today"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _has_table(con: sqlite3.Connection, name: str) -> bool:
    return con.execute(
        "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?", (name,)
    ).fetchone() is not None


def _rows(con: sqlite3.Connection, table: str, sql: str, args: tuple = ()) -> list[dict]:
    """Rows from a board table, or [] if the table hasn't been created yet."""
    if not _has_table(con, table):
        return []
    return [dict(r) for r in con.execute(sql, args).fetchall()]


def _add_month(d: date) -> date:
    year, month = (d.year + 1, 1) if d.month == 12 else (d.year, d.month + 1)
    for day in (d.day, 30, 29, 28):
        try:
            return date(year, month, day)
        except ValueError:
            continue
    raise ValueError(d)


def _cash_snapshot(con: sqlite3.Connection, today: date, account: str = "checking") -> dict:
    """Balance, money already promised to pending requests, and rent that must be kept aside."""
    acct = con.execute("SELECT balance FROM cash_accounts WHERE name = ?", (account,)).fetchone()
    if acct is None:
        raise ValueError(f"No cash account named {account!r}.")
    pending = _rows(
        con, "approval_requests",
        "SELECT kind, ref_id, amount FROM approval_requests WHERE status = 'pending' AND account = ?",
        (account,),
    )
    rent_requested = {p["ref_id"] for p in pending if p["kind"] == "rent"}
    horizon = (today + timedelta(days=RENT_WINDOW_DAYS)).isoformat()
    rent_unrequested = sum(
        r["monthly_rent"]
        for r in con.execute("SELECT id, monthly_rent FROM leases WHERE next_due <= ?", (horizon,))
        if r["id"] not in rent_requested
    )
    return {
        "balance": acct["balance"],
        "pending_total": sum(p["amount"] for p in pending),
        "rent_reserve": rent_unrequested,
    }


@mcp.tool
def check_inventory_shortfall(sku: str, size: str, qty_needed: int) -> dict:
    """Check whether the shop can fill an order for a SKU and size, and at what margin.

    Call this when a ticket asks for a quantity of a product (a customer order,
    a bulk request, or a discount request) to see stock on hand, how many units
    are short, stock in the other sizes, and the unit cost / list price used to
    judge any discount.

    Also returns invoices whose description mentions this SKU, which is the
    only evidence in the database of which vendor has made it before. There is
    no supplier field, so do not state a supplier as fact (see data_notes).

    Returns found=False if the SKU/size is not in inventory.
    """
    with closing(_connect()) as con:
        item = con.execute(
            "SELECT sku, name, size, qty, location FROM inventory WHERE sku = ? AND size = ?",
            (sku, size),
        ).fetchone()
        if item is None:
            return {"found": False, "error": f"No inventory row for sku={sku!r}, size={size!r}."}

        other_sizes = con.execute(
            "SELECT size, qty FROM inventory WHERE sku = ? AND size != ? ORDER BY rowid",
            (sku, size),
        ).fetchall()
        price = con.execute(
            "SELECT unit_cost, list_price FROM pricing WHERE sku = ?", (sku,)
        ).fetchone()
        mentions = con.execute(
            "SELECT i.id, i.vendor_id, v.name AS vendor_name, i.amount, i.status, i.description "
            "FROM invoices i JOIN vendors v ON v.id = i.vendor_id "
            "WHERE i.description LIKE '%' || ? || '%' ORDER BY i.id",
            (sku,),
        ).fetchall()

    on_hand = item["qty"]
    shortfall = max(qty_needed - on_hand, 0)
    pricing = None
    if price is not None:
        margin = price["list_price"] - price["unit_cost"]
        pricing = {
            "unit_cost": price["unit_cost"],
            "list_price": price["list_price"],
            "margin_per_unit": round(margin, 2),
            "margin_pct_of_list": round(margin / price["list_price"] * 100, 1),
        }

    return {
        "found": True,
        "sku": item["sku"],
        "name": item["name"],
        "size": item["size"],
        "location": item["location"],
        "qty_needed": qty_needed,
        "on_hand": on_hand,
        "shortfall": shortfall,
        "can_fill_from_stock": shortfall == 0,
        "other_sizes": [{"size": r["size"], "qty": r["qty"]} for r in other_sizes],
        "pricing": pricing,
        "invoices_mentioning_sku": [
            {
                "invoice_id": m["id"],
                "vendor_id": m["vendor_id"],
                "vendor_name": m["vendor_name"],
                "amount": m["amount"],
                "status": m["status"],
                "description": m["description"],
            }
            for m in mentions
        ],
        "data_notes": [NO_SUPPLIER_LINK],
    }


@mcp.tool
def get_vendor_status(vendor_id: int | None = None) -> dict:
    """Check whether vendors can ship right now and how long a restock would take.

    Call this before planning any restock or reprint. A vendor will not ship
    new product while it has an open unpaid invoice, so this returns each
    vendor's open invoices (with days overdue against desk.date_today), a
    can_ship flag, lead_days, and the earliest arrival date if an order were
    placed today. Pass vendor_id for one vendor, or omit it to list all vendors.

    Specialty describes what a vendor generally does; it is not a list of the
    SKUs they supply (see data_notes).

    Returns found=False if vendor_id does not exist.
    """
    with closing(_connect()) as con:
        today = _today(con)
        if vendor_id is None:
            vendors = con.execute(
                "SELECT id, name, specialty, lead_days FROM vendors ORDER BY id"
            ).fetchall()
        else:
            vendors = con.execute(
                "SELECT id, name, specialty, lead_days FROM vendors WHERE id = ?",
                (vendor_id,),
            ).fetchall()
            if not vendors:
                return {"found": False, "error": f"No vendor with id={vendor_id}."}

        results = []
        for v in vendors:
            open_invoices = con.execute(
                "SELECT id, amount, due_date, description FROM invoices "
                "WHERE vendor_id = ? AND status = 'open' ORDER BY due_date",
                (v["id"],),
            ).fetchall()
            invoices = []
            for inv in open_invoices:
                days_overdue = (today - date.fromisoformat(inv["due_date"])).days
                invoices.append({
                    "invoice_id": inv["id"],
                    "amount": inv["amount"],
                    "due_date": inv["due_date"],
                    "days_overdue": max(days_overdue, 0),
                    "is_overdue": days_overdue > 0,
                    "description": inv["description"],
                })
            can_ship = not invoices
            results.append({
                "vendor_id": v["id"],
                "name": v["name"],
                "specialty": v["specialty"],
                "lead_days": v["lead_days"],
                "open_invoices": invoices,
                "open_invoice_total": round(sum(i["amount"] for i in invoices), 2),
                "can_ship": can_ship,
                "blocked_reason": None if can_ship else "Vendor has an open unpaid invoice.",
                "earliest_arrival_if_ordered_today": (
                    (today + timedelta(days=v["lead_days"])).isoformat() if can_ship else None
                ),
            })

    return {
        "found": True,
        "today": today.isoformat(),
        "vendors": results,
        "data_notes": [NO_SUPPLIER_LINK],
    }


@mcp.tool
def get_lease_status(lease_id: int) -> dict:
    """Check what rent is owed on a lease, when it is due, and whether cash covers it.

    Call this for rent notices or any question about the shop space. Returns
    the monthly rent, next due date, days until due (negative means overdue,
    measured from desk.date_today), and each cash account's balance with
    whether it can cover the rent without going negative. Read-only: this does
    not pay anything.

    Because rent competes with other bills for the same cash, it also returns
    the total of all open vendor invoices and each account's balance after
    paying rent and those invoices. The cost of future orders is not recorded,
    so do not assume one (see data_notes).

    Returns found=False if lease_id does not exist.
    """
    with closing(_connect()) as con:
        today = _today(con)
        lease = con.execute(
            "SELECT id, space_name, landlord, monthly_rent, next_due, notes FROM leases WHERE id = ?",
            (lease_id,),
        ).fetchone()
        if lease is None:
            return {"found": False, "error": f"No lease with id={lease_id}."}
        accounts = con.execute(
            "SELECT name, balance, date FROM cash_accounts ORDER BY name"
        ).fetchall()
        open_invoices_total = con.execute(
            "SELECT COALESCE(SUM(amount), 0) AS total FROM invoices WHERE status = 'open'"
        ).fetchone()["total"]

    rent = lease["monthly_rent"]
    rent_plus_invoices = rent + open_invoices_total
    days_until_due = (date.fromisoformat(lease["next_due"]) - today).days
    return {
        "found": True,
        "today": today.isoformat(),
        "lease_id": lease["id"],
        "space_name": lease["space_name"],
        "landlord": lease["landlord"],
        "monthly_rent": rent,
        "next_due": lease["next_due"],
        "days_until_due": days_until_due,
        "is_overdue": days_until_due < 0,
        "notes": lease["notes"],
        "open_invoices_total": round(open_invoices_total, 2),
        "cash_accounts": [
            {
                "account": a["name"],
                "balance": a["balance"],
                "as_of": a["date"],
                "can_cover_rent": a["balance"] >= rent,
                "balance_after_rent": round(a["balance"] - rent, 2),
                "can_cover_rent_and_open_invoices": a["balance"] >= rent_plus_invoices,
                "balance_after_rent_and_open_invoices": round(a["balance"] - rent_plus_invoices, 2),
            }
            for a in accounts
        ],
        "data_notes": [
            "Only bills already in the database are counted. Costs of future "
            "orders (e.g. a new reprint) are not recorded, so do not estimate them."
        ],
    }


# ---------------------------------------------------------------------------
# Read tools added for the agent team
# ---------------------------------------------------------------------------

@mcp.tool
def list_open_tickets() -> dict:
    """List every ticket that is not resolved yet, oldest first.

    Call this to see the work queue. Use get_ticket for the full details of one ticket.
    """
    with closing(_connect()) as con:
        today = _today(con)
        rows = con.execute(
            "SELECT id, type, requester, subject, status, created_at FROM tickets "
            "WHERE status != 'resolved' ORDER BY created_at"
        ).fetchall()
    return {"found": True, "today": today.isoformat(), "tickets": [dict(r) for r in rows]}


@mcp.tool
def get_ticket(ticket_id: int) -> dict:
    """Get one ticket with everything linked to it.

    Call this first when working a ticket. Returns the ticket row plus, when the
    ticket references them: the linked invoice (with vendor and days overdue),
    the linked lease, the inventory row and pricing for its SKU/size, and the
    board history for this ticket (approval requests, customer drafts, status updates).

    Returns found=False if ticket_id does not exist.
    """
    with closing(_connect()) as con:
        today = _today(con)
        t = con.execute("SELECT * FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if t is None:
            return {"found": False, "error": f"No ticket with id={ticket_id}."}
        ticket = dict(t)

        invoice = None
        if ticket["invoice_id"] is not None:
            row = con.execute(
                "SELECT i.*, v.name AS vendor_name, v.lead_days FROM invoices i "
                "JOIN vendors v ON v.id = i.vendor_id WHERE i.id = ?",
                (ticket["invoice_id"],),
            ).fetchone()
            if row is not None:
                invoice = dict(row)
                overdue = (today - date.fromisoformat(invoice["due_date"])).days
                invoice["days_overdue"] = max(overdue, 0) if invoice["status"] == "open" else 0

        lease = None
        if ticket["lease_id"] is not None:
            row = con.execute("SELECT * FROM leases WHERE id = ?", (ticket["lease_id"],)).fetchone()
            if row is not None:
                lease = dict(row)
                lease["days_until_due"] = (date.fromisoformat(lease["next_due"]) - today).days

        stock = pricing = None
        if ticket["sku"]:
            row = con.execute(
                "SELECT sku, name, size, qty, location FROM inventory WHERE sku = ? AND size = ?",
                (ticket["sku"], ticket["size"]),
            ).fetchone()
            stock = dict(row) if row else None
            row = con.execute("SELECT unit_cost, list_price FROM pricing WHERE sku = ?", (ticket["sku"],)).fetchone()
            pricing = dict(row) if row else None

        board = {
            "approval_requests": _rows(
                con, "approval_requests",
                "SELECT * FROM approval_requests WHERE ticket_id = ? ORDER BY id", (ticket_id,)),
            "customer_drafts": _rows(
                con, "message_drafts",
                "SELECT * FROM message_drafts WHERE ticket_id = ? ORDER BY id", (ticket_id,)),
            "status_updates": _rows(
                con, "ticket_updates",
                "SELECT * FROM ticket_updates WHERE ticket_id = ? ORDER BY id", (ticket_id,)),
        }

    return {
        "found": True,
        "today": today.isoformat(),
        "ticket": ticket,
        "linked_invoice": invoice,
        "linked_lease": lease,
        "stock": stock,
        "pricing": pricing,
        "board": board,
    }


@mcp.tool
def list_inventory(max_qty: int | None = None) -> dict:
    """List inventory rows (every SKU and size), lowest stock first.

    Call this to scan the whole stockroom, e.g. "what is running low?". Pass
    max_qty to only return rows at or below that quantity.
    """
    with closing(_connect()) as con:
        sql = "SELECT sku, name, size, qty, location FROM inventory"
        args: tuple = ()
        if max_qty is not None:
            sql += " WHERE qty <= ?"
            args = (max_qty,)
        rows = con.execute(sql + " ORDER BY qty, sku, rowid", args).fetchall()
    return {"found": True, "max_qty": max_qty, "rows": [dict(r) for r in rows]}


@mcp.tool
def get_cash_position(account: str = "checking") -> dict:
    """Show the shop's cash, every bill it owes, and what is left for new spending.

    Call this before recommending or requesting any payment or purchase order.
    Returns the account balance, open vendor invoices (days overdue), rent coming
    due within 30 days, approval requests still waiting on a human, past
    payments, and available_for_new_orders: cash left after pending requests,
    rent, and unpaid open invoices, in the shop's priority order
    (rent first, then overdue invoices, then new orders). The cash floor is $0.
    """
    with closing(_connect()) as con:
        today = _today(con)
        accounts = [dict(r) for r in con.execute("SELECT name, balance, date FROM cash_accounts")]
        if account not in {a["name"] for a in accounts}:
            return {"found": False, "error": f"No cash account named {account!r}."}
        snap = _cash_snapshot(con, today, account)
        pending = _rows(
            con, "approval_requests",
            "SELECT id, kind, ticket_id, ref_id, sku, size, qty, amount, requested_by, reason "
            "FROM approval_requests WHERE status = 'pending' ORDER BY id")
        invoices = []
        for r in con.execute(
            "SELECT i.id, i.vendor_id, v.name AS vendor_name, i.amount, i.due_date, i.description "
            "FROM invoices i JOIN vendors v ON v.id = i.vendor_id WHERE i.status = 'open' ORDER BY i.due_date"
        ):
            inv = dict(r)
            inv["days_overdue"] = max((today - date.fromisoformat(inv["due_date"])).days, 0)
            inv["payment_requested"] = any(
                p["kind"] == "invoice" and p["ref_id"] == inv["id"] for p in pending)
            invoices.append(inv)
        horizon = (today + timedelta(days=RENT_WINDOW_DAYS)).isoformat()
        rent_due = []
        for r in con.execute(
            "SELECT id, space_name, landlord, monthly_rent, next_due FROM leases WHERE next_due <= ? ORDER BY next_due",
            (horizon,),
        ):
            lease = dict(r)
            lease["days_until_due"] = (date.fromisoformat(lease["next_due"]) - today).days
            lease["payment_requested"] = any(p["kind"] == "rent" and p["ref_id"] == lease["id"] for p in pending)
            rent_due.append(lease)
        payments = [dict(r) for r in con.execute("SELECT * FROM payments ORDER BY id")]

    unrequested_invoices = sum(i["amount"] for i in invoices if not i["payment_requested"])
    available = snap["balance"] - snap["pending_total"] - snap["rent_reserve"] - unrequested_invoices
    return {
        "found": True,
        "today": today.isoformat(),
        "account": account,
        "balance": snap["balance"],
        "as_of": next(a["date"] for a in accounts if a["name"] == account),
        "cash_floor": CASH_FLOOR,
        "open_invoices": invoices,
        "rent_due_within_30_days": rent_due,
        "pending_approval_requests": pending,
        "pending_total": round(snap["pending_total"], 2),
        "available_for_new_orders": round(available, 2),
        "payments_made": payments,
        "priority_order": ["rent", "overdue vendor invoices", "new purchase orders"],
    }


@mcp.tool
def check_discount(sku: str, qty: int, discount_pct: float | None = None) -> dict:
    """Check a bulk discount against the shop's discount policy before offering it.

    Policy: 10-19 units may get up to 10% off list, 20+ units up to 20% off,
    fewer than 10 units get no discount, and no price may leave less than a 40%
    margin over unit cost. Pass discount_pct to test a specific offer, or omit
    it to get the largest discount allowed. Returns the unit price, order total,
    margin, and whether the offer is allowed. This does not promise anything to
    the customer.
    """
    with closing(_connect()) as con:
        row = con.execute("SELECT unit_cost, list_price FROM pricing WHERE sku = ?", (sku,)).fetchone()
    if row is None:
        return {"found": False, "error": f"No pricing for sku={sku!r}."}
    if qty <= 0:
        return {"found": False, "error": "qty must be at least 1."}

    cost, list_price = row["unit_cost"], row["list_price"]
    tier_cap = next((pct for min_qty, pct in DISCOUNT_TIERS if qty >= min_qty), 0.0)
    floor_price = cost / (1 - MIN_MARGIN_PCT / 100)
    margin_cap = max((1 - floor_price / list_price) * 100, 0.0)
    max_pct = round(min(tier_cap, margin_cap), 2)
    pct = max_pct if discount_pct is None else discount_pct
    unit_price = round(list_price * (1 - pct / 100), 2)
    allowed = 0 <= pct <= max_pct
    return {
        "found": True,
        "sku": sku,
        "qty": qty,
        "unit_cost": cost,
        "list_price": list_price,
        "tier_max_discount_pct": tier_cap,
        "margin_floor_price": round(floor_price, 2),
        "max_allowed_discount_pct": max_pct,
        "discount_pct": pct,
        "allowed": allowed,
        "unit_price": unit_price,
        "order_total": round(unit_price * qty, 2),
        "list_total": round(list_price * qty, 2),
        "margin_pct_at_price": round((unit_price - cost) / unit_price * 100, 1) if unit_price else None,
        "reason": None if allowed else (
            f"{pct}% exceeds the {max_pct}% allowed for {qty} units." if pct > max_pct else "Discount cannot be negative."
        ),
    }


# ---------------------------------------------------------------------------
# Board views for the dashboard (read-only; not given to agents)
# ---------------------------------------------------------------------------

@mcp.tool
def list_tickets() -> dict:
    """List every ticket, resolved or not, with whether it is still open.

    Used by the dashboard. Each ticket includes counts of its pending approval
    requests and saved customer drafts.
    """
    with closing(_connect()) as con:
        today = _today(con)
        rows = [dict(r) for r in con.execute(
            "SELECT id, type, requester, subject, sku, size, qty, status, created_at FROM tickets ORDER BY id")]
        pending = _rows(con, "approval_requests",
                        "SELECT ticket_id FROM approval_requests WHERE status = 'pending'")
        drafts = _rows(con, "message_drafts", "SELECT ticket_id FROM message_drafts")
    for t in rows:
        t["is_open"] = t["status"] != "resolved"
        t["pending_approvals"] = sum(p["ticket_id"] == t["id"] for p in pending)
        t["drafts"] = sum(d["ticket_id"] == t["id"] for d in drafts)
    return {"found": True, "today": today.isoformat(), "tickets": rows}


@mcp.tool
def list_approval_requests(status: Literal["pending", "approved", "rejected"] | None = None) -> dict:
    """List approval requests (payments and purchase orders), newest first.

    Used by the dashboard so a human can see what to approve. Pass status to
    filter, or omit it for all requests.
    """
    with closing(_connect()) as con:
        sql = "SELECT * FROM approval_requests"
        args: tuple = ()
        if status is not None:
            sql += " WHERE status = ?"
            args = (status,)
        rows = _rows(con, "approval_requests", sql + " ORDER BY id DESC", args)
    return {"found": True, "status": status, "requests": rows}


# ---------------------------------------------------------------------------
# Board tools: write drafts, requests, and status. No money moves here.
# ---------------------------------------------------------------------------

def _refuse(reason: str, **extra) -> dict:
    return {"found": True, "created": False, "refused": True, "reason": reason, **extra}


@mcp.tool
def request_payment_approval(
    kind: Literal["invoice", "rent"],
    ref_id: int,
    ticket_id: int,
    requested_by: str,
    reason: str,
    account: str = "checking",
) -> dict:
    """Ask a human to approve paying a vendor invoice or rent. Does NOT pay anything.

    kind="invoice" with ref_id = invoices.id, or kind="rent" with ref_id = leases.id.
    The amount is always taken from the database (the invoice amount or the
    monthly rent), never from the caller. The request is refused if it would
    break the $0 cash floor or the payment priority (rent is reserved first,
    then vendor invoices). If an identical request is already pending, that
    one is returned instead of creating a duplicate. requested_by is filled in
    automatically with the calling agent's name.
    """
    with closing(_connect_write()) as con, con:
        today = _today(con)
        if kind == "invoice":
            inv = con.execute("SELECT id, amount, status FROM invoices WHERE id = ?", (ref_id,)).fetchone()
            if inv is None:
                return {"found": False, "error": f"No invoice with id={ref_id}."}
            if inv["status"] != "open":
                return _refuse(f"Invoice {ref_id} is already {inv['status']}.")
            amount = inv["amount"]
        else:
            lease = con.execute("SELECT id, monthly_rent FROM leases WHERE id = ?", (ref_id,)).fetchone()
            if lease is None:
                return {"found": False, "error": f"No lease with id={ref_id}."}
            amount = lease["monthly_rent"]

        existing = con.execute(
            "SELECT * FROM approval_requests WHERE kind = ? AND ref_id = ? AND status = 'pending'",
            (kind, ref_id),
        ).fetchone()
        if existing is not None:
            return {"found": True, "created": False, "duplicate": True, "request": dict(existing)}

        try:
            snap = _cash_snapshot(con, today, account)
        except ValueError as e:
            return {"found": False, "error": str(e)}
        reserve = 0 if kind == "rent" else snap["rent_reserve"]
        left = snap["balance"] - snap["pending_total"] - reserve - amount
        if left < CASH_FLOOR:
            return _refuse(
                f"Not enough cash: balance {snap['balance']}, already pending {snap['pending_total']}, "
                f"rent reserved {reserve}, this payment {amount} would leave {round(left, 2)}.",
                amount=amount,
            )

        cur = con.execute(
            "INSERT INTO approval_requests (kind, ticket_id, ref_id, amount, account, reason, "
            "requested_by, shop_date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (kind, ticket_id, ref_id, amount, account, reason, requested_by, today.isoformat(), _now()),
        )
        request = dict(con.execute("SELECT * FROM approval_requests WHERE id = ?", (cur.lastrowid,)).fetchone())
    return {"found": True, "created": True, "request": request,
            "projected_balance_if_approved": round(left + reserve, 2)}


@mcp.tool
def request_purchase_order(
    vendor_id: int,
    sku: str,
    size: str,
    qty: int,
    ticket_id: int,
    requested_by: str,
    reason: str,
    account: str = "checking",
) -> dict:
    """Ask a human to approve a restock purchase order. Does NOT order anything.

    The cost is qty x unit_cost from the pricing table. New orders come last in
    the payment priority, so the request is refused if, after pending requests,
    rent due within 30 days, and unpaid open invoices, the order would break the
    $0 cash floor. If the vendor has an open unpaid invoice, the request is
    still saved but flagged vendor_blocked: a human cannot approve it until that
    invoice is paid. requested_by is filled in automatically.
    """
    if qty <= 0:
        return {"found": False, "error": "qty must be at least 1."}
    with closing(_connect_write()) as con, con:
        today = _today(con)
        vendor = con.execute("SELECT id, name, lead_days FROM vendors WHERE id = ?", (vendor_id,)).fetchone()
        if vendor is None:
            return {"found": False, "error": f"No vendor with id={vendor_id}."}
        if con.execute("SELECT 1 FROM inventory WHERE sku = ? AND size = ?", (sku, size)).fetchone() is None:
            return {"found": False, "error": f"No inventory row for sku={sku!r}, size={size!r}."}
        price = con.execute("SELECT unit_cost FROM pricing WHERE sku = ?", (sku,)).fetchone()
        if price is None:
            return {"found": False, "error": f"No pricing for sku={sku!r}."}
        amount = round(qty * price["unit_cost"], 2)

        existing = con.execute(
            "SELECT * FROM approval_requests WHERE kind = 'purchase_order' AND ref_id = ? AND sku = ? "
            "AND size = ? AND ticket_id = ? AND status = 'pending'",
            (vendor_id, sku, size, ticket_id),
        ).fetchone()
        if existing is not None:
            return {"found": True, "created": False, "duplicate": True, "request": dict(existing)}

        try:
            snap = _cash_snapshot(con, today, account)
        except ValueError as e:
            return {"found": False, "error": str(e)}
        pending_invoice_ids = {
            r["ref_id"] for r in con.execute(
                "SELECT ref_id FROM approval_requests WHERE kind = 'invoice' AND status = 'pending'")
        }
        unrequested_invoices = sum(
            r["amount"] for r in con.execute("SELECT id, amount FROM invoices WHERE status = 'open'")
            if r["id"] not in pending_invoice_ids
        )
        left = snap["balance"] - snap["pending_total"] - snap["rent_reserve"] - unrequested_invoices - amount
        if left < CASH_FLOOR:
            return _refuse(
                f"Not enough cash for {qty} x {sku} {size} (${amount}): after pending requests "
                f"({snap['pending_total']}), rent reserve ({snap['rent_reserve']}) and unpaid invoices "
                f"({unrequested_invoices}) it would leave {round(left, 2)}.",
                amount=amount,
                max_affordable_qty=max(int((left + amount - CASH_FLOOR) // price["unit_cost"]), 0),
            )

        blocking = [dict(r) for r in con.execute(
            "SELECT id, amount, due_date FROM invoices WHERE vendor_id = ? AND status = 'open'", (vendor_id,))]
        cur = con.execute(
            "INSERT INTO approval_requests (kind, ticket_id, ref_id, sku, size, qty, amount, account, "
            "reason, requested_by, shop_date, created_at) VALUES ('purchase_order', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (ticket_id, vendor_id, sku, size, qty, amount, account, reason, requested_by, today.isoformat(), _now()),
        )
        request = dict(con.execute("SELECT * FROM approval_requests WHERE id = ?", (cur.lastrowid,)).fetchone())
    return {
        "found": True,
        "created": True,
        "request": request,
        "vendor": vendor["name"],
        "vendor_blocked": bool(blocking),
        "blocking_invoices": blocking,
        "earliest_arrival_if_approved_today": (today + timedelta(days=vendor["lead_days"])).isoformat(),
    }


@mcp.tool
def save_customer_draft(ticket_id: int, subject: str, body: str, drafted_by: str) -> dict:
    """Save a draft message to the ticket's requester. Does NOT send it.

    Drafts stay on the board for a human to review; nothing is emailed. The
    recipient is always the ticket's requester. drafted_by is filled in automatically.
    """
    with closing(_connect_write()) as con, con:
        today = _today(con)
        t = con.execute("SELECT requester FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if t is None:
            return {"found": False, "error": f"No ticket with id={ticket_id}."}
        cur = con.execute(
            "INSERT INTO message_drafts (ticket_id, recipient, subject, body, drafted_by, shop_date, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (ticket_id, t["requester"], subject, body, drafted_by, today.isoformat(), _now()),
        )
        draft = dict(con.execute("SELECT * FROM message_drafts WHERE id = ?", (cur.lastrowid,)).fetchone())
    return {"found": True, "created": True, "draft": draft, "sent": False}


@mcp.tool
def update_ticket_status(
    ticket_id: int,
    status: Literal["open", "in_progress", "waiting_on_approval", "needs_human", "resolved"],
    note: str,
    updated_by: str,
) -> dict:
    """Change a ticket's status and log why on the board.

    Use waiting_on_approval when a human must approve a payment or order,
    needs_human when the team cannot decide, and resolved only when nothing is
    left pending. A ticket with pending approval requests cannot be marked
    resolved. updated_by is filled in automatically.
    """
    with closing(_connect_write()) as con, con:
        today = _today(con)
        t = con.execute("SELECT status FROM tickets WHERE id = ?", (ticket_id,)).fetchone()
        if t is None:
            return {"found": False, "error": f"No ticket with id={ticket_id}."}
        if status == "resolved":
            n = con.execute(
                "SELECT COUNT(*) FROM approval_requests WHERE ticket_id = ? AND status = 'pending'", (ticket_id,)
            ).fetchone()[0]
            if n:
                return _refuse(f"Ticket {ticket_id} has {n} approval request(s) still pending.")
        con.execute("UPDATE tickets SET status = ? WHERE id = ?", (status, ticket_id))
        con.execute(
            "INSERT INTO ticket_updates (ticket_id, old_status, new_status, note, updated_by, shop_date, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (ticket_id, t["status"], status, note, updated_by, today.isoformat(), _now()),
        )
    return {"found": True, "updated": True, "ticket_id": ticket_id, "old_status": t["status"], "new_status": status}


# ---------------------------------------------------------------------------
# Human-only: the one place money leaves the shop.
# ---------------------------------------------------------------------------

@mcp.tool
def decide_approval(
    request_id: int,
    decision: Literal["approve", "reject"],
    decided_by: str,
    note: str = "",
) -> dict:
    """HUMAN ONLY. Approve or reject a pending approval request.

    Agents are never given this tool. Approving pays from the cash account in
    one transaction: checks the balance (refuses anything that would go below
    $0), records the payment in payments, lowers the balance, and marks the
    invoice paid or moves the lease's next_due forward one month. A purchase
    order cannot be approved while its vendor has an open unpaid invoice.
    """
    who = decided_by.strip()
    if not who or who.lower() in AGENT_NAMES:
        return {"found": True, "decided": False, "reason": "decided_by must be a human's name, not an agent."}

    with closing(_connect_write()) as con, con:
        today = _today(con)
        req = con.execute("SELECT * FROM approval_requests WHERE id = ?", (request_id,)).fetchone()
        if req is None:
            return {"found": False, "error": f"No approval request with id={request_id}."}
        if req["status"] != "pending":
            return {"found": True, "decided": False, "reason": f"Request {request_id} is already {req['status']}."}

        if decision == "reject":
            con.execute(
                "UPDATE approval_requests SET status = 'rejected', decided_by = ?, decided_at = ?, "
                "decision_note = ? WHERE id = ?",
                (who, _now(), note, request_id),
            )
            return {"found": True, "decided": True, "status": "rejected", "request_id": request_id}

        kind, amount, account = req["kind"], req["amount"], req["account"]
        extra: dict = {}
        if kind == "invoice":
            inv = con.execute("SELECT status FROM invoices WHERE id = ?", (req["ref_id"],)).fetchone()
            if inv is None or inv["status"] != "open":
                return {"found": True, "decided": False, "reason": f"Invoice {req['ref_id']} is not open."}
        elif kind == "purchase_order":
            open_inv = con.execute(
                "SELECT COUNT(*) FROM invoices WHERE vendor_id = ? AND status = 'open'", (req["ref_id"],)
            ).fetchone()[0]
            if open_inv:
                return {"found": True, "decided": False,
                        "reason": "Vendor still has an open unpaid invoice; it will not ship. Pay that first."}

        bal = con.execute("SELECT balance FROM cash_accounts WHERE name = ?", (account,)).fetchone()
        if bal is None:
            return {"found": False, "error": f"No cash account named {account!r}."}
        if bal["balance"] - amount < CASH_FLOOR:
            return {"found": True, "decided": False,
                    "reason": f"Refused: paying {amount} from a balance of {bal['balance']} would go below $0."}

        payment_ref = request_id if kind == "purchase_order" else req["ref_id"]
        cur = con.execute(
            "INSERT INTO payments (kind, ref_id, amount, account, paid_at, approved_by) VALUES (?, ?, ?, ?, ?, ?)",
            (kind, payment_ref, amount, account, today.isoformat(), who),
        )
        new_balance = round(bal["balance"] - amount, 2)
        con.execute("UPDATE cash_accounts SET balance = ?, date = ? WHERE name = ?",
                    (new_balance, today.isoformat(), account))
        if kind == "invoice":
            con.execute("UPDATE invoices SET status = 'paid' WHERE id = ?", (req["ref_id"],))
        elif kind == "rent":
            lease = con.execute("SELECT next_due FROM leases WHERE id = ?", (req["ref_id"],)).fetchone()
            nxt = _add_month(date.fromisoformat(lease["next_due"])).isoformat()
            con.execute("UPDATE leases SET next_due = ? WHERE id = ?", (nxt, req["ref_id"]))
            extra["lease_next_due"] = nxt
        else:
            lead = con.execute("SELECT lead_days FROM vendors WHERE id = ?", (req["ref_id"],)).fetchone()["lead_days"]
            extra["expected_arrival"] = (today + timedelta(days=lead)).isoformat()
            extra["note"] = "Stock is not added to inventory until the order arrives."
        con.execute(
            "UPDATE approval_requests SET status = 'approved', decided_by = ?, decided_at = ?, "
            "decision_note = ?, payment_id = ? WHERE id = ?",
            (who, _now(), note, cur.lastrowid, request_id),
        )
    return {"found": True, "decided": True, "status": "approved", "request_id": request_id,
            "payment_id": cur.lastrowid, "amount": amount, "new_balance": new_balance, **extra}


@mcp.tool
def reset_working_database() -> dict:
    """HUMAN ONLY. Copy the original data/campus_customs.db over the working copy for a clean run.

    Agents are never given this tool; the dashboard's Reset button calls it. The original
    is only read. Approval requests, drafts, and status updates are cleared because the
    original has no board tables. The audit trail (a separate file) is not touched.
    """
    if not ORIGINAL_DB.exists():
        return {"found": False, "error": f"Original database not found at {ORIGINAL_DB}."}
    if DB_PATH.resolve() == ORIGINAL_DB.resolve():
        return {"found": True, "reset": False, "reason": "The working copy points at the original; refusing to overwrite it."}
    shutil.copyfile(ORIGINAL_DB, DB_PATH)
    for suffix in ("-journal", "-wal", "-shm"):
        leftover = DB_PATH.with_name(DB_PATH.name + suffix)
        if leftover.exists():
            leftover.unlink()
    with closing(_connect()) as con:
        balance = con.execute("SELECT balance FROM cash_accounts WHERE name = 'checking'").fetchone()[0]
        tickets = [dict(r) for r in con.execute("SELECT id, status FROM tickets ORDER BY id")]
    return {"found": True, "reset": True, "copied_from": ORIGINAL_DB.name, "copied_to": DB_PATH.name,
            "balance": balance, "tickets": tickets}


if __name__ == "__main__":
    mcp.run()
