import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.models import Local, Product, Order

User = get_user_model()


@pytest.mark.django_db
def test_client_can_place_order():
    client = APIClient()

    owner = User.objects.create_user(username="propietario", password="safe123", role="cafeteria")
    customer = User.objects.create_user(username="cliente", password="pass123", role="cliente")
    local = Local.objects.create(
        owner=owner,
        name="Café Patagonia",
        address="Santiago",
        description="Especialidad",
        type="cafeteria",
        points_rate=0.05,
    )
    product = Product.objects.create(
        local=local,
        name="Capuccino",
        description="Espuma sedosa",
        price="3000.00",
        product_type="bebida",
        state="normal",
    )

    client.force_authenticate(user=customer)

    data = {
        "local": local.id,
        "items_data": [
            {"product": product.id, "quantity": 2},
        ],
    }

    response = client.post("/api/orders/", data, format="json")

    assert response.status_code == 201
    order = Order.objects.get(id=response.data["id"])
    assert str(order.total) == "6000.00"
    assert order.user == customer
    assert order.status == Order.Status.PENDING
