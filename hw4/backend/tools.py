"""Tools the Campus Customs agent can call, plus the shared read-only database access.

get_product_info and get_stock find one product by its display name themselves, so the
agent never has to chain a "search" call before a "details" call. search_catalogue finds
several products for browsing questions and attaches them as product cards. All tools
only read from the database. Each tool defined here must also be registered on the
agent in agent.py.
"""

import json
import os
import re
import sqlite3
from contextlib import closing
from dataclasses import dataclass, field
from pathlib import Path

from pydantic_ai import RunContext

from models import (
    CatalogueSearchResult,
    CategoryCount,
    Customer,
    PageProduct,
    ProductCard,
    ProductInfo,
    ProductInfoResult,
    SearchMatch,
    SizeStock,
    StockResult,
)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
# CAMPUS_CUSTOMS_DB can point at a copy of the database (e.g. for testing).
DB_PATH = Path(os.environ.get("CAMPUS_CUSTOMS_DB", DATA_DIR / "campus_customs.db"))

# Display order for sizes (the inventory table stores them as text).
SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"]

# How many candidate names to return for ambiguous / not-found lookups.
MAX_CANDIDATES = 8

# Most product cards a single chat reply can show.
MAX_SEARCH_RESULTS = 8


@dataclass
class ChatDeps:
    """Per-message state for the agent, filled in by the backend before the run.

    customer and page_product are known up front and trusted (they come from the login
    and the page, not from chat text); agent.py puts them in the instructions.
    search_catalogue adds the cards to show; agent.py copies them into ChatResponse,
    so the model never has to repeat them.
    """

    customer: Customer | None = None  # None = guest
    page_product: PageProduct | None = None  # None = not on a product page
    cards: list[ProductCard] = field(default_factory=list)


def get_connection() -> sqlite3.Connection:
    """Open the database read-only. Used by every route and tool that only reads."""
    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


# ---------- Name matching ----------

# Shopper phrasings -> how the catalogue names write them. Applied to both the query
# and the product names so they compare the same way.
_PHRASE_ALIASES = [
    (r"\bt-?shirts?\b|\btees?\b", "t shirt"),
    (r"\bquarter[- ]?zips?\b|\b1/4[- ]?zips?\b", "1 4 zip"),
    (r"\bcrew[- ]necks?\b|\bcreqneck\b", "crewneck"),  # "Creqneck" is a catalogue typo
    (r"\bhood(?:y|ed|s)?\b", "hoodie"),  # several hoodies are named "... Hood"
    (r"\bversus\b", "vs"),
    (r"&", " and "),
]
# Words that don't help pick a product. "yale" is here because nearly every item is
# Yale gear but many names leave it out ("Boola Boola T Shirt").
_IGNORED_WORDS = {"the", "a", "an", "of", "yale"}


def _words(text: str) -> set[str]:
    text = text.lower()
    for pattern, replacement in _PHRASE_ALIASES:
        text = re.sub(pattern, replacement, text)
    words = set()
    for word in re.findall(r"[a-z0-9]+", text):
        # Treat simple plurals as singular ("hoodies" -> "hoodie"), keeping "ss" words.
        if len(word) > 3 and word.endswith("s") and not word.endswith("ss"):
            word = word[:-1]
        if word not in _IGNORED_WORDS:
            words.add(word)
    return words


def _find_products(conn: sqlite3.Connection, name: str) -> tuple[str, list[sqlite3.Row]]:
    """Match a shopper's product name against the catalogue.

    Returns ("found", [row]), ("ambiguous", rows) or ("not_found", near_misses).
    A product matches when its name contains every meaningful word of the query.
    """
    rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
    query = _words(name)
    if not query:
        return "not_found", []

    exact = [r for r in rows if _words(r["name"]) == query]
    if len(exact) == 1:
        return "found", exact

    matches = [r for r in rows if query <= _words(r["name"])]
    if len(matches) == 1:
        return "found", matches
    if matches:
        return "ambiguous", matches

    # No full match: offer names sharing any query word, best first. Rarer words count
    # more, so "Saybrook hoodie" suggests the Saybrook items before generic hoodies.
    name_words = [_words(r["name"]) for r in rows]
    weight = {w: 1 / sum(w in ws for ws in name_words) for w in query if any(w in ws for ws in name_words)}
    scored = [(sum(weight.get(w, 0) for w in query & ws), r) for ws, r in zip(name_words, rows)]
    near = [r for score, r in sorted(scored, key=lambda s: -s[0]) if score > 0]
    return "not_found", near


def _candidate_names(rows: list[sqlite3.Row]) -> list[str]:
    return [r["name"] for r in rows[:MAX_CANDIDATES]]


def _lookup_message(status: str, name: str, rows: list[sqlite3.Row]) -> str:
    if status == "ambiguous":
        return f"{len(rows)} products match '{name}'. Ask the shopper which one they mean."
    if rows:
        return f"No product named '{name}'. Similar names are listed; ask before assuming one."
    return f"No product named '{name}' in the catalogue."


# ---------- Size handling ----------

_SIZE_ALIASES = {
    "xs": "XS", "x-small": "XS", "extra small": "XS", "extra-small": "XS",
    "s": "S", "sm": "S", "small": "S",
    "m": "M", "med": "M", "medium": "M",
    "l": "L", "lg": "L", "large": "L",
    "xl": "XL", "x-large": "XL", "extra large": "XL", "extra-large": "XL",
    "xxl": "XXL", "2xl": "XXL", "xx-large": "XXL", "2x": "XXL", "extra extra large": "XXL",
}


def _normalize_size(size: str) -> str | None:
    return _SIZE_ALIASES.get(" ".join(size.lower().split()))


def _size_rank(size: str) -> int:
    return SIZE_ORDER.index(size) if size in SIZE_ORDER else len(SIZE_ORDER)


# ---------- Tools ----------


def get_product_info(name: str) -> ProductInfoResult:
    """Look up a Campus Customs product's description and price by its name.

    Use this for any question about what a product is like or how much it costs.

    Args:
        name: The product name as the shopper said it, e.g. "Yale vs Harvard shirt".
    """
    with closing(get_connection()) as conn:
        status, rows = _find_products(conn, name)

    if status != "found":
        return ProductInfoResult(
            status=status,
            query=name,
            candidates=_candidate_names(rows),
            message=_lookup_message(status, name, rows),
        )

    row = rows[0]
    return ProductInfoResult(
        status="found",
        query=name,
        product=ProductInfo(
            product_id=row["product_id"],
            name=row["name"],
            description=row["description"],
            price_usd=row["price"],
        ),
        message=f"Found '{row['name']}'.",
    )


def get_stock(name: str, size: str | None = None) -> StockResult:
    """Look up how many of a Campus Customs product are in stock, by product name.

    Use this for any question about stock, availability, or sizes.

    Args:
        name: The product name as the shopper said it, e.g. "Yale vs Harvard shirt".
        size: Optional size the shopper asked about (XS, S, M, L, XL or XXL). Leave it
            out to get every size.
    """
    size_requested = None
    if size is not None and size.strip():
        size_requested = _normalize_size(size)
        if size_requested is None:
            return StockResult(
                status="invalid_size",
                query=name,
                message=f"'{size}' isn't a size we carry. Sizes are {', '.join(SIZE_ORDER)}.",
            )

    with closing(get_connection()) as conn:
        status, rows = _find_products(conn, name)
        if status != "found":
            return StockResult(
                status=status,
                query=name,
                size_requested=size_requested,
                candidates=_candidate_names(rows),
                message=_lookup_message(status, name, rows),
            )
        row = rows[0]
        inventory = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (row["product_id"],)
        ).fetchall()

    sizes = sorted(
        (SizeStock(size=r["size"], quantity=r["quantity"], in_stock=r["quantity"] > 0) for r in inventory),
        key=lambda s: _size_rank(s.size),
    )
    if size_requested is not None:
        sizes = [s for s in sizes if s.size == size_requested]

    if not sizes:
        message = f"No stock record for '{row['name']}'" + (f" in {size_requested}." if size_requested else ".")
        total = None
    else:
        total = sum(s.quantity for s in sizes)
        sold_out = [s.size for s in sizes if not s.in_stock]
        if total == 0:
            message = f"'{row['name']}' is out of stock" + (f" in {size_requested}." if size_requested else " in every size.")
        elif sold_out:
            message = f"Sold out in: {', '.join(sold_out)}."
        else:
            message = "In stock."

    return StockResult(
        status="found",
        query=name,
        size_requested=size_requested,
        product_id=row["product_id"],
        name=row["name"],
        sizes=sizes,
        total_quantity=total,
        message=message,
    )


# The kinds of items the store sells, from each product's garment_type. Checked in order,
# so "crewneck sweatshirt" is a crewneck (not a shirt) and "hooded sweatshirt" is a hoodie.
# Same grouping as the Products page filter chips (frontend/src/catalogFilters.ts).
_CATEGORIES = [
    ("Hoodies", lambda g: "hood" in g),
    ("Quarter zips", lambda g: "quarter-zip" in g),
    ("Crewnecks", lambda g: "crewneck" in g or "mockneck" in g),
    ("Tees and long sleeves", lambda g: "shirt" in g),
    ("Jackets and fleece", lambda g: "jacket" in g),
]


def category_counts(conn: sqlite3.Connection) -> list[CategoryCount]:
    """What the store actually carries, with counts, most products first."""
    counts: dict[str, int] = {}
    for (garment,) in conn.execute("SELECT garment_type FROM catalogue"):
        name = next((n for n, test in _CATEGORIES if test(garment.lower())), "Other")
        counts[name] = counts.get(name, 0) + 1
    return [CategoryCount(name=n, count=c) for n, c in sorted(counts.items(), key=lambda kv: -kv[1])]


def describe_categories(categories: list[CategoryCount]) -> str:
    return ", ".join(f"{c.name} ({c.count})" for c in categories)


def _search_score(query: set[str], row: sqlite3.Row) -> int:
    """0 if the product doesn't match; otherwise higher means a better match.

    To qualify, every query word must appear in the name, garment type, or primary color.
    The colors list holds every color on the item with the garment's main color first, so
    only colors[0] counts: a gray sweatshirt with navy lettering isn't a match for "navy".
    Search tags and the other (accent) colors only boost products that already qualify: a
    tag like "sailor hat" on a hoodie's graphic must not make the hoodie a match for "hats".
    """
    name = _words(row["name"])
    garment = _words(row["garment_type"])
    colors = json.loads(row["colors"])
    primary_color = _words(colors[0]) if colors else set()  # a few products list no colors
    if not query <= (name | garment | primary_color):
        return 0
    boosters = _words(" ".join(json.loads(row["search_tags"]) + colors[1:]))
    score = sum(3 if w in name else 2 if w in garment else 1 for w in query)
    return score + len(query & boosters)


def search_catalogue(ctx: RunContext[ChatDeps], query: str) -> CatalogueSearchResult:
    """Search the Campus Customs catalogue for products matching a type or keyword.

    Use this for browsing questions like "what hoodies do you have?" or "show me navy
    crewnecks". The matching products are shown to the shopper as cards automatically.

    Args:
        query: A few keywords for what the shopper wants, e.g. "hoodie" or "navy crewneck".
    """
    words = _words(query)
    with closing(get_connection()) as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall() if words else []
        categories = category_counts(conn)

    scored = [(_search_score(words, r), r) for r in rows]
    matches = [r for score, r in sorted(scored, key=lambda s: -s[0]) if score > 0]
    shown = matches[:MAX_SEARCH_RESULTS]

    # Collect the cards server-side. Skip any already added by an earlier search in this
    # reply, and never go past the cap in total.
    seen = {c.product_id for c in ctx.deps.cards}
    for r in shown:
        if r["product_id"] not in seen and len(ctx.deps.cards) < MAX_SEARCH_RESULTS:
            ctx.deps.cards.append(
                ProductCard(
                    product_id=r["product_id"],
                    name=r["name"],
                    price=r["price"],
                    description=r["description"],
                    image_file_path=r["image_file_path"],
                )
            )
            seen.add(r["product_id"])

    if not matches:
        message = (
            f"No products match '{query}'. We only carry: {describe_categories(categories)}. "
            "Don't suggest any other kind of item."
        )
    elif len(matches) > len(shown):
        message = f"{len(matches)} products match; the top {len(shown)} are shown as cards."
    else:
        message = f"{len(matches)} products match and are shown as cards."

    return CatalogueSearchResult(
        status="found" if matches else "not_found",
        query=query,
        total_matches=len(matches),
        shown=len(shown),
        matches=[SearchMatch(name=r["name"], garment_type=r["garment_type"], price_usd=r["price"]) for r in shown],
        categories_we_carry=[] if matches else categories,
        message=message,
    )
