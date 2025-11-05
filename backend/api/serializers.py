from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from .models import (
    User,
    Local,
    Product,
    Order,
    OrderItem,
    Reward,
    PointBalance,
    Redemption,
    create_order_with_items,
)


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "role",
            "avatar_url",
            "is_barista",
            "password",
        ]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop("password", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class LocalSerializer(serializers.ModelSerializer):
    owner_name = serializers.ReadOnlyField(source="owner.username")

    class Meta:
        model = Local
        fields = [
            "id",
            "owner",
            "owner_name",
            "name",
            "description",
            "address",
            "schedule",
            "type",
            "points_rate",
            "qr_code_url",
            "created_at",
            "updated_at",
        ]


class ProductSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")

    class Meta:
        model = Product
        fields = [
            "id",
            "local",
            "local_name",
            "name",
            "description",
            "price",
            "product_type",
            "stock",
            "state",
            "is_active",
            "image_url",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        product_type = attrs.get("product_type", getattr(self.instance, "product_type", None))
        stock = attrs.get("stock", getattr(self.instance, "stock", None))

        if product_type == Product.Types.BEAN and stock is None:
            raise serializers.ValidationError({"stock": "El stock es obligatorio para productos tipo grano."})
        if product_type == Product.Types.BEVERAGE:
            attrs["stock"] = None
        return attrs


class OrderItemReadSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source="product.name")

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_name", "quantity", "unit_price"]


class OrderItemWriteSerializer(serializers.Serializer):
    product = serializers.PrimaryKeyRelatedField(queryset=Product.objects.filter(is_active=True))
    quantity = serializers.IntegerField(min_value=1)


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemReadSerializer(many=True, read_only=True)
    items_data = OrderItemWriteSerializer(many=True, write_only=True)
    user_name = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Order
        fields = [
            "id",
            "user_name",
            "local",
            "status",
            "total",
            "pickup_code",
            "created_at",
            "updated_at",
            "items",
            "items_data",
        ]
        read_only_fields = ("status", "total", "pickup_code", "created_at", "updated_at")

    def create(self, validated_data):
        items_data = validated_data.pop("items_data")
        local = validated_data["local"]
        user = self.context["request"].user

        order_items_payload = [
            {"product": item["product"], "quantity": item["quantity"]}
            for item in items_data
        ]

        try:
            order = create_order_with_items(user=user, local=local, items_data=order_items_payload)
        except ValueError as exc:
            raise serializers.ValidationError({"items_data": str(exc)}) from exc

        return order


class RewardSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")

    class Meta:
        model = Reward
        fields = [
            "id",
            "local",
            "local_name",
            "name",
            "description",
            "points_required",
            "image_url",
            "active",
            "created_at",
            "updated_at",
        ]


class PointBalanceSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")

    class Meta:
        model = PointBalance
        fields = ["id", "user", "local", "local_name", "total", "updated_at"]
        read_only_fields = ("updated_at",)


class RedemptionSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")
    reward_name = serializers.ReadOnlyField(source="reward.name")

    class Meta:
        model = Redemption
        fields = [
            "id",
            "user",
            "local",
            "reward",
            "description",
            "points_used",
            "local_name",
            "reward_name",
            "created_at",
        ]
        read_only_fields = ("created_at",)

    def validate(self, attrs):
        user = attrs.get("user")
        local = attrs.get("local")
        points_used = attrs.get("points_used")

        try:
            balance = PointBalance.objects.get(user=user, local=local)
        except PointBalance.DoesNotExist as exc:
            raise serializers.ValidationError("El usuario no tiene puntos en este local.") from exc

        if balance.total < points_used:
            raise serializers.ValidationError("Puntos insuficientes para canjear.")
        return attrs

    def create(self, validated_data):
        with transaction.atomic():
            balance = PointBalance.objects.select_for_update().get(
                user=validated_data["user"], local=validated_data["local"]
            )
            points_used = validated_data["points_used"]
            balance.total -= points_used
            balance.save(update_fields=["total", "updated_at"])
            redemption = Redemption.objects.create(**validated_data)
        return redemption
