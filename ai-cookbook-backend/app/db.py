from collections.abc import Generator
from contextlib import contextmanager

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from app.config import get_settings

settings = get_settings()

engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@contextmanager
def session_scope() -> Generator:
    """Yield a session and commit or roll back the complete unit of work."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def get_db() -> Generator:
    """Provide a request-scoped database session to FastAPI dependencies."""
    with session_scope() as session:
        yield session


def check_database_connection() -> None:
    """Raise when the configured PostgreSQL database cannot execute a query."""
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))


def check_pgvector_extension() -> None:
    """Raise when the target PostgreSQL database lacks the vector extension."""
    with engine.connect() as connection:
        result = connection.execute(
            text("SELECT 1 FROM pg_extension WHERE extname = 'vector' LIMIT 1")
        ).scalar()

    if result != 1:
        raise RuntimeError("pgvector extension is not installed in the target database")
