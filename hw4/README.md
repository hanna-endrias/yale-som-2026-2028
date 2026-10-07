# Campus Customs

An (unofficial, for-educational-use) Yale merch store: a React + Vite TypeScript website
with a FastAPI backend and a PydanticAI shopping assistant. Shoppers can browse and filter
products, create an account, and chat with a bulldog assistant that answers price and
stock questions from the real database and shows matching products as cards.

## What you need

- Python 3.12 or newer
- Node.js 20 or newer (includes npm)
- A Portkey API key (the assistant calls OpenAI's `gpt-5.6-luna` through Portkey)
- The data pack: `campus_customs.db` and the `products/` image folder (not in this repo)

## 0. Get the code

This project lives in the `hw4/` folder of the repo:

```bash
git clone https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028/hw4
```

All the steps below run from this `hw4/` folder.

## 1. Place the data pack

Put the data pack in a `data/` folder at the top level of the project:

```
hw4/
|-- data/
|   |-- campus_customs.db
|   `-- products/          # product images (e.g. products/basic-hoodie-big-yale.jpg)
|-- backend/
|-- frontend/
`-- ...
```

The folder must be named `data` and sit next to `backend/` and `frontend/`. The backend
reads the database from there and serves the images from `data/products/`. The
`data/` folder is in `.gitignore`, so it never gets committed.

## 2. Add your API key

Copy `.env.example` to `.env` in the project folder and put in your key:

```
PORTKEY_API_KEY=your-real-key
```

The website still loads products and accounts without a key; only the chat assistant
needs it.

## 3. Run the backend (FastAPI, port 8000)

From the project folder, create a virtual environment and install the packages (first
time only):

```bash
python -m venv .venv
```

Activate it. Windows (PowerShell):

```bash
.venv\Scripts\Activate.ps1
```

macOS / Linux:

```bash
source .venv/bin/activate
```

Install the packages:

```bash
pip install -r requirements.txt
```

Then start the backend from the `backend/` folder:

```bash
cd backend
uvicorn main:app --reload --port 8000
```

Leave this terminal running. You can check it at http://localhost:8000/api/products.

## 4. Run the frontend (Vite, port 5173)

In a second terminal, from the `frontend/` folder:

```bash
cd frontend
npm install
npm run dev
```

(`npm install` is only needed the first time.) Then open **http://localhost:5173**.

The two servers run separately: the website on port 5173 calls the backend on port 8000.
To point the website at a different backend address, set `VITE_API_URL` in
`frontend/.env.local`.

## Trying it out

- Browse **Products**, filter by category, search, and sort; click a card for sizes and
  stock.
- Open the chat (bottom-right) and try "what hoodies do you have?" or "how much is the
  Yale vs Harvard shirt and do you have it in L?".
- Log in with the test account in the data pack, `test@campuscustoms.yale.edu` /
  `password`, or create your own account. Logged-in chats are saved and reload when
  you come back.

## Troubleshooting

- **Products don't load / "Is the backend running?"**: start the backend first, and
  check that `data/campus_customs.db` is in place.
- **The chat says the assistant is unavailable**: check `PORTKEY_API_KEY` in `.env`,
  then restart the backend.
- **A backend code change doesn't take effect**: on Windows, `--reload` sometimes gets
  stuck after "Reloading...". Stop the backend with Ctrl+C and start it again.
- **A frontend change doesn't show up**: stop `npm run dev` with Ctrl+C and start it
  again.

## Project files

- `backend/`: FastAPI app (`main.py`) and the agent (`agent.py`, `tools.py`,
  `models.py`, `prompts/prompt.md`)
- `frontend/`: the React + Vite TypeScript website
- `output/`: write-ups (`harness.md`, `design.md`, `usability.md`), the app check page
  (`app_check.html` with `app_check_images/`), and the agent's `audit_trail.json`
- `AI_prompts.md`: the prompts used to build this project
