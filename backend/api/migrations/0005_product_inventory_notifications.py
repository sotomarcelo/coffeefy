from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def populate_product_inventory(apps, schema_editor):
    Product = apps.get_model("api", "Product")
    products = (
        Product.objects.select_related("category")
        .order_by("category_id", "created_at", "id")
    )

    category_counters = {}

    for product in products:
        category_key = product.category_id or 0
        position = category_counters.get(category_key, 0)
        category_counters[category_key] = position + 1

        tracks_stock = True
        if product.category_id and hasattr(product, "category"):
            tracks_stock = getattr(product.category, "tracks_stock", True)

        stock_value = product.stock or 0
        in_stock = product.in_stock
        if tracks_stock:
            in_stock = stock_value > 0
        elif in_stock is None:
            in_stock = True

        Product.objects.filter(pk=product.pk).update(
            tracks_stock=tracks_stock,
            stock=stock_value,
            low_stock_threshold=5 if tracks_stock else 0,
            critical_stock_threshold=0,
            display_order=position,
            in_stock=in_stock,
        )


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_product_in_stock"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="tracks_stock",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="product",
            name="low_stock_threshold",
            field=models.PositiveIntegerField(default=5),
        ),
        migrations.AddField(
            model_name="product",
            name="critical_stock_threshold",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddField(
            model_name="product",
            name="display_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(populate_product_inventory, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="product",
            name="stock",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["category", "display_order"], name="api_prod_cat_display_idx"),
        ),
        migrations.AddIndex(
            model_name="product",
            index=models.Index(fields=["local", "display_order"], name="api_prod_loc_display_idx"),
        ),
        migrations.CreateModel(
            name="Notification",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("type", models.CharField(choices=[('product_created', 'Producto creado'), ('product_updated', 'Producto actualizado'), ('stock_low', 'Stock bajo'), ('stock_critical', 'Stock crítico'), ('stock_out', 'Sin stock'), ('stock_recovered', 'Stock recuperado')], max_length=40)),
                ("level", models.CharField(choices=[('info', 'Información'), ('success', 'Éxito'), ('warning', 'Advertencia'), ('critical', 'Crítica')], default='info', max_length=20)),
                ("title", models.CharField(max_length=120)),
                ("message", models.CharField(max_length=255)),
                ("payload", models.JSONField(blank=True, null=True)),
                ("is_read", models.BooleanField(default=False)),
                ("read_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("local", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="api.local")),
                ("product", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="notifications", to="api.product")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="notifications", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "ordering": ["-created_at"],
            },
        ),
    ]
