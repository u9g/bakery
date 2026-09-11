from datetime import date, timedelta

from bakery_api import BakeryApi

# The API rules are relative to its own clock; these dates are far enough out to
# stay valid: a Thursday nearly a year away.
FAR_THURSDAY = "2027-06-03"


async def test_menu_is_spoken_text(api_url):
    text = await BakeryApi(api_url).menu()
    assert "4 inch" in text and "$20" in text
    assert "10 to 40" in text and "$2" in text
    assert "banana" in text and "$10" in text


async def test_place_order_returns_confirmation_and_price(api_url):
    text = await BakeryApi(api_url).place_order(
        customer_name="Ada",
        phone="555-0100",
        pickup_date=FAR_THURSDAY,
        item={"type": "cake", "size": 6, "design": "dinosaur"},
    )
    assert "$30" in text
    assert "Confirmation code" in text
    # the code is spelled out so the voice model reads it letter by letter
    assert text.count(" ") >= 6


async def test_place_order_relays_validation_error(api_url):
    text = await BakeryApi(api_url).place_order(
        customer_name="Ada",
        phone="555-0100",
        pickup_date="2026-01-01",
        item={"type": "cake", "size": 6, "design": "dinosaur"},
    )
    assert text == "Order not placed: Cakes must be ordered at least a week ahead"


async def test_bread_order_for_the_coming_friday(api_url):
    today = date.today()
    ahead = (4 - today.weekday()) % 7  # 0 on a Friday, when the window has closed
    friday = today + timedelta(days=ahead or 7)
    text = await BakeryApi(api_url).place_order(
        customer_name="Ada",
        phone="555-0100",
        pickup_date=friday.isoformat(),
        item={"type": "bread", "bread": "banana"},
    )
    if ahead == 0:
        assert text.startswith("Order not placed")
    else:
        assert "$10" in text and "confirmation code" in text
