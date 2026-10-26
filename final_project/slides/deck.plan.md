# Deck plan

Theme: dark
Audience / time: MGT 409 teaching staff and class, ~3 minutes
One-line pitch: Ask an AI analyst how your launch landed online, for the cost of your own API key.

## Slides

### 1. Perspectives
- Points: one-line pitch; Hanna Endrias
- Visual: none (title slide)
- Numbers: none

### 2. Small businesses use AI to market, but can't see what it did
- Points: also creators; 36.2M U.S. small businesses, 82% no employees (SBA)
- Visual: stats
- Numbers: 58% use generative AI, up from 23% in 2023 (U.S. Chamber 2025); 74% used no tool to measure online marketing (Thrive Analytics 2016, via Search Engine Land); Brand24 $199+/month (billed yearly)

### 3. Open source, event-based, and you just ask
- Points: your model, your key (one config file); around an event; any subject; a chat analyst
- Visual: cards (2x2)
- Numbers: none

### 4. A fetch agent stores, an analyst answers
- Points: none
- Visual: diagram — owner → fetch agent → web search → SQLite mentions; owner → analyst agent → 11 tools (data: mentions · sentiment · themes · sources; actions: chart · fetch plan · saved criteria) → visualizer LLM → sandboxed chart; fetch plan → confirm card → fetch agent (owner clicks); gpt-6-luna via Portkey
- Numbers: none

### 5. Backfill a launch window in one run
- Points: Friend around its NYC subway ads
- Visual: screenshot — fetch-runs
- Numbers: 12 weekly searches, 50 mentions (db/fixtures/subjects/friend.json)

### 6. Ask in plain words, get a chart of your data
- Points: the analyst calls its tools and draws a weekly chart
- Visual: screenshot — chat-chart
- Numbers: none

### 7. A 12-week backfill costs 7 cents
- Points: cadence experiment, daily vs weekly on the same launch week
- Visual: stats
- Numbers: 7¢ fetch (622K input / 55K cached / 24K output); <1¢ per chart question, 50% of chat input cached; 14¢ per owner per month, ~$14/month for 100 owners; experiment daily 2.25¢ vs weekly 0.76¢ on Portkey, 7 mentions each; prices fitted to Portkey logs ($0.10 in / $0.01 cached / $0.50 out per 1M)

### 8. Web content is data, never instructions
- Points: injection refused; tools scoped server-side; no-network chart sandbox; unstored URLs flagged ⚠
- Visual: screenshot — safety-injection, plus four one-word cards
- Numbers: none

### 9. A launch read-out for a dime
- Points: none
- Visual: stats
- Points: user test with a Malleable AI co-founder (docs/user-test/summary.md): 0 mentions, the firm markets only on LinkedIn, which web search can't reach; bias caveat (the tester knows me personally)
- Numbers: ~10¢ per launch read-out vs $199+/month (Brand24); ~4 min from a new tracker to an answer, 4¢ for the whole test; "before" quote: "We don't really have any tools to capture the impact."; Friend 12 weeks, 50 mentions

### 10. From backfill to always-ready
- Points: hosted bring-your-own-key version with a budget cap; weekly digest (scheduled fetches); reply inbox; close with "Thank you. Questions?"
- Visual: cards
- Numbers: none

## Screenshots needed
| Name | Page | UI state |
|---|---|---|
| fetch-runs | Friend seeded chat → side panel → Fetches tab | Seeded weekly run with mention count and token cost |
| chat-chart | Friend seeded chat | Sentiment chart fully visible, no new messages |
| safety-injection | reused from .devloop/screenshots/step6-chat/03-injection-test.jpg (kept: the injected review isn't in the seed data, so it can't be re-shot without a new fetch) | Analyst refusing the injected review |
