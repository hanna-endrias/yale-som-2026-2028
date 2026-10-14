"""The one model every Campus Customs agent uses: gpt-6-luna through Portkey."""

import os
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai.models.openai import OpenAIResponsesModel
from pydantic_ai.providers.openai import OpenAIProvider

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
MODEL_NAME = "gpt-6-luna"  # assignment rule: no other model, anywhere
PORTKEY_BASE_URL = "https://api.portkey.ai/v1"

load_dotenv(ENV_PATH)


def make_model() -> OpenAIResponsesModel:
    """OpenAI-compatible model that sends every request through the Portkey gateway.

    Uses the Responses API (/v1/responses): gpt-6-luna is served by Azure behind Portkey,
    and its Chat Completions endpoint rejects tool calls while reasoning is on.
    """
    api_key = os.getenv("PORTKEY_API_KEY")
    if not api_key:
        raise RuntimeError(f"PORTKEY_API_KEY is missing; add it to {ENV_PATH}")
    client = AsyncOpenAI(
        api_key=api_key,
        base_url=PORTKEY_BASE_URL,
        default_headers={"x-portkey-provider": "openai"},
    )
    return OpenAIResponsesModel(MODEL_NAME, provider=OpenAIProvider(openai_client=client))
