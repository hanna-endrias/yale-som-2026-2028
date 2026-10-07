"""Campus Customs FastAPI backend.

Run from the backend/ folder:
    uvicorn main:app --reload --port 8000
"""

import hashlib
import hmac
import json
import logging
import re
import secrets
from contextlib import closing
import sqlite3

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, field_validator

from agent import run_chat
from models import ChatHistory, ChatRequest, ChatResponse, Customer, HistoryMessage, PageProduct, ProductCard
# The read-only connection lives in tools.py so the agent's tools can share it
# (tools.py can't import from main.py: main -> agent -> tools would be circular).
from tools import DATA_DIR, DB_PATH, SIZE_ORDER, ChatDeps, get_connection

logger = logging.getLogger("campus_customs")

PRODUCTS_DIR = DATA_DIR / "products"

# Password hashing scheme used by the existing users table:
# "pbkdf2_sha256$<salt>$<hex hash>", PBKDF2-HMAC-SHA256 with 120,000 iterations.
PASSWORD_SCHEME = "pbkdf2_sha256"
PASSWORD_ITERATIONS = 120_000

# Vite dev server origins allowed to call this API.
FRONTEND_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

app = FastAPI(title="Campus Customs API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=FRONTEND_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Only the products/ image folder is served -- never the data/ folder itself,
# so the database file can't be downloaded. image_file_path values look like
# "products/<name>.jpg", so the image URL is "<backend URL>/<image_file_path>".
app.mount("/products", StaticFiles(directory=PRODUCTS_DIR), name="products")


def get_writable_connection() -> sqlite3.Connection:
    """Open the database for writing. Only used to insert new users.

    mode=rw (not rwc) so a wrong path raises an error instead of creating an empty database.
    """
    conn = sqlite3.connect(f"file:{DB_PATH.as_posix()}?mode=rw", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def hash_password(password: str) -> str:
    """Hash a new password with a random per-user salt."""
    salt = secrets.token_hex(8)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PASSWORD_ITERATIONS)
    return f"{PASSWORD_SCHEME}${salt}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    """Re-hash the entered password with the stored salt and compare."""
    parts = stored.split("$")
    if len(parts) != 3 or parts[0] != PASSWORD_SCHEME:
        return False
    _, salt, expected = parts
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), PASSWORD_ITERATIONS)
    # compare_digest takes the same time whether or not the hashes match.
    return hmac.compare_digest(digest.hex(), expected)


def product_from_row(row: sqlite3.Row) -> dict:
    """Convert a catalogue row to JSON, parsing the JSON-array text columns."""
    return {
        "product_id": row["product_id"],
        "name": row["name"],
        "garment_type": row["garment_type"],
        "description": row["description"],
        "colors": json.loads(row["colors"]),
        "search_tags": json.loads(row["search_tags"]),
        "image_file_path": row["image_file_path"],
        "price": row["price"],
    }


@app.get("/api/products")
def list_products() -> list[dict]:
    with closing(get_connection()) as conn:
        rows = conn.execute("SELECT * FROM catalogue ORDER BY name").fetchall()
    return [product_from_row(row) for row in rows]


@app.get("/api/products/{product_id}")
def get_product(product_id: str) -> dict:
    with closing(get_connection()) as conn:
        row = conn.execute(
            "SELECT * FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="Product not found")
        inventory = conn.execute(
            "SELECT size, quantity FROM inventory WHERE product_id = ?", (product_id,)
        ).fetchall()

    product = product_from_row(row)
    sizes = [{"size": r["size"], "quantity": r["quantity"]} for r in inventory]
    sizes.sort(key=lambda s: SIZE_ORDER.index(s["size"]) if s["size"] in SIZE_ORDER else len(SIZE_ORDER))
    product["sizes"] = sizes
    return product


# ---------- Accounts ----------

EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")

# Password length rules for new accounts (NIST SP 800-63B: at least 8, allow long
# passphrases, no character-mix rules). Login doesn't check these, so existing
# accounts with shorter passwords can still sign in.
PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def normalize_email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise ValueError("Enter a valid email address")
    return email


class RegisterRequest(BaseModel):
    first_name: str
    last_name: str
    email: str
    password: str
    confirm_password: str

    @field_validator("first_name", "last_name")
    @classmethod
    def name_required(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("This field is required")
        return value

    @field_validator("email")
    @classmethod
    def valid_email(cls, value: str) -> str:
        return normalize_email(value)

    @field_validator("password")
    @classmethod
    def password_length(cls, value: str) -> str:
        if len(value) < PASSWORD_MIN_LENGTH:
            raise ValueError(f"Password must be at least {PASSWORD_MIN_LENGTH} characters")
        if len(value) > PASSWORD_MAX_LENGTH:
            raise ValueError(f"Password must be at most {PASSWORD_MAX_LENGTH} characters")
        return value


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    """What the API returns about a user -- never the password hash."""

    id: int
    first_name: str
    last_name: str
    name: str
    email: str


def user_from_row(row: sqlite3.Row) -> UserOut:
    return UserOut(
        id=row["id"],
        first_name=row["first_name"] or "",
        last_name=row["last_name"] or "",
        name=row["name"],
        email=row["email"],
    )


@app.post("/api/register", status_code=201)
def register(body: RegisterRequest) -> UserOut:
    if body.password != body.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")

    name = f"{body.first_name} {body.last_name}"
    password_hash = hash_password(body.password)
    with closing(get_writable_connection()) as conn:
        try:
            with conn:  # commits on success, rolls back on error
                cursor = conn.execute(
                    "INSERT INTO users (name, first_name, last_name, email, password_hash)"
                    " VALUES (?, ?, ?, ?, ?)",
                    (name, body.first_name, body.last_name, body.email, password_hash),
                )
        except sqlite3.IntegrityError:
            # The email column is UNIQUE.
            raise HTTPException(status_code=409, detail="Email already registered")
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cursor.lastrowid,)).fetchone()
    return user_from_row(row)


@app.post("/api/login")
def login(body: LoginRequest) -> UserOut:
    # Same message for unknown email and wrong password, so the response
    # doesn't reveal which emails have accounts.
    invalid = HTTPException(status_code=401, detail="Invalid email or password")
    email = body.email.strip().lower()
    with closing(get_connection()) as conn:
        row = conn.execute("SELECT * FROM users WHERE lower(email) = ?", (email,)).fetchone()
    if row is None or not verify_password(body.password, row["password_hash"]):
        raise invalid
    return user_from_row(row)


# ---------- Chat ----------

# Saved messages passed to the model (keeps each request small) and shown when the
# widget reloads.
MODEL_HISTORY_LIMIT = 20
DISPLAY_HISTORY_LIMIT = 50


def load_customer(user_id: int) -> Customer | None:
    """The shopper's identity always comes from the users table. Unknown id = guest."""
    with closing(get_connection()) as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return Customer(
        id=row["id"],
        name=row["name"],
        first_name=row["first_name"] or row["name"].split(" ")[0],
        email=row["email"],
    )


def load_page_product(product_id: str) -> PageProduct | None:
    with closing(get_connection()) as conn:
        row = conn.execute(
            "SELECT product_id, name, colors FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
    if row is None:
        return None
    return PageProduct(product_id=row["product_id"], name=row["name"], colors=json.loads(row["colors"]))


def load_history(user_id: int, limit: int) -> list[HistoryMessage]:
    """The user's most recent saved messages, oldest first (read-only)."""
    with closing(get_connection()) as conn:
        rows = conn.execute(
            "SELECT role, content, products_json FROM chat_messages WHERE user_id = ?"
            " ORDER BY created_at DESC, id DESC LIMIT ?",  # id breaks ties within the same second
            (user_id, limit),
        ).fetchall()
    messages = []
    for row in reversed(rows):
        if row["role"] not in ("user", "assistant"):
            continue
        cards = [ProductCard.model_validate(item) for item in json.loads(row["products_json"] or "[]")]
        messages.append(HistoryMessage(role=row["role"], content=row["content"], products=cards))
    return messages


def save_turn(user_id: int, message: str, response: ChatResponse) -> None:
    """Save the shopper's message and the agent's reply (with its cards) in one transaction."""
    cards_json = json.dumps([card.model_dump() for card in response.products])
    with closing(get_writable_connection()) as conn:
        with conn:  # commits both rows, or neither
            conn.execute(
                "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'user', ?, NULL)",
                (user_id, message),
            )
            conn.execute(
                "INSERT INTO chat_messages (user_id, role, content, products_json) VALUES (?, 'assistant', ?, ?)",
                (user_id, response.reply, cards_json),
            )


@app.post("/chat")
async def chat(body: ChatRequest) -> ChatResponse:
    # Load everything the agent needs before the run. Guests get no identity and no history.
    customer = load_customer(body.user_id) if body.user_id is not None else None
    page_product = load_page_product(body.product_id) if body.product_id else None
    history = load_history(customer.id, MODEL_HISTORY_LIMIT) if customer else []
    deps = ChatDeps(customer=customer, page_product=page_product)
    try:
        response = await run_chat(body.message, deps, history)
    except Exception:
        # Full details go to the server log; the shopper gets a short message.
        logger.exception("Chat agent run failed")
        raise HTTPException(status_code=502, detail="The assistant is unavailable right now. Please try again.")
    # Save after the run, and only for logged-in shoppers.
    if customer:
        save_turn(customer.id, body.message, response)
    return response


@app.get("/chat/history")
def chat_history(user_id: int) -> ChatHistory:
    """Saved conversation for the widget to show when a logged-in shopper returns."""
    if load_customer(user_id) is None:
        return ChatHistory(messages=[])
    return ChatHistory(messages=load_history(user_id, DISPLAY_HISTORY_LIMIT))
