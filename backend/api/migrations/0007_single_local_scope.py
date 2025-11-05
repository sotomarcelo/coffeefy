from django.db import migrations, models
import django.db.models.deletion
from django.utils.text import slugify


def migrate_global_categories(apps, schema_editor):
    ProductCategory = apps.get_model("api", "ProductCategory")
    Product = apps.get_model("api", "Product")

    global_categories = ProductCategory.objects.filter(local__isnull=True).order_by("id")

    for category in global_categories:
        products = Product.objects.filter(category=category).select_related("local")
        created_per_local = {}

        for product in products:
            local = product.local
            if local is None:
                continue

            local_key = local.pk
            if local_key not in created_per_local:
                base_slug = category.slug or slugify(category.name) or "categoria"
                slug = base_slug
                index = 1
                while ProductCategory.objects.filter(local=local, slug=slug).exists():
                    slug = f"{base_slug}-{index}"
                    index += 1

                created_per_local[local_key] = ProductCategory.objects.create(
                    name=category.name,
                    slug=slug,
                    description=category.description,
                    tracks_stock=category.tracks_stock,
                    local=local,
                )

            product.category = created_per_local[local_key]
            product.save(update_fields=["category"])

        category.delete()


def reverse_migrate_global_categories(apps, schema_editor):
    # Global categories are deprecated; reverse migration is not implemented.
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0006_alter_product_options_and_more"),
    ]

    operations = [
        migrations.RunPython(migrate_global_categories, reverse_migrate_global_categories),
        migrations.AlterField(
            model_name="productcategory",
            name="local",
            field=models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="categories", to="api.local"),
        ),
        migrations.AddConstraint(
            model_name="local",
            constraint=models.UniqueConstraint(fields=("owner",), name="unique_local_per_owner"),
        ),
    ]
