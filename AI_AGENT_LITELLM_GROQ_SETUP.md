# LiteLLM + Groq Setup

## Env Variables
- `GROQ_API_KEY=`
- `LITELLM_MASTER_KEY=`
- `LITELLM_BASE_URL=http://litellm:4000/v1`
- `LITELLM_API_KEY=<litellm-master-or-virtual-key>`
- `DEFAULT_CHAT_MODEL=groq/llama-3.3-70b-versatile`

## Compose Notes
- Add `litellm` service in compose
- Expose internal `4000`
- Mount config if needed (`config.yaml`)
- FastAPI should call `http://litellm:4000/v1`

## FastAPI Client Pattern
```python
from openai import OpenAI

client = OpenAI(
    api_key=settings.LITELLM_API_KEY,
    base_url=settings.LITELLM_BASE_URL,
)
```

## Call Pattern
- Send system prompt + scoped context + last 10 messages
- Model defaults to `DEFAULT_CHAT_MODEL`
- Persist model/provider/token metadata in `ai_chat_messages`

## Security
- Never expose Groq/LiteLLM keys to frontend
- Apply per-student rate limits and usage logging
