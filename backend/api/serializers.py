from decimal import Decimal

from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    User,
    Local,
    Tag,
    Product,
    ProductCategory,
    Order,
    OrderItem,
    Reward,
    PointBalance,
    Redemption,
    Notification,
    create_order_with_items,
)


class UserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, required=True)
    email = serializers.EmailField(required=False, allow_blank=True)

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

class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "icon",
            "scope",
            "accent_color",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("slug", "created_at", "updated_at")


class LocalSerializer(serializers.ModelSerializer):
    owner_name = serializers.ReadOnlyField(source="owner.username")
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Tag.objects.all(), required=False
    )
    tag_details = TagSerializer(source="tags", many=True, read_only=True)

    class Meta:
        model = Local
        fields = [
            "id",
            "owner",
            "owner_name",
            "name",
            "description",
            "headline",
            "highlights",
            "address",
            "schedule",
            "opening_hours",
            "special_hours",
            "timezone",
            "type",
            "points_rate",
            "qr_code_url",
            "contact_phone",
            "contact_email",
            "whatsapp_number",
            "website_url",
            "reservation_url",
            "facebook_url",
            "instagram_url",
            "tiktok_url",
            "map_url",
            "map_embed_code",
            "latitude",
            "longitude",
            "wifi_network",
            "wifi_password",
            "amenities_note",
            "cover_image_url",
            "gallery_urls",
            "tags",
            "tag_details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("owner_name", "created_at", "updated_at")
        extra_kwargs = {
            "schedule": {"required": False, "allow_blank": True},
            "description": {"required": False, "allow_blank": True},
            "headline": {"required": False, "allow_blank": True},
            "highlights": {"required": False, "allow_blank": True},
            "opening_hours": {"required": False},
            "special_hours": {"required": False},
            "timezone": {"required": False, "allow_blank": True},
            "contact_phone": {"required": False, "allow_blank": True},
            "contact_email": {"required": False, "allow_blank": True},
            "whatsapp_number": {"required": False, "allow_blank": True},
            "website_url": {"required": False, "allow_blank": True},
            "reservation_url": {"required": False, "allow_blank": True},
            "facebook_url": {"required": False, "allow_blank": True},
            "instagram_url": {"required": False, "allow_blank": True},
            "tiktok_url": {"required": False, "allow_blank": True},
            "map_url": {"required": False, "allow_blank": True},
            "map_embed_code": {"required": False, "allow_blank": True},
            "latitude": {"required": False, "allow_null": True},
            "longitude": {"required": False, "allow_null": True},
            "wifi_network": {"required": False, "allow_blank": True},
            "wifi_password": {"required": False, "allow_blank": True},
            "amenities_note": {"required": False, "allow_blank": True},
            "cover_image_url": {"required": False, "allow_blank": True},
            "gallery_urls": {"required": False},
            "tags": {"required": False},
        }

class ProductCategorySerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")

    class Meta:
        model = ProductCategory
        fields = [
            "id",
            "name",
            "slug",
            "description",
            "local",
            "local_name",
            "tracks_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ("slug", "created_at", "updated_at")
        extra_kwargs = {
            "local": {"required": False},
        }

    def validate(self, attrs):
        local = attrs.get("local", getattr(self.instance, "local", None))
        if local is None:
            request = self.context.get("request")
            if request and request.user.is_authenticated:
                local = Local.objects.filter(owner=request.user).first()
                if local is not None:
                    attrs.setdefault("local", local)
            if local is None:
                raise serializers.ValidationError({"local": "Debes asociar la categoría a un local."})
        name = attrs.get("name") or getattr(self.instance, "name", None)
        if not name:
            return attrs

        if ProductCategory.objects.exclude(pk=getattr(self.instance, "pk", None)).filter(
            slug=slugify(name),
            local=local,
        ).exists():
            raise serializers.ValidationError(
                {"name": "Ya existe una categoría con este nombre para ese alcance."}
            )
        return attrs


class ProductSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")
    category_name = serializers.ReadOnlyField(source="category.name")
    category_slug = serializers.ReadOnlyField(source="category.slug")
    category_tracks_stock = serializers.ReadOnlyField(source="category.tracks_stock")
    stock_state = serializers.CharField(read_only=True)
    tags = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Tag.objects.all(), required=False
    )
    tag_details = TagSerializer(source="tags", many=True, read_only=True)

    class Meta:
        model = Product
        fields = [
            "id",
            "local",
            "local_name",
            "name",
            "description",
            "price",
            "category",
            "category_name",
            "category_slug",
            "category_tracks_stock",
            "tracks_stock",
            "stock",
            "stock_state",
            "in_stock",
            "low_stock_threshold",
            "critical_stock_threshold",
            "display_order",
            "state",
            "is_active",
            "image_url",
            "tags",
            "tag_details",
            "created_at",
            "updated_at",
        ]
        read_only_fields = (
            "local_name",
            "category_name",
            "category_slug",
            "category_tracks_stock",
            "stock_state",
            "tag_details",
            "created_at",
            "updated_at",
        )
        extra_kwargs = {
            "stock": {"min_value": 0},
            "low_stock_threshold": {"min_value": 0, "required": False},
            "critical_stock_threshold": {"min_value": 0, "required": False},
            "display_order": {"min_value": 0, "required": False},
        }

    def validate(self, attrs):
        instance = getattr(self, "instance", None)
        category = attrs.get("category", getattr(instance, "category", None))
        tracks_stock = attrs.get("tracks_stock", getattr(instance, "tracks_stock", None))

        if tracks_stock is None:
            tracks_stock = category.tracks_stock if category else True
            attrs["tracks_stock"] = tracks_stock

        stock = attrs.get("stock", getattr(instance, "stock", 0))
        if stock is None:
            raise serializers.ValidationError({"stock": "El stock es obligatorio."})
        if stock < 0:
            raise serializers.ValidationError({"stock": "El stock no puede ser negativo."})

        low_threshold = attrs.get("low_stock_threshold", getattr(instance, "low_stock_threshold", 5))
        critical_threshold = attrs.get(
            "critical_stock_threshold",
            getattr(instance, "critical_stock_threshold", 0),
        )
        if low_threshold < 0:
            raise serializers.ValidationError({"low_stock_threshold": "Debe ser mayor o igual a cero."})
        if critical_threshold < 0:
            raise serializers.ValidationError({"critical_stock_threshold": "Debe ser mayor o igual a cero."})
        if low_threshold < critical_threshold:
            raise serializers.ValidationError(
                {"low_stock_threshold": "Debe ser mayor o igual al umbral crítico."}
            )

        display_order = attrs.get("display_order", getattr(instance, "display_order", 0))
        if display_order is not None and display_order < 0:
            raise serializers.ValidationError({"display_order": "Debe ser cero o positivo."})

        if tracks_stock:
            attrs["stock"] = stock
            attrs["in_stock"] = stock > 0
        else:
            attrs["stock"] = stock
            if "in_stock" not in attrs:
                attrs["in_stock"] = getattr(instance, "in_stock", True)
        return attrs

    def create(self, validated_data):
        category = validated_data["category"]
        if not validated_data.get("display_order"):
            last_order = (
                Product.objects.filter(category=category)
                .order_by("-display_order")
                .values_list("display_order", flat=True)
                .first()
            )
            validated_data["display_order"] = (last_order or 0) + 1

        tracks_stock = validated_data.get("tracks_stock")
        if tracks_stock is None and category:
            validated_data["tracks_stock"] = category.tracks_stock

        product = super().create(validated_data)
        return product

    def update(self, instance, validated_data):
        product = super().update(instance, validated_data)
        request = self.context.get("request")
        if request is not None and hasattr(request, "user"):
            try:
                user = request.user if request.user.is_authenticated else None
                Notification.log_product_updated(product, user)
            except Exception:  # pragma: no cover - evitar fallas en cascada
                pass
        return product


class NotificationSerializer(serializers.ModelSerializer):
    product_name = serializers.ReadOnlyField(source="product.name")
    local_name = serializers.ReadOnlyField(source="local.name")

    class Meta:
        model = Notification
        fields = [
            "id",
            "type",
            "level",
            "title",
            "message",
            "payload",
            "is_read",
            "read_at",
            "created_at",
            "product",
            "product_name",
            "local",
            "local_name",
        ]
        read_only_fields = fields


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
    local_name = serializers.ReadOnlyField(source="local.name")
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = Order
        fields = [
            "id",
            "user_name",
            "local",
            "local_name",
            "status",
            "status_display",
            "total",
            "pickup_code",
            "created_at",
            "updated_at",
            "items",
            "items_data",
        ]
        read_only_fields = (
            "status",
            "status_display",
            "total",
            "pickup_code",
            "created_at",
            "updated_at",
            "local_name",
            "user_name",
        )

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
    redemption_count = serializers.IntegerField(read_only=True)

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
            "redemption_count",
            "created_at",
            "updated_at",
        ]


class PointBalanceSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")
    user_name = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = PointBalance
        fields = [
            "id",
            "user",
            "user_name",
            "local",
            "local_name",
            "total",
            "updated_at",
        ]
        read_only_fields = ("updated_at",)


class RedemptionSerializer(serializers.ModelSerializer):
    local_name = serializers.ReadOnlyField(source="local.name")
    reward_name = serializers.ReadOnlyField(source="reward.name")
    user_name = serializers.ReadOnlyField(source="user.username")

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
            "user_name",
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
