from app.config import Settings
from app.providers.anthropic_provider import AnthropicChatProvider
from app.providers.base import ChatProvider


def build_chat_provider(settings: Settings) -> ChatProvider:
    """Build the configured Anthropic chat provider."""
    return AnthropicChatProvider(settings)
