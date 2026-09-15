# bakery-api

HTTP backend for the Jason's Bakery phone-ordering voice agent.

```sh
npm install
npm run dev      # http://localhost:3099
BAKERY_TODAY=2026-09-10 npm run dev   # pin the date the pickup rules are checked against
npm test
```

Endpoints: `GET /menu`, `POST /orders`, `GET /orders`, `GET /orders/:id`.
