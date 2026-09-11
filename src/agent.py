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

VOICE_INSTRUCTIONS = textwrap.dedent(
    """\
    You answer the phone for Jason's Bakery, which makes made-to-order cakes,
    cupcakes, and bread. You are warm, brief, and speak in plain conversational
    sentences with no lists, markdown, or special characters. Ask one question at
    a time. Spell out numbers and read confirmation codes one character at a time.
    """
)


def ordering_instructions(today: date) -> str:
    return textwrap.dedent(
        f"""\
        Today is {today.strftime("%A, %B %d, %Y")} ({today.isoformat()}).

        Take one order per call: a single cake, a single batch of cupcakes, or a
        single loaf of bread. Use get_menu if the caller asks what is available or
        how much things cost. Collect everything the order needs, including the
        caller's name and phone number, then read the whole order back and get a
        clear yes before calling an order tool. Never invent sizes, bread types, or
        prices that are not on the menu.

        Pickup dates go to the tools as YYYY-MM-DD. Cakes and cupcakes need a
        pickup date at least a week from today. Bread is picked up on Friday and
        must be ordered by Thursday of the same week. If a tool says the order was
        not placed, tell the caller the reason in your own words and offer the
        nearest date or amount that works.

        After a successful order, tell the caller the total and read the
        confirmation code back one character at a time.
        """
    )


class BakeryAgent(Agent):
    def __init__(self, api: BakeryApi) -> None:
        super().__init__(instructions=VOICE_INSTRUCTIONS)
        self._api = api

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions="Greet the caller, say this is Jason's Bakery, and ask what they would like to order."
        )

    @function_tool
    async def get_menu(self, context: RunContext) -> str:
        """Get everything the bakery sells, with sizes, prices, and ordering rules."""
        return await self._api.menu()

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

    session = AgentSession(
        llm=GPTLiveModel(
            voice="marin",
            # GPT-Live only listens and speaks; this backend model reasons and runs the tools
            responses_options={"instructions": ordering_instructions(date.today())},
        ),
    )

    await session.start(agent=BakeryAgent(BakeryApi()), room=ctx.room)


if __name__ == "__main__":
    cli.run_app(server)
