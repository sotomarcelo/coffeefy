from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("api", "0004_remove_pointbalance_unique_user_local_points_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="product",
            name="in_stock",
            field=models.BooleanField(default=True),
        ),
    ]
