from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    """Declarative registry base shared by all SQLAlchemy models."""

    pass
