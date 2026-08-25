from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.product import Product


class ProductRepository:
    """Persist and query relational product catalog records."""

    def __init__(self, session: Session) -> None:
        """Bind repository operations to a caller-managed SQLAlchemy session."""
        self.session = session

    def create(self, entity: Product) -> Product:
        """Stage and flush a new or updated product entity."""
        self.session.add(entity)
        self.session.flush()
        return entity

    def find_by_product_id(self, product_id: str) -> Product | None:
        """Find one product by its source catalog identifier."""
        stmt = select(Product).where(Product.product_id == product_id)
        return self.session.scalars(stmt).first()

    def find_all_order_by_created_at_desc(self) -> list[Product]:
        """Return products from newest creation timestamp to oldest."""
        stmt = select(Product).order_by(Product.created_at.desc())
        return list(self.session.scalars(stmt).all())

    def delete_by_product_id(self, product_id: str) -> int:
        """Delete products matching a source catalog identifier."""
        result = self.session.execute(delete(Product).where(Product.product_id == product_id))
        return int(result.rowcount or 0)
