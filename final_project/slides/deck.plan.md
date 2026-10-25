# Deck plan

Theme: dark
Audience / time: MGT 409 teaching staff and class, ~3 minutes
One-line pitch: Ask an AI analyst how your launch landed online, for the cost of your own API key.

## Slides

### 1. Perspectives
- Points: one-line pitch; Hanna Endrias
- Visual: none (title slide)
- Numbers: none

### 2. Launch read-outs cost an agency or a sales call
- Points: also creators and public figures
- Visual: stats
- Numbers: 36.2M U.S. small businesses, 82% no employees (SBA); ReviewTrackers ~$89/location/month (G2); Birdeye and Podium "Contact us" (G2)

### 3. Open source, event-based, and you just ask
- Points: bring your own key; around an event; any subject; a chat analyst
- Visual: cards (2x2)
- Numbers: none

### 4. A fetch agent stores, an analyst answers
- Points: none
- Visual: diagram — owner → fetch agent → web search → SQLite mentions; owner → analyst agent → 5 data tools → visualizer LLM → sandboxed chart; gpt-6-luna via Portkey
- Numbers: none

### 5. Backfill a launch window in one run
- Points: Friend around its NYC subway ads
- Visual: screenshot — fetch-runs
- Numbers: 12 weekly searches, 50 mentions (db/fixtures/friend.json)

### 6. Ask in plain words, get a chart of your data
- Points: the analyst calls its tools and draws a weekly chart
- Visual: screenshot — chat-chart
- Numbers: none

### 7. A 12-week backfill costs about a dollar
- Points: lever: coarser cadence = fewer searches
- Visual: stats
- Numbers: 646K tokens / ~$0.96 per fetch run; ~$0.10 per chat turn (5 turns, 221K tokens); TODO confirm gpt-6-luna prices in config/llm.ts

### 8. Web content is data, never instructions
- Points: injection refused; tools scoped server-side; no-network chart sandbox; unstored URLs flagged ⚠
- Visual: screenshot — safety-injection, plus four one-word cards
- Numbers: none

### 9. A launch read-out for the price of a coffee
- Points: none
- Visual: stats
- Numbers: ~$1 vs $89+/month; TODO time before vs after (real user); TODO user quote

### 10. From backfill to always-ready
- Points: scheduled fetches; platform APIs (Reddit, Yelp, X, Google Reviews); teams; close with "Thank you. Questions?"
- Visual: cards
- Numbers: none

## Screenshots needed
| Name | Page | UI state |
|---|---|---|
| fetch-runs | / → Friend ⋯ → Fetch runs | Seeded weekly run with mention count and token cost |
| chat-chart | Friend seeded chat | Sentiment chart fully visible, no new messages |
| safety-injection | reused from .devloop/screenshots/step6-chat/03-injection-test.jpg | Analyst refusing the injected review |
