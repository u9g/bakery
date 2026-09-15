# bakery-agent

Phone ordering voice agent for Jason's Bakery. Talks to the API in `../api`
and runs on OpenAI GPT-Live through LiveKit Agents.

```sh
cp .env.example .env.local   # fill in LiveKit and OpenAI keys
uv sync
(cd ../api && npm run dev)   # API on :3099
uv run src/agent.py console  # or `dev` for the web console
uv run pytest
lk agent simulate --scenarios scenarios.yaml
```
