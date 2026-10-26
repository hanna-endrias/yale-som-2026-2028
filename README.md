# yale-som-2026-2028

Coursework for Yale SOM.

## Final project — Perspectives (MGT 409)

All final project code is in the [`final_project/`](final_project/) folder. **Perspectives**
lets a small business owner, founder or creator ask how a launch landed online, for about
10 cents per read-out on their own API key instead of a $199+/month listening tool. It is a
Next.js app with two agents: a Fetch Agent that web-searches for mentions of a business,
brand or handle in each daily, weekly or monthly window and stores them with sources and
sentiment, and an Analyst Agent that answers chat questions over those stored mentions with
cited links and sandboxed charts.

- Report: [`final_project/report.html`](final_project/report.html) (download and open in a
  browser)
- Slides: [`final_project/slides.html`](final_project/slides.html) (same)
- Product and design docs: [`final_project/docs/PRODUCT.md`](final_project/docs/PRODUCT.md),
  [`final_project/docs/ARCHITECTURE.md`](final_project/docs/ARCHITECTURE.md)

To get it:

```bash
git clone https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028/final_project
```

Then follow [`final_project/README.md`](final_project/README.md) to add the `.env` with
`PORTKEY_API_KEY`, install and run the app. It starts with seeded trackers and a test
login, so no tokens are spent until you fetch or chat.

To download only the `final_project` folder instead of the whole repo:

```bash
git clone --filter=blob:none --sparse https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028
git sparse-checkout set final_project
cd final_project
```

## HW4 — Campus Customs (MGT 409)

All HW4 code is in the [`hw4/`](hw4/) folder: a React + Vite TypeScript website with a
FastAPI backend and a PydanticAI shopping assistant.

To get it:

```bash
git clone https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028/hw4
```

Then follow [`hw4/README.md`](hw4/README.md) to place the data pack and run the backend
and frontend.

To download only the `hw4` folder instead of the whole repo:

```bash
git clone --filter=blob:none --sparse https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028
git sparse-checkout set hw4
cd hw4
```

## HW5 — Campus Customs Multi-Agent Operations (MGT 409)

All HW5 code is in the [`hw5/`](hw5/) folder: an MCP server over the shop database, a
FastAPI backend running a five-agent PydanticAI team (Boss, Inventory, Accounting,
Facilities, Customer Service), and a React + Vite TypeScript board where a person watches
the agents and approves any payment.

To get it:

```bash
git clone https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028/hw5
```

Then follow [`hw5/README.md`](hw5/README.md) to install, make a clean copy of the database,
and run the MCP server, backend, and board.

To download only the `hw5` folder instead of the whole repo:

```bash
git clone --filter=blob:none --sparse https://github.com/hanna-endrias/yale-som-2026-2028.git
cd yale-som-2026-2028
git sparse-checkout set hw5
cd hw5
```
