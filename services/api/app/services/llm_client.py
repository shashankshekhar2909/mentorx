from openai import OpenAI

from ..core.config import settings


class LiteLLMClient:
    def __init__(self) -> None:
        self.client = OpenAI(api_key=settings.litellm_api_key, base_url=settings.litellm_base_url)

    def chat_completion(self, messages: list[dict], model: str | None = None):
        return self.client.chat.completions.create(
            model=model or settings.default_chat_model,
            messages=messages,
            temperature=0.3,
        )


llm_client = LiteLLMClient()
