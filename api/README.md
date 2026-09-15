# bakery-api

HTTP backend for the Jason's Bakery phone-ordering voice agent.

```sh
npm install
npm run dev      # http://localhost:3099
npm test
```

Set `BAKERY_TODAY=YYYY-MM-DD` to pin the date the pickup rules are checked against.

Endpoints: `GET /menu`, `POST /orders`, `GET /orders`, `GET /orders/:id`.
