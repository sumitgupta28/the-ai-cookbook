from app.main import app


def test_public_routes_are_screen_oriented_and_phase_free():
    paths = {route.path for route in app.routes}

    expected = {
        "/ai/chat/string",
        "/rag/context",
        "/rag/search",
        "/rag/ai/chat/string/client",
        "/rag/memory/conversations",
        "/documents",
        "/products",
        "/tool/ai/chat/string",
        "/structured/extract",
        "/chunking/analyze",
    }

    assert expected <= paths
    assert not any("/phase2" in path or "/phase3" in path for path in paths)


def test_document_static_routes_precede_parameter_route():
    paths = [route.path for route in app.routes]
    assert paths.index("/documents/verify") < paths.index("/documents/{document_id}")
