from fastapi.testclient import TestClient

from app.main import app


def test_health_check_returns_200_and_up():
    with TestClient(app) as client:
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "UP"
        assert data["service"] == "messinsight-ml-service"
        assert "timestamp" in data
        assert "version" in data


