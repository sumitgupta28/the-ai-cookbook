from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.repositories.product_repository import ProductRepository
from app.schemas import DeleteResponse, ProductRead, ProductUploadResponse
from app.services import ProductService

router = APIRouter(prefix="/products", tags=["products"])


def serialize_product(row) -> dict:
    """Convert a product model to the public camel-case representation."""
    return {
        "id": row.id,
        "productId": row.product_id,
        "name": row.name,
        "category": row.category,
        "brand": row.brand,
        "description": row.description,
        "price": float(row.price),
        "imageUrl": row.image_url,
        "rating": float(row.rating) if row.rating is not None else None,
        "stockCount": row.stock_count,
        "createdAt": row.created_at,
        "updatedAt": row.updated_at,
    }


@router.get("", response_model=list[ProductRead])
def list_products(session: Session = Depends(get_db)):
    """List catalog products ordered from newest to oldest."""
    return ProductRepository(session).find_all_order_by_created_at_desc()


@router.post("/upload", response_model=ProductUploadResponse)
def upload_products(file: UploadFile = File(...), session: Session = Depends(get_db)):
    """Import catalog rows from an XLSX upload and synchronize vectors."""
    result = ProductService(session, get_settings()).ingest_products_xlsx(file.file.read())
    return result


@router.get("/search", response_model=list[ProductRead])
def search_products(
    query: str,
    topK: int = Query(default=10, ge=1, le=50),
    threshold: float = Query(default=0.0, ge=0.0, le=1.0),
    session: Session = Depends(get_db),
):
    """Return products ranked by semantic similarity to the query."""
    return ProductService(session, get_settings()).search_products(query, topK, threshold)


@router.get("/verify")
def verify_products(session: Session = Depends(get_db)):
    """Inspect product vectors and return product store health details."""
    rows = session.execute(
        text("SELECT content, metadata FROM product_vector_store ORDER BY id")
    ).all()
    products = [
        {
            "productId": str((row[1] or {}).get("product_id", "")),
            "name": (row[0] or "")[:120],
            "embeddingPreview": (row[0] or "")[:180],
        }
        for row in rows
    ]
    return {"status": "ok", "productCount": len(products), "products": products}


@router.delete("/{product_id}", response_model=DeleteResponse)
def delete_product(product_id: str, session: Session = Depends(get_db)):
    """Delete a product and its corresponding product vector."""
    session.execute(
        text("DELETE FROM product_vector_store WHERE metadata->>'product_id' = :product_id"),
        {"product_id": product_id},
    )
    if ProductRepository(session).delete_by_product_id(product_id) == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    return {"deleted": True}
