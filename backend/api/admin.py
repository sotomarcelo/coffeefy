from django.contrib import admin

from .models import (
    User,
    Local,
    Product,
    ProductCategory,
    Order,
    OrderItem,
    Reward,
    PointBalance,
    Redemption,
)


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ("id", "username", "email", "role", "is_barista", "is_active")
    list_filter = ("role", "is_barista", "is_active")
    search_fields = ("username", "email")


@admin.register(Local)
class LocalAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "type", "owner", "points_rate", "created_at")
    list_filter = ("type", "points_rate")
    search_fields = ("name", "owner__username", "address")
    readonly_fields = ("created_at", "updated_at")

@admin.register(ProductCategory)
class ProductCategoryAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "local", "tracks_stock", "created_at")
    list_filter = ("tracks_stock", "local")
    search_fields = ("name", "local__name")
    readonly_fields = ("created_at", "updated_at")


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "local", "category", "price", "stock", "state", "is_active")
    list_filter = ("category", "state", "is_active", "local")
    search_fields = ("name", "local__name")
    readonly_fields = ("created_at", "updated_at")


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("unit_price",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "local", "status", "total", "created_at")
    list_filter = ("status", "local")
    search_fields = ("user__username", "local__name")
    readonly_fields = ("created_at", "updated_at", "total")
    inlines = [OrderItemInline]


@admin.register(OrderItem)
class OrderItemAdmin(admin.ModelAdmin):
    list_display = ("id", "order", "product", "quantity", "unit_price")
    search_fields = ("order__id", "product__name")


@admin.register(PointBalance)
class PointBalanceAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "local", "total", "updated_at")
    search_fields = ("user__username", "local__name")
    list_filter = ("local",)


@admin.register(Reward)
class RewardAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "local", "points_required", "active")
    list_filter = ("active", "local")
    search_fields = ("name", "local__name")


@admin.register(Redemption)
class RedemptionAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "local", "points_used", "created_at")
    search_fields = ("user__username", "local__name", "description")
    list_filter = ("local",)
