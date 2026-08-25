from app.config import Settings
from app.providers.anthropic_provider import AnthropicChatProvider
from app.providers.base import ChatProvider


class UnsupportedProviderError(RuntimeError):
    """Raised when configuration selects a provider without an implementation."""


def build_chat_provider(settings: Settings) -> ChatProvider:
    """Build the configured chat provider or raise for unsupported providers."""
    if settings.ai_chat_provider == "anthropic":
        return AnthropicChatProvider(settings)

    raise UnsupportedProviderError(
        "Only anthropic provider is implemented in phase 1. Set AI_CHAT_PROVIDER=anthropic."
    )
