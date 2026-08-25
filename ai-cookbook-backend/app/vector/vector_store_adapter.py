import json
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Any, cast

from sqlalchemy import text
from sqlalchemy.orm import Session


@dataclass
class VectorSearchHit:
    """A pgvector result containing metadata, distance, and derived similarity."""

    id: str
    content: str | None
    metadata: dict
    distance: float

    @property
    def similarity(self) -> float:
        """Return cosine similarity derived from pgvector distance."""
        return 1.0 - self.distance


class VectorStoreAdapter:
    """Provide document and product vector operations over separate pgvector tables."""

    def __init__(self, session: Session) -> None:
        """Bind vector operations to a caller-managed database session."""
        self.session = session

    @staticmethod
    def _to_vector_literal(values: Sequence[float]) -> str:
        """Format numeric embedding values for PostgreSQL vector casting."""
        return "[" + ",".join(str(float(v)) for v in values) + "]"

    @staticmethod
    def max_distance_from_similarity_threshold(similarity_threshold: float) -> float:
        """Convert a similarity threshold to the cosine distance query bound."""
        threshold = max(0.0, min(1.0, similarity_threshold))
        return 1.0 - threshold

    def add_document_vector(self, content: str, metadata: dict, embedding: Sequence[float]) -> None:
        """Insert one embedded document chunk into the document vector table."""
        query = text(
            """
            INSERT INTO vector_store (content, metadata, embedding)
            VALUES (:content, CAST(:metadata AS json), CAST(:embedding AS vector))
            """
        )
        self.session.execute(
            query,
            {
                "content": content,
                "metadata": json.dumps(metadata),
                "embedding": self._to_vector_literal(embedding),
            },
        )

    def add_product_vector(self, content: str, metadata: dict, embedding: Sequence[float]) -> None:
        """Insert one embedded product description into the product vector table."""
        query = text(
            """
            INSERT INTO product_vector_store (content, metadata, embedding)
            VALUES (:content, CAST(:metadata AS json), CAST(:embedding AS vector))
            """
        )
        self.session.execute(
            query,
            {
                "content": content,
                "metadata": json.dumps(metadata),
                "embedding": self._to_vector_literal(embedding),
            },
        )

    def similarity_search(
        self,
        table_name: str,
        embedding: Sequence[float],
        top_k: int,
        max_distance: float,
    ) -> list[VectorSearchHit]:
        """Search a validated vector table ordered by ascending distance."""
        query = text(
            f"""
            SELECT id,
                   content,
                   metadata,
                   (embedding <=> CAST(:embedding AS vector)) AS distance
            FROM {table_name}
            WHERE (embedding <=> CAST(:embedding AS vector)) <= :max_distance
            ORDER BY distance ASC
            LIMIT :top_k
            """
        )

        rows = self.session.execute(
            query,
            {
                "embedding": self._to_vector_literal(embedding),
                "max_distance": max_distance,
                "top_k": top_k,
            },
        ).all()

        return [
            VectorSearchHit(
                id=str(row[0]),
                content=row[1],
                metadata=row[2] if isinstance(row[2], dict) else {},
                distance=float(row[3]),
            )
            for row in rows
        ]

    def delete_document_vectors_by_filename(self, filename: str) -> int:
        """Delete document chunks identified by their filename metadata."""
        query = text("DELETE FROM vector_store WHERE metadata->>'filename' = :filename")
        result = cast(Any, self.session.execute(query, {"filename": filename}))
        return int(result.rowcount or 0)

    def delete_product_vectors_by_product_id(self, product_id: str) -> int:
        """Delete product vectors identified by their source product identifier."""
        query = text("DELETE FROM product_vector_store WHERE metadata->>'product_id' = :product_id")
        result = cast(Any, self.session.execute(query, {"product_id": product_id}))
        return int(result.rowcount or 0)

    def search_document_vectors(
        self,
        embedding: Sequence[float],
        top_k: int,
        max_distance: float,
    ) -> list[VectorSearchHit]:
        """Search the document vector table."""
        return self.similarity_search(
            table_name="vector_store",
            embedding=embedding,
            top_k=top_k,
            max_distance=max_distance,
        )

    def search_product_vectors(
        self,
        embedding: Sequence[float],
        top_k: int,
        max_distance: float,
    ) -> list[VectorSearchHit]:
        """Search the product vector table."""
        return self.similarity_search(
            table_name="product_vector_store",
            embedding=embedding,
            top_k=top_k,
            max_distance=max_distance,
        )
