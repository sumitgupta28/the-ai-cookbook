import math
import re
from hashlib import blake2b

from app.config import Settings


class EmbeddingService:
    """
    Lightweight deterministic embedding service for Phase 3.
    Produces fixed-size vectors (default 384 dims) for local development.
    """

    TOKEN_PATTERN = re.compile(r"\w+")

    def __init__(self, settings: Settings) -> None:
        """Configure the output vector dimension from application settings."""
        self.dimensions = settings.embedding_dimensions

    def embed(self, text: str) -> list[float]:
        """Create a deterministic normalized vector from the input tokens."""
        vector = [0.0] * self.dimensions
        tokens = self.TOKEN_PATTERN.findall((text or "").lower())
        if not tokens:
            return vector

        for token in tokens:
            digest = blake2b(token.encode("utf-8"), digest_size=8).digest()
            value = int.from_bytes(digest, byteorder="big", signed=False)
            idx = value % self.dimensions
            sign = -1.0 if (value & 1) else 1.0
            weight = 1.0 + ((value >> 8) % 100) / 100.0
            vector[idx] += sign * weight

        norm = math.sqrt(sum(v * v for v in vector))
        if norm == 0:
            return vector
        return [v / norm for v in vector]
