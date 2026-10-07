"""Pydantic types for the Campus Customs chat agent."""

from typing import Literal

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    """A message the shopper typed into the chat widget, plus who sent it and from where."""

    message: str = Field(min_length=1, max_length=2000)
    user_id: int | None = Field(default=None, description="Logged-in user's id; absent for guests")
    product_id: str | None = Field(default=None, description="Product page the shopper is on, if any")


class Customer(BaseModel):
    """The logged-in shopper, loaded from the users table (never from chat text)."""

    id: int
    name: str
    first_name: str
    email: str


class PageProduct(BaseModel):
    """The product page the shopper is viewing, loaded from the catalogue."""

    product_id: str
    name: str
    colors: list[str]


class ProductCard(BaseModel):
    """Everything the frontend needs to draw a product card and open its detail page.

    Field names match the /api/products JSON, so the same card component renders both.
    """

    product_id: str = Field(description="Opens /products/{product_id}")
    name: str
    price: float
    description: str
    image_file_path: str = Field(description='Relative image path, e.g. "products/<name>.jpg"')


class ChatResponse(BaseModel):
    """The agent's reply text, plus product cards for any catalogue search it ran.

    `products` is filled in by the server from the database, not written by the model.
    """

    reply: str
    products: list[ProductCard] = Field(default_factory=list)
    found_nothing: bool = Field(
        default=False,
        description="True when a lookup or search came back not_found and no cards were shown "
        "(the chat's mascot looks disappointed)",
    )


class HistoryMessage(BaseModel):
    """One saved chat message, as sent back to the widget when it reloads."""

    role: Literal["user", "assistant"]
    content: str
    products: list[ProductCard] = Field(default_factory=list)


class ChatHistory(BaseModel):
    messages: list[HistoryMessage]


# ---------- Tool results ----------
# Every tool result has a `status` so the model can't confuse "not found" with
# "found", plus a plain-English `message` it can lean on when wording the reply.

LookupStatus = Literal["found", "not_found", "ambiguous"]


class ProductInfo(BaseModel):
    product_id: str
    name: str = Field(description="Display name to use when talking to the shopper")
    description: str
    price_usd: float = Field(description="Price in US dollars, straight from the catalogue")


class ProductInfoResult(BaseModel):
    """Result of get_product_info."""

    status: LookupStatus
    query: str = Field(description="The product name that was searched for")
    product: ProductInfo | None = Field(default=None, description="Set only when status is 'found'")
    candidates: list[str] = Field(
        default_factory=list,
        description="Product names the shopper might mean, when status is 'ambiguous' or 'not_found'",
    )
    message: str


class SizeStock(BaseModel):
    size: str = Field(description="One of XS, S, M, L, XL, XXL")
    quantity: int = Field(description="Units in stock for this size")
    in_stock: bool = Field(description="False when quantity is 0 (sold out in this size)")


class SearchMatch(BaseModel):
    """What the model sees about each search match -- just enough to write a sentence."""

    name: str
    garment_type: str
    price_usd: float


class CategoryCount(BaseModel):
    """One kind of item the store carries, with how many products are in it."""

    name: str
    count: int


class CatalogueSearchResult(BaseModel):
    """Result of search_catalogue. The matching products are also shown as cards."""

    status: Literal["found", "not_found"]
    query: str = Field(description="The keywords that were searched for")
    total_matches: int = Field(description="How many products matched in the whole catalogue")
    shown: int = Field(description="How many of those are shown to the shopper as cards")
    matches: list[SearchMatch] = Field(default_factory=list, description="The products shown, best match first")
    categories_we_carry: list[CategoryCount] = Field(
        default_factory=list,
        description="When status is 'not_found': the only kinds of items the store sells. "
        "Suggest alternatives from this list only.",
    )
    message: str


class StockResult(BaseModel):
    """Result of get_stock."""

    status: Literal["found", "not_found", "ambiguous", "invalid_size"]
    query: str = Field(description="The product name that was searched for")
    size_requested: str | None = Field(
        default=None, description="Normalized size the shopper asked about, or None for all sizes"
    )
    product_id: str | None = None
    name: str | None = Field(default=None, description="Display name of the matched product")
    sizes: list[SizeStock] = Field(
        default_factory=list, description="Requested size only, or all sizes in XS to XXL order"
    )
    total_quantity: int | None = Field(
        default=None, description="Sum of quantity across the sizes listed; 0 means sold out"
    )
    candidates: list[str] = Field(
        default_factory=list,
        description="Product names the shopper might mean, when status is 'ambiguous' or 'not_found'",
    )
    message: str


# ---------- Audit trail ----------
# One entry per /chat run in output/audit_trail.json. Short and non-sensitive on purpose:
# no shopper message text, no identity, no full product lists.


class AuditToolCall(BaseModel):
    tool: str = Field(description="Tool the agent called")
    args: str = Field(description="Short argument: the product name or search query (and size)")
    result: str = Field(description="Short outcome: the status, plus a count where useful")


class AuditEntry(BaseModel):
    run_id: str = Field(description="Random id for this /chat run")
    timestamp: str = Field(description="When the run finished, UTC, ISO 8601")
    stop_reason: Literal["completed", "no_tools_used", "error"]
    tool_calls: list[AuditToolCall] = Field(default_factory=list)
    cards_shown: int = Field(default=0, description="How many product cards the reply carried")
    error_type: str | None = Field(default=None, description="Exception class name when stop_reason is 'error'")
