from typing import Protocol


class ChatProvider(Protocol):
    """Protocol implemented by asynchronous text-generation providers."""

    name: str

    async def generate_text(
        self,
        message: str,
        system_prompt: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> str:
        """Generate text with optional system prompt and sampling overrides."""
        pass
