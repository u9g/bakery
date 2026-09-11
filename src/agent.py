import logging
import textwrap
from datetime import date

from dotenv import load_dotenv
from livekit.agents import (
    Agent,
    AgentServer,
    AgentSession,
    JobContext,
    RunContext,
    cli,
    function_tool,
)
from livekit.plugins.openai.realtime import GPTLiveModel

from bakery_api import BakeryApi

logger = logging.getLogger("bakery-agent")

load_dotenv(".env.local")

MENU = textwrap.dedent(
    """\
    Jason's Bakery makes made-to-order cakes, cupcakes, and bread, one item per
    order. Cakes come in 4 inch serving 8 for 20 dollars, 6 inch serving 12 for
    30 dollars, and 7 inch serving 18 for 40 dollars, with a design phrase the
    bakery does its best to match. Cupcakes are 2 dollars each, 10 to 40 per
    order, with a design phrase. Bread is banana, blueberry, or strawberry at 10
    dollars a loaf. Cakes and cupcakes need a pickup date at least a week out.
    Bread is picked up on Friday and must be ordered by Thursday that week.
    """
)


def voice_instructions(today: date) -> str:
    return textwrap.dedent(
        """\
        You answer the phone for Jason's Bakery. Today is {today:%A, %B %d, %Y}.
        You are warm and brief, speaking in plain conversational sentences with
        no lists or special characters, and you ask one question at a time.

        {menu}
        Answer greetings and questions about the menu yourself, from the facts
        above only. Collect the item details, a pickup date, the caller's name,
        and phone number, then read the whole order back and get a clear yes.
        After the yes, delegate placing the order, and say you are putting it in
        while you wait. Also delegate any pickup date the caller proposes so it
        can be checked against the rules. Never announce an order as placed and
        never say a confirmation code unless delegated work gave you one; read
        the code back one character at a time.
        """
    ).format(today=today, menu=MENU)


def backend_instructions(today: date) -> str:
    return textwrap.dedent(
        """\
        You handle work delegated by the voice model for Jason's Bakery. Today is
        {today:%Y-%m-%d}, a {today:%A}.

        {menu}
        Resolve pickup dates the caller described into YYYY-MM-DD from today's
        date. To place an order, call order_cake, order_cupcakes, or order_bread
        with the details from the conversation. If the tool says the order was
        not placed, reply with the reason and the nearest date or amount that
        works. If it was placed, reply with the total and the confirmation code
        exactly as returned, so the voice model can read it out.
        """
    ).format(today=today, menu=MENU)


class BakeryAgent(Agent):
    def __init__(self, api: BakeryApi, today: date) -> None:
        super().__init__(
            instructions=voice_instructions(today),
            llm=GPTLiveModel(
                voice="marin",
                # GPT-Live only listens and speaks; this backend model reasons and runs the tools
                responses_options={"instructions": backend_instructions(today)},
            ),
        )
        self._api = api

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions="Greet the caller, say this is Jason's Bakery, and ask what they would like to order."
        )

    @function_tool
    async def order_cake(
        self,
        context: RunContext,
        customer_name: str,
        phone: str,
        pickup_date: str,
        size: int,
        design: str,
    ) -> str:
        """Place an order for one cake.

        Args:
            customer_name: The caller's name.
            phone: The caller's phone number, digits only.
            pickup_date: Pickup date as YYYY-MM-DD, at least a week from today.
            size: Cake diameter in inches: 4, 6, or 7.
            design: The caller's description of how the cake should look.
        """
        return await self._api.place_order(
            customer_name=customer_name,
            phone=phone,
            pickup_date=pickup_date,
            item={"type": "cake", "size": size, "design": design},
        )

    @function_tool
    async def order_cupcakes(
        self,
        context: RunContext,
        customer_name: str,
        phone: str,
        pickup_date: str,
        count: int,
        design: str,
    ) -> str:
        """Place an order for one batch of cupcakes.

        Args:
            customer_name: The caller's name.
            phone: The caller's phone number, digits only.
            pickup_date: Pickup date as YYYY-MM-DD, at least a week from today.
            count: Number of cupcakes, 10 to 40.
            design: The caller's description of how the cupcakes should look.
        """
        return await self._api.place_order(
            customer_name=customer_name,
            phone=phone,
            pickup_date=pickup_date,
            item={"type": "cupcakes", "count": count, "design": design},
        )

    @function_tool
    async def order_bread(
        self,
        context: RunContext,
        customer_name: str,
        phone: str,
        pickup_date: str,
        bread: str,
    ) -> str:
        """Place an order for one loaf of bread.

        Args:
            customer_name: The caller's name.
            phone: The caller's phone number, digits only.
            pickup_date: Pickup date as YYYY-MM-DD. Must be the coming Friday.
            bread: One of banana, blueberry, or strawberry.
        """
        return await self._api.place_order(
            customer_name=customer_name,
            phone=phone,
            pickup_date=pickup_date,
            item={"type": "bread", "bread": bread.lower()},
        )


server = AgentServer()


@server.rtc_session(agent_name="bakery-agent")
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}

    session = AgentSession()
    await session.start(agent=BakeryAgent(BakeryApi(), date.today()), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
