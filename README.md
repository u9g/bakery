# bakery

Jason's Bakery phone ordering, from the "My Bakery User Story" Notion page.

- `api/`: Node HTTP API holding the menu, order rules, and orders (sqlite).
- `agent/`: LiveKit Agents voice agent on OpenAI GPT-Live that takes orders over the phone and calls the API.

Set `BAKERY_TODAY=YYYY-MM-DD` in both processes to pin the date the pickup rules use; simulations rely on `2026-09-10`.
