import os
from typing import Any

import httpx

DEFAULT_URL = "http://localhost:3000"


def spell(code: str) -> str:
    return " ".join(code)


class BakeryApi:
    """Client for the Bun API in ../api. Every method returns text the voice model can say."""

    def __init__(self, base_url: str | None = None) -> None:
        self._client = httpx.AsyncClient(
            base_url=base_url or os.environ.get("BAKERY_API_URL", DEFAULT_URL),
            timeout=10,
        )

    async def menu(self) -> str:
        menu = (await self._client.get("/menu")).raise_for_status().json()
        cakes = ", ".join(
            f"{c['size']} inch serves {c['serves']} for ${c['price']}"
            for c in menu["cakes"]
        )
        cup = menu["cupcakes"]
        breads = ", ".join(b["type"] for b in menu["breads"])
        return (
            f"Cakes: {cakes}. {menu['cakeRules']} "
            f"Cupcakes: {cup['min']} to {cup['max']} at ${cup['pricePer']} each. {cup['rules']} "
            f"Bread: {breads}, ${menu['breads'][0]['price']} a loaf. {menu['breadRules']}"
        )

    async def place_order(
        self, *, customer_name: str, phone: str, pickup_date: str, item: dict[str, Any]
    ) -> str:
        res = await self._client.post(
            "/orders",
            json={
                "customerName": customer_name,
                "phone": phone,
                "pickupDate": pickup_date,
                "item": item,
            },
        )
        body = res.json()
        if res.status_code != 201:
            return f"Order not placed: {body['error']}"
        return (
            f"Order placed for pickup on {body['pickupDate']}. Total ${body['price']}. "
            f"Confirmation code, spelled out: {spell(body['confirmationCode'])}"
        )
