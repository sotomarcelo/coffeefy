from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def seed_categories(apps, schema_editor):
    ProductCategory = apps.get_model("api", "ProductCategory")
    Product = apps.get_model("api", "Product")

    defaults = {
        "bebida": {"name": "Bebidas", "tracks_stock": False},
        "grano": {"name": "Granos", "tracks_stock": True},
    }

    category_cache = {}

    for slug, cfg in defaults.items():
        category_cache[slug], _ = ProductCategory.objects.get_or_create(
            slug=slug,
            local=None,
            defaults={
                "name": cfg["name"],
                "description": "",
                "tracks_stock": cfg["tracks_stock"],
            },
        )

    for product in Product.objects.all():
        product_type = getattr(product, "product_type", None)
        if not product_type:
            continue

        category = category_cache.get(product_type)
        if category is None:
            fallback_name = product_type.replace("_", " ").title()
            fallback_slug = slugify(product_type) or "categoria"
            category, _ = ProductCategory.objects.get_or_create(
                slug=fallback_slug,
                local=None,
                defaults={
                    "name": fallback_name,
                    "description": "",
                    "tracks_stock": False,
                },
            )
            category_cache[product_type] = category

        product.category = category
        if not category.tracks_stock:
            product.stock = None
        product.save(update_fields=["category", "stock"])


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0002_user_role_alter_user_reputation_score_local_order_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ProductCategory",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("slug", models.SlugField(max_length=140)),
                ("description", models.TextField(blank=True)),
                ("tracks_stock", models.BooleanField(default=False)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("local", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="categories", to="api.local")),
            ],
            options={
                "ordering": ["name"],
                "unique_together": {("local", "slug")},
            },
        ),
        migrations.AddField(
            model_name="product",
            name="category",
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name="products", to="api.productcategory"),
        ),
        migrations.RunPython(seed_categories, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="product",
            name="category",
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="products", to="api.productcategory"),
        ),
        migrations.RemoveField(
            model_name="product",
            name="product_type",
        ),
    ]
