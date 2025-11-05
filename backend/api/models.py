from decimal import Decimal

from django.contrib.auth.models import AbstractUser
from django.core.validators import MinValueValidator
from django.db import models, transaction


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

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class Product(models.Model):
    class Types(models.TextChoices):
        BEVERAGE = "bebida", "Bebida"
        BEAN = "grano", "Grano"

    class States(models.TextChoices):
        STANDARD = "normal", "Normal"
        FRESH = "recien_tostado", "Recién Tostado"
        PROMO = "promocion", "En Promoción"

    local = models.ForeignKey(Local, on_delete=models.CASCADE, related_name="products")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=10, decimal_places=2, validators=[MinValueValidator(Decimal("0.0"))])
    product_type = models.CharField(max_length=20, choices=Types.choices)
    stock = models.PositiveIntegerField(blank=True, null=True)
    state = models.CharField(max_length=20, choices=States.choices, default=States.STANDARD)
    is_active = models.BooleanField(default=True)
    image_url = models.URLField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return f"{self.name} ({self.get_product_type_display()})"

    def adjust_stock(self, quantity):
        if self.product_type != self.Types.BEAN:
            return
        if self.stock is None:
            self.stock = 0
        if quantity < 0 and self.stock < abs(quantity):
            raise ValueError("Stock insuficiente para completar la operación")
        self.stock += quantity
        self.save(update_fields=["stock", "updated_at"])


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


# Utility transactional helpers -------------------------------------------------

def create_order_with_items(user, local, items_data):
    """Utility to create an order from validated data ensuring stock integrity."""

    with transaction.atomic():
        order = Order.objects.create(user=user, local=local)
        total = Decimal("0.00")

        for item in items_data:
            product = item["product"]
            quantity = item["quantity"]

            if product.product_type == Product.Types.BEAN:
                if product.stock is None or product.stock < quantity:
                    raise ValueError("Stock insuficiente para el producto seleccionado")
                product.stock -= quantity
                product.save(update_fields=["stock", "updated_at"])

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
