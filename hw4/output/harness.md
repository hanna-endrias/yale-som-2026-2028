## Problem 2 — Database Analysis

The database (`campus_customs.db`) has 4 tables used by the app — `catalogue`,
`inventory`, `users`, and `chat_messages` — plus `sqlite_sequence`, a built-in SQLite
table that just tracks auto-increment ID counters (not something we read or write directly).

- **catalogue** and **inventory** hold the store's merchandise: what each product is, and
  how much of it is in stock by size. These drive the product pages and the agent's
  honest price/stock answers.
- **users** and **chat_messages** support the logged-in chatbot experience: who the
  shopper is, and the running history of their conversation with the assistant.

### Field Descriptions

**catalogue** (102 products)
- `product_id`: the primary key, a unique, human-readable text slug
  (e.g. `2025-yale-vs-harvard-t-shirt`), not a number. It is also the join key that
  links each product to its `inventory` rows.
- `name`: the display name of the product (e.g. "2025 Yale Vs Harvard T Shirt").
- `garment_type`: the kind of item (e.g. "short-sleeve T-shirt").
- `description`: a longer description covering the item's color, the color of any text
  on it, and features (e.g. ribbed collar).
- `colors`: the colors on the item, stored as a **JSON array string**
  (e.g. `["heather gray", "white", "red", "navy blue"]`), so it must be parsed
  (`json.loads` / `JSON.parse`) rather than read as plain text.
- `search_tags`: relevant search terms the item should show up under, also stored as a
  **JSON array string** (e.g. `["Yale", "Harvard", "The Game", "2025", ...]`).
- `image_file_path`: a **relative** path to the product image
  (e.g. `products/2025-yale-vs-harvard-t-shirt.jpg`), resolved against wherever the app
  serves images.
- `price`: the price as a number (REAL, e.g. `32.0`), displayed on the site and returned
  by the agent so prices are always real, never invented.

**inventory** (612 rows = 102 products × 6 sizes)
- `id`: a unique auto-increment number for each inventory row (primary key).
- `product_id`: links the row back to a product in `catalogue`.
- `size`: the item size; every product has one row per size across the full set
  XS, S, M, L, XL, XXL.
- `quantity`: how many of that product/size are in stock. This is the source of truth for
  honest stock answers (e.g. "only 2 left in L," or out-of-stock when quantity is 0).

**users** (registered shoppers)
- `id`: a unique auto-increment number for each user (primary key); links a user to their
  chat messages.
- `name`: the user's full name (e.g. "Test User"); a combined/legacy name field.
- `email`: the user's email, used to log in; must be unique so two accounts can't share one.
- `password_hash`: a securely hashed password in `pbkdf2_sha256$<salt>$<hash>` format, so
  the plaintext password is never stored.
- `created_at`: the date and time the account was created.
- `first_name`: the user's first name; this (with `last_name` and `email`) is what the
  registration form in Problem 4 collects, and what the chatbot can use to greet the user.
- `last_name`: the user's last name.

**chat_messages** (per-user conversation history)
- `id`: a unique auto-increment number for each message (primary key).
- `user_id`: links each message to the user who sent/received it.
- `role`: who sent the message, either `"user"` (the shopper) or `"assistant"` (the chatbot).
- `content`: the text of the message.
- `products_json`: a **JSON array** of the product(s) attached to an assistant reply
  (e.g. `[{"product_id": "basic-hoodie-big-yale", ...}]`), so matching items can be shown
  as cards next to the answer. It is **null** for user messages.
- `created_at`: the date and time the message was sent (used to order the conversation).

## Problem 4 — Account Creation and Login Flow

- Overall: Each account is one new row in the users table. Passwords are never saved as
  plaintext, logged, or sent to the browser. The backend only returns the user's id, name,
  first_name, last_name, and email — never the password hash.

- Password protection: The backend stores the result of a one-way function, not the
  plaintext password. It reuses the same format as the seed test user: it generates a
  random salt for each user and runs the password and salt through PBKDF2-HMAC-SHA256 for
  120,000 iterations. It stores the result as pbkdf2_sha256$<salt>$<hash>.

- Account creation: Users fill in first name, last name, email, password, and confirm
  password. The form does an initial check, but the backend re-validates to ensure the
  fields are not empty, the email looks valid, the password is 8–128 characters, and the
  password and confirm password match.

- Logging in: The backend looks up the user by email, then hashes the entered password
  with that user's stored salt (120,000 iterations) and compares the result to the stored
  password hash. If they match, the backend returns the user's details.

- Staying logged in: After a successful login or account creation, the user's public
  details (id, name, first_name, last_name, email — never the password hash) are kept in
  the browser's memory and saved to localStorage, so the user stays logged in across page
  refreshes and return visits. The nav bar reads these details to show "Hi, <first name>"
  and a Log out link. Logging out clears the saved details from memory and localStorage,
  returning the nav bar to the logged-out state.

- Error handling: An unknown email and a wrong password return the same message —
  "invalid email or password" — so an attacker can't tell which emails are registered
  (prevents user enumeration).

## Problem 5 — Chat Agent (PydanticAI behind FastAPI)

- Overall: The chat window in the bottom-right corner of every page now talks to a real
  AI assistant. When a shopper sends a message, the website passes it to the backend,
  the backend asks the AI agent for an answer, and the answer appears in the chat.

- How the frontend talks to the backend: The website (port 5173) and the backend
  (port 8000) run as two separate servers, so the chat window sends each message to the
  backend's full address: POST http://localhost:8000/chat, with the message as
  {"message": "..."}. The backend checks the message is between 1 and 2,000 characters,
  waits for the agent to answer, and sends back {"reply": "..."}. While waiting, the chat
  shows "Typing...". If something goes wrong, the shopper sees a short "The assistant is
  unavailable right now. Please try again." message instead of a broken page, and the
  full error is saved in the server log. The backend's CORS settings allow requests from
  the website's address, which is what lets the browser make these calls.

- How the agent is loaded: The agent lives in four files in backend/ — prompts/prompt.md
  (its instructions), agent.py (setup), tools.py (its tools, added in Problem 6), and
  models.py (the shapes of the messages going in and out). agent.py:
  1. Reads PORTKEY_API_KEY from the .env file.
  2. Connects to OpenAI through the Portkey gateway (https://api.portkey.ai/v1, with the
     header x-portkey-provider: openai).
  3. Uses the model gpt-5.6-luna.
  4. Loads backend/prompts/prompt.md as the agent's system prompt (its personality and
     rules). The file is re-read for every message, so edits to the prompt take effect
     without restarting the server.

  The agent is only created the first time someone chats, so the rest of the site
  (products, login) keeps working even if the API key is missing.

- Current limits: The agent doesn't remember earlier messages yet — each message is
  answered on its own.

## Problem 6 — Database Tools for the Chat Agent

### The tools (backend/tools.py)

- get_product_info(name): Returns a product's description and price.

- get_stock(name, size): Returns how many are in stock — all six sizes (XS to XXL) by
  default, or just one size if the shopper names it.

Both tools find the product by name themselves and only read from the database.

### The result fields (backend/models.py) and why

Fields both results share:
- status: One word saying what happened — "found", "not_found", or "ambiguous" (plus
  "invalid_size" for stock). A small model can misread between the lines, so status
  tells it directly which situation it's in, and the prompt says what to do for each.
- query: The name that was searched for, so the agent can say "I couldn't find gym
  shorts" accurately.
- candidates: Up to 8 product names the shopper might mean, used when several products
  match or none do, so the agent asks the shopper to choose instead of guessing. The list
  can be empty when nothing is close (e.g. "gym shorts").
- message: A short plain-English summary (e.g. "Sold out in: XS."), as a backup so the
  model reaches the right conclusion even if it misreads the numbers.

get_product_info result (ProductInfoResult):
- product: The matched product, filled in only when status is "found" — so the model
  can't read details from a failed lookup. It contains:
  - product_id: The product's exact database key. It isn't shown to shoppers, but it's
    there for linking to product cards later.
  - name: The product's real name, so the answer uses the actual product name rather
    than however the shopper phrased it.
  - description: The catalogue description.
  - price_usd: The price. Putting "usd" in the name makes it clear the number is in
    dollars, so the model doesn't have to guess.

get_stock result (StockResult):
- product_id and name: The same two values as in the product-info result (the database
  key for linking to product cards later, and the real product name to use in the
  answer) — here they sit at the top level of the result rather than nested under a
  product object.
- size_requested: The size that was checked, in standard form ("large" → "L"), so the
  agent can confirm which size it looked up.
- sizes: One entry per size, each with:
  - size (e.g. "L")
  - quantity (how many are in stock)
  - in_stock (true or false). This repeats what quantity already says, on purpose: it
    gives the model a clear yes/no for "sold out", which the prompt requires it to say
    plainly.
- total_quantity: The total across the sizes returned. If it's 0, everything checked is
  sold out — the requested size, or every size when none was named — so the model
  doesn't have to add up the numbers itself.

## Problem 7 — Chat-Driven Search with Product Cards

- Overall: When a shopper asks about a type of item ("what hoodies do you have?"), the
  agent searches the catalogue and the matching products appear as clickable product
  cards under its reply in the chat.

- The search tool: search_catalogue(query) in backend/tools.py takes a few keywords
  (e.g. "hoodie", "navy crewneck"). A product qualifies as a match only if every keyword
  appears in its name, garment type, or primary color (the first entry in its colors
  list, which is the garment's main color). Search tags and the other (accent) colors
  only affect ranking: they boost products that already qualify, but can't make
  something a match on their own. This stops incidental words from producing misleading
  results:
  - Colors: a gray sweatshirt with navy lettering (colors: light gray, navy blue) no
    longer comes up for "navy" — only garments that are mainly navy do.
  - Tags: a hoodie tagged "sailor hat" (for its graphic) no longer comes up for "hats",
    so the agent says we don't carry hats.

  Results come back best match first, at most 8, so the chat never dumps the whole
  catalogue, and the tool only reads from the database (using the same read-only
  connection as everything else).

- How a match travels from the search to the cards:
  1. A new, empty card list is created for each chat message (ChatDeps in tools.py).
  2. When the agent calls search_catalogue, the tool looks up the matching products in
     the database and adds each one to that card list — its product_id, name, price,
     description, and image path, copied straight from the catalogue row.
  3. The tool separately tells the model a short summary (how many matched, plus each
     product's name, type, and price) so it can write a sentence about the results.
  4. When the agent finishes, agent.py builds the ChatResponse from two parts: the
     model's sentence becomes "reply", and the card list becomes "products".
  5. The backend sends that ChatResponse to the website, and the chat window draws one
     card per product under the reply.

- Why the model doesn't write the product list: The model is small and cheap, and small
  models tend to garble structured data when copying it — a wrong price, a misspelled
  name, or a broken ID. So the model only writes the sentence. The cards come straight
  from the database, which means a card can only ever show a real catalogue product with
  its real price and image.

- The cards: The chat uses the exact same ProductCard component as the Products page, so
  the cards look the same and work the same way. Each card links to
  /products/<product_id>, which opens the single-item page (it loads the product from
  /api/products/<product_id>). Because every match carries its product_id, this works
  for cards the chat just added, not only the ones on the Products page.

- How the agent knows when to search: prompts/prompt.md now tells the agent to use
  search_catalogue for "what do you have" and category questions, and to keep using
  get_product_info / get_stock for the price or stock of one specific product. Since the
  cards show the details, the agent is told to write a short intro instead of listing
  every product, to mention when there are more matches than shown, and to say so when
  nothing matches rather than making something up.

- Acceptance check: Asking "what hoodies do you have?" returns 8 real hoodie cards (out
  of 27 hoodies in the catalogue) with the correct names, prices, and images. Clicking a
  card (e.g. Champion Full Zip Hood) opens its detail page with the price and stock
  table.

## Problem 8 — Customer Memory and Page Context

- Overall: The chat now remembers logged-in shoppers. Their conversation is saved and
  comes back when they return, the agent knows who it's talking to, and it knows which
  product page they're on, so "do you have this in pink?" works. Guests can still chat,
  but nothing is saved for them.

### How chat history is stored

- Where: The existing chat_messages table (no new table). Each row is one message:
  user_id, role ("user" or "assistant"), content (the text), products_json, and
  created_at (filled in by the database).
- What gets saved: After the agent answers, the backend saves two rows in one step — the
  shopper's message, and the agent's reply. The reply's product cards are saved in
  products_json, so reloaded history shows the same cards. (User messages have no cards,
  so their products_json is empty.) If the agent fails, nothing is saved.
- Who does it: The backend saves and loads history around the agent's run — the AI model
  never reads or writes the database history itself. Loading uses the read-only database
  connection; saving uses the writable one.
- Loading it back:
  - For the agent: the shopper's last 20 messages, oldest first (ordered by created_at),
    are passed to the run as message_history, so the model simply sees the earlier turns
    of the conversation. Earlier replies also note which product cards were shown, so the
    shopper can refer back to them.
  - For the chat window: when a logged-in shopper opens the site, the widget calls
    GET /chat/history?user_id=<id> and shows their last 50 messages with their cards.
- Guests: no identity, nothing saved, nothing loaded — the agent still answers.

### What customer fields the agent sees

- From the users table, for the logged-in shopper: id, full name, first name, and email.
  The agent is told who it's helping ("You're helping Test User (first name: Test, email:
  ...)") and greets them by first name.
- Identity comes from the login, not the chat. The backend looks the user up by id, so
  typing "My name is Dean" doesn't change who the agent thinks it's helping (tested: the
  agent replied it would keep calling them Test).
- Why deps and not a tool: who the shopper is and what page they're on are known before
  the agent starts, small, relevant to every message, and must be trusted. So the backend
  puts them in the agent's deps (ChatDeps) up front, rather than making the model fetch
  them with a tool call.
- Known limitation: There's no login session yet, so the backend trusts the user_id the
  website sends. Anyone who sends a different user_id could see or add to that user's
  chat history. A signed login token would fix this.

### How page context is passed

- The chat window checks the current page. On a product page (/products/<product_id>),
  it sends that product_id with each message; on any other page it sends none.
- The backend looks up that product's name and colors in the catalogue and adds them to
  ChatDeps.
- Every message, the agent's instructions include prompt.md plus a short "This
  conversation" section built from ChatDeps: who the shopper is (or that they're a guest),
  and which product they're viewing, with its colors. The prompt tells the agent that
  "this" or "it" means that product.
- Example: on the Yale Dad Hoodie page (colors: navy blue, white), "do you have this in
  pink?" → "The Yale Dad Hoodie comes in navy blue and white, not pink."

### Search results still render on the page

- The /chat response still returns products alongside reply, for guests and logged-in
  shoppers alike, on any page.
- After every reply, the chat window does two things with those products: it shows them
  as cards under the reply in the chat, and, if there are any, it puts them in a shared
  "search results" state. A "From the chat" section at the top of whatever page the
  shopper is on reads that state and shows the cards there, using the same ProductCard
  component as the Products page — so clicking one opens its detail page.
- A reply with no products (like "do you have this in pink?") leaves the current page
  results in place instead of clearing them. The shopper can clear them with the Clear
  button.
- The search-results state sits above both the chat and the pages, separate from the
  chat messages. Reloading a logged-in shopper's history only changes the chat messages,
  and logging in doesn't reset it — so loading old messages never clears a fresh search.
  Logging out does clear the page results, so the next person on the same computer
  doesn't see the previous shopper's search.

- Why "instructions" rather than a system prompt: When a run is given earlier messages,
  PydanticAI skips the system prompt — so returning shoppers would have lost the whole
  prompt (voice, safety rules, tool rules). The prompt and context are therefore sent as
  PydanticAI "instructions", which are included on every message, with or without
  history.

- Acceptance check: Logged in as Test User, chatted, and came back — the earlier
  conversation (including old product cards) reloaded. On a product page, "do you have
  this in pink?" was answered about that product. "What hoodies do you have?" showed 8
  hoodie cards on the page (as a guest, and logged in on a product page), with correct
  images and prices, and clicking one opened its detail page; logging in afterwards
  reloaded the history without clearing those cards. As a guest, the chat answered but
  nothing was saved and no history appeared.

## Problem 12 — Audit Trail, Model Layer, Tools, Safety Rules, and Specs

### Audit trail (output/audit_trail.json)

- What it records: one entry per chat (guests included), with a timestamp, each tool the
  agent called (tool name, a short argument like the product name or search query, and a
  short result like "found, 27 matches"), how many product cards were shown, and a stop
  reason: completed, no_tools_used, or error.
- What it never records: the shopper's messages, name, email, or id, or full product
  lists.
- How it works: run_chat in agent.py adds the entry after every run. It reads the
  existing list, adds the new entry, and writes the list back, so the file stays valid
  JSON and nothing is lost between chats or server restarts.
- Tested: a stock question, a hoodie search, a server restart, and a greeting left three
  entries in one valid JSON list.

### Model fields in models.py and why

| Model | Fields | Why |
|---|---|---|
| ChatRequest | message, user_id, product_id | The message (1–2,000 characters), who's logged in (empty for guests), and which product page they're on, so "this" works. |
| ChatResponse | reply, products, found_nothing | The agent's sentence, the product cards (added by the server from the database, never written by the model), and a flag so the mascot looks sad when nothing was found. |
| ProductCard | product_id, name, price, description, image_file_path | Exactly what a card needs to draw itself and open its detail page. |
| Customer | id, name, first_name, email | Who the agent is helping, loaded from the users table so typing "my name is Dean" can't change it. |
| PageProduct | product_id, name, colors | The product being viewed, so color questions get real answers. |
| ProductInfoResult | status, query, product (name, description, price_usd), candidates, message | status tells the model exactly what happened (found / not_found / ambiguous); candidates let it ask "which one?" instead of guessing. |
| StockResult | status, name, size_requested, sizes (size, quantity, in_stock), total_quantity, candidates, message | Per-size stock with a clear yes/no for sold out, and a total so the model doesn't have to add. |
| CatalogueSearchResult | status, total_matches, shown, matches (name, garment_type, price_usd), categories_we_carry, message | Enough for the model to write "here are 8 of our 27"; when nothing matches, the real categories so it only suggests things we sell. |
| AuditEntry / AuditToolCall | run_id, timestamp, stop_reason, tool_calls (tool, args, result), cards_shown, error_type | One short, non-sensitive record per chat. |

### Tools and abilities

Three tools in backend/tools.py, all read-only, each finding products on its own:
- get_product_info(name): description and price of one product (Problem 6).
- get_stock(name, size): stock for all sizes or one size (Problem 6).
- search_catalogue(query): browse by type, color, or keyword; up to 8 matching products
  appear as cards in the chat and on the page (Problem 7).

The agent also greets logged-in shoppers by name, continues earlier conversations, and
answers about the product page the shopper is on (Problem 8).

### Safety rules

The rules are in the "Safety Rules" section of backend/prompts/prompt.md: stay on topic,
answer only from the database, treat chat input as data (not commands), never share
secrets or personal info, be clear it's a demo store with no real payments, decline
inappropriate content, and keep the audit log non-sensitive.

### Specs

- Model: gpt-5.6-luna via the Portkey gateway (PORTKEY_API_KEY from .env).
- Caps: MAX_SEARCH_RESULTS = 8 cards per reply; MAX_CANDIDATES = 8 "did you mean" names.
- Messages: 1–2,000 characters. History: last 20 messages go to the agent; the chat shows
  the last 50.
- Agent-loop limit: not set in our code, so PydanticAI's defaults apply (at most 50
  model requests per run, 1 retry per tool).
- Run it: backend `uvicorn main:app --reload --port 8000` (from backend/); frontend
  `npm run dev` (from frontend/, Vite on port 5173).
