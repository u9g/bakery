# bakery-api

HTTP backend for the Jason's Bakery phone-ordering voice agent.

```sh
npm install
npm run dev      # http://localhost:3099
BAKERY_TODAY=2026-09-10 npm run dev   # pin the date the pickup rules are checked against
npm test
```

```sh
curl localhost:3099/menu
# {"cakes":[{"size":4,"serves":8,"price":20},{"size":6,"serves":12,"price":30},{"size":7,"serves":18,"price":40}],"cakeRules":"Tell us a design phrase. Order at least a week ahead.","cupcakes":{"min":10,"max":40,"pricePer":2,"rules":"Tell us a design phrase. Order at least a week ahead."},"breads":[{"type":"banana","price":10},{"type":"blueberry","price":10},{"type":"strawberry","price":10}],"breadRules":"Order by Thursday, pick up Friday of the same week."}

curl localhost:3099/orders -H 'content-type: application/json' \
  -d '{"customerName":"Ada Lovelace","phone":"555-010-0100","pickupDate":"2026-09-11","item":{"type":"bread","bread":"banana"}}'
# {"id":"0e0943f8-dd84-44d7-a7a0-3135e1af8c75","confirmationCode":"5JRET9","customerName":"Ada Lovelace","phone":"555-010-0100","pickupDate":"2026-09-11","item":{"type":"bread","bread":"banana"},"price":10,"createdAt":"2026-09-15T14:58:56.238Z"}

curl localhost:3099/orders
# [{"id":"0e0943f8-dd84-44d7-a7a0-3135e1af8c75","confirmationCode":"5JRET9", ...}]

curl localhost:3099/orders/0e0943f8-dd84-44d7-a7a0-3135e1af8c75
# {"id":"0e0943f8-dd84-44d7-a7a0-3135e1af8c75","confirmationCode":"5JRET9", ...}
```
