from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('menus', '0002_menuitem_metadata'),
    ]

    operations = [
        migrations.AddField(
            model_name='menuitem',
            name='image_data',
            field=models.TextField(blank=True),
        ),
        migrations.AlterField(
            model_name='menuitem',
            name='meal_type',
            field=models.CharField(
                max_length=16,
                choices=[
                    ('BREAKFAST1', 'Desjejum'),
                    ('SNACK1', 'Lanche'),
                    ('LUNCH', 'Almoco'),
                    ('SNACK2', 'Lanche'),
                    ('BREAKFAST2', 'Desjejum'),
                    ('DINNER_COFFEE', 'Cafe da noite'),
                    ('BREAKFAST', 'Cafe (legado)'),
                    ('SNACK', 'Lanche (legado)'),
                ],
            ),
        ),
    ]
