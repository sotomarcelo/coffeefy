import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_jwt_authentication():
    User.objects.create_user(username="barista", password="cafe1234")
    client = APIClient()

    response = client.post(
        "/api/token/",
        {"username": "barista", "password": "cafe1234"},
        format="json",
    )

    assert response.status_code == 200
    assert "access" in response.data
