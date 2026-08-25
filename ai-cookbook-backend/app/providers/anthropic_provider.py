from anthropic import AsyncAnthropic

from app.config import Settings


class AnthropicChatProvider:
    """Anthropic Messages API adapter used by the release-one backend."""

    name = "anthropic"

    def __init__(self, settings: Settings) -> None:
        """Validate credentials and create an Anthropic client from settings."""
        if not settings.anthropic_api_key:
            raise RuntimeError("ANTHROPIC_API_KEY is required for anthropic provider")

        self.model = settings.anthropic_model
        self.temperature = settings.anthropic_temperature
        self.client = AsyncAnthropic(api_key=settings.anthropic_api_key)

    async def generate_text(
        self,
        message: str,
        system_prompt: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Generate text and concatenate all text blocks in the model response."""
        response = await self.client.messages.create(
            model=self.model,
            temperature=temperature if temperature is not None else self.temperature,
            max_tokens=max_tokens if max_tokens is not None else 1000,
            system=system_prompt or "",
            messages=[{"role": "user", "content": message}],
        )

        text_chunks = [
            block.text
            for block in response.content
            if hasattr(block, "type") and block.type == "text"
        ]
        return "".join(text_chunks).strip()
