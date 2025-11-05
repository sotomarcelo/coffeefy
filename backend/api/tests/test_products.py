import pytest
from rest_framework.test import APIClient
from django.contrib.auth import get_user_model
from api.models import Local, Product, ProductCategory

User = get_user_model()


@pytest.mark.django_db
def test_create_product_requires_auth_and_local():
    client = APIClient()

    owner = User.objects.create_user(username="owner", password="pass123", role="cafeteria")
    local = Local.objects.create(
        owner=owner,
        name="Café Andes",
        address="Providencia",
        description="Cafetería de especialidad",
        type="cafeteria",
        points_rate=0.1,
    )

    client.force_authenticate(user=owner)

    bebidas, _ = ProductCategory.objects.get_or_create(
        slug="bebida",
        defaults={"name": "Bebidas", "tracks_stock": False},
    )

    data = {
        "local": local.id,
        "name": "Latte Doble",
        "description": "Latte con doble shot",
        "price": "3500.00",
        "category": bebidas.id,
        "state": "normal",
    }

    response = client.post("/api/products/", data, format="json")

    assert response.status_code == 201
    assert response.data["name"] == "Latte Doble"

    product = Product.objects.get(id=response.data["id"])
    assert product.local == local
    assert product.category == bebidas
    assert product.category.tracks_stock is False


@pytest.mark.django_db
def test_grain_product_requires_stock():
    client = APIClient()

    owner = User.objects.create_user(username="roaster", password="pass123", role="tostaduria")
    local = Local.objects.create(
        owner=owner,
        name="Tostaduría Sur",
        address="Santiago",
        description="Tueste diario",
        type="tostaduria",
        points_rate=0.2,
    )

    client.force_authenticate(user=owner)

    granos, _ = ProductCategory.objects.get_or_create(
        slug="grano",
        defaults={"name": "Granos", "tracks_stock": True},
    )

    response = client.post(
        "/api/products/",
        {
            "local": local.id,
            "name": "Grano Etiopía",
            "price": "8500.00",
            "category": granos.id,
            "state": "recien_tostado",
        },
        format="json",
    )

    assert response.status_code == 400
    assert "stock" in response.data

    response_ok = client.post(
        "/api/products/",
        {
            "local": local.id,
            "name": "Grano Colombia",
            "price": "9000.00",
            "category": granos.id,
            "state": "normal",
            "stock": 15,
        },
        format="json",
    )

    assert response_ok.status_code == 201
    bean = Product.objects.get(id=response_ok.data["id"])
    assert bean.stock == 15
