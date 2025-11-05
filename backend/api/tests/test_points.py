import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.models import Local, PointBalance

User = get_user_model()


@pytest.mark.django_db
def test_points_accumulated_on_endpoints():
    client = APIClient()

    owner = User.objects.create_user(username="dueño", password="safe123", role="cafeteria")
    user = User.objects.create_user(username="cliente", password="pass123", role="cliente")
    local = Local.objects.create(
        owner=owner,
        name="Café Austral",
        address="Puerto Varas",
        description="Café y tostador",
        type="hibrido",
        points_rate=0.5,
    )

    client.force_authenticate(user=user)

    response = client.post(
        "/api/points/accumulate/",
        {"local": local.id, "amount": 10000},
        format="json",
    )

    assert response.status_code == 200
    assert response.data["earned"] == 5000

    record = PointBalance.objects.get(user=user, local=local)
    assert record.total == 5000
