from decimal import Decimal
from typing import Optional

from django.apps import apps
from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db import models, transaction
from django.utils import timezone
from django.utils.text import slugify


class User(AbstractUser):
    class Roles(models.TextChoices):
        CUSTOMER = "cliente", "Cliente"
        CAFE = "cafeteria", "Cafetería"
        ROASTERY = "tostaduria", "Tostaduría"
        HYBRID = "hibrido", "Híbrido"
        ADMIN = "admin", "Administrador"

    role = models.CharField(max_length=20, choices=Roles.choices, default=Roles.CUSTOMER)
    avatar_url = models.URLField(blank=True, null=True)
    reputation_score = models.FloatField(default=0)
    is_barista = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class Local(models.Model):
    class Types(models.TextChoices):
        CAFE = "cafeteria", "Cafetería"
        ROASTERY = "tostaduria", "Tostaduría"
        HYBRID = "hibrido", "Híbrido"

    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name="locales")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    address = models.CharField(max_length=200)
    schedule = models.CharField(max_length=200, blank=True)
    type = models.CharField(max_length=20, choices=Types.choices, default=Types.CAFE)
    points_rate = models.FloatField(default=0.001, validators=[MinValueValidator(0)])
    qr_code_url = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = "Local"
        verbose_name_plural = "Locales"
        constraints = [
            models.UniqueConstraint(fields=["owner"], name="unique_local_per_owner"),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class ProductCategory(models.Model):
    name = models.CharField(max_length=120)
    slug = models.SlugField(max_length=140)
    description = models.TextField(blank=True)
    local = models.ForeignKey(
        Local,
        on_delete=models.CASCADE,
        related_name="categories",
    )
    tracks_stock = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]
        unique_together = ("local", "slug")

    def __str__(self):
        return f"{self.name} ({self.local.name})"

    def save(self, *args, **kwargs):
        if not self.slug:
            base_slug = slugify(self.name) or "categoria"
            slug = base_slug
            index = 1
            while ProductCategory.objects.filter(local=self.local, slug=slug).exclude(pk=self.pk).exists():
                index += 1
                slug = f"{base_slug}-{index}"
            self.slug = slug
        super().save(*args, **kwargs)


class Product(models.Model):

    class States(models.TextChoices):
        STANDARD = "normal", "Normal"
        FRESH = "recien_tostado", "Recién Tostado"
        PROMO = "promocion", "En Promoción"

    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.0"))])
    category = models.ForeignKey(
        ProductCategory,
        on_delete=models.PROTECT,
        related_name="products",
    )
    tracks_stock = models.BooleanField(default=True)
    stock = models.PositiveIntegerField(default=0)
    low_stock_threshold = models.PositiveIntegerField(default=5)
    critical_stock_threshold = models.PositiveIntegerField(default=0)
    display_order = models.PositiveIntegerField(default=0)
    in_stock = models.BooleanField(default=True)
    state = models.CharField(max_length=20, choices=States.choices, default=States.STANDARD)
    is_active = models.BooleanField(default=True)
    image_url = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["category", "display_order", "name"]
        indexes = [
            models.Index(fields=["category", "display_order"]),
            models.Index(fields=["local", "display_order"]),
        ]

    def __str__(self):
        category_name = self.category.name if self.category_id else "Sin categoría"
        return f"{self.name} ({category_name})"

    @property
    def stock_state(self) -> str:
        if not self.tracks_stock:
            return "available" if self.in_stock else "out"
        if self.stock <= 0:
            return "out"
        if self.stock <= max(self.critical_stock_threshold, 0):
            return "critical"
        if self.stock <= max(self.low_stock_threshold, 0):
            return "low"
        return "normal"

    def adjust_stock(self, quantity):
        if not self.tracks_stock:
            return
        if quantity < 0 and self.stock < abs(quantity):
            raise ValueError("Stock insuficiente para completar la operación")
        self.stock = max(self.stock + quantity, 0)
        self.save(update_fields=["stock", "in_stock", "updated_at"])

    def save(self, *args, **kwargs):
        previous_state = None
        if self.pk:
            try:
                previous = Product.objects.get(pk=self.pk)
                previous_state = previous.stock_state
            except Product.DoesNotExist:
                previous_state = None

        self.stock = max(self.stock or 0, 0)
        self.display_order = max(self.display_order or 0, 0)
        self.low_stock_threshold = max(self.low_stock_threshold or 0, 0)
        self.critical_stock_threshold = max(self.critical_stock_threshold or 0, 0)
        if self.low_stock_threshold < self.critical_stock_threshold:
            self.low_stock_threshold = self.critical_stock_threshold

        if self.tracks_stock:
            self.in_stock = self.stock > 0
        else:
            if self.stock > 0 and not self.in_stock:
                self.in_stock = True

        super().save(*args, **kwargs)

        try:
            notification_model = apps.get_model("api", "Notification")
        except LookupError:
            notification_model = None

        if notification_model is None:
            return

        current_state = self.stock_state
        if previous_state is None:
            notification_model.log_product_created(self)
        elif previous_state != current_state:
            notification_model.log_stock_transition(self, previous_state, current_state)


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "pendiente", "Pendiente"
        PREPARING = "preparando", "Preparando"
        READY = "listo", "Listo"
        COMPLETED = "completado", "Completado"
        CANCELLED = "cancelado", "Cancelado"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="orders")
    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="orders")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    total = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    pickup_code = models.CharField(max_length=12, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Pedido #{self.id} ({self.get_status_display()})"

    def update_status(self, new_status):
        if new_status not in dict(self.Status.choices):
            raise ValueError("Estado inválido")
        self.status = new_status
        self.save(update_fields=["status", "updated_at"])


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)

    def line_total(self):
        return self.unit_price * self.quantity

    def __str__(self):
        return f"{self.product.name} x {self.quantity}"


class PointBalance(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="point_balances")
    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="point_balances")
    total = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "local")
        verbose_name = "Balance de puntos"
        verbose_name_plural = "Balances de puntos"

    def __str__(self):
        return f"{self.user} → {self.local}: {self.total} pts"

    def add_points(self, amount):
        if amount < 0:
            raise ValueError("No se pueden añadir puntos negativos")
        self.total += amount
        self.save(update_fields=["total", "updated_at"])


class Reward(models.Model):
    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="rewards")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    points_required = models.PositiveIntegerField()
    image_url = models.URLField(blank=True, null=True)
    active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["points_required", "name"]

    def __str__(self):
        return f"{self.name} ({self.local.name})"


class Redemption(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="redemptions")
    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="redemptions")
    reward = models.ForeignKey(Reward, on_delete=models.SET_NULL, null=True, blank=True, related_name="redemptions")
    points_used = models.PositiveIntegerField()
    description = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Canje {self.points_used} pts por {self.user}"


class Notification(models.Model):

    class Types(models.TextChoices):
        PRODUCT_CREATED = "product_created", "Producto creado"
        PRODUCT_UPDATED = "product_updated", "Producto actualizado"
        STOCK_LOW = "stock_low", "Stock bajo"
        STOCK_CRITICAL = "stock_critical", "Stock crítico"
        STOCK_OUT = "stock_out", "Sin stock"
        STOCK_RECOVERED = "stock_recovered", "Stock recuperado"

    class Levels(models.TextChoices):
        INFO = "info", "Información"
        SUCCESS = "success", "Éxito"
        WARNING = "warning", "Advertencia"
        CRITICAL = "critical", "Crítica"

    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name="notifications")
    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="notifications")
    product = models.ForeignKey(Product, on_delete=models.CASCADE, null=True, blank=True, related_name="notifications")
    type = models.CharField(max_length=40, choices=Types.choices)
    level = models.CharField(max_length=20, choices=Levels.choices, default=Levels.INFO)
    title = models.CharField(max_length=120)
    message = models.CharField(max_length=255)
    payload = models.JSONField(blank=True, null=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.get_type_display()} · {self.title}"

    def mark_as_read(self, commit: bool = True):
        if not self.is_read:
            self.is_read = True
            self.read_at = timezone.now()
            if commit:
                self.save(update_fields=["is_read", "read_at"])

    @staticmethod
    def _default_payload(product: Product):
        return {
            "product_id": product.id,
            "local_id": product.local_id,
            "category_id": product.category_id,
            "stock": product.stock,
            "tracks_stock": product.tracks_stock,
            "stock_state": product.stock_state,
        }

    @classmethod
    def log_product_created(cls, product: Product):
        cls.objects.create(
            type=cls.Types.PRODUCT_CREATED,
            level=cls.Levels.INFO,
            title="Producto creado",
            message=f"Se añadió {product.name} al catálogo.",
            local=product.local,
            product=product,
            payload=cls._default_payload(product),
        )

    @classmethod
    def log_product_updated(cls, product: Product, user: Optional[User] = None):
        cls.objects.create(
            type=cls.Types.PRODUCT_UPDATED,
            level=cls.Levels.INFO,
            title="Producto actualizado",
            message=f"{product.name} se actualizó correctamente.",
            local=product.local,
            product=product,
            user=user,
            payload=cls._default_payload(product),
        )

    @classmethod
    def log_stock_transition(cls, product: Product, previous_state: str | None, new_state: str):
        if new_state == "normal" and previous_state in {"low", "critical", "out"}:
            cls.objects.create(
                type=cls.Types.STOCK_RECOVERED,
                level=cls.Levels.SUCCESS,
                title="Stock recuperado",
                message=f"{product.name} volvió a un nivel saludable de stock.",
                local=product.local,
                product=product,
                payload=cls._default_payload(product),
            )
            return

        if new_state == "available" and previous_state == "out":
            cls.objects.create(
                type=cls.Types.STOCK_RECOVERED,
                level=cls.Levels.SUCCESS,
                title="Producto disponible",
                message=f"{product.name} volvió a estar disponible para la venta.",
                local=product.local,
                product=product,
                payload=cls._default_payload(product),
            )
            return

        mapping = {
            "low": (
                cls.Types.STOCK_LOW,
                cls.Levels.WARNING,
                "Stock bajo",
                f"{product.name} tiene stock bajo ({product.stock} unidades).",
            ),
            "critical": (
                cls.Types.STOCK_CRITICAL,
                cls.Levels.CRITICAL,
                "Stock crítico",
                f"{product.name} alcanzó un nivel crítico de stock ({product.stock} unidades).",
            ),
            "out": (
                cls.Types.STOCK_OUT,
                cls.Levels.CRITICAL,
                "Producto sin stock",
                f"{product.name} se encuentra sin stock disponible.",
            ),
        }

        if new_state in mapping:
            type_value, level, title, message = mapping[new_state]
            cls.objects.create(
                type=type_value,
                level=level,
                title=title,
                message=message,
                local=product.local,
                product=product,
                payload=cls._default_payload(product),
            )

# Utility transactional helpers -------------------------------------------------

def create_order_with_items(user, local, items_data):
    """Utility to create an order from validated data ensuring stock integrity."""

    with transaction.atomic():
        order = Order.objects.create(user=user, local=local)
        total = Decimal("0.00")

        for item in items_data:
            product = item["product"]
            quantity = item["quantity"]

            if product.tracks_stock:
                if product.stock < quantity:
                    raise ValueError("Stock insuficiente para el producto seleccionado")
                product.stock = max(product.stock - quantity, 0)
                product.save(update_fields=["stock", "in_stock", "updated_at"])

            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                unit_price=product.price,
            )

            total += product.price * quantity

        order.total = total.quantize(Decimal("0.01"))
        order.save(update_fields=["total", "updated_at"])

    return order
