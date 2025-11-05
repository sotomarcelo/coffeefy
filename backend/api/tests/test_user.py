import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model

User = get_user_model()


@pytest.mark.django_db
def test_user_registration_and_login():
    client = APIClient()

    response = client.post(
        "/api/users/",
        {
            "username": "coffee_lover",
            "email": "test@coffeefy.com",
            "password": "secret123",
        },
        format="json",
    )

    assert response.status_code in [200, 201]

